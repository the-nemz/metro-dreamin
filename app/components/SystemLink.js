import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';

import { FirebaseContext, getSystemDocData, getUserDocData } from '/lib/firebase.js';

export const SystemLink = ({ systemId, analyticsObject = { category: 'SystemLink', action: 'Click' } }) => {
  const [systemDocData, setSystemDocData] = useState();
  const [ownerDocData, setOwnerDocData] = useState();

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (systemId && !systemId.startsWith('defaultSystems/')) {
      getSystemDocData(systemId).then(sysDocData => setSystemDocData(sysDocData))
    }
  }, []);

  useEffect(() => {
    if (systemDocData && systemDocData.userId) {
      getUserDocData(systemDocData.userId)
        .then(userDocData => setOwnerDocData(userDocData))
        .catch(e => console.log('systemlink author error:', e));
    }
  }, [systemDocData]);

  if (systemDocData && ownerDocData) {
    let starLinksContent;
    if (systemDocData.stars) {
      starLinksContent = (
        <span className="SystemLink-starText">
          {systemDocData.stars} {systemDocData.stars === 1 ? 'star' : 'stars'}
        </span>
      );
    }

    let ownerElem = ownerDocData ? (
      <div className="SystemLink-ownerStars">
        by {ownerDocData.displayName ? ownerDocData.displayName : 'Anonymous'}
        {starLinksContent ? ', ' : ''}
        {starLinksContent}
      </div>
    ) : null;

    if (firebaseContext.user && firebaseContext.user.uid === ownerDocData.userId) {
      ownerElem = (
        <span className="SystemLink-ownerStars">
          by <span className="SystemLink-youText">you!</span>
          {starLinksContent ? ', ' : ''}
          {starLinksContent}
        </span>
      );
    }

    const path = firebaseContext.user && firebaseContext.user.uid === systemDocData.userId ?
                  `/edit/${encodeURIComponent(systemDocData.systemId)}` :
                  `/view/${encodeURIComponent(systemDocData.systemId)}`;
    return (
      <Link className="SystemLink SystemLink--ready ViewLink" key={systemId} href={path}
            onClick={() => ReactGA.event(analyticsObject)}>
        <div className="SystemLink-title">
          {systemDocData.title ? systemDocData.title : 'Untitled'}
        </div>
        {ownerElem}
      </Link>
    );
  }

  return (
    <div className="SystemLink SystemLink--loading">
    </div>
  );
}
