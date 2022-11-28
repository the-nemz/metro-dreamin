import { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';

import firebase from 'firebase';
// import firebaseui from 'firebaseui';
import { Lato } from '@next/font/google';

import { FirebaseContext } from '../lib/firebaseContext.js';

import '../styles/default.scss';
import '@fortawesome/fontawesome-free/css/all.min.css';

const prodConfig = {
  // apiKey: "AIzaSyBIMlulR8OTOoF-57DHty1NuXM0kqVoL5c",
  // authDomain: "metrodreamin.firebaseapp.com",
  // databaseURL: "https://metrodreamin.firebaseio.com",
  // projectId: "metrodreamin",
  // storageBucket: "metrodreamin.appspot.com",
  // messagingSenderId: "86165148906"
};

const stagingConfig = {
  apiKey: "AIzaSyDYU-8dYy0OWGJ1RJ46V_S7fWJHlAA2DWg",
  authDomain: "metrodreaminstaging.firebaseapp.com",
  databaseURL: "https://metrodreaminstaging.firebaseio.com",
  projectId: "metrodreaminstaging",
  storageBucket: "metrodreaminstaging.appspot.com",
  messagingSenderId: "572980459956"
};

const lato = Lato({
  weight: ['400', '700'],
  style: ['normal', 'italic']
});

export default function App({ Component, pageProps }) {
  // const [ user ] = useAuthState(auth);
  const [user, setUser] = useState();
  const [ database, setDatabase ] = useState();
  // TODO: figure out default theme
  // const [ settings, setSettings ] = useState({ lightMode: !window.matchMedia('(prefers-color-scheme: dark)').matches });
  const [ settings, setSettings ] = useState({ lightMode: false });
  const [ showSettingsModal, setShowSettingsModal ] = useState(false);

  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseContext.useProd ? prodConfig : stagingConfig);
    } else {
      firebase.app();
    }
    setDatabase(firebase.firestore());

    // window.ui = new firebaseui.auth.AuthUI(firebase.auth());

    // if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
    //   document.body.classList.add('isIOS');
    // }

    // ReactGA.initialize('UA-143422261-1');
    // ReactGA.set({ dimension1: '3.0.0' });
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
      ReactGA.event({
        category: 'User',
        action: 'Signed In'
      });
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });

    ReactGA.set({ dimension2: currentUser.uid });
  }

  const signOut = () => {
    firebase.auth().signOut();
    ReactGA.event({
      category: 'User',
      action: 'Signed Out'
    });
    window.location.reload();
  }

  const saveSettings = (propertiesToSave, trackAction = 'Update') => {
    if (user && settings.userId && Object.keys(propertiesToSave || {}).length) {
      propertiesToSave.lastLogin = Date.now();

      let userDoc = database.doc('users/' + settings.userId);
      userDoc.update(propertiesToSave).then(() => {
        ReactGA.event({
          category: 'Settings',
          action: trackAction
        });
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

  const handleTogglePerformance = (useLow) => {
    setSettings(prevSettings => {
      return {...prevSettings, ...{ lowPerformance: useLow }};
    });
    saveSettings({ lowPerformance: useLow }, useLow ? 'Low Performance On' : 'High Performance On');
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
      <style jsx global>
        {`
          html {
            font-family: ${lato.style.fontFamily};
          }
        `}
      </style>
      <Component key={router.asPath} {...pageProps} />
      {/* <Router history={browserHistory}>
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
                                            onTogglePerformance={handleTogglePerformance}
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
                                                          onTogglePerformance={handleTogglePerformance}
                                                          onToggleShowSettings={setShowSettingsModal}
                                                          onStarredViewsUpdated={updateStarredViews}
                                                        />}
          />
          <Route exact path="/explore" children={<ExploreParameterizer onToggleShowSettings={setShowSettingsModal} />} />
          <Route children={<ExploreParameterizer onToggleShowSettings={setShowSettingsModal} />} />
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
              onTogglePerformance={handleTogglePerformance}
              onUpdateDisplayName={handleUpdateDisplayName}
              signOut={signOut}
            />
          : ''}
        </ReactCSSTransitionGroup>

        <ReactTooltip delayShow={400} border={true} type={settings.lightMode ? 'light' : 'dark'} />
      </Router> */}
    </FirebaseContext.Provider>
  );
}

// function MainParameterizer(props) {
//   const location = useLocation();
//   const queryParams = new URLSearchParams(location.search);
//   const viewIdQP = queryParams.get('view');
//   const writeDefault = queryParams.get('writeDefault');
//   const { viewIdEncoded } = useParams();

//   let viewId;
//   try {
//     viewId = decodeURIComponent(viewIdEncoded || '')
//   } catch (e) {
//     console.log('Error:', e);
//   }

//   if (viewIdQP || viewIdQP === '') {
//     // If the param exists or is the empty string, update the url accordingly
//     const param = viewIdEncoded ? viewIdEncoded : encodeURIComponent(viewIdQP);
//     browserHistory.replace(param ? `/view/${param}` : `/view`);
//   }

//   if (location.pathname === '/' && !viewIdQP) {
//     // If at root with no view query param, go to explore page
//     return (
//       <Redirect to="/explore" />
//     );
//   }

//   return (
//     <Main
//       viewId={viewId ? viewId : viewIdQP}
//       user={props.user}
//       settings={props.settings}
//       database={props.database}
//       apiBaseUrl={props.firebaseContext.apiBaseUrl}
//       signIn={props.signIn}
//       signOut={props.signOut}
//       onToggleShowSettings={props.onToggleShowSettings}
//       onStarredViewsUpdated={props.onStarredViewsUpdated}
//       writeDefault={writeDefault}
//     />
//   )
// }

// function ExploreParameterizer(props) {
//   const location = useLocation();
//   const queryParams = new URLSearchParams(location.search);
//   const searchQP = queryParams.get('search');

//   if (location.pathname !== '/explore') {
//     // If we aren't at this specific path, update the url
//     browserHistory.replace('/explore');
//   }

//   return (
//     <Explore search={searchQP} onToggleShowSettings={props.onToggleShowSettings} />
//   )
// }
