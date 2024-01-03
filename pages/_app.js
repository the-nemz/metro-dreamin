import { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga4';
import NextNProgress from 'nextjs-progressbar';
import { Tooltip } from 'react-tooltip';
import { Lato } from '@next/font/google';

import '/util/polyfill.js';
import { useUserData } from '/util/hooks.js';
import { getThemeCookieSSR } from '/util/cookies.js';
import { FirebaseContext } from '/util/firebase.js';
import { isTouchscreenDevice, renderFadeWrap } from '/util/helpers.js';

import { Auth } from '/components/Auth.js';
import { CodeOfConduct } from '/components/CodeOfConduct.js';
import { Contribute } from '/components/Contribute.js';
import { CookiePreference } from '/components/CookiePreference.js';
import { Mission } from '/components/Mission.js';
import { Settings } from '/components/Settings.js';

import '@fortawesome/fontawesome-free/css/all.min.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'react-dropdown/style.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

import '/styles/default.scss';

const lato = Lato({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin-ext']
});

function App({ Component, pageProps, theme }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);
  const userData = useUserData({ theme });

  const [ showAuthModal, setShowAuthModal ] = useState(false);
  const [ showContributeModal, setShowContributeModal ] = useState(false);
  const [ showConductModal, setShowConductModal ] = useState(false);
  const [ showCookiePrompt, setShowCookiePrompt ] = useState(false);
  const [ showMissionModal, setShowMissionModal ] = useState(false);
  const [ showSettingsModal, setShowSettingsModal ] = useState(false);

  useEffect(() => {
    const cookiePreference = localStorage.getItem('mdCookiePreference');

    switch (cookiePreference) {
      case 'allow':
        initializeAnalytics()
        break;
      case 'deny':
        // do not initialize GA
        break;
      default:
        setShowCookiePrompt(true);
        break;
    }
  }, []);

  useEffect(() => {
    if (!router.asPath) return;

    const hash = router.asPath.split('#')?.[1];
    if (!hash) return;

    switch (hash) {
      case 'codeofconduct':
        setShowConductModal(true);
        break;
      case 'cookiepreference':
        setShowCookiePrompt(true);
        break;
      case 'mission':
        setShowMissionModal(true);
        break;
      default:
        // do nothing
        break;
    }
  }, [router.asPath]);

  const initializeAnalytics = () => {
    console.log('~~~~ Analytics enabled ~~~~');
    ReactGA.initialize('G-7LR3CWMSPV');
    ReactGA.set({ 'version': '3.0.0' });
    ReactGA.set({ 'fullscreen': 'false' });
  }

  if (!firebaseContext.database) {
    // Wait until we have a db before rendering
    return <></>;
  }

  const cookiePref = showCookiePrompt ?
                     <CookiePreference onClose={() => setShowCookiePrompt(false)}
                                       onAccept={() => initializeAnalytics()} /> :
                     null;

  return (
    <FirebaseContext.Provider value={{...firebaseContext, ...{
                                                                authStateLoading: userData.authStateLoading,
                                                                user: userData.user,
                                                                settings: userData.settings,
                                                                ownSystemDocs: userData.ownSystemDocs,
                                                                starredSystemIds: userData.starredSystemIds,
                                                                checkBidirectionalBlocks: userData.checkBidirectionalBlocks
                                                             }
                                    }}>
      <style jsx global>
        {` * { font-family: ${lato.style.fontFamily}, sans-serif; }`}
      </style>

      <NextNProgress color={userData.settings.lightMode ? '#000000' : '#ffffff'} options={{ showSpinner: false, parent: '.ProgressBar-bar' }} />
      <Component {...pageProps}
                 key={router.asPath}
                 onToggleShowAuth={setShowAuthModal}
                 onToggleShowConduct={setShowConductModal}
                 onToggleShowContribute={setShowContributeModal}
                 onToggleShowMission={setShowMissionModal}
                 onToggleShowSettings={setShowSettingsModal}
      />

      <Tooltip id="Tooltip"
               border={userData.settings.lightMode ? '1px solid black' : '1px solid white'}
               variant={userData.settings.lightMode ? 'light' : 'dark'}
               openOnClick={isTouchscreenDevice()}
               anchorSelect={isTouchscreenDevice() ? '[data-tooltip-content]:not(.Map-station)' : '[data-tooltip-content]'} />

      <Auth open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <CodeOfConduct open={showConductModal} onClose={() => setShowConductModal(false)} />
      <Contribute open={showContributeModal} onClose={() => setShowContributeModal(false)}/>
      <Mission open={showMissionModal} onClose={() => setShowMissionModal(false)} />
      <Settings open={showSettingsModal} onClose={() => setShowSettingsModal(false)}/>

      {renderFadeWrap(cookiePref, 'cookie')}
    </FirebaseContext.Provider>
  );
}

App.getInitialProps = async (context) => {
  return { theme: getThemeCookieSSR(context.ctx) }
}

export default App;
