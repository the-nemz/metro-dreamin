import React from "react";
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, useLocation } from "react-router-dom";

import { App } from './App.js';

export default function Index() {
  return (
    <Router>
      <Rout />
    </Router>
  );
}

function Rout() {
  const queryParams = new URLSearchParams(useLocation().search);
  const viewId = queryParams.get('view');
  console.log(viewId);

  return (
    <App viewId={viewId} />
  )
}

ReactDOM.render(
  <Index />,
  document.getElementById('root')
);
