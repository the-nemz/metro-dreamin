import React, { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

import { Notifications } from '/components/Notifications.js';

export function Header({ onHomeClick, onToggleShowSettings, onToggleShowAuth }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [input, setInput] = useState('');

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    updateHistoryAndQuery(input);
  }

  const updateHistoryAndQuery = (q) => {
    router.push({
      pathname: '/explore',
      query: { search: `${q}` }
    })
    ReactGA.event({
      category: 'Search',
      action: 'Query',
      label: q
    });
  }

  const renderRightContent = () => {
    if (!firebaseContext.authStateLoading) {
      if (firebaseContext.user) {
        return <>
          <Notifications page={'view'} />

          <button className="Header-settingsButton ViewHeaderButton"
                  onClick={() => {
                                  onToggleShowSettings(isOpen => !isOpen);
                                  ReactGA.event({
                                    category: 'Header',
                                    action: 'Toggle Settings'
                                  });
                                 }}>
            <i className="fas fa-cog"></i>
          </button>
        </>
      } else {
        return (
          <button className="Header-signInButton Link" onClick={onToggleShowAuth}>
            <i className="fa-solid fa-user"></i>
            Log in
          </button>
        );
      }
    }
  }

  return (
    <header className="Header">
      <div className="Header-left">
        <button className="Header-homeLink ViewHeaderButton" onClick={onHomeClick}>
          <i className="fas fa-home"></i>
        </button>
      </div>

      <div className="Header-center">
        <form className="Header-inputWrap" onSubmit={handleSubmit}>
          <input className="Header-input" value={input} placeholder={"Search for a map"}
                onChange={(e) => setInput(e.target.value)}
                onSubmit={(e) => updateHistoryAndQuery(e.target.value)}
          />
          <button className="Header-searchButton" type="submit" disabled={input ? false : true}>
            <i className="fas fa-search"></i>
          </button>
        </form>
      </div>

      <div className="Header-right">
        {renderRightContent()}
      </div>
    </header>
  );
}
