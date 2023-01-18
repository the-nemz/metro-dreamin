import React, { useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';
import { FOUR_OH_FOUR } from '/lib/constants.js';

import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
import { Metatags } from '/components/Metatags.js';
import { Theme } from '/components/Theme.js';

export default function FourOhFour(props) {
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
    <Header onHomeClick={handleHomeClick} onToggleShowSettings={props.onToggleShowSettings} onToggleShowAuth={props.onToggleShowAuth} />
    <Metatags />

    <main className="FourOhFour">
      <div className="FourOhFour-container">
        <h1 className="FourOhFour-heading">
          404 - That page does not seem to exist...
        </h1>

        <img className="FourOhFour-gif" src={FOUR_OH_FOUR} />

        <Link href="/" className="FourOhFour-home Button--primary">
          Go home
        </Link>
      </div>
    </main>

    <Footer onToggleShowMission={props.onToggleShowMission} />
  </Theme>;
}
