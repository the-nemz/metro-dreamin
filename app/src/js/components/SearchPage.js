import React, { useState, useEffect } from 'react';
import { ResultList } from './ResultList';

const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;

export const SearchPage = (props) => {
  const [input, setInput] = useState('');
  const [resultViews, setResultViews] = useState();

  const fetchData = async (input) => {
    if (input) {
      const inputWords = input.toLowerCase().split(SPLIT_REGEX);
      const filteredWords = inputWords.filter((kw, ind) => kw && ind === inputWords.indexOf(kw));

      console.log(inputWords)
      return await props.database.collection('views')
        .where('isPrivate', '==', false)
        .where('keywords', 'array-contains-any', filteredWords)
        .get()
        .then((querySnapshot) => {
          let views = [];
          querySnapshot.forEach((viewDoc) => {
            views.push(viewDoc.data());
          });
          setResultViews(views);
        })
        .catch((error) => {
            console.log("Error getting documents: ", error);
        });
    }
    return () => {};
  }

  return (
    <>
      <input value={input} placeholder={"Search for a map"}
             onChange={(e) => setInput(e.target.value)}
             onBlur={(e) => fetchData(e.target.value)}
      />
      <ResultList resultList={resultViews}/>
    </>
   );
}
