import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';

import mapboxgl from 'mapbox-gl';

import browserHistory from "./history.js";
import { FirebaseContext } from "./firebaseContext.js";
import { Discover } from './components/Discover.js';
import { Search } from './components/Search.js';
import { Notifications } from './components/Notifications.js';

import logo from '../assets/logo.svg';
import logo_bordered from '../assets/logo-bordered.svg';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export function Explore(props) {
  const [input, setInput] = useState(props.search || '');
  const [query, setQuery] = useState(props.search || '');
  const [ windowDims, setWindowDims ] = useState({
    width: window.innerWidth || 0,
    height: window.innerHeight || 0
  });

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    window.addEventListener('resize', () => setWindowDims({ height: window.innerHeight, width: window.innerWidth }));
  }, []);

  useEffect(() => {
    // Allows browser back button to change searches
    setQuery(props.search || '')
  }, [props.search]);

  const updateHistoryAndQuery = (q) => {
    if (q) {
      browserHistory.push(`/explore?search=${q}`);
    } else {
      browserHistory.push(`/explore`);
    }
    setQuery(q);
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    updateHistoryAndQuery(input);
  }

  const headerLeftLink = query ? (
    <button className="Explore-backButton DefaultHeaderButton"
            onClick={() => updateHistoryAndQuery('')}>
      <i className="fas fa-arrow-left fa-fw"></i>
    </button>
  ) : (
    <Link className="Explore-logoLink" to="/explore">
      <img className="Explore-logo" src={firebaseContext.settings.lightMode ? logo_bordered : logo} alt="Metro Dreamin' logo" />
    </Link>
  );

  const content = query ? <Search search={query} /> : <Discover />;

  const exploreClass = `Explore ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <div className={exploreClass}>
      <div className="Explore-container">
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
            <Notifications page={'default'} />

            <button className="Explore-settingsButton DefaultHeaderButton"
                    onClick={() => props.onToggleShowSettings(isOpen => !isOpen)}>
              <i className="fas fa-cog"></i>
            </button>
          </div>
        </div>

        {content}
      </div>
    </div>
  );
}
