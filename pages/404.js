import React from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';

import { FOUR_OH_FOUR } from '/util/constants.js';

import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
import { Metatags } from '/components/Metatags.js';
import { Theme } from '/components/Theme.js';

export default function FourOhFour(props) {

  return <Theme>
    <Header onToggleShowSettings={props.onToggleShowSettings} onToggleShowAuth={props.onToggleShowAuth} />
    <Metatags />

    <main className="FourOhFour">
      <div className="FourOhFour-container">
        <h1 className="FourOhFour-heading">
          404 - That page does not seem to exist...
        </h1>

        <img className="FourOhFour-gif" src={FOUR_OH_FOUR} />

        <Link href="/" className="FourOhFour-home Button--primary"
              onClick={() => ReactGA.event({ category: 'FourOhFour', action: 'Go Home' })}>
          Go home
        </Link>
      </div>
    </main>

    <Footer onToggleShowMission={props.onToggleShowMission}
            onToggleShowContribute={props.onToggleShowContribute}
            onToggleShowConduct={props.onToggleShowConduct} />
  </Theme>;
}
