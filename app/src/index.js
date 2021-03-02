import React, { useState, useEffect } from "react";
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Switch, useLocation, useParams } from "react-router-dom";

import firebase from 'firebase';
import firebaseui from 'firebaseui';

import './js/polyfill.js';
import browserHistory from "./js/history.js";

import { Main } from './js/Main.js';
import { Explore } from './js/Explore.js';

import './default.scss';

import 'mapbox-gl/dist/mapbox-gl.css';
import 'firebaseui/dist/firebaseui.css';
import 'focus-visible/dist/focus-visible.min.js';

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
  const [user, setUser] = useState();
  const [ database, setDatabase ] = useState();
  const [ settings, setSettings ] = useState({ noSave: true });
  const [ authListened, setAuthListened ] = useState(false);

  useEffect(() => {
    const useProd = determineIfProd();

    firebase.initializeApp(useProd? prodConfig : stagingConfig);
    setDatabase(firebase.firestore());

    window.ui = new firebaseui.auth.AuthUI(firebase.auth());
  }, []);

  const signIn = (currentUser) => {
    if (!currentUser || !currentUser.uid) return;

    setSettings({
      email: currentUser.email,
      displayName: currentUser.displayName,
      userId: currentUser.uid,
      noSave: false
    });

    setUser(currentUser);

    let userDoc = database.doc('users/' + currentUser.uid);
    userDoc.get().then((doc) => {
      if (doc) {
        const data = doc.data();
        if (data) {
          let tempSettings = JSON.parse(JSON.stringify(settings));
          for (const key in data) {
            tempSettings[key] = data[key];
          }
          setSettings(prevSettings => {
            return {...prevSettings, ...data};
          });
        }
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });

    userDoc.update({
      lastLogin: Date.now()
    }).then(() => {
      // ReactGA.event({
      //   category: 'User',
      //   action: 'Signed In'
      // });
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });
  }

  const handleNoSave = () => {
    setSettings(prevSettings => {
      return {...prevSettings, ...{ noSave: true }};
    });
  }

  const handleToggleTheme = (useLight) => {
    setSettings(prevSettings => {
      return {...prevSettings, ...{ lightMode: useLight }};
    });
  }

  if (!authListened && database) {
    firebase.auth().onAuthStateChanged((u) => {
      if (u && u.uid) {
        signIn(u);
      }
    });
    setAuthListened(true);
  }

  return (
    <Router>
      <Switch>
        <Route exact path="/" children={<MainParameterizer
                                          user={user}
                                          database={database}
                                          settings={settings}
                                          signIn={signIn}
                                          onToggleTheme={handleToggleTheme}
                                        />}
        />
        <Route path="/view/:viewIdEncoded?" children={<MainParameterizer
                                              user={user}
                                              database={database}
                                              settings={settings}
                                              signIn={signIn}
                                              onNoSave={handleNoSave}
                                              onToggleTheme={handleToggleTheme}
                                            />}
        />
        <Route exact path="/explore" children={<ExploreParameterizer
                                                user={user}
                                                database={database}
                                                settings={settings}
                                                signIn={signIn}
                                                onNoSave={handleNoSave}
                                              />}
        />
      </Switch>
    </Router>
  );
}

function MainParameterizer(props) {
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

  if (!props.database) {
    return <></>;
  }

  return (
    <Main
      viewId={viewId ? viewId : viewIdQP}
      user={props.user}
      settings={props.settings}
      database={props.database}
      signIn={props.signIn}
      onNoSave={props.onNoSave}
      onToggleTheme={props.onToggleTheme}
      writeDefault={writeDefault}
    />
  )
}

function ExploreParameterizer(props) {
  const queryParams = new URLSearchParams(useLocation().search);
  const searchQP = queryParams.get('search');

  if (!props.database) {
    return <></>;
  }

  return (
    <Explore
      user={props.user}
      settings={props.settings}
      database={props.database}
      search={searchQP}
    />
  )
}

function determineIfProd() {
  let useProd = true;
  if (window.location.hostname === 'localhost') {
    useProd = process.env.REACT_APP_PROD === 'true'
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
