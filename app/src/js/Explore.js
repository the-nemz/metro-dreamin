import React, { useState, useEffect } from 'react';

import mapboxgl from 'mapbox-gl';
import firebase from 'firebase';

import { Search } from './components/Search.js';

import 'mapbox-gl/dist/mapbox-gl.css';
import 'firebaseui/dist/firebaseui.css';
import 'focus-visible/dist/focus-visible.min.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export function Explore(props) {
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

  return (
    <div className="Explore DarkMode">
      <Search database={database} />
    </div>
  );
}
