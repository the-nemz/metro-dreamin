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

import { Map } from '/components/Map.js';
import { Metatags } from '/components/Metatags.js';
import { Notifications } from '/components/Notifications.js';
import { Start } from '/components/Start.js';
import { System } from '/components/System.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export async function getServerSideProps({ params }) {
  const { viewId } = params;

  if (viewId && viewId[0]) {
    console.log(viewId)
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
      return { props: {temp: 'here2'} };
    }
  }

  return { props: {temp: 'here3'} };
}

export default function NewView({ ownerDocData, systemDocData, viewDocData }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [systemDoc, setSystemDoc] = useState();
  const [mapBounds, setMapBounds] = useState();

  const [viewOnly, setViewOnly] = useState(!(ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid)))
  const [system, setSystem] = useState(INITIAL_SYSTEM);
  const [history, setHistory] = useState([]);
  const [meta, setMeta] = useState(INITIAL_META);
  const [isSaved, setIsSaved] = useState(true);
  const [waypointsHidden, setWaypointsHidden] = useState(false);
  const [focus, setFocus] = useState({});
  const [recent, setRecent] = useState({});
  const [changing, setChanging] = useState({ all: true });
  const [interlineSegments, setInterlineSegments] = useState({});
  const [alert, setAlert] = useState(null);
  const [toast, setToast] = useState(null);
  const [prompt, setPrompt] = useState();
  const [segmentUpdater, setSegmentUpdater] = useState(0);
  // const [windowDims, setWindowDims] = useState({ width: window.innerWidth || 0, height: window.innerHeight || 0 });

  const [map, setMap] = useState();

  useEffect(() => {
    setSystemFromDocument(systemDocData);

    if (false) {
      setTimeout(() => handleSetAlert('Tap the map to add a station!'), FLY_TIME - 2000);
    }
  }, []);

  // useEffect(() => {
  //   setViewOnly(!(ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid)))
  // }, [firebaseContext.user, firebaseContext.authStateLoading, ownerDocData]);

  useEffect(() => {
    if (!viewOnly && !isSaved) {
      window.onbeforeunload = function(e) {
        e.returnValue = 'You have unsaved changes to your map! Do you want to continue?';
      };
    } else {
      window.onbeforeunload = null;
    }
  }, [viewOnly, isSaved])

  useEffect(() => {
    // manualUpdate is incremented on each user-initiated change to the system
    // it is 0 (falsy) in the INITIAL_SYSTEM constant
    if (system.manualUpdate) {
      setHistory(prevHistory => {
        // do not allow for infinitely large history
        if (prevHistory.length < MAX_HISTORY_SIZE + 1) {
          return prevHistory.concat([JSON.parse(JSON.stringify(system))]);
        }
        return prevHistory.slice(-MAX_HISTORY_SIZE).concat([JSON.parse(JSON.stringify(system))]);
      });
    }
  }, [system.manualUpdate]);

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

  const handleMapInit = (map) => {
    setMap(map);
  }

  const handleHomeClick = () => {
    ReactGA.event({
      category: 'View',
      action: 'Home'
    });

    const goHome = () => {
      router.push({
        pathname: '/explore'
      });
    }

    if (!isSaved) {
      setPrompt({
        message: 'You have unsaved changes to your map. Do you want to save before leaving?',
        confirmText: 'Yes, save it!',
        denyText: 'No, do not save.',
        confirmFunc: () => {
          setPrompt(null);
          // this.handleSave(goHome);
        },
        denyFunc: () => {
          setPrompt(null);
          setIsSaved(true); // needed to skip the unload page alert
          goHome();
        }
      });
    } else {
      goHome();
    }
  }

  const handleUndo = () => {
    console.log('in handle undo')
    if (viewOnly) return;
    if (history.length < 2) {
      handleSetToast('Undo history is empty');
      return;
    };

    // go back two entries since most recent entry is current system
    const prevSystem = history[history.length - 2];

    let stationSet = new Set();
    Object.keys(system.stations).forEach(sID => stationSet.add(sID));
    Object.keys(prevSystem.stations).forEach(sID => stationSet.add(sID));

    let lineSet = new Set();
    Object.keys(system.lines).forEach(lID => lineSet.add(lID));
    Object.keys(prevSystem.lines).forEach(lID => lineSet.add(lID));

    setSystem(prevSystem);
    setHistory(currHistory => currHistory.slice(0, currHistory.length - 2));
    setChanging({
      stationIds: Array.from(stationSet),
      lineKeys: Array.from(lineSet)
    })
    setFocus({});
    refreshInterlineSegments();

    ReactGA.event({
      category: 'Action',
      action: 'Undo'
    });
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
            viewOnly={true} />
}
