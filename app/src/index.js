import React from "react";
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Switch, useLocation, useParams } from "react-router-dom";

import { App } from './App.js';

export default function Index() {
  return (
    <Router>
      <Switch>
        <Route exact path="/">
          <h1>
            ROOOOOOOT
          </h1>
        </Route>
        <Route path="/view/:viewId" children={<Parameterizer />} />
      </Switch>
    </Router>
  );
}

function Parameterizer() {
  const queryParams = new URLSearchParams(useLocation().search);
  const viewIdQP = queryParams.get('view');
  const writeDefault = queryParams.get('writeDefault');
  const { viewId } = useParams();

  console.log(viewId, viewIdQP, viewId == viewIdQP);
  return (
    <App viewId={viewId ? decodeURIComponent(viewId) : viewIdQP} writeDefault={writeDefault} />
  )
}


ReactDOM.render(
  <Index />,
  document.getElementById('root')
);
