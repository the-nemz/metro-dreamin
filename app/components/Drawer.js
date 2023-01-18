import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import classNames from 'classNames';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

export function Drawer({ query = '', onToggleShowSettings, onToggleShowAuth }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

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

        {firebaseContext.user && firebaseContext.user.uid ?
          <Link className={classNames('Drawer-link', { 'Drawer-link--current': isCurrentUserProfile })}
                href={`/user/${firebaseContext.user.uid}`}>
            <i className="fas fa-user"></i>
            Profile
          </Link> :
          <button className="Drawer-link" onClick={() => onToggleShowAuth(true)}>
            <i className="fas fa-user"></i>
            Create an account
          </button>
        }
      </div>
    </section>
  );
}
