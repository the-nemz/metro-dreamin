import { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import ReactGA from 'react-ga4';

import { sortSystems, addAuthHeader } from '/util/helpers.js';
import { FirebaseContext } from '/util/firebase.js';
import { setThemeCookie } from '/util/cookies.js';

// Custom hook to read  auth record and user profile doc
export function useUserData({ theme = 'DarkMode', ip = '' }) {
  const firebaseContext = useContext(FirebaseContext);

  const [user, loading] = useAuthState(firebaseContext.auth);
  const [settings, setSettings] = useState({ lightMode: theme === 'LightMode' });
  const [ownSystemDocs, setOwnSystemDocs] = useState([]);
  const [starredSystemIds, setStarredSystemIds] = useState([]);
  const [userIdsBlocked, setUserIdsBlocked] = useState(new Set());
  const [blockedByUserIds, setBlockedByUserIds] = useState(new Set());
  const [authStateLoading, setAuthStateLoading] = useState(true);

  useEffect(() => {
    let unsubUser = () => {};
    let unsubOwn = () => {};
    let unsubStars = () => {};
    let unsubBlocks = () => {};
    let unsubBlockedBy = () => {};

    if (user && user.uid && firebaseContext.database) {
      const userDoc = doc(firebaseContext.database, `users/${user.uid}`);
      updateLastLogin(userDoc);
      unsubUser = listenToUserDoc(userDoc);

      unsubOwn = listenToOwnSystems(user.uid);
      unsubStars = listenToStarredSystems(user.uid);

      unsubBlocks = listenToUserIdsBlocked(user.uid);
      unsubBlockedBy = listenToBlockedByUserIds(user.uid);

      ReactGA.set({ 'user_id': user.uid });
    } else {
      setAuthStateLoading(loading);
    }

    return () => {
      unsubUser();
      unsubOwn();
      unsubStars();
      unsubBlocks();
      unsubBlockedBy();
    };
  }, [user, loading]);

  const generateNewUser = async (userDoc) => {
    if (!user || !user.uid || !userDoc || !firebaseContext.database) {
      console.log('generateNewUser: user and userDoc are required');
      return;
    };

    // double check that user doc does not exist
    const tempUserDoc = doc(firebaseContext.database, `users/${user.uid}`);
    const tempUserSnap = await getDoc(tempUserDoc);
    if (tempUserSnap.exists()) {
      console.warn('User doc already exists; do not overwrite.');
      ReactGA.event({
        category: 'Auth',
        action: 'Account Reinitialization Averted'
      });
      return;
    }

    console.log('Initializing user.');

    let email = '';
    let displayName = '';
    let phoneNumber = '';

    if (user.email) email = user.email;
    if (user.displayName) displayName = user.displayName;
    if (user.phoneNumber) phoneNumber = user.phoneNumber;

    // some providers have slightly different object structures, from what I recall
    for (const pData of (user.providerData || [])) {
      if (!email && pData.email) email = pData.email;
      if (!displayName && pData.displayName) displayName = pData.displayName;
      if (!phoneNumber && pData.phoneNumber) phoneNumber = pData.phoneNumber;
    }

    displayName = displayName.trim();
    if (displayName.length >= 2 && displayName[0] === '[' && displayName[displayName.length - 1] === ']') {
      displayName = `(${displayName.substring(1, displayName.length - 1)})`;
    }
    displayName = displayName ? displayName : 'Anon';

    await setDoc(userDoc, {
      userId: user.uid,
      displayName: displayName,
      systemsCreated: 0,
      creationDate: Date.now(),
      lastLogin: Date.now()
    });

    const privateDoc = doc(firebaseContext.database, `users/${user.uid}/private/info`);
    await setDoc(privateDoc, {
      email: email.toLowerCase(),
      phoneNumber: phoneNumber,
      userId: user.uid
    });

    ReactGA.event({
      category: 'Auth',
      action: 'Initialized Account'
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
          recordLoginEvent();

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

  const recordLoginEvent = async () => {
    const qParams = new URLSearchParams({ ip: ip || '' });
    const uri = `${firebaseContext.apiBaseUrl}/logins?${qParams}`;
    let req = new XMLHttpRequest();
    req.onerror = () => console.error('recordLoginEvent error:', req.status, req.statusText);
    req.open('POST', encodeURI(uri));
    req = await addAuthHeader(user, req);
    req.send();
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

  const listenToUserIdsBlocked = (userId) => {
    const blockedUsersQuery = query(collection(firebaseContext.database, `users/${userId}/blocks`));

    return onSnapshot(blockedUsersQuery, (blocksSnapshot) => {
      let uidsBlocked = new Set();
      for (const blockDoc of blocksSnapshot.docs || []) {
        uidsBlocked.add(blockDoc.data().blockedUserId);
      }
      setUserIdsBlocked(uidsBlocked);
    }, (error) => {
      console.log('Unexpected Error:', error);
    });
  }

  const listenToBlockedByUserIds = (userId) => {
    const blockedByUsersQuery = query(collectionGroup(firebaseContext.database, 'blocks'), where('blockedUserId', '==', userId));

    return onSnapshot(blockedByUsersQuery, (blocksSnapshot) => {
      let uidsBlocked = new Set();
      for (const blockDoc of blocksSnapshot.docs || []) {
        uidsBlocked.add(blockDoc.data().blockerId);
      }
      setBlockedByUserIds(uidsBlocked);
    }, (error) => {
      console.log('Unexpected Error:', error);
    });
  }

  /**
   * Checks whether the current user blocks the other user or if the other user block th current user.
   * @param {uid} otherUserId the other user's id
   * @returns {boolean} if either user is blocked
   */
  const checkBidirectionalBlocks = (otherUserId) => {
    if (!otherUserId) return false;

    if (userIdsBlocked && userIdsBlocked.has(otherUserId)) return true;
    if (blockedByUserIds && blockedByUserIds.has(otherUserId)) return true;

    return false;
  }

  return { authStateLoading, user, settings, ownSystemDocs, starredSystemIds, checkBidirectionalBlocks };
}


// Custom hook to listen for system changes
export function useSystemDocData({ systemId, initialSystemDocData, noUpdates = false }) {
  const firebaseContext = useContext(FirebaseContext);

  const [ systemDocData, setSystemDocData ] = useState(initialSystemDocData);

  useEffect(() => {
    let unsubSystem = () => {};
    if (systemId && !noUpdates) {
      unsubSystem = onSnapshot(doc(firebaseContext.database, `systems/${systemId}`), (docSnap) => {
        if (docSnap.exists()) {
          setSystemDocData(currData => ({
            numModes: currData?.numModes, // numModes is generated in SSR in some cases so don't clear it
            ...docSnap.data()
          }));
        }
      });
    }

    return () => {
      unsubSystem();
    };
  }, []);

  return systemDocData;
}


// Custom hook to listen for comments on a system
export function useCommentsForSystem({ systemId }) {
  const firebaseContext = useContext(FirebaseContext);

  const [ hasMoreComments, setHasMoreComments ] = useState(false);
  const [ newComments, setNewComments ] = useState();
  const [ existingComments, setExistingComments ] = useState();
  const [ lastCommentLoaded, setLastCommentLoaded ] = useState();

  const PAGE_SIZE = 10;

  useEffect(() => {
    if (!systemId) return;

    // this loads the PAGE_SIZE most recent comments, and then uses the most recent comment as a cursor to
    // listen for any comments added after the existing ones were loaded
    const fetchAndListen = async () => {
      const mostRecentComment = await fetchRecentComments();

      let newCommentsConditions = [ orderBy('timestamp', 'asc') ];
      if (mostRecentComment) {
        newCommentsConditions = [ orderBy('timestamp', 'asc'), startAfter(mostRecentComment), ];
      }

      const newCommentsQuery = query(collection(firebaseContext.database, `systems/${systemId}/comments`),
                                     ...newCommentsConditions);
      const unsubNewComments = listenToNewComments(newCommentsQuery);

      return unsubNewComments;
    }

    const unsubscribe = fetchAndListen();

    return () => {
      unsubscribe.then((unsub) => {
        if (typeof unsub === 'function') {
          unsub();
        } else {
          console.warn('unsubNewComments is not a function', unsub);
        }
      });
    };
  }, []);

  // here we query for one more comment than PAGE_SIZE as a way to see if there are more
  // comments to loads, but then only show the first PAGE_SIZE comments in the query
  const fetchRecentComments = async () => {
    const existingCommentsQuery = lastCommentLoaded ?
                                  // see more comments query
                                  query(collection(firebaseContext.database, `systems/${systemId}/comments`),
                                        orderBy('timestamp', 'desc'),
                                        startAfter(lastCommentLoaded),
                                        limit(PAGE_SIZE + 1)) :
                                  // initial comments query
                                  query(collection(firebaseContext.database, `systems/${systemId}/comments`),
                                        orderBy('timestamp', 'desc'),
                                        limit(PAGE_SIZE + 1));

    const existingCommentsSnap = await getDocs(existingCommentsQuery);

    if (existingCommentsSnap.docs.length === PAGE_SIZE + 1) {
      setLastCommentLoaded(existingCommentsSnap.docs[existingCommentsSnap.docs.length - 2]); // use 10th item, not 11th
      setHasMoreComments(true);
    } else {
      setLastCommentLoaded();
      setHasMoreComments(false);
    }

    const existingCommentDatas = existingCommentsSnap.docs
                                   .slice(0, PAGE_SIZE)
                                   .map(commentDoc => ({ ...commentDoc.data(), id: commentDoc.id }));
    setExistingComments(currComms => (currComms || []).concat(existingCommentDatas));

    return existingCommentsSnap.docs[0];
  }

  const listenToNewComments = (commentsQuery) => {
    return onSnapshot(
      commentsQuery,
      (commentsSnapshot) => {
        setNewComments(commentsSnapshot.docs
                         .reverse()
                         .map(commentDoc => ({ ...commentDoc.data(), id: commentDoc.id }))
        );
      },
      (error) => {
        console.log('Unexpected error loading new comments:', error);
      }
    );
  }

  return {
    comments: (newComments || []).concat(existingComments || []),
    commentsLoaded: existingComments != null, // evals to true once existingComments is an array (including [])
    hasMoreComments: hasMoreComments,
    loadMoreComments: fetchRecentComments
  };
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
