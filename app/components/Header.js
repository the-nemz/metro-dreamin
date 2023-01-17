import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';
import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

import { Notifications } from '/components/Notifications.js';

export function Header({ query = '', onHomeClickOverride, onToggleShowSettings, onToggleShowAuth }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [input, setInput] = useState(query);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    updateHistoryAndQuery(input);
  }

  const updateHistoryAndQuery = (q) => {
    if (q) {
      router.push({
        pathname: '/explore',
        query: { search: `${q}` }
      });

      ReactGA.event({
        category: 'Search',
        action: 'Query',
        label: q
      });
    } else {
      router.push({
        pathname: '/explore'
      });

      ReactGA.event({
        category: 'Search',
        action: 'Clear'
      });
    }
  }

  const renderLeftContent = () => {
    const headerLeftLink = query ? (
      <div className="Header-backWrap">
        <button className="Header-backButton ViewHeaderButton"
                onClick={() => updateHistoryAndQuery('')}>
          <i className="fas fa-arrow-left fa-fw"></i>
        </button>
      </div>
    ) : (
      <div className="Header-logoWrap">
        <button className="Header-logoLink" href="/explore"
                onClick={() => {
                  ReactGA.event({ category: 'Explore', action: 'Logo' });
                  if (typeof onHomeClickOverride === 'function') {
                    onHomeClickOverride();
                  } else {
                    router.push({
                      pathname: '/explore'
                    });
                  }
                }}>
          <img className="Header-logo" src={firebaseContext.settings.lightMode ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
        </button>
      </div>
    );

    return headerLeftLink;
  }

  const renderInput = () => {
    return (
      <form className="Header-inputWrap" onSubmit={handleSubmit}>
        <input className="Header-input" value={input} placeholder={"Search for a map"}
              onChange={(e) => setInput(e.target.value)}
              onSubmit={(e) => updateHistoryAndQuery(e.target.value)}
        />
        <button className="Header-searchButton" type="submit" disabled={input ? false : true}>
          <i className="fas fa-search"></i>
        </button>
      </form>
    );
  }

  const renderRightContent = () => {
    if (!firebaseContext.authStateLoading) {
      if (firebaseContext.user) {
        return <>
          <Notifications />

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
          <button className="Header-signInButton ViewHeaderButton" onClick={() => onToggleShowAuth(true)}>
            <i className="fa-solid fa-user"></i>
            <div className="Header-signInButtonText">
              Log in
            </div>
          </button>
        );
      }
    }
  }

  return (
    <header className="Header">
      <div className="Header-left">
        {renderLeftContent()}
      </div>

      <div className="Header-center">
        {renderInput()}
      </div>

      <div className={`Header-right Header-right--${firebaseContext.user ? 'loggedIn' : 'notLoggedIn'}`}>
        {renderRightContent()}
      </div>
    </header>
  );
}
