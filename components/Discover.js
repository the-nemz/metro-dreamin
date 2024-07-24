import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import {
  collection, collectionGroup, query,
  where, orderBy, limit, startAt, endAt,
  getDocs, getDoc
} from 'firebase/firestore';
import { geohashQueryBounds } from 'geofire-common';
import ReactGA from 'react-ga4';
import classNames from 'classnames';

import { MILES_TO_METERS_MULTIPLIER, MS_IN_SIX_HOURS } from '/util/constants.js';
import { FirebaseContext } from '/util/firebase.js';
import {
  findFibonacciIndex,
  generateAlphanumerics,
  getCacheInvalidationTime,
  getDistance
} from '/util/helpers.js';

import { KoFiPromo } from '/components/KoFiPromo.js';
import { Result } from '/components/Result.js';
import { Revenue } from '/components/Revenue.js';
import { PaginatedSystems } from '/components/PaginatedSystems.js';

const MAIN_FEATURE_LIMIT = 5;
const RECENTSTAR_FEATURE_LIMIT = 10;
const RECENT_FEATURE_PAGE_LIMIT = 3;
const NEARBY_RADIUS = 20; // in miles

export const Discover = (props) => {
  const [ featureIds, setFeatureIds ] = useState([]);
  const [ gotRecStarred, setGotRecStarred ] = useState(false);
  const [ gotNearby, setGotNearby ] = useState(false);
  const [ noneNearby, setNoneNearby ] = useState(false);
  const [ mainFeature, setMainFeature ] = useState({});
  const [ starFeature0, setStarFeature0 ] = useState({});
  const [ starFeature1, setStarFeature1 ] = useState({});
  const [ starFeature2, setStarFeature2 ] = useState({});
  const [ nearbyFeature0, setNearbyFeature0 ] = useState({});
  const [ nearbyFeature1, setNearbyFeature1 ] = useState({});
  const [ nearbyFeature2, setNearbyFeature2 ] = useState({});

  const firebaseContext = useContext(FirebaseContext);
  const systemsCollection = collection(firebaseContext.database, 'systems');

  const starFeatures = [
    {state: starFeature0, setter: setStarFeature0},
    {state: starFeature1, setter: setStarFeature1},
    {state: starFeature2, setter: setStarFeature2}
  ];

  const nearbyFeatures = [
    {state: nearbyFeature0, setter: setNearbyFeature0},
    {state: nearbyFeature1, setter: setNearbyFeature1},
    {state: nearbyFeature2, setter: setNearbyFeature2}
  ];

  useEffect(() => {
    fetchMainFeature();
    fetchRecentlyStarred();
    // TODO: recently commented?
    // TODO: most stations?
  }, []);

  useEffect(() => {
    if (props.ipInfo && props.ipInfo.lat != null && props.ipInfo.lon != null) {
      const ipLoc = { lat: props.ipInfo.lat, lng: props.ipInfo.lon };

      const systemsFromStorage = fetchNearbyFromLocalStorage(ipLoc);
      if (systemsFromStorage && systemsFromStorage.length >= RECENTSTAR_FEATURE_LIMIT) {
        handleNearbyFeatures(systemsFromStorage);
      } else {
        fetchNearbyFeatures(ipLoc).then(systemsFromServer => {
          handleNearbyFeatures(systemsFromServer);
          saveNearbyToLocalStorage(systemsFromServer, ipLoc);
        });
      }
    }
  }, [ props.ipInfo ]);

  const fetchMainFeature = async () => {
    try {
      let thresholdCondition;
      let weightFunction;
      if (Math.random() < parseFloat(process.env.NEXT_PUBLIC_FEATURE_STARS_SCORE_RATIO || '1.0')) {
        // find a pseudo-random map with sufficent stars, gently biasing towards higher star counts
        const minStars = parseInt(process.env.NEXT_PUBLIC_FEATURE_MIN_STARS || '20');
        thresholdCondition = where('stars', '>=', minStars);
        // find fibonacci index of the number of stars above threshold
        weightFunction = (sysDocData) => findFibonacciIndex((sysDocData.stars || 0) - minStars);
      } else {
        // find a pseudo-random map with a sufficiently high score, gently biasing towards higher scores
        const minScore = parseInt(process.env.NEXT_PUBLIC_FEATURE_MIN_SCORE || '2000');
        thresholdCondition = where('score', '>=', minScore);
        // find the floor of the square root of the score
        weightFunction = (sysDocData) => Math.floor(Math.sqrt(sysDocData.score || 1));
      }

      const system = await fetchMainFeatureRandomizer(thresholdCondition, weightFunction);
      setMainFeature(system);
    } catch (e) {
      console.warn('fetchMainFeature error:', e);
    }
  }

  // find a pseudo-random map that satisfies threshold condition
  const fetchMainFeatureRandomizer = async (thresholdCondition, weightFunction) => {
    if (!thresholdCondition) throw 'thresholdCondition is a required parameter';
    if (!weightFunction) throw 'thresholdCondition is a required parameter';

    const userIdSeed = getUserIdSeed();

    // get first five systems before and after userIdSeed that satisfy threshold condition
    const manyStarsQueries = [
      getDocs(query(systemsCollection,
                    where('isPrivate', '==', false),
                    thresholdCondition,
                    where('userId', '>', userIdSeed),
                    orderBy('userId', 'asc'),
                    limit(MAIN_FEATURE_LIMIT))),
      getDocs(query(systemsCollection,
                    where('isPrivate', '==', false),
                    thresholdCondition,
                    where('userId', '<', userIdSeed),
                    orderBy('userId', 'desc'),
                    limit(MAIN_FEATURE_LIMIT))),
    ];
    const manyStarsSnapshots = await Promise.all(manyStarsQueries);

    const systems = {};
    let totalWeight = 0;
    for (const manyStarsSnapshot of manyStarsSnapshots) {
      for (const sysDoc of manyStarsSnapshot.docs) {
        const sysDocData = sysDoc.data();
        // find system's weight and add to system doc
        const weight = weightFunction(sysDocData);
        systems[sysDocData.systemId] = { ...sysDocData, weight };
        totalWeight += weight;
      }
    }

    // get a random system from the results, biasing toward higher weight
    const sortedSystems = Object.values(systems).sort((a, b) => (b.weight || 0) - (a.weight || 0));
    const randomWeightValue = Math.floor(Math.random() * totalWeight);
    let currSum = 0;
    for (const system of sortedSystems) {
      currSum += system.weight;
      if (randomWeightValue < currSum) return system;
    }

    // shouldn't happen, but just in case
    return sortedSystems[0];
  }

  const getUserIdSeed = () => {
    const alphaNumerics = generateAlphanumerics();
    const seedChar1 = alphaNumerics[Math.floor(Math.random() * alphaNumerics.length)];
    const seedChar2 = alphaNumerics[Math.floor(Math.random() * alphaNumerics.length)];
    return `${seedChar1}${seedChar2}`;
  }

  // get systemDocDatas and filter out private systems
  const getStarSysMap = async (querySnapshot) => {
    const starSysMap = {};
    for (const starDoc of querySnapshot.docs || []) {
      if (!(starDoc.id in starSysMap)) {
        const sysDoc = await getDoc(starDoc.ref.parent.parent);
        if (sysDoc.exists()) {
          const sysData = sysDoc.data();
          if (!sysData.isPrivate) {
            starSysMap[`${sysData.systemId}|${starDoc.id}`] = {
              starData: starDoc.data(),
              sysData: sysData
            };
          }
        }

      }
    }

    return starSysMap;
  }

  // rank based on if owner is the starrer and timestamp
  const starSysItemSort = (a, b) => {
    if (a.starData.userId === a.sysData.userId && b.starData.userId !== b.sysData.userId) { // b starred own map
      return 1;
    } else if (a.starData.userId !== a.sysData.userId && b.starData.userId === b.sysData.userId) { // a starred own map
      return -1;
    } else { // sort by timestamp
      b.starData.timestamp - a.starData.timestamp;
    }
  }

  // load and display paginated recently updated maps
  const fetchRecentlyStarred = async () => {
    const recStarsQuery = query(collectionGroup(firebaseContext.database, 'stars'),
                                orderBy('timestamp', 'desc'),
                                limit(RECENTSTAR_FEATURE_LIMIT));
    return await getDocs(recStarsQuery)
      .then(async (querySnapshot) => {
        // get systemDocDatas and filter out private systems
        const starSysMap = await getStarSysMap(querySnapshot);
        const sortedSysDatas = Object.values(starSysMap).sort(starSysItemSort).map(sI => sI.sysData);

        // select top three unique systems
        let sysIdSet = new Set();
        let systemDatasToUse = [];
        let currInd = 0;
        while (systemDatasToUse.length < 3 && currInd < sortedSysDatas.length) {
          if (!sysIdSet.has(sortedSysDatas[currInd].systemId)) {
            systemDatasToUse.push(sortedSysDatas[currInd]);
            sysIdSet.add(sortedSysDatas[currInd].systemId);
          }
          currInd++;
        }

        setFeatureIds(featureIds => featureIds.concat(Array.from(sysIdSet)));
        for (const [i, systemDocData] of systemDatasToUse.entries()) {
          const { state, setter } = starFeatures[i];
          setter(systemDocData);
        }
        setGotRecStarred(true);
      })
      .catch((error) => {
        console.log("fetchRecentlyStarred error:", error);
      });
  }

  const fetchNearbyFeatures = async (ipLoc) => {
    const querySnapshots = await queryNearbyFeatures(ipLoc);

    const nearbyDocDatas = [];
    for (const querySnapshot of querySnapshots) {
      for (const nearbyDoc of querySnapshot.docs) {
        const nearbyDocData = nearbyDoc.data();
        // filter out false positives (corners of geohash)
        const exactDistance = getDistance(nearbyDocData.centroid, ipLoc);
        if (exactDistance <= NEARBY_RADIUS) {
          nearbyDocDatas.push(nearbyDocData);
        }
      }
    }

    // sort by stars and then distance
    const systemsData = nearbyDocDatas.slice().sort((a, b) => {
      const aStars = a.stars || 0;
      const bStars = b.stars || 0;
      if (aStars !== bStars) return bStars - aStars;
      return getDistance(b.centroid, ipLoc) - getDistance(a.centroid, ipLoc);
    });

    return systemsData;
  }

  const handleNearbyFeatures = (systemsData = []) => {
    let systemIdsDisplayed = [];
    for (let i = 0; i < Math.min(systemsData.length, nearbyFeatures.length); i++) {
      const { state, setter } = nearbyFeatures[i];
      setter(systemsData[i]);
      systemIdsDisplayed.push(systemsData[i]);
    }
    setFeatureIds(featureIds => featureIds.concat(systemIdsDisplayed));
    setGotNearby(true);
    setNoneNearby(systemIdsDisplayed.length === 0);
  }

  const queryNearbyFeatures = async (ipLoc) => {
    const radiusInMeters = NEARBY_RADIUS * MILES_TO_METERS_MULTIPLIER;
    const bounds = geohashQueryBounds([ ipLoc.lat, ipLoc.lng ], radiusInMeters);

    const serverPromises = [];
    for (const bound of bounds) {
      // TODO: optimize with new multifield range/inequality filter support?
      const geoQuery = query(systemsCollection,
                             where('isPrivate', '==', false),
                             orderBy('geohash'),
                             startAt(bound[0]),
                             endAt(bound[1]));
      serverPromises.push(getDocs(geoQuery));
    }

    return Promise.all(serverPromises);
  }

  const fetchNearbyFromLocalStorage = (ipLoc) => {
    try {
      const localStorageString = localStorage.getItem('mdNearby');
      if (localStorageString) {
        const lsEntries = JSON.parse(localStorageString);
        const cacheInvalidationTime = getCacheInvalidationTime();

        for (const lsEntry of lsEntries) {
          let lsEntryCoord = lsEntry.coordinate;
          if (!lsEntryCoord || !lsEntryCoord.lat || !lsEntryCoord.lng) continue;

          const sortedSystemSnippets = lsEntry.sortedSystemSnippets || [];
          const isNearby = getDistance(lsEntryCoord, ipLoc) < NEARBY_RADIUS / 2;
          const isRecent = (lsEntry.timestamp || 0) > cacheInvalidationTime;
          if (isNearby && isRecent && sortedSystemSnippets.length) {
            return sortedSystemSnippets;
          }
        }
      }
    } catch (e) {
      console.warn('fetchNearbyFromLocalStorage error:', e);
    }

    return [];
  }

  const saveNearbyToLocalStorage = (sortedSystems, ipLoc) => {
    if (sortedSystems.length < RECENTSTAR_FEATURE_LIMIT) return;

    try {
      const sortedSystemSnippets = sortedSystems.map(s => ({
        systemId: s.systemId,
        userId: s.userId
      }));

      const cachedData = {
        sortedSystemSnippets,
        timestamp: Date.now(),
        coordinate: {
          lat: ipLoc.lat,
          lng: ipLoc.lng
        }
      }

      const cacheInvalidationTime = getCacheInvalidationTime();
      const lsJson = localStorage.getItem('mdNearby') || '[]';
      let savedQueries = JSON.parse(lsJson).filter((lsEntry) => (lsEntry.timestamp || 0) > cacheInvalidationTime);
      savedQueries.push(cachedData);
      localStorage.setItem('mdNearby', JSON.stringify(savedQueries));
    } catch (e) {
      console.warn('saveNearbyToLocalStorage error:', e);
    }
  }

  const renderMainFeature = () => {
    if (mainFeature && mainFeature.systemId) {
      return (
        <div className="Discover-feature Discover-feature--main">
          <Result viewData={mainFeature} types={['feature']} key={mainFeature.systemId} />
        </div>
      );
    } else {
      return (
        <div className="Discover-feature Discover-feature--mainPlaceholder">
          <div className="Discover-mainPlaceholder"></div>
        </div>
      );
    }
  }

  const renderNoUserContent = () => {
    if (!firebaseContext.user || !firebaseContext.user.uid) {
      return (
        <div className="Discover-noUserContent">
          <div className="Discover-noUserDescription">
            MetroDreamin' allows you to design and visualize the transportation system that you wish your city had.
            <br />
            <br />
            Use the search bar above to explore the maps other transit enthusiasts have made, or jump right in and start your own. Happy mapping!
          </div>
          <div className="Discover-noUserLinks">
            <Link className="Discover-start Button--primary" href="/edit/new"
                  onClick={() => ReactGA.event({ category: 'Discover', action: 'Get Started' })}>
              Get Started!
            </Link>

            <button className="Discover-mission Button--inverse"
                    onClick={() => {
                      props.onToggleShowMission(currShown => !currShown);
                      ReactGA.event({
                        category: 'Discover',
                        action: 'Toggle Mission'
                      });
                    }}>
              Our Mission
            </button>
          </div>
        </div>
      );
    }
  }

  const renderFeature = (feature, type, key) => {
    if (feature && feature.systemId) {
      return (
        <div className="Discover-col Discover-col--feature" key={key}>
          <div className={`Discover-feature Discover-feature--${type}`}>
            <Result viewData={feature} key={feature.systemId} types={[type]} />
          </div>
        </div>
      );
    } else {
      return (
        <div className="Discover-col Discover-col--featurePlaceholder" key={key}>
          <div className="Discover-feature Discover-feature--placeholder">
            <div className="Discover-resultPlaceholder"></div>
          </div>
        </div>
      );
    }
  }

  const renderStarFeatures = () => {
    let starContent0 = renderFeature(starFeature0, 'star', 'star0');
    let starContent1 = renderFeature(starFeature1, 'star', 'star1');
    let starContent2 = renderFeature(starFeature2, 'star', 'star2');
    const starClasses = classNames('Discover-moreFeatures Discover-moreFeatures--star',
                                   { 'Discover-moreFeatures--starLoaded': gotRecStarred });
    return (
      <div className={starClasses}>
        <div className="Discover-moreFeaturesHeadingRow Discover-moreFeaturesHeadingRow--star">
          <i className="fas fa-star" />
          <h2 className="Discover-moreFeaturesHeading">
            Recently Starred
          </h2>
        </div>
        <div className="Discover-featureList">
          {starContent0}
          {starContent1}
          {starContent2}
        </div>
      </div>
    );
  }

  const renderNearbyFeatures = () => {
    let nearbyContent0 = renderFeature(nearbyFeature0, 'nearby', 'nearby0');
    let nearbyContent1 = renderFeature(nearbyFeature1, 'nearby', 'nearby1');
    let nearbyContent2 = renderFeature(nearbyFeature2, 'nearby', 'nearby2');

    const nearbyClasses = classNames('Discover-moreFeatures Discover-moreFeatures--nearby',
                                     { 'Discover-moreFeatures--nearbyLoaded': gotNearby });
    return (
      <div className={nearbyClasses}>
        <div className="Discover-moreFeaturesHeadingRow Discover-moreFeaturesHeadingRow--nearby">
          <i className="fas fa-location-dot" />
          <h2 className="Discover-moreFeaturesHeading">
            Nearby{props.ipInfo && props.ipInfo.city && ` ${props.ipInfo.city}`}
          </h2>
        </div>
        <div className="Discover-featureList">
          {nearbyContent0}
          {nearbyContent1}
          {nearbyContent2}
        </div>
      </div>
    );
  }

  const renderTopTodayFeatures = () => {
    // get current and previous four time blocks
    const currBlock = Math.floor(Date.now() / MS_IN_SIX_HOURS);
    const timeBlocks = Array.from({ length: 5 }, (_, i) => currBlock - i);

    return (
      <div className="Discover-moreFeatures Discover-moreFeatures--topToday">
        <div className="Discover-moreFeaturesHeadingRow Discover-moreFeaturesHeadingRow--topToday">
          <i className="fas fa-ranking-star" />
          <h2 className="Discover-moreFeaturesHeading">
            Top Scores Today
          </h2>
        </div>

        <PaginatedSystems pageSize={RECENT_FEATURE_PAGE_LIMIT} startSize={RECENT_FEATURE_PAGE_LIMIT}
                          collectionPath={'systems'} type={'score'}
                          clauses={[ where('isPrivate', '==', false),
                                     where('timeBlock', 'in', timeBlocks),
                                     orderBy('score', 'desc') ]} />
      </div>
    );
  }

  const renderRecentFeatures = () => {

    return (
      <div className="Discover-moreFeatures Discover-moreFeatures--recent">
        <div className="Discover-moreFeaturesHeadingRow Discover-moreFeaturesHeadingRow--recent">
        <i className="fas fa-stopwatch" />
          <h2 className="Discover-moreFeaturesHeading">
            Recently Updated
          </h2>
        </div>

        <PaginatedSystems pageSize={RECENT_FEATURE_PAGE_LIMIT} startSize={RECENT_FEATURE_PAGE_LIMIT * 2}
                          collectionPath={'systems'}
                          clauses={[ where('isPrivate', '==', false),
                                     orderBy('debouncedTime', 'desc') ]} />
      </div>
    );
  }

  return (
    <div className="Discover">
      {renderMainFeature()}
      <div className="Discover-wrapper">
        {!firebaseContext.authStateLoading && (!firebaseContext.user || !firebaseContext.user.uid) && renderNoUserContent()}
        <Revenue unitName={'explore1'} />
        {props.ipInfo && !noneNearby && renderNearbyFeatures()}
        {renderTopTodayFeatures()}
        <Revenue unitName={'explore2'} />
        {renderStarFeatures()}
        <KoFiPromo onToggleShowContribute={props.onToggleShowContribute} />
        {renderRecentFeatures()}
      </div>
    </div>
  );
}
