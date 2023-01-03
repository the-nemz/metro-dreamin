import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import ReactGA from 'react-ga';

import { getViewPath, getEditPath, buildInterlineSegments, timestampToText } from '/lib/util.js';
import { FirebaseContext, getSystemFromDatabase } from '/lib/firebase.js';

import { ResultMap } from '/components/ResultMap.js';

export const Result = ({ viewData = {}, isFeature, isSubFeature, isRecentFeature }) => {
  const [userDocData, setUserDocData] = useState();
  const [systemDocData, setSystemDocData] = useState();
  const [mapIsReady, setMapIsReady] = useState(false);

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (viewData.userId && viewData.systemId) {
      const userDocString = `users/${viewData.userId}`;
      let userDoc = doc(firebaseContext.database, userDocString);
      getDoc(userDoc).then((uDoc) => {
        if (uDoc) {
          setUserDocData(uDoc.data());
        }
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });

      getSystemFromDatabase(viewData.viewId).then((systemData) => {
        setSystemDocData(systemData);
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });
    }
  }, []);

  const fireClickAnalytics = () => {
    let category = 'Search';
    let action = 'Result Click';
    if (isSubFeature) {
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
      label: viewData.viewId
    });
  }

  if (viewData.viewId) {
    if (systemDocData && systemDocData.map) {
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
        <div className="Result-ownerStars">
          by {ownerText}
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

      const extraParams = isFeature || isSubFeature || isRecentFeature ? {} : { target: '_blank', rel: 'nofollow noopener noreferrer' };

      const path = firebaseContext.user && firebaseContext.user.uid === viewData.userId
                    ? getEditPath(viewData.userId, viewData.systemId)
                    : getViewPath(viewData.userId, viewData.systemId);

      let classes = ['Result', 'Result--ready'];
      if (isFeature) classes.push('Result--feature');
      if (isSubFeature) classes.push('Result--cityFeature');
      if (isRecentFeature) classes.push('Result--recentFeature');
      return (
        <Link className={classes.join(' ')} key={viewData.viewId} href={path}
              {...extraParams} onClick={fireClickAnalytics}>
          <div className="Result-mapWrap">
            <ResultMap system={mapIsReady ? systemDocData.map : {}} centroid={viewData.centroid}
                      interlineSegments={mapIsReady ? buildInterlineSegments(systemDocData.map, Object.keys(systemDocData.map.lines), 4) : {}}
                      useLight={firebaseContext.settings.lightMode || false}
                      onMapInit={(map) => map.on('load', () => setMapIsReady(true))} />
          </div>
          <div className="Result-info">
            <div className="Result-infoWrap">
              <div className="Result-title">
                {isFeature ? 'Featured: ' : ''}{systemDocData.map.title ? systemDocData.map.title : 'Untitled'}
              </div>
              <div className="Result-details">
                {ownerElem}
                {timeLinksContent}
              </div>
            </div>
          </div>
        </Link>
      );
    } else {
      return (
        <div className="Result Result--loading">
        </div>
      );
    }
  }
  return;
}
