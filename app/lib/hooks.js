import { useEffect, useState, useContext } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

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
    });
  }

  useEffect(() => {
    if (user && user.uid) {
      const userDoc = doc(firebaseContext.database, `users/${user.uid}`);
      getDoc(userDoc).then((userSnap) => {
        if (userSnap.exists()) {
          setSettings(settings => {
            return { ...settings, ...userSnap.data() };
          });
          setAuthStateLoading(loading);

          updateDoc(userDoc, {
            lastLogin: Date.now()
          }).catch((error) => {
            console.log('Unexpected Error:', error);
          });

          return;
        } else {
          // user doc does not exist; create it
          generateNewUser(userDoc)
        }
        setAuthStateLoading(loading);
      }).catch((error) => {
        console.log('Unexpected Error:', error);
        setAuthStateLoading(loading);
      });
    }

    setAuthStateLoading(loading);
  }, [user, loading]);

  return { user, settings, authStateLoading };
}
