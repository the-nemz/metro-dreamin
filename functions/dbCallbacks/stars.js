const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;

const { addNotification } = require('../src/notifications.js');
const { getStarNotif } = require('../src/stars.js');

const incrementStarsCount = (snap, context) => {
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
        stars: FieldValue.increment(1)
      });
    }
  });
}

const decrementStarsCount = (snap, context) => {
  const systemDoc = admin.firestore().doc(`systems/${context.params.systemId}`);
  systemDoc.get().then((systemSnap) => {
    if (systemSnap.exists && systemSnap.data().stars) {
      admin.firestore().doc(`systems/${context.params.systemId}`).update({
        stars: FieldValue.increment(-1)
      });
    }
  });
}

module.exports = { incrementStarsCount, decrementStarsCount };
