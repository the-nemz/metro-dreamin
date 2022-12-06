import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
// import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';

import { FirebaseContext } from '/lib/firebaseContext.js';
import { getUserDocData, getSystemDocData, getViewDocData } from '/lib/firebase.js';
import {
  sortSystems,
  getViewPath,
  getViewURL,
  getViewId,
  getEditPath,
  getDistance,
  addAuthHeader,
  buildInterlineSegments,
  diffInterlineSegments
} from '/lib/util.js';
import {
  INITIAL_SYSTEM,
  INITIAL_META,
  DEFAULT_LINES,
  MAX_HISTORY_SIZE,
  FLY_TIME
} from '/lib/constants.js';

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

export default function NewView({ ownerDocData, systemDocData, viewDocData }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [system, setSystem] = useState(INITIAL_SYSTEM);
  const [meta, setMeta] = useState(INITIAL_META);
  const [changing, setChanging] = useState({ all: true });
  const [interlineSegments, setInterlineSegments] = useState({});
  const [segmentUpdater, setSegmentUpdater] = useState(0);
  // const [windowDims, setWindowDims] = useState({ width: window.innerWidth || 0, height: window.innerHeight || 0 });

  useEffect(() => {
    setSystemFromDocument(systemDocData);
  }, []);

  // useEffect(() => {
  //   setViewOnly(!(ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid)))
  // }, [firebaseContext.user, firebaseContext.authStateLoading, ownerDocData]);

  useEffect(() => {
    if (!firebaseContext.authStateLoading) {
      if (ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid)) {
        // is user's map; redirect to /edit/:viewId
        router.replace(getEditPath(ownerDocData.userId, viewDocData.systemId))
      }
    }
  }, [firebaseContext.authStateLoading]);

  useEffect(() => {
    setInterlineSegments(currSegments => {
      const newSegments = buildInterlineSegments(system, Object.keys(system.lines));
      setChanging(currChanging => {
        currChanging.segmentKeys = diffInterlineSegments(currSegments, newSegments);
        return currChanging;
      })
      setInterlineSegments(newSegments);
    });
  }, [segmentUpdater]);

  const refreshInterlineSegments = () => {
    setSegmentUpdater(currCounter => currCounter + 1);
  }

  const setSystemFromDocument = (systemDocData) => {
    if (systemDocData && systemDocData.map) {
      systemDocData.map.manualUpdate = 1; // add the newly loaded system to the history
      setSystem(systemDocData.map);
      setMeta({
        systemId: systemDocData.systemId,
        nextLineId: systemDocData.nextLineId,
        nextStationId: systemDocData.nextStationId
      });
      refreshInterlineSegments();
    }
  }

  const setupSignIn = () => {
    window.alert('TODO: sign up');
  }

  const handleToggleMapStyle = (map, style) => {
    map.setStyle(style);

    map.once('styledata', () => {
      setChanging({ all: true });
    });

    setChanging({});
  }

  return <System
            ownerDocData={ownerDocData}
            systemDocData={systemDocData}
            viewDocData={viewDocData}
            system={system}
            meta={meta}
            interlineSegments={interlineSegments}
            viewOnly={true} />
}
