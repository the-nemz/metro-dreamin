import React from "react";
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Switch, useLocation, useParams } from "react-router-dom";

import './js/polyfill.js';
import browserHistory from "./js/history.js";

import { Main } from './js/Main.js';

export default function Index() {
  return (
    <Router>
      <Switch>
        <Route exact path="/" children={<Parameterizer />} />
        <Route path="/view/:viewIdEncoded?" children={<Parameterizer />} />
        <Route exact path="/explore">
          <h1>
            ~Explore~
          </h1>
        </Route>
      </Switch>
    </Router>
  );
}

function Parameterizer() {
  const queryParams = new URLSearchParams(useLocation().search);
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
    <Main viewId={viewId ? viewId : viewIdQP} writeDefault={writeDefault} />
  )
}


ReactDOM.render(
  <Index />,
  document.getElementById('root')
);
