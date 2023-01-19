import React, { useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
import { Map } from '/components/Map.js';
import { Metatags } from '/components/Metatags.js';
import { Own } from '/components/Own.js';
import { Theme } from '/components/Theme.js';

export default function ViewOwn(props) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const handleHomeClick = () => {
    ReactGA.event({
      category: 'View',
      action: 'Home'
    });

    const goHome = () => {
      router.push({
        pathname: '/explore'
      });
    }

    goHome();
  }

  return <Theme>
    <Metatags />
    <Header onHomeClick={handleHomeClick} onToggleShowSettings={props.onToggleShowSettings} onToggleShowAuth={props.onToggleShowAuth} />

    <main className="ViewOwn">
      {!firebaseContext.authStateLoading && <Own />}

      <Map system={{ lines: {}, stations: {} }} interlineSegments={{}} changing={{}} focus={{}}
           systemLoaded={false} viewOnly={false} waypointsHidden={false} />
    </main>

    <Footer onToggleShowMission={props.onToggleShowMission} />
  </Theme>;
}
