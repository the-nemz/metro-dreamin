import { useEffect, useState, useContext } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, firestore } from '/lib/firebase.js';
import { FirebaseContext } from '/lib/firebaseContext.js';

// Custom hook to read  auth record and user profile doc
export function useUserData() {
  const [user] = useAuthState(auth);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (user && user.uid) {
      const userDoc = doc(firestore, `users/${user.uid}`);
      getDoc(userDoc).then((uDoc) => {
        if (uDoc) {
          setSettings(settings => {
            return { ...settings, ...uDoc.data() };
          });
          return;
        }
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });
    }
  }, [user]);

  return { user, settings };
}
