import React, { useState, useEffect, useContext, useRef } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga4';
import mapboxgl from 'mapbox-gl';
import { lineString as turfLineString } from '@turf/helpers';
import turfLength from '@turf/length';
import {
  rhumbBearing as turfRhumbBearing,
  rhumbDistance as turfRhumbDistance,
  midpoint as turfMidpoint
} from '@turf/turf';

import { FirebaseContext, getUserDocData, getSystemDocData, getFullSystem, getUrlForBlob } from '/util/firebase.js';
import {
  getViewPath,
  getSystemId,
  getNextSystemNumStr,
  getSystemBlobId,
  getDistance,
  normalizeLongitude,
  stationIdsToCoordinates,
  getTransfersForStation,
  getMode,
  buildInterlineSegments,
  diffInterlineSegments,
  getUserDisplayName,
  getTransfersFromWorker,
  updateLocalEditSystem,
  clearLocalEditSystem,
  getCacheClearTime,
  getCacheInvalidationTime,
  getLocalEditSystem,
  getLocalSaveTimestamp,
  updateLocalSaveTimestamp
} from '/util/helpers.js';
import { useNavigationObserver } from '/util/hooks.js';
import { Saver } from '/util/saver.js';
import { INITIAL_SYSTEM, INITIAL_META, DEFAULT_LINES, MAX_HISTORY_SIZE, DEFAULT_LINE_MODE } from '/util/constants.js';

import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
import { Metatags } from '/components/Metatags.js';
import { Schema } from '/components/Schema.js';
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
        const systemDocData = await getSystemDocData(systemId, false) ?? null;
        const fullSystem = await getFullSystem(systemId, { trimAllSystems: true, trimLargeSystems: true, failOnNotFound: false }) ?? null;

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
      console.log('edit/[systemId] error:', e);
      return { notFound: true };
    }
  }

  return { notFound: true };
}

