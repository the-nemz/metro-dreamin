import { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';
import ReactTooltip from 'react-tooltip';
import { Lato } from '@next/font/google';

import '/lib/polyfill.js';
import { useUserData } from '/lib/hooks.js';
import { FirebaseContext } from '/lib/firebase.js';

import { Auth } from '/components/Auth.js';
import { Settings } from '/components/Settings.js';

import '@fortawesome/fontawesome-free/css/all.min.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'react-dropdown/style.css';

import '/styles/default.scss';

const lato = Lato({
  weight: ['400', '700'],
  style: ['normal', 'italic']
});

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);
  const userData = useUserData();

  // TODO: figure out default theme
  // const [ settings, setSettings ] = useState({ lightMode: !window.matchMedia('(prefers-color-scheme: dark)').matches });
  const [ showSettingsModal, setShowSettingsModal ] = useState(false);
  const [ showAuthModal, setShowAuthModal ] = useState(false);

  // useEffect(() => {
  //   if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
  //     document.body.classList.add('isIOS');
  //   }

  //   ReactGA.initialize('UA-143422261-1');
  //   ReactGA.set({ dimension1: '3.0.0' });
  // }, []);

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

      <Component {...pageProps}
                 key={router.asPath}
                 onToggleShowAuth={setShowAuthModal}
                 onToggleShowSettings={setShowSettingsModal}
      />

      <Auth open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <Settings open={showSettingsModal} onClose={() => setShowSettingsModal(false)}/>
      <ReactTooltip delayShow={400} border={true} type={userData.settings.lightMode ? 'light' : 'dark'} />
    </FirebaseContext.Provider>
  );
}
