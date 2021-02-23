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

let database;

// This function is to generate keywords fo systems such that we can use Firestore arrayContins to
// facilitate searching for systems on an explore page or elsewhere.
const main = async () => {
  admin.initializeApp({
    credential: admin.credential.cert(argv.prod ? prodAccount : stagingAccount)
  });

  database = admin.firestore();
  if (!database) {
    console.error('Unable to set up database connection.');
    return;
  };

  // TODO: uncomment when you want to run on all systems
  // const systemCollections = await database.collectionGroup('systems').where('map.title', '==', 'Paris Métro').get();
  const systemCollections = await database.collection('users/default/systems').get();
  systemCollections.forEach((doc) => {
    const data = doc.data();
    if (data && Object.keys(data.map || {}).length) {
      let keywords = [];
      if (data.map.title) {
        console.log(doc.id, '=>', data.map.title);

        // Split the lowercase title on whitespace and special characters.
        // Add full title and each word of the title to the keywords.
        let title = data.map.title.toLowerCase();
        let titleWords = title.split(/[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/);
        keywords.push(titleWords.join(' ').trim(), ...titleWords);
      }
      console.log(keywords.filter(kw => kw));
    }
  });
}

main();
