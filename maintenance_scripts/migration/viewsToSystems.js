require('dotenv').config();
const request = require('request-promise');
const admin = require('firebase-admin');
const { geohashForLocation } = require('geofire-common');
const { lineString } = require('@turf/helpers');
const turfLength = require('@turf/length').default;
const argv = require('yargs/yargs')(process.argv.slice(2))
  .usage('Usage: $0 [options]')
  .boolean('full')
  .default('full', false)
  .describe('full', 'Run on full set of systems, not just test system')
  .boolean('prod')
  .default('prod', false)
  .describe('prod', 'Use production account')
  .boolean('write')
  .default('write', false)
  .describe('write', 'Write to database')
  .help('h')
  .alias('h', 'help')
  .alias('v', 'version')
  .argv;

const homedir = require('os').homedir();
const prodAccount = require(`${homedir}/.metrodreamin-keys/metrodreamin.json`);
const stagingAccount = require(`${homedir}/.metrodreamin-keys/metrodreaminstaging.json`);

const TESTUID = 'pzjtpoFkzeQEzaC6nNhHOvEe6xE3';

const SYSTEM_LEVELS = [
  {
    key: 'LOCAL',
    label: 'local',
    spacingThreshold: 2,
    radiusThreshold: 40
  },
  {
    key: 'REGIONAL',
    label: 'regional',
    spacingThreshold: 10,
    radiusThreshold: 200
  },
  {
    key: 'LONG',
    label: 'long distance',
    spacingThreshold: 50,
    radiusThreshold: 1000
  },
  {
    key: 'XLONG',
    label: 'extra long distance',
    spacingThreshold: Number.MAX_SAFE_INTEGER,
    radiusThreshold: Number.MAX_SAFE_INTEGER
  },
];

