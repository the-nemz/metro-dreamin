import React, { useEffect, useState, useContext } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';

import { FirebaseContext, getUserDocData } from '/lib/firebase.js';

import { UserIcon } from '/components/UserIcon.js';

export function UserLink({ baseClass, userId, analyticsObject = { category: 'UserLink', action: 'Click' } }) {
  const [userDocData, setUserDocData] = useState();

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    getUserDocData(userId)
      .then(userDocData => setUserDocData(userDocData))
      .catch(e => console.log('userlink error:', e));
  }, [userId]);

  if (!userDocData || !userDocData.userId) return;
  if (firebaseContext.checkBidirectionalBlocks(userDocData.userId)) return;

  return (
    <Link className={`UserLink ${baseClass}-userLink`} href={`/user/${userDocData.userId}`}
          onClick={() => ReactGA.event(analyticsObject)}>
      <UserIcon className={`UserLink-icon ${baseClass}-userIcon`} userDocData={userDocData} />

      <div className={`UserLink-name ${baseClass}-userName`}>
        {userDocData.displayName ? userDocData.displayName : 'Anon'}
      </div>
    </Link>
  );
}
