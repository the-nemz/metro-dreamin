import React, { useContext } from 'react';
import ReactGA from 'react-ga';

import browserHistory from "../history.js";
import { FirebaseContext } from "../firebaseContext.js";

export const ViewOnly = ({ system, ownerName }) => {
  const firebaseContext = useContext(FirebaseContext);
  console.log(firebaseContext);

  const sysTitle = (
    <span className="ViewOnly-sysTitle">
      {system.title ? system.title : 'Metro Dreamin\''}
    </span>
  );

  const title = (
    <div className="ViewOnly-title">
      {'Viewing '}{sysTitle}{ownerName ? ' by ' + ownerName : ''}
    </div>
  );
  return (
    <div className="ViewOnly FadeAnim">
      <div className="ViewOnly-wrap">
        {title}
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