// This function is to migrate from /views to /systems and begin storing stations and lines
// as documents in collections under the system doc.
const main = async () => {
  console.log('~~~~ !! Systems Generation !! ~~~~');
  console.log(argv.write ? '~~~~ !! WRITE FLAG IS ENABLED !! ~~~~' : '~~~~ Write flag is NOT enabled ~~~~');
  console.log(argv.prod ? '~~~~ !! USING PRODUCTION ACCOUNT !! ~~~~' : '~~~~ Using staging account ~~~~');
  console.log(argv.full ? '~~~~ !! RUNNIING ON FULL VIEW SET !! ~~~~' : `~~~~ Running on test User ID ${TESTUID} ~~~~`);

  admin.initializeApp({
    credential: admin.credential.cert(argv.prod ? prodAccount : stagingAccount)
  });

  const database = admin.firestore();
  if (!database) {
    console.log('Unable to set up database connection.');
    return;
  };

  let bulkWriter = database.bulkWriter();
  if (!bulkWriter) {
    console.log('Unable to set up bulkWriter.');
    return;
  };

  const stationsByDefaultId = await getStationsByDefaultId(database);

  const viewsQuery = argv.full ? database.collection('views') : database.collection('views').where('userId', '==', TESTUID);
  const viewDocs = await viewsQuery.get();

  console.log(viewDocs.docs.length, 'total view docs');
  for (const [i, viewDoc] of viewDocs.docs.entries()) {
    let systemDocData = viewDoc.data();
    console.log(`${i}: handling ${systemDocData.systemId}`)

    let oldSysDoc = database.doc(`users/${systemDocData.userId}/systems/${systemDocData.systemId}`);
    let oldSysSnapshot = await oldSysDoc.get();
    if (!oldSysSnapshot.exists) {
      console.log(`${systemDocData.viewId} FAILURE users/${systemDocData.userId}/systems/${systemDocData.systemId}: old system doc does not exist`);
      return;
    }

    let oldSysData = oldSysSnapshot.data();
    if (!oldSysData.map || !oldSysData.systemId || !oldSysData.nextLineId || !oldSysData.nextStationId) {
      console.log(`${systemDocData.viewId} FAILURE users/${systemDocData.userId}/systems/${systemDocData.systemId}: old system doc is missing fields`);
      return;
    }

    systemDocData.systemNumStr = systemDocData.systemId; // systemId becomes systemNumStr
    systemDocData.systemId = systemDocData.viewId; // viewId becomes systemId
    delete systemDocData.viewId;
    systemDocData.meta = {
      systemNumStr: oldSysData.systemId, // should i do the work to remove this?
      nextLineId: oldSysData.nextLineId,
      nextStationId: oldSysData.nextStationId
    };

    let numStations = 0;
    let numWaypoints = 0;
    for (const station of Object.values(oldSysData.map.stations || {})) {
      if (station.isWaypoint) {
        numWaypoints++;
      } else {
        numStations++;
      }
    }
    systemDocData.numStations = numStations;
    systemDocData.numWaypoints = numWaypoints;

    systemDocData.ancestors = findAncestors(stationsByDefaultId, oldSysData.map.stations);

    const { centroid, maxDist, avgDist } = getGeoData(oldSysData.map.stations);
    systemDocData.centroid = centroid || null;
    systemDocData.maxDist = maxDist || null;
    systemDocData.avgDist = avgDist || null;
    systemDocData.geohash = centroid ? geohashForLocation([ centroid.lat, centroid.lng ], 10) : null;

    const { trackLength, avgSpacing, level } = getTrackInfo(oldSysData.map);
    systemDocData.trackLength = trackLength || null;
    systemDocData.avgSpacing = avgSpacing || null;
    systemDocData.level = level || null;

    if (argv.write) {
      let systemDoc = database.doc(`systems/${systemDocData.systemId}`);

      if ((await systemDoc.get()).exists) continue;

      try {
        bulkWriter.set(systemDoc, systemDocData);
      } catch (err) {
        console.log(`${systemDocData.systemId} FAILURE: error writing system doc`, err);
        return;
      }
    } else {
      console.log(`would write to systems/${systemDocData.systemId}`);
    }

    for (const lineKey in (oldSysData.map.lines || {})) {
      if (argv.write) {
        const lineDoc = database.doc(`systems/${systemDocData.systemId}/lines/${lineKey}`);
        try {
          bulkWriter.set(lineDoc, oldSysData.map.lines[lineKey]);
        } catch (err) {
          console.log(`${systemDocData.systemId} FAILURE: error writing line doc ${lineKey}`, err);
          return;
        }
      } else {
        console.log(`would write to systems/${systemDocData.systemId}/lines/${lineKey}`);
      }
    }

    for (const stationId in (oldSysData.map.stations || {})) {
      if (argv.write) {
        const stationDoc = database.doc(`systems/${systemDocData.systemId}/stations/${stationId}`);
        try {
          bulkWriter.set(stationDoc, oldSysData.map.stations[stationId]);
        } catch (err) {
          console.log(`${systemDocData.systemId} FAILURE: error writing station doc ${stationId}`, err);
          return;
        }
      } else {
        console.log(`would write to systems/${systemDocData.systemId}/stations/${stationId}`);
      }
    }

    try {
      await bulkWriter.flush();
      console.log(`${i}: ${systemDocData.systemId} finished`)
    } catch (err) {
      console.log('error flushing bulkwriter:', err);
    }
  };

  try {
    await bulkWriter.flush();
    console.log('Finished migration.');
  } catch (err) {
    console.log('error flushing final bulkwriter:', err);
  }
}

const getStationsByDefaultId = async (database) => {
  const defaultsQuery = database.collection('defaultSystems');
  const defaultDocs = await defaultsQuery.get();

  let stationsByDefaultId = {};
  for (const defaultDoc of defaultDocs.docs) {
    const defaultStationsQuery = defaultDoc.ref.collection('stations');
    const defaultStationDocs = await defaultStationsQuery.get();

    let defaultStations = {};
    for (const defaultStationDoc of defaultStationDocs.docs) {
      const defaultStationData = defaultStationDoc.data();
      defaultStations[defaultStationData.id] = defaultStationData;
    }
    stationsByDefaultId[defaultDoc.id] = defaultStations;
  }

  return stationsByDefaultId;
}

