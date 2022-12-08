import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import ReactGA from 'react-ga';

import { getPartsFromViewId, getViewPath, getEditPath } from '/lib/util.js';
import { FirebaseContext } from '/lib/firebase.js';

export const StarLink = ({ viewId }) => {
  const [userDocData, setUserDocData] = useState();
  const [viewDocData, setViewDocData] = useState();
  const [uidForView, setUidForView] = useState();
  const [sysIdForView, setSysIdForView] = useState();

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (viewId) {
      const { userId, systemId } = getPartsFromViewId(viewId);

      const userDocString = `users/${userId}`;
      let userDoc = doc(firebaseContext.database, userDocString);
      getDoc(userDoc).then((uDoc) => {
        if (uDoc) {
          setUserDocData(uDoc.data());
        }
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });

      const viewDocString = `views/${viewId}`;
      let viewDoc = doc(firebaseContext.database, viewDocString);
      getDoc(viewDoc).then((vDoc) => {
        if (vDoc) {
          setViewDocData(vDoc.data());
        }
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });

      setUidForView(userId)
      setSysIdForView(systemId)
    }
  }, [viewId]);

  if (viewDocData) {
    let starLinksContent;
    if (viewDocData.stars) {
      starLinksContent = (
        <span className="StarLink-starText">
          {viewDocData.stars} {viewDocData.stars === 1 ? 'star' : 'stars'}
        </span>
      );
    }

    let ownerElem = userDocData ? (
      <div className="StarLink-ownerStars">
        by {userDocData.displayName ? userDocData.displayName : 'Anonymous'}
        {starLinksContent ? ', ' : ''}
        {starLinksContent}
      </div>
    ) : null;

    if (firebaseContext.user && firebaseContext.user.uid === userDocData.userId) {
      ownerElem = (
        <span className="StarLink-ownerStars">
          by <span className="StarLink-youText">you!</span>
          {starLinksContent ? ', ' : ''}
          {starLinksContent}
        </span>
      );
    }

    const path = firebaseContext.user && firebaseContext.user.uid === uidForView
      ? getEditPath(uidForView, sysIdForView)
      : getViewPath(uidForView, sysIdForView);
    return (
      <Link className="StarLink StarLink--ready ViewLink" key={viewId} href={path}
            onClick={() => ReactGA.event({ category: 'Discover', action: 'Star Link' })}>
        <div className="StarLink-title">
          {viewDocData.title ? viewDocData.title : 'Untitled'}
        </div>
        {ownerElem}
      </Link>
    );
  }

  return (
    <div className="StarLink StarLink--loading">
    </div>
  );
}
