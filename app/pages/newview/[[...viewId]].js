import React, { useState, useEffect, useContext } from 'react';
import { collection, doc, getDoc } from "firebase/firestore";
import Link from 'next/link';
import { useRouter } from 'next/router';
// import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';

import { FirebaseContext } from '/lib/firebaseContext.js';
import { getUserDocData, getSystemDocData, getViewDocData } from '/lib/firebase.js';
import {
  INITIAL_HISTORY, INITIAL_META,
  LOGO, LOGO_INVERTED
} from '/lib/constants.js';

import { Map } from '/components/Map.js';
import { Metatags } from '/components/Metatags.js';

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
      return { props: { ownerDocData: decodedId } };
    } catch (e) {
      console.log('Unexpected Error:', e);
      // TODO: redirect to /view or /explore
      return { props: { ownerDocData: e.message } };
    }
  }

  return { props: { ownerDocData: 'oh' } };
}

export default function View({ ownerDocData, systemDocData, viewDocData }) {
  console.log('ownerDocData', ownerDocData);
  console.log('systemDocData', systemDocData);
  console.log('viewDocData', viewDocData);

  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [meta, setMeta] = useState(INITIAL_META);
  const [waypointsHidden, setWaypointsHidden] = useState(false);
  const [focus, setFocus] = useState({});
  const [recent, setRecent] = useState({});
  const [changing, setChanging] = useState({ all: true });
  const [interlineSegments, setInterlineSegments] = useState({});
  const [alert, setAlert] = useState('');
  const [toast, setToast] = useState('');
  // const [windowDims, setWindowDims] = useState({ width: window.innerWidth || 0, height: window.innerHeight || 0 });

  useEffect(() => {
    if (systemDocData && systemDocData.map) {
      setHistory([ systemDocData.map ]);
    }
  }, []);

  // const mainClass = `Main ${this.props.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <main className="Main DarkMode">
      <Metatags title={viewDocData && viewDocData.title ? 'MetroDreamin\' | ' + viewDocData.title : null} />
      {viewDocData.title} by {ownerDocData.displayName}
    </main>
  );
}
