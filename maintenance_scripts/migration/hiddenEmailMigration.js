require('dotenv').config();
const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;
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

// This function moves the email field of user document to a new document under users/{userId}/private/info
const main = async () => {
  console.log('~~~~ !! Email Migration !! ~~~~');
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

  const usersQuery = argv.full ? database.collection('users') : database.collection('users').where('userId', '==', TESTUID);
  const userDocs = await usersQuery.get();

  console.log(userDocs.docs.length, 'total user docs');
  for (const [i, userDoc] of userDocs.docs.entries()) {
    let userDocData = userDoc.data();

    if (!userDocData.userId) {
      console.error('No userId in user document');
      continue
    };

    if (argv.write) {
      let privateInfoDoc = database.doc(`users/${userDocData.userId}/private/info`);

      if ((await privateInfoDoc.get()).exists) {
        console.log(`${i}: ${userDocData.userId} already handled`);
        continue;
      }

      bulkWriter.set(privateInfoDoc, {
        email: userDocData.email || '',
        userId: userDocData.userId
      }).catch(err => {
        console.log(`${userDocData.userId} FAILURE: error writing private info doc`, err);
        return;
      });
    } else {
      console.log(`would write to users/${userDocData.userId}/private/info`);
    }

    if (argv.write) {
      bulkWriter.update(userDoc.ref, {
        email: FieldValue.delete()
      }).catch(err => {
        console.log(`${userDocData.userId} FAILURE: error writing user doc`, err);
        return;
      });
    } else {
      console.log(`would write to users/${userDocData.userId}`);
    }

    await bulkWriter.flush().then(() => console.log(`${i}: ${userDocData.userId} finished`));
  };

  await bulkWriter.flush().then(() => {
    console.log('Finished migration.');
  });
}

main();