export default function Edit({
                              ownerDocData = {},
                              systemDocData = {},
                              fullSystem = {},
                              thumbnail = null,
                              isNew = false,
                              newFromSystemId = '',
                              newMapBounds = [],
                              onToggleShowSettings = () => {},
                              onToggleShowAuth = () => {},
                              onToggleShowEmailVerification = () => {},
                              onToggleShowMission = () => {},
                              onToggleShowContribute = () => {},
                              onToggleShowConduct = () => {},
                            }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [viewOnly, setViewOnly] = useState(!isNew && !(ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid)))
  const [system, setSystem] = useState(INITIAL_SYSTEM);
  const [history, setHistory] = useState([]);
  const [meta, setMeta] = useState(INITIAL_META);
  const [systemLoaded, setSystemLoaded] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(systemDocData.isPrivate || false);
  const [scoreIsHidden, setScoreIsHidden] = useState(systemDocData.scoreIsHidden || false);
  const [commentsLocked, setCommentsLocked] = useState(systemDocData.commentsLocked || false);
  const [waypointsHidden, setWaypointsHidden] = useState((systemDocData.numWaypoints || 0) > 1000);
  const [groupsDisplayed, setGroupsDisplayed] = useState(); // null means all
  const [focus, setFocus] = useState({});
  const [recent, setRecent] = useState({});
  const [alert, setAlert] = useState(null);
  const [toast, setToast] = useState(null);
  const [prompt, setPrompt] = useState();
  const [saveProgress, setSaveProgress] = useState(null);

  const transfersWorker = useRef();
  const lastSavedSnapshot = useRef(null);

  const navigate = useNavigationObserver({
    shouldStopNavigation: !isSaved,
    onNavigate: () => {
      setPrompt({
        message: 'You have unsaved changes to your map. Do you want to save before leaving?',
        confirmText: 'Yes, save it!',
        denyText: 'No, do not save.',
        confirmFunc: async () => {
          setPrompt(null);
          handleSave(() => setTimeout(navigate, 500));

          ReactGA.event({
            category: 'Edit',
            action: 'Save Before Navigation'
          });
        },
        denyFunc: () => {
          setIsSaved(true);
          setPrompt(null);
          setTimeout(navigate, 500);

          ReactGA.event({
            category: 'Edit',
            action: 'Do Not Save Before Navigation'
          });
        }
      });
    },
  });

  useEffect(() => {
    let workerInstance = new Worker(new URL('../../workers/transfers.js', import.meta.url), { type: 'module' });
    transfersWorker.current = workerInstance;

    setSystemFromData(fullSystem, newFromSystemId ? newFromSystemId : systemDocData.systemId);

    fetch('/assets/colors.json')
      .then(response => response.json())
      .then(colors => window.mdSortedColors = colors);

    return () => {
      if (workerInstance) {
        workerInstance.terminate();
      }
    }
  }, []);

  useEffect(() => {
    if (!firebaseContext.authStateLoading) {
      if (isNew) {
        // update the systemNumStr based on existing maps for user
        let updatedSystemNumStr = getNextSystemNumStr(firebaseContext.settings);
        setMeta(currMeta => {
          currMeta.systemNumStr = updatedSystemNumStr;
          return currMeta;
        });
      } else if (!(ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid))) {
        if (firebaseContext.checkBidirectionalBlocks(ownerDocData.userId)) {
          // user is blocked; go home
          router.replace('/explore');

          ReactGA.event({
            category: 'Edit',
            action: 'Redirect to Explore'
          });
        } else {
          // not user's map; redirect to /view/:systemId
          router.replace(getViewPath(ownerDocData.userId, systemDocData.systemNumStr));

          ReactGA.event({
            category: 'Edit',
            action: 'Redirect to View'
          });
        }
      }
    }
  }, [firebaseContext.user, firebaseContext.authStateLoading, firebaseContext.settings.systemsCreated, firebaseContext.settings.systemIds]);

  useEffect(() => {
    setViewOnly(!isNew && !(ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid)))
  }, [firebaseContext.user, firebaseContext.authStateLoading, ownerDocData]);

  useEffect(() => {
    if (!viewOnly && !isSaved) {
      window.onbeforeunload = function(e) {
        e.returnValue = 'You have unsaved changes to your map! Do you want to continue?';
      };
    } else {
      window.onbeforeunload = null;
    }
  }, [viewOnly, isSaved]);

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

      // when it is set to 1, history is updated
      // when it is >= 2, manual changes have been made
      if (system.manualUpdate > 1 && !isNew) {
        updateLocalEditSystem(systemDocData?.systemId, system, meta);
      }
    }
  }, [system.manualUpdate]);

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
    if (fullSystem.map.systemIsTrimmed && systemId) {
      const localSystem = getLocalEditSystem(systemId);

      if (!isNew && localSystem?.map && localSystem?.meta &&
          localSystem?.lastUpdated && systemDocData?.lastUpdated &&
          localSystem.lastUpdated > systemDocData.lastUpdated) {

        const localSaveTimestamp = getLocalSaveTimestamp(systemId);
        if (localSaveTimestamp &&
            localSaveTimestamp > localSystem.lastUpdated &&
            (Date.now() - localSaveTimestamp) < 60_000) {
          // if it's been less than a minute since the save and the save
          // timestamp is more recent than the edit timestamp, the update probably
          // hasn't finished propagating, so quietly load data from local storage
          console.log('Quietly load system from local storage');
          // Pass isFromServer=false to NOT set baseline (server should have this data)
          // But since it's a recent save, we can trust the server has it
          await configureSystem({ ...localSystem.meta }, { ...localSystem.map }, true);
          return;
        }

        setPrompt({
          message: 'This map has unsaved changes. Continue where you left off?',
          confirmText: 'Yes, continue!',
          denyText: 'No, discard them.',
          confirmFunc: async () => {
            setPrompt(null);
            // Pass isFromServer=false to NOT set baseline - these are unsaved changes
            // This forces a full save on the next save operation
            await configureSystem({ ...localSystem.meta }, { ...localSystem.map }, false);
            setIsSaved(false);
          },
          denyFunc: async () => {
            setPrompt(null);
            await loadFullSystem(systemId);
            clearLocalEditSystem(systemId);
          }
        });
      } else {
        await loadFullSystem(systemId);
      }

      return;
    }

    if (fullSystem?.meta && fullSystem?.map) {
      await configureSystem({ ...fullSystem.meta }, { ...fullSystem.map });
    }
  }

  const loadFullSystem = async (systemId) => {
    try {
      if (!systemId) throw 'systemId is a required parameter';
      setSystem(currSystem => {
        const updatedSystem = { ...currSystem };
        updatedSystem.systemIsTrimmed = true;
        return updatedSystem;
      });

      const systemData = await getFullSystem(systemId, { failOnNotFound: false });
      if (systemData.meta && systemData.map) {
        await configureSystem({ ...systemData.meta }, { ...systemData.map });
      } else {
        throw 'Unexpected error loading system';
      }
    } catch (e) {
      console.log('loadFullSystem error:', e);
    }
  }

  // isFromServer: true when loading from Firebase, false when loading from localStorage recovery
  // When loading from localStorage recovery, we should NOT set the baseline because the server
  // doesn't have those changes yet. This prevents silent data loss on save.
  const configureSystem = async (metaFromData, systemFromData, isFromServer = true) => {
    if (metaFromData && systemFromData) {
      if (isNew) {
        // do not copy systemNumStr
        setMeta(currMeta => {
          return {
            ...metaFromData,
            systemNumStr: currMeta.systemNumStr
          }
        })
      } else {
        setMeta(metaFromData);
      }

      systemFromData.manualUpdate = 1;

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

      let updatedInterchangesByStationId = getUpdatedInterchanges(interchanges, updatedTransfersByStationId);

      systemFromData.transfersByStationId = updatedTransfersByStationId;
      systemFromData.interchangesByStationId = updatedInterchangesByStationId;

      const { updatedInterlineSegments } = refreshInterlineSegments(systemFromData);
      systemFromData.interlineSegments = updatedInterlineSegments;

      const allValue = system.changing?.all ? system.changing.all : 1;
      systemFromData.changing = { all: allValue + 1 };

      if (isNew) {
        // do not copy caption
        systemFromData.caption = '';
      } else if (isFromServer) {
        // Set baseline snapshot for granular saves ONLY when loading from server
        // Do NOT set baseline when loading from localStorage recovery, as the server
        // doesn't have those changes yet. This forces a full save on first save after recovery.
        const baselineMap = {
          lines: systemFromData.lines || {},
          stations: systemFromData.stations || {},
          interchanges: systemFromData.interchanges || {},
          lineGroups: systemFromData.lineGroups || {}
        };
        lastSavedSnapshot.current = JSON.parse(JSON.stringify(baselineMap));
      }
      // When isFromServer is false (localStorage recovery), baseline remains null,
      // which will force a full save on the next save operation

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

  const refreshTransfersForStationIds = (currSystem, stationIds) => {
    let updatedTransfersByStationId = { ...(currSystem.transfersByStationId || {}) };
    let updatedInterchangesByStationId = { ...(currSystem.interchangesByStationId || {}) };

    if (!stationIds || !stationIds.length) {
      return { updatedTransfersByStationId, updatedInterchangesByStationId };
    }

    const stopsByLineId = {};
    for (const lineId in (currSystem.lines || {})) {
      stopsByLineId[lineId] = currSystem.lines[lineId].stationIds.filter(sId => currSystem.stations?.[sId] &&
                                                                            !currSystem.stations[sId].isWaypoint &&
                                                                            !(currSystem.lines[lineId].waypointOverrides || []).includes(sId));
    }

    for (const stationId of stationIds) {
      if (stationId in (currSystem.stations || {})) {
        updatedTransfersByStationId[stationId] = getTransfersForStation(stationId, currSystem.lines || {}, stopsByLineId);
      } else {
        delete updatedTransfersByStationId[stationId];
      }
    }

    updatedInterchangesByStationId = getUpdatedInterchanges(currSystem.interchanges || {}, updatedTransfersByStationId);

    return { updatedTransfersByStationId, updatedInterchangesByStationId }
  }

  const getUpdatedInterchanges = (interchanges, transfersByStationId) => {
    let updatedInterchangesByStationId = {};
    for (const interchange of Object.values(interchanges || {})) {
      let lineIds = new Set();
      for (const stationId of interchange.stationIds) {
        (transfersByStationId[stationId]?.onLines ?? [])
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

    return updatedInterchangesByStationId;
  }

  const getOrphans = () => {
    const orphans = {
      all: [],
      stations: [],
      waypoints: []
    };

    for (const stationId in system.stations || {}) {
      let isOrphan = true;
      for (const line of Object.values(system.lines)) {
        if (line.stationIds.includes(stationId)) {
          isOrphan = false;
          break;
        }
      }

      if (stationId in (system.interchangesByStationId || {})) {
        isOrphan = false;
      }

      if (isOrphan) {
        orphans.all.push(stationId);
        if (system.stations[stationId].isWaypoint) orphans.waypoints.push(stationId);
        else orphans.stations.push(stationId);
      }
    }

    return orphans;
  }

  const getSystemWithoutOrphans = (orphanIds = []) => {
    const systemWithoutOrphans = JSON.parse(JSON.stringify(system));
    for (const orphanId of orphanIds) {
      if (orphanId in systemWithoutOrphans.stations || {}) {
        delete systemWithoutOrphans.stations[orphanId];
      }
    }
    return systemWithoutOrphans;
  }

  const performSave = async (systemToSave, metaToSave, cb) => {
    if (isSaving) {
      handleSetToast('Save is already in progress...');
      return;
    }

    const saveToastInterval = setInterval(() => handleSetToast('Still saving...'), 10000);

    try {
      setIsSaving(true);
      setSaveProgress({ status: 'saving', message: 'Saving changes...' });
      handleSetToast('Saving...');

      const systemIdToSave = getSystemId(firebaseContext.user.uid, metaToSave.systemNumStr);
      const saver = new Saver(firebaseContext,
                              systemIdToSave,
                              systemToSave,
                              metaToSave,
                              isPrivate,
                              scoreIsHidden,
                              commentsLocked,
                              systemDocData.ancestors,
                              isNew);

      // Set baseline for granular saves (existing systems only)
      // For new systems or when no baseline exists, Saver will use full save
      if (!isNew && lastSavedSnapshot.current) {
        saver.setBaseline(lastSavedSnapshot.current);
      }

      const successful = await saver.save();

      clearInterval(saveToastInterval);

      if (successful) {
        // Update baseline after successful save
        const newBaseline = {
          lines: systemToSave.lines || {},
          stations: systemToSave.stations || {},
          interchanges: systemToSave.interchanges || {},
          lineGroups: systemToSave.lineGroups || {}
        };
        lastSavedSnapshot.current = JSON.parse(JSON.stringify(newBaseline));

        setIsSaved(true);
        updateLocalSaveTimestamp(systemIdToSave);
        setSaveProgress({ status: 'success', message: 'Saved!' });
        handleSetToast('Saved!');
        setTimeout(() => setSaveProgress(null), 2000);

        if (typeof cb === 'function') {
          cb();
        } else if (isNew) {
          // this will cause map to rerender, but i think this is acceptable on initial save
          setTimeout(
            () => router.replace({ pathname: `/edit/${encodeURIComponent(systemIdToSave)}` }),
            1000
          );

          ReactGA.event({
            category: 'Edit',
            action: 'Initial Save'
          });
        }

        ReactGA.event({
          category: 'Edit',
          action: 'Save'
        });
      } else {
        setSaveProgress({ status: 'error', message: 'Save failed' });
        handleSetToast('Encountered error while saving.');

        ReactGA.event({
          category: 'Edit',
          action: 'Save Failure'
        });
      }
    } catch (e) {
      console.error('Unexpected error saving:', e);
      setSaveProgress({ status: 'error', message: e.message || 'Unexpected error' });
    } finally {
      setIsSaving(false);
      clearInterval(saveToastInterval);
    }
  }

  const handleSave = (cb) => {
    if (!firebaseContext.user || !firebaseContext.user.uid) {
      onToggleShowAuth(true);
      ReactGA.event({ category: 'Edit', action: 'Unauthenticated Save' });
      return;
    }

    if (!firebaseContext.user.emailVerified && isNew && systemDocData?.ancestors?.length && !systemDocData.ancestors[systemDocData.ancestors.length - 1].startsWith('defaultSystems/')) {
      onToggleShowEmailVerification(true);
      ReactGA.event({ category: 'Edit', action: 'Unverified Email Branch Save' });
      return;
    }

    const orphans = getOrphans();
    if (orphans?.all?.length) {
      const itThem = orphans.all.length === 1 ? 'it' : 'them';
      let orphanText = '';
      if (orphans?.stations?.length) {
        orphanText += orphans.stations.length === 1 ? '1 station' : `${orphans.stations.length} stations`
      }
      if (orphans?.stations?.length && orphans?.waypoints?.length) {
        orphanText += ' and ';
      }
      if (orphans?.waypoints?.length) {
        orphanText += orphans.waypoints.length === 1 ? '1 waypoint' : `${orphans.waypoints.length} waypoints`
      }
      const message = `Do you want to remove ${orphanText} that ${(orphans.all.length === 1 ? 'is' :  'are')} not connected to any line${orphans?.stations?.length ? ' or interchange' : ''}?`;

      setPrompt({
        message: message,
        confirmText: `Yes, remove ${itThem}.`,
        denyText: `No, keep ${itThem}.`,
        confirmFunc: () => {
          const systemWithoutOrphans = getSystemWithoutOrphans(orphans.all);

          setSystem(currSystem => {
            const updatedSystem = { ...currSystem };
            updatedSystem.stations = systemWithoutOrphans.stations;
            updatedSystem.changing = { stationIds: orphans.all };
            updatedSystem.manualUpdate++;
            return updatedSystem;
          });
          setFocus({});
          setPrompt(null);

          performSave(systemWithoutOrphans, meta, cb);

          ReactGA.event({
            category: 'Edit',
            action: 'Remove Orphans'
          });
        },
        denyFunc: () => {
          setPrompt(null);

          performSave(system, meta, cb);

          ReactGA.event({
            category: 'Edit',
            action: 'Keep Orphans'
          });
        }
      });
    } else {
      performSave(system, meta, cb);
    }
  }

  const handleDelete = () => {
    if (!firebaseContext.user || !firebaseContext.user.uid) {
      onToggleShowAuth(true);
      ReactGA.event({ category: 'Edit', action: 'Unauthenticated Delete' });
      return;
    }

    if (isNew) return;

    setPrompt({
      message: `Are you sure you want to delete ${system.title ? `your map "${system.title}"` : 'this map'}? This action cannot be undone.`,
      confirmText: `Yes, delete it.`,
      denyText: `Cancel.`,
      confirmFunc: async () => {
        const systemIdToSave = getSystemId(firebaseContext.user.uid, meta.systemNumStr);
        const saver = new Saver(firebaseContext,
                                systemIdToSave,
                                system,
                                meta,
                                isPrivate,
                                scoreIsHidden,
                                commentsLocked,
                                systemDocData.ancestors,
                                isNew);
        const successful = await saver.delete();

        if (successful) {
          clearLocalEditSystem(systemIdToSave);
          setIsSaved(true); // avoid unsaved edits warning
          handleSetToast('Deleted.');
          setTimeout(() => router.replace({ pathname: `/explore` }), 1000);

          ReactGA.event({
            category: 'Edit',
            action: 'Delete System'
          });
        } else {
          handleSetToast('Encountered error while deleting.');

          ReactGA.event({
            category: 'Edit',
            action: 'Delete System Failure'
          });
        }
      },
      denyFunc: () => {
        setPrompt(null);

        ReactGA.event({
          category: 'Edit',
          action: 'Cancel Delete'
        });
      }
    });
  }

  const handleTogglePrivate = async () => {
    if (!firebaseContext.user || !firebaseContext.user.uid) {
      handleSetToast('Sign in to change visibility!');
      onToggleShowAuth(true);
      ReactGA.event({ category: 'Edit', action: 'Unauthenticated Make Private' });
      return;
    }

    const willBePrivate = isPrivate ? false : true;

    if (!isNew) {
      const saver = new Saver(firebaseContext,
                              getSystemId(firebaseContext.user.uid, meta.systemNumStr),
                              system,
                              meta,
                              willBePrivate,
                              scoreIsHidden,
                              commentsLocked,
                              systemDocData.ancestors,
                              isNew);
      const successful = await saver.updatePrivate();
      setIsPrivate(willBePrivate);

      if (successful) handleSetToast(willBePrivate ? 'Map is now private.' : 'Map is now public.');
      else handleSetToast('Encountered error while updating visibility.');

      ReactGA.event({
        category: 'Edit',
        action: willBePrivate ? 'Make Private' : 'Make Public'
      });
    } else {
      setIsPrivate(willBePrivate);
      handleSetToast(willBePrivate ? 'Map will be private.' : 'Map will be public.');

      ReactGA.event({
        category: 'Edit',
        action: willBePrivate ? 'Unsaved Make Private' : 'Unsaved Make Public'
      });
    }
  }

  const handleToggleScoreIsHidden = async () => {
    if (!firebaseContext.user || !firebaseContext.user.uid) {
      handleSetToast('Sign in to change score visibility!');
      onToggleShowAuth(true);
      ReactGA.event({ category: 'Edit', action: 'Unauthenticated Update Score Hidden' });
      return;
    }

    const willBeHidden = scoreIsHidden ? false : true;

    if (!isNew) {
      const saver = new Saver(firebaseContext,
                              getSystemId(firebaseContext.user.uid, meta.systemNumStr),
                              system,
                              meta,
                              isPrivate,
                              willBeHidden,
                              commentsLocked,
                              systemDocData.ancestors,
                              isNew);
      const successful = await saver.updateScoreIsHidden();

      if (successful) setScoreIsHidden(willBeHidden);
      else handleSetToast('Encountered error while updating score visibility.');

      ReactGA.event({
        category: 'Edit',
        action: willBeHidden ? 'Hide Score' : 'Show Score'
      });
    } else {
      setScoreIsHidden(willBeHidden);

      ReactGA.event({
        category: 'Edit',
        action: willBeHidden ? 'Unsaved Hide Score' : 'Unsaved Show Score'
      });
    }
  }

  const handleToggleCommentsLocked = async () => {
    if (isNew) {
      handleSetToast('Save map before locking comments');
      ReactGA.event({ category: 'System', action: 'Unsaved Lock Comments' });
      return;
    }

    const willBeLocked = commentsLocked ? false : true;

    const saver = new Saver(firebaseContext,
                            getSystemId(firebaseContext.user.uid, meta.systemNumStr),
                            system,
                            meta,
                            isPrivate,
                            scoreIsHidden,
                            willBeLocked,
                            systemDocData.ancestors,
                            isNew);
    const successful = await saver.updateCommentsLocked();
    setCommentsLocked(willBeLocked);

    if (!successful) handleSetToast('Encountered error while locking comments.');

    ReactGA.event({
      category: 'System',
      action: willBeLocked ? 'Lock Comments' : 'Unlock Comments'
    });
  }

  const handleUndo = () => {
    if (viewOnly) return;
    if (history.length < 2) {
      handleSetToast('Undo history is empty');

      ReactGA.event({
        category: 'Edit',
        action: 'Undo History Empty'
      });
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

    let interchangeSet = new Set();
    Object.keys(system.interchanges).forEach(iID => interchangeSet.add(iID));
    Object.keys(prevSystem.interchanges).forEach(iID => interchangeSet.add(iID));

    let segmentSet = new Set();
    Object.keys(system.interlineSegments).forEach(iID => segmentSet.add(iID));
    Object.keys(prevSystem.interlineSegments).forEach(iID => segmentSet.add(iID));
    const { updatedInterlineSegments, diffSegmentKeys } = refreshInterlineSegments(prevSystem);
    Object.keys(updatedInterlineSegments).forEach(iID => segmentSet.add(iID));
    prevSystem.interlineSegments = updatedInterlineSegments;

    setFocus({});
    setSystem({
      ...prevSystem,
      changing: {
        stationIds: Array.from(stationSet),
        lineKeys: Array.from(lineSet),
        interchangeIds: Array.from(interchangeSet),
        segmentKeys: Array.from(segmentSet)
      }
    });
    setHistory(currHistory => currHistory.slice(0, currHistory.length - 2));
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: 'Undo'
    });
  }

  const handleToggleWaypoints = () => {
    ReactGA.event({
      category: 'Edit',
      action: waypointsHidden ? 'Show Waypoints' : 'Hide Waypoints'
    });

    setWaypointsHidden(currWaypointsHidden => currWaypointsHidden ? false : true);
    setSystem(currSystem => {
      const updatedSystem = {
        ...currSystem,
        changing: {
          stationIds: Object.values(system.stations).filter(s => s.isWaypoint).map(s => s.id)
        }
      };
      return updatedSystem;
    });
  }

  const handleAddLineGroup = () => {
    if (viewOnly) return;

    let lineGroup = {
      label: '',
      id: meta.nextLineGroupId || '0'
    };

    setMeta(currMeta => {
      currMeta.nextLineGroupId = `${parseInt(currMeta.nextLineGroupId || '0') + 1}`;
      return currMeta;
    });
    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      updatedSystem.lineGroups[lineGroup.id] = lineGroup;
      updatedSystem.manualUpdate++;
      return updatedSystem;
    });
    setRecent(recent => {
      recent.lineGroupId = lineGroup.id;
      return recent;
    });
    setGroupsDisplayed(currGroupsDisplayed => {
      if (groupsDisplayed?.length) {
        const groups = [ ...(currGroupsDisplayed || []), lineGroup.id ];
        return Array.from(new Set(groups));
      } else {
        return currGroupsDisplayed;
      }
    })
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: `Add New Line Group`
    });
  }

  const handleGetTitle = (title) => {
    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      const trimmedTitle = title.trim().substring(0, 200);
      if (trimmedTitle) {
        updatedSystem.title = trimmedTitle;
        updatedSystem.manualUpdate++;
      }
      return updatedSystem;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: 'Update Title'
    });
  }

  const handleSetAlert = (message) => {
    setAlert(message);

    setTimeout(() => {
      setAlert(null);
    }, 3000);
  }

  const handleSetToast = (message) => {
    setToast(message);

    setTimeout(() => {
      setToast(null);
    }, 2000);
  }

  const handleSetCaption = (caption) => {
    const strippedCaption = caption.replace(/^\n+/, '').replace(/\n+$/, '').replace(/\n\n\n+/gm, '\n\n\n').substring(0, 50000);
    if (strippedCaption !== (system.caption || '')) {
      setSystem(currSystem => {
        const updatedSystem = { ...currSystem };
        updatedSystem.caption = strippedCaption ? strippedCaption : '';
        updatedSystem.manualUpdate++;
        return updatedSystem;
      });
      setIsSaved(false);

      ReactGA.event({
        category: 'Edit',
        action: 'Update Caption'
      });
    }
  }

  const handleMapClick = (lat, lng) => {
    if (viewOnly) return;

    const addAsWaypoint = (recent && recent.addingWaypoints) || false;

    let station = {
      lat: lat,
      lng: normalizeLongitude(lng),
      id: meta.nextStationId
    };

    if (addAsWaypoint) {
      station.isWaypoint = true;
    } else {
      station.name = 'Station Name';
      getStationName(station);
    }

    setMeta(currMeta => {
      currMeta.nextStationId = `${parseInt(currMeta.nextStationId) + 1}`;
      return currMeta;
    });
    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      updatedSystem.stations[station.id] = station;
      updatedSystem.changing = {
        stationIds: [ station.id ]
      };
      updatedSystem.manualUpdate++;
      return updatedSystem;
    });
    setFocus({
      station: station
    });
    setRecent(recent => {
      recent.stationId = station.id;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: `Add New ${addAsWaypoint ? 'Waypoint' : 'Station'}`
    });
  }

  const buildOverpassQuery = (query) => {
    return new Promise((resolve, reject) => {
      fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `data=${encodeURIComponent(query)}`
      })
        .then(response => response.json())
        .then(data => {
          resolve({ success: true, geoData: data });
        })
        .catch(error => {
          console.log('Error fetching data from Overpass API:', error);
          reject({ success: false, error: `Error fetching data from Overpass API: ${error}` });
        });
    })
  };

  const doAdminAreaQuery = async (station, skipLocalQuery) => {
    const adminQuery = `is_in(${station.lat},${station.lng})->.a;rel(pivot.a)[boundary=administrative];out tags;`;
    const nameBuildingsQuery = `way[highway][name](around:500,${station.lat},${station.lng});out center tags 1;`;
    const fullQuery = `[out:json];${adminQuery}${skipLocalQuery ? '' : nameBuildingsQuery}`;

    const responseData = await buildOverpassQuery(fullQuery);

    let adminName;
    let wayName;
    if (responseData?.success && responseData?.geoData?.elements?.length) {
      let highestLevel = 0;
      for (const element of responseData.geoData.elements) {
        if (element.tags?.admin_level && element.tags?.name) {
          let parsedLevel = parseInt(element.tags.admin_level);
          let levelInt = parsedLevel ? parsedLevel : 0;
          if ((!adminName || parsedLevel >= highestLevel) && (!parsedLevel || parsedLevel <= 8)) {
            adminName = element.tags['name:en'] ? element.tags['name:en'] : element.tags.name;
            highestLevel = parsedLevel;
          }
        } else if (element.type === 'way') {
          wayName = element.tags.name;
        }
      }
    }
    return wayName ? wayName : adminName;
  }

  const doLocalQuery = async (station) => {
    const addrBuildingsQuery = `way[building]["addr:street"](around:25,${station.lat},${station.lng});out center tags 1;`;
    const nameRoadsQuery = `way[highway][name](around:100,${station.lat},${station.lng});out center tags;`;
    const nameBuildingsQuery = `way[building]["name"](around:25,${station.lat},${station.lng});out center tags 1;`;
    const fullQuery = `[out:json];${addrBuildingsQuery}${nameRoadsQuery}${nameBuildingsQuery}`;

    const responseData = await buildOverpassQuery(fullQuery);

    if (responseData?.success && responseData?.geoData?.elements?.length) {
      for (const element of responseData.geoData.elements) {
        if (element.tags?.name || element.tags?.['addr:street']) {
          return element.tags['addr:street'] ? element.tags['addr:street'] : element.tags.name;
        }
      }
    }
    return;
  }

  const getStationName = async (station) => {
    let skipLocalQuery = false;
    if (recent?.lineKey && system.lines?.[recent.lineKey]?.mode) {
      const mode = getMode(system.lines[recent.lineKey].mode);
      skipLocalQuery = mode.useAdminName;
    }

    let name;
    if (!skipLocalQuery) name = await doLocalQuery(station);
    if (!name) name = await doAdminAreaQuery(station, skipLocalQuery);

    const finalName = name ? name : 'Station Name';

    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      if (updatedSystem.stations?.[station.id] && !updatedSystem.stations[station.id]?.isWaypoint) {
        updatedSystem.stations[station.id].name = finalName;
      }
      return updatedSystem;
    });
    setFocus(currFocus => {
      // update focus if this station is focused
      if ('station' in currFocus && currFocus.station.id === station.id) {
        return { station: { ...currFocus.station, name: finalName } };
      }
      return currFocus;
    });

    ReactGA.event({
      category: 'Edit',
      action: name ? 'Station Name Found' : 'Station Name Not Found'
    });
  }

  /**
   * Finds the index in the line where adding the new station will result in the smallest
   * change in direction. Also takes into account the distance of the new station to where
   * it would be added relative to the rest of the line. The "line" can be a line or an
   * interchange or any object with a stationIds field.
   */
  const getIndexForSmallestAngleDelta = (currSystem, line, station) => {
    const stations = currSystem.stations;

    if (line.stationIds.length === 0 || line.stationIds.length === 1) {
      return 0;
    }

    // find the distance of the tenth closest point, or the median
    // distance if there are fewer than twenty
    const distances = line.stationIds
      .map((sId) => {
        if (!stations[sId]) return Number.MAX_SAFE_INTEGER;
        return getDistance(station, stations[sId]);
      })
      .sort((a, b) => a - b);
    const upperDistIndex = Math.min(9, Math.floor((distances.length - 1) / 2));
    const upperDist = distances[upperDistIndex];

    let targetIndex = 0;
    let bestMatchValue = 2; // 180deg, furthest station
    for (let index = 0; index <= line.stationIds.length; index++) {
      let firstStation;
      let secondStation;
      let thirdStation;
      let distance;

      if (index === 0) {
        // angle formed by new__i__i+1
        firstStation = station;
        secondStation = stations[line.stationIds[0]];
        thirdStation = stations[line.stationIds[1]];
        distance = getDistance(firstStation, secondStation);
      } else if (index === line.stationIds.length) {
        // angle formed by i-1__i__new
        firstStation = stations[line.stationIds[index - 2]];
        secondStation = stations[line.stationIds[index - 1]];
        thirdStation = station;
        distance = getDistance(secondStation, thirdStation);
      } else {
        // angle formed by i-1__new__i
        firstStation = stations[line.stationIds[index - 1]];
        secondStation = station;
        thirdStation = stations[line.stationIds[index]];
        distance = Math.min(getDistance(firstStation, secondStation), getDistance(secondStation, thirdStation));
      }

      // double check validity
      if (!('lng' in firstStation && 'lat' in firstStation) ||
          !('lng' in secondStation && 'lat' in secondStation) ||
          !('lng' in thirdStation && 'lat' in thirdStation)) {
        continue;
      }

      // calculate rhumb bearings
      const bearingDeg1 = turfRhumbBearing([ normalizeLongitude(firstStation.lng), firstStation.lat ],
                                           [ normalizeLongitude(secondStation.lng), secondStation.lat ]);
      const bearingDeg2 = turfRhumbBearing([ normalizeLongitude(secondStation.lng), secondStation.lat ],
                                           [ normalizeLongitude(thirdStation.lng), thirdStation.lat ]);

      // find the rhumb distance to determine if it is on the other side of the world
      const midPointOfOuter = turfMidpoint([ normalizeLongitude(firstStation.lng), firstStation.lat ],
                                           [ normalizeLongitude(thirdStation.lng), thirdStation.lat ]);
      const rhumbDegrees = turfRhumbDistance(midPointOfOuter,
                                             [ normalizeLongitude(secondStation.lng), secondStation.lat ],
                                             { units: 'degrees'});

      // find difference between bearings
      let angleDiff = Math.abs(bearingDeg1 - bearingDeg2) % 360;
      angleDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;

      // account for other side of the world
      const theta = Math.max(angleDiff, rhumbDegrees);

      // ratio between theta and max possible value of 180 degrees
      const thetaRatio = (theta / 180);

      // get ratio between distance and tenth smallest (or median) distance
      const distanceRatio = distance / upperDist;

      // add these two values to score the placement; lower is better
      const matchValue = thetaRatio + distanceRatio;

      if (matchValue <= bestMatchValue) {
        targetIndex = index;
        bestMatchValue = matchValue;
      }
    }

    return targetIndex;
   }

  const handleStationInfoChange = (stationId, info, replace = false) => {
    if (!(stationId in (system.stations || {}))) {
      // if station has been deleted since info change
      return;
    }

    let station = system.stations[stationId];
    if (!station) return;
    if (station.isWaypoint) {
      // name and info not needed for waypoint
      return;
    }

    if (replace) {
      setSystem(currSystem => {
        const updatedSystem = { ...currSystem };
        updatedSystem.stations[stationId] = { ...station, ...info };
        updatedSystem.changing = {};
        return updatedSystem;
      });
    } else {
      setSystem(currSystem => {
        const updatedSystem = { ...currSystem };
        updatedSystem.stations[stationId] = { ...station, ...info };
        updatedSystem.changing = {};
        updatedSystem.manualUpdate++;
        return updatedSystem;
      });
      setRecent(recent => {
        recent.stationId = station.id;
        return recent;
      });
      setIsSaved(false);

      ReactGA.event({
        category: 'Edit',
        action: 'Change Station Info'
      });
    }
  }

  const handleStationsGradeChange = (stationIds, grade) => {
    if (!stationIds?.length) return;
    if (!grade) return;

    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      for (const stationId of stationIds) {
        if (stationId in updatedSystem.stations) {
          updatedSystem.stations[stationId].grade = grade;
        }
      }
      updatedSystem.changing = {};
      updatedSystem.manualUpdate++;
      return updatedSystem;
    });
    if (stationIds.length === 1 && stationIds[0] in system.stations) {
      setRecent(recent => {
        recent.stationId = stationIds[0];
        return recent;
      });
    }
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: `Change ${stationIds.length === 1 ? 'Station' : 'Multiple Stations'} Grade`
    });
  }

  const handleAddStationToLine = (lineKey, station, position) => {
    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      let line = updatedSystem.lines[lineKey];

      if (!line) return updatedSystem;

      if (position !== 0 && !position) {
        position = getIndexForSmallestAngleDelta(updatedSystem, line, station);
      }

      if (position === 0) {
        line.stationIds = [station.id].concat(line.stationIds);
      } else if (position < line.stationIds.length) {
        line.stationIds.splice(position, 0, station.id);
      } else {
        line.stationIds = line.stationIds.concat([station.id]);
      }

      updatedSystem.lines[lineKey] = line;
      updatedSystem.manualUpdate++;

      const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, line.stationIds);
      updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
      updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

      const { updatedInterlineSegments, diffSegmentKeys } = refreshInterlineSegments(updatedSystem);
      updatedSystem.interlineSegments = updatedInterlineSegments;

      updatedSystem.changing = {
        lineKeys: [ lineKey ],
        stationIds: [ station.id ],
        segmentKeys: diffSegmentKeys
      };

      return updatedSystem;
    });

    setFocus({
      station: station
    });
    setRecent(recent => {
      recent.lineKey = lineKey;
      recent.stationId = station.id;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: `Add ${station.isWaypoint ? 'Waypoint' : 'Station'} to Line`
    });
  }

  const handleStationDelete = (station) => {
    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      delete updatedSystem.stations[station.id];
      updatedSystem.manualUpdate++;

      let modifiedLines = [];
      let sIDsToRefresh = [ station.id ];
      for (const onLine of (updatedSystem.transfersByStationId?.[station.id]?.onLines ?? [])) {
        if (!onLine?.lineId) continue;
        // TODO: can probably ignore isWO stations
        if (!(onLine.lineId in (updatedSystem.lines || {}))) continue;

        const updatedStationIds = updatedSystem.lines[onLine.lineId].stationIds.filter(sId => sId !== station.id);
        if (updatedSystem.lines[onLine.lineId].stationIds.length !== updatedStationIds.length) {
          modifiedLines.push(onLine.lineId);
        }
        updatedSystem.lines[onLine.lineId].stationIds = updatedStationIds;
        sIDsToRefresh.push(...updatedSystem.lines[onLine.lineId].stationIds);
      }

      const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, sIDsToRefresh);
      updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
      updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

      const { updatedInterlineSegments, diffSegmentKeys } = refreshInterlineSegments(updatedSystem);
      updatedSystem.interlineSegments = updatedInterlineSegments;

      updatedSystem.changing = {
        lineKeys: modifiedLines,
        stationIds: [ station.id ],
        segmentKeys: diffSegmentKeys
      };

      return updatedSystem;
    });

    setFocus({});
    setRecent(recent => {
      delete recent.stationId;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: `Delete ${station.isWaypoint ? 'Waypoint' : 'Station'}`
    });

    // remove from interchange if it is part of one
    handleRemoveStationFromInterchange(station.id);
  }

  const handleConvertToWaypoint = (station) => {
    station.isWaypoint = true;
    delete station.name;
    delete station.info;
    delete station.densityInfo;

    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      updatedSystem.stations[station.id] = station;
      updatedSystem.manualUpdate++;

      let sIDsToRefresh = [ station.id ];
      for (const onLine of (updatedSystem.transfersByStationId?.[station.id]?.onLines ?? [])) {
        if (!onLine?.lineId) continue;
        // TODO: can probably ignore isWO stations
        sIDsToRefresh.push(...(updatedSystem.lines?.[onLine.lineId]?.stationIds ?? []));
      }

      const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, sIDsToRefresh);
      updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
      updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

      updatedSystem.changing = {
        stationIds: [ station.id ],
        lineKeys: (updatedSystem.transfersByStationId[station.id]?.onLines ?? []).filter(oL => oL.lineId).map(oL => oL.lineId)
      };

      return updatedSystem;
    });

    setFocus({
      station: station
    });
    setRecent(recent => {
      recent.stationId = station.id;
      recent.addingWaypoints = true;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: 'Convert to Waypoint'
    });

    // remove from interchange if it is part of one
    handleRemoveStationFromInterchange(station.id);
  }

  const handleConvertToStation = (station) => {
    delete station.isWaypoint;
    station.name = 'Station Name';
    getStationName(station);

    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      updatedSystem.stations[station.id] = station;
      updatedSystem.manualUpdate++;

      let sIDsToRefresh = [ station.id ];
      for (const onLine of (updatedSystem.transfersByStationId?.[station.id]?.onLines ?? [])) {
        if (!onLine?.lineId) continue;
        // TODO: can probably ignore isWO stations
        sIDsToRefresh.push(...(updatedSystem.lines?.[onLine.lineId]?.stationIds ?? []));
      }

      const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, sIDsToRefresh);
      updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
      updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

      updatedSystem.changing = {
        stationIds: [ station.id ],
        lineKeys: Object.values(updatedSystem.lines)
                        .filter(line => line.stationIds.includes(station.id))
                        .map(line => line.id)
      };

      return updatedSystem;
    });

    setFocus({
      station: station
    });
    setRecent(recent => {
      recent.stationId = station.id;
      recent.addingWaypoints = false;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: 'Convert to Station'
    });
  }

  const handleWaypointOverride = (lineKey, station, action = 'Add') => {
    if (station.isWaypoint) return;

    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      if (action === 'Add') {
        updatedSystem.lines[lineKey].waypointOverrides = (updatedSystem.lines[lineKey]?.waypointOverrides ?? []).concat([station.id]);
      } else if (action === 'Remove') {
        updatedSystem.lines[lineKey].waypointOverrides = (updatedSystem.lines[lineKey]?.waypointOverrides ?? []).filter(sId => sId !== station.id);
      }
      updatedSystem.manualUpdate++;

      const sIDsToRefresh = [ station.id, ...(updatedSystem.lines[lineKey]?.stationIds ?? [])];
      const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, sIDsToRefresh);
      updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
      updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

      updatedSystem.changing = {
        stationIds: [ station.id ],
        lineKeys: [ lineKey ]
      };

      return updatedSystem;
    });

    setFocus({
      station: station
    });
    setRecent(recent => {
      recent.stationId = station.id;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: `${action} Waypoint Override`
    });
  }

  // returns the order of station ids that results is the shortest increase in distance
  const getShortestInterchangeUpdate = (existingStationIds, newStationId) => {
    let shortestSequence = [ newStationId, ...existingStationIds ];
    let coords = stationIdsToCoordinates(system.stations, shortestSequence);
    let shortestDistance = turfLength(turfLineString(coords));

    for (let i = 1; i <= existingStationIds.length; i++) {
      const sequence = [ ...existingStationIds.slice(0, i), newStationId, ...existingStationIds.slice(i) ];
      coords = stationIdsToCoordinates(system.stations, sequence);
      const distance = turfLength(turfLineString(coords));

      if (distance < shortestDistance) {
        shortestDistance = distance;
        shortestSequence = sequence;
      }
    }

    return shortestSequence;
  }

  const handleCreateInterchange = (station1, station2) => {
    const station1Interchange = system?.interchangesByStationId?.[station1.id];
    const station2Interchange = system?.interchangesByStationId?.[station2.id];

    if (station1Interchange && station2Interchange) { // both are already part of interchanges
      if (station1Interchange.id === station2Interchange.id) {
        // already connected
        return;
      } else {
        const oneIsLarger = station1Interchange.stationIds.length >= station2Interchange.stationIds.length;
        let baseInterchange = { ...(oneIsLarger ? station1Interchange : station2Interchange) };
        let mergingInterchange = { ...(oneIsLarger ? station2Interchange : station1Interchange) };

        for (const stationId of mergingInterchange.stationIds) {
          if (stationId in system.stations) {
            const otherStation = { ...(system.stations[stationId]) };
            baseInterchange.stationIds = getShortestInterchangeUpdate(baseInterchange.stationIds, otherStation.id);
          }
        }

        setSystem(currSystem => {
          const updatedSystem = { ...currSystem };
          updatedSystem.interchanges[baseInterchange.id] = baseInterchange;
          delete updatedSystem.interchanges[mergingInterchange.id];
          updatedSystem.manualUpdate++;

          const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, baseInterchange.stationIds);
          updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
          updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

          updatedSystem.changing = {
            interchangeIds: [ baseInterchange.id, mergingInterchange.id ],
            stationIds: baseInterchange.stationIds
          };

          // TODO: figure out why this is needed here for manualUpdate to register effect in this case only
          return JSON.parse(JSON.stringify(updatedSystem));
        });
      }
    } else if (station1Interchange || station2Interchange) { // one is already part of an interchange
      let updatedInterchange = { ...(station1Interchange || station2Interchange) };
      const otherStation = { ...(station1Interchange ? station2 : station1) };
      updatedInterchange.stationIds = getShortestInterchangeUpdate(updatedInterchange.stationIds, otherStation.id);

      setSystem(currSystem => {
        const updatedSystem = { ...currSystem };
        updatedSystem.interchanges[updatedInterchange.id] = updatedInterchange;
        updatedSystem.manualUpdate++;

        const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, updatedInterchange.stationIds);
        updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
        updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

        updatedSystem.changing = {
          interchangeIds: [ updatedInterchange.id ],
          stationIds: updatedInterchange.stationIds
        };

        // TODO: figure out why this is needed here for manualUpdate to register effect in this case only
        return JSON.parse(JSON.stringify(updatedSystem));
      });
    } else { // create a new interchange
      const newInterchange = {
        id: meta.nextInterchangeId || '0',
        stationIds: [ station1.id, station2.id ]
      }

      setMeta(currMeta => {
        currMeta.nextInterchangeId = `${parseInt(currMeta.nextInterchangeId || '0') + 1}`;
        return currMeta;
      });
      setSystem(currSystem => {
        const updatedSystem = { ...currSystem };
        updatedSystem.interchanges[newInterchange.id] = newInterchange;
        updatedSystem.manualUpdate++;

        const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, newInterchange.stationIds);
        updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
        updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

        updatedSystem.changing = {
          interchangeIds: [ newInterchange.id ],
          stationIds: newInterchange.stationIds
        };

        // TODO: figure out why this is needed here for manualUpdate to register effect in this case only
        return JSON.parse(JSON.stringify(updatedSystem));
      });
    }

    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: 'Add Station to Interchange'
    });
  }

  const handleRemoveStationFromInterchange = (stationId) => {
    let interchange = system.interchangesByStationId?.[stationId];
    if (!interchange) return;

    const filteredStationIds = interchange.stationIds.filter(sId => sId !== stationId);

    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      if (filteredStationIds.length >= 2) {
        updatedSystem.interchanges[interchange.id].stationIds = filteredStationIds;
      } else {
        delete updatedSystem.interchanges[interchange.id];
      }
      updatedSystem.manualUpdate++;
      updatedSystem.stationsToRecalculate = [ stationId, ...(filteredStationIds) ];

      const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, [ stationId, ...(filteredStationIds) ]);
      updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
      updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

      updatedSystem.changing = {
        ...(updatedSystem.changing || {}),
        // persist changing lineKeys and segmentKeys
        stationIds: [ ...filteredStationIds, stationId ],
        interchangeIds: [ interchange.id ],
        all: undefined
      }

      return updatedSystem;
    });

    setIsSaved(false);

    // GA call done in Station.js because this is also called
    // in convert to waypoint and station delete
  }

  const handleLineGroupDelete = (lineGroup) => {
    if (!lineGroup.id) return;

    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      delete updatedSystem.lineGroups[lineGroup.id];

      for (const line of (Object.values(updatedSystem.lines))) {
        if (line.lineGroupId === lineGroup.id) {
          const updatedLine = { ...line };
          delete updatedLine.lineGroupId;
          updatedSystem.lines[line.id] = updatedLine;
        }
      }

      const { updatedInterlineSegments, diffSegmentKeys } = refreshInterlineSegments(updatedSystem);
      updatedSystem.interlineSegments = updatedInterlineSegments;

      updatedSystem.changing = {
        lineKeys: Object.keys(updatedSystem.lines),
        segmentKeys: diffSegmentKeys
      };

      updatedSystem.manualUpdate++;
      return updatedSystem;
    });

    setRecent(recent => {
      delete recent.lineGroupId;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: 'Delete Line Group'
    });
  }

  const handleLineGroupInfoChange = (lineGroup, renderMap) => {
    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      updatedSystem.lineGroups[lineGroup.id] = lineGroup;

      if (renderMap) {
        const { updatedInterlineSegments, diffSegmentKeys } = refreshInterlineSegments(updatedSystem);
        updatedSystem.interlineSegments = updatedInterlineSegments;

        updatedSystem.changing = {
          lineKeys: Object.keys(updatedSystem.lines),
          segmentKeys: diffSegmentKeys
        };
      }

      updatedSystem.manualUpdate++;
      return updatedSystem;
    });

    setRecent(recent => {
      recent.lineGroupId = lineGroup.id;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: 'Change Line Group Info'
    });
  }

  const handleLineInfoChange = (line, renderMap, replace = false) => {
    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      updatedSystem.lines[line.id] = line;

      if (renderMap) {
        const { updatedInterlineSegments, diffSegmentKeys } = refreshInterlineSegments(updatedSystem);
        updatedSystem.interlineSegments = updatedInterlineSegments;

        updatedSystem.changing = {
          lineKeys: [ line.id ],
          segmentKeys: diffSegmentKeys
        };
      }

      if (!replace) {
        updatedSystem.manualUpdate++;
      }

      return updatedSystem;
    });

    setFocus({
      line: line
    });
    setRecent(recent => {
      recent.lineKey = line.id;
      return recent;
    });

    if (!replace) {
      setIsSaved(false);
    }

    ReactGA.event({
      category: 'Edit',
      action: 'Change Line Info'
    });
  }

  const handleRemoveStationFromLine = (line, stationId) => {
    line.stationIds = line.stationIds.filter(sId => sId !== stationId);

    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      updatedSystem.lines[line.id] = line;
      updatedSystem.manualUpdate++;

      const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, [ stationId, ...(line.stationIds) ]);
      updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
      updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

      const { updatedInterlineSegments, diffSegmentKeys } = refreshInterlineSegments(updatedSystem);
      updatedSystem.interlineSegments = updatedInterlineSegments;

      updatedSystem.changing = {
        lineKeys: [ line.id ],
        stationIds: [ stationId ],
        segmentKeys: diffSegmentKeys
      };

      return updatedSystem;
    });

    setFocus({
      line: line
    });
    setRecent(recent => {
      recent.lineKey = line.id;
      recent.stationId = stationId;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: 'Remove Station from Line'
    });
  }

  const handleRemoveWaypointsFromLine = (line, waypointIds) => {
    line.stationIds = line.stationIds.filter(sId => !waypointIds.includes(sId));
    line.waypointOverrides = (line.waypointOverrides || []).filter(sId => !waypointIds.includes(sId));

    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      updatedSystem.lines[line.id] = line;
      updatedSystem.manualUpdate++;

      const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, waypointIds);
      updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
      updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

      const { updatedInterlineSegments, diffSegmentKeys } = refreshInterlineSegments(updatedSystem);
      updatedSystem.interlineSegments = updatedInterlineSegments;

      updatedSystem.changing = {
        lineKeys: [ line.id ],
        stationIds: waypointIds,
        segmentKeys: diffSegmentKeys
      };

      return updatedSystem;
    });

    setFocus({
      line: line
    });
    setRecent(recent => {
      recent.lineKey = line.id;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: 'Remove Waypoints from Line'
    });
  }

  const handleReverseStationOrder = (line) => {
    line.stationIds = line.stationIds.slice().reverse();

    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      updatedSystem.lines[line.id] = line;
      updatedSystem.manualUpdate++;

      updatedSystem.changing = {
        lineKeys: [ line.id ]
      };

      return updatedSystem;
    });

    setFocus({
      line: line
    });
    setRecent(recent => {
      recent.lineKey = line.id;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: 'Reverse Station Order'
    });
  }

  // get line name and color for new line
  const chooseNewLine = () => {
    const lineKeys = Object.keys(system.lines);

    let currColors = [];
    for (const key of lineKeys) {
      currColors.push(system.lines[key].color);
    }

    let index = 0;
    if (lineKeys.length >= 21) {
      index = Math.floor(Math.random() * 21);
    }

    let nextLine = DEFAULT_LINES[index];
    for (const defLine of DEFAULT_LINES) {
      if (!currColors.includes(defLine.color)) {
        nextLine = defLine;
        break;
      }
    }

    return { ...nextLine };
  }

  const handleAddLine = (startingProperties = {}) => {
    const lineKey = meta.nextLineId;
    let nextLine = { ...chooseNewLine(), ...startingProperties };
    nextLine.stationIds = [];
    nextLine.id = lineKey;

    setMeta(currMeta => {
      currMeta.nextLineId = `${parseInt(currMeta.nextLineId) + 1}`;
      return currMeta;
    });
    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      updatedSystem.lines[lineKey] = nextLine;
      updatedSystem.changing = {};
      updatedSystem.manualUpdate++;
      return updatedSystem;
    });
    setFocus({
      line: nextLine
    });
    setFocus({
      line: nextLine
    });
    setRecent(recent => {
      recent.lineKey = lineKey;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: 'Add New Line'
    });
  }

  const handleLineDelete = (line) => {
    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      delete updatedSystem.lines[line.id];

      const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, [ ...line.stationIds ]);
      updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
      updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

      const { updatedInterlineSegments, diffSegmentKeys } = refreshInterlineSegments(updatedSystem);
      updatedSystem.interlineSegments = updatedInterlineSegments;

      updatedSystem.changing = {
        lineKeys: [ line.id ],
        stationIds: line.stationIds,
        segmentKeys: diffSegmentKeys
      };

      updatedSystem.manualUpdate++;
      return updatedSystem;
    });

    setFocus({});
    setRecent(recent => {
      delete recent.lineKey;
      return recent;
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Edit',
      action: 'Delete Line'
    });
  }

  const handleLineDuplicate = (line) => {
    let forkedLine = JSON.parse(JSON.stringify(line));
    forkedLine.id = meta.nextLineId;
    forkedLine.name = line.name + ' - Fork';

    setMeta(meta => {
      meta.nextLineId = `${parseInt(meta.nextLineId) + 1}`;
      return meta;
    });
    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      updatedSystem.lines[forkedLine.id] = forkedLine;
      updatedSystem.manualUpdate++;

      const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(updatedSystem, forkedLine.stationIds || []);
      updatedSystem.transfersByStationId = { ...updatedTransfersByStationId };
      updatedSystem.interchangesByStationId = { ...updatedInterchangesByStationId };

      updatedSystem.changing = {
        lineKeys: [ forkedLine.id ]
      };

      return updatedSystem;
    });

    setFocus({
      line: forkedLine
    });
    setRecent(recent => {
      recent.lineKey = forkedLine.id;
      return recent;
    });

    ReactGA.event({
      category: 'Edit',
      action: 'Fork Line'
    });
  }

  return <Theme>
    <Metatags thumbnail={thumbnail} systemDocData={systemDocData} title={fullSystem.map.title}
              description={`${fullSystem.map.title} | MetroDreamin\' map by ${getUserDisplayName(ownerDocData)}`} />
    <Header onToggleShowSettings={onToggleShowSettings} onToggleShowAuth={onToggleShowAuth} />

    <main className="Edit" itemScope itemType="https://schema.org/Article">
      <System ownerDocData={ownerDocData}
              initialSystemDocData={systemDocData}
              isNew={isNew}
              newMapBounds={newMapBounds}
              viewOnly={false}
              system={system}
              history={history}
              meta={meta}
              thumbnail={thumbnail}
              systemLoaded={systemLoaded}
              isSaved={isSaved}
              isPrivate={isPrivate}
              scoreIsHidden={scoreIsHidden}
              commentsLocked={commentsLocked}
              waypointsHidden={waypointsHidden}
              recent={recent}
              groupsDisplayed={groupsDisplayed}
              focusFromEdit={focus}
              alert={alert}
              toast={toast}
              prompt={prompt}
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
              setGroupsDisplayed={setGroupsDisplayed}
              handleSetAlert={handleSetAlert}
              handleSetToast={handleSetToast}
              handleSave={handleSave}
              handleDelete={handleDelete}
              handleTogglePrivate={handleTogglePrivate}
              handleToggleScoreIsHidden={handleToggleScoreIsHidden}
              handleToggleCommentsLocked={handleToggleCommentsLocked}
              handleAddStationToLine={handleAddStationToLine}
              handleStationDelete={handleStationDelete}
              handleStationInfoChange={handleStationInfoChange}
              handleStationsGradeChange={handleStationsGradeChange}
              handleConvertToWaypoint={handleConvertToWaypoint}
              handleConvertToStation={handleConvertToStation}
              handleWaypointOverride={handleWaypointOverride}
              handleCreateInterchange={handleCreateInterchange}
              handleLineGroupInfoChange={handleLineGroupInfoChange}
              handleLineGroupDelete={handleLineGroupDelete}
              handleLineInfoChange={handleLineInfoChange}
              handleRemoveStationFromLine={handleRemoveStationFromLine}
              handleRemoveWaypointsFromLine={handleRemoveWaypointsFromLine}
              handleRemoveStationFromInterchange={handleRemoveStationFromInterchange}
              handleReverseStationOrder={handleReverseStationOrder}
              handleLineDelete={handleLineDelete}
              handleLineDuplicate={handleLineDuplicate}
              handleMapClick={handleMapClick}
              handleToggleWaypoints={handleToggleWaypoints}
              handleAddLineGroup={handleAddLineGroup}
              handleUndo={handleUndo}
              handleAddLine={handleAddLine}
              handleGetTitle={handleGetTitle}
              handleSetCaption={handleSetCaption} />

      <Schema ownerDocData={ownerDocData} systemDocData={systemDocData} fullSystem={fullSystem} thumbnail={thumbnail} />
    </main>

    <Footer onToggleShowMission={onToggleShowMission}
            onToggleShowContribute={onToggleShowContribute}
            onToggleShowConduct={onToggleShowConduct} />
  </Theme>;
}
