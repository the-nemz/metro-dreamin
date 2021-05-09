import React, { useState, useContext, useEffect } from 'react';
import ReactGA from 'react-ga';

import { addAuthHeader } from '../util.js';
import { FirebaseContext } from "../firebaseContext.js";

export const StarAndCount = (props) => {
  const [ isStarred, setIsStarred ] = useState(false);
  const [ starCount, setStarCount ] = useState(props.viewDocData.stars || 0);
  const [ starRequested, setStarRequested ] = useState(false);

  const firebaseContext = useContext(FirebaseContext);

  const handleStarClick = () => {
    if (!firebaseContext.user || !firebaseContext.user.uid) {
      props.setupSignIn()
    } else if (firebaseContext.apiBaseUrl && !starRequested) {
      starView();
    }
  }

  const starView = async () => {
    const uri = `${firebaseContext.apiBaseUrl}/stars?viewId=${props.viewId}&action=${isStarred ? 'remove' : 'add'}`;
    let req = new XMLHttpRequest();
    req.onerror = () => console.error('Error starring view:', req.status, req.statusText);

    req.onload = () => {
      if (req.status !== 200) {
        console.error('Error starring view:', req.status, req.statusText);
        setStarRequested(false);
        setStarCount(props.viewDocData.stars || 0);
        return;
      } else {
        const starredViews = isStarred ? (firebaseContext.settings.starredViews || []).filter(vId => vId !== props.viewId) :
                                         (firebaseContext.settings.starredViews || []).concat([props.viewId])
        props.onStarredViewsUpdated(starredViews);
        props.onSetToast(isStarred ? 'Unstarred!' : 'Starred!');
        setStarRequested(false);

        ReactGA.event({
          category: 'Stars',
          action: isStarred ? 'Remove' : 'Add',
          label: props.viewId
        });
        return;
      }
    };

    req.open('PUT', encodeURI(uri));
    req = await addAuthHeader(firebaseContext.user, req);
    req.send();
    setStarRequested(true);
    setStarCount(currCount => Math.max((currCount || 0) + (isStarred ? -1 : 1), 0));
  }

  useEffect(() => {
    if (firebaseContext.user && firebaseContext.settings) {
      setIsStarred((firebaseContext.settings.starredViews || []).includes(props.viewId));
    } else {
      setIsStarred(false);
    }
  }, [firebaseContext.user, firebaseContext.settings]);

  const visuallyStarred = (isStarred && !starRequested) || (!isStarred && starRequested);
  return (
    <div className={`StarAndCount StarAndCount--${props.modifier}`}>
      <button className={'StarAndCount-star StarAndCount-star--' + (visuallyStarred ? 'starred' : 'unstarred')}
              onClick={handleStarClick}>
        <i className="fas fa-star"></i>
        <i className="far fa-star"></i>
      </button>
      <div className="StarAndCount-count">
        {props.viewDocData ? starCount : ''}
      </div>
    </div>
  );
}
