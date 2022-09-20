// Utilities shared across components

export const LINE_MODES = [
  {
    key: 'bus',
    label: 'local bus',
    speed: 0.4, // 24 kph
    pause: 500
  },
  {
    key: 'tram',
    label: 'BRT/tram',
    speed: 0.6, // 36 kph
    pause: 500
  },
  {
    key: 'rapid',
    label: 'rapid transit',
    speed: 1, // 60 kph
    pause: 500
  },
  {
    key: 'regional',
    label: 'regional rail',
    speed: 2, // 120 kph
    pause: 1500
  },
  {
    key: 'hsr',
    label: 'high speed rail',
    speed: 4, // 240 kph
    pause: 2500
  }
];

export function getMode(key) {
  return LINE_MODES.reduce((obj, m) => {
    obj[m.key] = m
    return obj;
  }, {})[key ? key : 'rapid'];
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

export function sortSystems(a, b) {
  const aTitle = a.map ? a.map.title : a.title;
  const bTitle = b.map ? b.map.title : b.title;
  return (aTitle ? aTitle : '').toLowerCase() > (bTitle ? bTitle : '').toLowerCase() ? 1 : -1;
}

export function getPartsFromViewId(viewId) {
  const decodedParts = window.atob(viewId).split('|');
  const uid = decodedParts[0];
  const sysId = decodedParts[1];
  return {
    userId: uid,
    systemId: sysId
  };
}

export function getViewId(userId, systemId) {
  return window.btoa(`${userId}|${systemId}`);
}

export function getViewPath(userId, systemId) {
  return `/view/${encodeURIComponent(getViewId(userId, systemId))}`;
}

export function getViewURL(userId, systemId) {
  return `${window.location.origin}${getViewPath(userId, systemId)}`;
}

export function checkForTransfer(stationId, currLine, otherLine) {
  if (otherLine.stationIds.includes(stationId)) {
    const positionA = currLine.stationIds.indexOf(stationId);
    const positionB = otherLine.stationIds.indexOf(stationId);
    const aAtEnd = positionA === 0 || positionA === currLine.stationIds.length - 1;
    const bAtEnd = positionB === 0 || positionB === otherLine.stationIds.length - 1
    if (aAtEnd ? !bAtEnd : bAtEnd) {
      // Connection at start or end
      return true;
    }

    const thisPrev = currLine.stationIds[Math.max(0, positionA - 1)];
    const thisNext = currLine.stationIds[Math.min(currLine.stationIds.length - 1, positionA + 1)];
    if (!otherLine.stationIds.includes(thisPrev) || !otherLine.stationIds.includes(thisNext)) {
      // Connection is not present at previous and/or next station of otherLine
      return true;
    }

    const otherPrev = otherLine.stationIds[Math.max(0, positionB - 1)];
    const otherNext = otherLine.stationIds[Math.min(otherLine.stationIds.length - 1, positionB + 1)];
    if (!currLine.stationIds.includes(otherPrev) || !currLine.stationIds.includes(otherNext)) {
      // Connection is not present at previous and/or next station of line
      return true;
    }
  }

  return false;
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
    }
  }

  return Array.from(targetKeys);
}


export function buildInterlineSegments(system, lineKeys = [], thickness = 8) {
  let interlineSegments = {};
  for (const lineKey of (lineKeys && lineKeys.length ? lineKeys : Object.keys(system.lines))) {
    const line = system.lines[lineKey];
    let isInitialSegment = true;
    let initiallyNorthbound = true;

    for (let i = 0; i < line.stationIds.length - 1; i++) {
      const currStationId = line.stationIds[i];
      const nextStationId = line.stationIds[i + 1];
      const orderedPair = [currStationId, nextStationId].sort();

      const slope = (system.stations[currStationId].lat - system.stations[nextStationId].lat) / (system.stations[currStationId].lng - system.stations[nextStationId].lng);
      const currNorthbound = system.stations[currStationId].lat < system.stations[nextStationId].lat;

      for (const lineKeyBeingChecked in system.lines) {
        const lineBeingChecked = system.lines[lineKeyBeingChecked];

        if (line.color !== lineBeingChecked.color) { // don't bother checking lines with the same color
          const indexOfCurrStation = lineBeingChecked.stationIds.indexOf(currStationId);
          const indexOfNextStation = lineBeingChecked.stationIds.indexOf(nextStationId);

          if (indexOfCurrStation >= 0 && indexOfNextStation >= 0 && Math.abs(indexOfCurrStation - indexOfNextStation) === 1) { // if stations are next to each other
            if (isInitialSegment) {
              initiallyNorthbound = currNorthbound;
              isInitialSegment = false;
            }

            const segmentKey = orderedPair.join('|');
            let colorsInSegment = [ line.color ];
            if (segmentKey in interlineSegments) {
              colorsInSegment = interlineSegments[segmentKey].colors;
              if (colorsInSegment.includes(lineBeingChecked.color)) {
                // another line in this segment has the same color
                break;
              }
            }
            colorsInSegment.push(lineBeingChecked.color);
            colorsInSegment = [...new Set(colorsInSegment)]; // remove duplicates

            interlineSegments[segmentKey] = {
              stationIds: orderedPair,
              colors: colorsInSegment,
              offsets: calculateOffsets(colorsInSegment.sort(), slope, initiallyNorthbound !== currNorthbound, thickness)
            };
          }
        }
      }

      if (!(orderedPair.join('|') in interlineSegments)) {
        isInitialSegment = true;
      }
    }
  }

  return interlineSegments;
}

export function calculateOffsets(colors, slope, negateOffset, thickness) {
  let offsets = {};
  const centered = colors.length % 2 === 1; // center if odd number of lines
  let moveNegative = negateOffset;
  for (const [i, color] of colors.entries()) {
    const displacement = thickness;
    let offsetDistance = 0;
    if (centered) {
      offsetDistance = Math.floor((i + 1) / 2) * displacement;
    } else {
      offsetDistance = (thickness / 2) + (Math.floor((i) / 2) * displacement);
    }

    const negInvSlope = -1 / slope;
    // line is y = negInvSlope * x
    // solve for x = 1
    // goes through through (0, 0) and (1, negInvSlope)
    const distanceRatio = offsetDistance / Math.sqrt(1 + (negInvSlope * negInvSlope));
    const offsetX = ((1 - distanceRatio) * 0) + (distanceRatio * 1);
    const offsetY = ((1 - distanceRatio) * 0) + (distanceRatio * negInvSlope);
    offsets[color] = [offsetX * (moveNegative ? -1 : 1), -offsetY * (moveNegative ? -1 : 1)]; // y is inverted (positive is south)
    moveNegative = !moveNegative;
  }

  return offsets;
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

export async function addAuthHeader(user, req) {
  if (user) {
    req.setRequestHeader('Authorization', 'Bearer ' + await user.getIdToken());
  }
  return req;
}
