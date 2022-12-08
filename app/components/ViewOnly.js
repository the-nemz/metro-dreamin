import React, { useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

import { StarAndCount } from '/components/StarAndCount.js';

export const ViewOnly = (props) => {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const sysTitle = (
    <span className="ViewOnly-sysTitle">
      {props.system.title ? props.system.title : 'MetroDreamin\''}
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
                  router.push({
                    pathname: '/view'
                  });
                }}>
          {firebaseContext.user && firebaseContext.user.uid ? 'Work on your own maps' : 'Get started on your own map'}
        </button>
      </div>
    </div>
  );
}
