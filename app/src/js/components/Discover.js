import React, { useState, useEffect } from 'react';
import { Result } from './Result.js';

export const Discover = (props) => {
  const [ mainFeature, setMainFeature ] = useState({});

  const fetchMainFeature = async (input) => {
    if (props.database) {
      return await props.database.collection('views')
        .where('isPrivate', '==', false)
        .orderBy('stars', 'desc')
        .limit(1)
        .get()
        .then((querySnapshot) => {
          querySnapshot.forEach((viewDoc) => {
            // should only be one
            setMainFeature(viewDoc.data());
          });
        })
        .catch((error) => {
          console.log("Error getting documents: ", error);
        });
    }
    return () => {};
  }

  const buildContent = () => {
    if (mainFeature.viewId) {
      console.log(mainFeature)
      return (
        <div className="Discover-feature">
          <Result viewData={mainFeature} isFeature={true} key={mainFeature.viewId} database={props.database} lightMode={props.lightMode} />
        </div>
      );
    }
    return;
  }

  useEffect(() => {
    fetchMainFeature()
  }, []);

  return (
    <div className="Discover">
      {buildContent()}
    </div>
   );
}
