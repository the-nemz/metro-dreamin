import React, { useState, useContext } from 'react';
import { Link } from "react-router-dom";
import ReactGA from 'react-ga';

import { FirebaseContext } from "../firebaseContext.js";
import { Result } from './Result.js';

import loading from '../../assets/loading.gif';

const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;
const START_COUNT = 6;

export const Search = (props) => {
  const [prevSearch, setPrevSearch] = useState('');
  const [resultViews, setResultViews] = useState([]);
  const [numShown, setNumShown] = useState(START_COUNT);
  const [isFetching, setIsFetching] = useState(true);

  const firebaseContext = useContext(FirebaseContext);

  const fetchData = async (input) => {
    setIsFetching(true);
    setPrevSearch(input);
    setNumShown(START_COUNT);

    const inputWords = input.toLowerCase().split(SPLIT_REGEX);
    const filteredWords = inputWords.filter((kw, ind) => kw && ind === inputWords.indexOf(kw));

    return await firebaseContext.database.collection('views')
      .where('isPrivate', '==', false)
      .where('numStations', '>', 0)
      .where('keywords', 'array-contains-any', filteredWords)
      .get()
      .then((querySnapshot) => {
        let views = [];
        querySnapshot.forEach((viewDoc) => {
          views.push(viewDoc.data());
        });
        setResultViews(views.sort((viewA, viewB) => {
          const numMatchesA = viewA.keywords.filter(word => filteredWords.includes(word)).length;
          const numMatchesB = viewB.keywords.filter(word => filteredWords.includes(word)).length;
          const intersectPercentA = ((numMatchesA / viewA.keywords.length) + (numMatchesA / filteredWords.length)) / 2;
          const intersectPercentB = ((numMatchesB / viewB.keywords.length) + (numMatchesB / filteredWords.length)) / 2;
          return intersectPercentB - intersectPercentA;
        }));
        setIsFetching(false);

        if (views.length) {
          ReactGA.event({
            category: 'Search',
            action: 'Results',
            label: `Total: ${views.length}`
          });
        } else {
          ReactGA.event({
            category: 'Search',
            action: 'No Results'
          });
        }
      })
      .catch((error) => {
        console.log("Error getting documents: ", error);
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
      return (
        <Result viewData={viewData} key={viewData.viewId} />
      );
    }
    return null;
  });

  let results;
  if (isFetching) {
    results = (
      <div className="Search-loading">
        <img className="Search-loadingIcon" src={loading} alt="Loading Spinner" />
        <div className="Search-loadingText">
          Searching...
        </div>
      </div>
    );
  } else if (resultItems.length || !prevSearch) {
    results = (
      <div className={'Search-results ' + (resultViews.length ? 'Search-results--populated' : 'Search-results--empty')}>
        {resultItems}
      </div>
    );
  } else if (prevSearch) {
    results = (
      <div className="Search-noResults">
        <div className="Search-noResultsText">
          No maps found for search "{prevSearch}".
        </div>

        <Link className="Search-startOwn" to={'/view'} onClick={() => ReactGA.event({ category: 'Search', action: 'Start Own' })}>
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
