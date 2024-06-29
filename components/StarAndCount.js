import React, { useState, useContext, useEffect } from 'react';
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import ReactGA from 'react-ga4';
import classNames from 'classnames';

import { FirebaseContext } from '/util/firebase.js';
import { displayLargeNumber } from '/util/helpers.js';

import { StarredBy } from '/components/StarredBy.js';

export const StarAndCount = (props) => {
  const [ isStarred, setIsStarred ] = useState(false);
  const [ starCount, setStarCount ] = useState(props.systemDocData.stars || 0);
  const [ sendingStarRequest, setSendingStarRequest ] = useState(false);
  const [ showStarredByModal, setShowStarredByModal ] = useState(false);

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (!firebaseContext?.user?.uid) return;

    const starDoc = doc(firebaseContext.database, `systems/${props.systemId}/stars/${firebaseContext.user.uid}`);
    getDoc(starDoc).then((starDocSnap) => {
      if (starDocSnap.exists()) {
        setIsStarred(true);
      }
    });
  }, [firebaseContext?.user?.uid])

  const handleStarClick = () => {
    if (!firebaseContext.user || !firebaseContext.user.uid) {
      props.onToggleShowAuth(true);
      ReactGA.event({ category: 'System', action: 'Unauthenticated Star' });
    } else if (!sendingStarRequest) {
      try {
        starView();
      } catch (e) {
        console.log('Unexpected Error:', e);
      }
    }
  }

  const starView = async () => {
    setSendingStarRequest(true);
    setStarCount(currCount => Math.max((currCount || 0) + (isStarred ? -1 : 1), 0));

    try {
      const starDoc = doc(firebaseContext.database, `systems/${props.systemId}/stars/${firebaseContext.user.uid}`);
      if (!isStarred) {
        await setDoc(starDoc, {
          systemId: props.systemId,
          userId: firebaseContext.user.uid,
          timestamp: Date.now()
        });

        ReactGA.event({
          category: 'System',
          action: 'Add Star',
          label: props.systemId
        });
      } else {
        await deleteDoc(starDoc);

        ReactGA.event({
          category: 'System',
          action: 'Remove Star',
          label: props.systemId
        });
      }
    } catch (e) {
      console.warn('error starring', e);
    } finally {
      setSendingStarRequest(false);
    }
  }

  return (
    <div className={classNames('StarAndCount', { 'StarAndCount--none': !starCount })}>
      <button className={'StarAndCount-icon StarAndCount-icon--' + (isStarred ? 'starred' : 'unstarred')}
              disabled={sendingStarRequest}
              onClick={handleStarClick}>
        <i className="fas fa-star"></i>
        <i className="far fa-star"></i>
      </button>

      <button className="StarAndCount-count Link"
              onClick={() => {
                setShowStarredByModal(true);
                ReactGA.event({
                  category: 'System',
                  action: 'Show Starred By'
                });
              }}>
        {starCount ? displayLargeNumber(starCount, 3) : ''}
      </button>

      <StarredBy open={showStarredByModal} starData={props.starData}
                 onClose={() => setShowStarredByModal(false)} />
    </div>
  );
}
