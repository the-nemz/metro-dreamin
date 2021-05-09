require('dotenv').config();
const admin = require('firebase-admin');
const argv = require('yargs/yargs')(process.argv.slice(2))
  .usage('Usage: $0 [options]')
  .boolean('prod')
  .default('prod', false)
  .describe('prod', 'Use production account')
  .help('h')
  .alias('h', 'help')
  .alias('v', 'version')
  .argv;

const homedir = require('os').homedir();
const prodAccount = require(`${homedir}/.metrodreamin-keys/metrodreamin.json`);
const stagingAccount = require(`${homedir}/.metrodreamin-keys/metrodreaminstaging.json`);

// This function prints the views with stars, ordered by star count.
const main = async () => {
  console.log('~~~~ !! Get Starred Views !! ~~~~');
  console.log(argv.prod ? '~~~~ !! USING PRODUCTION ACCOUNT !! ~~~~' : '~~~~ Using staging account ~~~~');

  admin.initializeApp({
    credential: admin.credential.cert(argv.prod ? prodAccount : stagingAccount)
  });

  const database = admin.firestore();
  if (!database) {
    console.error('Unable to set up database connection.');
    return;
  };

  const dbQuery = database.collection('views').where('stars', '>', 0).orderBy('stars', 'desc');
  const starredDocs = await dbQuery.get();
  starredDocs.forEach((starredDoc) => {
    if (starredDoc) {
      let viewData = starredDoc.data();
      if (viewData) {
        console.log(viewData);
      }
    }
  });
}

main();
