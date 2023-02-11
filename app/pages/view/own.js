import React, { useContext } from 'react';
import ReactTooltip from 'react-tooltip';

import { FirebaseContext } from '/lib/firebase.js';

import { Drawer } from '/components/Drawer.js';
import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
import { Map } from '/components/Map.js';
import { Metatags } from '/components/Metatags.js';
import { Own } from '/components/Own.js';
import { Theme } from '/components/Theme.js';

export default function ViewOwn(props) {
  const firebaseContext = useContext(FirebaseContext);

  return <Theme>
    <Metatags />
    <Header onToggleShowSettings={props.onToggleShowSettings} onToggleShowAuth={props.onToggleShowAuth} />
    <Drawer onToggleShowAuth={props.onToggleShowAuth} />

    <main className="ViewOwn">
      {!firebaseContext.authStateLoading && <Own />}

      <Map system={{ lines: {}, stations: {} }} interlineSegments={{}} changing={{}} focus={{}}
           systemLoaded={false} viewOnly={false} waypointsHidden={false} />
    </main>

    {!firebaseContext.authStateLoading && <ReactTooltip delayShow={400} border={true} type={firebaseContext.settings.lightMode ? 'light' : 'dark'} />}
    <Footer onToggleShowMission={props.onToggleShowMission} />
  </Theme>;
}
