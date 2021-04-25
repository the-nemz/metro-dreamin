import React, { useState, useEffect, useContext } from 'react';
import { Link } from "react-router-dom";
import classNames from "classnames";
import ReactTooltip from 'react-tooltip';

import { sortSystems, getViewId, getViewPath } from '../util.js';
import { FirebaseContext } from "../firebaseContext.js";
import { Result } from './Result.js';
import { StarLink } from './StarLink.js';

export const Discover = (props) => {
  const [ mainFeature, setMainFeature ] = useState({});
  const [ cityFeature0, setCityFeature0 ] = useState({});
  const [ cityFeature1, setCityFeature1 ] = useState({});
  const [ cityFeature2, setCityFeature2 ] = useState({});
  const [ userDocData, setUserDocData ] = useState();
  const [ userSystems, setUserSystems ] = useState([]);

  const firebaseContext = useContext(FirebaseContext);

  const cities = [
    {state: cityFeature0, setter: setCityFeature0, title: 'Istanbul', keywords: ['istanbul']},
    {state: cityFeature1, setter: setCityFeature1, title: 'São Paulo', keywords: ['são', 'paulo']},
    {state: cityFeature2, setter: setCityFeature2, title: 'United States HSR', keywords: ['hsr']}
  ];

  const fetchMainFeature = async () => {
    return await firebaseContext.database.collection('views')
      .where('isPrivate', '==', false)
      .orderBy('stars', 'desc')
      .limit(1)
      .get()
      .then((querySnapshot) => {
        // TODO: consider getting top ~10 and choosing one randomly for variety
        querySnapshot.forEach((viewDoc) => {
          // should only be one
          setMainFeature(viewDoc.data());
        });
      })
      .catch((error) => {
        console.log("Error getting documents: ", error);
      });
  }

  const fetchCityFeature = async (keywords, setter) => {
    return await firebaseContext.database.collection('views')
      .where('isPrivate', '==', false)
      .where('keywords', 'array-contains-any', keywords)
      .orderBy('stars', 'desc')
      .limit(1)
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((viewDoc) => {
          // should only be one
          setter(viewDoc.data());
        });
      })
      .catch((error) => {
        console.log("Error getting documents: ", error);
      });
  }

  const featchCityFeatures = () => {
    for (const city of cities) {
      fetchCityFeature(city.keywords, city.setter);
    }
  }

  const fetchUserData = async (userId) => {
    const userDocString = `users/${userId}`;
    let userDoc = firebaseContext.database.doc(userDocString);
    userDoc.get().then((doc) => {
      if (doc) {
        setUserDocData(doc.data());
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });

    firebaseContext.database.collection('views')
      .where('userId', '==', userId)
      .get()
      .then((systemsSnapshot) => {
        let sysChoices = [];
        systemsSnapshot.forEach(doc => sysChoices.push(doc.data()));
        setUserSystems(sysChoices);
        ReactTooltip.rebuild();
      })
      .catch((error) => {
        console.log("Error getting documents: ", error);
      });
  }

  const renderFeature = () => {
    if (mainFeature.viewId) {
      return (
        <div className="Discover-feature">
          <Result viewData={mainFeature} isFeature={true} key={mainFeature.viewId} />
        </div>
      );
    }
    return;
  }

  const renderUserContent = () => {
    if (userDocData && userDocData.userId) {
      let ownLinksContent;
      if (userSystems.length) {
        let sysLinkElems = [];
        for (const view of userSystems.sort(sortSystems)) {
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
            <Link className={linkClasses} key={view.viewId} to={getViewPath(view.userId, view.systemId)}>
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
        let fallback = (
          <Link className="Discover-fallback Link" to={'/view'}>
            Get started on your first map!
          </Link>
        );
        ownLinksContent = (
          <div className="Discover-ownLinks">
            {sysLinkElems.length ? sysLinkElems : fallback}
          </div>
        );
      }

      let starLinksContent;
      if ((userDocData.starredViews || []).length) {
        let starLinkElems = [];
        for (const viewId of userDocData.starredViews) {
          starLinkElems.push(
            <StarLink key={viewId} viewId={viewId} database={firebaseContext.database} />
          );
        }
        let fallback = (
          <button className="Discover-fallback Link" onClick={() => document.querySelector('.Explore-input').focus()}>
            None yet! Use the searchbar above to find some!
          </button>
        );
        starLinksContent = (
          <div className="Discover-starLinks">
            {starLinkElems.length ? starLinkElems : fallback}
          </div>
        );
      }

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
    } else if (mainFeature.viewId) {
      return (
        <div className="Discover-userWrap">
          <div className="Discover-noUserContent">
            <Link className="Discover-start" to={'/view'}>
              Get started!
            </Link>
          </div>
        </div>
      );
    }
  }

  const renderCityContent = () => {
    let cityContent0 = cityFeature0.viewId ? (
      <div className="Discover-col Discover-col--city">
        <div className="Discover-cityName">
          {cities[0].title}
        </div>
        <div className="Discover-cityMap">
          <Result viewData={cityFeature0} key={cityFeature0.viewId} isCityFeature={true} />
        </div>
      </div>
    ) : null;
    let cityContent1 = cityFeature1.viewId ? (
      <div className="Discover-col Discover-col--city">
        <div className="Discover-cityName">
          {cities[1].title}
        </div>
        <div className="Discover-cityMap">
          <Result viewData={cityFeature1} key={cityFeature1.viewId} isCityFeature={true} />
        </div>
      </div>
    ) : null;
    let cityContent2 = cityFeature2.viewId ? (
      <div className="Discover-col Discover-col--city">
        <div className="Discover-cityName">
          {cities[2].title}
        </div>
        <div className="Discover-cityMap">
          <Result viewData={cityFeature2} key={cityFeature2.viewId} isCityFeature={true} />
        </div>
      </div>
    ) : null;

    if (cityContent0 || cityContent1 || cityContent2) {
      return (
        <div className="Discover-cityContent">
          <h2 className="Discover-cityHeading">
          ✨ More Features ✨
          </h2>
          <div className="Discover-cityCols">
            {cityContent0}
            {cityContent1}
            {cityContent2}
          </div>
        </div>
      );
    }
    return;
  }

  useEffect(() => {
    fetchMainFeature();
    featchCityFeatures();
  }, []);

  useEffect(() => {
    if (firebaseContext.user && firebaseContext.user.uid) {
      fetchUserData(firebaseContext.user.uid);
    }
  }, [firebaseContext.user]);

  return (
    <div className="Discover">
      {renderFeature()}
      <div className="Discover-wrapper">
        {renderUserContent()}
        {renderCityContent()}
      </div>
    </div>
  );
}
