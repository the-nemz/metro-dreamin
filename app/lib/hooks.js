import { useEffect, useState, useContext } from 'react';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { setCookie, getCookie } from 'cookies-next';
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

  // useEffect(() => {
  //   console.log('setting cookie', settings.lightMode ? 'LIGHT' : 'DARK')
  //   setCookie('THEME', settings.lightMode ? 'LIGHT' : 'DARK');
  // }, [settings.lightMode]);

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
        setCookie('THEME', userSnap.data().lightMode ? 'LIGHT' : 'DARK');
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

// Custom hook to read  auth record and user profile doc
export function useTheme() {
  const firebaseContext = useContext(FirebaseContext);

  const [theme, setTheme] = useState('DARK');
  const [themeClass, setThemeClass] = useState('DarkMode');

  useEffect(() => {
    setTheme(getCookie('THEME') ? getCookie('THEME') : 'DARK');
    setTheme((getCookie('THEME') || '') === 'LIGHT' ? 'LightMode' : 'DarkMode');
  }, []);

  useEffect(() => {
    let newTheme = 'DARK';
    let newThemeClass = 'DarkMode';

    if ((getCookie('THEME') || '') === 'LIGHT' || firebaseContext.settings.lightMode) {
      newTheme = 'LIGHT';
      newThemeClass = 'LightMode';
    }

    setTheme(newTheme);
    setThemeClass(newThemeClass);
  }, [firebaseContext.settings.lightMode]);

  return { theme, themeClass };
}
