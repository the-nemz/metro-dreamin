
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
  updateDoc,
  orderBy,
  getCountFromServer
} from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import retry from 'async-retry';

import { FUNCTIONS_API_BASEURL, GEOSPATIAL_API_BASEURL, INDIVIDUAL_STRUCTURE, PARTITIONED_STRUCTURE } from '/util/constants.js';
import { shouldErrorCauseFailure } from '/util/helpers.js';

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

const RETRY_OPTIONS = {
  retries: 5,
  randomize: false,
  factor: 1.3524 // tuned to wait up to 10 seconds (excluding req time) since Vercel SSR has a 15 second timeout
}

let env = 'PROD';
let useEmulator = false;

if (process.env.NEXT_PUBLIC_STAGING === 'true') {
  env = 'STAGING';
}

if (process.env.NEXT_PUBLIC_LOCAL === 'true') {
  env = 'STAGING';
  useEmulator = true;
}

if (env !== 'PROD') {
  console.log('~~~~ Using staging account ~~~~');
  console.log(`~~~~ Using functions baseurl ${FUNCTIONS_API_BASEURL} ~~~~`);
  console.log(`~~~~ Using geospatial baseurl ${GEOSPATIAL_API_BASEURL} ~~~~`);
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
 * @param {Object} options
 *    [failOnNotFound=true] whether to retry when userDoc is not found
 *    [failOnPermissionDenied=true] whether to retry when permission is denied
 */
 export async function updateUserDoc(uid, propertiesToSave, { failOnNotFound = true, failOnPermissionDenied = true } = {}) {
  if (!uid) {
    console.log('updateUserDoc: uid is a required parameter');
    return;
  }

  if (Object.keys(propertiesToSave || {}).length === 0) {
    console.log('updateUserDoc: propertiesToSave is empty');
    return;
  }

  await retry(async (bail) => {
    try {
      const userDoc = doc(firestore, `users/${uid}`);
      await updateDoc(userDoc, {
        lastLogin: Date.now(),
        ...propertiesToSave
      });
    } catch (e) {
      console.log('updateUserDoc error:', e);
      if (shouldErrorCauseFailure(e, { failOnNotFound, failOnPermissionDenied })) {
        bail(e);
        return;
      } else {
        throw e;
      }
    }
  });
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

  return await retry(async (bail) => {
    try {
      const userDoc = await getDoc(doc(firestore, `users/${uid}`));

      if (userDoc.exists()) {
        return userDoc.data();
      } else {
        console.log('getUserDocData: unable to get user doc');
        throw new Error('Not Found');
      }
    } catch (e) {
      console.log('getUserDocData error:', e);
      if (shouldErrorCauseFailure(e)) {
        bail(e);
        return;
      } else {
        throw e;
      }
    }
  }, RETRY_OPTIONS);
}

/**
 * Gets a users/{uid}/private/info document
 * @param {string} uid
 */
export async function getUserPrivateInfoData(uid) {
  if (!uid) {
    console.log('getUserPrivateInfoData: uid is a required parameter');
    return;
  }

  return await retry(async (bail) => {
    try {
      const privateDoc = await getDoc(doc(firestore, `users/${uid}/private/info`));

      if (privateDoc.exists()) {
        return privateDoc.data();
      } else {
        console.log('getUserPrivateInfoData: unable to get private info doc');
        throw new Error('Not Found');
      }
    } catch (e) {
      console.log('getUserPrivateInfoData error:', e);
      if (shouldErrorCauseFailure(e)) {
        bail(e);
        return;
      } else {
        throw e;
      }
    }
  }, RETRY_OPTIONS);
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

  return await retry(async (bail) => {
    try {
      const systemsByUserQuery = query(collection(firestore, 'systems'),
                                       where('userId', '==', uid),
                                       orderBy('lastUpdated', 'desc'));
      const systemDocs = await getDocs(systemsByUserQuery);
      let systemsByUser = [];
      systemDocs.forEach((systemDoc) => {
        systemsByUser.push(systemDoc.data());
      });
      return systemsByUser;
    } catch (e) {
      console.log('getSystemsByUser error:', e);
      if (shouldErrorCauseFailure(e)) {
        bail(e);
        return;
      } else {
        throw e;
      }
    }
  }, RETRY_OPTIONS);
}

/**
 * Gets systems/{systemId}/partitions systems/{systemId}/lines systems/{systemId}/stations etc
 * documents and puts them into expected system format
 * @param {string} systemId
 * @param {Object} options
 *    [trimLargeSystems=false]: leaves out map data if it is a huge map (only applicable to partitioned structure)
 *    [trimAllSystems=false]: leaves out map data to take advantage of local storage (only used on edit pages)
 *    [failOnNotFound=true]: whether to retry when a systemDoc is not found
 */
export async function getFullSystem(systemId, { trimLargeSystems = false, trimAllSystems = false, failOnNotFound = true } = {}) {
  if (!systemId) {
    console.log('getFullSystem: systemId is a required parameter');
    return;
  }

  return await retry(async (bail) => {
    try {
      const systemDoc = await getDoc(doc(firestore, `systems/${systemId}`));
      if (!systemDoc.exists()) {
        throw new Error('Not Found');
      }
      const systemDocData = systemDoc.data();

      const map = await getSystemMapData(`systems/${systemId}`, systemDocData.structure, { trimLargeSystems, trimAllSystems });

      return {
        map: {
          ...map,
          title: systemDocData.title,
          caption: systemDocData.caption ? systemDocData.caption : ''
        },
        lastUpdated: systemDocData.lastUpdated,
        meta: systemDocData.meta
      }
    } catch (e) {
      console.log('getFullSystem error:', e);
      if (shouldErrorCauseFailure(e, { failOnNotFound })) {
        bail(e);
        return;
      } else {
        throw e;
      }
    }
  }, RETRY_OPTIONS);
}

/**
 * Gets the system map (stations, lines, etc) from a system docstring and a structure type
 * @param {string} systemDocString
 * @param {string} structure
 * @param {Object} trimOptions
 *    trimLargeSystems: leaves out map data if it is a huge map (only applicable to partitioned structure)
 *    trimAllSystems: leaves out map data to take advantage of local storage (only used on edit pages)
 */
async function getSystemMapData(systemDocString, structure, { trimLargeSystems = false, trimAllSystems = false } = {}) {
  let map = {
    stations: {},
    lines: {},
    interchanges: {},
    lineGroups: {}
  };

  switch(structure) {
    case PARTITIONED_STRUCTURE:
      const partitionCollection = collection(firestore, `${systemDocString}/partitions`);

      if (trimAllSystems) {
        // load the data for very large systems on the client side to take advantage of local storage
        return { systemIsTrimmed: true };
      } else if (trimLargeSystems) {
        const partitionCount = (await getCountFromServer(partitionCollection))?.data()?.count ?? 0;
        if (partitionCount > 1) {
          // load the data for very large systems on the client side to avoid 413 errors from Lambda
          return { systemIsTrimmed: true };
        }
      }

      const partitionsSnap = await getDocs(partitionCollection);
      partitionsSnap.forEach((partitionDoc) => {
        const partitionData = partitionDoc.data();
        for (const key in partitionData) {
          if (typeof partitionData[key] === 'object') {
            map[key] = {
              ...(map[key] || {}),
              ...partitionData[key]
            };
          }
        }
      });
      break;

    case INDIVIDUAL_STRUCTURE:
    default:
      const linesPromise = new Promise((resolve) => {
        getDocs(collection(firestore, `${systemDocString}/lines`)).then((linesSnap) => {
          let lines = {};
          linesSnap.forEach((lineDoc) => {
            const lineData = lineDoc.data();
            lines[lineData.id] = lineData;
          });
          resolve({ lines: lines });
        });
      });

      const stationsPromise = new Promise((resolve) => {
        getDocs(collection(firestore, `${systemDocString}/stations`)).then((stationsSnap) => {
          let stations = {};
          stationsSnap.forEach((stationDoc) => {
            const stationData = stationDoc.data();
            stations[stationData.id] = stationData;
          });
          resolve({ stations: stations });
        });
      });

      const interchangesPromise = new Promise((resolve) => {
        getDocs(collection(firestore, `${systemDocString}/interchanges`)).then((interchangesSnap) => {
          let interchanges = {};
          interchangesSnap.forEach((interchangeDoc) => {
            const interchangeData = interchangeDoc.data();
            interchanges[interchangeData.id] = interchangeData;
          });
          resolve({ interchanges: interchanges });
        });
      });

      const lineGroupsPromise = new Promise((resolve) => {
        getDocs(collection(firestore, `${systemDocString}/lineGroups`)).then((lineGroupsSnap) => {
          let lineGroups = {};
          lineGroupsSnap.forEach((lineGroupDoc) => {
            const lineGroupData = lineGroupDoc.data();
            lineGroups[lineGroupData.id] = lineGroupData;
          });
          resolve({ lineGroups: lineGroups });
        });
      });

      const promisesData = await Promise.all([ linesPromise, stationsPromise, interchangesPromise, lineGroupsPromise ]);
      for (const pData of promisesData) {
        map = { ...map, ...pData };
      }
      break;
  }

  // filter out invalid station references in lines
  for (const lineId in (map.lines || {})) {
    map.lines[lineId].stationIds = (map.lines[lineId].stationIds || []).filter(sId => (map.stations || {})[sId]);
  }

  // filter out invalid station references in interchanges
  for (const interchangeId in (map.interchanges || {})) {
    map.interchanges[interchangeId].stationIds = (map.interchanges[interchangeId].stationIds || []).filter(sId => (map.stations || {})[sId]);
  }

  return map;
}

/**
 * Gets a views/{systemId} document
 * @param {string} systemId
 * @param {boolean} [failOnNotFound=true] whether to retry when a systemDoc is not found
 */
export async function getSystemDocData(systemId, failOnNotFound = true) {
  if (!systemId) {
    console.log('getSystemDocData: systemId is a required parameter');
    return;
  }

  return await retry(async (bail) => {
    try {
      const systemDoc = await getDoc(doc(firestore, `systems/${systemId}`));
      if (!systemDoc.exists()) {
        throw new Error('Not Found');
      }
      return systemDoc.data();
    } catch (e) {
      console.log('getSystemDocData error:', e);
      if (shouldErrorCauseFailure(e, { failOnNotFound })) {
        bail(e);
        return;
      } else {
        throw e;
      }
    }
  }, RETRY_OPTIONS);
}

/**
 * Gets a correctly formatted system and ancestors from another system or a default system in the db
 * @param {string} systemId
 * @param {boolean} [isDefault=false]
 * @param {Object} {[trimLargeSystems=false]} leaves out map data if it is a huge map
 */
export async function getSystemFromBranch(systemId, isDefault = false, { trimLargeSystems = false } = {}) {
  if (!systemId) {
    console.log('systemId: systemId is a required parameter');
    return;
  }

  const docString = `${isDefault ? 'defaultSystems' : 'systems'}/${systemId}`;

  return await retry(async (bail) => {
    try {
      const systemDoc = await getDoc(doc(firestore, docString));
      if (!systemDoc.exists()) {
        throw new Error('Not Found');
      }
      const systemDocData = systemDoc.data();

      if (systemDocData.isPrivate) {
        throw new Error('System is private; cannot branch');
      }

      const meta = systemDocData.meta;
      delete meta.systemNumStr;

      const ancestorId = isDefault ? `defaultSystems/${systemId}` : systemId;
      const ancestors = [ ...(systemDocData.ancestors || []), ancestorId ];

      const map = await getSystemMapData(docString, systemDocData.structure, { trimLargeSystems });

      return {
        map: {
          ...map,
          title: systemDocData.title, // TODO: consider changing title
          caption: '' // do not copy caption
        },
        meta,
        ancestors
      }
    } catch (e) {
      console.log('getSystemFromBranch error:', e);
      if (shouldErrorCauseFailure(e) || e.message === 'System is private; cannot branch') {
        bail(e);
        return;
      } else {
        throw e;
      }
    }
  });
}

/**
 * Gets the global stats data for number of systems created
 */
export async function getGlobalStatsData() {
  return await retry(async (bail) => {
    try {
      const globalStatsDoc = await getDoc(doc(firestore, `stats/global`));
      if (!globalStatsDoc.exists()) {
        throw new Error('Not Found');
      }
      return globalStatsDoc.data();
    } catch (e) {
      console.log('getGlobalStatsData error:', e);
      if (shouldErrorCauseFailure(e)) {
        bail(e);
        return;
      } else {
        throw e;
      }
    }
  });
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

  try {
    const imageRef = ref(storage, blobId);
    return await getDownloadURL(imageRef);
  } catch (e) {
    console.log('getUrlForBlob error:', e);
    return;
  }
}
