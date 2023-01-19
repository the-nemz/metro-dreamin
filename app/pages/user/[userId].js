import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';

import { FirebaseContext, getUserDocData } from '/lib/firebase.js';

import { Drawer } from '/components/Drawer.js';
import { Header } from '/components/Header.js';
import { Footer } from '/components/Footer.js';
import { Theme } from '/components/Theme.js';
import { Title } from '/components/Title.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export async function getServerSideProps({ params }) {
  const { userId } = params;

  if (userId) {
    try {
      const userDocData = await getUserDocData(userId) ?? null;

      if (!userDocData) {
        return { notFound: true };
      }

      return { props: { userDocData } };
    } catch (e) {
      console.log('Unexpected Error:', e);
      return { notFound: true };
    }
  }

  return { props: { notFound: true } };
}

export default function View({
                              userDocData = {},
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

  return <Theme>
    <Header onToggleShowSettings={onToggleShowSettings} onToggleShowAuth={onToggleShowAuth} />
    <Drawer onToggleShowAuth={onToggleShowAuth} />

    <main className="User">
      <Title title={userDocData.displayName} viewOnly={viewOnly} fallback={'Anon'} />
    </main>

    <Footer onToggleShowMission={onToggleShowMission} />
  </Theme>;
}
