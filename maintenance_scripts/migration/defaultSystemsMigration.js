require('dotenv').config();
const request = require('request-promise');
const admin = require('firebase-admin');
const argv = require('yargs/yargs')(process.argv.slice(2))
  .usage('Usage: $0 [options]')
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

// This function is to migrate default maps from /user/default/{systemNumStr} to /defaultSystems and use
// new structure from viewsToSystems.js
const main = async () => {
  console.log('~~~~ !! Default Systems Generation !! ~~~~');
  console.log(argv.write ? '~~~~ !! WRITE FLAG IS ENABLED !! ~~~~' : '~~~~ Write flag is NOT enabled ~~~~');
  console.log(argv.prod ? '~~~~ !! USING PRODUCTION ACCOUNT !! ~~~~' : '~~~~ Using staging account ~~~~');

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

  const defaultsQuery = database.collection('users/default/systems');
  const defaultDocs = await defaultsQuery.get();

  for (const [i, defaultDoc] of defaultDocs.docs.entries()) {
    let oldSysData = defaultDoc.data();

    if (!oldSysData.map || !oldSysData.systemId || !oldSysData.nextLineId || !oldSysData.nextStationId) {
      console.log(`${oldSysData.systemId} FAILURE: old system doc is missing fields`);
      return;
    }

    let newSysData = {
      title: oldSysData.map.title,
      meta: {
        nextLineId: oldSysData.nextLineId,
        nextStationId: oldSysData.nextStationId
      }
    };

    let systemDoc = database.collection('defaultSystems').doc();
    if (argv.write) {
      bulkWriter.set(systemDoc, newSysData)
        .catch(err => {
          console.log(`${systemDoc.id} ${oldSysData.systemId} FAILURE: error writing system doc`, err);
          return;
        });
    } else {
      console.log(`would write to systems/${oldSysData.systemId}`);
    }

    for (const lineKey in (oldSysData.map.lines || {})) {
      if (argv.write) {
        const lineDoc = database.doc(`defaultSystems/${systemDoc.id}/lines/${lineKey}`);
        bulkWriter.set(lineDoc, oldSysData.map.lines[lineKey])
          .catch(err => {
            console.log(`${systemDoc.id} ${oldSysData.systemId} FAILURE: error writing line doc ${lineKey}`, err);
            return;
          });
      } else {
        console.log(`would write to defaultSystems/${systemDoc.id}/lines/${lineKey}`);
      }
    }

    for (const stationId in (oldSysData.map.stations || {})) {
      if (argv.write) {
        const stationDoc = database.doc(`defaultSystems/${systemDoc.id}/stations/${stationId}`);
        delete oldSysData.map.stations[stationId].info;
        bulkWriter.set(stationDoc, oldSysData.map.stations[stationId])
          .catch(err => {
            console.log(`${systemDoc.id} ${oldSysData.systemId} FAILURE: error writing station doc ${stationId}`, err);
            return;
          });
      } else {
        console.log(`would write to defaultSystems/${systemDoc.id}/stations/${stationId}`);
      }
    }

    await bulkWriter.flush().then(() => console.log(`${i}: ${oldSysData.systemId} finished`));
  };

  await bulkWriter.flush().then(() => {
    console.log('Finished migration.');
  });
}

main();
