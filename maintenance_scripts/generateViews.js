require('dotenv').config();
const request = require('request-promise');
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

const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;
const TESTUID = 'h8hkPVLWvLZldPivB1g6p6yQ8RX2'; // h8hkPVLWvLZldPivB1g6p6yQ8RX2 mcC6T6MLknUOZmK4cpB4Ti9DFn63

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

const generateGeoKeywords = async (coord, maxDist) => {
  if (!coord) {
    return [];
  }

  let words = [];
  let placeType = 'place';
  if (maxDist > 3000) {
    return ['world', 'worldwide', 'global', 'earth', 'international'];
  } else if (maxDist > 1500) {
    placeType = 'country';
    words.push('international');
  } else if (maxDist > 500) {
    placeType = 'country';
  } else if (maxDist > 60) {
    placeType = 'region';
  }

  const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coord.lng},${coord.lat}.json?access_token=${process.env.MAPBOXGL_TOKEN}`;
  const rawResult = await request(geocodeUrl);
  const result = JSON.parse(rawResult);
  if (result && result.features) {
    const placeFeatures = result.features.filter((feature) => feature.place_type.includes(placeType));
    if (!placeFeatures.length) {
      return words;
    }

    const placeFeature = placeFeatures[0]; // should only be one
    let placeWords = (placeFeature.text || '').toLowerCase().split(SPLIT_REGEX);
    words.push(...placeWords);
    if (placeFeature.properties && placeFeature.properties.short_code) {
      let shortWords = placeFeature.properties.short_code.toLowerCase().split(SPLIT_REGEX);
      words.push(...shortWords);
    }

    for (const item of (placeFeature.context || [])) {
      let additionalWords = (item.text || '').toLowerCase().split(SPLIT_REGEX);
      let shortWords = (item.short_code || '').toLowerCase().split(SPLIT_REGEX);
      words.push(...additionalWords, ...shortWords);
    }
    return words;
  }
  return [];
}

const getDistance = (coord1, coord2) => {
  const unit = 'M';
  const lat1 = coord1.lat;
  const lon1 = coord1.lng;
  const lat2 = coord2.lat;
  const lon2 = coord2.lng;

  if ((lat1 === lat2) && (lon1 === lon2)) {
    return 0;
  } else {
    let radlat1 = Math.PI * lat1 / 180;
    let radlat2 = Math.PI * lat2 / 180;
    let theta = lon1 - lon2;
    let radtheta = Math.PI * theta / 180;
    let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);

    if (dist > 1) {
      dist = 1;
    }

    dist = Math.acos(dist);
    dist = dist * 180 / Math.PI;
    dist = dist * 60 * 1.1515;

    if (unit === 'K') {
      dist = dist * 1.609344
    }
    return dist;
  }
}

const getGeoData = (system) => {
  const numStations = Object.keys(system.stations).length;
  if (numStations) {
    // Get centroid and bounding box of all stations.
    // TODO: Consider getting average distance from each station to centroid instead of bbox max distance to centroid.
    let lats = [];
    let lngs = [];
    for (const sId in system.stations) {
      let currLat = typeof system.stations[sId].lat === 'string' ? parseFloat(system.stations[sId].lat) : system.stations[sId].lat;
      let currLng = typeof system.stations[sId].lng === 'string' ? parseFloat(system.stations[sId].lng) : system.stations[sId].lng;
      lats.push(currLat);
      lngs.push(currLng);
    }

    const sum = (total, curr) => total + curr;
    const corners = [
      {lat: Math.max(...lats), lng: Math.min(...lngs)},
      {lat: Math.max(...lats), lng: Math.max(...lngs)},
      {lat: Math.min(...lats), lng: Math.max(...lngs)},
      {lat: Math.min(...lats), lng: Math.min(...lngs)}
    ];
    const centroid = {
      lat: lats.reduce(sum) / numStations,
      lng: lngs.reduce(sum) / numStations
    };
    const maxDist = Math.max(...corners.map(c => getDistance(centroid, c)));

    return {
      centroid: centroid,
      maxDist: maxDist
    };
  }
  return {};
}

// This function is to generate keywords to systems such that we can use Firestore arrayContins to
// facilitate searching for systems on an explore page or elsewhere.
const main = async () => {
  console.log('~~~~ !! Views Generation !! ~~~~');
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

  const dbQuery = argv.full ? database.collectionGroup('systems') : database.collection(`users/${TESTUID}/systems`);
  const systemCollections = await dbQuery.get();
  systemCollections.forEach(async (doc) => {
    const data = doc.data();
    const userDoc = await doc.ref.parent.parent.get();
    const userData = userDoc.data();
    const viewId = Buffer.from(`${userData.userId}|${data.systemId}`).toString('base64');
    const isDefault = userData && (!userData.userId || userData.userId === 'default');

    if (argv.write) {
      let viewDoc = database.doc(`views/${viewId}`);
      let vds = await viewDoc.get();
      if (vds && vds.data()) {
        console.log('Already handled. Delete the view docs if you want to overwrite existing ones.');
        return;
      }
    }

    if (!isDefault && data && Object.keys(data.map || {}).length) {
      const titleWords = generateTitleKeywords(data.map);
      const { centroid, maxDist } = getGeoData(data.map);
      const geoWords = await generateGeoKeywords(centroid, maxDist);
      const keywords = [...titleWords, ...geoWords];
      const uniqueKeywords = keywords.filter((kw, ind) => kw && ind === keywords.indexOf(kw));

      const view = {
        viewId: viewId,
        userId: userData.userId,
        systemId: data.systemId,
        title: data.map.title || '',
        keywords: uniqueKeywords,
        centroid: centroid || null,
        maxDist: maxDist || null,
        numStations: Object.keys(data.map.stations || {}).length,
        numLines: Object.keys(data.map.lines || {}).length,
        lastUpdated: userData.lastLogin, // Only using for backfill
        isPrivate: false, // Only using for backfill
        stars: 0
      };
      console.log(view);

      if (argv.write) {
        console.log(`Write data to views/${viewId}`);
        let viewDoc = database.doc(`views/${viewId}`);
        await viewDoc.set(view);
      }
    }
  });
}

main();
