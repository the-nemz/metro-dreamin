import React, { useState, useEffect } from 'react';

import browserHistory from "../history.js";
import { getViewPath } from '../util.js';

import { Map } from './ResultMap.js';

export const Result = ({ viewData = {}, database, isFeature, lightMode }) => {
  const [userDocData, setUserDocData] = useState();
  const [systemDocData, setSystemDocData] = useState();
  const [mapIsReady, setMapIsReady] = useState(false);

  useEffect(() => {
    if (viewData.userId && viewData.systemId) {
      const userDocString = `users/${viewData.userId}`;
      let userDoc = database.doc(userDocString);
      userDoc.get().then((doc) => {
        if (doc) {
          setUserDocData(doc.data());
        }
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });

      const systemDocString = `${userDocString}/systems/${viewData.systemId}`;
      let systemDoc = database.doc(systemDocString);
      systemDoc.get().then((doc) => {
        if (doc) {
          setSystemDocData(doc.data());
        }
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });
    }
  }, []);

  if (viewData.viewId) {
    const goToView = () => {
      browserHistory.push(getViewPath(viewData.userId, viewData.systemId));
      browserHistory.go(0);
    };
    if (systemDocData && systemDocData.map) {
      const ownerElem = userDocData ? (
        <div className="Result-owner">
          by {userDocData.displayName ? userDocData.displayName : 'Anonymous'}
        </div>
      ) : null;
      const resultClass = 'Result Result--ready' + (isFeature ? ' Result--feature' : '');
      return (
        <div className={resultClass} key={viewData.viewId} onClick={goToView}>
          <Map system={mapIsReady ? systemDocData.map : {}} useLight={lightMode}
              onMapInit={(map) => map.on('load', () => setMapIsReady(true))}
              onToggleMapStyle={(map, style) => {}} />
          <div className="Result-info">
            <div className="Result-title">
              {isFeature ? '✨Featured✨: ' : ''}{systemDocData.map.title ? systemDocData.map.title : 'Untitled'}
            </div>
            {ownerElem}
          </div>
        </div>
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
