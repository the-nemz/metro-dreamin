import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import classNames from 'classnames';
import ReactGA from 'react-ga4';

import { DeviceContext } from '/util/deviceContext.js';
import { FirebaseContext } from '/util/firebase.js';
import { renderFadeWrap } from '/util/helpers.js';

export function Drawer({ onToggleShowAuth }) {
  const [ isOpen, setIsOpen ] = useState();

  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);
  const { isMobile } = useContext(DeviceContext);

  useEffect(() => handleResize(), [isMobile])

  const handleResize = () => {
    if (isMobile && isOpen) {
      setIsOpen(false);
    } else if (!isMobile) {
      setIsOpen(true);
    }
  }

  const renderOwnSystem = (systemDocData) => {
    return <Link className="Drawer-ownSystem" key={systemDocData.systemId}
                 href={`/edit/${encodeURIComponent(systemDocData.systemId)}`}
                 onClick={() => ReactGA.event({ category: 'Drawer', action: 'System Click' })}>
      {systemDocData.title ? systemDocData.title : 'Map'}

      {systemDocData.isPrivate && <i className="fas fa-eye-slash"
                                     data-tooltip-content="This map will not appear in search or on your profile">
                                  </i>}
    </Link>
  }

  const renderOwnSystems = () => {
    if (firebaseContext.user && isOpen) {
      return (
        <div className="Drawer-section Drawer-section--ownSystems FadeAnim">
          <Link className="Drawer-sectionHeading Link" href={'/view/own'}
                onClick={() => ReactGA.event({ category: 'Drawer', action: 'Own Maps' })}>
            Your maps
          </Link>

          <div className="Drawer-ownSystems">
            {
              firebaseContext.ownSystemDocs.length ?
              firebaseContext.ownSystemDocs.map(renderOwnSystem) :
              <div className="Drawer-noSystems">
                None yet!
              </div>
            }
          </div>
        </div>
      );
    }
  }

  const renderMenuButton = () => {
    return (
      <button className="Drawer-menuButton Hamburger"
              onClick={() => {
                setIsOpen(open => !open);
                ReactGA.event({ category: 'Drawer', action: 'Expand/Collapse' });
              }}>
        <div className="Hamburger-top"></div>
        <div className="Hamburger-middle"></div>
        <div className="Hamburger-bottom"></div>
        <span className="sr-only">Menu open/close</span>
      </button>
    );
  }

  const isCurrentUserProfile = firebaseContext.user && firebaseContext.user.uid &&
                               router.pathname === '/user/[userId]' &&
                               router.query.userId === firebaseContext.user.uid;
  return (
    <section className={classNames('Drawer', { 'Drawer--closed': !isOpen, 'Drawer--open': isOpen, 'Hamburger--open': isOpen })}>
      <div className="Drawer-section Drawer-section--links">
        {isMobile && renderMenuButton()}

        <Link className={classNames('Drawer-link', { 'Drawer-link--current': router.pathname === '/explore'})}
              href={'/explore'}
              onClick={() => ReactGA.event({ category: 'Drawer', action: 'Home Click' })}>
          <i className="fas fa-house"></i>
          <div className="Drawer-linkText">Home</div>
        </Link>

        {!firebaseContext.authStateLoading && firebaseContext.user && firebaseContext.user.uid &&
          <Link className={classNames('Drawer-link', { 'Drawer-link--current': isCurrentUserProfile })}
                href={`/user/${firebaseContext.user.uid}`}
                onClick={() => ReactGA.event({ category: 'Drawer', action: 'Profile Click' })}>
            <i className="fas fa-user"></i>
            <div className="Drawer-linkText">Profile</div>
          </Link>
        }

        {!firebaseContext.authStateLoading && !firebaseContext.user &&
          <button className="Drawer-link" onClick={() => {
              onToggleShowAuth(true);
              ReactGA.event({ category: 'Drawer', action: 'Show Auth' });
            }}>
            <i className="fas fa-user"></i>
            <div className="Drawer-linkText">Create an Account</div>
          </button>
        }

        <Link className={classNames('Drawer-link', { 'Drawer-link--current': router.pathname === '/edit/new'})}
              href={'/edit/new'}
              onClick={() => ReactGA.event({ category: 'Drawer', action: 'New Map' })}>
          <i className="fas fa-plus"></i>
          <div className="Drawer-linkText">New Map</div>
        </Link>
      </div>

      {renderFadeWrap(renderOwnSystems(), 'ownSystems')}
    </section>
  );
}
