import React, { useContext } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ReactGA from 'react-ga4';

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

        <Link className="ViewOnly-start Link"
              href={firebaseContext.user && firebaseContext.user.uid ? '/view/own' : '/edit/new'}
              onClick={() => ReactGA.event({
                category: 'ViewOnly',
                action: 'Own Maps'
              })}>
          {firebaseContext.user && firebaseContext.user.uid ? 'Work on your own maps' : 'Get started on your own map'}
        </Link>

        {!props.systemDocData.isPrivate &&
          <Link className="ViewOnly-start Link"
                href={{
                  pathname: '/edit/new',
                  query: { fromSystem: props.systemId },
                }}
                onClick={() => ReactGA.event({
                  category: 'ViewOnly',
                  action: 'Branch',
                  value: props.systemId
                })}>
            {'Branch from this map'}
          </Link>
        }
      </div>
    </div>
  );
}
