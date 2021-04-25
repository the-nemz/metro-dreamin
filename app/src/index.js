import React, { useState, useEffect, useContext } from "react";
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Switch, useLocation, useParams } from "react-router-dom";
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactTooltip from 'react-tooltip';

import firebase from 'firebase';
import firebaseui from 'firebaseui';

import './js/polyfill.js';
import browserHistory from "./js/history.js";
import { FirebaseContext } from "./js/firebaseContext.js";

import { Main } from './js/Main.js';
import { Explore } from './js/Explore.js';
import { Settings } from './js/components/Settings.js';

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
  const [ settings, setSettings ] = useState({});
  const [ showSettingsModal, setShowSettingsModal ] = useState(false);

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
      userId: currentUser.uid
    });

    setUser(currentUser);

    let userDoc = database.doc('users/' + currentUser.uid);
    userDoc.get().then((doc) => {
      if (doc) {
        const data = doc.data();
        if (Object.keys(data || {}).length) {
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

  const signOut = () => {
    firebase.auth().signOut();
    // TODO: enable
    // ReactGA.event({
    //   category: 'User',
    //   action: 'Signed Out'
    // });
    window.location.reload();
  }

  const saveSettings = (propertiesToSave, trackAction = 'Update') => {
    if (user && settings.userId && Object.keys(propertiesToSave || {}).length) {
      propertiesToSave.lastLogin = Date.now();

      let userDoc = database.doc('users/' + settings.userId);
      userDoc.update(propertiesToSave).then(() => {
        // TODO: enable
        // ReactGA.event({
        //   category: 'Settings',
        //   action: trackAction
        // });
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });
    }
  }

  const handleToggleTheme = (useLight) => {
    setSettings(prevSettings => {
      return {...prevSettings, ...{ lightMode: useLight }};
    });
    saveSettings({ lightMode: useLight }, useLight ? 'Light Mode On' : 'Dark Mode On');
  }

  const handleUpdateDisplayName = (displayName) => {
    setSettings(prevSettings => {
      return {...prevSettings, ...{ displayName: displayName }};
    });
    saveSettings({ displayName: displayName }, 'Display Name');
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

  return (
    <FirebaseContext.Provider value={{...firebaseContext, ...{ user: user, database: database, settings: settings }}}>
      <Router>
        <Switch>
          <Route exact path="/" children={<MainParameterizer
                                            user={user}
                                            database={database}
                                            settings={settings}
                                            firebaseContext={firebaseContext}
                                            signIn={signIn}
                                            signOut={signOut}
                                            saveSettings={saveSettings}
                                            onToggleTheme={handleToggleTheme}
                                            onToggleShowSettings={setShowSettingsModal}
                                            onStarredViewsUpdated={updateStarredViews}
                                          />}
          />
          <Route path="/view/:viewIdEncoded?" children={<MainParameterizer
                                                user={user}
                                                database={database}
                                                settings={settings}
                                                firebaseContext={firebaseContext}
                                                signIn={signIn}
                                                signOut={signOut}
                                                saveSettings={saveSettings}
                                                onToggleTheme={handleToggleTheme}
                                                onToggleShowSettings={setShowSettingsModal}
                                                onStarredViewsUpdated={updateStarredViews}
                                              />}
          />
          <Route exact path="/explore" children={<ExploreParameterizer onToggleShowSettings={setShowSettingsModal} />} />
        </Switch>

        <ReactCSSTransitionGroup
            transitionName="FadeAnim"
            transitionAppear={true}
            transitionAppearTimeout={400}
            transitionEnter={true}
            transitionEnterTimeout={400}
            transitionLeave={true}
            transitionLeaveTimeout={400}>
          {showSettingsModal ?
            <Settings
              onToggleShowSettings={setShowSettingsModal}
              onToggleTheme={handleToggleTheme}
              onUpdateDisplayName={handleUpdateDisplayName}
              signOut={signOut}
            />
          : ''}

          <ReactTooltip delayShow={400} border={true} type={settings.lightMode ? 'light' : 'dark'} />
        </ReactCSSTransitionGroup>
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
      signOut={props.signOut}
      onToggleTheme={props.onToggleTheme}
      onToggleShowSettings={props.onToggleShowSettings}
      onStarredViewsUpdated={props.onStarredViewsUpdated}
      writeDefault={writeDefault}
    />
  )
}

function ExploreParameterizer(props) {
  const queryParams = new URLSearchParams(useLocation().search);
  const searchQP = queryParams.get('search');

  return (
    <Explore search={searchQP} onToggleShowSettings={props.onToggleShowSettings} />
  )
}

ReactDOM.render(
  <Index />,
  document.getElementById('root')
);
