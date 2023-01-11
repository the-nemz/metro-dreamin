import React, { useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';
import { FOUR_OH_FOUR } from '/lib/constants.js';

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
    <main className="FourOhFour">
      <Metatags />

      <Header onHomeClick={handleHomeClick} onToggleShowSettings={props.onToggleShowSettings} onToggleShowAuth={props.onToggleShowAuth} />

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
  </Theme>;
}
