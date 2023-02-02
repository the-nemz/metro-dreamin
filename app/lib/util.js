// Utilities shared across components

import React from 'react';
import { TransitionGroup, CSSTransition } from 'react-transition-group';

import {
  LINE_MODES, DEFAULT_LINE_MODE, USER_ICONS, COLOR_TO_FILTER,
  ACCESSIBLE, BICYCLE, BUS, CITY, CLOUD, FERRY,
  GONDOLA, METRO, PEDESTRIAN, SHUTTLE, TRAIN, TRAM
} from '/lib/constants.js';

export function getMode(key) {
  const modeObject = LINE_MODES.reduce((obj, m) => {
    obj[m.key] = m
    return obj;
  }, {});

  return modeObject[key || ''] ? modeObject[key || ''] : modeObject[DEFAULT_LINE_MODE];
}

export function hexToRGB(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    R: parseInt(result[1], 16),
    G: parseInt(result[2], 16),
    B: parseInt(result[3], 16)
  } : null;
}

export function rgbToHex(rgb) {
  const { R, G, B } = rgb;

  if (R == null || G == null || B == null) {
    return null;
  }

  const componentToHex = (c) => {
    var hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  return '#' + componentToHex(R) + componentToHex(G) + componentToHex(B);
}

export function getLuminance(hex) {
  const { R, G, B } = hexToRGB(hex);

  if (R == null || G == null || B == null) {
    return 0;
  }

  return (0.2126 * R) + (0.7152 * G) + (0.0722 * B);
}

export function sortLines(a, b) {
  const aName = a.name.toUpperCase();
  const bName = b.name.toUpperCase();
  const partsA = aName.split(' ');
  const partsB = bName.split(' ');

  const firstA = parseInt(partsA[0]);
  const firstB = parseInt(partsB[0]);
  const lastA = parseInt(partsA[partsA.length - 1]);
  const lastB = parseInt(partsB[partsB.length - 1]);

  if (!isNaN(firstA) && !isNaN(firstB)) {
    return firstA === firstB ? (aName > bName ? 1 : -1) : firstA - firstB;
  } else if (!isNaN(lastA) && !isNaN(lastB)) {
    return lastA === lastB ? (aName > bName ? 1 : -1) : lastA - lastB;
  } else {
    return aName > bName ? 1 : -1
  }
}

// alphebetizes systemDocs and/or fullSystems
export function sortSystems(a, b) {
  const aTitle = a.map ? a.map.title : a.title;
  const bTitle = b.map ? b.map.title : b.title;
  return (aTitle ? aTitle : '').toLowerCase() > (bTitle ? bTitle : '').toLowerCase() ? 1 : -1;
}

// rudimentary ranking of systemDocs based on stars, numStations/numWaypoints, and lastUpdated
export function rankSystems(a, b) {
  const aStars = a.stars || 0;
  const bStars = b.stars || 0;
  const aStations = a.numStations || 0;
  const bStations = b.numStations || 0;
  const aWaypoints = a.numWaypoints || 0;
  const bWaypoints = b.numWaypoints || 0;
  const aSWScore = (aStations * 3) + aWaypoints;
  const bSWScore = (bStations * 3) + bWaypoints;

  if (aStars !== bStars) {
    return bStars - aStars;
  } else if (aSWScore !== bSWScore) {
    return bSWScore - aSWScore;
  }
  return b.lastUpdated - a.lastUpdated;
}

export function getPartsFromSystemId(systemId) {
  const decodedParts = window.atob(systemId).split('|');
  const uid = decodedParts[0];
  const sysNumStr = decodedParts[1];
  return {
    userId: uid,
    systemNumStr: sysNumStr
  };
}

export function getSystemId(userId, systemNumStr) {
  return Buffer.from(`${userId}|${systemNumStr}`).toString('base64');
}

export function getViewPath(userId, systemNumStr) {
  return `/view/${encodeURIComponent(getSystemId(userId, systemNumStr))}`;
}

export function getViewURL(userId, systemNumStr) {
  return `${window.location.origin}${getViewPath(userId, systemNumStr)}`;
}

export function getEditPath(userId, systemNumStr) {
  return `/edit/${encodeURIComponent(getSystemId(userId, systemNumStr))}`;
}

export function getEditURL(userId, systemNumStr) {
  return `${window.location.origin}${getEditPath(userId, systemNumStr)}`;
}

export function getShareableSystemURL(systemId) {
  return `${window.location.origin}/view/${systemId}`;
}

export function checkForTransfer(stationId, currLine, otherLine, stations) {
  const currStationIds = currLine.stationIds.filter(sId => stations[sId] && !stations[sId].isWaypoint && !(currLine.waypointOverrides || []).includes(sId));
  const otherStationIds = otherLine.stationIds.filter(sId => stations[sId] && !stations[sId].isWaypoint && !(otherLine.waypointOverrides || []).includes(sId));

  if (currStationIds.includes(stationId) && otherStationIds.includes(stationId)) {
    const positionA = currStationIds.indexOf(stationId);
    const positionB = otherStationIds.indexOf(stationId);
    const aAtEnd = positionA === 0 || positionA === currStationIds.length - 1;
    const bAtEnd = positionB === 0 || positionB === otherStationIds.length - 1
    if (aAtEnd ? !bAtEnd : bAtEnd) {
      // Connection at start or end
      return true;
    }

    const thisPrev = currStationIds[Math.max(0, positionA - 1)];
    const thisNext = currStationIds[Math.min(currStationIds.length - 1, positionA + 1)];
    if (!otherStationIds.includes(thisPrev) || !otherStationIds.includes(thisNext)) {
      // Connection is not present at previous and/or next station of otherLine
      return true;
    }

    const otherPrev = otherStationIds[Math.max(0, positionB - 1)];
    const otherNext = otherStationIds[Math.min(otherStationIds.length - 1, positionB + 1)];
    if (!currStationIds.includes(otherPrev) || !currStationIds.includes(otherNext)) {
      // Connection is not present at previous and/or next station of line
      return true;
    }
  }

  return false;
}

export function floatifyStationCoord(station) {
  if (station == null) {
    return station;
  }

  let { lng, lat } = station;
  if (typeof lng === 'string') {
    station.lng = parseFloat(lng)
  }
  if (typeof lat === 'string') {
    station.lat = parseFloat(lat)
  }
  return station;
}

export function stationIdsToCoordinates(stations, stationIds) {
  let coords = [];
  for (const sId of (stationIds || [])) {
    if (!stations[sId]) continue;
    let { lng, lat } = floatifyStationCoord(stations[sId]);
    coords.push([ lng, lat ]);
  }
  return coords;
}

// split a line into sections
// a section is the path between two non-waypoint stations, or a waypoint at the end of a line
export function partitionSections(line, stations) {
  let sections = [];
  let section = [];
  for (const [i, sId] of line.stationIds.entries()) {
    section.push(sId);
    if (i === 0) continue;
    if (!stations[sId]) continue;
    const isWaypointForLine = stations[sId].isWaypoint || (line.waypointOverrides || []).includes(sId);
    // if stationId is not in list of waypointOverrides
    if (!isWaypointForLine || i === line.stationIds.length - 1) {
      sections.push(section);
      section = [ sId ];
    }
  }

  return sections;
}

// check if the two target stationIds appear adjacent to one another in target line
// a station may appear >1 time in a line if there is a loop
function _areAdjacentInLine(lineBeingChecked, currStationId, nextStationId) {
  const indicesOfCurrStation = lineBeingChecked.stationIds.reduce((indices, sId, index) => {
    if (sId === currStationId) indices.push(index);
    return indices;
  }, []);

  const indicesOfNextStation = lineBeingChecked.stationIds.reduce((indices, sId, index) => {
    if (sId === nextStationId) indices.push(index);
    return indices;
  }, []);

  if (indicesOfCurrStation.length && indicesOfNextStation.length) {
    // handle cases where one of the station appears multiple times in a line
    for (const indexOfCurrStation of indicesOfCurrStation) {
      for (const indexOfNextStation of indicesOfNextStation) {
        if (Math.abs(indexOfCurrStation - indexOfNextStation) === 1) {
          // if stations are next to each other in lineBeingChecked
          return true;
        }
      }
    }
  }
  return false;
}

// check each pair of stations to find all colors along that go between the pair
// if >1 color, it is a "miniInterlineSegment"
function _buildMiniInterlineSegments(lineKeys, system) {
  let miniInterlineSegments = {};
  for (const lineKey of lineKeys) {
    const line = system.lines[lineKey];

    for (let i = 0; i < line.stationIds.length - 1; i++) {
      const currStationId = line.stationIds[i];
      const nextStationId = line.stationIds[i + 1];
      const orderedPair = [currStationId, nextStationId].sort();

      const currStation = floatifyStationCoord(system.stations[currStationId]);
      const nextStation = floatifyStationCoord(system.stations[nextStationId]);

      if (!currStation || !nextStation) continue;

      for (const lineKeyBeingChecked in system.lines) {
        const lineBeingChecked = system.lines[lineKeyBeingChecked];

        if (line.color !== lineBeingChecked.color) { // don't bother checking lines with the same color
          if (_areAdjacentInLine(lineBeingChecked, currStationId, nextStationId)) {
            const segmentKey = orderedPair.join('|');
            let colorsInSegment = [ line.color ];
            if (segmentKey in miniInterlineSegments) {
              colorsInSegment = miniInterlineSegments[segmentKey].colors;
              if (colorsInSegment.includes(lineBeingChecked.color)) {
                // another line in this segment has the same color
                break;
              }
            }
            colorsInSegment.push(lineBeingChecked.color);
            colorsInSegment = [...new Set(colorsInSegment)]; // remove duplicates

            miniInterlineSegments[segmentKey] = {
              stationIds: [currStationId, nextStationId],
              colors: colorsInSegment.sort()
            };
          }
        }
      }
    }
  }

  return miniInterlineSegments;
}

// calculate how far a color in an interlineSegment should be shifted left or right
function _calculateOffsets(colors, thickness) {
  let offsets = {};
  const centered = colors.length % 2 === 1; // center if odd number of lines
  let moveNegative = false;

  for (const [i, color] of colors.entries()) {
    const displacement = thickness;
    let offsetDistance = 0;
    if (centered) {
      offsetDistance = Math.floor((i + 1) / 2) * displacement;
    } else {
      offsetDistance = (thickness / 2) + (Math.floor((i) / 2) * displacement);
    }

    offsets[color] = offsetDistance * (moveNegative ? -1 : 1);
    moveNegative = !moveNegative;
  }

  return offsets;
}

// collect all the miniInterLineSegemnts into the longest sequences possible that share the same colors
// return a map of interlineSegments keyed by the station in the segment "stationId1|stationId2|..."
function _accumulateInterlineSegments(miniInterlineSegmentsByColors, thickness) {
  let interlineSegments = {};
  for (const [colorsJoined, miniInterlineSegments] of Object.entries(miniInterlineSegmentsByColors)) {
    let miniSegmentsSet = new Set(miniInterlineSegments);
    let currMiniSegs = miniInterlineSegments;

    while (miniSegmentsSet.size > 0) {
      let accumulator = currMiniSegs[0].stationIds;
      miniSegmentsSet.delete(currMiniSegs[0]);

      currMiniSegs = currMiniSegs.slice(1);
      let doneAccumulating = currMiniSegs.length === 0;
      while (!doneAccumulating) {
        doneAccumulating = true;
        for (let i = 0; i < currMiniSegs.length; i++) {
          let currMiniSeg = currMiniSegs[i];
          if (accumulator[0] === currMiniSeg.stationIds[0]) {
            accumulator = [ currMiniSeg.stationIds[1], ...accumulator ];
            miniSegmentsSet.delete(currMiniSeg);
            doneAccumulating = false;
          } else if (accumulator[0] === currMiniSeg.stationIds[1]) {
            accumulator = [ currMiniSeg.stationIds[0], ...accumulator ];
            miniSegmentsSet.delete(currMiniSeg);
            doneAccumulating = false;
          } else if (accumulator[accumulator.length - 1] === currMiniSeg.stationIds[0]) {
            accumulator = [ ...accumulator, currMiniSeg.stationIds[1] ];
            miniSegmentsSet.delete(currMiniSeg);
            doneAccumulating = false;
          } else if (accumulator[accumulator.length - 1] === currMiniSeg.stationIds[1]) {
            accumulator = [ ...accumulator, currMiniSeg.stationIds[0] ];
            miniSegmentsSet.delete(currMiniSeg);
            doneAccumulating = false;
          }
        }
        currMiniSegs = Array.from(miniSegmentsSet);
      }


      let colors = colorsJoined.split('-');
      interlineSegments[accumulator.join('|')] = {
        stationIds: accumulator,
        colors: colors,
        offsets: _calculateOffsets(colors, thickness)
      };
    }
  }

  return interlineSegments;
}

// get a map of all the sequences of stations that are shared by multiple lines along with how far
// the colors on that line should be visially shifted
export function buildInterlineSegments(system, lineKeys = [], thickness = 8) {
  const lineKeysToHandle = lineKeys && lineKeys.length ? lineKeys : Object.keys(system.lines);
  const miniInterlineSegments = _buildMiniInterlineSegments(lineKeysToHandle, system);

  const miniInterlineSegmentsByColors = {};
  for (const mIS of Object.values(miniInterlineSegments)){
    const colorsJoined = mIS.colors.join('-');
    if (colorsJoined in miniInterlineSegmentsByColors) {
      miniInterlineSegmentsByColors[colorsJoined].push(mIS);
    } else {
      miniInterlineSegmentsByColors[colorsJoined] = [ mIS ];
    }
  }

  return _accumulateInterlineSegments(miniInterlineSegmentsByColors, thickness);
}

export function diffInterlineSegments(oldInterlineSegments, newInterlineSegments) {
  const oldKeys = new Set(Object.keys(oldInterlineSegments));
  const newKeys = new Set(Object.keys(newInterlineSegments));
  const targetKeys = new Set(Object.keys(oldInterlineSegments).concat(Object.keys(newInterlineSegments)));

  for (const oldKey of Array.from(oldKeys)) {
    if (newKeys.has(oldKey) &&
        oldInterlineSegments[oldKey].colors.join() === newInterlineSegments[oldKey].colors.join() &&
        JSON.stringify(oldInterlineSegments[oldKey].offsets) === JSON.stringify(newInterlineSegments[oldKey].offsets)) {
      targetKeys.delete(oldKey);
    } else {
      // do nothing
    }
  }

  return Array.from(targetKeys);
}

export function getDistance(station1, station2) {
  const unit = 'M';
  const lat1 = station1.lat;
  const lon1 = station1.lng;
  const lat2 = station2.lat;
  const lon2 = station2.lng;

  if ((lat1 === lat2) && (lon1 === lon2)) {
    return 0;
  } else {
    let radlat1 = Math.PI * lat1 / 180;
    let radlat2 = Math.PI * lat2 / 180;
    let theta = lon1 - lon2;
    let radtheta = Math.PI * theta / 180;
    let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);

    if (dist > 1) {
      dist = 1;
    }

    dist = Math.acos(dist);
    dist = dist * 180 / Math.PI;
    dist = dist * 60 * 1.1515;

    if (unit === 'K') {
      dist = dist * 1.609344
    }
    return dist;
  }
}

