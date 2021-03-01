import React, { useState } from 'react';
import { Result } from './Result.js';

import browserHistory from "../history.js";

const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;

export const Search = (props) => {
  const [input, setInput] = useState(props.search || '');
  const [prevSearch, setPrevSearch] = useState('');
  const [resultViews, setResultViews] = useState([]);
  const [numShown, setNumShown] = useState(6);

  const fetchData = async (input) => {
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
        })
        .catch((error) => {
          console.log("Error getting documents: ", error);
        });
    }
    return () => {};
  }

  if (props.database && props.search && !prevSearch) {
    // Initial search when query param is provided
    fetchData(input);
  }

  let resultItems = resultViews.slice(0, numShown).map((viewData, index) => {
    if (viewData) {
      return (
        <Result viewData={viewData} key={viewData.viewId} database={props.database} />
      );
    }
    return null;
  });

  let showMore = numShown >= resultViews.length ? null : (
    <button className="Search-showMore" onClick={() => setNumShown(numShown + 3)}>
      <i class="fas fa-chevron-circle-down"></i>
      <span className="Search-moreText">Show more</span>
    </button>
  );

  return (
    <div className="Search">
      <input className="Search-input" value={input} placeholder={"Search for a map"}
             onChange={(e) => setInput(e.target.value)}
             onBlur={(e) => fetchData(e.target.value)}
      />
      <div className={'Search-results ' + (resultViews.length ? 'Search-results--populated' : 'Search-results--empty')}>
        {resultItems}
      </div>
      {showMore}
    </div>
   );
}
