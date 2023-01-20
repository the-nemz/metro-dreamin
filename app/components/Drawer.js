import React, { useContext, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import classNames from 'classnames';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

export function Drawer({ onToggleShowAuth }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, [firebaseContext.ownSystemDocs]);

  const renderOwnSystem = (systemDocData) => {
    return <Link className="Drawer-ownSystem" key={systemDocData.systemId}
                 href={`/edit/${systemDocData.systemId}`}>
      {systemDocData.title ? systemDocData.title : 'Map'}

      {systemDocData.isPrivate && <i className="fas fa-eye-slash"
                                     data-tip="This map will not appear in search or on your profile">
                                  </i>}
    </Link>
  }

  const renderOwnSystems = () => {
    return (
      <div className="Drawer-section Drawer-section--ownSystems">
        <div className="Drawer-sectionHeading">
          Your maps
        </div>

        <div className="Drawer-ownSystems">
          {firebaseContext.ownSystemDocs.length ?
            firebaseContext.ownSystemDocs.map(renderOwnSystem) :
            <div className="Drawer-noSystems">
              None yet!
            </div>
          }
        </div>
      </div>
    );
  }

  const isCurrentUserProfile = firebaseContext.user && firebaseContext.user.uid &&
                               router.pathname === '/user/[userId]' &&
                               router.query.userId === firebaseContext.user.uid;
  return (
    <section className="Drawer">
      <div className="Drawer-section Drawer-section--links">
        <Link className={classNames('Drawer-link', { 'Drawer-link--current': router.pathname === '/explore'})}
              href={'/explore'}>
          <i className="fas fa-house"></i>
          Home
        </Link>

        {firebaseContext.user && firebaseContext.user.uid &&
          <Link className={classNames('Drawer-link', { 'Drawer-link--current': isCurrentUserProfile })}
                href={`/user/${firebaseContext.user.uid}`}>
            <i className="fas fa-user"></i>
            Profile
          </Link>
        }
        
        {!firebaseContext.authStateLoading && !firebaseContext.user &&
          <button className="Drawer-link" onClick={() => onToggleShowAuth(true)}>
            <i className="fas fa-user"></i>
            Create an Account
          </button>
        }

        <Link className={classNames('Drawer-link', { 'Drawer-link--current': router.pathname === '/edit/new'})}
              href={'/edit/new'}>
          <i className="fas fa-plus"></i>
          New Map
        </Link>
      </div>

      {firebaseContext.user && renderOwnSystems()}
    </section>
  );
}
