import { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, collectionGroup, query, where, orderBy, doc, getDoc, updateDoc, setDoc, onSnapshot, limit } from 'firebase/firestore';
import ReactGA from 'react-ga4';

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

      ReactGA.set({ 'user_id': user.uid });
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
        category: 'Auth',
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
            category: 'Auth',
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


// Custom hook to listen for comments on a system
export function useCommentsForSystem({ systemId }) {
  const firebaseContext = useContext(FirebaseContext);

  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  const INITIAL_PAGE_SIZE = 10;

  useEffect(() => {
    if (!systemId) return;

    let unsubAllComments = () => {};
    let unsubLatestComments = () => {};

    if (showAllComments) {
      const commentsQuery = query(collection(firebaseContext.database, `systems/${systemId}/comments`),
                                  orderBy('timestamp', 'desc'));

      unsubLatestComments();
      unsubAllComments = listenToComments(commentsQuery, Number.MAX_SAFE_INTEGER - 1);
    } else {
      const commentsQuery = query(collection(firebaseContext.database, `systems/${systemId}/comments`),
                                  orderBy('timestamp', 'desc'),
                                  limit(INITIAL_PAGE_SIZE + 1));

      unsubAllComments();
      unsubLatestComments = listenToComments(commentsQuery, INITIAL_PAGE_SIZE);
    }

    return () => {
      unsubAllComments();
      unsubLatestComments();
    };
  }, [showAllComments]);

  const listenToComments = (commentsQuery, countLimit) => {
    return onSnapshot(commentsQuery, (commentsSnapshot) => {
      const removedComment = commentsSnapshot.docChanges().find(dChange => (dChange.type || '') === 'removed');
      if (commentsSnapshot.size < countLimit + 1 && !removedComment) {
        // always show all comments when there are fewer than 11 comments
        // and none got removed in the latest updates
        setShowAllComments(true);
      }

      setComments(commentsSnapshot.docs
                  .slice(0, countLimit)
                  .map(commentDoc => {
        return { ...commentDoc.data(), id: commentDoc.id };
      }));
      setCommentsLoaded(true);
    }, (error) => {
      console.log('Unexpected Error:', error);
      setCommentsLoaded(false);
    });
  }

  return { comments, commentsLoaded, showAllComments, setShowAllComments };
}


// Custom hook to listen for stars on a system
export function useStarsForSystem({ systemId }) {
  const firebaseContext = useContext(FirebaseContext);

  const [stars, setStars] = useState([]);
  const [starsLoaded, setStarsLoaded] = useState(false);

  useEffect(() => {
    let unsubStars = () => {};
    if (systemId) {
      const starsQuery = query(collection(firebaseContext.database, `systems/${systemId}/stars`), orderBy('timestamp', 'desc'));
      unsubStars = listenToStars(starsQuery);
    }

    return () => {
      unsubStars();
    };
  }, []);

  const listenToStars = (starsQuery) => {
    return onSnapshot(starsQuery, (starsSnapshot) => {
      setStars(starsSnapshot.docs.map(starDoc => {
        return { ...starDoc.data(), id: starDoc.id };
      }));
      setStarsLoaded(true);
    }, (error) => {
      console.log('Unexpected Error:', error);
      setStarsLoaded(false);
    });
  }

  return { stars, starsLoaded };
}


// Custom hook to listen for branches to a system
export function useDescendantsOfSystem({ systemId }) {
  const firebaseContext = useContext(FirebaseContext);

  const [directDescendants, setDirectDescendants] = useState([]);
  const [indirectDescendants, setIndirectDescendants] = useState([]);
  const [descendantsLoaded, setDescendantsLoaded] = useState(false);

  useEffect(() => {
    let unsubDesc = () => {};
    if (systemId) {
      const descQuery = query(collection(firebaseContext.database, 'systems'),
                                         where('ancestors', 'array-contains', systemId),
                                         where('isPrivate', '==', false));
      unsubDesc = listenToDescendants(descQuery);
    }

    return () => {
      unsubDesc();
    };
  }, []);

  const listenToDescendants = (descQuery) => {
    return onSnapshot(descQuery, (descSnapshot) => {
      const allDescendants = descSnapshot.docs.map(descDoc => {
        return descDoc.data();
      });

      let newDirect = [];
      let newIndirect = [];
      for (const desc of allDescendants) {
        const ancestors = desc.ancestors || [];
        if (ancestors.indexOf(systemId) === ancestors.length - 1) {
          newDirect.push(desc);
        } else {
          newIndirect.push(desc);
        }
      }

      setDirectDescendants(newDirect);
      setIndirectDescendants(newIndirect);
      setDescendantsLoaded(true);
    }, (error) => {
      console.log('Unexpected Error:', error);
      setDescendantsLoaded(false);
    });
  }

  return { directDescendants, indirectDescendants, descendantsLoaded };
}


// allows catching navigation while user has unsaved changes to the map
// adapted from comment by @cuginoAle in https://github.com/vercel/next.js/discussions/32231
export function useNavigationObserver({ shouldStopNavigation, onNavigate }) {
  const router = useRouter();
  const currentPath = router.asPath;
  const nextPath = useRef('');

  const killRouterEvent = useCallback(() => {
    router.events.emit({ type: 'routeChangeComplete' });

    ReactGA.event({
      category: 'Edit',
      action: 'Catch Unsaved Navigation'
    });

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


// detects state and direction of scrolling
// adapted from react-use-scroll-direction
export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState(null);

  const isScrolling = scrollDirection !== null;
  const isScrollingX = scrollDirection === 'LEFT' || scrollDirection === 'RIGHT';
  const isScrollingY = scrollDirection === 'UP' || scrollDirection === 'DOWN';
  const isScrollingUp = scrollDirection === 'UP';
  const isScrollingDown = scrollDirection === 'DOWN';
  const isScrollingLeft = scrollDirection === 'LEFT';
  const isScrollingRight = scrollDirection === 'RIGHT';

  useEffect(() => {
    if (process.browser && typeof window === 'object') {
      let scrollTimeout;
      let lastScrollTop = getScrollTop();
      let lastScrollLeft = getScrollLeft();

      const handleScroll = () => {
        // Reset scroll direction when scrolling stops
        window.clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
          setScrollDirection(null);
        }, 66);

        // Set vertical direction while scrolling
        const scrollTop = getScrollTop();
        if (scrollTop > lastScrollTop) {
          setScrollDirection('DOWN');
        } else if (scrollTop < lastScrollTop) {
          setScrollDirection('UP');
        }
        lastScrollTop = scrollTop;

        // Set horizontal scroll direction
        const scrollLeft = getScrollLeft();
        if (scrollLeft > lastScrollLeft) {
          setScrollDirection('RIGHT');
        } else if (scrollLeft < lastScrollLeft) {
          setScrollDirection('LEFT');
        }
        lastScrollLeft = scrollLeft;
      }

      document.addEventListener('scroll', handleScroll);
      return () => document.removeEventListener('scroll', handleScroll);
    }
  }, [process.browser]);

  const getScrollTop = () => {
    return (
      window.scrollY ||
      window.pageYOffset ||
      document.body.scrollTop ||
      (document.documentElement && document.documentElement.scrollTop) ||
      0
    );
  }

  const getScrollLeft = () => {
    return (
      window.scrollX ||
      window.pageXOffset ||
      document.body.scrollLeft ||
      (document.documentElement && document.documentElement.scrollLeft) ||
      0
    );
  }

  return {
    scrollDirection, isScrolling,
    isScrollingX, isScrollingY,
    isScrollingUp, isScrollingDown,
    isScrollingLeft, isScrollingRight,
  }
}
