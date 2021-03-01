import React, { useState } from 'react';
import { Result } from './Result.js';

const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;

export const Search = (props) => {
  const [input, setInput] = useState('');
  const [resultViews, setResultViews] = useState([]);
  const [numShown, setNumShown] = useState(6);

  const fetchData = async (input) => {
    if (input) {
      const inputWords = input.toLowerCase().split(SPLIT_REGEX);
      const filteredWords = inputWords.filter((kw, ind) => kw && ind === inputWords.indexOf(kw));

      return await props.database.collection('views')
        .where('isPrivate', '==', false)
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

  let resultItems = resultViews.slice(0, numShown).map((viewData, index) => {
    if (viewData) {
      return (
        <Result viewData={viewData} key={viewData.viewId} database={props.database} />
      );
    }
    return null;
  })

  return (
    <div className="Search">
      <input className="Search-input" value={input} placeholder={"Search for a map"}
             onChange={(e) => setInput(e.target.value)}
             onBlur={(e) => fetchData(e.target.value)}
      />
      <div className={'Search-results ' + (resultViews.length ? 'Search-results--populated' : 'Search-results--empty')}>
        {resultItems}
      </div>
    </div>
   );
}
