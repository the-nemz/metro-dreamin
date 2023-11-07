require('dotenv').config();
const admin = require('firebase-admin');
const sizeof = require('firestore-size');
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
const MAX_FIRESTORE_BYTES = 1048576;

// This function simply adds 1ms to the timestamp of every system in order to trgger the onWrite db callback.
const main = async () => {
  console.log('~~~~ !! Systems Map Document Migration !! ~~~~');
  console.log(argv.write ? '~~~~ !! WRITE FLAG IS ENABLED !! ~~~~' : '~~~~ Write flag is NOT enabled ~~~~');
  console.log(argv.prod ? '~~~~ !! USING PRODUCTION ACCOUNT !! ~~~~' : '~~~~ Using staging account ~~~~');
  console.log(argv.full ? '~~~~ !! RUNNIING ON FULL SYSTEM SET !! ~~~~' : `~~~~ Running on test User ID ${TESTUID} ~~~~`);

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

  const systemsQuery = argv.full ? database.collection('systems') : database.collection('systems').where('userId', '==', TESTUID);
  const systemDocs = await systemsQuery.get();

  console.log(systemDocs.docs.length, 'total system docs');
  for (const [i, systemDoc] of systemDocs.docs.entries()) {
    let systemDocData = systemDoc.data();

    if (systemDocData.structure && systemDocData.structure === 'PARTITIONED') {
      console.log(`${i}: ${systemDocData.systemId} already is partitioned`)
      continue;
    };

    let lines = {};
    const linesSnap = await admin.firestore().collection(`systems/${systemDocData.systemId}/lines`).get();
    linesSnap.forEach((lineDoc) => {
      const lineData = lineDoc.data();
      lines[lineData.id] = lineData;
    });

    let stations = {};
    const stationsSnap = await admin.firestore().collection(`systems/${systemDocData.systemId}/stations`).get();
    stationsSnap.forEach((stationDoc) => {
      const stationData = stationDoc.data();
      stations[stationData.id] = stationData;
    });

    let interchanges = {};
    const interchangesSnap = await admin.firestore().collection(`systems/${systemDocData.systemId}/interchanges`).get();
    interchangesSnap.forEach((interchangeDoc) => {
      const interchangeData = interchangeDoc.data();
      interchanges[interchangeData.id] = interchangeData;
    });

    let mapPartitions = {};
    try {
      mapPartitions = getMapPartitions({ lines, stations, interchanges });
    } catch (err) {
      console.log(`${systemDocData.systemId} FAILURE: error generating map partitions`, err);
      return;
    }

    for (const partitionId in mapPartitions) {
      if (argv.write) {
        let partitionDoc = database.doc(`systems/${systemDocData.systemId}/partitions/${partitionId}`);
        bulkWriter.set(partitionDoc, mapPartitions[partitionId])
          .catch(err => {
            console.log(`${systemDocData.systemId} FAILURE: error writing partition doc`, err);
            return;
          });
      } else {
        console.log(`would write to systems/${systemDocData.systemId}/partitions/${partitionId}`);
      }
    }

    if (argv.write) {
      let systemDoc = database.doc(`systems/${systemDocData.systemId}`);
      bulkWriter.update(systemDoc, { structure: 'PARTITIONED' })
        .catch(err => {
          console.log(`${systemDocData.systemId} FAILURE: error writing system doc`, err);
          return;
        });
    } else {
      console.log(`would write to systems/${systemDocData.systemId}`);
    }

    await bulkWriter.flush().then(() => console.log(`${i}: ${systemDocData.systemId} finished`));
  };

  await bulkWriter.flush().then(() => {
    console.log('Finished migration.');
  });
}

// adapted from /app/lib/saver.js
const getMapPartitions = (system) => {
  const mapData = {
    stations: system.stations || {},
    lines: system.lines || {},
    interchanges: system.interchanges || {}
  };

  if (sizeof(mapData) > (MAX_FIRESTORE_BYTES * 0.5)) {
    // trim out station info if map is > 1/2 the max firestore document size of 1 MB
    mapData.stations = trimStations(mapData);
    console.log('Map is large; trimming station info.');
  }

  const stationIds = Object.keys(mapData.stations);
  const lineIds = Object.keys(mapData.lines);
  const interchangeIds = Object.keys(mapData.interchanges);

  // each partition should be up to 80% of the max document size
  const partitionCount = Math.ceil(sizeof(mapData) / (MAX_FIRESTORE_BYTES * 0.8));
  const stationsIndexInterval = stationIds.length / partitionCount;
  const linesIndexInterval = lineIds.length / partitionCount;
  const interchangesIndexInterval = interchangeIds.length / partitionCount;

  if (partitionCount > 1) {
    console.log(`Large map has ${partitionCount} partitions.`)
  }

  let partitions = {};
  let stationStartIndex = 0;
  let lineStartIndex = 0;
  let interchangeStartIndex = 0;
  for (let i = 0; i < partitionCount; i++) {
    const stationEndIndex = Math.min(Math.ceil(stationStartIndex + stationsIndexInterval), stationIds.length);
    let stationsPartition = {};
    for (const sId of stationIds.slice(stationStartIndex, stationEndIndex)) {
      stationsPartition[sId] = mapData.stations[sId];
    }
    stationStartIndex = stationEndIndex;

    const lineEndIndex = Math.min(Math.ceil(lineStartIndex + linesIndexInterval), lineIds.length);
    let linesPartition = {};
    for (const sId of lineIds.slice(lineStartIndex, lineEndIndex)) {
      linesPartition[sId] = mapData.lines[sId];
    }
    lineStartIndex = lineEndIndex;

    const interchangeEndIndex = Math.min(Math.ceil(interchangeStartIndex + interchangesIndexInterval), interchangeIds.length);
    let interchangesPartition = {};
    for (const sId of interchangeIds.slice(interchangeStartIndex, interchangeEndIndex)) {
      interchangesPartition[sId] = mapData.interchanges[sId];
    }
    interchangeStartIndex = interchangeEndIndex;

    const partitionId = `${i}`;
    partitions[partitionId] = {
      id: partitionId,
      stations: stationsPartition,
      lines: linesPartition,
      interchanges: interchangesPartition
    }
  }

  return partitions;
}

const trimStations = (system) => {
  let trimmedStations = {};
  for (const sId in system.stations) {
    if (system.stations[sId].info) {
      let stationWithoutInfo = JSON.parse(JSON.stringify(system.stations[sId]));
      delete stationWithoutInfo.info;
      trimmedStations[sId] = stationWithoutInfo;
    } else {
      trimmedStations[sId] = system.stations[sId];
    }
  }
  return trimmedStations;
}

main();
