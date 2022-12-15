
import React from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import retry from 'async-retry';

const FIREBASE_CONFIGS = {
  PROD: {
    apiKey: "AIzaSyBIMlulR8OTOoF-57DHty1NuXM0kqVoL5c",
    authDomain: "metrodreamin.firebaseapp.com",
    databaseURL: "https://metrodreamin.firebaseio.com",
    projectId: "metrodreamin",
    storageBucket: "metrodreamin.appspot.com",
    messagingSenderId: "86165148906"
  },
  STAGING: {
    apiKey: "AIzaSyDYU-8dYy0OWGJ1RJ46V_S7fWJHlAA2DWg",
    authDomain: "metrodreaminstaging.firebaseapp.com",
    databaseURL: "https://metrodreaminstaging.firebaseio.com",
    projectId: "metrodreaminstaging",
    storageBucket: "metrodreaminstaging.appspot.com",
    messagingSenderId: "572980459956"
  }
};

let env = 'PROD';
let apiBaseUrl = 'https://us-central1-metrodreamin.cloudfunctions.net/api/v1';
let useEmulator = false;

if (process.env.NEXT_PUBLIC_STAGING === 'true') {
  env = 'STAGING';
  apiBaseUrl = 'https://us-central1-metrodreaminstaging.cloudfunctions.net/api/v1';
}

if (process.env.NEXT_PUBLIC_LOCAL === 'true') {
  env = 'STAGING';
  apiBaseUrl = 'http://localhost:5001/metrodreaminstaging/us-central1/api/v1';
  useEmulator = true;
}

if (env !== 'PROD') {
  console.log('~~~~ Using staging account ~~~~')
  console.log(`~~~~ Using function url ${apiBaseUrl} ~~~~`)
}

const app = initializeApp(FIREBASE_CONFIGS[env]);

export const auth = getAuth(app);
export const firestore = getFirestore(app);

if (useEmulator) {
  if (!auth.emulatorConfig) {
    connectAuthEmulator(auth, 'http://localhost:9099');
  }
  if (!firestore.emulatorConfig && (firestore._settings.host || '') !== 'localhost:8080') {
    connectFirestoreEmulator(firestore, 'localhost', 8080);
  }
}

export const FirebaseContext = React.createContext({
  apiBaseUrl: apiBaseUrl,
  user: null,
  database: firestore,
  auth: auth,
  settings: {},
  authStateLoading: true
});

/**
 * Updates a users/{uid} document
 * @param {string} uid
 * @param {Object} propertiesToSave
 */
 export async function updateUserDoc(uid, propertiesToSave) {
  if (!uid) {
    console.log('getUserDocData: uid is a required parameter');
    return;
  }

  if (Object.keys(propertiesToSave || {}).length === 0) {
    console.log('getUserDocData: propertiesToSave is empty');
    return;
  }

  await retry(async () => {
    const userDoc = doc(firestore, `users/${uid}`);
    await updateDoc(userDoc, {
      lastLogin: Date.now(),
      ...propertiesToSave
    });
    // TODO: figure out best ReactGA call here, if here at all
  })
}

/**
 * Gets a users/{uid} document
 * @param {string} uid
 */
export async function getUserDocData(uid) {
  if (!uid) {
    console.log('getUserDocData: uid is a required parameter');
    return;
  }

  const userDoc = doc(firestore, `users/${uid}`);
  return await getDoc(userDoc).then((uDoc) => {
    if (uDoc.exists()) {
      return uDoc.data();
    } else {
      console.log('getUserDocData: unable to get user doc');
      return;
    }
  }).catch((error) => {
    console.log('Unexpected Error:', error);
    return;
  });
}

// /**
//  * Gets a users/{uid}/systems/{systemId} document
//  * @param {string} uid
//  * @param {string} systemId
//  */
// export async function getSystemDocData(uid, systemId) {
//   if (!uid) {
//     console.log('getSystemDocData: uid is a required parameter');
//     return;
//   }

//   if (!systemId) {
//     console.log('getSystemDocData: systemId is a required parameter');
//     return;
//   }

//   const systemDoc = doc(firestore, `users/${uid}/systems/${systemId}`);
//   return await getDoc(systemDoc).then((sDoc) => {
//     if (sDoc.exists()) {
//       return sDoc.data();
//     } else {
//       console.log('getSystemDocData: unable to get system doc');
//       return;
//     }
//   }).catch((error) => {
//     console.log('Unexpected Error:', error);
//     return;
//   });
// }

/**
 * Gets systems/{viewId}/lines systems/{viewId}/stations etc documents and
 * puts them into expected system format
 * @param {string} viewId
 */
export async function getSystemFromDatabase(viewId) {
  if (!viewId) {
    console.log('getSystemDocData: viewId is a required parameter');
    return;
  }

  try {
    const viewDoc = doc(firestore, `systems/${viewId}`);
    const viewDocData = await getDoc(viewDoc).then((vDoc) => {
      if (vDoc.exists()) {
        return vDoc.data();
      } else {
        // console.log('getViewDocData: unable to get view doc');
        // return;
        throw 'System doc does not exist'
      }
    // }).catch((error) => {
    //   console.log('Unexpected Error:', error);
    //   return;
    });

    let lines = {};
    const linesSnap = await getDocs(collection(firestore, `systems/${viewId}/lines`));
    linesSnap.forEach((lineDoc) => {
      const lineData = lineDoc.data();
      lines[lineData.id] = lineData;
    });

    let stations = {};
    const stationsSnap = await getDocs(collection(firestore, `systems/${viewId}/stations`));
    stationsSnap.forEach((stationDoc) => {
      const stationData = stationDoc.data();
      stations[stationData.id] = stationData;
    });

    return {
      map: {
        lines: lines,
        stations: stations,
        title: viewDocData.title
      },
      ...viewDocData.meta
    }
  } catch (e) {
    console.log('getSystemFromDatabase error:', e);
    return;
  }
}

/**
 * Gets a views/{viewId} document
 * @param {string} viewId
 */
export async function getViewDocData(viewId) {
  if (!viewId) {
    console.log('getViewDocData: viewId is a required parameter');
    return;
  }

  const viewDoc = doc(firestore, `views/${viewId}`);
  return await getDoc(viewDoc).then((vDoc) => {
    if (vDoc.exists()) {
      return vDoc.data();
    } else {
      console.log('getViewDocData: unable to get view doc');
      return;
    }
  }).catch((error) => {
    console.log('Unexpected Error:', error);
    return;
  });
}
