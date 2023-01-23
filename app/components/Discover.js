import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { collection, collectionGroup, query, where, orderBy, limit, getDocs, getDoc } from 'firebase/firestore';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

import { Result } from '/components/Result.js';

const MAIN_FEATURE_LIMIT = 10;
const SUB_FEATURE_LIMIT = 10;
const RECENT_FEATURE_LIMIT = 3;
const RECENTSTAR_FEATURE_LIMIT = 10;

export const Discover = (props) => {
  const [ featureIds, setFeatureIds ] = useState([]);
  const [ mainFeature, setMainFeature ] = useState({});
  const [ subFeature0, setSubFeature0 ] = useState({});
  const [ subFeature1, setSubFeature1 ] = useState({});
  const [ subFeature2, setSubFeature2 ] = useState({});
  const [ recentFeature0, setRecentFeature0 ] = useState({});
  const [ recentFeature1, setRecentFeature1 ] = useState({});
  const [ recentFeature2, setRecentFeature2 ] = useState({});
  const [ starFeature0, setStarFeature0 ] = useState({});
  const [ starFeature1, setStarFeature1 ] = useState({});
  const [ starFeature2, setStarFeature2 ] = useState({});

  const firebaseContext = useContext(FirebaseContext);
  const systemsCollection = collection(firebaseContext.database, 'systems');

  const subFeatures = [
    {state: subFeature0, setter: setSubFeature0},
    {state: subFeature1, setter: setSubFeature1},
    {state: subFeature2, setter: setSubFeature2}
  ];

  const recentFeatures = [
    {state: recentFeature0, setter: setRecentFeature0},
    {state: recentFeature1, setter: setRecentFeature1},
    {state: recentFeature2, setter: setRecentFeature2}
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

  // load and display the three most recently updated maps
  const fetchRecentFeatures = async () => {
    const recFeatsQuery = query(systemsCollection,
                                where('isPrivate', '==', false),
                                orderBy('lastUpdated', 'desc'),
                                limit(RECENT_FEATURE_LIMIT));
    return await getDocs(recFeatsQuery)
      .then((querySnapshot) => {
        if (querySnapshot.size < 3) throw 'insufficient systems';

        for (const [ind, viewDoc] of querySnapshot.docs.entries()) {
          const { state, setter } = recentFeatures[ind];
          const viewDocData = viewDoc.data();
          setFeatureIds(featureIds => featureIds.concat([viewDocData.systemId]));
          setter(viewDocData);
        }
      })
      .catch((error) => {
        console.log("fetchRecentFeatures error:", error);
      });
  }

  // load and display the three most recently updated maps
  const fetchRecentlyStarred = async () => {
    const recStarsQuery = query(collectionGroup(firebaseContext.database, 'stars'),
                                orderBy('timestamp', 'desc'),
                                limit(RECENTSTAR_FEATURE_LIMIT));
    return await getDocs(recStarsQuery)
      .then(async (querySnapshot) => {
        // get systemDocDatas and filter out private systems
        const starMap = {};
        for (const starDoc of querySnapshot.docs) {
          if (!(starDoc.id in starMap)) {
            const sysDoc = await getDoc(starDoc.ref.parent.parent);
            if (sysDoc.exists()) {
              const sysData = sysDoc.data();
              if (!sysData.isPrivate) {
                starMap[`${sysData.systemId}|${starDoc.id}`] = {
                  starData: starDoc.data(),
                  sysData: sysData
                };
              }
            }

          }
        }

        // rank based on if owner is the starrer and timestamp
        const starItemSort = (a, b) => {
          if (a.starData.userId === a.sysData.userId && b.starData.userId !== b.sysData.userId) { // b starred own map
            return 1;
          } else if (a.starData.userId !== a.sysData.userId && b.starData.userId === b.sysData.userId) { // a starred own map
            return -1;
          } else { // sort by timestamp
            b.starData.timestamp - a.starData.timestamp;
          }
        }
        const sortedSysDatas = Object.values(starMap).sort(starItemSort).map(sI => sI.sysData);

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

        if (sysIdSet.size < 3) throw 'insufficient recent stars';

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
    if (mainFeature.systemId) {
      return (
        <div className="Discover-feature Discover-feature--main">
          <Result viewData={mainFeature} isFeature={true} key={mainFeature.systemId} />
        </div>
      );
    }
    return;
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

  const renderFeature = (feature, type) => {
    if (feature.systemId) {
      return (
        <div className="Discover-col Discover-col--feature">
          <div className={`Discover-feature Discover-feature--${type}`}>
            <Result viewData={feature} key={feature.systemId}
                    isSubFeature={type === 'sub'} isRecentFeature={type === 'recent'} />
          </div>
        </div>
      );
    }
  }

  const renderSubFeatures = () => {
    let subContent0 = renderFeature(subFeature0, 'sub');
    let subContent1 = renderFeature(subFeature1, 'sub');
    let subContent2 = renderFeature(subFeature2, 'sub');

    if (subContent0 || subContent1 || subContent2) {
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
    return;
  }

  const renderStarFeatures = () => {
    let starContent0 = renderFeature(starFeature0, 'star');
    let starContent1 = renderFeature(starFeature1, 'star');
    let starContent2 = renderFeature(starFeature2, 'star');

    if (starContent0 || starContent1 || starContent2) {
      return (
        <div className="Discover-moreFeatures Discover-moreFeatures--sub">
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
    return;
  }

  const renderRecentFeatures = () => {
    let recentContent0 = renderFeature(recentFeature0, 'recent');
    let recentContent1 = renderFeature(recentFeature1, 'recent');
    let recentContent2 = renderFeature(recentFeature2, 'recent');

    if (recentContent0 || recentContent1 || recentContent2) {
      return (
        <div className="Discover-moreFeatures Discover-moreFeatures--recent">
          <div className="Discover-moreFeaturesHeadingRow">
            <h2 className="Discover-moreFeaturesHeading">
              Recently Updated
            </h2>
          </div>
          <div className="Discover-featureList">
            {recentContent0}
            {recentContent1}
            {recentContent2}
          </div>
        </div>
      );
    }
    return;
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
      </div>
    </div>
  );
}
