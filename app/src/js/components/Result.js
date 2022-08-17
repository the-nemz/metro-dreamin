import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import ReactGA from 'react-ga';

import { getViewPath, buildInterlineSegments } from '../util.js';
import { FirebaseContext } from "../firebaseContext.js";

import { ResultMap } from './ResultMap.js';

export const Result = ({ viewData = {}, isFeature, isCityFeature }) => {
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
    if (isCityFeature) {
      category = 'Discover';
      action = 'City Feature Click';
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

      let ownerElem = userDocData ? (
        <div className="Result-ownerStars">
          by {userDocData.displayName ? userDocData.displayName : 'Anonymous'}
          {starLinksContent ? ', ' : ''}
          {starLinksContent}
        </div>
      ) : null;

      if (firebaseContext.user && firebaseContext.user.uid === viewData.userId) {
        ownerElem = (
          <div className="Result-ownerStars">
            by <span className="Result-youText">you!</span>
            {starLinksContent ? ', ' : ''}
            {starLinksContent}
          </div>
        );
      }

      const extraParams = isFeature || isCityFeature ? {} : { target: '_blank', rel: 'nofollow noopener noreferrer' };

      let classes = ['Result', 'Result--ready'];
      if (isFeature) classes.push('Result--feature');
      if (isCityFeature) classes.push('Result--cityFeature');
      return (
        <Link className={classes.join(' ')} key={viewData.viewId} to={getViewPath(viewData.userId, viewData.systemId)}
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
              {ownerElem}
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
