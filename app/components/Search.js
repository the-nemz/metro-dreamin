import React, { useState, useContext } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, startAt, endAt, getDocs } from 'firebase/firestore';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';
import { geohashQueryBounds } from 'geofire-common';

import { getDistance, getLevel, renderSpinner } from '/lib/util.js';
import { FirebaseContext } from '/lib/firebase.js';
import { MILES_TO_METERS_MULTIPLIER } from '/lib/constants.js';

import { Result } from '/components/Result.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;
const START_COUNT = 6;

export const Search = (props) => {
  const [prevSearch, setPrevSearch] = useState('');
  const [resultViews, setResultViews] = useState([]);
  const [keywordSystems, setKeywordSystems] = useState([]);
  const [geoSystems, setGeoSystems] = useState([]);
  const [numShown, setNumShown] = useState(START_COUNT);
  const [isFetching, setIsFetching] = useState(true);

  const firebaseContext = useContext(FirebaseContext);

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

          // if (views.length) {
          //   ReactGA.event({
          //     category: 'Search',
          //     action: 'Results',
          //     label: `Total: ${views.length}`
          //   });
          // } else {
          //   ReactGA.event({
          //     category: 'Search',
          //     action: 'No Results'
          //   });
          // }
        })
        .catch(reject)
    });
  }

  // first do geocoding query to get probable intended places
  // use that to build geohash queries and sort results by stars
  const doGeoQuery = (input) => {
    const encodedInput = encodeURIComponent(input);
    const types = 'country,region,postcode,district,place,locality,neighborhood';
    const geocodeQuery = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedInput}.json?types=${types}&access_token=${mapboxgl.accessToken}`;

    return new Promise((resolve, reject) => {
      fetch(geocodeQuery)
        .then(response => response.json())
        .then(geocodeResponse => {
          Promise.all(buildGeoQueries(geocodeResponse))
            .then((querySnapshots) => {
              let allSystems = [];
              for (const querySnapshot of querySnapshots) {
                allSystems = allSystems.concat(querySnapshot.docs.map(sd => sd.data()));
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
    console.log(geocodeResponse)
    for (const feature of (geocodeResponse.features || [])) {
      // ignore low confidence results
      if ((feature.relevance || 0) < 0.7) continue;

      if (feature.bbox && feature.bbox.length === 4 && feature.center && feature.center.length === 2) {
        // get distance from center to further of two bbpx corners
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
          promises.push(getDocs(geoQuery));
        }
      }
    }

    return promises;
  }

  const fetchData = async (input) => {
    setIsFetching(true);
    setPrevSearch(input);
    setNumShown(START_COUNT);

    Promise.all([ doKeywordSearch(input), doGeoQuery(input) ])
      .then(resultsWithTypeArray => {
        for (const resultsWithType of resultsWithTypeArray) {
          switch (resultsWithType.type) {
            case 'keyword':
              setKeywordSystems(resultsWithType.results);
              break;
            case 'geo':
              setGeoSystems(resultsWithType.results);
              break;
          }
        }
        setIsFetching(false);
      })
      .catch(error => {
        console.log('fetchData error:', error);
        setIsFetching(false);
      });
  }

  const showMore = () => {
    setNumShown(prevNum => {
      const newCount = prevNum + 3;
      ReactGA.event({
        category: 'Search',
        action: 'Show More',
        label: `Count: ${newCount}`
      });
      return newCount;
    });
  }

  if (props.search && props.search !== prevSearch) {
    fetchData(props.search);
  }

  let resultItems = resultViews.slice(0, numShown).map((viewData, index) => {
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
      <ol className={'Search-results ' + (resultViews.length ? 'Search-results--populated' : 'Search-results--empty')}>
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

  let displayedText = !resultViews.length ? null : (
    <div className="Search-numDisplayed">
      ( {Math.min(resultViews.length, numShown)} of {resultViews.length} results )
    </div>
  );

  let showMoreButton = numShown >= resultViews.length ? null : (
    <button className="Search-showMore" onClick={showMore}>
      <i className="fas fa-chevron-circle-down"></i>
      <span className="Search-moreText">Show more</span>
    </button>
  );

  return (
    <div className="Search">
      {results}
      {displayedText}
      {showMoreButton}
    </div>
   );
}
