import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, startAt, endAt, getDocs } from 'firebase/firestore';
import ReactGA from 'react-ga4';
import mapboxgl from 'mapbox-gl';
import { geohashQueryBounds } from 'geofire-common';

import { MILES_TO_METERS_MULTIPLIER } from '/util/constants.js';
import { DeviceContext } from '/util/deviceContext.js';
import { FirebaseContext } from '/util/firebase.js';
import { getDistance, getLevel, renderSpinner } from '/util/helpers.js';

import { Result } from '/components/Result.js';
import { Revenue } from '/components/Revenue.js';

mapboxgl.accessToken = 'pk.eyJ1IjoiaWpuZW16ZXIiLCJhIjoiY2xma3B0bW56MGQ4aTQwczdsejVvZ2cyNSJ9.FF2XWl1MkT9OUVL_HBJXNQ';

const GEOCODING_BASEURL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;
const START_COUNT = 6;

export const Search = (props) => {
  const [prevSearch, setPrevSearch] = useState('');
  const [resultSystems, setResultSystems] = useState([]);
  const [numShown, setNumShown] = useState(START_COUNT);
  const [isFetching, setIsFetching] = useState(true);

  const firebaseContext = useContext(FirebaseContext);
  const { isMobile } = useContext(DeviceContext);

  // return a keyword search
  const doKeywordSearch = (input) => {
    const inputWords = input.toLowerCase().split(SPLIT_REGEX);
    const filteredWords = inputWords.filter((kw, ind) => kw && ind === inputWords.indexOf(kw));

    const searchQuery = query(collection(firebaseContext.database, 'systems'),
                              where('isPrivate', '==', false),
                              where('numStations', '>', 0),
                              where('keywords', 'array-contains-any', filteredWords));

    return new Promise((resolve, reject) => {
      getDocs(searchQuery)
        .then((querySnapshot) => {
          let views = [];
          querySnapshot.forEach((viewDoc) => {
            views.push(viewDoc.data());
          });

          // sort systems by percentage of keywords that appear in the query
          const keywordSort = (viewA, viewB) => {
            const numMatchesA = viewA.keywords.filter(word => filteredWords.includes(word)).length;
            const numMatchesB = viewB.keywords.filter(word => filteredWords.includes(word)).length;
            const intersectPercentA = ((numMatchesA / viewA.keywords.length) + (numMatchesA / filteredWords.length)) / 2;
            const intersectPercentB = ((numMatchesB / viewB.keywords.length) + (numMatchesB / filteredWords.length)) / 2;
            return intersectPercentB - intersectPercentA;
          }

          resolve({
            type: 'keyword',
            results: views.sort(keywordSort)
          });
        })
        .catch(reject)
    });
  }

  // first do geocoding query to get probable intended places
  // use that to build geohash queries and sort results by stars
  const doGeoQuery = (input) => {
    const encodedInput = encodeURIComponent(input);
    const types = 'country,region,postcode,district,place,locality,neighborhood';
    const geocodeQuery = `${GEOCODING_BASEURL}/${encodedInput}.json?types=${types}&access_token=${mapboxgl.accessToken}`;

    return new Promise((resolve, reject) => {
      fetch(geocodeQuery)
        .then(response => response.json())
        .then(geocodeResponse => {
          Promise.all(buildGeoQueries(geocodeResponse))
            .then((snapObjs) => {
              let allSystems = [];
              for (const snapObj of snapObjs) {
                const filteredMaps = snapObj.snap.docs.map(sd => sd.data())
                                                      .filter(systemData => systemData.centroid.lng > snapObj.bbox[0] &&
                                                                            systemData.centroid.lat > snapObj.bbox[1] &&
                                                                            systemData.centroid.lng < snapObj.bbox[2] &&
                                                                            systemData.centroid.lat < snapObj.bbox[3]);
                allSystems = allSystems.concat(filteredMaps);
              }

              resolve({
                type: 'geo',
                results: allSystems.sort((a, b) => (a.stars || 0) < (b.stars || 0) ? 1 : -1)
              });
            })
            .catch(reject)
        })
        .catch(reject)
    })
  }

  // use geocoder response to build geohash queries
  // find target level from the bounding box of the geocoder response feature
  const buildGeoQueries = (geocodeResponse) => {
    const promises = [];
    for (const feature of (geocodeResponse.features || [])) {
      // ignore low relevance results
      if ((feature.relevance || 0) < 0.7) continue;

      if (feature.bbox && feature.bbox.length === 4 && feature.center && feature.center.length === 2) {
        // get distance from center to further of two bbox corners
        const center = { lng: feature.center[0], lat: feature.center[1] };
        const southwest = { lng: feature.bbox[0], lat: feature.bbox[1] };
        const northeast = { lng: feature.bbox[2], lat: feature.bbox[3] };

        const radius = Math.max(getDistance(center, southwest), getDistance(center, northeast));
        const levelKey = getLevel({ radius }).key;

        // build actual db queries by geohsash
        const bounds = geohashQueryBounds([ center.lat, center.lng ], radius * MILES_TO_METERS_MULTIPLIER);
        for (const bound of bounds) {
          const geoQuery = query(collection(firebaseContext.database, 'systems'),
                                where('isPrivate', '==', false),
                                where('level', '==', levelKey),
                                orderBy('geohash'),
                                startAt(bound[0]),
                                endAt(bound[1]));
          promises.push(new Promise(res => {
            getDocs(geoQuery).then(snap => res({ bbox: feature.bbox, snap: snap }));
          }));
        }
      }
    }

    return promises;
  }

  const orderSystems = (geoSystems, keywordSystems) => {
    let orderedSystems = [];
    let systemIds = new Set();

    while (geoSystems.length || keywordSystems.length) {
      let systemToAdd;
      switch (orderedSystems.length % 3) {
        case 0:
          systemToAdd = geoSystems.shift() || keywordSystems.shift();
          break;
        case 1:
          systemToAdd = keywordSystems.shift() || geoSystems.shift();
          break;
        case 2:
          systemToAdd = geoSystems.shift() || keywordSystems.shift();
          break;
      }

      if (!systemIds.has(systemToAdd.systemId)) {
        orderedSystems.push(systemToAdd);
        systemIds.add(systemToAdd.systemId);
      }
    }

    return orderedSystems;
  }

  const handleGetResults = (queryResults) => {
    let keywordSystems = [];
    let geoSystems = [];
    for (const resultsWithType of queryResults) {
      switch (resultsWithType.type) {
        case 'keyword':
          keywordSystems = resultsWithType.results ? resultsWithType.results.slice() : [];
          break;
        case 'geo':
          geoSystems = resultsWithType.results ? resultsWithType.results.slice() : [];
          break;
      }
    }

    const keywordResultsCount = keywordSystems.length;
    const geoResultsCount = geoSystems.length;
    const orderedSystems = orderSystems(geoSystems, keywordSystems);

    setResultSystems(orderedSystems);
    setIsFetching(false);

    if (keywordResultsCount) {
      ReactGA.event({
        category: 'Search',
        action: 'Keyword Results',
        label: `Total: ${keywordResultsCount}`
      });
    } else {
      ReactGA.event({
        category: 'Search',
        action: 'No Keyword Results'
      });
    }

    if (geoResultsCount) {
      ReactGA.event({
        category: 'Search',
        action: 'Geosearch Results',
        label: `Total: ${geoResultsCount}`
      });
    } else {
      ReactGA.event({
        category: 'Search',
        action: 'No Geosearch Results'
      });
    }

    if (orderedSystems.length) {
      ReactGA.event({
        category: 'Search',
        action: 'Combined Results',
        label: `Total: ${orderedSystems.length}`
      });
    } else {
      ReactGA.event({
        category: 'Search',
        action: 'No Combined Results'
      });
    }
  }

  const fetchData = (input) => {
    setIsFetching(true);
    setPrevSearch(input);
    setNumShown(START_COUNT);

    Promise.all([ doKeywordSearch(input), doGeoQuery(input) ])
      .then(handleGetResults)
      .catch(error => {
        console.log('fetchData error:', error);
        setIsFetching(false);
      });
  }

  const showMore = () => {
    setNumShown(prevNum => prevNum + 3);

    ReactGA.event({
      category: 'Search',
      action: 'Show More Results',
      label: `Current Count: ${numShown}`
    });
  }

  if (props.search && props.search !== prevSearch) {
    fetchData(props.search);

    ReactGA.event({
      category: 'Search',
      action: 'Query',
      label: props.search
    });
  }

  let resultItems = resultSystems.slice(0, numShown).map((viewData, index) => {
    if (viewData) {
      return <li className="Search-result" key={viewData.systemId}>
        <Result viewData={viewData} types={['search']} key={viewData.systemId} />
      </li>;
    }
    return null;
  });

  let results;
  if (isFetching) {
    results = (
      <div className="Search-loading">
        {renderSpinner('Search-spinner')}
        <div className="Search-loadingText">
          Searching...
        </div>
      </div>
    );
  } else if (resultItems.length || !prevSearch) {
    results = (
      <ol className={'Search-results ' + (resultSystems.length ? 'Search-results--populated' : 'Search-results--empty')}>
        {resultItems}
      </ol>
    );
  } else if (prevSearch) {
    results = (
      <div className="Search-noResults">
        <div className="Search-noResultsText">
          No maps found for search "{prevSearch}".
        </div>

        <Link className="Search-startOwn" href="/edit/new"
              onClick={() => ReactGA.event({ category: 'Search', action: 'Start Own' })}>
          Start your own!
        </Link>
      </div>
    );
  }

  let displayedText = !resultSystems.length ? null : (
    <div className="Search-numDisplayed">
      ( {Math.min(resultSystems.length, numShown)} of {resultSystems.length} results )
    </div>
  );

  let showMoreButton = numShown >= resultSystems.length ? null : (
    <button className="Search-showMore" onClick={showMore}>
      <i className="fas fa-chevron-circle-down"></i>
      <span className="Search-moreText">Show more</span>
    </button>
  );

  return (
    <div className="Search">
      <div className="Search-content">
        {results}
        {displayedText}
        {showMoreButton}
      </div>

      {isMobile === true && <Revenue unitName="searchMobile" />}
      {isMobile === false && <Revenue unitName="searchDesktop" />}
    </div>
   );
}
