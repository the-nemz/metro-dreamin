import React, { useState, useEffect } from 'react';

import mapboxgl from 'mapbox-gl';
import firebase from 'firebase';

import { Discover } from './components/Discover.js';
import { Search } from './components/Search.js';

import 'mapbox-gl/dist/mapbox-gl.css';
import 'firebaseui/dist/firebaseui.css';
import 'focus-visible/dist/focus-visible.min.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export function Explore(props) {
  const [input, setInput] = useState(props.search || '');
  const [query, setQuery] = useState(props.search || '');
  const [ database, setDatabase ] = useState();
  const [ windowDims, setWindowDims ] = useState({
    width: window.innerWidth || 0,
    height: window.innerHeight || 0
  });

  useEffect(() => {
    if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
      document.body.classList.add('isIOS');
    }

    firebase.initializeApp(props.firebaseConfig);
    setDatabase(firebase.firestore());

    window.addEventListener('resize', () => setWindowDims({ height: window.innerHeight, width: window.innerWidth }));
  }, []);

  if (!database) {
    return (
      <div className="Explore DarkMode">
      </div>
    );
  }

  const content = query ?
    <Search database={database} search={query} /> :
    <Discover database={database} />;

  return (
    <div className="Explore DarkMode">
      <input className="Explore-input" value={input} placeholder={"Search for a map"}
             onChange={(e) => setInput(e.target.value)}
             onBlur={(e) => setQuery(e.target.value)}
      />
      {content}
    </div>
  );
}
