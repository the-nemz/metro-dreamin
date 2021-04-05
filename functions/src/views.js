const admin = require('firebase-admin');
const functions = require('firebase-functions');
const request = require('request-promise');

const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;

// Update or generate a view doc
// Requires authentication
async function views(req, res) {
  if (!req.user || !req.user.uid) {
    res.status(401).send('Unauthorized');
    return;
  }

  const userId = req.user.uid;
  const viewId = req.params.viewId;
  const generate = `${req.query.generate}`;
  const makePrivate = `${req.query.makePrivate}`;

  if (!viewId) {
    res.status(400).send('Bad Request: viewId is a required param');
    return;
  }

  console.log(functions.config());
  console.log(`Attempting to update View ${viewId}`);

  try {
    const viewDocSnapshot = admin.firestore().doc(`views/${viewId}`);
    const viewDoc = await viewDocSnapshot.get();

    if (generate === 'true') {
      console.log(viewDoc ? 'has viewdoc' : 'viewdoc is falsy');

      const viewIdParts = getPartsFromViewId(viewId);
      if (userId !== viewIdParts.userId || !viewIdParts.systemId) {
        res.status(403).send('Error: User does not have access to this viewDoc');
        return;
      }

      const sysDocSnapshot = admin.firestore().doc(`users/${userId}/systems/${viewIdParts.systemId}`);
      const sysDoc = await sysDocSnapshot.get();
      const sysDocData = sysDoc.data();

      console.log('sysdocdata', JSON.stringify(sysDocData));

      if (userId !== 'default' && sysDocData && Object.keys(sysDocData.map || {}).length) {
        console.log('in view generation part')
        const titleWords = generateTitleKeywords(sysDocData.map);
        const { centroid, maxDist } = getGeoData(sysDocData.map);
        const geoWords = await generateGeoKeywords(centroid, maxDist);
        const keywords = [...titleWords, ...geoWords];
        const uniqueKeywords = keywords.filter((kw, ind) => kw && ind === keywords.indexOf(kw));

        const view = {
          viewId: viewId,
          userId: userId,
          systemId: sysDocData.systemId,
          title: sysDocData.map.title || '',
          keywords: uniqueKeywords,
          centroid: centroid || null,
          maxDist: maxDist || null,
          numStations: Object.keys(sysDocData.map.stations || {}).length,
          numLines: Object.keys(sysDocData.map.lines || {}).length,
          lastUpdated: Date.now()
        };

        console.log('the view', JSON.stringify(view));

        if (!viewDoc.exists) {
          console.log(`Write initial data to views/${viewId}`);
          view.stars = 0;
          view.isPrivate = makePrivate === 'true' ? true : false
          await viewDocSnapshot.set(view);
        } else {
          console.log(`Write updated data to views/${viewId}`);
          await viewDocSnapshot.update(view);
        }

        const viewDocUpdated = await viewDocSnapshot.get();
        res.status(200).json(viewDocUpdated.data());
      } else {
        console.log('Error updating view: no entry for map in database');
        res.sendStatus(500);
        return;
      }
    } else if (makePrivate !== '') {
      const viewDocData = viewDoc.data();

      if (!viewDocData) {
        res.status(404).send('Error: View doc not found');
        return;
      }

      if (viewDocData.userId !== userId) {
        res.status(403).send('Error: User does not have access to this viewDoc');
        return;
      }

      switch (makePrivate) {
        case 'true':
          await viewDocSnapshot.update({
            isPrivate: true,
            lastUpdated: Date.now()
          });
          break;
        case 'false':
          await viewDocSnapshot.update({
            isPrivate: false,
            lastUpdated: Date.now()
          });
          break;
        default:
          res.status(400).send('Bad Request: makePrivate must be "true" or "false"');
          return;
      }

      const viewDocUpdated = await viewDocSnapshot.get();
      res.status(200).json(viewDocUpdated.data());
      return;
    } else {
      res.status(400).send('Bad Request: either generate and/or makePrivate must be set');
      return;
    }
  } catch(e) {
    console.log('Error updating view:', e.message);
    res.sendStatus(500);
    return;
  }
}

function getPartsFromViewId(viewId) {
  const bufferObj = Buffer.from(viewId, 'base64');
  const decodedString = bufferObj.toString('utf8');
  const decodedParts = decodedString.split('|');
  const uid = decodedParts[0];
  const sysId = decodedParts[1];
  return {
    userId: uid,
    systemId: sysId
  };
}

function generateTitleKeywords(system) {
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

async function generateGeoKeywords(coord, maxDist) {
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

  const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coord.lng},${coord.lat}.json?access_token=${functions.config().mapboxgl.token}`;
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

function getDistance(coord1, coord2) {
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

function getGeoData(system) {
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

module.exports = { views };
