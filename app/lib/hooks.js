import { useEffect, useState, useContext } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, firestore } from '/lib/firebase.js';

// Custom hook to read  auth record and user profile doc
export function useUserData() {
  const [user, loading] = useAuthState(auth);
  const [settings, setSettings] = useState({});
  const [authStateLoading, setAuthStateLoading] = useState(true);

  useEffect(() => {
    console.log('loading', loading)
    if (user && user.uid) {
      const userDoc = doc(firestore, `users/${user.uid}`);
      getDoc(userDoc).then((uDoc) => {
        if (uDoc) {
          setSettings(settings => {
            return { ...settings, ...uDoc.data() };
          });
          setAuthStateLoading(loading);
          return;
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
