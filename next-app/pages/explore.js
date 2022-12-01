import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
// import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactGA from 'react-ga';

import mapboxgl from 'mapbox-gl';

import { FirebaseContext } from "/lib/firebaseContext.js";
import { Discover } from '/components/Discover.js';
import { Mission } from '/components/Mission.js';
import { Notifications } from '/components/Notifications.js';
import { Search } from '/components/Search.js';

import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

function Explore(props) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [showMission, setShowMission] = useState(false);
  const [input, setInput] = useState(router.query.search ? `${router.query.search}` : '');
  const [query, setQuery] = useState(router.query.search ? `${router.query.search}` : '');

  useEffect(() => {
    ReactGA.pageview('/explore');
  }, []);

  useEffect(() => {
    // Allows browser back button to change searches
    setQuery(router.query.search ? `${router.query.search}` : '')
    setInput(router.query.search ? `${router.query.search}` : '')
  }, [router.query.search]);

  const updateHistoryAndQuery = (q) => {
    if (q !== query) {
      if (q) {
        router.push({
          pathname: '/explore',
          query: { search: `${q}` }
        })
        ReactGA.event({
          category: 'Search',
          action: 'Query',
          label: q
        });
      } else {
        router.push({
          pathname: '/explore',
          query: {}
        })
        ReactGA.event({
          category: 'Search',
          action: 'Clear'
        });
      }
      setQuery(q);
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    updateHistoryAndQuery(input);
  }

  const renderHeader = () => {
    const headerLeftLink = query ? (
      <div className="Explore-backWrap">
        <button className="Explore-backButton DefaultHeaderButton"
                onClick={() => updateHistoryAndQuery('')}>
          <i className="fas fa-arrow-left fa-fw"></i>
        </button>
      </div>
    ) : (
      <div className="Explore-logoWrap">
        <Link className="Explore-logoLink" href="/explore"
              onClick={() => ReactGA.event({ category: 'Explore', action: 'Logo' })}>
          <img className="Explore-logo" src={firebaseContext.settings.lightMode ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
        </Link>
      </div>
    );

    return (
      <div className="Explore-header">
        {headerLeftLink}

        <form className="Explore-inputWrap" onSubmit={handleSubmit}>
          <input className="Explore-input" value={input} placeholder={"Search for a map"}
                onChange={(e) => setInput(e.target.value)}
                onBlur={(e) => {
                  if (query) {
                    updateHistoryAndQuery(e.target.value);
                  }
                }}
          />
          <button className="Explore-searchButton" type="submit" disabled={input ? false : true}>
            <i className="fas fa-search"></i>
          </button>
        </form>

        <div className="Explore-headerRight">
          {firebaseContext.user ?
            <Notifications page={'default'} /> :
            <Link className="Explore-signUp Button--inverse" href="/view"
                  onClick={() => ReactGA.event({ category: 'Explore', action: 'Sign Up' })}>
              Create an account
            </Link>
          }

          <button className="Explore-settingsButton DefaultHeaderButton"
                  onClick={() => {
                                   props.onToggleShowSettings(isOpen => !isOpen);
                                   ReactGA.event({
                                     category: 'Explore',
                                     action: 'Toggle Settings'
                                   });
                                 }}>
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </div>
    );
  };

  const renderFooter = () => {
    return (
      <div className="Explore-footer">
        <div className="Explore-footerContainer">
          <div className="Explore-footerLeft">
            <a className="Explore-designation Link" href="https://metrodreamin.com">
              <img className="Explore-desigLogo" src={firebaseContext.settings.lightMode ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
              <div className="Explore-copyright Explore-copyright--desktop">
                © {(new Date()).getFullYear()} MetroDreamin'
              </div>
              <div className="Explore-copyright Explore-copyright--mobile">
                © {(new Date()).getFullYear()}<br />MetroDreamin'
              </div>
            </a>

            <button className="Explore-footerMission Button--inverse"
                    onClick={() => {
                      setShowMission(currShown => !currShown);
                      ReactGA.event({
                        category: 'Explore',
                        action: 'Toggle Mission'
                      });
                    }}>
              Mission
            </button>
          </div>

          <div className="Explore-footerLinks">
            <a className="Explore-footerLink Link" href="https://twitter.com/MetroDreamin?s=20"
              target="_blank" rel="nofollow noopener noreferrer"
              onClick={() => ReactGA.event({ category: 'Explore', action: 'Twitter' })}>
              Twitter
            </a>
            <a className="Explore-footerLink Link" href="https://github.com/the-nemz/metro-dreamin"
              target="_blank" rel="nofollow noopener noreferrer"
              onClick={() => ReactGA.event({ category: 'Explore', action: 'GitHub' })}>
              Source Code
            </a>
            <a className="Explore-footerLink Link" href="privacypolicy.html"
              target="_blank" rel="nofollow noopener noreferrer"
              onClick={() => ReactGA.event({ category: 'Explore', action: 'Privacy' })}>
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    );
  };

  const content = query ? <Search search={query} /> : <Discover onToggleShowMission={setShowMission} />;
  const exploreClass =  `Explore ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <div className={exploreClass}>
      <div className="Explore-container">
        {renderHeader()}
        {content}
        {renderFooter()}
      </div>

      {showMission ? <Mission onToggleShowMission={setShowMission} /> : ''}
    </div>
  );
}

export default Explore;
