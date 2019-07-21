import URI from 'urijs';

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

export function getViewValue(userId, systemId) {
  let uri = new URI();
  uri.query('');
  let encoded = window.btoa(`${userId}|${systemId}`);
  uri.addQuery('view', encoded);
  return uri.toString();
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
