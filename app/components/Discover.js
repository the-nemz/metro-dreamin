import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import classNames from 'classnames';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import { sortSystems, getEditPath } from '/lib/util.js';
import { FirebaseContext } from '/lib/firebase.js';

import { Result } from '/components/Result.js';
import { StarLink } from '/components/StarLink.js';

const MAIN_FEATURE_LIMIT = 10;
const SUB_FEATURE_LIMIT = 10;
const RECENT_FEATURE_LIMIT = 3;

export const Discover = (props) => {
  const [ featureIds, setFeatureIds ] = useState([]);
  const [ mainFeature, setMainFeature ] = useState({});
  const [ subFeature0, setSubFeature0 ] = useState({});
  const [ subFeature1, setSubFeature1 ] = useState({});
  const [ subFeature2, setSubFeature2 ] = useState({});
  const [ recentFeature0, setRecentFeature0 ] = useState({});
  const [ recentFeature1, setRecentFeature1 ] = useState({});
  const [ recentFeature2, setRecentFeature2 ] = useState({});

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

  // load the top ten most starred maps, and display one of them
  const fetchMainFeature = async () => {
    console.log('fetchMainFeature')
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

  const renderUserContent = () => {
    if (firebaseContext.user && firebaseContext.user.uid) {
      let sysLinkElems = [];
      if ((firebaseContext.ownSystemDocs || []).length) {
        for (const view of firebaseContext.ownSystemDocs.sort(sortSystems)) {
          let starLinksContent;
          if (view.stars) {
            starLinksContent = (
              <span className="Discover-ownLinkStars">
                {view.stars} {view.stars === 1 ? 'star' : 'stars'}
              </span>
            );
          }
          const linkClasses = classNames('Discover-ownLink', 'ViewLink', { 'Discover-ownLink--private': view.isPrivate });
          sysLinkElems.push(
            <Link className={linkClasses} key={view.systemId} href={getEditPath(view.userId, view.systemNumStr)}
                  onClick={() => ReactGA.event({ category: 'Discover', action: 'Own Link' })}>
              <div className="Discover-ownLinkTitle">
                {view.title ? view.title : 'Unnamed System'}
              </div>
              <div className="Discover-ownLinkInfo">
                {view.numLines} {view.numLines === 1 ? 'line' : 'lines'}, {view.numStations} {view.numStations === 1 ? 'station' : 'stations'}
                {starLinksContent ? ', ' : ''}
                {starLinksContent}
              </div>
              {view.isPrivate ? <i data-tip="This map will not appear in search" className="fas fa-eye-slash"></i> : ''}
            </Link>
          );
        }
        sysLinkElems.push(
          <Link className="Discover-startNew Link" href={'/view'} key={'new'}
                onClick={() => ReactGA.event({ category: 'Discover', action: 'New Map' })}>
            Start a new map!
          </Link>
        );
      }
      const ownFallback = (
        <Link className="Discover-fallback Link" href={'/view'}
              onClick={() => ReactGA.event({ category: 'Discover', action: 'First Map' })}>
          Get started on your first map!
        </Link>
      );
      const ownLinksContent = (
        <div className="Discover-ownLinks">
          {sysLinkElems.length ? sysLinkElems : ownFallback}
        </div>
      );

      let starLinkElems = [];
      if ((firebaseContext.starredSystemIds || []).length) {
        for (const systemId of firebaseContext.starredSystemIds) {
          starLinkElems.push(
            <StarLink key={systemId} systemId={systemId} />
          );
        }
      }
      const starFallback = (
        <button className="Discover-fallback Link" onClick={() => {
                                                              document.querySelector('.Explore-input').focus();
                                                              ReactGA.event({ category: 'Discover', action: 'Try Search' })
                                                            }}>
          None yet! Use the searchbar above to find some!
        </button>
      );
      const starLinksContent = (
        <div className="Discover-starLinks">
          {starLinkElems.length ? starLinkElems : starFallback}
        </div>
      );

      return (
        <div className="Discover-userWrap">
          <div className="Discover-userContent">
            <div className="Discover-col Discover-col--links">
              <h2 className="Discover-linkHeading">
                Your maps
              </h2>
              {ownLinksContent}
            </div>
            <div className="Discover-col Discover-col--links">
              <h2 className="Discover-linkHeading">
                Your starred maps
              </h2>
              {starLinksContent}
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="Discover-userWrap">
          <div className="Discover-noUserContent">
            <div className="Discover-noUserDescription">
              MetroDreamin' allows you to design and visualize the transportation system that you wish your city had.
              <br />
              <br />
              Use the search bar above to explore the maps other transit enthusiasts have made, or jump right in and start your own. Happy mapping!
            </div>
            <div className="Discover-noUserLinks">
              <Link className="Discover-start Button--primary" href="/view"
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
    fetchRecentFeatures();
  }, []);

  return (
    <div className="Discover">
      {renderMainFeature()}
      <div className="Discover-wrapper">
        {renderUserContent()}
        {renderSubFeatures()}
        {renderRecentFeatures()}
      </div>
    </div>
  );
}
