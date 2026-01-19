import { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga4';
import NextNProgress from 'nextjs-progressbar';
import { Tooltip } from 'react-tooltip';
import requestIp from 'request-ip';
import { Lato } from '@next/font/google';

import '/util/polyfill.js';
import { useUserData } from '/util/hooks.js';
import { getThemeCookieSSR } from '/util/cookies.js';
import { DeviceContext } from '/util/deviceContext.js';
import { FirebaseContext } from '/util/firebase.js';
import { isTouchscreenDevice } from '/util/helpers.js';
import { MapProvider } from '/util/mapProvider.js';

import { Auth } from '/components/Auth.js';
import { CodeOfConduct } from '/components/CodeOfConduct.js';
import { Contribute } from '/components/Contribute.js';
import { EmailUpdate } from '/components/EmailUpdate.js';
import { EmailVerification } from '/components/EmailVerification.js';
import { Gtag } from '/components/Gtag.js';
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

function App({ Component, pageProps, theme, ip }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);
  const userData = useUserData({ theme, ip });

  const [ isMobile, setIsMobile ] = useState();
  const [ isPhone, setIsPhone ] = useState();
  const [ showAuthModal, setShowAuthModal ] = useState(false);
  const [ showContributeModal, setShowContributeModal ] = useState(false);
  const [ showConductModal, setShowConductModal ] = useState(false);
  const [ showEmailUpdateModal, setShowEmailUpdateModal ] = useState(false);
  const [ showEmailVerificationModal, setShowEmailVerificationModal ] = useState(false);
  const [ showMissionModal, setShowMissionModal ] = useState(false);
  const [ showSettingsModal, setShowSettingsModal ] = useState(false);

  useEffect(() => {
    if (!window) return;

    initializeAnalytics();

    const handleConsentGranted = () => {
      if (process.env.NEXT_PUBLIC_STAGING === 'true' || process.env.NEXT_PUBLIC_LOCAL === 'true') {
        console.log('~~~~ Analytics enabled ~~~~');
      }
    };
    window.addEventListener('consentGranted', handleConsentGranted);

    handleResize();

    let resizeTimeout;
    onresize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 50);
    };

    return () => {
      clearTimeout(resizeTimeout);
      onresize = () => {};
      window.removeEventListener('consentGranted', handleConsentGranted);
    };
  }, []);

  useEffect(() => {
    if (!router.asPath) return;

    const hash = router.asPath.split('#')?.[1];
    if (!hash) return;

    switch (hash) {
      case 'codeofconduct':
        setShowConductModal(true);
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
    ReactGA.initialize('G-7LR3CWMSPV');
    ReactGA.set({ 'version': '3.0.0' });
    ReactGA.set({ 'fullscreen': 'false' });
  }

  const handleResize = () => {
    const isMobileWidth = window.innerWidth <= 991;
    if (isMobileWidth && !isMobile) {
      setIsMobile(true);
    } else if (!isMobileWidth) {
      setIsMobile(false);
    }

    const isPhoneWidth = window.innerWidth <= 767;
    if (isPhoneWidth && !isPhone) {
      setIsPhone(true);
    } else if (!isPhoneWidth) {
      setIsPhone(false);
    }
  }

  if (!firebaseContext.database) {
    // Wait until we have a db before rendering
    return <></>;
  }

  return (
    <DeviceContext.Provider value={{ isMobile, isPhone, ip }}>
      <FirebaseContext.Provider value={{...firebaseContext, ...{
                                                                  authStateLoading: userData.authStateLoading,
                                                                  user: userData.user,
                                                                  settings: userData.settings,
                                                                  checkBidirectionalBlocks: userData.checkBidirectionalBlocks
                                                               }
                                      }}>
        <style jsx global>
          {` * { font-family: ${lato.style.fontFamily}, sans-serif; }`}
        </style>

        <Gtag />

        <NextNProgress color={userData.settings.lightMode ? '#000000' : '#ffffff'}
                       options={{ showSpinner: false, parent: '.ProgressBar-bar' }} />

        <MapProvider>
          <Component {...pageProps}
                     key={router.asPath}
                     onToggleShowAuth={setShowAuthModal}
                     onToggleShowConduct={setShowConductModal}
                     onToggleShowContribute={setShowContributeModal}
                     onToggleShowEmailUpdate={setShowEmailUpdateModal}
                     onToggleShowEmailVerification={setShowEmailVerificationModal}
                     onToggleShowMission={setShowMissionModal}
                     onToggleShowSettings={setShowSettingsModal} />
        </MapProvider>

        <Tooltip id="Tooltip"
                 border={userData.settings.lightMode ? '1px solid black' : '1px solid white'}
                 variant={userData.settings.lightMode ? 'light' : 'dark'}
                 openOnClick={isTouchscreenDevice()}
                 anchorSelect={isTouchscreenDevice() ? '[data-tooltip-content]:not(.Map-station)' : '[data-tooltip-content]'} />

        <Auth open={showAuthModal} onClose={() => setShowAuthModal(false)} />
        <CodeOfConduct open={showConductModal} onClose={() => setShowConductModal(false)} />
        <Contribute open={showContributeModal} onClose={() => setShowContributeModal(false)}/>
        <Mission open={showMissionModal} onClose={() => setShowMissionModal(false)} />
        <Settings open={showSettingsModal} onClose={() => setShowSettingsModal(false)}
                  onToggleShowEmailUpdate={setShowEmailUpdateModal}
                  onToggleShowEmailVerification={setShowEmailVerificationModal} />
        <EmailUpdate open={showEmailUpdateModal} onClose={() => setShowEmailUpdateModal(false)}
                     onToggleShowEmailVerification={setShowEmailVerificationModal} />
        <EmailVerification open={showEmailVerificationModal} onClose={() => setShowEmailVerificationModal(false)} />
      </FirebaseContext.Provider>
    </DeviceContext.Provider>
  );
}

App.getInitialProps = async ({ ctx }) => {
  let theme = '';
  let ip = '';
  try {
    theme = getThemeCookieSSR(ctx);
    ip = requestIp.getClientIp(ctx.req);
  } catch (e) {
    console.log('getInitialProps error:', e);
  }

  return { theme, ip };
}

export default App;
