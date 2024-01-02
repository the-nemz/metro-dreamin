const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;

const deleteUser = (userRecord, context) => {
  if (!userRecord || !userRecord.uid) return;

  const userDoc = admin.firestore().doc(`users/${userRecord.uid}`);
  userDoc.get().then((userSnap) => {
    if (userSnap.exists) {
      userDoc.update({
        deletionDate: Date.now(),
        displayName: 'Anonymous',
        bio: FieldValue.delete(),
        icon: FieldValue.delete()
      })
    }
  });

  const privateCol = admin.firestore().collection(`users/${userRecord.uid}/private`);
  privateCol.listDocuments().then((privateDocs) => {
    for (const privateDoc of privateDocs) {
      privateDoc.delete();
    }
  })
}

const incrementUsersStats = (userSnap, context) => {
  const globalStatsDoc = admin.firestore().doc(`stats/global`);
  globalStatsDoc.update({
    usersCreated: FieldValue.increment(1)
  });
}

module.exports = { deleteUser, incrementUsersStats };
