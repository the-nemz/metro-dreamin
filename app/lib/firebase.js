import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// TODO: add back when ready
const prodConfig = {
  // apiKey: "AIzaSyBIMlulR8OTOoF-57DHty1NuXM0kqVoL5c",
  // authDomain: "metrodreamin.firebaseapp.com",
  // databaseURL: "https://metrodreamin.firebaseio.com",
  // projectId: "metrodreamin",
  // storageBucket: "metrodreamin.appspot.com",
  // messagingSenderId: "86165148906"
};

const stagingConfig = {
  apiKey: "AIzaSyDYU-8dYy0OWGJ1RJ46V_S7fWJHlAA2DWg",
  authDomain: "metrodreaminstaging.firebaseapp.com",
  databaseURL: "https://metrodreaminstaging.firebaseio.com",
  projectId: "metrodreaminstaging",
  storageBucket: "metrodreaminstaging.appspot.com",
  messagingSenderId: "572980459956"
};

const app = initializeApp(stagingConfig);

export const auth = getAuth(app);
export const firestore = getFirestore(app);
// will probably need in the future
// export const storage = firebase.storage();








// import firebase from 'firebase/app';
// import 'firebase/auth';
// import 'firebase/firestore';
// import 'firebase/storage';

// const firebaseConfig = {
//   apiKey: 'AIzaSyBX5gkKsbOr1V0zxBuSqHWFct12dFOsQHA',
//   authDomain: 'nextfire-demo.firebaseapp.com',
//   projectId: 'nextfire-demo',
//   storageBucket: 'nextfire-demo.appspot.com',
//   messagingSenderId: '827402452263',
//   appId: '1:827402452263:web:c9a4bea701665ddf15fd02',
// };

// if (!firebase.apps.length) {
//   firebase.initializeApp(firebaseConfig);
// }

// // Auth exports
// export const auth = firebase.auth();
// export const googleAuthProvider = new firebase.auth.GoogleAuthProvider();

// // Firestore exports
// export const firestore = firebase.firestore();
// export const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
// export const fromMillis = firebase.firestore.Timestamp.fromMillis;
// export const increment = firebase.firestore.FieldValue.increment;

// // Storage exports
// export const storage = firebase.storage();
// export const STATE_CHANGED = firebase.storage.TaskEvent.STATE_CHANGED;

// /// Helper functions

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
    if (uDoc) {
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
 * Gets a users/{uid}/systems/{systemId} document
 * @param {string} uid
 * @param {string} systemId
 */
export async function getSystemDocData(uid, systemId) {
  if (!uid) {
    console.log('getSystemDocData: uid is a required parameter');
    return;
  }

  if (!systemId) {
    console.log('getSystemDocData: systemId is a required parameter');
    return;
  }

  const systemDoc = doc(firestore, `users/${uid}/systems/${systemId}`);
  return await getDoc(systemDoc).then((sDoc) => {
    if (sDoc) {
      return sDoc.data();
    } else {
      console.log('getSystemDocData: unable to get system doc');
      return;
    }
  }).catch((error) => {
    console.log('Unexpected Error:', error);
    return;
  });
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
    if (vDoc) {
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
