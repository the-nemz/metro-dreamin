import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';

import { FirebaseContext, getUserDocData, getSystemFromDatabase } from '/lib/firebase.js';
import { getViewPath, getViewId, getDistance, buildInterlineSegments, diffInterlineSegments } from '/lib/util.js';
import { Saver } from '/lib/saver.js';
import { INITIAL_SYSTEM, INITIAL_META, DEFAULT_LINES, MAX_HISTORY_SIZE } from '/lib/constants.js';

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
        const systemDocData = await getSystemFromDatabase(viewId) ?? null;

        if (!systemDocData) {
          return { notFound: true };
        }

        return { props: { ownerDocData, systemDocData } };
      }

      return { notFound: true };
    } catch (e) {
      console.log('Unexpected Error:', e);
      return { notFound: true };
    }
  }

  return { props: { notFound: true } };
}

export default function Edit({
                              ownerDocData = {},
                              systemDocData = {},
                              isNew = false,
                              newMapBounds = [],
                              onToggleShowSettings = () => {},
                              onToggleShowAuth = () => {},
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
  const [changing, setChanging] = useState({ all: 1 });
  const [interlineSegments, setInterlineSegments] = useState({});
  const [segmentUpdater, setSegmentUpdater] = useState(0);
  const [toast, setToast] = useState(null);
  // const [windowDims, setWindowDims] = useState({ width: window.innerWidth || 0, height: window.innerHeight || 0 });

  useEffect(() => {
    setSystemFromDocument(systemDocData);
  }, []);

  useEffect(() => {
    if (!firebaseContext.authStateLoading) {
      if (isNew) {
        // new map; don't redirect
        return;
      }
      if (!(ownerDocData.userId && firebaseContext.user && firebaseContext.user.uid && (ownerDocData.userId === firebaseContext.user.uid))) {
        // not user's map; redirect to /view/:viewId
        router.replace(getViewPath(ownerDocData.userId, systemDocData.systemId))
      }
    }
  }, [firebaseContext.authStateLoading]);

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

  const handleSetToast = (message) => {
    setToast(message);

    setTimeout(() => {
      setToast(null);
    }, 2000);
  }

  const handleSave = async () => {
    if (!firebaseContext.user || !firebaseContext.user.uid) {
      handleSetToast('Sign in to save your map!');
      onToggleShowAuth();
      return;
    }

    const saver = new Saver(firebaseContext,
                            getViewId(firebaseContext.user.uid, meta.systemId),
                            system,
                            meta,
                            isPrivate,
                            isNew);
    const successful = await saver.save();

    if (successful) {
      setIsSaved(true);
      handleSetToast('Saved!');
      if (isNew) {
        // this will cause map to rerender, but i think this is acceptable on initial save
        router.push({
          pathname: getViewId(firebaseContext.user.uid, meta.systemId)
        });
      }
    } else {
      handleSetToast('Encountered error while saving.');
    }
  }

  const handleTogglePrivate = async () => {
    if (!firebaseContext.user || !firebaseContext.user.uid) {
      handleSetToast('Sign in to change visibility!');
      onToggleShowAuth();
      return;
    }

    const willBePrivate = isPrivate ? false : true;

    if (!isNew) {
      const saver = new Saver(firebaseContext,
                              getViewId(firebaseContext.user.uid, meta.systemId),
                              system,
                              meta,
                              willBePrivate,
                              isNew);
      const successful = await saver.updatePrivate();
      setIsPrivate(willBePrivate);

      if (successful) handleSetToast(willBePrivate ? 'Map is now private.' : 'Map is now public.');
      else handleSetToast('Encountered error while updating visibility.')
    } else {
      setIsPrivate(willBePrivate);
      handleSetToast(willBePrivate ? 'Map will be private.' : 'Map will be public.');

      ReactGA.event({
        category: 'Action',
        action: willBePrivate ? 'Unsaved Make Private' : 'Unsaved Make Public'
      });
    }

  }

  const handleUndo = () => {
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

  const handleToggleWaypoints = () => {
    ReactGA.event({
      category: 'Action',
      action: waypointsHidden ? 'Show waypoints' : 'Hide waypoints'
    });

    setWaypointsHidden(currWaypointsHidden => currWaypointsHidden ? false : true);
    setChanging({
      stationIds: Object.values(system.stations).filter(s => s.isWaypoint).map(s => s.id)
    })
  }

  const handleGetTitle = (title) => {
    setSystem(currSystem => {
      currSystem.title = title ? title : 'Map';
      currSystem.manualUpdate++;
      return currSystem;
    });
    setIsSaved(false);
  }

  const handleMapClick = async (lat, lng) => {
    if (viewOnly) return;

    let station = {
      lat: lat,
      lng: lng,
      id: meta.nextStationId,
      name: 'Station Name'
    }

    getStationName(station);

    setMeta(currMeta => {
      currMeta.nextStationId = `${parseInt(currMeta.nextStationId) + 1}`;
      return currMeta;
    });
    setSystem(currSystem => {
      currSystem.stations[station.id] = station;
      currSystem.manualUpdate++;
      return currSystem;
    });
    setChanging({
      stationIds: [ station.id ]
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
      category: 'Action',
      action: 'Add New Station'
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
        currSystem.stations[station.id] = station;
        return currSystem;
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

  const getNearestIndex = (currSystem, lineKey, station) => {
    const line = currSystem.lines[lineKey];
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

  // TODO: see where this should live
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
        currSystem.stations[stationId] = { ...station, ...info };
        return currSystem
      });
    } else {
      setSystem(currSystem => {
        currSystem.stations[stationId] = { ...station, ...info };
        currSystem.manualUpdate++;
        return currSystem
      });
      setRecent(recent => {
        recent.stationId = station.id;
        return recent;
      });
      ReactGA.event({
        category: 'Action',
        action: 'Change Station Info'
      });
    }

    setFocus(currFocus => {
      // update focus if this station is focused
      if ('station' in currFocus && currFocus.station.id === stationId) {
        return { station: { ...station, ...info } };
      }
      return currFocus;
    });
    setChanging({});
    setIsSaved(false);
  }

  const handleAddStationToLine = (lineKey, station, position) => {
    setSystem(currSystem => {
      let line = currSystem.lines[lineKey];

      if (!line) return currSystem;

      if (position !== 0 && !position) {
        position = getNearestIndex(currSystem, lineKey, station);
      }

      if (position === 0) {
        line.stationIds = [station.id].concat(line.stationIds);
      } else if (position < line.stationIds.length) {
        line.stationIds.splice(position, 0, station.id);
      } else {
        line.stationIds = line.stationIds.concat([station.id]);
      }

      currSystem.lines[lineKey] = line;
      currSystem.manualUpdate++;
      return currSystem;
    });

    setChanging({
      lineKeys: [ lineKey ],
      stationIds: [ station.id ]
    });
    setFocus({
      station: station
    });
    setRecent({
      lineKey: lineKey,
      stationId: station.id
    });
    setIsSaved(false);
    refreshInterlineSegments();

    ReactGA.event({
      category: 'Action',
      action: `Add ${station.isWaypoint ? 'Waypoint' : 'Station'} to Line`
    });
  }

  const handleStationDelete = (station) => {
    let modifiedLines = [];
    for (const lineKey in system.lines) {
      const stationCountBefore = system.lines[lineKey].stationIds.length;
      const stationCountAfter = system.lines[lineKey].stationIds.filter(sId => sId !== station.id).length;
      if (stationCountBefore !== stationCountAfter) {
        modifiedLines.push(lineKey);
      }
    }

    setSystem(currSystem => {
      delete currSystem.stations[station.id];
      for (const lineKey of modifiedLines) {
        currSystem.lines[lineKey].stationIds = currSystem.lines[lineKey].stationIds.filter(sId => sId !== station.id);
      }
      currSystem.manualUpdate++;
      return currSystem;
    });
    setChanging({
      lineKeys: modifiedLines,
      stationIds: [ station.id ]
    });
    setFocus({});
    setRecent(recent => {
      delete recent.stationId;
      return recent;
    });
    setIsSaved(false);
    refreshInterlineSegments();

    ReactGA.event({
      category: 'Action',
      action: `Delete ${station.isWaypoint ? 'Waypoint' : 'Station'}`
    });
  }

  const handleConvertToWaypoint = (station) => {
    station.isWaypoint = true;
    delete station.name;
    delete station.info;

    setSystem(currSystem => {
      currSystem.stations[station.id] = station;
      currSystem.manualUpdate++;
      return currSystem;
    });
    setChanging({
      stationIds: [ station.id ],
      lineKeys: Object.values(system.lines)
                  .filter(line => line.stationIds.includes(station.id))
                  .map(line => line.id)
    });
    setFocus({
      station: station
    });
    setRecent({
      stationId: station.id
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Action',
      action: 'Convert to Waypoint'
    });
  }

  const handleConvertToStation = (station) => {
    delete station.isWaypoint;
    station.name = 'Station Name';
    getStationName(station);

    setSystem(currSystem => {
      currSystem.stations[station.id] = station;
      currSystem.manualUpdate++;
      return currSystem;
    });
    setChanging({
      stationIds: [ station.id ],
      lineKeys: Object.values(system.lines)
                  .filter(line => line.stationIds.includes(station.id))
                  .map(line => line.id)
    });
    setFocus({
      station: station
    });
    setRecent({
      stationId: station.id
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Action',
      action: 'Convert to Station'
    });
  }

  const handleLineInfoChange = (line, renderMap) => {
    setSystem(currSystem => {
      currSystem.lines[line.id] = line;
      currSystem.manualUpdate++;
      return currSystem;
    });
    setFocus({
      line: line
    });
    setRecent(recent => {
      recent.lineKey = line.id;
      return recent;
    });
    setIsSaved(false);

    if (renderMap) {
      setChanging({
        lineKeys: [ line.id ]
      })
      refreshInterlineSegments();
    }

    ReactGA.event({
      category: 'Action',
      action: 'Change Line Info'
    });
  }

  const handleRemoveStationFromLine = (line, stationId) => {
    line.stationIds = line.stationIds.filter(sId => sId !== stationId);

    setSystem(currSystem => {
      currSystem.lines[line.id] = line;
      currSystem.manualUpdate++;
      return currSystem;
    });
    setChanging({
      lineKeys: [ line.id ],
      stationIds: [ stationId ]
    });
    setFocus({
      line: line
    });
    setRecent({
      lineKey: line.id,
      stationId: stationId
    });
    setIsSaved(false);
    refreshInterlineSegments();

    ReactGA.event({
      category: 'Action',
      action: 'Remove Station from Line'
    });
  }

  const handleRemoveWaypointsFromLine = (line, waypointIds) => {
    line.stationIds = line.stationIds.filter(sId => !waypointIds.includes(sId));

    setSystem(currSystem => {
      currSystem.lines[line.id] = line;
      currSystem.manualUpdate++;
      return currSystem;
    });
    setChanging({
      lineKeys: [ line.id ],
      stationIds: waypointIds
    });
    setFocus({
      line: line
    });
    setRecent({
      lineKey: line.id
    });
    setIsSaved(false);
    refreshInterlineSegments();

    ReactGA.event({
      category: 'Action',
      action: 'Remove Waypoints from Line'
    });
  }

  const handleReverseStationOrder = (line) => {
    line.stationIds = line.stationIds.slice().reverse();

    setSystem(currSystem => {
      currSystem.lines[line.id] = line;
      currSystem.manualUpdate++;
      return currSystem;
    });
    setChanging({
      lineKeys: [ line.id ]
    });
    setFocus({
      line: line
    });
    setRecent({
      lineKey: line.id
    });
    setIsSaved(false);

    ReactGA.event({
      category: 'Action',
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

    return nextLine;
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
      currSystem.lines[lineKey] = nextLine;
      currSystem.manualUpdate++;
      return currSystem;
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
    setChanging({});
    setIsSaved(false);

    ReactGA.event({
      category: 'Action',
      action: 'Add New Line'
    });
  }

  const handleLineDelete = (line) => {
    setSystem(currSystem => {
      delete currSystem.lines[line.id];
      currSystem.manualUpdate++;
      return currSystem;
    });
    setChanging({
      lineKeys: [ line.id ],
      stationIds: line.stationIds,
    });
    setFocus({});
    setRecent(recent => {
      delete recent.lineKey;
      return recent;
    });
    setIsSaved(false);
    refreshInterlineSegments();

    ReactGA.event({
      category: 'Action',
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
      currSystem.lines[forkedLine.id] = forkedLine;
      currSystem.manualUpdate++;
      return currSystem;
    });
    setChanging({
      lineKeys: [ forkedLine.id ]
    });
    setFocus({
      line: forkedLine
    });
    setRecent(recent => {
      recent.lineKey = forkedLine.id;
      return recent;
    });

    ReactGA.event({
      category: 'Action',
      action: 'Fork Line'
    });
  }

  const mainClass = `Edit SystemWrap ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <main className={mainClass}>
      <System ownerDocData={ownerDocData}
              systemDocData={systemDocData}
              isNew={isNew}
              newMapBounds={newMapBounds}
              viewOnly={false}
              system={system}
              history={history}
              meta={meta}
              isSaved={isSaved}
              isPrivate={isPrivate}
              waypointsHidden={waypointsHidden}
              recent={recent}
              changing={changing}
              interlineSegments={interlineSegments}
              focusFromEdit={focus}
              toastFromEdit={toast}
              onToggleShowAuth={onToggleShowAuth}
              onToggleShowSettings={onToggleShowSettings}
              preToggleMapStyle={() => setChanging({})}
              onToggleMapStyle={() => setChanging(currChanging => {
                const allValue = currChanging.all ? currChanging.all : 1;
                return { all: allValue + 1 };
              })}
              handleSave={handleSave}
              handleTogglePrivate={handleTogglePrivate}
              handleAddStationToLine={handleAddStationToLine}
              handleStationDelete={handleStationDelete}
              handleConvertToWaypoint={handleConvertToWaypoint}
              handleConvertToStation={handleConvertToStation}
              handleLineInfoChange={handleLineInfoChange}
              handleRemoveStationFromLine={handleRemoveStationFromLine}
              handleRemoveWaypointsFromLine={handleRemoveWaypointsFromLine}
              handleReverseStationOrder={handleReverseStationOrder}
              handleLineDelete={handleLineDelete}
              handleLineDuplicate={handleLineDuplicate}
              handleMapClick={handleMapClick}
              handleToggleWaypoints={handleToggleWaypoints}
              handleUndo={handleUndo}
              handleAddLine={handleAddLine}
              handleGetTitle={handleGetTitle} />
    </main>
  );
}
