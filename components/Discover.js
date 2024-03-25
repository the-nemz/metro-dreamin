import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import {
  collection, collectionGroup, query,
  where, orderBy, limit, startAfter, startAt, endAt,
  getDoc, getDocsFromCache, getDocsFromServer, getCountFromServer
} from 'firebase/firestore';
import { geohashQueryBounds } from 'geofire-common';
import ReactGA from 'react-ga4';
import classNames from 'classnames';

import { MILES_TO_METERS_MULTIPLIER } from '/util/constants.js';
import { FirebaseContext } from '/util/firebase.js';
import { getDistance } from '/util/helpers.js';

import { KoFiPromo } from '/components/KoFiPromo.js';
import { Result } from '/components/Result.js';
import { Revenue } from '/components/Revenue.js';

const MAIN_FEATURE_LIMIT = 10;
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
  const [ recentFeatures, setRecentFeatures ] = useState([]);
  const [ startAfterRecent, setStartAfterRecent ] = useState();

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
    fetchRecentFeatures();
    // TODO: recently commented?
    // TODO: most stations?
  }, []);

  useEffect(() => {
    if (props.ipInfo && props.ipInfo.lat != null && props.ipInfo.lon != null) {
      fetchNearbyFeatures();
    }
  }, [ props.ipInfo ]);

  // load the top ten most starred maps, and display one of them
  const fetchMainFeature = async () => {
    const mainFeatQuery = query(systemsCollection,
                                where('isPrivate', '==', false),
                                where('stars', '>=', 5),
                                orderBy('stars', 'desc'),
                                limit(MAIN_FEATURE_LIMIT));
    return await getDocsFromServer(mainFeatQuery)
      .then((querySnapshot) => {
        if (querySnapshot.size) {
          const randIndex = Math.floor(Math.random() * Math.min(querySnapshot.size, MAIN_FEATURE_LIMIT))
          const viewDocData = querySnapshot.docs[randIndex].data();
          setFeatureIds([viewDocData.systemId]);
          setMainFeature(viewDocData);
        }
      })
      .catch((error) => {
        console.log("fetchMainFeature error: ", error);
      });
  }

  // load and display paginated recently updated maps
  const fetchRecentFeatures = async () => {
    const recFeatsQuery = startAfterRecent ?
                            // see more recent query
                            query(systemsCollection,
                                  where('isPrivate', '==', false),
                                  orderBy('lastUpdated', 'desc'),
                                  startAfter(startAfterRecent),
                                  limit(RECENT_FEATURE_PAGE_LIMIT)) :
                            // initial recent query
                            query(systemsCollection,
                                  where('isPrivate', '==', false),
                                  orderBy('lastUpdated', 'desc'),
                                  limit(RECENT_FEATURE_PAGE_LIMIT * 2));
    return await getDocsFromServer(recFeatsQuery)
      .then((querySnapshot) => {
        if (!querySnapshot.size) {
          throw 'insufficient systems';
        }

        const systemDatas = querySnapshot.docs.map(doc => doc.data());
        setFeatureIds(featureIds => featureIds.concat(systemDatas.map(sD => sD.systemId)));
        setStartAfterRecent(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setRecentFeatures(currRF => currRF.concat(systemDatas));
      })
      .catch((error) => {
        console.log("fetchRecentFeatures error:", error);
      });
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
    return await getDocsFromServer(recStarsQuery)
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

  const fetchNearbyFeatures = async () => {
    const querySnapshots = await queryNearbyFeatures();

    const ipLoc = { lat: props.ipInfo.lat, lng: props.ipInfo.lon };

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

    // display top three results
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

  const queryNearbyFeatures = async () => {
    const radiusInMeters = NEARBY_RADIUS * MILES_TO_METERS_MULTIPLIER;
    const bounds = geohashQueryBounds([ props.ipInfo.lat, props.ipInfo.lon ], radiusInMeters);

    const cachePromises = [];
    const countPromises = [];
    const serverPromises = [];
    for (const bound of bounds) {
      const geoQuery = query(systemsCollection,
                             where('isPrivate', '==', false),
                             orderBy('geohash'),
                             startAt(bound[0]),
                             endAt(bound[1]));
      cachePromises.push(getDocsFromCache(geoQuery));
      countPromises.push(getCountFromServer(geoQuery));
      serverPromises.push(getDocsFromServer(geoQuery));
    }

    // sum up both local and server matches
    let cacheTotal = 0;
    let serverTotal = 0;
    const snapshots = await Promise.all([ ...cachePromises, ...countPromises ]);
    for (const snapshot of snapshots) {
      if (snapshot.type === 'AggregateQuerySnapshot') {
        serverTotal += snapshot.data().count ?? 0;
      } else {
        cacheTotal += snapshot.size;
      }
    }

    let querySnapshots;
    if (cacheTotal > serverTotal / 2) {
      // used local cache results if there are at least half the ones on the server
      querySnapshots = snapshots.filter(snap => snap.type !== 'AggregateQuerySnapshot');
    } else {
      // otherwise fetch the ones on the server
      querySnapshots = await Promise.all(serverPromises);
    }

    return querySnapshots;
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
        <div className="Discover-moreFeaturesHeadingRow">
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
        <div className="Discover-moreFeaturesHeadingRow">
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

  const renderRecentFeatures = () => {
    const recentFeatureContent = recentFeatures.map((rF, ind) => renderFeature(rF, 'recent', rF.systemId || `recent${ind}`));

    return (
      <div className="Discover-moreFeatures Discover-moreFeatures--recent">
        <div className="Discover-moreFeaturesHeadingRow">
          <h2 className="Discover-moreFeaturesHeading">
            Recently Updated
          </h2>
        </div>
        <div className="Discover-featureList">
          {recentFeatureContent}
        </div>
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
        {renderStarFeatures()}
        <KoFiPromo fallbackRevenueUnitName={'explore2'} onToggleShowContribute={props.onToggleShowContribute} />
        {renderRecentFeatures()}

        {recentFeatures.length ? (
          <button className="Discover-seeMoreRecent"
                  onClick={() => {
                    fetchRecentFeatures();
                    ReactGA.event({
                      category: 'Discover',
                      action: 'Show More Recent',
                      label: `Current Count: ${recentFeatures.length}`
                    });
                  }}>
            <i className="fas fa-chevron-circle-down"></i>
            <span className="Search-moreText">Show more</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
