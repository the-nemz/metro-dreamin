require('dotenv').config();
const admin = require('firebase-admin');
const argv = require('yargs/yargs')(process.argv.slice(2))
  .usage('Usage: $0 [options]')
  .boolean('prod')
  .default('prod', false)
  .describe('prod', 'Use production account')
  .number('limit')
  .default('limit', 20)
  .describe('limit', 'Max number of results')
  .string('order')
  .default('order', 'stars')
  .describe('order', 'Order by stars or lastUpdated, descending')
  .boolean('starred')
  .default('starred', false)
  .describe('starred', 'Only include views with at least one star')
  .string('keyword')
  .default('keyword', '')
  .describe('keyword', 'Only include views that contain this keyword')
  .help('h')
  .alias('h', 'help')
  .alias('v', 'version')
  .argv;

const homedir = require('os').homedir();
const prodAccount = require(`${homedir}/.metrodreamin-keys/metrodreamin.json`);
const stagingAccount = require(`${homedir}/.metrodreamin-keys/metrodreaminstaging.json`);

// This function pulls down view documents, filtered and sorted based on command line arguments.
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

  let dbQuery = database.collection('views').where('isPrivate', '==', false);
  if (argv.starred) dbQuery = dbQuery.where('stars', '>', 0);
  if (argv.keyword) dbQuery = dbQuery.where('keywords', 'array-contains', argv.keyword);
  dbQuery = dbQuery.orderBy(argv.order, 'desc').limit(argv.limit);

  const starredDocs = await dbQuery.get();
  starredDocs.forEach((starredDoc) => {
    if (starredDoc) {
      let viewData = starredDoc.data();
      if (viewData) {
        console.log(viewData);
      }
    }
  });
  console.log(`\nThere are ${starredDocs.size >= argv.limit ? 'at least ' + argv.limit : starredDocs.size} matching views.\n`)
}

main();
