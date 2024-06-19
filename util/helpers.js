// Utilities shared across components

import React from 'react';
import { TransitionGroup, CSSTransition } from 'react-transition-group';
import { greatCircle as turfGreatCircle } from '@turf/turf';
import { lineString as turfLineString } from '@turf/helpers';
import turfLineIntersect from "@turf/line-intersect";

import {
  LINE_MODES, DEFAULT_LINE_MODE, USER_ICONS, COLOR_TO_FILTER, SYSTEM_LEVELS, COLOR_TO_NAME,
  ACCESSIBLE, BICYCLE, BUS, CITY, CLOUD, FERRY,
  GONDOLA, METRO, PEDESTRIAN, SHUTTLE, TRAIN, TRAM, USER_BASIC, LINE_ICONS_PNG_DIR,
  LINE_ICON_SHAPE_SET,
  LINE_ICONS_SVG_DIR
} from '/util/constants.js';

export function getMode(key) {
  const modeObject = LINE_MODES.reduce((obj, m) => {
    obj[m.key] = m
    return obj;
  }, {});

  return modeObject[key || ''] ? modeObject[key || ''] : modeObject[DEFAULT_LINE_MODE];
}

// returns a level object based on key, avgSpacing, or radius. key is prioritized.
export function getLevel({ key, avgSpacing, radius }) {
  if (!key && !avgSpacing && !radius) {
    console.log('getLevel error: key, avgSpacing, or radius is required');
    return;
  }

  // SYSTEM_LEVELS thresholds are increasing in order
  for (const level of SYSTEM_LEVELS) {
    if (key) {
      if (key === level.key) return level;
    } else if (avgSpacing) {
      if (avgSpacing < level.spacingThreshold) return level;
    } else if (radius) {
      if (radius < level.radiusThreshold) return level;
    }
  }

  console.log(`getLevel error: no level with key ${key} or avgSpacing ${avgSpacing}`);
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

export const getLineIconPath = (shape, colorName) => `${LINE_ICONS_PNG_DIR}/${shape}-${colorName}.png`;
export const getSvgLineIconPath = (shape) => `${LINE_ICONS_SVG_DIR}/${shape}.svg`;

export const getLineColorIconStyle = (line = {}) => {
  let styles = {
    parent: {
      position: 'relative',
      backgroundColor: getLuminance(line.color) > 128 ? '#000000' : '#ffffff'
    }
  }
  if (LINE_ICON_SHAPE_SET.has(line.icon || '') &&
      (line.color || '') in COLOR_TO_NAME) {
    const iconPath = getSvgLineIconPath(line.icon);
    styles.child = {
      position: 'absolute',
      width: '100%',
      height: '100%',
      top: 0,
      left: 0,
      backgroundImage: `url("${iconPath}")`,
      backgroundSize: '80% 80%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      filter: `${COLOR_TO_FILTER[line.color]}`
    };
  } else {
    styles.child = {
      position: 'absolute',
      width: '100%',
      height: '100%',
      top: 0,
      left: 0,
      backgroundColor: line.color
    };
  }
  return styles;
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
  return `${window.location.origin}/view/${encodeURIComponent(systemId)}`;
}

export function getSystemBlobId(systemId, useLight = false) {
  if (useLight) {
    return `${encodeURIComponent(systemId)}/light.png`;
  } else {
    return `${encodeURIComponent(systemId)}/dark.png`;
  }
}

export async function getTransfersFromWorker(transfersWorker, { lines, stations, interchanges }) {
  if (!transfersWorker) return {};

  return new Promise((resolve, reject) => {
    const messageHandler = (event) => {
        if (event.data) {
          resolve(event.data);
        } else {
          reject({});
        }
        // remove the event listener to prevent memory leaks
        transfersWorker.removeEventListener('message', messageHandler);
    };

    // listen for messages from the worker
    transfersWorker.addEventListener('message', messageHandler);

    // send the message to the worker
    transfersWorker.postMessage({ lines, stations, interchanges });
  });
}

// for a given stationId, determine the lines that the stationId is on and any transfers between lines at that station
// the values in stopsByLineId are the same as line.stationIds, excluding waypoints and waypointOverrides
export function getTransfersForStation(stationId, lines, stopsByLineId) {
  if (!stationId || !lines || !stopsByLineId) return { onLines: [], hasTransfers: [] };

  const onLines = [];
  const hasTransfers = [];
  const transferSet = new Set();

  for (const currId in lines) {
    if (!(lines[currId].stationIds || []).includes(stationId)) continue;

    const isWO = (lines[currId].waypointOverrides || []).includes(stationId);
    onLines.push({ lineId: currId, isWaypointOverride: isWO });

    for (const otherId in lines) {
      if (currId === otherId) continue;

      const checkStr = currId > otherId ? `${currId}|${otherId}` : `${otherId}|${currId}`;
      if (!transferSet.has(checkStr) &&
          checkForTransfer(stationId, stopsByLineId[currId], stopsByLineId[otherId])) {
        hasTransfers.push([ currId, otherId ]);
        transferSet.add(checkStr)
      }
    }
  }

  return { onLines, hasTransfers };
}

// check for transfer, taking into account neighboring transfers and waypoint overrides
export function checkForTransfer(stationId, currStationIds, otherStationIds) {
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

export function hasWalkingTransfer(line, interchange) {
  if (!line || !interchange) return false;

  for (const interchangeId of (interchange.stationIds || [])) {
    if (line.stationIds.includes(interchangeId) &&
        !(line.waypointOverrides || []).includes(interchangeId)) {
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

/**
 * Rounds a coordinate to a specified precision.
 * @param {object} objectWithCoord any object that includes lat and lng properties representing a coordinate
 * @param {number} precision the integer number of decimal places to keep
 * @returns a copy of the original object with lat and lng having [precision] decimals
 */
export function roundCoordinate(objectWithCoord, precision = 3) {
  if (!objectWithCoord || typeof objectWithCoord.lat !== 'number'  || typeof objectWithCoord.lng !== 'number') {
    console.error('trimCoordinate error: malformed objectWithCoord');
    return objectWithCoord;
  };

  const lat = trimDecimals(objectWithCoord.lat, precision);
  const lng = trimDecimals(objectWithCoord.lng, precision);

  return { ...objectWithCoord, lat, lng };
}

/**
 * Rounds a float to a specified number of decimal places.
 * @param {number} float the number ot be rounded
 * @param {int} precision the number of decimals, defaulting to 4
 */
export function trimDecimals(float, precision = 3) {
  const multiplier = 10 ** precision;
  return Math.round(float * multiplier) / multiplier;
}

/**
 * Converts an array of stationIds into an array of coordintes in the format [ lng, lat ]
 * @param {*} stations the stations in the system
 * @param {*} stationIds the list of ids to convert to coordinates
 * @returns {[ coordinate ]} the array of coordinates with the format [ lng, lat ]
 */
export function stationIdsToCoordinates(stations, stationIds) {
  let coords = [];
  for (const sId of (stationIds || [])) {
    if (!stations[sId]) continue;
    const station = floatifyStationCoord(stations[sId]);
    if (!(station && 'lng' in station && 'lat' in station)) continue;
    coords.push([ normalizeLongitude(station.lng), station.lat ]);
  }
  return coords;
}


/**
 * Converts an array of stationIds into an array of arrays of format [ lng, lat ]. If a
 * pair of coordinates in the array are more than 300 miles apart, it will calculate and
 * use a great circle for the pair. Otherwise, if the coordinates do not cross the
 * antimeridian, there will be only one subarray. There will be an additional subarray for
 * each crossing of the antimeridian, with the last and/or first entry having a longitude
 * of 180 or -180 depending on the direction of the crossing.
 * @param {*} stations the stations in the system
 * @param {*} stationIds the list of ids to convert to coordinates
 * @returns {[[ coordinate ]]} the array of arrays of coordinates with the format [ lng, lat ]
 */
export function stationIdsToMultiLineCoordinates(stations, stationIds) {
  const coords = stationIdsToCoordinates(stations,stationIds);
  const antimeridianPositive = turfLineString([[ 180, 89.9 ], [ 180, -89.9 ]]);
  const antimeridianNegative = turfLineString([[ -180, 89.9 ], [ -180, -89.9 ]]);

  let multilineCoords = [];
  let lineCoords = [];
  let prevCoord;
  for (const coord of coords) {
    if (prevCoord && getDistance({ lng: prevCoord[0], lat: prevCoord[1] }, { lng: coord[0], lat: coord[1] }) >= 300) {
      // long distance pair, use great circle
      const gCircle = turfGreatCircle(prevCoord, coord);
      const stringType = gCircle?.geometry?.type ?? '';
      switch (stringType) {
        case 'LineString':
          multilineCoords.push(lineCoords);
          if (gCircle?.geometry?.coordinates?.length) {
            multilineCoords.push(gCircle.geometry.coordinates);
          }
          lineCoords = [ coord ];
          break;
        case 'MultiLineString':
          multilineCoords.push(lineCoords);
          if (gCircle?.geometry?.coordinates?.length) {
            multilineCoords.push(...gCircle.geometry.coordinates);
          }
          lineCoords = [ coord ];
          break;
        default:
          break;
      }
    } else if (prevCoord && Math.abs(coord[0] - prevCoord[0]) > 180) {
      // pair crosses antimeridian
      const tempLng = prevCoord[0] + (prevCoord[0] < 0 ? 360 : -360);
      const tempCoord = [ tempLng, prevCoord[1] ];
      const segment = turfLineString([ tempCoord, coord ]);
      const intersectPostive = turfLineIntersect(segment, antimeridianPositive);
      const intersectNegative = turfLineIntersect(segment, antimeridianNegative);

      let intersectionLatPositive = null;
      let intersectionLatNegative = null;
      if (intersectPostive?.features?.[0]?.geometry?.coordinates?.length) {
        intersectionLatPositive = intersectPostive.features[0].geometry.coordinates[1] || 0;
      }
      if (intersectNegative?.features?.[0]?.geometry?.coordinates?.length) {
        intersectionLatNegative = intersectNegative.features[0].geometry.coordinates[1] || 0;
      }
      const intersectionLat = intersectionLatPositive || intersectionLatNegative;

      if (intersectionLat !== null) {
        if (prevCoord[0] < 0) {
          lineCoords.push([ -180, intersectionLat ]);
          multilineCoords.push(lineCoords);
          lineCoords = [[ 180, intersectionLat ]];
        } else {
          lineCoords.push([ 180, intersectionLat ]);
          multilineCoords.push(lineCoords);
          lineCoords = [[ -180, intersectionLat ]];
        }
      }
    }

    lineCoords.push(coord);
    prevCoord = coord;
  }

  multilineCoords.push(lineCoords);

  return multilineCoords;
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

// returns a valid icon for use on a map
export function getColoredIcon(line, fallback = '') {
  let coloredIcon = fallback;
  if (line.icon) {
    if (line.color in COLOR_TO_NAME && LINE_ICON_SHAPE_SET.has(line.icon)) {
      coloredIcon = `md_${line.icon}_${COLOR_TO_NAME[line.color]}`;
    }
  }
  return coloredIcon;
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
function _buildMiniInterlineSegments(lineKeys, system, ignoreIcon) {
  const transfersByStationId = system.transfersByStationId || {};
  const lineKeySet = new Set(lineKeys);

  let miniInterlineSegments = {};
  for (const lineKey of lineKeys) {
    const line = system.lines[lineKey];

    const coloredIcon = ignoreIcon ? 'solid' : getColoredIcon(line, 'solid');
    const linePattern = `${line.color}|${coloredIcon}`;

    if (!line || !line.stationIds?.length) continue;

    for (let i = 0; i < line.stationIds.length - 1; i++) {
      const currStationId = line.stationIds[i];
      const nextStationId = line.stationIds[i + 1];
      const orderedPair = [currStationId, nextStationId].sort();
      const segmentKey = orderedPair.join('|');

      const currStation = floatifyStationCoord(system.stations[currStationId]);
      const nextStation = floatifyStationCoord(system.stations[nextStationId]);

      if (!currStation || !nextStation) continue;

      miniInterlineSegments[segmentKey] = {
        stationIds: [currStationId, nextStationId],
        patterns: [ linePattern ]
      };

      const currOnLines = (transfersByStationId[currStationId]?.onLines ?? []).map(oL => oL.lineId);
      const nextOnLines = (transfersByStationId[nextStationId]?.onLines ?? []).map(oL => oL.lineId);

      let lineKeysToCheck = new Set([ ...currOnLines, ...nextOnLines ]);

      for (const lineKeyBeingChecked of Array.from(lineKeysToCheck)) {
        if (!lineKeyBeingChecked || !system.lines[lineKeyBeingChecked] || !lineKeySet.has(lineKeyBeingChecked)) continue;

        const lineBeingChecked = system.lines[lineKeyBeingChecked];
        const lineBeingCheckedPatternedIcon = ignoreIcon ? 'solid' : getColoredIcon(lineBeingChecked, 'solid');
        const lineBeingCheckedPattern = `${lineBeingChecked.color}|${lineBeingCheckedPatternedIcon}`;

        if (linePattern !== lineBeingCheckedPattern) { // don't bother checking lines with the same color
          let patternsInSegment = [ linePattern ];
          if (segmentKey in miniInterlineSegments) {
            patternsInSegment = miniInterlineSegments[segmentKey].patterns;
            if (patternsInSegment.includes(lineBeingCheckedPattern)) {
              // another line in this segment has the same color
              continue;
            }
          }
          if (_areAdjacentInLine(lineBeingChecked, currStationId, nextStationId)) {
            patternsInSegment.push(lineBeingCheckedPattern);
            patternsInSegment = [...new Set(patternsInSegment)]; // remove duplicates

            miniInterlineSegments[segmentKey] = {
              stationIds: [currStationId, nextStationId],
              patterns: patternsInSegment.sort()
            };
          }
        }
      }
    }
  }

  return miniInterlineSegments;
}

// calculate how far a color in an interlineSegment should be shifted left or right
function _calculateOffsets(patterns, thickness) {
  let offsets = {};
  const centered = patterns.length % 2 === 1; // center if odd number of lines
  let moveNegative = false;

  for (const [ind, pattern] of patterns.entries()) {
    const displacement = thickness;
    let offsetDistance = 0;
    if (centered) {
      offsetDistance = Math.floor((ind + 1) / 2) * displacement;
    } else {
      offsetDistance = (thickness / 2) + (Math.floor((ind) / 2) * displacement);
    }

    offsets[`${pattern.color}|${pattern.icon ? pattern.icon : 'solid'}`] = offsetDistance * (moveNegative ? -1 : 1);
    moveNegative = !moveNegative;
  }

  return offsets;
}

// collect all the miniInterLineSegemnts into the longest sequences possible that share the same colors
// return a map of interlineSegments keyed by the station in the segment "stationId1|stationId2|..."
function _accumulateInterlineSegments(miniInterlineSegmentsByColors, thickness, ignoreIcon) {
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
      let colorConfigs = [];
      for (const [ind, color] of colors.entries()) {
        const colorParts = color.split('|');
        if (colorParts.length === 2 && colorParts[1] !== 'solid' && !ignoreIcon) {
          colorConfigs.push({ color: colorParts[0], icon: colorParts[1] });
        } else {
          colorConfigs.push({ color: colorParts[0] });
        }
      }
      accumulator = accumulator[0] > accumulator[accumulator.length - 1] ? accumulator : [...accumulator].reverse();
      interlineSegments[accumulator.join('|')] = {
        stationIds: accumulator,
        patterns: colorConfigs,
        offsets: _calculateOffsets(colorConfigs, thickness, ignoreIcon)
      };
    }
  }

  return interlineSegments;
}

// get a map of all the sequences of stations that are shared by multiple lines along with how far
// the colors on that line should be visially shifted
export function buildInterlineSegments(system, lineKeys = [], thickness = 8, ignoreIcon = false) {
  const lineKeysToHandle = lineKeys && lineKeys.length ? lineKeys : Object.keys(system.lines);
  const miniInterlineSegments = _buildMiniInterlineSegments(lineKeysToHandle, system, ignoreIcon);

  const miniInterlineSegmentsByColors = {};
  for (const mIS of Object.values(miniInterlineSegments)){
    const colorsJoined = mIS.patterns.join('-');
    if (colorsJoined in miniInterlineSegmentsByColors) {
      miniInterlineSegmentsByColors[colorsJoined].push(mIS);
    } else {
      miniInterlineSegmentsByColors[colorsJoined] = [ mIS ];
    }
  }

  return _accumulateInterlineSegments(miniInterlineSegmentsByColors, thickness, ignoreIcon);
}

export function diffInterlineSegments(oldInterlineSegments = {}, newInterlineSegments = {}) {
  const oldKeys = new Set(Object.keys(oldInterlineSegments || {}));
  const newKeys = new Set(Object.keys(newInterlineSegments || {}));
  const targetKeys = new Set(Object.keys(oldInterlineSegments || {}).concat(Object.keys(newInterlineSegments || {})));

  for (const oldKey of Array.from(oldKeys)) {
    if (newKeys.has(oldKey) &&
        JSON.stringify(oldInterlineSegments[oldKey].patterns) === JSON.stringify(newInterlineSegments[oldKey].patterns) &&
        JSON.stringify(oldInterlineSegments[oldKey].offsets) === JSON.stringify(newInterlineSegments[oldKey].offsets)) {
      targetKeys.delete(oldKey);
    } else {
      // do nothing
    }
  }

  return Array.from(targetKeys);
}

/**
 * Ensures the longitude is in the range of -180 and 180.
 * @param {number} lng the longitude to be normalized
 * @returns {number} the normalized longitude
 */
export function normalizeLongitude(lng) {
  return ((lng + 180 + 360) % 360) - 180;
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

// returns the user displayName, accounting for suspended and deleted accounts
export function getUserDisplayName(userDocData) {
  if (Object.keys(userDocData || {}).length === 0) return '';

  if (userDocData.deletionDate) {
    return '[deleted]';
  } else if (userDocData.suspensionDate) {
    return '[suspended]';
  } else {
    return userDocData.displayName ? userDocData.displayName : 'Anonymous';
  }
}

// returns a map with the info about an icon and a url path for the image
export function getUserIcon(userDocData) {
  let icon;
  if (userDocData.suspensionDate || userDocData.deletionDate) {
    icon = {
      key: 'USER_BASIC',
      alt: 'user',
      filename: 'basic.svg'
    }
  } else if (userDocData.icon && userDocData.icon.key && userDocData.icon.key in USER_ICONS) {
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
    case 'USER_BASIC':
      svg = USER_BASIC;
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
  if (userDocData.suspensionDate || userDocData.deletionDate) {
    color = '#ffffff';
    filter = 'invert(100%)';
  } else if (userDocData.icon && userDocData.icon.color && userDocData.icon.color in COLOR_TO_FILTER) {
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

export function shouldErrorCauseFailure(e) {
  return (e.message === 'Not Found' ||
          (e.name === 'FirebaseError' && e.message === 'Missing or insufficient permissions.') ||
          (e.name === 'FirebaseError' && e.message.includes('storage/object-not-found')));
}

// returns true if the device runs iOS
export function isIOS() {
  const iDevices = [
    'iPad',
    'iPhone',
    'iPod',
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator'
  ];

  if (iDevices.includes(navigator.platform || '')) return true;

  return /iPhone|iPod/.test(navigator.userAgent || '');
}

export function isTouchscreenDevice() {
  return (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
}

/**
 * Gets the timestamp from local storage indicating the last time the cache was cleared
 * @returns {number} the unix timestamp
 */
export function getCacheClearTime() {
  const cacheClearTimeString = localStorage.getItem('mdCacheClearTime') || '';
  const cacheClearTime = parseInt(cacheClearTimeString) || 0;
  return cacheClearTime;
}

/**
 * Gets the oldest timestamp for which the local cache is still valid, using
 * the NEXT_PUBLIC_CACHE_DURATION_HOURS env variable
 * @returns {number} the unix timestamp
 */
export function getCacheInvalidationTime() {
  const hours = parseInt(process.env.NEXT_PUBLIC_CACHE_DURATION_HOURS) || 24;
  const millisecsInHour = 1000 * 60 * 60;
  const cacheInvalidationTime = Date.now() - (millisecsInHour * hours);
  return cacheInvalidationTime;
}

/**
 * Checks all the edit timestamps in local storage and returns an object indicating the
 * most recent systemId with unsaved edits and the timestamp that the edit occurred
 * @returns {object} { systemId, timestamp }
 */
export function getRecentLocalEditTimestamp() {
  let mostRecent = { none: true };

  try {
    const lsJson = localStorage.getItem('mdEditTimesBySystemId') || '{}';
    const editTimesBySystemId = JSON.parse(lsJson);

    let highestTime = 0;
    for (const systemId in editTimesBySystemId) {
      if (editTimesBySystemId[systemId] && editTimesBySystemId[systemId] > highestTime) {
        mostRecent = {
          systemId: systemId,
          timestamp: editTimesBySystemId[systemId]
        }
        highestTime = editTimesBySystemId[systemId];
      }
    }
  } catch (e) {
    console.warn('getRecentLocalEditTimestamp error:', e);
  }

  return mostRecent;
}

/**
 * Updates the edit timestamp in local storage for a given systemId. Called
 * whenever a change is made to a map (same as when the history updates)
 * @param {string} systemId
 * @returns null
 */
export function clearLocalEditTimestamp(systemId) {
  if (!systemId) {
    console.warn('clearLocalEditTimestamp warning: systemId is required');
    return;
  }

  try {
    const lsJson = localStorage.getItem('mdEditTimesBySystemId') || '{}';
    const editTimesBySystemId = JSON.parse(lsJson);
    delete editTimesBySystemId[systemId];
    localStorage.setItem('mdEditTimesBySystemId', JSON.stringify(editTimesBySystemId));
  } catch (e) {
    console.warn('clearLocalEditTimestamp error:', e);
  }
}

/**
 * Removes the edit timestamp in local storage for a given systemId. Called
 * whenever a map is saved or unsaved edits are dismissed
 * @param {string} systemId
 * @returns null
 */
export function updateLocalEditTimestamp(systemId) {
  if (!systemId) {
    console.warn('updateLocalEditTimestamp warning: systemId is required');
    return;
  }

  try {
    const lsJson = localStorage.getItem('mdEditTimesBySystemId') || '{}';
    const editTimesBySystemId = JSON.parse(lsJson);
    editTimesBySystemId[systemId] = Date.now();
    localStorage.setItem('mdEditTimesBySystemId', JSON.stringify(editTimesBySystemId));
  } catch (e) {
    console.warn('updateLocalEditTimestamp error:', e);
  }
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

export function renderSpinner(additionalClass) {
  return (
    <div className={`${additionalClass} Spinner`}>
      <i className="fa-solid fa-spinner"></i>
    </div>
  );
}
