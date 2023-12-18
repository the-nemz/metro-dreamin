import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import ReactGA from 'react-ga4';
import { useInView } from 'react-intersection-observer';

import { getViewPath, getEditPath, getTransfersForStation, buildInterlineSegments, timestampToText, getSystemBlobId } from '/lib/util.js';
import { FirebaseContext, getFullSystem, getUrlForBlob } from '/lib/firebase.js';

import { ResultMap } from '/components/ResultMap.js';

const fullRenderTypes = [ 'feature' ]; // only render full system for features to dramatically decrease firestore read costs
const thumbnailOnlyTypes = [ 'recent', 'search', 'userStar' ]; // previously used until firestore costs ballooned with new document structure

export const Result = ({
  viewData = {},
  types = [ 'default' ], // feature, nearby, star, recent, search, related, profile, userStar
}) => {
  const [userDocData, setUserDocData] = useState();
  const [systemDocData, setSystemDocData] = useState();
  const [thumbnail, setThumbnail] = useState();
  const [mapIsReady, setMapIsReady] = useState(false);
  const [wasInView, setWasInView] = useState(false);
  const [useThumbnail, setUseThumbnail] = useState(types.filter(t => fullRenderTypes.includes(t)).length === 0);
  // below was previously used until firestore costs ballooned with new document structure
  // const [useThumbnail, setUseThumbnail] = useState(types.filter(t => thumbnailOnlyTypes.includes(t)).length > 0)

  const firebaseContext = useContext(FirebaseContext);
  const { ref, inView } = useInView(); // inView is ignored on related maps to ensure WebGL doesn't overflow

  useEffect(() => {
    if (viewData.userId && viewData.systemNumStr) {
      const userDocString = `users/${viewData.userId}`;
      let userDoc = doc(firebaseContext.database, userDocString);
      getDoc(userDoc).then((uDoc) => {
        if (uDoc) {
          setUserDocData(uDoc.data());
        }
      }).catch((error) => {
        console.log('result get author error:', error);
      });
    }
  }, []);

  useEffect(() => {
    if (types.includes('feature')) {
      // always animate banner features
      setUseThumbnail(false);
      return;
    }

    // below was previously used until firestore costs ballooned with new document structure
    // const isThumbnailOnlyType = types.filter(t => thumbnailOnlyTypes.includes(t)).length > 0;
    const isThumbnailOnlyType = types.filter(t => fullRenderTypes.includes(t)).length === 0;
    setUseThumbnail(firebaseContext.settings.lowPerformance || isThumbnailOnlyType);
  }, [firebaseContext.settings.lowPerformance])

  useEffect(() => {
    if (useThumbnail) {
      getUrlForBlob(getSystemBlobId(viewData.systemId, firebaseContext.settings.lightMode))
        .then(url => setThumbnail(url))
        .catch(e => console.log('get thumbnail url error:', e));
    }
  }, [firebaseContext.settings.lightMode, useThumbnail])

  useEffect(() => {
    if (useThumbnail) return;

    if (inView && !systemDocData) {
      getFullSystem(viewData.systemId).then((systemData) => {
        if (systemData.map) {
          const lines = systemData.map.lines || {};
          const stations = systemData.map.stations || {};
          const interchanges = systemData.map.interchanges || {};

          const stopsByLineId = {};
          for (const lineId in lines) {
            stopsByLineId[lineId] = lines[lineId].stationIds.filter(sId => stations[sId] &&
                                                                           !stations[sId].isWaypoint &&
                                                                           !(lines[lineId].waypointOverrides || []).includes(sId));
          }

          let updatedTransfersByStationId = {};
          for (const stationId in stations) {
            updatedTransfersByStationId[stationId] = getTransfersForStation(stationId, lines, stopsByLineId);
          }
          systemData.map.transfersByStationId = updatedTransfersByStationId;

          let updatedInterchangesByStationId = {};
          for (const interchange of Object.values(interchanges)) {
            let lineIds = new Set();
            for (const stationId of interchange.stationIds) {
              (updatedTransfersByStationId[stationId]?.onLines ?? [])
                .forEach(transfer => {
                  if (!transfer.isWaypointOverride && transfer?.lineId) {
                    lineIds.add(transfer.lineId);
                  }
                });
            }

            const hasLines = Array.from(lineIds);
            for (const stationId of interchange.stationIds) {
              updatedInterchangesByStationId[stationId] = { ...interchange, hasLines };
            }
          }
          systemData.map.interchangesByStationId = updatedInterchangesByStationId;

          systemData.map.interlineSegments = { ...buildInterlineSegments(systemData.map, Object.keys(lines), 4) };
        }
        setSystemDocData(systemData);
      }).catch((error) => {
        console.log('result get full system error:', error);
      });
    }

    if (!inView && systemDocData) {
      setWasInView(true);
    }
  }, [inView, useThumbnail]);

  const fireClickAnalytics = () => {
    ReactGA.event({
      category: 'Result',
      action: `Click - ${types.slice().sort().join(', ')}`,
      label: viewData.systemId
    });
  }

  const renderMap = () => {
    return (
      <div className="Result-map">
        <ResultMap system={mapIsReady ? systemDocData.map : {}} centroid={viewData.centroid} noZoom={wasInView}
                  interlineSegments={mapIsReady && systemDocData?.map?.interlineSegments ? systemDocData.map.interlineSegments : {}}
                  useLight={firebaseContext.settings.lightMode || false}
                  onMapInit={(map) => map.on('load', () => setMapIsReady(true))} />
      </div>
    );
  }

  if (viewData.systemId) {
    let classes = [ 'Result' ];
    for (const t of types.sort()) classes.push(`Result--${t}`);

    let starLinksContent;
    if (viewData.stars) {
      starLinksContent = (
        <span className="Result-starText">
          {viewData.stars} {viewData.stars === 1 ? 'star' : 'stars'}
        </span>
      );
    }

    let ownerText;
    if (firebaseContext.user && firebaseContext.user.uid === viewData.userId) {
      ownerText = (
        <span className="Result-owner--you">you!</span>
      );
    } else {
      const showName = !firebaseContext.checkBidirectionalBlocks(viewData.userId) && userDocData && userDocData.displayName;
      ownerText = (
        <span className="Result-owner">{showName ? userDocData.displayName : 'Anonymous'}</span>
      );
    }

    let ownerElem = (
      <div className="Result-subtext">
        by {ownerText}
        {starLinksContent ? ', ' : ''}
        {starLinksContent}
      </div>
    );

    let profileElem = (
      <div className="Result-subtext">
        {viewData.numLines} {viewData.numLines === 1 ? 'line' : 'lines'}, {viewData.numStations} {viewData.numStations === 1 ? 'station' : 'stations'}
        {starLinksContent ? ', ' : ''}
        {starLinksContent}
      </div>
    );

    let timeLinksContent;
    if (types.includes('recent')) {
      timeLinksContent = (
        <span className="Result-timeText">
          {timestampToText(viewData.lastUpdated)}
        </span>
      );
    }

    const extraParams = types.includes('search') ?
                        { target: '_blank', rel: 'nofollow noopener noreferrer' } :
                        { };

    const path = firebaseContext.user && firebaseContext.user.uid === viewData.userId
                  ? getEditPath(viewData.userId, viewData.systemNumStr)
                  : getViewPath(viewData.userId, viewData.systemNumStr);

    const systemLoaded = systemDocData && systemDocData.map;
    if (systemLoaded) {
      classes.push('Result--ready');
    } else {
      classes.push('Result--loading');
    }

    const showMap = !useThumbnail && systemLoaded && (inView || types.includes('related'));
    const style = thumbnail ? { background: `transparent no-repeat center/cover url("${thumbnail}")` } : {};
    return (
      <Link className={classes.join(' ')} key={viewData.systemId} href={path} ref={ref}
            style={style} {...extraParams}
            onClick={fireClickAnalytics}>

        {showMap && renderMap()}

        <div className="Result-info">
          <div className="Result-infoWrap">
            <div className="Result-title">
              {types.includes('feature') ? 'Featured: ' : ''}{viewData.title ? viewData.title : 'Untitled'}
            </div>
            <div className="Result-details">
              {types.includes('profile') ? profileElem : ownerElem}
              {timeLinksContent}
            </div>
          </div>
        </div>
      </Link>
    );
  }
  return;
}
