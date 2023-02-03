import React, { useState, useContext, useEffect } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import ReactGA from 'react-ga';
import classNames from 'classnames';

import { FirebaseContext } from '/lib/firebase.js';

import { StarredBy } from '/components/StarredBy.js';

export const StarAndCount = (props) => {
  const [ isStarred, setIsStarred ] = useState(false);
  const [ starCount, setStarCount ] = useState(props.systemDocData.stars || 0);
  const [ justRequested, setJustRequested ] = useState(false); // used to debounce
  const [ showStarredByModal, setShowStarredByModal ] = useState(false);

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    setIsStarred((firebaseContext.starredSystemIds || []).includes(props.systemId));
  }, [firebaseContext.starredSystemIds]);

  const handleStarClick = () => {
    if (!firebaseContext.user || !firebaseContext.user.uid) {
      props.onToggleShowAuth(true);
    } else if (!justRequested) {
      try {
        starView();
      } catch (e) {
        console.log('Unexpected Error:', e);
      }
    }
  }

  const starView = async () => {
    setStarCount(currCount => Math.max((currCount || 0) + (isStarred ? -1 : 1), 0));
    setJustRequested(true);
    setTimeout(() => setJustRequested(false), 1000);

    const starDoc = doc(firebaseContext.database, `systems/${props.systemId}/stars/${firebaseContext.user.uid}`);
    if (!isStarred) {
      setDoc(starDoc, {
        systemId: props.systemId,
        userId: firebaseContext.user.uid,
        timestamp: Date.now()
      });

      ReactGA.event({
        category: 'Stars',
        action: 'Add',
        label: props.systemId
      });
    } else {
      deleteDoc(starDoc);

      ReactGA.event({
        category: 'Stars',
        action: 'Remove',
        label: props.systemId
      });
    }
  }

  return (
    <div className={classNames('StarAndCount', { 'StarAndCount--none': !starCount })}>
      <button className={'StarAndCount-icon StarAndCount-icon--' + (isStarred ? 'starred' : 'unstarred')}
              disabled={justRequested}
              onClick={handleStarClick}>
        <i className="fas fa-star"></i>
        <i className="far fa-star"></i>
      </button>

      <button className="StarAndCount-count Link"
              onClick={() => setShowStarredByModal(true)}>
        {starCount ? starCount : ''}
      </button>

      <StarredBy open={showStarredByModal} starData={props.starData}
                 onClose={() => setShowStarredByModal(false)} />
    </div>
  );
}
