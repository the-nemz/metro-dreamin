import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import classNames from 'classnames';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import { renderFadeWrap } from '/lib/util.js';
import { FirebaseContext } from '/lib/firebase.js';

export function Drawer({ onToggleShowAuth }) {
  const [ isMobile, setIsMobile ] = useState(false);
  const [ isOpen, setIsOpen ] = useState();

  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (!window) return;

    handleResize();

    let resizeTimeout;
    onresize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 50);
    };

    return () => {
      clearTimeout(resizeTimeout);
      onresize = () => {};
    };
  }, []);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, [firebaseContext.ownSystemDocs]);

  const handleResize = () => {
    const isMobileWidth = window.innerWidth <= 991;
    if (isMobileWidth && !isMobile) {
      setIsMobile(true);
      setIsOpen(false);
    } else if (!isMobileWidth) {
      setIsMobile(false);
      setIsOpen(true);
    }
  }

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
    if (firebaseContext.user && isOpen) {
      return (
        <div className="Drawer-section Drawer-section--ownSystems FadeAnim">
          <div className="Drawer-sectionHeading">
            Your maps
          </div>
  
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
              onClick={() => setIsOpen(open => !open)}>
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
              href={'/explore'}>
          <i className="fas fa-house"></i>
          <div className="Drawer-linkText">Home</div>
        </Link>

        {firebaseContext.user && firebaseContext.user.uid &&
          <Link className={classNames('Drawer-link', { 'Drawer-link--current': isCurrentUserProfile })}
                href={`/user/${firebaseContext.user.uid}`}>
            <i className="fas fa-user"></i>
            <div className="Drawer-linkText">Profile</div>
          </Link>
        }
        
        {!firebaseContext.authStateLoading && !firebaseContext.user &&
          <button className="Drawer-link" onClick={() => onToggleShowAuth(true)}>
            <i className="fas fa-user"></i>
            <div className="Drawer-linkText">Create an Account</div>
          </button>
        }

        <Link className={classNames('Drawer-link', { 'Drawer-link--current': router.pathname === '/edit/new'})}
              href={'/edit/new'}>
          <i className="fas fa-plus"></i>
          <div className="Drawer-linkText">New Map</div>
        </Link>
      </div>

      {renderFadeWrap(renderOwnSystems(), 'ownSystems')}
    </section>
  );
}
