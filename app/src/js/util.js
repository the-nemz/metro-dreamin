// Utilities shared across compenents

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
  return a.map.title.toLowerCase() > b.map.title.toLowerCase() ? 1 : -1;
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
