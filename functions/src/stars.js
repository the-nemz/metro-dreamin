const admin = require('firebase-admin');

const { addNotification } = require('./notifications.js');

// Update stars for a views
// Requires authentication
async function stars(req, res) {
  if (!req.user || !req.user.uid) {
    res.status(401).send('Unauthorized');
    return;
  }

  const userId = req.user.uid;
  const viewId = `${req.query.viewId}`;
  const action = `${req.query.action}`;

  if (!viewId) {
    res.status(400).send('Bad Request: viewId is a required param');
    return;
  }

  console.log(`Attempting to star View ${viewId} for User ${userId}`);

  try {
    const userDocSnapshot = admin.firestore().doc(`users/${userId}`);
    const userDoc = await userDocSnapshot.get();
    const userDocData = userDoc.data();

    if (!userDocData) {
      res.status(404).send('Error: User doc not found');
      return;
    }

    const viewDocSnapshot = admin.firestore().doc(`systems/${viewId}`);
    const viewDoc = await viewDocSnapshot.get();
    const viewDocData = viewDoc.data();

    if (!viewDocData) {
      res.status(404).send('Error: View doc not found');
      return;
    }

    let starredViews = userDocData.starredViews || [];
    let stars = viewDocData.stars || 0;

    switch (action) {
      case 'add':
        if (!starredViews.includes(viewId)) {
          starredViews.push(viewId);
          await userDocSnapshot.update({
            starredViews: starredViews
          });

          await viewDocSnapshot.update({
            stars: stars + 1
          });

          if (userId !== viewDocData.userId) {
            // do not notify when a user stars their own map
            addNotification(viewDocData.userId, getStarNotif(userDocData, viewDocData));
          }
        }

        res.status(200).send(`User ${userId} starred ${viewId}`);
        return;
      case 'remove':
        if (starredViews.includes(viewId)) {
          starredViews = starredViews.filter(vId => vId !== viewId);
          await userDocSnapshot.update({
            starredViews: starredViews
          });

          await viewDocSnapshot.update({
            stars: Math.max(stars - 1, 0)
          });
        }

        res.status(200).send(`User ${userId} un-starred ${viewId}`);
        return;
      default:
        res.status(400).send('Bad Request: action must be "add" or "remove"');
        return;
    }
  } catch(e) {
    console.log('Error starring view:', e.message);
    res.sendStatus(500);
    return;
  }
}

function getStarNotif(starrerData, viewData) {
  const stars = viewData.stars + 1;
  return {
    type: 'star',
    destination: `/view/${viewData.systemNumStr ? viewData.systemId : viewData.viewId}`, // handle both types
    image: 'star',
    content: {
      text: '[[starrerName]] just starred your map [[mapTitle]]! It now has [[countText]].',
      replacements: {
        starrerName: {
          text: starrerData.displayName ? starrerData.displayName : 'Anon',
          styles: [
            'italic'
          ]
        },
        mapTitle: {
          text: viewData.title ? viewData.title : 'Untitled',
          styles: [
            'bold',
            'big'
          ]
        },
        countText: {
          text: stars > 1 ? `${stars} stars` : '1 star',
          styles: [
            'bold'
          ]
        }
      }
    }
  };
}

module.exports = { stars, getStarNotif };
