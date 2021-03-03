import React, { useState } from 'react';
import { Result } from './Result.js';

import browserHistory from "../history.js";

const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;

export const Search = (props) => {
  const [prevSearch, setPrevSearch] = useState('');
  const [resultViews, setResultViews] = useState([]);
  const [numShown, setNumShown] = useState(6);
  const [isFetching, setIsFetching] = useState(true);

  const fetchData = async (input) => {
    setIsFetching(true);
    if (props.database && input && input !== prevSearch) {
      setPrevSearch(input);
      browserHistory.push(`/explore?search=${input}`);

      const inputWords = input.toLowerCase().split(SPLIT_REGEX);
      const filteredWords = inputWords.filter((kw, ind) => kw && ind === inputWords.indexOf(kw));

      return await props.database.collection('views')
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
        })
        .catch((error) => {
          console.log("Error getting documents: ", error);
        });
    }
    return () => {};
  }


  const startOwn = () => {
    browserHistory.push('/view');
    browserHistory.go(0);
  };

  if (props.database && props.search && props.search !== prevSearch) {
    // Initial search when query param is provided
    fetchData(props.search);
  }

  let resultItems = resultViews.slice(0, numShown).map((viewData, index) => {
    if (viewData) {
      return (
        <Result viewData={viewData} key={viewData.viewId} database={props.database} lightMode={props.settings.lightMode || false} />
      );
    }
    return null;
  });

  let showMore = numShown >= resultViews.length ? null : (
    <button className="Search-showMore" onClick={() => setNumShown(numShown + 3)}>
      <i className="fas fa-chevron-circle-down"></i>
      <span className="Search-moreText">Show more</span>
    </button>
  );

  let results;
  if (isFetching) {
    results = <div>waiting....</div>
  } else if (resultItems.length || !prevSearch) {
    results = (
      <div className={'Search-results ' + (resultViews.length ? 'Search-results--populated' : 'Search-results--empty')}>
        {resultItems}
      </div>
    );
  } else if (prevSearch) {
    results = (
      <div className="Search-noResults">
        No maps found for "{prevSearch}".

        <button className="Search-startOwn" onClick={() => startOwn()}>
          Start your own!
        </button>
      </div>
    );
  }

  return (
    <div className="Search">
      {results}
      {showMore}
    </div>
   );
}
