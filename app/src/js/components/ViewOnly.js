import React, { useState, useContext, useEffect } from 'react';
import ReactGA from 'react-ga';

import browserHistory from "../history.js";
import { addAuthHeader } from '../util.js';
import { FirebaseContext } from "../firebaseContext.js";

export const ViewOnly = (props) => {
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
        return;
      } else {
        const starredViews = isStarred ? firebaseContext.settings.starredViews.filter(vId => vId !== props.viewId) :
                                         firebaseContext.settings.starredViews.concat([props.viewId])
        props.onStarredViewsUpdated(starredViews);
        props.onSetAlert(isStarred ? 'Unstarred!' : 'Starred!');
        setStarRequested(false);
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

  const sysTitle = (
    <span className="ViewOnly-sysTitle">
      {props.system.title ? props.system.title : 'Metro Dreamin\''}
    </span>
  );

  const title = (
    <div className="ViewOnly-title">
      {'Viewing '}{sysTitle}{props.ownerName ? ' by ' + props.ownerName : ''}
    </div>
  );

  const visuallyStarred = (isStarred && !starRequested) || (!isStarred && starRequested);
  return (
    <div className="ViewOnly FadeAnim">
      <div className="ViewOnly-wrap">
        <div className="ViewOnly-top">
          {title}

          <div className="ViewOnly-starWrap">
            <button className={'ViewOnly-star ViewOnly-star--' + (visuallyStarred ? 'starred' : 'unstarred')} onClick={handleStarClick}>
              <i className="fas fa-star"></i>
              <i className="far fa-star"></i>
            </button>
            <div className="ViewOnly-starCount">
              {props.viewDocData ? starCount : ''}
            </div>
          </div>
        </div>

        <button className="ViewOnly-start Link"
                onClick={() => {
                  ReactGA.event({
                    category: 'ViewOnly',
                    action: 'Own Maps'
                  });
                  browserHistory.push('/view');
                  browserHistory.go(0);
                }}>
          {firebaseContext.user && firebaseContext.user.uid ? 'Work on your own maps' : 'Get started on your own map'}
        </button>
      </div>
    </div>
  );
}
