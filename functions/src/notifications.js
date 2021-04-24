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

// Helper function to add a notification to a user.
// Notification structure
// {
//   timestamp: timestamp, // set by this helper
//   type: 'system',
//   destination: '/explore',
//   viewed: false, // set by this helper
//   image: 'logo',
//   content: {
//     text: 'Introducing the [[explore]]! You can now [[searchStar]] other users maps, as well as see [[featured]]!',
//     replacements: {
//       explore: {
//         text: 'Explore Page',
//         styles: [
//           'bold',
//           'big'
//         ]
//       },
//       searchStar: {
//         text: 'search for and star',
//         styles: [
//           'bold'
//         ]
//       },
//       featured: {
//         text: 'featured maps',
//         styles: [
//           'bold'
//         ]
//       }
//     }
//   }
// }
async function addNotification(userId, notification) {
  if (!userId) {
    console.log('Valid userId is required');
    return;
  }

  if (!notification || !notification.type || !notification.destination || !notification.content) {
    console.log('Valid notification is required');
    return;
  }

  console.log(`Adding notification for User ${userId}: ${JSON.stringify(notification)}`);

  try {
    const userDocSnapshot = admin.firestore().doc(`users/${userId}`);
    const userDoc = await userDocSnapshot.get();
    if (!userDoc.exists) {
      console.log(`User doc for uid ${userId} does not exist`);
      return;
    }

    const timestamp = Date.now();
    notification.timestamp = timestamp;
    notification.viewed = false;

    const notifCollection = userDocSnapshot.collection('notifications');

    let notifDoc = notifCollection.doc(`${timestamp}`);
    notifDoc.set(notification);
    return;
  } catch(e) {
    console.log(`Error adding notification ${JSON.stringify(notification)} for User ${userId}:`, e.message);
    return;
  }
}

module.exports = { viewNotifications, addNotification };
