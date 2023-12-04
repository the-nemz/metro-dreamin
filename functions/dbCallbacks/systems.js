const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const mapboxStatic = require('@mapbox/mapbox-sdk/services/static');

const { addNotification } = require('../src/notifications.js');

const staticService = mapboxStatic({ accessToken: 'pk.eyJ1IjoiaWpuZW16ZXIiLCJhIjoiY2xma3B0bW56MGQ4aTQwczdsejVvZ2cyNSJ9.FF2XWl1MkT9OUVL_HBJXNQ' });

const incrementSystemsStats = (systemSnap, context) => {
  const globalStatsDoc = admin.firestore().doc(`stats/global`);
  globalStatsDoc.update({
    systemsCreated: FieldValue.increment(1)
  });
}

const notifyAncestorOwners = (systemSnap, context) => {
  const systemData = systemSnap.data();

  for (const [ind, ancestorId] of (systemData.ancestors || []).entries()) {
    const isDirectAncestor = ind === systemData.ancestors.length - 1;
    if (!ancestorId.includes('defaultSystems/')) {
      const ancestorDoc = admin.firestore().doc(`systems/${ancestorId}`);
      ancestorDoc.get().then((ancestorSnap) => {
        if (ancestorSnap.exists) {
          const ancestorData = ancestorSnap.data();

          if (systemData.userId !== ancestorData.userId) {
            const brancherDoc = admin.firestore().doc(`users/${systemData.userId}`);
            brancherDoc.get().then((brancherSnap) => {
              if (brancherSnap.exists) {
                const branchNotif = getBranchNotif(brancherSnap.data(), ancestorData, systemData, isDirectAncestor);
                addNotification(ancestorData.userId, branchNotif);
              }
            });
          }

          admin.firestore().doc(`systems/${ancestorId}`).update({
            descendantsCount: FieldValue.increment(1),
            directDescendantsCount: FieldValue.increment(isDirectAncestor ? 1 : 0)
          });
        }
      });
    }
  }
}

const getBranchNotif = (brancherData, ancestorData, systemData, isDirectAncestor = false) => {
  const brancherName = systemData.isPrivate ? 'A private user' : (brancherData.displayName ? brancherData.displayName : 'Anon');
  const descendantsCount = (ancestorData.descendantsCount || 0) + 1;
  const directDescendantsCount = (ancestorData.directDescendantsCount || 0) + (isDirectAncestor ? 1 : 0);

  let countTextContent = `${descendantsCount} total ${descendantsCount > 1 ? 'descendants' : 'descendant'}`;
  if (isDirectAncestor) {
    countTextContent = `${directDescendantsCount} direct ${directDescendantsCount > 1 ? 'descendants' : 'descendant'} and ${countTextContent}`
  }

  return {
    type: 'branch',
    destination: `/edit/${ancestorData.systemId}`,
    image: 'branch',
    content: {
      text: `[[starrerName]] ${isDirectAncestor ? 'directly branched from' : 'branched from a descendant of'} your map [[mapTitle]]! It now has [[countText]].`,
      replacements: {
        starrerName: {
          text: brancherName,
          styles: [
            'italic'
          ]
        },
        mapTitle: {
          text: ancestorData.title ? ancestorData.title : 'Untitled',
          styles: [
            'bold',
            'big'
          ]
        },
        countText: {
          text: countTextContent
        }
      }
    }
  };
}

const archiveSystem = async (systemSnap, context) => {
  const archivedDocString = `systemsArchived/${context.params.systemId}`;
  const deletedSystem = systemSnap.data();

  // copy content of system document
  const archivedDoc = admin.firestore().doc(archivedDocString);
  await archivedDoc.set({ ...deletedSystem, archivedAt: Date.now() });

  // copy content of all subcollections (stations, stars, etc)
  const subCollections = await systemSnap.ref.listCollections();
  subCollections.forEach(async (collection) => {
    const archivedCollectionId = `${collection.id}Archived`;
    const docs = await collection.listDocuments();
    docs.forEach(async (doc) => {
      const docSnap = await doc.get();
      const archivedSubDoc = admin.firestore().doc(`${archivedDocString}/${archivedCollectionId}/${doc.id}`);
      archivedSubDoc.set(docSnap.data());
    })
  })
}

