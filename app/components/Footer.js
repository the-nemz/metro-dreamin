import React, { useContext } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';

import { FirebaseContext } from '/lib/firebase.js';
import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

export function Footer({ onToggleShowMission = () => {} }) {
  const firebaseContext = useContext(FirebaseContext);

  return (
    <footer className="Footer">
      <div className="Footer-container">
        <div className="Footer-left">
          <Link className="Footer-designation Link" href="https://metrodreamin.com"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'Logo' })}>
            <img className="Footer-desigLogo" src={firebaseContext.settings.lightMode ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
            <div className="Footer-copyright Footer-copyright--desktop">
              © {(new Date()).getFullYear()} MetroDreamin'
            </div>
            <div className="Footer-copyright Footer-copyright--mobile">
              © {(new Date()).getFullYear()}<br />MetroDreamin'
            </div>
          </Link>

          <button className="Footer-missionButton Button--inverse"
                  onClick={() => {
                    onToggleShowMission(true);
                    ReactGA.event({
                      category: 'Footer',
                      action: 'Toggle Mission'
                    });
                  }}>
            Mission
          </button>
        </div>

        <div className="Footer-links">
          <Link className="Footer-link Link" href="https://twitter.com/MetroDreamin"
                target="_blank" rel="nofollow noopener noreferrer"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'Twitter' })}>
            Twitter
          </Link>
          <Link className="Footer-link Link" href="https://github.com/the-nemz/metro-dreamin"
                target="_blank" rel="nofollow noopener noreferrer"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'GitHub' })}>
            Source Code
          </Link>
          <Link className="Footer-link Link" href="privacypolicy.html"
                target="_blank" rel="nofollow noopener noreferrer"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'Privacy' })}>
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