const findAncestors = (stationsByDefaultId, stations) => {
  let ancestors = [];

  const numericalStationIds = Object.keys(stations).map(sId => parseInt(sId)).sort((a, b) => a > b ? 1 : -1).slice(0, 10);

  for (const [defaultId, defaultStations] of Object.entries(stationsByDefaultId)) {
    let coordMatchCount = 0;
    for (const numStationId of numericalStationIds) {
      const stationId = `${numStationId}`;
      if (stationId in defaultStations) {
        // should catch bad strings in lat/lngs with ==
        if (stations[stationId].lat == defaultStations[stationId].lat && stations[stationId].lng == defaultStations[stationId].lng) {
          coordMatchCount++;
        }
      }
    }

    if ((coordMatchCount / numericalStationIds.length) > 0.5) {
      ancestors = [ `defaultSystems/${defaultId}` ];
      break;
    }
  }

  return ancestors;
}

// ~~~ below is copied from /app/lib/saver.js ~~~

const getGeoData = (stations = {}) => {
  let cleanedStations = Object.values(stations).filter(s => !s.isWaypoint).map(s => floatifyStationCoord(s));
  if (cleanedStations.length) {
    // Get centroid, bounding box, and average distance to centroid of all stations.

    const sum = (total, curr) => total + curr;

    let lats = cleanedStations.map(s => s.lat);
    let lngs = cleanedStations.map(s => s.lng);

    const corners = [
      {lat: Math.max(...lats), lng: Math.min(...lngs)},
      {lat: Math.max(...lats), lng: Math.max(...lngs)},
      {lat: Math.min(...lats), lng: Math.max(...lngs)},
      {lat: Math.min(...lats), lng: Math.min(...lngs)}
    ];
    const centroid = {
      lat: lats.reduce(sum) / cleanedStations.length,
      lng: lngs.reduce(sum) / cleanedStations.length
    };
    const maxDist = Math.max(...corners.map(c => getDistance(centroid, c)));
    const avgDist = cleanedStations.map(s => getDistance(centroid, s)).reduce(sum) / cleanedStations.length;

    return { centroid, maxDist, avgDist };
  }

  return {};
}

const getTrackInfo = (system) => {
  let trackLength = 0;
  let avgSpacing;
  let level;

  const lines = Object.values(system.lines || {});
  if (lines.length) {
    let sectionSet = new Set();
    let numSections = 0;
    for (const line of lines) {
      const sections = partitionSections(line, system.stations);

      for (const section of sections) {
        if (section.length >= 2) {
          // ensure we don't double count reversed sections
          let orderedSection = section.slice();
          if (section[section.length - 1] > section[0]) {
            orderedSection = section.slice().reverse();
          }
          const orderedStr = orderedSection.join('|');

          // only count each section once
          if (!sectionSet.has(orderedStr)) {
            trackLength += turfLength(lineString(stationIdsToCoordinates(system.stations, orderedSection)),
                                      { units: 'miles' });
            numSections++;
            sectionSet.add(orderedStr);
          }
        }
      }
    }

    if (trackLength && numSections) {
      avgSpacing = trackLength / numSections;
      level = getLevel({ avgSpacing }).key;
    }
  }

  return { trackLength, avgSpacing, level };
}

const getDistance = (coord1, coord2) => {
  const unit = 'M';
  const lat1 = coord1.lat;
  const lon1 = coord1.lng;
  const lat2 = coord2.lat;
  const lon2 = coord2.lng;

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

// ~~~ below is copied from /app/lib/util.js ~~~

const floatifyStationCoord = (station) => {
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

const stationIdsToCoordinates = (stations, stationIds) => {
  let coords = [];
  for (const sId of (stationIds || [])) {
    if (!stations[sId]) continue;
    let { lng, lat } = floatifyStationCoord(stations[sId]);
    coords.push([ lng, lat ]);
  }
  return coords;
}

const partitionSections = (line, stations) => {
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

const getLevel = ({ key, avgSpacing, radius }) => {
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

main();
