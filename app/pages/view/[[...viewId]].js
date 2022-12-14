import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';

import { FirebaseContext, getUserDocData, getSystemDocData, getViewDocData } from '/lib/firebase.js';
import { useTheme } from '/lib/hooks.js';
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
        const systemDocData = await getSystemDocData(ownerUid, systemId) ?? null;
        const viewDocData = await getViewDocData(viewId[0]) ?? null;
        const doesNotExist = !systemDocData || !viewDocData;

        if (doesNotExist) {
          return { notFound: true };
        }

        return { props: { ownerDocData, systemDocData, viewDocData } };
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
                              viewDocData = {},
                              onToggleShowSettings = () => {},
                              onToggleShowAuth = () => {},
                            }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);
  const { themeClass } = useTheme();

  const [system, setSystem] = useState(INITIAL_SYSTEM);
  const [meta, setMeta] = useState(INITIAL_META);
  const [interlineSegments, setInterlineSegments] = useState({});
  const [changing, setChanging] = useState({ all: 1 }); // only chnaged when theme is updated
  // const [windowDims, setWindowDims] = useState({ width: window.innerWidth || 0, height: window.innerHeight || 0 });

  useEffect(() => {
    setSystemFromDocument(systemDocData);
  }, []);

  useEffect(() => {
    if (!firebaseContext.authStateLoading) {
      if (ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid)) {
        // is user's map; redirect to /edit/:viewId
        router.replace(getEditPath(ownerDocData.userId, viewDocData.systemId))
      }
    }
  }, [firebaseContext.authStateLoading]);

  const setSystemFromDocument = (systemDocData) => {
    if (systemDocData && systemDocData.map) {
      systemDocData.map.manualUpdate = 1; // add the newly loaded system to the history
      setSystem(systemDocData.map);
      setMeta({
        systemId: systemDocData.systemId,
        nextLineId: systemDocData.nextLineId,
        nextStationId: systemDocData.nextStationId
      });
      setInterlineSegments(buildInterlineSegments(systemDocData.map, Object.keys(systemDocData.map.lines)));
    }
  }

  const mainClass = `Edit SystemWrap ${themeClass}`
  return (
    <main className={mainClass}>
      <System ownerDocData={ownerDocData}
              systemDocData={systemDocData}
              viewDocData={viewDocData}
              system={system}
              meta={meta}
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
