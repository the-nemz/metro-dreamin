import React, { useState, useEffect, useContext } from 'react';

import mapboxgl from 'mapbox-gl';

import { FirebaseContext } from "./firebaseContext.js";
import { Discover } from './components/Discover.js';
import { Search } from './components/Search.js';

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

  const handleSubmit = (e) => {
    e.preventDefault();
    setQuery(input);
  }

  const content = query ? <Search search={query} /> : <Discover />;

  const exploreClass = `Explore ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <div className={exploreClass}>
      <div className="Explore-container">
        <div className="Explore-header">
          <a className="Explore-logoLink" href="https://metrodreamin.com">
            <img className="Explore-logo" src={firebaseContext.settings.lightMode ? logo_bordered : logo} alt="Metro Dreamin' logo" />
          </a>

          <form className="Explore-inputWrap" onSubmit={handleSubmit}>
            <input className="Explore-input" value={input} placeholder={"Search for a map"}
                  onChange={(e) => setInput(e.target.value)}
                  onBlur={(e) => query ? setQuery(e.target.value) : null}
            />
            <button className="Explore-searchButton" type="submit">
              <i className="fas fa-search"></i>
            </button>
          </form>

          <button className="Explore-settingsButton"
                  onClick={() => props.onToggleShowSettings(isOpen => !isOpen)}>
            <i className="fas fa-cog"></i>
          </button>
        </div>

        {content}
      </div>
    </div>
  );
}
