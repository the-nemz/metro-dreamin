const admin = require('firebase-admin');
const mapboxStatic = require('@mapbox/mapbox-sdk/services/static');

const staticService = mapboxStatic({ accessToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA' });

const generateSystemThumbnail = async (systemChange, context) => {
  if (!systemChange.after.exists) return; // if system was deleted

  let lines = {};
  const linesSnap = await admin.firestore().collection(`systems/${context.params.systemId}/lines`).get();
  linesSnap.forEach((lineDoc) => {
    const lineData = lineDoc.data();
    lines[lineData.id] = lineData;
  });

  let stations = {};
  const stationsSnap = await admin.firestore().collection(`systems/${context.params.systemId}/stations`).get();
  stationsSnap.forEach((stationDoc) => {
    const stationData = stationDoc.data();
    stations[stationData.id] = stationData;
  });

  let linePaths = [];
  for (let i = 0; i < 30; i++) {
    for (const lineKey in lines) {
      const line = lines[lineKey];
      const coords = stationIdsToCoordinates(stations, line.stationIds);

      if (coords.length > 1) {
        linePaths.push({
          path: {
            coordinates: coords,
            strokeWidth: 4,
            strokeColor: line.color,
          }
        })
      }
    }
  }

  staticService.getStaticImage({
    ownerId: 'mapbox',
    styleId: 'dark-v10',
    attribution: false,
    highRes: true,
    width: 600,
    height: 400,
    position: 'auto',
    overlays: linePaths
  })
    .send()
    .then(response => {
      const imageBuffer = Buffer.from(response.body, 'binary');
      const thumbnailFile = admin.storage().bucket().file(`${context.params.systemId}.png`);
      thumbnailFile.save(imageBuffer, { contentType: 'image/png' });
    })
    .catch((error) => {
      // TODO: for maps that are too large, progressively scale back by the following:
      // first remove waypoints
      // then remove stations that are a certain % distance from centroid given maxDist
      // repeat second step until the static image succeeds
      console.log("Error generating static image ", error);
    });
}

// taken from lib/util.js
const stationIdsToCoordinates = (stations, stationIds) => {
  let coords = [];
  for (const sId of stationIds) {
    if (!stations[sId]) continue;
    let { lng, lat } = floatifyStationCoord(stations[sId]);
    coords.push([ lng, lat ]);
  }
  return coords;
}

// taken from lib/util.js
const floatifyStationCoord = (station) => {
  if (station == null) {
    return station;
  }

  let { lng, lat } = station;
  if (typeof lng === 'string') {
    station.lng = parseFloat(lng)
  }
  if (typeof lat === 'string') {
    station.lat = parseFloat(lat)
  }
  return station;
}

module.exports = { generateSystemThumbnail };
