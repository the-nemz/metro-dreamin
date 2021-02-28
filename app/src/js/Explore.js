import React, { useState, useEffect } from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import mapboxgl from 'mapbox-gl';
import firebase from 'firebase';
import firebaseui from 'firebaseui';

import browserHistory from "./history.js";
import { sortSystems, getViewPath, getViewURL, getDistance } from './util.js';

import { SearchPage } from './components/SearchPage.js';

import logo from '../assets/logo.svg';

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

    // window.ui = new firebaseui.auth.AuthUI(firebase.auth());

    setDatabase(firebase.firestore());

    // firebase.auth().onAuthStateChanged((user) => {
    //   const currentUser = firebase.auth().currentUser;
    //   if (currentUser && currentUser.uid) {
    //     this.signIn(user, currentUser.uid);
    //   } else {
    //     if (!this.state.viewOnly) {
    //       this.setupSignIn();
    //     }
    //   }
    // });

    // ReactGA.initialize('UA-143422261-1');
    // ReactGA.pageview('root');

    window.addEventListener('resize', () => setWindowDims({ height: window.innerHeight, width: window.innerWidth }));
  }, []);

  return (
    <div className="Explore">
      <h1 className="Explore-heading">
        ~ EXPLORE ~
      </h1>
      <SearchPage database={database} />
    </div>
  );
}
