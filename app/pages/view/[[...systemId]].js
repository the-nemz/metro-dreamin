import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';

import { FirebaseContext, getUserDocData, getSystemDocData, getFullSystem, getUrlForBlob } from '/lib/firebase.js';
import { getEditPath, buildInterlineSegments } from '/lib/util.js';
import { INITIAL_SYSTEM, INITIAL_META } from '/lib/constants.js';

import { Header } from '/components/Header.js';
import { System } from '/components/System.js';
import { Theme } from '/components/Theme.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export async function getServerSideProps({ params }) {
  const { systemId } = params;

  if (systemId && systemId[0]) {
    try {
      const decodedId = Buffer.from(systemId[0], 'base64').toString('ascii');
      const decodedIdParts = decodedId.split('|');
      const ownerUid = decodedIdParts[0];
      const systemNumStr = decodedIdParts[1];

      if (ownerUid && systemNumStr) {
        // TODO: make a promise group for these
        const systemDocData = await getSystemDocData(systemId[0]) ?? null;
        const fullSystem = await getFullSystem(systemId[0]) ?? null;

        if (!systemDocData || !fullSystem || !fullSystem.meta) {
          return { notFound: true };
        }

        // TODO: make a promise group for these
        const ownerDocData = await getUserDocData(ownerUid) ?? null;
        const thumbnail = await getUrlForBlob(`${systemId[0]}.png`) ?? null;

        return { props: { ownerDocData, systemDocData, fullSystem, thumbnail } };
      }

      return { notFound: true };
    } catch (e) {
      console.log('Unexpected Error:', e);
      return { notFound: true };
    }
  }

  return { props: { notFound: true } };
}

export default function View({
                              ownerDocData = {},
                              systemDocData = {},
                              fullSystem = {},
                              thumbnail = null,
                              onToggleShowSettings = () => {},
                              onToggleShowAuth = () => {},
                            }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [system, setSystem] = useState(INITIAL_SYSTEM);
  const [meta, setMeta] = useState(INITIAL_META);
  const [interlineSegments, setInterlineSegments] = useState({});
  const [changing, setChanging] = useState({ all: 1 }); // only changed when theme is updated
  // const [windowDims, setWindowDims] = useState({ width: window.innerWidth || 0, height: window.innerHeight || 0 });

  useEffect(() => {
    setSystemFromData(fullSystem);
  }, []);

  useEffect(() => {
    if (!firebaseContext.authStateLoading) {
      if (ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid)) {
        // is user's map; redirect to /edit/:systemId
        router.replace(getEditPath(ownerDocData.userId, systemDocData.systemNumStr))
      }
    }
  }, [firebaseContext.user, firebaseContext.authStateLoading]);

  const setSystemFromData = (fullSystem) => {
    if (fullSystem && fullSystem.map && fullSystem.meta) {
      setMeta(fullSystem.meta);

      fullSystem.map.manualUpdate = 1; // add the newly loaded system to the history
      setSystem(fullSystem.map);

      setInterlineSegments(buildInterlineSegments(fullSystem.map, Object.keys(fullSystem.map.lines)));
    }
  }

  return <Theme>
    <Header onToggleShowSettings={onToggleShowSettings} onToggleShowAuth={onToggleShowAuth} />

    <main className="Edit SystemWrap">
      <System ownerDocData={ownerDocData}
              systemDocData={systemDocData}
              system={system}
              meta={meta}
              thumbnail={thumbnail}
              isPrivate={systemDocData.isPrivate || false}
              interlineSegments={interlineSegments}
              viewOnly={true}
              changing={changing}
              preToggleMapStyle={() => setChanging({})}
              onToggleMapStyle={() => setChanging(currChanging => {
                const allValue = currChanging.all ? currChanging.all : 1;
                return { all: allValue + 1 };
              })}
              onToggleShowAuth={onToggleShowAuth}
              onToggleShowSettings={onToggleShowSettings} />
    </main>
  </Theme>;
}
