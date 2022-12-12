import { useEffect, useState, useContext } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

// Custom hook to read  auth record and user profile doc
export function useUserData() {
  const firebaseContext = useContext(FirebaseContext);

  const [user, loading] = useAuthState(firebaseContext.auth);
  const [settings, setSettings] = useState({});
  const [authStateLoading, setAuthStateLoading] = useState(true);

  const generateNewUser = (userDoc) => {
    if (!user || !user.uid || !userDoc) {
      console.log('generateNewUser: user and userDoc are required');
      return;
    };

    console.log('Initializing user.')

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

  useEffect(() => {
    let unsubscribe;
    if (user && user.uid) {
      const userDoc = doc(firebaseContext.database, `users/${user.uid}`);

      unsubscribe = onSnapshot(userDoc, (userSnap) => {
        if (userSnap.exists() && (userSnap.data() || {}).userId) {
          setSettings(settings => {
            return { ...settings, ...userSnap.data() };
          });
          setAuthStateLoading(loading);
        }
        setAuthStateLoading(loading);
      }, (error) => {
        console.log('Unexpected Error:', error);
        setAuthStateLoading(loading);
      });

      getDoc(userDoc).then((userSnap) => {
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
          generateNewUser(userDoc)
        }
        setAuthStateLoading(loading);
      }).catch((error) => {
        console.log('Unexpected Error:', error);
        setAuthStateLoading(loading);
      });

      ReactGA.set({ dimension2: user.uid });
    }

    setAuthStateLoading(loading);
    return unsubscribe;
  }, [user, loading]);

  return { user, settings, authStateLoading };
}
