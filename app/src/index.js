import React from "react";
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Switch, useLocation, useParams } from "react-router-dom";

import './js/polyfill.js';
import browserHistory from "./js/history.js";

import { Main } from './js/Main.js';
import { Explore } from './js/Explore.js';

import './default.scss';

const prodConfig = {
  apiKey: "AIzaSyBIMlulR8OTOoF-57DHty1NuXM0kqVoL5c",
  authDomain: "metrodreamin.firebaseapp.com",
  databaseURL: "https://metrodreamin.firebaseio.com",
  projectId: "metrodreamin",
  storageBucket: "metrodreamin.appspot.com",
  messagingSenderId: "86165148906"
};

const stagingConfig = {
  apiKey: "AIzaSyDYU-8dYy0OWGJ1RJ46V_S7fWJHlAA2DWg",
  authDomain: "metrodreaminstaging.firebaseapp.com",
  databaseURL: "https://metrodreaminstaging.firebaseio.com",
  projectId: "metrodreaminstaging",
  storageBucket: "metrodreaminstaging.appspot.com",
  messagingSenderId: "572980459956"
};

export default function Index() {
  return (
    <Router>
      <Switch>
        <Route exact path="/" children={<MainParameterizer />} />
        <Route path="/view/:viewIdEncoded?" children={<MainParameterizer />} />
        <Route exact path="/explore" children={<ExploreParameterizer />} />
      </Switch>
    </Router>
  );
}

function MainParameterizer() {
  const queryParams = new URLSearchParams(useLocation().search);
  const useProd = determineIfProd(queryParams);
  const viewIdQP = queryParams.get('view');
  const writeDefault = queryParams.get('writeDefault');
  const { viewIdEncoded } = useParams();

  let viewId;
  try {
    viewId = decodeURIComponent(viewIdEncoded || '')
  } catch (e) {
    console.log('Error:', e);
  }

  if (viewIdQP || viewIdQP === '') { // If it exists or is empty string
    const param = viewIdEncoded ? viewIdEncoded : encodeURIComponent(viewIdQP);
    browserHistory.push(param ? `/view/${param}` : `/view`);
  }

  return (
    <Main viewId={viewId ? viewId : viewIdQP} firebaseConfig={useProd ? prodConfig : stagingConfig} writeDefault={writeDefault} />
  )
}

function ExploreParameterizer() {
  const queryParams = new URLSearchParams(useLocation().search);
  const searchQP = queryParams.get('search');
  const useProd = determineIfProd(queryParams);

  return (
    <Explore firebaseConfig={useProd ? prodConfig : stagingConfig} search={searchQP} />
  )
}

function determineIfProd(queryParams) {
  const prodQP = queryParams.get('prod');

  let useProd = true;
  if (window.location.hostname === 'localhost') {
    useProd = prodQP === 'true'
  } else {
    useProd = window.location.hostname.indexOf('metrodreaminstaging') === -1;
  }
  if (!useProd) {
    console.log('~~~~ Using staging account ~~~~')
  }

  return useProd;
}


ReactDOM.render(
  <Index />,
  document.getElementById('root')
);
