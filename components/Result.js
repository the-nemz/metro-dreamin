import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import ReactGA from 'react-ga4';
import { useInView } from 'react-intersection-observer';

import { FirebaseContext, getFullSystem, getUrlForBlob } from '/util/firebase.js';
import {
  getViewPath,
  getEditPath,
  buildInterlineSegments,
  timestampToText,
  getSystemBlobId,
  getUserDisplayName,
  getTransfersFromWorker,
  displayLargeNumber,
  getLevel
} from '/util/helpers.js';

import { ResultMap } from '/components/ResultMap.js';

const fullRenderTypes = [ 'feature' ]; // only render full system for features to dramatically decrease firestore read costs
const thumbnailOnlyTypes = [ 'recent', 'search', 'userStar' ]; // previously used until firestore costs ballooned with new document structure

export const Result = ({
  viewData = {},
  types = [ 'default' ], // feature, nearby, star, recent, search, related, profile, userStar
}) => {
  const [userDocData, setUserDocData] = useState();
  const [systemDocData, setSystemDocData] = useState();
  const [fullSystemData, setFullSystemData] = useState();
  const [thumbnail, setThumbnail] = useState();
  const [mapIsReady, setMapIsReady] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [wasInView, setWasInView] = useState(false);
  const [useThumbnail, setUseThumbnail] = useState(types.filter(t => fullRenderTypes.includes(t)).length === 0);
  const [shouldBeHidden, setShouldBeHidden] = useState(false);
  // below was previously used until firestore costs ballooned with new document structure
  // const [useThumbnail, setUseThumbnail] = useState(types.filter(t => thumbnailOnlyTypes.includes(t)).length > 0)

  const firebaseContext = useContext(FirebaseContext);
  const { ref, inView } = useInView(); // inView is ignored on related maps to ensure WebGL doesn't overflow
  const transfersWorker = useRef();

  const zoomThresholdsForLines = useMemo(() => {
    if (systemDocData?.level) {
      const levelConfig = getLevel({ key: systemDocData.level });
      if (levelConfig?.zoomThresholdsForLines) {
        return levelConfig.zoomThresholdsForLines;
      }
    }
    return getLevel({ key: 'XLONG' }).zoomThresholdsForLines;
  }, [systemDocData?.level]);

  useEffect(() => {
    if (viewData.userId) {
      const userDocString = `users/${viewData.userId}`;
      let userDoc = doc(firebaseContext.database, userDocString);
      getDoc(userDoc).then((uDoc) => {
        if (uDoc.exists()) {
          setUserDocData(uDoc.data());
        }
      }).catch((error) => {
        console.log('result get author error:', error);
      });
    }

    if (!viewData.lastUpdated && viewData.systemId) {
      // using snippet from local storage
      const systemDocString = `systems/${viewData.systemId}`;
      let systemDoc = doc(firebaseContext.database, systemDocString);
      getDoc(systemDoc).then((sDoc) => {
        if (sDoc.exists()) {
          const sDocData = sDoc.data();
          if (sDocData?.isPrivate) {
            setShouldBeHidden(true);
          } else {
            setSystemDocData(sDoc.data());
          }
        } else {
          setShouldBeHidden(true);
        }
      }).catch((error) => {
        console.log('result get system doc error:', error);
      });
    }

    let workerInstance;
    if (!useThumbnail) {
      workerInstance = new Worker(new URL('../workers/transfers.js', import.meta.url), { type: 'module' });
      transfersWorker.current = workerInstance;
    }

    return () => {
      if (workerInstance) {
        workerInstance.terminate();
      }
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

    if (inView && !isCalculating && !fullSystemData) {
      getFullSystem(viewData.systemId).then(handleFullSystem)
                                      .catch((error) => {
                                        console.log('result get full system error:', error);
                                      });
    }

    if (!inView && fullSystemData) {
      setWasInView(true);
    }
  }, [inView, isCalculating, useThumbnail]);

  const handleFullSystem = async (systemData) => {
    if (systemData.map) {
      setIsCalculating(true);

      const lines = systemData.map.lines || {};
      const stations = systemData.map.stations || {};
      const interchanges = systemData.map.interchanges || {};

      let updatedTransfersByStationId = {};
      try {
        const dataFromTransfersWorker = await getTransfersFromWorker(transfersWorker?.current, { lines, stations });
        updatedTransfersByStationId = dataFromTransfersWorker?.transfersByStationId ?? {};
        systemData.map.transfersByStationId = updatedTransfersByStationId;
      } catch (e) {
        console.error('Unexpected error getting transfers', e);
        setIsCalculating(false);
        return;
      }

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

      systemData.map.interlineSegments = { ...buildInterlineSegments(systemData.map, Object.keys(lines), 1) };
    }

    setIsCalculating(false);
    setFullSystemData(systemData);
  }

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
        <ResultMap system={mapIsReady ? fullSystemData.map : {}} centroid={viewData.centroid} noZoom={wasInView}
                  interlineSegments={mapIsReady && fullSystemData?.map?.interlineSegments ? fullSystemData.map.interlineSegments : {}}
                  useLight={firebaseContext.settings.lightMode || false} zoomThresholdsForLines={zoomThresholdsForLines}
                  onMapInit={(map) => map.isStyleLoaded() && setMapIsReady(true)} />
      </div>
    );
  }

  if (shouldBeHidden) return;

  if (viewData.systemId) {
    const docData = { ...viewData, ...(systemDocData || {}) };

    let classes = [ 'Result' ];
    for (const t of types.sort()) classes.push(`Result--${t}`);

    let starLinksContent;
    if (docData.stars) {
      starLinksContent = (
        <span className="Result-starText">
          {displayLargeNumber(docData.stars, 3)} {docData.stars === 1 ? 'star' : 'stars'}
        </span>
      );
    }

    let pointsLinksContent;
    if (docData.score) {
      pointsLinksContent = (
        <span className="Result-pointText">
          {displayLargeNumber(docData.score, 3)} {docData.score === 1 ? 'point' : 'points'}
        </span>
      );
    }

    let ownerText;
    if (firebaseContext.user && firebaseContext.user.uid === docData.userId) {
      ownerText = (
        <span className="Result-owner--you">you!</span>
      );
    } else {
      const showName = !firebaseContext.checkBidirectionalBlocks(docData.userId) && userDocData;
      ownerText = (
        <span className="Result-owner">{showName ? getUserDisplayName(userDocData) : 'Anonymous'}</span>
      );
    }

    let ownerElem = (
      <div className="Result-subtext">
        by {ownerText}
        {pointsLinksContent ? ', ' : ''}
        {pointsLinksContent}
        {starLinksContent ? ', ' : ''}
        {starLinksContent}
      </div>
    );

    let profileElem = (
      <div className="Result-subtext">
        {displayLargeNumber(docData.numLines, 3)} {docData.numLines === 1 ? 'line' : 'lines'}{', '}
        {displayLargeNumber(docData.numStations, 3)} {docData.numStations === 1 ? 'station' : 'stations'}
        {pointsLinksContent ? ', ' : ''}
        {pointsLinksContent}
        {starLinksContent ? ', ' : ''}
        {starLinksContent}
      </div>
    );

    let timeLinksContent;
    if (types.includes('recent')) {
      timeLinksContent = (
        <span className="Result-timeText">
          {timestampToText(docData.lastUpdated)}
        </span>
      );
    }

    const extraParams = types.includes('search') ?
                        { target: '_blank', rel: 'nofollow noopener noreferrer' } :
                        { };

    const path = firebaseContext.user && firebaseContext.user.uid === docData.userId
                  ? getEditPath(docData.userId, docData.systemNumStr)
                  : getViewPath(docData.userId, docData.systemNumStr);

    const systemLoaded = fullSystemData && fullSystemData.map;
    if (systemLoaded) {
      classes.push('Result--ready');
    } else {
      classes.push('Result--loading');
    }

    const showMap = !useThumbnail && systemLoaded && (inView || types.includes('related') || types.includes('feature'));
    const style = thumbnail ? { background: `transparent no-repeat center/cover url("${thumbnail}")` } : {};
    return (
      <Link className={classes.join(' ')} key={docData.systemId} href={path} ref={ref}
            style={style} {...extraParams}
            onClick={fireClickAnalytics}>

        {showMap && renderMap()}

        {docData.lastUpdated && (
          <div className="Result-infoWrap">
            <div className="Result-title">
              {types.includes('feature') ? 'Featured: ' : ''}{docData.title ? docData.title : 'Untitled'}
            </div>
            <div className="Result-details">
              {types.includes('profile') ? profileElem : ownerElem}
              {timeLinksContent}
            </div>
          </div>
        )}
      </Link>
    );
  }
}
