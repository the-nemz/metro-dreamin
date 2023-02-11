import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';

import { FirebaseContext, getUserDocData } from '/lib/firebase.js';

import { UserIcon } from '/components/UserIcon.js';

export function UserLink({ baseClass, userId, analyticsObject = { category: 'UserLink', action: 'Click' } }) {
  const [userDocData, setUserDocData] = useState();

  useEffect(() => {
    getUserDocData(userId).then(userDocData => setUserDocData(userDocData));
  }, [userId]);

  if (!userDocData || !userDocData.userId) return;

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
