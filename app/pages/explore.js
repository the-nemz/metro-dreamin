import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';
import ReactTooltip from 'react-tooltip';

import { FirebaseContext } from '/lib/firebase.js';

import { Discover } from '/components/Discover.js';
import { Drawer } from '/components/Drawer.js';
import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
import { Metatags } from '/components/Metatags.js';
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

  const content = query ? <Search search={query} /> : <Discover onToggleShowMission={props.onToggleShowMission} />;
  return <Theme>
    <Metatags />
    <Header query={query} onToggleShowSettings={props.onToggleShowSettings} onToggleShowAuth={props.onToggleShowAuth} />
    <Drawer onToggleShowAuth={props.onToggleShowAuth} />

    <main className="Explore">
      <div className="Explore-container">
        {content}
      </div>
    </main>

    {!firebaseContext.authStateLoading && <ReactTooltip delayShow={400} border={true} type={firebaseContext.settings.lightMode ? 'light' : 'dark'} />}
    <Footer onToggleShowMission={props.onToggleShowMission} />
  </Theme>;
}

export default Explore;
