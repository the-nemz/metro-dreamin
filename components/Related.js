import React, { useContext, useEffect, useState } from 'react';
import { collection, query, where, orderBy, startAt, endAt, getDocs } from 'firebase/firestore';
import { geohashQueryBounds } from 'geofire-common';

import { getDistance } from '/util/helpers.js';
import { FirebaseContext } from '/util/firebase.js';
import { MILES_TO_METERS_MULTIPLIER } from '/util/constants.js';

import { Result } from '/components/Result.js';

const MAX_RELATED = 6;

export function Related({ systemDocData }) {
  const firebaseContext = useContext(FirebaseContext);

  const [queryPerformed, setQueryPerformed] = useState(false);
  const [radiusPower, setRadiusPower] = useState(0);
  const [includeLevel, setIncludeLevel] = useState(systemDocData.level ? true : false);
  const [relatedSystems, setRelatedSystems] = useState([]);

  useEffect(() => {
    if (relatedSystems.length < MAX_RELATED && radiusPower < 3) {
      queryForRelatedSystems();
    } else {
      setQueryPerformed(true);
    }
  }, [relatedSystems])

  const queryForRelatedSystems = () => {
    if (systemDocData && systemDocData.centroid && systemDocData.maxDist) {
      const maxDistInMeters = systemDocData.maxDist * MILES_TO_METERS_MULTIPLIER; // convert miles to meters
      const radius = maxDistInMeters * (radiusPower ? Math.pow(10, radiusPower) : 1.1); // use radiusPower as multiplier or add 10% if first search
      getGeoQuery(systemDocData.centroid, radius, systemDocData.level).then((querySnapshots) => {
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
        if (includeLevel) {
          setIncludeLevel(false);
        } else {
          setRadiusPower(rP => rP + 1);
        }
        setRelatedSystems(currSystems => {
          const currSysIds = currSystems.map(s => s.systemId);
          let newSystems = [];
          for (const newSystemData of systemsData) {
            if (!currSysIds.includes(newSystemData.systemId)) {
              newSystems.push(newSystemData);
            }
          }
          return currSystems.concat(newSystems).slice(0, MAX_RELATED);
        });
      });
    }
  }

  const getGeoQuery = async (centroid, radiusInMeters, level) => {
    const bounds = geohashQueryBounds([ centroid.lat, centroid.lng ], radiusInMeters);
    const promises = [];
    for (const bound of bounds) {
      let contraints = [
        where('isPrivate', '==', false),
        orderBy('geohash'),
        startAt(bound[0]),
        endAt(bound[1])
      ];

      if (includeLevel) {
        contraints.push(where('level', '==', level));
      }

      const geoQuery = query(collection(firebaseContext.database, 'systems'), ...contraints);
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
          <Result viewData={relatedSystem} types={['related']} />
        </li>
      ))
    }

    return <ol className="Related-list">
      {relatedElems}
    </ol>;
  }

  if (!queryPerformed) {
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
