import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga4';
import mapboxgl from 'mapbox-gl';
import ReactTooltip from 'react-tooltip';

import { FirebaseContext, getUserDocData, getSystemDocData, getFullSystem, getUrlForBlob } from '/lib/firebase.js';
import { getEditPath, buildInterlineSegments, getTransfersForStation, getSystemBlobId } from '/lib/util.js';
import { INITIAL_SYSTEM, INITIAL_META } from '/lib/constants.js';

import { Header } from '/components/Header.js';
import { Footer } from '/components/Footer.js';
import { Metatags } from '/components/Metatags.js';
import { System } from '/components/System.js';
import { Theme } from '/components/Theme.js';

mapboxgl.accessToken = 'pk.eyJ1IjoiaWpuZW16ZXIiLCJhIjoiY2xma3B0bW56MGQ4aTQwczdsejVvZ2cyNSJ9.FF2XWl1MkT9OUVL_HBJXNQ';

export async function getServerSideProps({ params }) {
  const { systemId } = params;

  if (systemId) {
    try {
      const decodedId = Buffer.from(systemId, 'base64').toString('ascii');
      const decodedIdParts = decodedId.split('|');
      const ownerUid = decodedIdParts[0];
      const systemNumStr = decodedIdParts[1];

      if (ownerUid && systemNumStr) {
        // TODO: make a promise group for these
        const systemDocData = await getSystemDocData(systemId) ?? null;
        const fullSystem = await getFullSystem(systemId) ?? null;

        if (!systemDocData || !fullSystem || !fullSystem.meta) {
          return { notFound: true };
        }

        // TODO: make a promise group for these
        const ownerDocData = await getUserDocData(ownerUid) ?? null;
        const thumbnail = await getUrlForBlob(getSystemBlobId(systemId)) ?? null;

        return { props: { ownerDocData, systemDocData, fullSystem, thumbnail } };
      }

      return { notFound: true };
    } catch (e) {
      console.log('view/[systemId] error:', e);
      return { notFound: true };
    }
  }

  return { notFound: true };
}

export default function View({
                              ownerDocData = {},
                              systemDocData = {},
                              fullSystem = {},
                              thumbnail = null,
                              onToggleShowSettings = () => {},
                              onToggleShowAuth = () => {},
                              onToggleShowMission = () => {},
                              onToggleShowContribute = () => {},
                            }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [system, setSystem] = useState(INITIAL_SYSTEM);
  const [meta, setMeta] = useState(INITIAL_META);
  const [interlineSegments, setInterlineSegments] = useState({});
  const [interchangesByStationId, setInterchangesByStationId] = useState({});
  const [transfersByStationId, setTransfersByStationId] = useState({});
  const [changing, setChanging] = useState({ all: 1 }); // only changed when theme is updated
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setSystemFromData(fullSystem);
  }, []);

  useEffect(() => {
    if (!firebaseContext.authStateLoading) {
      if (ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid)) {
        // is user's map; redirect to /edit/:systemId
        router.replace(getEditPath(ownerDocData.userId, systemDocData.systemNumStr));

        ReactGA.event({
          category: 'View',
          action: 'Redirect to Edit'
        });
      }
    }
  }, [firebaseContext.user, firebaseContext.authStateLoading]);

  const setSystemFromData = (fullSystem) => {
    if (fullSystem && fullSystem.map && fullSystem.meta) {
      setMeta(fullSystem.meta);

      fullSystem.map.manualUpdate = 1; // add the newly loaded system to the history
      setSystem(fullSystem.map);

      const lines = fullSystem.map.lines || {};
      const stations = fullSystem.map.stations || {};
      const interchanges = fullSystem.map.interchanges || {};

      const stopsByLineId = {};
      for (const lineId in lines) {
        stopsByLineId[lineId] = lines[lineId].stationIds.filter(sId => stations[sId] &&
                                                                       !stations[sId].isWaypoint &&
                                                                       !(lines[lineId].waypointOverrides || []).includes(sId));
      }

      let updatedTransfersByStationId = {};
      for (const stationId in stations) {
        updatedTransfersByStationId[stationId] = getTransfersForStation(stationId, lines, stopsByLineId);
      }
      setTransfersByStationId(updatedTransfersByStationId);

      let updatedInterchangesByStationId = {};
      for (const interchange of Object.values(interchanges)) {
        let lineIds = new Set();
        for (const stationId of interchange.stationIds) {
          (updatedTransfersByStationId[stationId]?.onLines ?? [])
            .forEach(transfer => {
              if (!transfer.isWaypointOverride && transfer?.lineId) {
                lineIds.add(transfer.lineId);
              }
            });
        }

        const hasLines = Array.from(lineIds);
        for (const stationId of interchange.stationIds) {
          updatedInterchangesByStationId[stationId] = { ...interchange, hasLines };
        }
      }
      setInterchangesByStationId(updatedInterchangesByStationId);

      setInterlineSegments(buildInterlineSegments(fullSystem.map, Object.keys(lines)));
    }
  }

  const handleSetToast = (message) => {
    setToast(message);

    setTimeout(() => {
      setToast(null);
    }, 2000);
  }

  return <Theme>
    <Metatags thumbnail={thumbnail} systemDocData={systemDocData} title={fullSystem.map.title}
              description={`${fullSystem.map.title} | MetroDreamin\' map by ${ownerDocData.displayName ? ownerDocData.displayName : 'Anon'}`} />
    <Header onToggleShowSettings={onToggleShowSettings} onToggleShowAuth={onToggleShowAuth} />

    <main className="Edit">
      <System ownerDocData={ownerDocData}
              systemDocData={systemDocData}
              system={system}
              meta={meta}
              thumbnail={thumbnail}
              isPrivate={systemDocData.isPrivate || false}
              interlineSegments={interlineSegments}
              interchangesByStationId={interchangesByStationId}
              transfersByStationId={transfersByStationId}
              viewOnly={true}
              changing={changing}
              toast={toast}
              preToggleMapStyle={() => setChanging({})}
              onToggleMapStyle={() => setChanging(currChanging => {
                const allValue = currChanging.all ? currChanging.all : 1;
                return { all: allValue + 1 };
              })}
              onToggleShowAuth={onToggleShowAuth}
              onToggleShowSettings={onToggleShowSettings}
              handleSetToast={handleSetToast} />
    </main>

    {!firebaseContext.authStateLoading && <ReactTooltip delayShow={400} border={true} type={firebaseContext.settings.lightMode ? 'light' : 'dark'} />}
    <Footer onToggleShowMission={onToggleShowMission} onToggleShowContribute={onToggleShowContribute} />
  </Theme>;
}
