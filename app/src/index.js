import React, { useState, useEffect, useContext } from "react";
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Switch, useLocation, useParams } from "react-router-dom";

import firebase from 'firebase';
import firebaseui from 'firebaseui';

import './js/polyfill.js';
import browserHistory from "./js/history.js";
import { FirebaseContext } from "./js/firebaseContext.js";

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

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    firebase.initializeApp(firebaseContext.useProd ? prodConfig : stagingConfig);
    setDatabase(firebase.firestore());

    window.ui = new firebaseui.auth.AuthUI(firebase.auth());

    if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
      document.body.classList.add('isIOS');
    }
  }, []);

  useEffect(() => {
    if (database) {
      // Will only be called once
      firebase.auth().onAuthStateChanged((u) => {
        if (u && u.uid) {
          signIn(u);
        }
      });
    }
  }, [database]);

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
      // TODO: enable
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

  const updateStarredViews = (starredViews) => {
    setSettings(prevSettings => {
      return {...prevSettings, ...{ starredViews: starredViews }};
    });
  }

  if (!database) {
    // Wait until we have a db before rendering
    return <></>;
  }

  // TODO: look into seeing if we can use useContext to handle user, database, and settings
  return (
    <FirebaseContext.Provider value={{...firebaseContext, ...{ user: user, database: database, settings: settings }}}>
      <Router>
        <Switch>
          <Route exact path="/" children={<MainParameterizer
                                            user={user}
                                            database={database}
                                            settings={settings}
                                            signIn={signIn}
                                            onNoSave={handleNoSave}
                                            onToggleTheme={handleToggleTheme}
                                          />}
          />
          <Route path="/view/:viewIdEncoded?" children={<MainParameterizer
                                                user={user}
                                                database={database}
                                                settings={settings}
                                                firebaseContext={firebaseContext}
                                                signIn={signIn}
                                                onNoSave={handleNoSave}
                                                onToggleTheme={handleToggleTheme}
                                                onStarredViewsUpdated={updateStarredViews}
                                              />}
          />
          <Route exact path="/explore" children={<ExploreParameterizer />} />
        </Switch>
      </Router>
    </FirebaseContext.Provider>
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

  return (
    <Main
      viewId={viewId ? viewId : viewIdQP}
      user={props.user}
      settings={props.settings}
      database={props.database}
      apiBaseUrl={props.firebaseContext.apiBaseUrl}
      signIn={props.signIn}
      onNoSave={props.onNoSave}
      onToggleTheme={props.onToggleTheme}
      onStarredViewsUpdated={props.onStarredViewsUpdated}
      writeDefault={writeDefault}
    />
  )
}

function ExploreParameterizer(props) {
  const queryParams = new URLSearchParams(useLocation().search);
  const searchQP = queryParams.get('search');

  return (
    <Explore search={searchQP} />
  )
}

ReactDOM.render(
  <Index />,
  document.getElementById('root')
);
