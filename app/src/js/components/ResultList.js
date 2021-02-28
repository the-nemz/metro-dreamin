import React from 'react';

export const ResultList = ({ resultList = [] }) => {
  let resultItems = resultList.map((data, index) => {
    if (data) {
      return (
        <div className="Result" key={data.viewId}>
          <div className="Result-name">
            {data.keywords.join(' ')}
          </div>
        </div>
      );
    }
    return null;
  })
  return (
    <div className="ResultList">
      {resultItems}
    </div>
  );
}
