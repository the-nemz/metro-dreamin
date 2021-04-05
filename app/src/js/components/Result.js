import React, { useState, useEffect, useContext } from 'react';

import browserHistory from "../history.js";
import { getViewPath } from '../util.js';
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

      let classes = ['Result', 'Result--ready'];
      if (isFeature) classes.push('Result--feature');
      if (isCityFeature) classes.push('Result--cityFeature');
      return (
        <div className={classes.join(' ')} key={viewData.viewId} onClick={goToView}>
          <div className="Result-mapWrap">
            <ResultMap system={mapIsReady ? systemDocData.map : {}} centroid={viewData.centroid}
                      useLight={firebaseContext.settings.lightMode || false}
                      onMapInit={(map) => map.on('load', () => setMapIsReady(true))} />
          </div>
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
