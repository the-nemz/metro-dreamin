import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga4';
import mapboxgl from 'mapbox-gl';
import ReactTooltip from 'react-tooltip';
import { lineString as turfLineString } from '@turf/helpers';
import turfLength from '@turf/length';

import { FirebaseContext, getUserDocData, getSystemDocData, getFullSystem, getUrlForBlob } from '/lib/firebase.js';
import {
  getViewPath, getSystemId, getNextSystemNumStr, getSystemBlobId,
  getDistance, stationIdsToCoordinates, getTransfersForStation,
  buildInterlineSegments, diffInterlineSegments
} from '/lib/util.js';
import { useNavigationObserver } from '/lib/hooks.js';
import { Saver } from '/lib/saver.js';
import { INITIAL_SYSTEM, INITIAL_META, DEFAULT_LINES, MAX_HISTORY_SIZE } from '/lib/constants.js';

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
                              newMapBounds = [],
                              onToggleShowSettings = () => {},
                              onToggleShowAuth = () => {},
                              onToggleShowMission = () => {},
                              onToggleShowContribute = () => {},
                            }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [viewOnly, setViewOnly] = useState(!isNew && !(ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid)))
  const [system, setSystem] = useState(INITIAL_SYSTEM);
  const [history, setHistory] = useState([]);
  const [meta, setMeta] = useState(INITIAL_META);
  const [isSaved, setIsSaved] = useState(true);
  const [isPrivate, setIsPrivate] = useState(systemDocData.isPrivate || false);
  const [waypointsHidden, setWaypointsHidden] = useState(false);
  const [focus, setFocus] = useState({});
  const [recent, setRecent] = useState({});
  const [alert, setAlert] = useState(null);
  const [toast, setToast] = useState(null);
  const [prompt, setPrompt] = useState();

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
    setSystemFromData(fullSystem);
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
        // not user's map; redirect to /view/:systemId
        router.replace(getViewPath(ownerDocData.userId, systemDocData.systemNumStr));

        ReactGA.event({
          category: 'Edit',
          action: 'Redirect to View'
        });
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
    }
  }, [system.manualUpdate]);

  const setSystemFromData = (fullSystem) => {
    if (fullSystem && fullSystem.map && fullSystem.meta) {
      setMeta(fullSystem.meta);

      const systemFromData = { ...fullSystem.map };
      systemFromData.manualUpdate = 1;

      const { updatedTransfersByStationId, updatedInterchangesByStationId } = refreshTransfersForStationIds(systemFromData, Object.keys(systemFromData.stations || {}));
      systemFromData.transfersByStationId = updatedTransfersByStationId;
      systemFromData.interchangesByStationId = updatedInterchangesByStationId;

      const { updatedInterlineSegments } = refreshInterlineSegments(systemFromData);
      systemFromData.interlineSegments = updatedInterlineSegments;

      setSystem(systemFromData);
    }
  }

  const refreshInterlineSegments = (currSystem) => {
    const currLineKeys = Object.keys(currSystem.lines || {});
    if (!currLineKeys.length) return {};

    const updatedInterlineSegments = { ...buildInterlineSegments(currSystem) };
    const diffSegmentKeys = diffInterlineSegments(currSystem.interlineSegments || {}, updatedInterlineSegments);

    return { updatedInterlineSegments, diffSegmentKeys };
  }

  const refreshTransfersForStationIds = (currSystem, stationIds) => {
    if (!stationIds || !stationIds.length) {
      return { updatedTransfersByStationId: {}, updatedInterchangesByStationId: {} };
    }

    const stopsByLineId = {};
    for (const lineId in (currSystem.lines || {})) {
      stopsByLineId[lineId] = currSystem.lines[lineId].stationIds.filter(sId => currSystem.stations?.[sId] &&
                                                                            !currSystem.stations[sId].isWaypoint &&
                                                                            !(currSystem.lines[lineId].waypointOverrides || []).includes(sId));
    }

    let updatedTransfersByStationId = { ...(currSystem.transfersByStationId || {}) };
    for (const stationId of stationIds) {
      if (stationId in (currSystem.stations || {})) {
        updatedTransfersByStationId[stationId] = getTransfersForStation(stationId, currSystem.lines || {}, stopsByLineId);
      } else {
        delete updatedTransfersByStationId[stationId];
      }
    }

    let updatedInterchangesByStationId = {};
    for (const interchange of Object.values(currSystem.interchanges || {})) {
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

    return { updatedTransfersByStationId, updatedInterchangesByStationId }
  }

  const getOrphans = () => {
    let orphans = [];
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
        orphans.push(stationId);
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
    const systemIdToSave = getSystemId(firebaseContext.user.uid, metaToSave.systemNumStr);
    const saver = new Saver(firebaseContext,
                            systemIdToSave,
                            systemToSave,
                            metaToSave,
                            isPrivate,
                            systemDocData.ancestors,
                            isNew);
    const successful = await saver.save();

    if (successful) {
      setIsSaved(true);
      handleSetToast('Saved!');
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
      handleSetToast('Encountered error while saving.');

      ReactGA.event({
        category: 'Edit',
        action: 'Save Failure'
      });
    }
  }

  const handleSave = (cb) => {
    if (!firebaseContext.user || !firebaseContext.user.uid) {
      onToggleShowAuth(true);
      ReactGA.event({ category: 'Edit', action: 'Unauthenticated Save' });
      return;
    }

    const orphans = getOrphans();
    if (orphans.length) {
      const itThem = orphans.length === 1 ? 'it' : 'them';
      const message = 'Do you want to remove ' + orphans.length +
                      (orphans.length === 1 ? ' station that is ' :  ' stations that are ') +
                      'not connected to any line or interchange?';

      setPrompt({
        message: message,
        confirmText: `Yes, remove ${itThem}.`,
        denyText: `No, keep ${itThem}.`,
        confirmFunc: () => {
          const systemWithoutOrphans = getSystemWithoutOrphans(orphans);

          setSystem(currSystem => {
            const updatedSystem = { ...currSystem };
            updatedSystem.stations = systemWithoutOrphans.stations;
            updatedSystem.changing = { stationIds: orphans };
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
                                systemDocData.ancestors,
                                isNew);
        const successful = await saver.delete();

        if (successful) {
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

  const handleGetTitle = (title) => {
    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      const trimmedTitle = title.trim();
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
    const strippedCaption = caption.replace(/^\n+/, '').replace(/\n+$/, '');
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
      lng: lng,
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

  const getStationName = (station) => {
    let geocodingEndpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${station.lng},${station.lat}.json?access_token=${mapboxgl.accessToken}`;
    let req = new XMLHttpRequest();
    req.addEventListener('load', () => {
      const resp = JSON.parse(req.response);
      for (const feature of resp.features) {
        if (feature.text) {
          station.name = feature.text;
          break;
        }
      }

      setSystem(currSystem => {
        const updatedSystem = { ...currSystem };
        updatedSystem.stations[station.id] = station;
        return updatedSystem;
      });
      setFocus(currFocus => {
        // update focus if this station is focused
        if ('station' in currFocus && currFocus.station.id === station.id) {
          return { station: station };
        }
        return currFocus;
      });
    });
    req.open('GET', geocodingEndpoint);
    req.send();
  }

  // line can be a line or an interchange or any object with a stationIds field
  const getNearestIndex = (currSystem, line, station) => {
    const stations = currSystem.stations;

    if (line.stationIds.length === 0 || line.stationIds.length === 1) {
      return 0;
    }

    let nearestIndex = 0;
    let nearestId;
    let nearestDist = Number.MAX_SAFE_INTEGER;
    for (const [i, stationId] of line.stationIds.entries()) {
      let dist = getDistance(station, stations[stationId]);
      if (dist < nearestDist) {
        nearestIndex = i;
        nearestId = stationId;
        nearestDist = dist;
      }
    }

    if (nearestIndex !== 0 && line.stationIds[0] === nearestId) {
      // If nearest is loop point at start
      return 0;
    } else if (nearestIndex !== line.stationIds.length - 1 &&
               line.stationIds[line.stationIds.length - 1] === nearestId) {
      // If nearest is loop point at end
      return line.stationIds.length;
    }

    if (nearestIndex === 0) {
      const nearStation = stations[line.stationIds[nearestIndex]];
      const nextStation = stations[line.stationIds[nearestIndex + 1]];
      const otherDist = getDistance(nearStation, nextStation);
      const nextDist = getDistance(station, nextStation);
      if (nextDist > otherDist) {
        return 0;
      }
      return 1;
    } else if (nearestIndex === line.stationIds.length - 1) {
      const nearStation = stations[line.stationIds[nearestIndex]];
      const nextStation = stations[line.stationIds[nearestIndex - 1]];
      const otherDist = getDistance(nearStation, nextStation);
      const nextDist = getDistance(station, nextStation);
      if (nextDist > otherDist) {
        return line.stationIds.length;
      }
      return line.stationIds.length - 1;
    } else {
      const prevStation = stations[line.stationIds[nearestIndex - 1]];
      const nextStation = stations[line.stationIds[nearestIndex + 1]];
      const prevDist = getDistance(station, prevStation);
      const nextDist = getDistance(station, nextStation);
      const nearToPrevDist = getDistance(stations[line.stationIds[nearestIndex]], prevStation);
      const nearToNextDist = getDistance(stations[line.stationIds[nearestIndex]], nextStation);
      if (prevDist < nextDist) {
        if (nearToPrevDist < prevDist) return nearestIndex + 1;
        return nearestIndex;
      } else {
        if (nearToNextDist < nextDist) return nearestIndex;
        return nearestIndex + 1;
      }
    }
  }

  const handleStationInfoChange = (stationId, info, replace = false) => {
    if (!(stationId in (system.stations || {}))) {
      // if station has been deleted since info change
      return;
    }

    let station = system.stations[stationId];
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

  const handleAddStationToLine = (lineKey, station, position) => {
    setSystem(currSystem => {
      const updatedSystem = { ...currSystem };
      let line = updatedSystem.lines[lineKey];

      if (!line) return updatedSystem;

      if (position !== 0 && !position) {
        position = getNearestIndex(updatedSystem, line, station);
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
      setMeta(currMeta => {
        currMeta.nextInterchangeId = `${parseInt(currMeta.nextInterchangeId || '0') + 1}`;
        return currMeta;
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

  const handleLineInfoChange = (line, renderMap) => {
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

      updatedSystem.manualUpdate++;
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

    return JSON.parse(JSON.stringify(nextLine));
  }

  const handleAddLine = () => {
    const lineKey = meta.nextLineId;
    let nextLine = chooseNewLine();
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
              description={`${fullSystem.map.title} | MetroDreamin\' map by ${ownerDocData.displayName ? ownerDocData.displayName : 'Anon'}`} />
    <Header onToggleShowSettings={onToggleShowSettings} onToggleShowAuth={onToggleShowAuth} />

    <main className="Edit">
      <System ownerDocData={ownerDocData}
              systemDocData={systemDocData}
              isNew={isNew}
              newMapBounds={newMapBounds}
              viewOnly={false}
              system={system}
              history={history}
              meta={meta}
              thumbnail={thumbnail}
              isSaved={isSaved}
              isPrivate={isPrivate}
              waypointsHidden={waypointsHidden}
              recent={recent}
              focusFromEdit={focus}
              alert={alert}
              toast={toast}
              prompt={prompt}
              onToggleShowAuth={onToggleShowAuth}
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
              handleSetAlert={handleSetAlert}
              handleSetToast={handleSetToast}
              handleSave={handleSave}
              handleDelete={handleDelete}
              handleTogglePrivate={handleTogglePrivate}
              handleAddStationToLine={handleAddStationToLine}
              handleStationDelete={handleStationDelete}
              handleStationInfoChange={handleStationInfoChange}
              handleConvertToWaypoint={handleConvertToWaypoint}
              handleConvertToStation={handleConvertToStation}
              handleWaypointOverride={handleWaypointOverride}
              handleCreateInterchange={handleCreateInterchange}
              handleLineInfoChange={handleLineInfoChange}
              handleRemoveStationFromLine={handleRemoveStationFromLine}
              handleRemoveWaypointsFromLine={handleRemoveWaypointsFromLine}
              handleRemoveStationFromInterchange={handleRemoveStationFromInterchange}
              handleReverseStationOrder={handleReverseStationOrder}
              handleLineDelete={handleLineDelete}
              handleLineDuplicate={handleLineDuplicate}
              handleMapClick={handleMapClick}
              handleToggleWaypoints={handleToggleWaypoints}
              handleUndo={handleUndo}
              handleAddLine={handleAddLine}
              handleGetTitle={handleGetTitle}
              handleSetCaption={handleSetCaption} />
    </main>

    {!firebaseContext.authStateLoading && <ReactTooltip delayShow={400} border={true} type={firebaseContext.settings.lightMode ? 'light' : 'dark'} />}
    <Footer onToggleShowMission={onToggleShowMission} onToggleShowContribute={onToggleShowContribute} />
  </Theme>;
}
