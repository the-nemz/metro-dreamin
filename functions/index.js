'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors');
const express = require('express');
const mapboxStatic = require('@mapbox/mapbox-sdk/services/static');

const { viewNotifications, addNotification } = require('./src/notifications.js');
const { stars, getStarNotif } = require('./src/stars.js');
const { views } = require('./src/views.js');

const app = express();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: process.env.FIREBASE_CONFIG.databaseURL
});

const authenticate = async (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    req.user = {};
    next();
    return;
  }

  const idToken = req.headers.authorization.split('Bearer ')[1];
  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedIdToken;
    next();
    return;
  } catch(e) {
    req.user = {};
    next();
    return;
  }
};

app.use(authenticate, cors({ origin: true }));

// PATCH /v1/notifications
app.patch('/v1/notifications', async (req, res) => await viewNotifications(req, res));

// PUT /v1/stars?viewId={viewId}&action={add|remove}
app.put('/v1/stars', async (req, res) => await stars(req, res));

// PUT /v1/views/{viewId}?generate{true|false}&=makePrivate={true|false}
app.put('/v1/views/:viewId', async (req, res) => await views(req, res));

exports.api = functions.https.onRequest(app);








const staticService = mapboxStatic({ accessToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA' });

exports.incrementStarsCount = functions.firestore
  .document('systems/{systemId}/stars/{userId}')
  .onCreate((snap, context) => {
    const systemDoc = admin.firestore().doc(`systems/${context.params.systemId}`);
    systemDoc.get().then((systemSnap) => {
      if (systemSnap.exists) {
        const systemData = systemSnap.data();

        if (context.params.userId !== systemData.userId) {
          const starrerDoc = admin.firestore().doc(`users/${context.params.userId}`);
          starrerDoc.get().then((starrerSnap) => {
            if (starrerSnap.exists) {
              const starNotif = getStarNotif(starrerSnap.data(), systemData);
              addNotification(systemData.userId, starNotif);
            }
          });
        }

        admin.firestore().doc(`systems/${context.params.systemId}`).update({
          stars: (systemData.stars || 0) + 1
        });
      }
    });
  });

exports.decrementStarsCount = functions.firestore
  .document('systems/{systemId}/stars/{userId}')
  .onDelete((snap, context) => {
    const systemDoc = admin.firestore().doc(`systems/${context.params.systemId}`);
    systemDoc.get().then((systemSnap) => {
      if (systemSnap.exists && systemSnap.data().stars) {
        admin.firestore().doc(`systems/${context.params.systemId}`).update({
          stars: systemSnap.data().stars - 1
        });
      }
    });
  });

exports.generateSystemThumbnail = functions.firestore
  .document('systems/{systemId}')
  .onWrite(async (systemChange, context) => {
    if (!systemChange.after.exists) return;

    const systemDocData = systemChange.after.data();

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

    const req = staticService.getStaticImage({
      ownerId: 'mapbox',
      styleId: 'dark-v10',
      attribution: false,
      highRes: true,
      width: 600,
      height: 400,
      position: 'auto',
      overlays: linePaths
    })
      // .send()
      // .then(response => {
      //   const image = response.body;
      //   console.log(`"${image}"`)
      // });
    console.log(req.url().length, req.url())
  });
