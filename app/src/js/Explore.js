import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactGA from 'react-ga';

import mapboxgl from 'mapbox-gl';

import browserHistory from "./history.js";
import { FirebaseContext } from "./firebaseContext.js";
import { Discover } from './components/Discover.js';
import { Mission } from './components/Mission.js';
import { Notifications } from './components/Notifications.js';
import { Search } from './components/Search.js';

import logo from '../assets/logo.svg';
import logo_inverted from '../assets/logo-inverted.svg';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export function Explore(props) {
  const [showMission, setShowMission] = useState(false);
  const [input, setInput] = useState(props.search || '');
  const [query, setQuery] = useState(props.search || '');
  const [ windowDims, setWindowDims ] = useState({
    width: window.innerWidth || 0,
    height: window.innerHeight || 0
  });

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    window.addEventListener('resize', () => setWindowDims({ height: window.innerHeight, width: window.innerWidth }));
    ReactGA.pageview('explore');
  }, []);

  useEffect(() => {
    // Allows browser back button to change searches
    setQuery(props.search || '')
    setInput(props.search || '')
  }, [props.search]);

  const updateHistoryAndQuery = (q) => {
    if (q !== query) {
      if (q) {
        browserHistory.push(`/explore?search=${q}`);
        ReactGA.event({
          category: 'Search',
          action: 'Query',
          label: q
        });
      } else {
        browserHistory.push(`/explore`);
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
      <Link className="Explore-logoLink" to="/explore" onClick={() => ReactGA.event({ category: 'Explore', action: 'Logo' })}>
        <img className="Explore-logo" src={firebaseContext.settings.lightMode ? logo_inverted : logo} alt="Metro Dreamin' logo" />
      </Link>
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
            <Link className="Explore-signUp Button--inverse" to={'/view'} onClick={() => ReactGA.event({ category: 'Explore', action: 'Sign Up' })}>
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
              <img className="Explore-desigLogo" src={firebaseContext.settings.lightMode ? logo_inverted : logo} alt="Metro Dreamin' logo" />
              <div className="Explore-copyright Explore-copyright--desktop">
                © 2021 Metro Dreamin'
              </div>
              <div className="Explore-copyright Explore-copyright--mobile">
                © 2021<br />Metro Dreamin'
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
  const exploreClass = `Explore ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <div className={exploreClass}>
      <div className="Explore-container">
        {renderHeader()}
        {content}
        {renderFooter()}
      </div>

      <ReactCSSTransitionGroup
            transitionName="FadeAnim"
            transitionAppear={true}
            transitionAppearTimeout={400}
            transitionEnter={true}
            transitionEnterTimeout={400}
            transitionLeave={true}
            transitionLeaveTimeout={400}>
          {showMission ?
            <Mission onToggleShowMission={setShowMission} />
          : ''}
        </ReactCSSTransitionGroup>
    </div>
  );
}
