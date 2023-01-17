import React, { useContext, useEffect, useState } from 'react';
import { collection, query, orderBy, startAt, endAt, getDocs } from 'firebase/firestore';
import { geohashQueryBounds } from 'geofire-common';

import { getDistance } from '/lib/util.js';
import { FirebaseContext } from '/lib/firebase.js';
import { MILES_TO_METERS_MULTIPLIER } from '/lib/constants.js';

import { Result } from '/components/Result.js';

export function Related({ systemDocData }) {
  const firebaseContext = useContext(FirebaseContext);

  const [relatedSystems, setRelatedSystems] = useState([]);

  useEffect(() => {
    if (systemDocData && systemDocData.centroid && systemDocData.maxDist) {
      const radius = systemDocData.maxDist * MILES_TO_METERS_MULTIPLIER * 1.1; // convert miles to meters and add 10%
      getGeoQuery(systemDocData.centroid, radius).then((querySnapshots) => {
        const relatedDocDatas = [];

        for (const querySnapshot of querySnapshots) {
          for (const relatedDoc of querySnapshot.docs) {
            const relatedDocData = relatedDoc.data();
            if (relatedDocData.systemId !== systemDocData.systemId &&
                getDistance(systemDocData.centroid, relatedDocData.centroid) * MILES_TO_METERS_MULTIPLIER <= radius) {
              relatedDocDatas.push(relatedDocData);
            }
          }
        }

        return relatedDocDatas;
      }).then((relatedDocDatas) => {
        const systemsData = relatedDocDatas.slice().sort((a, b) => (a.stars || 0) < (b.stars || 0) ? 1 : -1);
        setRelatedSystems(systemsData);
      });
    }
  }, []);

  const getGeoQuery = async (centroid, radiusInMeters) => {
    const bounds = geohashQueryBounds([ centroid.lat, centroid.lng ], radiusInMeters);
    const promises = [];
    for (const bound of bounds) {
      const geoQuery = query(collection(firebaseContext.database, 'systems'),
                             orderBy('geohash'),
                             startAt(bound[0]),
                             endAt(bound[1]));
      promises.push(getDocs(geoQuery));
    }
    return Promise.all(promises);
  }

  const renderRelatedMaps = () => {
    if (!relatedSystems.length) {
      return <div className="Related-none">
        No related maps found. Branch this map!
      </div>
    }

    let relatedElems = [];

    for (const relatedSystem of relatedSystems) {
      relatedElems.push((
        <li className="Related-item" key={relatedSystem.systemId}>
          <Result viewData={relatedSystem} isRelated={true} />
        </li>
      ))
    }

    return <ol className="Related-list">
      {relatedElems}
    </ol>;
  }

  if (!systemDocData || !systemDocData.centroid || !systemDocData.maxDist) {
    return <></>;
  }

  return (
    <div className="Related">
      <h2 className="Related-heading">
        Related Maps
      </h2>

      {renderRelatedMaps()}
    </div>
  )
}
