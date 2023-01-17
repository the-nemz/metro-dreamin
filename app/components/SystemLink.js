import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';

import { FirebaseContext, getSystemDocData, getUserDocData } from '/lib/firebase.js';

export const SystemLink = ({ systemId = '' }) => {
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
      getUserDocData(systemDocData.userId).then(userDocData => setOwnerDocData(userDocData))
    }
  }, [systemDocData]);

  if (!systemDocData || !systemDocData.systemId || !ownerDocData || !ownerDocData.userId) {
    return <div className="SystemLink SystemLink--loading">
      loading...
    </div>;
  }

  const isOwnMap = firebaseContext.user && firebaseContext.user.uid === systemDocData.userId;

  if (systemDocData.isPrivate) {
    return (
      <div className="SystemLink SystemLink--private">
        [private map]
      </div>
    );
  }

  return (
    <Link className="SystemLink Link" href={`/${isOwnMap ? 'edit' : 'view'}/${systemDocData.systemId}`}>
      {systemDocData.title} by {ownerDocData.displayName ? ownerDocData.displayName : 'Anon'}
    </Link>
  );
}
