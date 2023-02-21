import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';

import { FirebaseContext, getSystemDocData, getUserDocData } from '/lib/firebase.js';

export const SystemMiniLink = ({ systemId = '', analyticsObject = { category: 'SystemMiniLink', action: 'Click' } }) => {
  const [systemDocData, setSystemDocData] = useState();
  const [ownerDocData, setOwnerDocData] = useState();

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (systemId && !systemId.startsWith('defaultSystems/')) {
      getSystemDocData(systemId)
        .then(sysDocData => {
          if (sysDocData) {
            setSystemDocData(sysDocData)
          } else {
            setSystemDocData({ deleted: true });
          }
        })
        .catch(e => {
          if (e.message === 'Not Found') {
            setSystemDocData({ deleted: true });
          } else {
            console.log(e);
          }
        });
    }
  }, []);

  useEffect(() => {
    if (systemDocData && systemDocData.userId) {
      getUserDocData(systemDocData.userId)
        .then(userDocData => setOwnerDocData(userDocData))
        .catch(e => console.log('systemminilink author error:', e));
    }
  }, [systemDocData]);

  if (systemDocData && systemDocData.deleted) {
    return <div className="SystemMiniLink SystemMiniLink--deleted">
      [deleted]
    </div>;
  }

  if (!systemDocData || !systemDocData.systemId || !ownerDocData || !ownerDocData.userId) {
    return <div className="SystemMiniLink SystemMiniLink--loading">
      loading...
    </div>;
  }

  if (systemDocData.isPrivate) {
    return <div className="SystemMiniLink SystemMiniLink--private">
      [private map]
    </div>;
  }

  const isOwnMap = firebaseContext.user && firebaseContext.user.uid === systemDocData.userId;

  return (
    <Link className="SystemMiniLink Link"
          href={`/${isOwnMap ? 'edit' : 'view'}/${encodeURIComponent(systemDocData.systemId)}`}
          onClick={() => ReactGA.event(analyticsObject)}>
      {systemDocData.title} by {ownerDocData.displayName ? ownerDocData.displayName : 'Anon'}
    </Link>
  );
}
