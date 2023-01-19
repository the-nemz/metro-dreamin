import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import { doc, collectionGroup, query, where, orderBy, getDocs, getDoc } from 'firebase/firestore';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';
import classNames from 'classnames';

import { FirebaseContext, getUserDocData, getSystemsByUser } from '/lib/firebase.js';

import { Drawer } from '/components/Drawer.js';
import { Header } from '/components/Header.js';
import { Footer } from '/components/Footer.js';
import { Metatags } from '/components/Metatags.js';
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
      const publicSystemsByUser = systemsByUser.filter(s => !s.isPrivate);

      if (!userDocData) {
        return { notFound: true };
      }

      return { props: { userDocData, publicSystemsByUser } };
    } catch (e) {
      console.log('Unexpected Error:', e);
      return { notFound: true };
    }
  }

  return { props: { notFound: true } };
}

export default function User({
                              userDocData = {},
                              publicSystemsByUser = [],
                              onToggleShowSettings = () => {},
                              onToggleShowAuth = () => {},
                              onToggleShowMission = () => {},
                            }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [viewOnly, setViewOnly] = useState(true);
  const [showStars, setShowStars] = useState(false);
  const [starredSystems, setStarredSystems] = useState();

  useEffect(() => {
    try {
      const starsQuery = query(collectionGroup(firebaseContext.database, 'stars'),
                               where('userId', '==', userDocData.userId));
      getDocs(starsQuery).then((starDocs) => {
        const promises = [];
        starDocs.forEach((starDoc) => {
          const sysDoc = doc(firebaseContext.database, `systems/${starDoc.data().systemId}`);
          promises.push(getDoc(sysDoc));
        });
  
        Promise.all(promises).then((systemDocs) => {
          let systemDatas = [];
          for (const systemDoc of systemDocs) {
            const systemDocData = systemDoc.data();
            if (!systemDocData.isPrivate) systemDatas.push(systemDoc.data());
          }
          setStarredSystems(systemDatas);
        });
      });
    } catch (e) {
      console.log('getUserStars error:', e);
    }
  }, [])

  useEffect(() => {
    if (!firebaseContext.authStateLoading) {
      if (userDocData.userId && firebaseContext.user && firebaseContext.user.uid && (userDocData.userId === firebaseContext.user.uid)) {
        setViewOnly(false);
      }
    }
  }, [firebaseContext.user, firebaseContext.authStateLoading]);

  const renderBannerSystem = () => {
    if (!publicSystemsByUser.length) return;

    let featuredSystem;
    for (const systemDocData of publicSystemsByUser) {
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

  const renderStarPreview = (systemDocData) => {
    return <li className="User-systemPreview" key={systemDocData.systemId}>
      <Result viewData={systemDocData} key={systemDocData.systemId} />
    </li>;
  }

  const renderAllSystems = () => {
    if (!publicSystemsByUser.length) {
      return <div className={classNames('User-noSystems', { 'User-noSystems--hidden': showStars })}>
        None yet!
      </div>;
    };

    let systemElems = publicSystemsByUser.map(renderSystemPreview);
  
    return <ol className={classNames('User-systems', { 'User-systems--hidden': showStars })}>
      {systemElems}
    </ol>;
  }

  const renderStarredSystems = () => {
    if (!starredSystems) return;

    if (!starredSystems.length) {
      return <div className={classNames('User-noStars', { 'User-noStars--hidden': !showStars })}>
        None yet!
      </div>;
    };

    let systemElems = starredSystems.map(renderStarPreview);
  
    return <ol className={classNames('User-starredSystems', { 'User-starredSystems--hidden': !showStars })}>
      {systemElems}
    </ol>;
  }

  const renderTabs = () => {
    return (
      <div className="User-tabs">
        <button className={classNames('User-tab', 'User-tab--ownSystems', { 'User-tab--active': !showStars })}
                onClick={() => setShowStars(false)}>
          Maps
        </button>
        <button className={classNames('User-tab', 'User-tab--starredSystems', { 'User-tab--active': showStars })}
                onClick={() => setShowStars(true)}>
          Starred Maps
        </button>
      </div>
    );
  }

  return <Theme>
    <Metatags title={userDocData.displayName ? userDocData.displayName : 'Anon'} />
    <Header onToggleShowSettings={onToggleShowSettings} onToggleShowAuth={onToggleShowAuth} />
    <Drawer onToggleShowAuth={onToggleShowAuth} />

    <main className="User">
      {renderBannerSystem()}

      <div className="User-title">
        <i className="fa-solid fa-user"></i>
        <Title title={userDocData.displayName} viewOnly={viewOnly} fallback={'Anon'} />
      </div>

      {renderTabs()}

      {renderAllSystems()}
      {renderStarredSystems()}
    </main>

    <Footer onToggleShowMission={onToggleShowMission} />
  </Theme>;
}
