import { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, collectionGroup, query, where, orderBy, doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import ReactGA from 'react-ga';

import { sortSystems } from '/lib/util.js';
import { FirebaseContext } from '/lib/firebase.js';
import { setThemeCookie } from '/lib/cookies.js';

// Custom hook to read  auth record and user profile doc
export function useUserData({ theme = 'DarkMode' }) {
  const firebaseContext = useContext(FirebaseContext);

  const [user, loading] = useAuthState(firebaseContext.auth);
  const [settings, setSettings] = useState({ lightMode: theme === 'LightMode' });
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

        setThemeCookie(location.hostname, userSnap.data().lightMode ? 'LightMode' : 'DarkMode');
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
      setOwnSystemDocs(sysDocs.sort(sortSystems));
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
      const commentsQuery = query(collection(firebaseContext.database, `systems/${systemId}/comments`), orderBy('timestamp', 'desc'));
      unsubComments = listenToComments(commentsQuery);
    }

    return () => {
      unsubComments();
    };
  }, []);

  const listenToComments = (commentsQuery) => {
    return onSnapshot(commentsQuery, (commentsSnapshot) => {
      setComments(commentsSnapshot.docs.map(commentDoc => {
        return { ...commentDoc.data(), id: commentDoc.id };
      }));
      setCommentsLoaded(true);
    }, (error) => {
      console.log('Unexpected Error:', error);
      setCommentsLoaded(false);
    });
  }

  return { comments, commentsLoaded };
}


// allows catching navigation while user has unsaved changes to the map
// adapted from comment by @cuginoAle in https://github.com/vercel/next.js/discussions/32231
export function useNavigationObserver({ shouldStopNavigation, onNavigate }) {
  const router = useRouter();
  const currentPath = router.asPath;
  const nextPath = useRef('');

  const killRouterEvent = useCallback(() => {
    router.events.emit({ type: 'routeChangeComplete' });

    // Throwing an actual error class trips the Next.JS 500 Page, this string literal does not.
    throw 'Abort route change due to unsaved changes to map. Triggered by useNavigationObserver. Please ignore this error.';
  }, [router])

  useEffect(() => {
    const onRouteChange = (url) => {
      if (shouldStopNavigation && url !== currentPath) {
        nextPath.current = url;
        onNavigate(url);
        killRouterEvent();
      }
    }

    router.events.on('routeChangeStart', onRouteChange);

    return () => {
      router.events.off('routeChangeStart', onRouteChange);
    }
  },
  [
    currentPath,
    killRouterEvent,
    onNavigate,
    router.events,
    shouldStopNavigation,
  ]);

  const navigate = () => {
    router.push(nextPath.current);
  }

  return navigate;
}
