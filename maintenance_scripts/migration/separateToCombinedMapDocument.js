require('dotenv').config();
const admin = require('firebase-admin');
const { sep } = require('path');
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
    if (i > 10) break;

    let systemDocData = systemDoc.data();

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
      stations[stationData.id + 'a'] = stationData;
      stations[stationData.id + 'b'] = stationData;
      stations[stationData.id + 'c'] = stationData;
      stations[stationData.id + 'd'] = stationData;
    });

    let interchanges = {};
    const interchangesSnap = await admin.firestore().collection(`systems/${systemDocData.systemId}/interchanges`).get();
    interchangesSnap.forEach((interchangeDoc) => {
      const interchangeData = interchangeDoc.data();
      interchanges[interchangeData.id] = interchangeData;
    });

    let mapData = { lines, stations, interchanges };
    if (sizeof(mapData) > MAX_FIRESTORE_BYTES) {
      // TODO: do this
    }

    if (argv.write) {
      let systemDoc = database.doc(`systems/${systemDocData.systemId}`);
      bulkWriter.update(systemDoc, { v: '3.1' })
        .catch(err => {
          console.log(`${systemDocData.systemId} FAILURE: error writing system doc`, err);
          return;
        });
    } else {
      console.log(`would write to systems/${systemDocData.systemId}`);
    }

    if (argv.write) {
      let mapDoc = database.doc(`systems/${systemDocData.systemId}/map/map`);
      bulkWriter.set(mapDoc, mapData)
        .catch(err => {
          console.log(`${systemDocData.systemId} FAILURE: error writing map doc`, err);
          return;
        });
    } else {
      console.log(`would write to systems/${systemDocData.systemId}/map/map`);
    }

    await bulkWriter.flush().then(() => console.log(`${i}: ${systemDocData.systemId} finished`));
  };

  await bulkWriter.flush().then(() => {
    console.log('Finished migration.');
  });
}

main();
