import React, { useContext, useEffect } from 'react';
import ReactTooltip from 'react-tooltip';

import { FirebaseContext } from '/lib/firebase.js';

import { Notifications } from '/components/Notifications.js';

export function SystemHeader({ onHomeClick, onToggleShowSettings, onToggleShowAuth }) {
  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  const notifOrCreate = firebaseContext.user ?
    <Notifications page={'view'} /> :
    <button className="SystemHeader-signInButton Link" onClick={onToggleShowAuth}>
      Sign in
    </button>;

  return (
    <div className="SystemHeader">
      <div className="SystemHeader-headerLeft">
        <button className="SystemHeader-homeLink ViewHeaderButton" onClick={onHomeClick}>
          <i className="fas fa-home"></i>
        </button>
      </div>
      <div className="SystemHeader-headerRight">
        {!firebaseContext.authStateLoading && notifOrCreate}

        <button className="SystemHeader-settingsButton ViewHeaderButton"
                onClick={() => {
                                 onToggleShowSettings(isOpen => !isOpen);
                                //  ReactGA.event({
                                //    category: 'View',
                                //    action: 'Toggle Settings'
                                //  });
                                }}>
          <i className="fas fa-cog"></i>
        </button>
      </div>
    </div>
  );
}
