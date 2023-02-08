const admin = require('firebase-admin');
const mapboxStatic = require('@mapbox/mapbox-sdk/services/static');

const { addNotification } = require('../src/notifications.js');

const staticService = mapboxStatic({ accessToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA' });

const notifyAncestorOwners = (systemSnap, context) => {
  const systemData = systemSnap.data();

  for (const [ind, ancestorId] of (systemData.ancestors || []).entries()) {
    const isDirectAncestor = ind === systemData.ancestors.length - 1;
    if (!ancestorId.includes('defaultSystems/')) {
      const ancestorDoc = admin.firestore().doc(`systems/${ancestorId}`);
      ancestorDoc.get().then((ancestorSnap) => {
        if (ancestorSnap.exists) {
          const ancestorData = ancestorSnap.data();

          if (systemData.userId !== ancestorData.userId) {
            const brancherDoc = admin.firestore().doc(`users/${systemData.userId}`);
            brancherDoc.get().then((brancherSnap) => {
              if (brancherSnap.exists) {
                const branchNotif = getBranchNotif(brancherSnap.data(), ancestorData, systemData, isDirectAncestor);
                addNotification(ancestorData.userId, branchNotif);
              }
            });
          }

          admin.firestore().doc(`systems/${ancestorId}`).update({
            descendantsCount: (ancestorData.descendantsCount || 0) + 1,
            directDescendantsCount: (ancestorData.directDescendantsCount || 0) + (isDirectAncestor ? 1 : 0)
          });
        }
      });
    }
  }
}

const getBranchNotif = (brancherData, ancestorData, systemData, isDirectAncestor = false) => {
  const brancherName = systemData.isPrivate ? 'A private user' : (brancherData.displayName ? brancherData.displayName : 'Anon');
  const descendantsCount = (ancestorData.descendantsCount || 0) + 1;
  const directDescendantsCount = (ancestorData.directDescendantsCount || 0) + (isDirectAncestor ? 1 : 0);

  let countTextContent = `${descendantsCount} total ${descendantsCount > 1 ? 'descendants' : 'descendant'}`;
  if (isDirectAncestor) {
    countTextContent = `${directDescendantsCount} direct ${directDescendantsCount > 1 ? 'descendants' : 'descendant'} and ${countTextContent}`
  }

  return {
    type: 'branch',
    destination: `/edit/${ancestorData.systemId}`,
    image: 'branch',
    content: {
      text: `[[starrerName]] ${isDirectAncestor ? 'directly branched from' : 'branched from a descendant of'} your map [[mapTitle]]! It now has [[countText]].`,
      replacements: {
        starrerName: {
          text: brancherName,
          styles: [
            'italic'
          ]
        },
        mapTitle: {
          text: ancestorData.title ? ancestorData.title : 'Untitled',
          styles: [
            'bold',
            'big'
          ]
        },
        countText: {
          text: countTextContent
        }
      }
    }
  };
}

const archiveSystem = async (systemSnap, context) => {
  const archivedDocString = `systemsArchived/${context.params.systemId}`;
  const deletedSystem = systemSnap.data();

  // copy content of system document
  const archivedDoc = admin.firestore().doc(archivedDocString);
  await archivedDoc.set(deletedSystem);

  // copy content of all subcollections (stations, stars, etc)
  const subCollections = await systemSnap.ref.listCollections();
  subCollections.forEach(async (collection) => {
    const archivedCollectionId = `${collection.id}Archived`;
    const docs = await collection.listDocuments();
    docs.forEach(async (doc) => {
      const docSnap = await doc.get();
      const archivedSubDoc = admin.firestore().doc(`${archivedDocString}/${archivedCollectionId}/${doc.id}`);
      archivedSubDoc.set(docSnap.data())
    })
  })
}

const generateSystemThumbnail = async (systemChange, context) => {
  if (!systemChange.after.exists) return; // if system was deleted

  if (systemChange.before.exists) {
    const beforeTimestamp = systemChange.before.data().lastUpdated;
    const afterTimestamp = systemChange.after.data().lastUpdated;

    if (beforeTimestamp === afterTimestamp) {
      // map content was not updated (only stars, commentsCount, etc)
      return;
    }
  }

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

  const staticImageRequest = staticService.getStaticImage({
    ownerId: 'mapbox',
    styleId: 'dark-v10',
    attribution: false,
    highRes: true,
    width: 600,
    height: 400,
    position: 'auto',
    overlays: linePaths
  });

  console.log(staticImageRequest.url());

  staticImageRequest.send()
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
    let { lng, lat } = floatifyAndRoundStationCoord(stations[sId]);
    coords.push([ lng, lat ]);
  }
  return coords;
}

// modified from lib/util.js
const floatifyAndRoundStationCoord = (station) => {
  if (station == null) {
    return station;
  }

  let { lng, lat } = station;
  if (typeof lng === 'string') {
    lng = parseFloat(lng)
  }
  if (typeof lat === 'string') {
    lat = parseFloat(lat)
  }

  lng = parseFloat(lng.toFixed(5));
  lat = parseFloat(lat.toFixed(5));

  station.lat = lat;
  station.lng = lng;
  return station;
}

module.exports = { generateSystemThumbnail, archiveSystem, notifyAncestorOwners };
