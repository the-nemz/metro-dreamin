import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga';

import { getViewPath, buildInterlineSegments, timestampToText } from '/lib/util.js';
import { FirebaseContext } from '/lib/firebaseContext.js';

import { ResultMap } from '/components/ResultMap.js';

export const Result = ({ viewData = {}, isFeature, isSubFeature, isRecentFeature }) => {
  const [userDocData, setUserDocData] = useState();
  const [systemDocData, setSystemDocData] = useState();
  const [mapIsReady, setMapIsReady] = useState(false);

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (viewData.userId && viewData.systemId) {
      const userDocString = `users/${viewData.userId}`;
      let userDoc = firebaseContext.database.doc(userDocString);
      userDoc.get().then((doc) => {
        if (doc) {
          setUserDocData(doc.data());
        }
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });

      const systemDocString = `${userDocString}/systems/${viewData.systemId}`;
      let systemDoc = firebaseContext.database.doc(systemDocString);
      systemDoc.get().then((doc) => {
        if (doc) {
          setSystemDocData(doc.data());
        }
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

      let classes = ['Result', 'Result--ready'];
      if (isFeature) classes.push('Result--feature');
      if (isSubFeature) classes.push('Result--cityFeature');
      if (isRecentFeature) classes.push('Result--recentFeature');
      return (
        <Link className={classes.join(' ')} key={viewData.viewId} href={getViewPath(viewData.userId, viewData.systemId)}
              {...extraParams} onClick={fireClickAnalytics}>
          <div className="Result-mapWrap">
            <ResultMap system={mapIsReady ? systemDocData.map : {}} centroid={viewData.centroid}  interlineSegments={mapIsReady ? buildInterlineSegments(systemDocData.map, Object.keys(systemDocData.map.lines), 4) : {}}
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
