'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors');
const express = require('express');
const app = express();

const { viewNotifications } = require('./src/notifications.js');
const { stars } = require('./src/stars.js');
const { views } = require('./src/views.js');

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

exports.incrementStarsCount = functions.firestore
  .document('systems/{systemId}/stars/{userId}')
  .onCreate((snap, context) => {
    const systemDoc = admin.firestore().doc(`systems/${context.params.systemId}`);
    systemDoc.get().then((systemSnap) => {
      if (systemSnap.exists) {
        admin.firestore().doc(`systems/${context.params.systemId}`).update({
          stars: (systemSnap.data().stars || 0) + 1
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