export function timestampToText(timestamp) {
  const datetime = new Date(timestamp);
  const diffTime = Date.now() - datetime.getTime();
  let timeText = datetime.toLocaleString();
  if (diffTime < 1000 * 60) {
    // in the last minute
    timeText = 'Just now!';
  } else if (diffTime < 1000 * 60 * 60) {
    // in the last hour
    const numMins = Math.round(diffTime / (1000 * 60));
    timeText = `${numMins} ${numMins === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffTime < 1000 * 60 * 60 * 24) {
    // in the last day
    const numHours = Math.round(diffTime / (1000 * 60 * 60));
    timeText = `${numHours} ${numHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffTime < 1000 * 60 * 60 * 24 * 7) {
    // in the last week
    const numDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    timeText = `${numDays} ${numDays === 1 ? 'day' : 'days'} ago`;
  } else {
    const numWeeks = Math.round(diffTime / (1000 * 60 * 60 * 24 * 7));
    timeText = `${numWeeks} ${numWeeks === 1 ? 'week' : 'weeks'} ago`;
  }

  return timeText;
}

export function getNextSystemNumStr(settings) {
  if (settings && settings.systemsCreated) {
    return `${settings.systemsCreated}`;
  } else if (settings && (settings.systemIds || []).length) {
    // for backfilling
    const intIds = settings.systemIds.map((a) => parseInt(a));
    return `${Math.max(...intIds) + 1}`;
  } else {
    return '0';
  }
}

// returns a map with the info about an icon and a url path for the image
export function getUserIcon(userDocData) {
  let icon;
  if (userDocData.icon && userDocData.icon.key && userDocData.icon.key in USER_ICONS) {
    icon = USER_ICONS[userDocData.icon.key];
  } else {
    const defaultChoices = Object.values(USER_ICONS).filter((uI) => uI.default);
    const mod = (userDocData.creationDate || 0) % defaultChoices.length;
    icon = defaultChoices[mod];
  }

  let svg;
  switch (icon.key) {
    case 'ACCESSIBLE':
      svg = ACCESSIBLE;
      break;
    case 'BICYCLE':
      svg = BICYCLE;
      break;
    case 'BUS':
      svg = BUS;
      break;
    case 'CITY':
      svg = CITY;
      break;
    case 'CLOUD':
      svg = CLOUD;
      break;
    case 'FERRY':
      svg = FERRY;
      break;
    case 'GONDOLA':
      svg = GONDOLA;
      break;
    case 'METRO':
      svg = METRO;
      break;
    case 'PEDESTRIAN':
      svg = PEDESTRIAN;
      break;
    case 'SHUTTLE':
      svg = SHUTTLE;
      break;
    case 'TRAIN':
      svg = TRAIN;
      break;
    case 'TRAM':
      svg = TRAM;
      break;
    default:
      svg = METRO;
      break;
  }

  return {
    icon: icon,
    path: svg
  };
}

// returns a map of a hex value and a CSS filter
export function getUserColor(userDocData) {
  let color;
  let filter;
  if (userDocData.icon && userDocData.icon.color && userDocData.icon.color in COLOR_TO_FILTER) {
    color = userDocData.icon.color;
    filter = COLOR_TO_FILTER[color];
  } else {
    const colors = Object.keys(COLOR_TO_FILTER);
    const mod = (userDocData.creationDate || 0) % colors.length;
    color = colors[mod];
    filter = COLOR_TO_FILTER[color];
  }

  return {
    color: color,
    filter: filter
  };
}

// returns a drop shadow for use on user icons
// param should be 'dark' or 'light
export function getIconDropShadow(type = 'dark') {
  let hex;
  if (type === 'dark') {
    hex = '#000000';
  } else if (type === 'light') {
    hex = '#ffffff';
  } else {
    console.warn('getIconDropShadow error: type parameter must be "dark" or "light"');
    return '';
  }

  return `drop-shadow(1px 0 0 ${hex}) drop-shadow(-1px 0 0 ${hex}) drop-shadow(0 1px 0 ${hex}) drop-shadow(0 -1px 0 ${hex})`;
}

export async function addAuthHeader(user, req) {
  if (user) {
    req.setRequestHeader('Authorization', 'Bearer ' + await user.getIdToken());
  }
  return req;
}

export function renderFadeWrap(item, key) {
  return (
    <TransitionGroup>
      {(item ? [item] : []).map(elem => (
        <CSSTransition classNames="FadeAnim" key={key} timeout={400}>
          {elem}
        </CSSTransition>
      ))}
    </TransitionGroup>
  );
}

export function renderFocusWrap(item, key) {
  return (
    <TransitionGroup>
      {(item ? [item] : []).map(elem => (
        <CSSTransition classNames="FocusAnim" key={key} timeout={400}>
          {elem}
        </CSSTransition>
      ))}
    </TransitionGroup>
  );
}

/**
   * Handling the fullscreen functionality via the fullscreen API
   *
   * @see http://fullscreen.spec.whatwg.org/
   * @see https://developer.mozilla.org/en-US/docs/DOM/Using_fullscreen_mode
   */
 export function enterFullscreen(element) {
  // Check which implementation is available
  var requestMethod = element.requestFullScreen ||
                      element.webkitRequestFullscreen ||
                      element.webkitRequestFullScreen ||
                      element.mozRequestFullScreen ||
                      element.msRequestFullscreen ||
                      element.webkitEnterFullscreen;

  if (requestMethod) {
    requestMethod.apply(element);
  }
}

export function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.webkitExitFullScreen) {
    document.webkitExitFullScreen();
  } else if (document.mozExitFullScreen) {
    document.mozExitFullScreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}