const generateSystemThumbnail = async (systemChange, context) => {
  if (!systemChange.after.exists) return; // if system was deleted

  if (systemChange.before.exists) {
    const beforeTimestamp = systemChange.before.data().lastUpdated;
    const afterTimestamp = systemChange.after.data().lastUpdated;

    if (beforeTimestamp === afterTimestamp) {
      // map content was not updated (only stars, commentsCount, etc)
      return;
    }
  }

  let lines = {};
  let stations = {};

  switch(systemChange.after.data().structure) {
    case 'PARTITIONED':
      const partitionsSnap = await admin.firestore().collection(`systems/${context.params.systemId}/partitions`).get();
      partitionsSnap.forEach((partitionDoc) => {
        const partitionData = partitionDoc.data();

        if (typeof partitionData.lines === 'object') {
          lines = { ...lines, ...partitionData.lines };
        }

        if (typeof partitionData.stations === 'object') {
          stations = { ...stations, ...partitionData.stations };
        }
      });

      break;
    case 'INDIVIDUAL':
    default:
      const linesSnap = await admin.firestore().collection(`systems/${context.params.systemId}/lines`).get();
      linesSnap.forEach((lineDoc) => {
        const lineData = lineDoc.data();
        lines[lineData.id] = lineData;
      });

      const stationsSnap = await admin.firestore().collection(`systems/${context.params.systemId}/stations`).get();
      stationsSnap.forEach((stationDoc) => {
        const stationData = stationDoc.data();
        stations[stationData.id] = stationData;
      });

      break;
  }

  let waypointsIncluded = true;
  let distanceThreshold = (systemChange.after.data().maxDist || 0) * 1.5; // when halving, start with 0.75
  let statusCode;
  let attemptCount = 0;

  do {
    const linePaths = generateLinePaths(stations, lines, waypointsIncluded, distanceThreshold, systemChange.after.data().centroid);

    try {
      const thumbnailConfigs = [
        { styleId: 'dark-v10', filename: `${encodeURIComponent(context.params.systemId)}/dark.png` },
        { styleId: 'light-v10', filename: `${encodeURIComponent(context.params.systemId)}/light.png` },
      ];

      for (const thumbnailConfig of thumbnailConfigs) {
        const staticImageRequest = staticService.getStaticImage({
          ownerId: 'mapbox',
          styleId: thumbnailConfig.styleId,
          attribution: false,
          logo: false,
          highRes: true,
          width: 600,
          height: 400,
          padding: linePaths.length ? '0' : undefined,
          position: linePaths.length ? 'auto' : { coordinates: [0, 0], zoom: 1 },
          overlays: linePaths.length ? linePaths : undefined
        });

        const imageResponse = await staticImageRequest.send();
        const imageBuffer = Buffer.from(imageResponse.body, 'binary');
        const thumbnailFile = admin.storage().bucket().file(thumbnailConfig.filename);
        await thumbnailFile.save(imageBuffer, { contentType: 'image/png' });
      }

      statusCode = 300;
    } catch (error) {
      statusCode = error.statusCode;
      console.log(error);

      if (waypointsIncluded) {
        waypointsIncluded = false;
      } else {
        distanceThreshold = distanceThreshold / 2;
      }
    }

    attemptCount++;
  } while ((statusCode === 413 || statusCode === 414) && attemptCount < 20);
}

const generateLinePaths = (stations, lines, waypointsIncluded, distanceThreshold, centroid) => {
  const stationsToInclude = getStationsToInclude(stations, waypointsIncluded, distanceThreshold, centroid);

  let linePaths = [];
  for (const lineKey in lines) {
    const line = lines[lineKey];

    const coords = stationIdsToCoordinates(stationsToInclude, line.stationIds);

    if (coords.length > 1) {
      linePaths.push({
        path: {
          coordinates: coords,
          strokeWidth: 6,
          strokeColor: line.color,
        }
      });
    }
  }

  return linePaths;
}

const getStationsToInclude = (stations, waypointsIncluded, distanceThreshold, centroid) => {
  if (!centroid || !distanceThreshold) return {};

  const bounds = getBounds(centroid, distanceThreshold);

  const stationsToInclude = {};
  for (const station of Object.values(stations)) {
    if (station.isWaypoint && !waypointsIncluded) continue;

    if (station.lat <= bounds.north &&
        station.lat >= bounds.south &&
        station.lng <= bounds.east &&
        station.lng >= bounds.west) {
      stationsToInclude[station.id] = station;
    }
  }

  return stationsToInclude;
}

// get the bounds of a 3:2 box around the centroid where the distance from the center to the northern bound is distanceThreshold
const getBounds = (centroid, distanceThreshold) => {
  const earthRadiusMiles = 3958.8; // radius of the Earth in miles
  const verticalDelta = distanceThreshold;
  const horizontalDelta = distanceThreshold * 3 / 2; // target image is 1200x800 (3:2)

  // convert latitude and longitude from degrees to radians
  const latRad = (centroid.lat * Math.PI) / 180;
  const lonRad = (centroid.lng * Math.PI) / 180;

  // calculate the angular delta in radians
  const angularVertDelta = verticalDelta / earthRadiusMiles;
  const angularHoriDelta = (horizontalDelta / earthRadiusMiles) / Math.abs(Math.cos(latRad)); // account for converging longitudes at poles

  // calculate bounds in radians by adding angular delta
  const northRad = latRad + angularVertDelta;
  const eastRad = lonRad + angularHoriDelta;
  const southRad = latRad - angularVertDelta;
  const westRad = lonRad - angularHoriDelta;

  // convert to degrees
  return {
    north: (northRad * 180) / Math.PI,
    east: (eastRad * 180) / Math.PI,
    south: (southRad * 180) / Math.PI,
    west: (westRad * 180) / Math.PI
  };
}

// taken from lib/util.js
const stationIdsToCoordinates = (stations, stationIds) => {
  let coords = [];
  for (const sId of stationIds) {
    if (!stations[sId]) continue;
    const floatifiedStation = floatifyAndRoundStationCoord(stations[sId]);
    if (!floatifiedStation) continue;

    let { lng, lat } = floatifiedStation;
    coords.push([ lng, lat ]);
  }
  return coords;
}

// modified from lib/util.js
const floatifyAndRoundStationCoord = (station) => {
  if (station == null) {
    return null;
  }

  let { lng, lat } = station;
  if (typeof lng === 'string') {
    lng = parseFloat(lng)
  }
  if (typeof lat === 'string') {
    lat = parseFloat(lat)
  }

  if (lng < -180 || lng > 180) {
    // getStaticImage endpoint can't really handle these
    return null;
  }

  // +/- 85.0511 is max allowed by the endpoint
  if (lat < -85.05) {
    lat = -85.05;
  } else if (lat > 85.05) {
    lat = 85.05;
  }

  lng = parseFloat(lng.toFixed(4));
  lat = parseFloat(lat.toFixed(4));

  station.lat = lat;
  station.lng = lng;
  return station;
}

// taken from lib/util.js
const getDistance = (station1, station2) => {
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

module.exports = { generateSystemThumbnail, archiveSystem, notifyAncestorOwners, incrementSystemsStats };
