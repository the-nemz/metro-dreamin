import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { collection, collectionGroup, query, where, orderBy, limit, startAfter, getDocs, getDoc } from 'firebase/firestore';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

import { Result } from '/components/Result.js';

const MAIN_FEATURE_LIMIT = 10;
const SUB_FEATURE_LIMIT = 10;
const RECENTSTAR_FEATURE_LIMIT = 10;
const RECENT_FEATURE_PAGE_LIMIT = 3;

export const Discover = (props) => {
  const [ featureIds, setFeatureIds ] = useState([]);
  const [ mainFeature, setMainFeature ] = useState({});
  const [ subFeature0, setSubFeature0 ] = useState({});
  const [ subFeature1, setSubFeature1 ] = useState({});
  const [ subFeature2, setSubFeature2 ] = useState({});
  const [ starFeature0, setStarFeature0 ] = useState({});
  const [ starFeature1, setStarFeature1 ] = useState({});
  const [ starFeature2, setStarFeature2 ] = useState({});
  const [ recentFeatures, setRecentFeatures ] = useState([]);
  const [ startAfterRecent, setStartAfterRecent ] = useState();

  const firebaseContext = useContext(FirebaseContext);
  const systemsCollection = collection(firebaseContext.database, 'systems');

  const subFeatures = [
    {state: subFeature0, setter: setSubFeature0},
    {state: subFeature1, setter: setSubFeature1},
    {state: subFeature2, setter: setSubFeature2}
  ];

  const starFeatures = [
    {state: starFeature0, setter: setStarFeature0},
    {state: starFeature1, setter: setStarFeature1},
    {state: starFeature2, setter: setStarFeature2}
  ];

  // load the top ten most starred maps, and display one of them
  const fetchMainFeature = async () => {
    const mainFeatQuery = query(systemsCollection,
                                where('isPrivate', '==', false),
                                where('stars', '>=', 5),
                                orderBy('stars', 'desc'),
                                limit(MAIN_FEATURE_LIMIT));
    return await getDocs(mainFeatQuery)
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

  // load the ten most recently updated maps that have 2, 3, or 4 stars, and display three of those at random
  const fetchSubFeatures = async () => {
    const subFeatsQuery = query(systemsCollection,
                                where('isPrivate', '==', false),
                                where('stars', 'in', [2, 3, 4]),
                                orderBy('lastUpdated', 'desc'),
                                limit(SUB_FEATURE_LIMIT));
    return await getDocs(subFeatsQuery)
      .then((querySnapshot) => {
        if (querySnapshot.size < 3) throw 'insufficient systems';

        let randIndexes = [];
        while(randIndexes.length < 3) {
          const rand = Math.floor(Math.random() * Math.min(querySnapshot.size, SUB_FEATURE_LIMIT));
          if (randIndexes.indexOf(rand) === -1) {
            randIndexes.push(rand);
          };
        }

        for (let i = 0; i < randIndexes.length; i++) {
          const { state, setter } = subFeatures[i];
          const randIndex = randIndexes[i];
          const viewDocData = querySnapshot.docs[randIndex].data();
          setFeatureIds(featureIds => featureIds.concat([viewDocData.systemId]));
          setter(viewDocData);
        }
      })
      .catch((error) => {
        console.log("fetchSubFeatures error:", error);
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
    return await getDocs(recFeatsQuery)
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
      })
      .catch((error) => {
        console.log("fetchRecentlyStarred error:", error);
      });
  }

  const renderMainFeature = () => {
    if (mainFeature && mainFeature.systemId) {
      return (
        <div className="Discover-feature Discover-feature--main">
          <Result viewData={mainFeature} isFeature={true} key={mainFeature.systemId} />
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
            <Result viewData={feature} key={feature.systemId}
                    isSubFeature={type === 'sub'} isRecentFeature={type === 'recent'} />
          </div>
        </div>
      );
    } else {
      return (
        <div className="Discover-col Discover-col--featurePlaceolder" key={key}>
          <div className="Discover-feature Discover-feature--placeholder">
            <div className="Discover-resultPlaceholder"></div>
          </div>
        </div>
      );
    }
  }

  const renderSubFeatures = () => {
    let subContent0 = renderFeature(subFeature0, 'sub', 'sub0');
    let subContent1 = renderFeature(subFeature1, 'sub', 'sub1');
    let subContent2 = renderFeature(subFeature2, 'sub', 'sub2');

    return (
      <div className="Discover-moreFeatures Discover-moreFeatures--sub">
        <div className="Discover-moreFeaturesHeadingRow">
          <h2 className="Discover-moreFeaturesHeading">
            More Features
          </h2>
        </div>
        <div className="Discover-featureList">
          {subContent0}
          {subContent1}
          {subContent2}
        </div>
      </div>
    );
  }

  const renderStarFeatures = () => {
    let starContent0 = renderFeature(starFeature0, 'star', 'star0');
    let starContent1 = renderFeature(starFeature1, 'star', 'star1');
    let starContent2 = renderFeature(starFeature2, 'star', 'star2');

    return (
      <div className="Discover-moreFeatures Discover-moreFeatures--star">
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

  useEffect(() => {
    fetchMainFeature();
    fetchSubFeatures();
    fetchRecentlyStarred();
    // TODO: recently commented?
    // TODO: near IP geolocation?
    // TODO: most stations
    fetchRecentFeatures();
  }, []);

  return (
    <div className="Discover">
      {renderMainFeature()}
      <div className="Discover-wrapper">
        {(!firebaseContext.user || !firebaseContext.user.uid) && renderNoUserContent()}
        {renderSubFeatures()}
        {renderStarFeatures()}
        {renderRecentFeatures()}

        {recentFeatures.length && (
          <button className="Discover-seeMoreRecent"
                  onClick={fetchRecentFeatures}>
            <i className="fas fa-chevron-circle-down"></i>
            <span className="Search-moreText">Show more</span>
          </button>
        )}
      </div>
    </div>
  );
}
