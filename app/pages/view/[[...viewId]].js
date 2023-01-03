import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';

import { FirebaseContext, getUserDocData, getSystemDocData, getFullSystem } from '/lib/firebase.js';
import { getEditPath, buildInterlineSegments } from '/lib/util.js';
import { INITIAL_SYSTEM, INITIAL_META } from '/lib/constants.js';

import { System } from '/components/System.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export async function getServerSideProps({ params }) {
  const { viewId } = params;

  if (viewId && viewId[0]) {
    try {
      const decodedId = Buffer.from(viewId[0], 'base64').toString('ascii');
      const decodedIdParts = decodedId.split('|');
      const ownerUid = decodedIdParts[0];
      const systemId = decodedIdParts[1];

      if (ownerUid && systemId) {
        // TODO: make a promise group for these
        const ownerDocData = await getUserDocData(ownerUid) ?? null;
        const systemDocData = await getSystemDocData(viewId) ?? null;
        const fullSystem = await getFullSystem(viewId) ?? null;

        if (!systemDocData || !fullSystem || !fullSystem.meta) {
          return { notFound: true };
        }

        return { props: { ownerDocData, systemDocData, fullSystem } };
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
                              onToggleShowSettings = () => {},
                              onToggleShowAuth = () => {},
                            }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [system, setSystem] = useState(INITIAL_SYSTEM);
  const [meta, setMeta] = useState(INITIAL_META);
  const [interlineSegments, setInterlineSegments] = useState({});
  const [changing, setChanging] = useState({ all: 1 }); // only chnaged when theme is updated
  // const [windowDims, setWindowDims] = useState({ width: window.innerWidth || 0, height: window.innerHeight || 0 });

  useEffect(() => {
    setSystemFromData(fullSystem);
  }, []);

  useEffect(() => {
    if (!firebaseContext.authStateLoading) {
      if (ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid)) {
        // is user's map; redirect to /edit/:viewId
        router.replace(getEditPath(ownerDocData.userId, systemDocData.systemId))
      }
    }
  }, [firebaseContext.authStateLoading]);

  const setSystemFromData = (fullSystem) => {
    if (fullSystem && fullSystem.map && fullSystem.meta) {
      setMeta(fullSystem.meta);

      fullSystem.map.manualUpdate = 1; // add the newly loaded system to the history
      setSystem(fullSystem.map);

      setInterlineSegments(buildInterlineSegments(fullSystem.map, Object.keys(fullSystem.map.lines)));
    }
  }

  const mainClass = `Edit SystemWrap ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <main className={mainClass}>
      <System ownerDocData={ownerDocData}
              systemDocData={systemDocData}
              system={system}
              meta={meta}
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
  );
}
