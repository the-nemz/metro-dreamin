import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';

import { FirebaseContext, getUserDocData, getSystemsByUser } from '/lib/firebase.js';

import { Drawer } from '/components/Drawer.js';
import { Header } from '/components/Header.js';
import { Footer } from '/components/Footer.js';
import { Result } from '/components/Result.js';
import { Theme } from '/components/Theme.js';
import { Title } from '/components/Title.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export async function getServerSideProps({ params }) {
  const { userId } = params;

  if (userId) {
    try {
      const userDocData = await getUserDocData(userId) ?? null;
      const systemsByUser = await getSystemsByUser(userId) ?? [];

      if (!userDocData) {
        return { notFound: true };
      }

      return { props: { userDocData, systemsByUser } };
    } catch (e) {
      console.log('Unexpected Error:', e);
      return { notFound: true };
    }
  }

  return { props: { notFound: true } };
}

export default function View({
                              userDocData = {},
                              systemsByUser = [],
                              onToggleShowSettings = () => {},
                              onToggleShowAuth = () => {},
                              onToggleShowMission = () => {},
                            }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [viewOnly, setViewOnly] = useState(true);

  useEffect(() => {
    if (!firebaseContext.authStateLoading) {
      if (userDocData.userId && firebaseContext.user && firebaseContext.user.uid && (userDocData.userId === firebaseContext.user.uid)) {
        setViewOnly(false);
      }
    }
  }, [firebaseContext.user, firebaseContext.authStateLoading]);

  const renderBannerSystem = () => {
    if (!systemsByUser.length) return;

    let featuredSystem;
    for (const systemDocData of systemsByUser) {
      const systemStars = systemDocData.stars || 0;
      const featuredStars = featuredSystem && featuredSystem.stars || 0;
      if (!featuredSystem || systemStars > featuredStars) {
        featuredSystem = systemDocData;
      } else if (systemStars === featuredStars && systemDocData.lastUpdated > featuredSystem.lastUpdated) {
        featuredSystem = systemDocData;
      }
    }

    return <div className="User-bannerSystem">
      <Result viewData={featuredSystem} isFeature={true} isOnProfile={true} key={featuredSystem.systemId} />
    </div>;
  }

  const renderSystemPreview = (systemDocData) => {
    return <li className="User-systemPreview" key={systemDocData.systemId}>
      <Result viewData={systemDocData} isOnProfile={true} key={systemDocData.systemId} />
    </li>;
  }

  const renderAllSystems = () => {
    if (!systemsByUser.length) {
      return <div className="User-noSystems">
        None yet!
      </div>;
    };

    let systemElems = systemsByUser.map(renderSystemPreview);
  
    return <ol className="User-systems">
      {systemElems}
    </ol>;
  }

  return <Theme>
    <Header onToggleShowSettings={onToggleShowSettings} onToggleShowAuth={onToggleShowAuth} />
    <Drawer onToggleShowAuth={onToggleShowAuth} />

    <main className="User">
      {renderBannerSystem()}

      <div className="User-title">
        <i className="fa-solid fa-user"></i>
        <Title title={userDocData.displayName} viewOnly={viewOnly} fallback={'Anon'} />
      </div>

      {renderAllSystems()}
    </main>

    <Footer onToggleShowMission={onToggleShowMission} />
  </Theme>;
}
