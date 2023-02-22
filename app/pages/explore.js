import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import requestIp from 'request-ip';
import ReactTooltip from 'react-tooltip';

import { FirebaseContext } from '/lib/firebase.js';

import { Discover } from '/components/Discover.js';
import { Drawer } from '/components/Drawer.js';
import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
import { Metatags } from '/components/Metatags.js';
import { Search } from '/components/Search.js';
import { Theme } from '/components/Theme.js';

const IP_API_URL = 'http://ip-api.com/json/';

export async function getServerSideProps({ req }) {
  try {
    const ip = requestIp.getClientIp(req);
    const ipDataResponse = await fetch(`${IP_API_URL}${ip}`);
    const ipInfo = await ipDataResponse.json();
    if (ipInfo && ipInfo.status === 'success') {
      return { props: { ipInfo } };
    } else {
      throw 'ip geolocation error';
    }
  } catch (e) {
    console.log('Unexpected Error:', e);
  }

  return { props: { } };
}

function Explore(props) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [query, setQuery] = useState(router.query.search ? `${router.query.search}` : '');

  useEffect(() => {
    // Allows browser back button to change searches
    setQuery(router.query.search ? `${router.query.search}` : '')
  }, [router.query.search]);

  const content = query ?
                    <Search search={query} /> :
                    <Discover ipInfo={props.ipInfo} onToggleShowMission={props.onToggleShowMission} />;

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
    <Footer onToggleShowMission={props.onToggleShowMission} onToggleShowContribute={props.onToggleShowContribute} />
  </Theme>;
}

export default Explore;
