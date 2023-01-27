require('dotenv').config();
const request = require('request-promise');
const admin = require('firebase-admin');
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

    if (argv.write) {
      let systemDoc = database.doc(`systems/${systemDocData.systemId}`);
      bulkWriter.set(systemDoc, systemDocData)
        .catch(err => {
          console.log(`${systemDocData.systemId} FAILURE: error writing system doc`, err);
          return;
        });
    } else {
      console.log(`would write to systems/${systemDocData.systemId}`);
    }

    for (const lineKey in (oldSysData.map.lines || {})) {
      if (argv.write) {
        const lineDoc = database.doc(`systems/${systemDocData.systemId}/lines/${lineKey}`);
        bulkWriter.set(lineDoc, oldSysData.map.lines[lineKey])
          .catch(err => {
            console.log(`${systemDocData.systemId} FAILURE: error writing line doc ${lineKey}`, err);
            return;
          });
      } else {
        console.log(`would write to systems/${systemDocData.systemId}/lines/${lineKey}`);
      }
    }

    for (const stationId in (oldSysData.map.stations || {})) {
      if (argv.write) {
        const stationDoc = database.doc(`systems/${systemDocData.systemId}/stations/${stationId}`);
        bulkWriter.set(stationDoc, oldSysData.map.stations[stationId])
          .catch(err => {
            console.log(`${systemDocData.systemId} FAILURE: error writing station doc ${stationId}`, err);
            return;
          });
      } else {
        console.log(`would write to systems/${systemDocData.systemId}/stations/${stationId}`);
      }
    }

    await bulkWriter.flush().then(() => console.log(`${i}: ${systemDocData.systemId} finished`));
  };

  await bulkWriter.flush().then(() => {
    console.log('Finished migration.');
  });
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

main();
