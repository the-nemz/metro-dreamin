import { useEffect, useState, useContext } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

// Custom hook to read  auth record and user profile doc
export function useUserData() {
  const firebaseContext = useContext(FirebaseContext);

  const [user, loading] = useAuthState(firebaseContext.auth);
  const [settings, setSettings] = useState({ lightMode: false });
  const [authStateLoading, setAuthStateLoading] = useState(true);

  useEffect(() => {
    let unsubscribe;
    if (user && user.uid) {
      const userDoc = doc(firebaseContext.database, `users/${user.uid}`);
      unsubscribe = listenToUserDoc(userDoc);
      updateLastLogin(userDoc);
      ReactGA.set({ dimension2: user.uid });
    } else {
      setAuthStateLoading(loading);
    }

    return unsubscribe;
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

  return { user, settings, authStateLoading };
}
