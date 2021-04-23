const admin = require('firebase-admin');

// Set viewed on all notifications for user
// Requires authentication
async function viewNotifications(req, res) {
  if (!req.user || !req.user.uid) {
    res.status(401).send('Unauthorized');
    return;
  }

  const userId = req.user.uid;

  console.log(`Attempting mark all notifications for User ${userId} as viewed`);

  try {
    const userDocSnapshot = admin.firestore().doc(`users/${userId}`);
    const userDoc = await userDocSnapshot.get();
    const userDocData = userDoc.data();
    const notifCollection = userDocSnapshot.collection('notifications');

    if (!userDocData) {
      res.status(404).send('Error: User doc not found');
      return;
    }

    const nCol = await notifCollection.get();
    if (nCol && (nCol.docs || []).length) {
      for (const notifShot of nCol.docs) {
        const notif = notifShot.data();
        if (!notif.viewed) {
          notifShot.ref.update({viewed: true});
        }
      }
    }
    res.status(200).send(`User ${userId} marked all notifications as viewed`);
    return;
  } catch(e) {
    console.log('Error marking notifications as viewed:', e.message);
    res.sendStatus(500);
    return;
  }
}

module.exports = { viewNotifications };
