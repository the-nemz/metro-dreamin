const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;

const incrementUsersStats = (userSnap, context) => {
  const globalStatsDoc = admin.firestore().doc(`stats/global`);
  globalStatsDoc.update({
    usersCreated: FieldValue.increment(1)
  });
}

module.exports = { incrementUsersStats };
