import React from "react";

let useProd = true;
let apiBaseUrl = 'https://us-central1-metrodreamin.cloudfunctions.net/api/v1';
if (window.location.hostname === 'localhost') {
  if (process.env.REACT_APP_PROD !== 'true') {
    useProd = false;
    apiBaseUrl = 'https://us-central1-metrodreaminstaging.cloudfunctions.net/api/v1';
  }

  if (process.env.REACT_APP_LOCALFUNCTIONS === 'true') {
    useProd = false;
    apiBaseUrl = 'http://localhost:5000/metrodreaminstaging/us-central1/api/v1';
  }
} else if (window.location.hostname.indexOf('metrodreaminstaging') >= 0) {
  useProd = false;
  apiBaseUrl = 'https://us-central1-metrodreaminstaging.cloudfunctions.net/api/v1';
}

if (!useProd) {
  console.log('~~~~ Using staging account ~~~~')
  console.log(`~~~~ Using function url ${apiBaseUrl} ~~~~`)
}

export const FirebaseContext = React.createContext({
  useProd: useProd,
  apiBaseUrl: apiBaseUrl,
  user: null,
  database: null,
  settings: {}
});
