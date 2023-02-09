
import React from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  query,
  where,
  doc,
  getDoc,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator, ref, getDownloadURL } from 'firebase/storage';
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
  console.log('~~~~ Using staging account ~~~~');
  console.log(`~~~~ Using function url ${apiBaseUrl} ~~~~`);
  if (useEmulator) console.log('~~~~ Using emulators ~~~~');
}

const app = initializeApp(FIREBASE_CONFIGS[env]);

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);

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

/**
 * Gets a users/{uid} document
 * @param {string} uid
 */
export async function getSystemsByUser(uid) {
  if (!uid) {
    console.log('getSystemsByUser: uid is a required parameter');
    return;
  }

  try {
    const systemsByUserQuery = query(collection(firestore, 'systems'), where('userId', '==', uid));
    const systemDocs = await getDocs(systemsByUserQuery);
    let systemsByUser = [];
    systemDocs.forEach((systemDoc) => {
      systemsByUser.push(systemDoc.data());
    });
    return systemsByUser;
  } catch (e) {
    console.log('getSystemsByUser error:', e);
    return;
  }
}

/**
 * Gets systems/{systemId}/lines systems/{systemId}/stations etc documents and
 * puts them into expected system format
 * @param {string} systemId
 */
export async function getFullSystem(systemId) {
  if (!systemId) {
    console.log('getFullSystem: systemId is a required parameter');
    return;
  }

  try {
    const viewDoc = doc(firestore, `systems/${systemId}`);
    const viewDocData = await getDoc(viewDoc).then((vDoc) => {
      if (vDoc.exists()) {
        return vDoc.data();
      } else {
        throw 'System doc does not exist';
      }
    });

    const linesPromise = new Promise((resolve) => {
      getDocs(collection(firestore, `systems/${systemId}/lines`)).then((linesSnap) => {
        let lines = {};
        linesSnap.forEach((lineDoc) => {
          const lineData = lineDoc.data();
          lines[lineData.id] = lineData;
        });
        resolve({ lines: lines });
      });
    });

    const stationsPromise = new Promise((resolve) => {
      getDocs(collection(firestore, `systems/${systemId}/stations`)).then((stationsSnap) => {
        let stations = {};
        stationsSnap.forEach((stationDoc) => {
          const stationData = stationDoc.data();
          stations[stationData.id] = stationData;
        });
        resolve({ stations: stations });
      });
    });

    const promisesData = await Promise.all([ linesPromise, stationsPromise ]);
    let map = {
      interchanges: {} // TODO: pull from db
    };
    for (const pData of promisesData) {
      map = { ...map, ...pData };
    }

    return {
      map: {
        ...map,
        title: viewDocData.title,
        caption: viewDocData.caption ? viewDocData.caption : ''
      },
      meta: viewDocData.meta
    }
  } catch (e) {
    console.log('getFullSystem error:', e);
    return;
  }
}

/**
 * Gets a views/{systemId} document
 * @param {string} systemId
 */
export async function getSystemDocData(systemId) {
  if (!systemId) {
    console.log('getSystemDocData: systemId is a required parameter');
    return;
  }

  const viewDoc = doc(firestore, `systems/${systemId}`);
  return await getDoc(viewDoc).then((vDoc) => {
    if (vDoc.exists()) {
      return vDoc.data();
    } else {
      console.log('getSystemDocData: unable to get view doc');
      return;
    }
  }).catch((error) => {
    console.log('Unexpected Error:', error);
    return;
  });
}

/**
 * Gets a correctly formatted system and ancestors from another system or a default system in the db
 * @param {string} systemId
 * @param {bool} isDefault
 */
export async function getSystemFromBranch(systemId, isDefault = false) {
  if (!systemId) {
    console.log('systemId: systemId is a required parameter');
    return;
  }

  const docString = `${isDefault ? 'defaultSystems' : 'systems'}/${systemId}`;

  try {
    const viewDoc = doc(firestore, docString);
    const viewDocData = await getDoc(viewDoc).then((vDoc) => {
      if (vDoc.exists()) {
        return vDoc.data();
      } else {
        throw 'System doc does not exist';
      }
    });

    if (viewDocData.isPrivate) throw 'System is private; cannot branch';

    const meta = viewDocData.meta;
    delete meta.systemNumStr;

    const ancestorId = isDefault ? `defaultSystems/${systemId}` : systemId;
    const ancestors = [ ...(viewDocData.ancestors || []), ancestorId ];

    const linesPromise = new Promise((resolve) => {
      getDocs(collection(firestore, `${docString}/lines`)).then((linesSnap) => {
        let lines = {};
        linesSnap.forEach((lineDoc) => {
          const lineData = lineDoc.data();
          lines[lineData.id] = lineData;
        });
        resolve({ lines: lines });
      });
    });

    const stationsPromise = new Promise((resolve) => {
      getDocs(collection(firestore, `${docString}/stations`)).then((stationsSnap) => {
        let stations = {};
        stationsSnap.forEach((stationDoc) => {
          const stationData = stationDoc.data();
          stations[stationData.id] = stationData;
        });
        resolve({ stations: stations });
      });
    });

    const promisesData = await Promise.all([ linesPromise, stationsPromise ]);
    let map = {};
    for (const pData of promisesData) {
      map = { ...map, ...pData };
    }

    return {
      map: {
        ...map,
        title: viewDocData.title, // TODO: consider changing title
        caption: '' // do not copy caption
      },
      meta,
      ancestors
    }
  } catch (e) {
    console.log('getFullSystem error:', e);
    return;
  }
}

/**
 * Gets a public url for a blob in firebase storage
 * @param {string} blobId
 */
export async function getUrlForBlob(blobId) {
  if (!blobId) {
    console.log('getUrlForBlob: blobId is a required parameter');
    return;
  }

  const imageRef = ref(storage, blobId);
  return await getDownloadURL(imageRef).catch((error) => {
    console.log('Unexpected Error:', error);
    return;
  });
}
