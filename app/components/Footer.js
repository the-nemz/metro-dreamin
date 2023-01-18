import React, { useContext } from 'react';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';
import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

export function Footer({ onToggleShowMission = () => {} }) {
  const firebaseContext = useContext(FirebaseContext);

  return (
    <footer className="Footer">
      <div className="Footer-container">
        <div className="Footer-left">
          <a className="Footer-designation Link" href="https://metrodreamin.com">
            <img className="Footer-desigLogo" src={firebaseContext.settings.lightMode ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
            <div className="Footer-copyright Footer-copyright--desktop">
              © {(new Date()).getFullYear()} MetroDreamin'
            </div>
            <div className="Footer-copyright Footer-copyright--mobile">
              © {(new Date()).getFullYear()}<br />MetroDreamin'
            </div>
          </a>

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
          <a className="Footer-link Link" href="https://twitter.com/MetroDreamin?s=20"
            target="_blank" rel="nofollow noopener noreferrer"
            onClick={() => ReactGA.event({ category: 'Footer', action: 'Twitter' })}>
            Twitter
          </a>
          <a className="Footer-link Link" href="https://github.com/the-nemz/metro-dreamin"
            target="_blank" rel="nofollow noopener noreferrer"
            onClick={() => ReactGA.event({ category: 'Footer', action: 'GitHub' })}>
            Source Code
          </a>
          <a className="Footer-link Link" href="privacypolicy.html"
            target="_blank" rel="nofollow noopener noreferrer"
            onClick={() => ReactGA.event({ category: 'Footer', action: 'Privacy' })}>
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
}
