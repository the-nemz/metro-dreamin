import React, { useContext } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';

import { FirebaseContext } from '/lib/firebase.js';
import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

export function Footer({
                          onToggleShowMission = () => {},
                          onToggleShowContribute = () => {},
                          onToggleShowConduct = () => {}
                      }) {
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

          <div className="Footer-buttons">
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

            <button className="Footer-contributeButton Button--primary"
                    onClick={() => {
                      onToggleShowContribute(true);
                      ReactGA.event({
                        category: 'Footer',
                        action: 'Toggle Contribute'
                      });
                    }}>
              Contribute
            </button>
          </div>
        </div>

        <div className="Footer-links">
          <Link className="Footer-link Link" href="https://ko-fi.com/metrodreamin"
                target="_blank" rel="nofollow noopener noreferrer"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'Ko-fi' })}>
            Ko-fi
          </Link>
          <Link className="Footer-link Link" href="mailto:metrodreamin@gmail.com"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'Email' })}>
            Email
          </Link>
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
          <button className="Footer-link Link"
                  onClick={() => {
                    onToggleShowConduct(true);
                    ReactGA.event({
                      category: 'Footer',
                      action: 'Toggle Conduct'
                    });
                  }}>
            Code of Conduct
          </button>
          <Link className="Footer-link Link" href="/privacypolicy.html"
                target="_blank" rel="nofollow noopener noreferrer"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'Privacy' })}>
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
