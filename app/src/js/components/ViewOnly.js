import React, { useContext } from 'react';
import ReactGA from 'react-ga';

import browserHistory from "../history.js";
import { FirebaseContext } from "../firebaseContext.js";
import { StarAndCount } from './StarAndCount.js';

export const ViewOnly = (props) => {
  const firebaseContext = useContext(FirebaseContext);

  const sysTitle = (
    <span className="ViewOnly-sysTitle">
      {props.system.title ? props.system.title : 'Metro Dreamin\''}
    </span>
  );

  const title = (
    <div className="ViewOnly-title">
      {sysTitle}{props.ownerName ? ' by ' + props.ownerName : ''}
    </div>
  );

  return (
    <div className="ViewOnly FadeAnim">
      <div className="ViewOnly-wrap">
        <div className="ViewOnly-top">
          {title}

          <StarAndCount {...props} modifier={'viewOnly'} />
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
