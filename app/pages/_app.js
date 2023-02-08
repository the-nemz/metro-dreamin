import { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga4';
import NextNProgress from 'nextjs-progressbar';
import { Lato } from '@next/font/google';

import '/lib/polyfill.js';
import { useUserData } from '/lib/hooks.js';
import { getThemeCookieSSR } from '/lib/cookies.js';
import { FirebaseContext } from '/lib/firebase.js';

import { Auth } from '/components/Auth.js';
import { Mission } from '/components/Mission.js';
import { Settings } from '/components/Settings.js';

import '@fortawesome/fontawesome-free/css/all.min.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'react-dropdown/style.css';

import '/styles/default.scss';

const lato = Lato({
  weight: ['400', '700'],
  style: ['normal', 'italic']
});

function App({ Component, pageProps, theme }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);
  const userData = useUserData({ theme });

  const [ showSettingsModal, setShowSettingsModal ] = useState(false);
  const [ showAuthModal, setShowAuthModal ] = useState(false);
  const [ showMissionModal, setShowMissionModal ] = useState(false);

  useEffect(() => {
    ReactGA.initialize('G-7LR3CWMSPV');
    ReactGA.set({ 'version': '3.0.0' });
    ReactGA.set({ 'fullscreen': 'false' });
  }, []);

  if (!firebaseContext.database) {
    // Wait until we have a db before rendering
    return <></>;
  }

  return (
    <FirebaseContext.Provider value={{...firebaseContext, ...{
                                                                user: userData.user,
                                                                settings: userData.settings,
                                                                ownSystemDocs: userData.ownSystemDocs,
                                                                starredSystemIds: userData.starredSystemIds,
                                                                authStateLoading: userData.authStateLoading
                                                             }
                                    }}>
      <style jsx global>
        {` html { font-family: ${lato.style.fontFamily}; }`}
      </style>

      <NextNProgress color={userData.settings.lightMode ? '#000000' : '#ffffff'} options={{ showSpinner: false, parent: 'main' }} />
      <Component {...pageProps}
                 key={router.asPath}
                 onToggleShowAuth={setShowAuthModal}
                 onToggleShowSettings={setShowSettingsModal}
                 onToggleShowMission={setShowMissionModal}
      />

      <Auth open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <Mission open={showMissionModal} onClose={() => setShowMissionModal(false)} />
      <Settings open={showSettingsModal} onClose={() => setShowSettingsModal(false)}/>
    </FirebaseContext.Provider>
  );
}

App.getInitialProps = async (context) => {
  return { theme: getThemeCookieSSR(context.ctx) }
}

export default App;
