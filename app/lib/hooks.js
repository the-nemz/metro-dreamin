import { useEffect, useState, useContext } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, collectionGroup, query, where, orderBy, doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

// Custom hook to read  auth record and user profile doc
export function useUserData() {
  const firebaseContext = useContext(FirebaseContext);

  const [user, loading] = useAuthState(firebaseContext.auth);
  const [settings, setSettings] = useState({ lightMode: false });
  const [ownSystemDocs, setOwnSystemDocs] = useState([]);
  const [starredSystemIds, setStarredSystemIds] = useState([]);
  const [authStateLoading, setAuthStateLoading] = useState(true);

  useEffect(() => {
    let unsubUser = () => {};
    let unsubOwn = () => {};
    let unsubStars = () => {};

    if (user && user.uid) {
      const userDoc = doc(firebaseContext.database, `users/${user.uid}`);
      updateLastLogin(userDoc);
      unsubUser = listenToUserDoc(userDoc);

      unsubOwn = listenToOwnSystems(user.uid);
      unsubStars = listenToStarredSystems(user.uid);

      ReactGA.set({ dimension2: user.uid });
    } else {
      setAuthStateLoading(loading);
    }

    return () => {
      unsubUser();
      unsubOwn();
      unsubStars();
    };
  }, [user, loading]);

  const generateNewUser = (userDoc) => {
    if (!user || !user.uid || !userDoc) {
      console.log('generateNewUser: user and userDoc are required');
      return;
    };

    console.log('Initializing user.');

    let email = '';
    let displayName = '';

    if (user.email) email = user.email;
    if (user.displayName) displayName = user.displayName;

    for (const pDAta of (user.providerData || [])) {
      if (!email && pDAta.email) email = pDAta.email;
      if (!displayName && pDAta.displayName) displayName = pDAta.displayName;
    }

    setDoc(userDoc, {
      userId: user.uid,
      email: email,
      displayName: displayName ? displayName : 'Anon',
      systemsCreated: 0,
      creationDate: Date.now(),
      lastLogin: Date.now()
    }).then(() => {
      ReactGA.event({
        category: 'User',
        action: 'Initialized Account'
      });
    });
  }

  const listenToUserDoc = (userDoc) => {
    return onSnapshot(userDoc, (userSnap) => {
      if (userSnap.exists() && (userSnap.data() || {}).userId) {
        setSettings(settings => {
          return { ...settings, ...userSnap.data() };
        });
      }
      setAuthStateLoading(loading);
    }, (error) => {
      console.log('Unexpected Error:', error);
      setAuthStateLoading(loading);
    });
  }

  const updateLastLogin = async (userDoc) => {
    return getDoc(userDoc).then((userSnap) => {
      if (userSnap.exists() && (userSnap.data() || {}).userId) {
        updateDoc(userDoc, {
          lastLogin: Date.now()
        }).then(() => {
          ReactGA.event({
            category: 'User',
            action: 'Signed In'
          });
        }).catch((error) => {
          console.log('Unexpected Error:', error);
        });
      } else {
        // user doc does not exist; create it
        generateNewUser(userDoc);
      }
      setAuthStateLoading(loading);
    }).catch((error) => {
      console.log('Unexpected Error:', error);
      setAuthStateLoading(loading);
    });
  }

  const listenToOwnSystems = (userId) => {
    const ownSystemsQuery = query(collection(firebaseContext.database, 'systems'), where('userId', '==', userId));

    return onSnapshot(ownSystemsQuery, (ownSystemsSnapshot) => {
      let sysDocs = [];
      for (const sysDoc of ownSystemsSnapshot.docs || []) {
        sysDocs.push(sysDoc.data());
      }
      setOwnSystemDocs(sysDocs);
    }, (error) => {
      console.log('Unexpected Error:', error);
    });
  }

  const listenToStarredSystems = (userId) => {
    const starsQuery = query(collectionGroup(firebaseContext.database, 'stars'), where('userId', '==', userId));

    return onSnapshot(starsQuery, (starsSnapshot) => {
      let sysIds = [];
      for (const starDoc of starsSnapshot.docs || []) {
        sysIds.push(starDoc.data().systemId);
      }
      setStarredSystemIds(sysIds);
    }, (error) => {
      console.log('Unexpected Error:', error);
    });
  }

  return { user, settings, ownSystemDocs, starredSystemIds, authStateLoading };
}

// Custom hook to read  auth record and user profile doc
export function useCommentsForSystem({ systemId }) {
  const firebaseContext = useContext(FirebaseContext);

  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  useEffect(() => {
    let unsubComments = () => {};
    if (systemId) {
      const commentsQuery = query(collection(firebaseContext.database, `systems/${systemId}/comments`), orderBy('timestamp'));
      unsubComments = listenToComments(commentsQuery);
    }

    return () => {
      unsubComments();
    };
  }, []);

  const listenToComments = (commentsQuery) => {
    return onSnapshot(commentsQuery, (commentsSnapshot) => {
      setComments(commentsSnapshot.docs.map(commentDoc => commentDoc.data()));
      setCommentsLoaded(true);
    }, (error) => {
      console.log('Unexpected Error:', error);
      setCommentsLoaded(false);
    });
  }

  return { comments, commentsLoaded };
}
