import React, { useState, useEffect, useContext, useRef } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga4';
import mapboxgl from 'mapbox-gl';
import requestIp from 'request-ip';

import { FirebaseContext, getUserDocData, getSystemDocData, getFullSystem, getUrlForBlob } from '/util/firebase.js';
import {
  getEditPath,
  buildInterlineSegments,
  diffInterlineSegments,
  getTransfersFromWorker,
  getSystemBlobId,
  getMode
} from '/util/helpers.js';
import { INITIAL_SYSTEM, INITIAL_META, DEFAULT_LINE_MODE } from '/util/constants.js';

import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
import { Metatags } from '/components/Metatags.js';
import { Schema } from '/components/Schema.js';
import { System } from '/components/System.js';
import { Theme } from '/components/Theme.js';

mapboxgl.accessToken = 'pk.eyJ1IjoiaWpuZW16ZXIiLCJhIjoiY2xma3B0bW56MGQ4aTQwczdsejVvZ2cyNSJ9.FF2XWl1MkT9OUVL_HBJXNQ';

const BANNED_IPS = new Set(process.env.NEXT_SERVER_VIEW_BANNED_IPS ?
                           process.env.NEXT_SERVER_VIEW_BANNED_IPS.split(',') :
                           []);

export async function getServerSideProps({ req, params }) {
  const { systemId } = params;

  if (systemId) {
    try {
      const ip = requestIp.getClientIp(req);
      if (BANNED_IPS.has(ip)) {
        return {
          redirect: {
            destination: '/403',
            permanent: false
          }
        }
      }
    } catch (e) {
      console.log('view/[systemId] ip error:', e);
    }

    try {
      const decodedId = Buffer.from(systemId, 'base64').toString('ascii');
      const decodedIdParts = decodedId.split('|');
      const ownerUid = decodedIdParts[0];
      const systemNumStr = decodedIdParts[1];

      if (ownerUid && systemNumStr) {
        // TODO: make a promise group for these
        const systemDocData = await getSystemDocData(systemId) ?? null;
        const fullSystem = await getFullSystem(systemId, { trimLargeSystems: true }) ?? null;

        if (!systemDocData || !fullSystem || !fullSystem.meta) {
          return { notFound: true };
        }

        if (!('numModes' in systemDocData) && fullSystem?.map?.lines) {
          const modeSet = new Set();
          for (const line of Object.values(fullSystem?.map?.lines ?? {})) {
            modeSet.add(line.mode ? line.mode : DEFAULT_LINE_MODE);
          }
          systemDocData.numModes = modeSet.size;
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
                              onToggleShowEmailVerification = () => {},
                              onToggleShowMission = () => {},
                              onToggleShowContribute = () => {},
                              onToggleShowConduct = () => {}
                            }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [system, setSystem] = useState(INITIAL_SYSTEM);
  const [meta, setMeta] = useState(INITIAL_META);
  const [systemLoaded, setSystemLoaded] = useState(false);
  const [groupsDisplayed, setGroupsDisplayed] = useState(); // null means all
  const [toast, setToast] = useState(null);

  const transfersWorker = useRef();

  useEffect(() => {
    let workerInstance = new Worker(new URL('../../workers/transfers.js', import.meta.url), { type: 'module' });
    transfersWorker.current = workerInstance;

    setSystemFromData(fullSystem, systemDocData.systemId);

    return () => {
      if (workerInstance) {
        workerInstance.terminate();
      }
    }
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

  useEffect(() => {
    if (!groupsDisplayed) return;

    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };

      const { updatedInterlineSegments, diffSegmentKeys } = refreshInterlineSegments(updatedSystem);
      updatedSystem.interlineSegments = updatedInterlineSegments;

      updatedSystem.changing = {
        lineKeys: Object.keys(updatedSystem.lines || {}),
        stationIds: Object.keys(updatedSystem.stations || {}),
        interchangeIds: Object.keys(updatedSystem.interchanges || {}),
        segmentKeys: diffSegmentKeys
      };

      return updatedSystem;
    });
  }, [groupsDisplayed]);

  const setSystemFromData = async (fullSystem, systemId) => {
    let systemFromData = {};
    if (fullSystem && fullSystem.map && fullSystem.map.systemIsTrimmed) {
      setSystem(currSystem => {
        const updatedSystem = { ...currSystem };
        updatedSystem.systemIsTrimmed = true;
        return updatedSystem;
      });

      const bigSystemData = await getFullSystem(systemId);
      if (bigSystemData.map) {
        systemFromData = { ...bigSystemData.map };
      } else {
        throw 'Unexpected error loading large system';
      }
    } else if (fullSystem && fullSystem.map) {
      systemFromData = { ...fullSystem.map };
    }

    if (fullSystem && fullSystem.meta && systemFromData) {
      setMeta(fullSystem.meta);

      systemFromData.manualUpdate = 1; // add the newly loaded system to the history

      const lines = systemFromData.lines || {};
      const stations = systemFromData.stations || {};
      const interchanges = systemFromData.interchanges || {};

      let updatedTransfersByStationId = {};
      try {
        const dataFromTransfersWorker = await getTransfersFromWorker(transfersWorker?.current, { lines, stations });
        updatedTransfersByStationId = dataFromTransfersWorker?.transfersByStationId ?? {};
      } catch (e) {
        console.error('Unexpected error getting transfers', e);
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

      const allValue = system.changing?.all ? system.changing.all : 1;
      systemFromData.changing = { all: allValue + 1 };

      setSystem(systemFromData);
      setSystemLoaded(true);
    }
  }

  const refreshInterlineSegments = (currSystem) => {
    const currLineKeys = Object.keys(currSystem.lines || {});
    if (!currLineKeys.length) return {};

    if (groupsDisplayed) {
      const groupsDisplayedSet = new Set(groupsDisplayed || []);
      const linesDisplayed = Object.values(system?.lines ?? {})
                                  .filter(line => !groupsDisplayed ||
                                                  groupsDisplayedSet.has(line.lineGroupId ?
                                                                         line.lineGroupId :
                                                                         getMode(line.mode).key))
                                  .map(l => l.id);

      const filteredLines = {};
      linesDisplayed.forEach((lineKey) => {
        filteredLines[lineKey] = currSystem.lines[lineKey];
      });

      const updatedInterlineSegments = { ...buildInterlineSegments({ ...currSystem, lines: filteredLines }) };
      const diffSegmentKeys = diffInterlineSegments(currSystem.interlineSegments || {}, updatedInterlineSegments);
      return { updatedInterlineSegments, diffSegmentKeys };
    } else {
      const updatedInterlineSegments = { ...buildInterlineSegments(currSystem) };
      const diffSegmentKeys = diffInterlineSegments(currSystem.interlineSegments || {}, updatedInterlineSegments);
      return { updatedInterlineSegments, diffSegmentKeys };
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

    <main className="View" itemScope itemType="https://schema.org/Article">
      <System ownerDocData={ownerDocData}
              initialSystemDocData={systemDocData}
              system={system}
              meta={meta}
              systemLoaded={systemLoaded}
              thumbnail={thumbnail}
              isPrivate={systemDocData.isPrivate || false}
              scoreIsHidden={systemDocData.scoreIsHidden || false}
              commentsLocked={systemDocData.commentsLocked || false}
              groupsDisplayed={groupsDisplayed}
              viewOnly={true}
              toast={toast}
              onToggleShowAuth={onToggleShowAuth}
              onToggleShowEmailVerification={onToggleShowEmailVerification}
              onToggleShowSettings={onToggleShowSettings}
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
              setGroupsDisplayed={setGroupsDisplayed}
              handleSetToast={handleSetToast} />

      <Schema ownerDocData={ownerDocData} systemDocData={systemDocData} fullSystem={fullSystem} thumbnail={thumbnail} />
    </main>

    <Footer onToggleShowMission={onToggleShowMission}
            onToggleShowContribute={onToggleShowContribute}
            onToggleShowConduct={onToggleShowConduct} />
  </Theme>;
}
