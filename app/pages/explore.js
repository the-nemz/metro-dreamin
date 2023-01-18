import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';
import { renderFadeWrap } from '/lib/util.js';
import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

import { Discover } from '/components/Discover.js';
import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
import { Search } from '/components/Search.js';
import { Theme } from '/components/Theme.js';

function Explore(props) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [query, setQuery] = useState(router.query.search ? `${router.query.search}` : '');

  useEffect(() => {
    ReactGA.pageview('/explore');
  }, []);

  useEffect(() => {
    // Allows browser back button to change searches
    setQuery(router.query.search ? `${router.query.search}` : '')
  }, [router.query.search]);

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

  const renderFooter = () => {
    return (
      <div className="Explore-footer">
        <div className="Explore-footerContainer">
          <div className="Explore-footerLeft">
            <a className="Explore-designation Link" href="https://metrodreamin.com">
              <img className="Explore-desigLogo" src={firebaseContext.settings.lightMode ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
              <div className="Explore-copyright Explore-copyright--desktop">
                © {(new Date()).getFullYear()} MetroDreamin'
              </div>
              <div className="Explore-copyright Explore-copyright--mobile">
                © {(new Date()).getFullYear()}<br />MetroDreamin'
              </div>
            </a>

            <button className="Explore-footerMission Button--inverse"
                    onClick={() => {
                      setShowMission(currShown => !currShown);
                      ReactGA.event({
                        category: 'Explore',
                        action: 'Toggle Mission'
                      });
                    }}>
              Mission
            </button>
          </div>

          <div className="Explore-footerLinks">
            <a className="Explore-footerLink Link" href="https://twitter.com/MetroDreamin?s=20"
              target="_blank" rel="nofollow noopener noreferrer"
              onClick={() => ReactGA.event({ category: 'Explore', action: 'Twitter' })}>
              Twitter
            </a>
            <a className="Explore-footerLink Link" href="https://github.com/the-nemz/metro-dreamin"
              target="_blank" rel="nofollow noopener noreferrer"
              onClick={() => ReactGA.event({ category: 'Explore', action: 'GitHub' })}>
              Source Code
            </a>
            <a className="Explore-footerLink Link" href="privacypolicy.html"
              target="_blank" rel="nofollow noopener noreferrer"
              onClick={() => ReactGA.event({ category: 'Explore', action: 'Privacy' })}>
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    );
  };

  const content = query ? <Search search={query} /> : <Discover onToggleShowMission={props.onToggleShowMission} />;
  return <Theme>
    <Header query={query} onHomeClick={handleHomeClick} onToggleShowSettings={props.onToggleShowSettings} onToggleShowAuth={props.onToggleShowAuth} />
    
    <main className="Explore">
      <div className="Explore-container">
        {content}
      </div>
    </main>

    <Footer onToggleShowMission={props.onToggleShowMission} />
  </Theme>;
}

export default Explore;
