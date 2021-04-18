require('dotenv').config();
const admin = require('firebase-admin');
const argv = require('yargs/yargs')(process.argv.slice(2))
  .usage('Usage: $0 [options]')
  .boolean('full')
  .default('full', false)
  .describe('full', 'Run on full set of views, not just test views')
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

const TESTUID = 'pzjtpoFkzeQEzaC6nNhHOvEe6xE3'; // pzjtpoFkzeQEzaC6nNhHOvEe6xE3 h8hkPVLWvLZldPivB1g6p6yQ8RX2 mcC6T6MLknUOZmK4cpB4Ti9DFn63

// This function is to add a notifications collection and an initial notification to all users.
const main = async () => {
  console.log('~~~~ !! Notification Generation !! ~~~~');
  console.log(argv.write ? '~~~~ !! WRITE FLAG IS ENABLED !! ~~~~' : '~~~~ Write flag is NOT enabled ~~~~');
  console.log(argv.prod ? '~~~~ !! USING PRODUCTION ACCOUNT !! ~~~~' : '~~~~ Using staging account ~~~~');
  console.log(argv.full ? '~~~~ !! RUNNIING ON FULL VIEW SET !! ~~~~' : `~~~~ Running on test UID ${TESTUID} ~~~~`);

  admin.initializeApp({
    credential: admin.credential.cert(argv.prod ? prodAccount : stagingAccount)
  });

  const database = admin.firestore();
  if (!database) {
    console.error('Unable to set up database connection.');
    return;
  };

  const editFunc = async (userRef) => {
    const userDoc = await userRef.get();
    const data = userDoc.data();
    console.log(data);
    const notifCollection = userRef.collection('notifications');

    if (Object.keys(data || {}).length) {
      const timestamp = Date.now();
      const notif = {
        timestamp: timestamp,
        type: 'system',
        destination: '/explore',
        viewed: false,
        image: 'logo',
        content: {
          text: 'Introducing the [[explore]]! You can now [[searchStar]] other users maps, as well as see [[featured]]!',
          replacements: {
            explore: {
              text: 'Explore Page',
              styles: [
                'bold',
                'big'
              ]
            },
            searchStar: {
              text: 'search for and star',
              styles: [
                'bold'
              ]
            },
            countText: {
              text: 'featured maps',
              styles: [
                'bold'
              ]
            }
          }
        }
      };
      console.log(notif);

      if (argv.write) {
        console.log(`Write data to users/${data.userId}/notifications/${timestamp}`);
        let notifDoc = notifCollection.doc(`${timestamp}`);
        await notifDoc.set(notif);
      }
    }
  }

  if (argv.full) {
    const dbQuery = database.collection('users');
    const userDocs = await dbQuery.get();
    userDocs.forEach((userDoc) => editFunc(userDoc.ref));
  } else {
    const userRef = database.doc(`users/${TESTUID}`);
    editFunc(userRef)
  }
}

main();
