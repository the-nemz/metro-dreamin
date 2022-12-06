import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
// import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';

import { FirebaseContext } from '/lib/firebaseContext.js';
import { getUserDocData, getSystemDocData, getViewDocData } from '/lib/firebase.js';
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
        const ownerDocData = await getUserDocData(ownerUid);
        const systemDocData = await getSystemDocData(ownerUid, systemId);
        const viewDocData = await getViewDocData(viewId[0]);
        return { props: { ownerDocData, systemDocData, viewDocData } };
      }
      return { props: {} };
    } catch (e) {
      console.log('Unexpected Error:', e);
      // TODO: redirect to /view or /explore
      return { props: {} };
    }
  }

  return { props: {} };
}

export default function View({ ownerDocData, systemDocData, viewDocData }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [system, setSystem] = useState(INITIAL_SYSTEM);
  const [meta, setMeta] = useState(INITIAL_META);
  const [interlineSegments, setInterlineSegments] = useState({});
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

  const setupSignIn = () => {
    window.alert('TODO: sign up');
  }

  const mainClass = `Edit SystemWrap ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <main className={mainClass}>
      <System ownerDocData={ownerDocData}
              systemDocData={systemDocData}
              viewDocData={viewDocData}
              system={system}
              meta={meta}
              interlineSegments={interlineSegments}
              viewOnly={true} />
    </main>
  );
}
