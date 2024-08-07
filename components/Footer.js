import React, { useContext } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';

import { FirebaseContext } from '/util/firebase.js';
import { LOGO, LOGO_INVERTED } from '/util/constants.js';

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
            <div className="Footer-copyright">
              © {(new Date()).getFullYear()} MetroDreamin'
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
          <Link className="Footer-link Link" href="mailto:hello@metrodreamin.com"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'Email' })}>
            Email
          </Link>
          <Link className="Footer-link Link" href="https://twitter.com/MetroDreamin"
                target="_blank" rel="nofollow noopener noreferrer"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'Twitter' })}>
            Twitter/X
          </Link>
          <Link className="Footer-link Link" href="https://www.reddit.com/r/metrodreamin/"
                target="_blank" rel="nofollow noopener noreferrer"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'Reddit' })}>
            Reddit
          </Link>
          <Link className="Footer-link Link" href="https://discord.gg/eS6wDdrRgC"
                target="_blank" rel="nofollow noopener noreferrer"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'Discord' })}>
            Discord
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
          <Link className="Footer-link Link" href="/cookies.html"
                target="_blank" rel="nofollow noopener noreferrer"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'Cookies' })}>
            Cookies
          </Link>
          <Link className="Footer-link Link" href="/privacy.html"
                target="_blank" rel="nofollow noopener noreferrer"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'Privacy' })}>
            Privacy Policy
          </Link>
          <Link className="Footer-link Link" href="https://github.com/the-nemz/metro-dreamin"
                target="_blank" rel="nofollow noopener noreferrer"
                onClick={() => ReactGA.event({ category: 'Footer', action: 'GitHub' })}>
            Source Code
          </Link>
        </div>
      </div>
    </footer>
  );
}
