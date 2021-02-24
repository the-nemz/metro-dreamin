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

const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;

let database;

const getGeoInfo = async (coord) => {
  const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coord.lng},${coord.lat}.json?access_token=${process.env.MAPBOXGL_TOKEN}`;
  const rawResult = await request(geocodeUrl);
  const result = JSON.parse(rawResult);
  if (result && result.features) {
    let words = [];
    const placeFeatures = result.features.filter((feature) => feature.place_type.includes('place'));
    if (!placeFeatures.length) {
      return words;
    }

    const placeFeature = placeFeatures[0]; // should only be one
    let placeWords = (placeFeature.text || '').toLowerCase().split(SPLIT_REGEX);
    words.push(...placeWords);

    for (const item of (placeFeature.context || [])) {
      let additionalWords = (item.text || '').toLowerCase().split(SPLIT_REGEX);
      let shortWords = (item.short_code || '').toLowerCase().split(SPLIT_REGEX);
      words.push(...additionalWords, ...shortWords);
    }
    return words;
  }
  return [];
}

const generateGeoKeywords = async (system) => {
  const numStations = Object.keys(system.stations).length;
  if (numStations) {
    // Get centroid of all stations. This is accurate enough for this use (generally small areas).
    let totalLat = 0;
    let totalLng = 0;
    for (const sId in system.stations) {
      let currLat = typeof system.stations[sId].lat === 'string' ? parseFloat(system.stations[sId].lat) : system.stations[sId].lat;
      let currLng = typeof system.stations[sId].lng === 'string' ? parseFloat(system.stations[sId].lng) : system.stations[sId].lng;
      totalLat += currLat;
      totalLng += currLng;
    }
    const centroid = {
      lat: totalLat / numStations,
      lng: totalLng / numStations
    };

    const geoWords = await getGeoInfo(centroid);
    return geoWords;
  }
  return [];
}

const generateTitleKeywords = (system) => {
  let keywords = [];
  if (system.title) {
    // Split the lowercase title on whitespace and special characters.
    // Add full title and each word of the title to the keywords.
    let title = system.title.toLowerCase();
    let titleWords = title.split(SPLIT_REGEX);
    keywords.push(...titleWords);
  }
  return keywords;
}

// This function is to generate keywords to systems such that we can use Firestore arrayContins to
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
  // const systemCollections = await database.collectionGroup('systems').get();
  const systemCollections = await database.collection('users/default/systems').get();
  systemCollections.forEach(async (doc) => {
    const data = doc.data();
    if (data && Object.keys(data.map || {}).length) {
      console.log(data.systemId, '=>', data.map.title);
      const titleWords = generateTitleKeywords(data.map);
      const geoWords = await generateGeoKeywords(data.map);
      const keywords = [...titleWords, ...geoWords];
      const uniqueKeywords = keywords.filter((kw, ind) => kw && ind === keywords.indexOf(kw))
      console.log(uniqueKeywords);
    }

    // TODO: get weighted averge coordinate from stations. use this to determine city/country etc and
    // add those as keywords. also store that coordinate itself, ownerid, systemid

    // NOTE/TODO: keywords, private flag, and coordinate should be stored in a new top-level Collection
  });
}

main();
