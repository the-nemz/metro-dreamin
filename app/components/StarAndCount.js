import React, { useState, useContext, useEffect } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

export const StarAndCount = (props) => {
  const [ isStarred, setIsStarred ] = useState(false);
  const [ starCount, setStarCount ] = useState(props.systemDocData.stars || 0);
  const [ justRequested, setJustRequested ] = useState(false); // used to debounce

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    setIsStarred((firebaseContext.starredViewIds || []).includes(props.viewId));
  }, [firebaseContext.starredViewIds]);

  const handleStarClick = () => {
    if (!firebaseContext.user || !firebaseContext.user.uid) {
      props.onToggleShowAuth(curr => !curr);
    } else if (!justRequested) {
      starView();
    }
  }

  const starView = async () => {
    setStarCount(currCount => Math.max((currCount || 0) + (isStarred ? -1 : 1), 0));
    setJustRequested(true);
    setTimeout(() => setJustRequested(false), 1000);

    const starDoc = doc(firebaseContext.database, `systems/${props.viewId}/stars/${firebaseContext.user.uid}`);
    if (!isStarred) {
      setDoc(starDoc, {
        viewId: props.viewId,
        userId: firebaseContext.user.uid,
        timestamp: Date.now()
      });

      ReactGA.event({
        category: 'Stars',
        action: 'Add',
        label: props.viewId
      });
    } else {
      deleteDoc(starDoc);

      ReactGA.event({
        category: 'Stars',
        action: 'Remove',
        label: props.viewId
      });
    }
  }

  return (
    <div className={`StarAndCount StarAndCount--${props.modifier}`}>
      <button className={'StarAndCount-star StarAndCount-star--' + (isStarred ? 'starred' : 'unstarred')}
              disabled={justRequested}
              onClick={handleStarClick}>
        <i className="fas fa-star"></i>
        <i className="far fa-star"></i>
      </button>
      <div className="StarAndCount-count">
        {starCount ? starCount : ''}
      </div>
    </div>
  );
}
