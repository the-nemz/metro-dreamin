import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga4';
import mapboxgl from 'mapbox-gl';

import { FirebaseContext, getUserDocData, getSystemDocData, getFullSystem, getUrlForBlob } from '/lib/firebase.js';
import { getEditPath, buildInterlineSegments, getTransfersForStation, getSystemBlobId } from '/lib/util.js';
import { INITIAL_SYSTEM, INITIAL_META } from '/lib/constants.js';

import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
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
                              onToggleShowConduct = () => {}
                            }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [system, setSystem] = useState(INITIAL_SYSTEM);
  const [meta, setMeta] = useState(INITIAL_META);
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

  useEffect(() => {
    if (firebaseContext.checkBidirectionalBlocks(ownerDocData.userId)) {
      // user is blocked; go home
      router.replace('/explore');

      ReactGA.event({
        category: 'View',
        action: 'Redirect to Explore'
      });
    }
  }, [firebaseContext.checkBidirectionalBlocks]);

  const setSystemFromData = (fullSystem) => {
    if (fullSystem && fullSystem.map && fullSystem.meta) {
      setMeta(fullSystem.meta);

      const systemFromData = { ...fullSystem.map };
      systemFromData.manualUpdate = 1; // add the newly loaded system to the history

      const lines = systemFromData.lines || {};
      const stations = systemFromData.stations || {};
      const interchanges = systemFromData.interchanges || {};

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
      systemFromData.transfersByStationId = updatedTransfersByStationId;

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
      systemFromData.interchangesByStationId = updatedInterchangesByStationId;

      systemFromData.interlineSegments = { ...buildInterlineSegments(systemFromData) };

      setSystem(systemFromData);
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
              commentsLocked={systemDocData.commentsLocked || false}
              viewOnly={true}
              toast={toast}
              preToggleMapStyle={() => {
                setSystem(currSystem => {
                  const updatedSystem = { ...currSystem };
                  updatedSystem.changing = {};
                  return updatedSystem;
                })
              }}
              triggerAllChanged={() => {
                setSystem(currSystem => {
                  const updatedSystem = { ...currSystem };
                  const allValue = updatedSystem.changing?.all ? updatedSystem.changing.all : 1;
                  updatedSystem.changing = { all: allValue + 1 };
                  return updatedSystem;
                })
              }}
              postChangingAll={() => {
                setSystem(currSystem => {
                  const updatedSystem = { ...currSystem };
                  if (updatedSystem.changing && updatedSystem.changing.all) {
                    delete updatedSystem.changing.all;
                  }
                  return updatedSystem;
                })
              }}
              onToggleShowAuth={onToggleShowAuth}
              onToggleShowSettings={onToggleShowSettings}
              handleSetToast={handleSetToast} />
    </main>

    <Footer onToggleShowMission={onToggleShowMission}
            onToggleShowContribute={onToggleShowContribute}
            onToggleShowConduct={onToggleShowConduct} />
  </Theme>;
}
