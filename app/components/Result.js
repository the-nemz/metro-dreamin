import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import ReactGA from 'react-ga';
import { useInView } from 'react-intersection-observer';

import { getViewPath, getEditPath, buildInterlineSegments, timestampToText } from '/lib/util.js';
import { FirebaseContext, getFullSystem } from '/lib/firebase.js';

import { ResultMap } from '/components/ResultMap.js';

export const Result = ({ viewData = {}, isOnProfile, isFeature, isSubFeature, isRecentFeature, isRelated, isSearchResult }) => {
  const [userDocData, setUserDocData] = useState();
  const [systemDocData, setSystemDocData] = useState();
  const [mapIsReady, setMapIsReady] = useState(false);
  const [wasInView, setWasInView] = useState(false);

  const firebaseContext = useContext(FirebaseContext);
  const { ref, inView } = useInView();

  useEffect(() => {
    if (viewData.userId && viewData.systemNumStr) {
      const userDocString = `users/${viewData.userId}`;
      let userDoc = doc(firebaseContext.database, userDocString);
      getDoc(userDoc).then((uDoc) => {
        if (uDoc) {
          setUserDocData(uDoc.data());
        }
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });
    }
  }, []);

  useEffect(() => {
    if (inView && !systemDocData) {
      getFullSystem(viewData.systemId).then((systemData) => {
        setSystemDocData(systemData);
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });
    }

    if (!inView && systemDocData) {
      console.log('in here')
      setWasInView(true);
    }
  }, [inView]);

  const fireClickAnalytics = () => {
    let category = 'Search';
    let action = 'Result Click';
    if (isRelated) {
      category = 'Related';
      action = 'Feature Click';
    } else if (isSubFeature) {
      category = 'Discover';
      action = 'Sub Feature Click';
    } else if (isRecentFeature) {
      category = 'Discover';
      action = 'Recent Feature Click';
    } else if (isFeature) {
      category = 'Discover';
      action = 'Main Feature Click';
    }

    ReactGA.event({
      category: category,
      action: action,
      label: viewData.systemId
    });
  }

  const renderMap = () => {
    return (
      <div className="Result-map">
        <ResultMap system={mapIsReady ? systemDocData.map : {}} centroid={viewData.centroid} noZoom={wasInView}
                  interlineSegments={mapIsReady ? buildInterlineSegments(systemDocData.map, Object.keys(systemDocData.map.lines), 4) : {}}
                  useLight={firebaseContext.settings.lightMode || false}
                  onMapInit={(map) => map.on('load', () => setMapIsReady(true))} />
      </div>
    );
  }

  if (viewData.systemId) {
    let classes = [ 'Result' ];
    if (isSearchResult) classes.push('Result--search');
    if (isRelated) classes.push('Result--related');
    if (isFeature) classes.push('Result--feature');
    if (isSubFeature) classes.push('Result--cityFeature');
    if (isRecentFeature) classes.push('Result--recentFeature');

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
      ownerText = (
        <span className="Result-owner">{userDocData && userDocData.displayName ? userDocData.displayName : 'Anonymous'}</span>
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
    if (isRecentFeature) {
      timeLinksContent = (
        <span className="Result-timeText">
          {timestampToText(viewData.lastUpdated)}
        </span>
      );
    }

    const extraParams = isSearchResult ? { target: '_blank', rel: 'nofollow noopener noreferrer' } : {};

    const path = firebaseContext.user && firebaseContext.user.uid === viewData.userId
                  ? getEditPath(viewData.userId, viewData.systemNumStr)
                  : getViewPath(viewData.userId, viewData.systemNumStr);

    const systemLoaded = systemDocData && systemDocData.map;
    if (systemLoaded) {
      classes.push('Result--ready');
    } else {
      classes.push('Result--loading');
    }

    return (
      <Link className={classes.join(' ')} key={viewData.systemId} href={path} ref={ref}
            {...extraParams} onClick={fireClickAnalytics}>
        {systemLoaded && inView && renderMap()}
        <div className="Result-info">
          <div className="Result-infoWrap">
            <div className="Result-title">
              {isFeature ? 'Featured: ' : ''}{viewData.title ? viewData.title : 'Untitled'}
            </div>
            <div className="Result-details">
              {isOnProfile ? profileElem : ownerElem}
              {timeLinksContent}
            </div>
          </div>
        </div>
      </Link>
    );
  }
  return;
}
