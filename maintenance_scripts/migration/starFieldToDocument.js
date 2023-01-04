require('dotenv').config();
const request = require('request-promise');
const admin = require('firebase-admin');
const argv = require('yargs/yargs')(process.argv.slice(2))
  .usage('Usage: $0 [options]')
  .boolean('full')
  .default('full', false)
  .describe('full', 'Run on full set of users, not just test user')
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

// This function is to migrate stars from a field on the user doc to documents in a collection under the system
const main = async () => {
  console.log('~~~~ !! Systems Generation !! ~~~~');
  console.log(argv.write ? '~~~~ !! WRITE FLAG IS ENABLED !! ~~~~' : '~~~~ Write flag is NOT enabled ~~~~');
  console.log(argv.prod ? '~~~~ !! USING PRODUCTION ACCOUNT !! ~~~~' : '~~~~ Using staging account ~~~~');
  console.log(argv.full ? '~~~~ !! RUNNIING ON FULL USER SET !! ~~~~' : `~~~~ Running on test User ID ${TESTUID} ~~~~`);

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

  const timestamp = Date.now();
  const usersQuery = argv.full ? database.collection('users') : database.collection('users').where('userId', '==', TESTUID);
  const userDocs = await usersQuery.get();

  console.log(userDocs.docs.length, 'total user docs');
  let totalStars = 0;
  for (const [i, userDoc] of userDocs.docs.entries()) {
    const userDocData = userDoc.data();
    const userId = userDocData.userId;
    const starredViewIds = userDocData.starredViews || [];

    for (const starredViewId of starredViewIds) {
      const starDocData = {
        userId: userId,
        systemId: starredViewId,
        timestamp: timestamp
      };

      if (argv.write) {
        let starDoc = database.doc(`systems/${starredViewId}/stars/${userId}`);
        bulkWriter.set(starDoc, starDocData)
          .catch(err => {
            console.log(`${systemDocData.systemId}/stars/${userId} FAILURE: error writing star doc`, err);
            return;
          });
      } else {
        console.log(`would write to systems/${starredViewId}/stars/${userId}`);
      }

      totalStars++;
    }

    await bulkWriter.flush().then(() => console.log(`${i}: ${userId} finished`));
  };
  console.log(`${totalStars} total star documents`)

  await bulkWriter.flush().then(() => {
    console.log('Finished migration.');
  });
}

main();
