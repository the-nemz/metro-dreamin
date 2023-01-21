import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';

import { Discover } from '/components/Discover.js';
import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
import { Search } from '/components/Search.js';
import { Theme } from '/components/Theme.js';

function Explore(props) {
  const router = useRouter();

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
    <Header query={query} onToggleShowSettings={props.onToggleShowSettings} onToggleShowAuth={props.onToggleShowAuth} />

    <main className="Explore">
      <div className="Explore-container">
        {content}
      </div>
    </main>

    <Footer onToggleShowMission={props.onToggleShowMission} />
  </Theme>;
}

export default Explore;
