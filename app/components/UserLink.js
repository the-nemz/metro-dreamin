import React, { useEffect, useState } from 'react';
import Link from 'next/link';

import { FirebaseContext, getUserDocData } from '/lib/firebase.js';

import { UserIcon } from '/components/UserIcon.js';

export function UserLink({ baseClass, userId }) {
  const [userDocData, setUserDocData] = useState();

  useEffect(() => {
    getUserDocData(userId).then(userDocData => setUserDocData(userDocData));
  }, [userId]);

  if (!userDocData || !userDocData.userId) return;

  return <Link className={`UserLink ${baseClass}-userLink`} href={`/user/${userDocData.userId}`}>
    <UserIcon className={`UserLink-icon ${baseClass}-userIcon`} userDocData={userDocData} />

    <div className={`UserLink-name ${baseClass}-userName`}>
      {userDocData.displayName ? userDocData.displayName : 'Anon'}
    </div>
  </Link>;
}
