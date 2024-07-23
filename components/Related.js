import React, { useContext, useEffect, useState } from 'react';
import {
  collection, query,
  where, orderBy, startAt, endAt,
  getDocs
} from 'firebase/firestore';
import { geohashQueryBounds } from 'geofire-common';

import { getCacheInvalidationTime, getDistance, roundCoordinate } from '/util/helpers.js';
import { FirebaseContext } from '/util/firebase.js';
import { MILES_TO_METERS_MULTIPLIER } from '/util/constants.js';

import { Result } from '/components/Result.js';

const MAX_RELATED = 6;

export function Related({ systemDocData }) {
  const firebaseContext = useContext(FirebaseContext);

  const [queryPerformed, setQueryPerformed] = useState(false);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [radiusPower, setRadiusPower] = useState(0);
  const [includeLevel, setIncludeLevel] = useState(systemDocData.level ? true : false);
  const [relatedSystems, setRelatedSystems] = useState([]);

  useEffect(() => {
    const systemSnippets = fetchFromLocalStorage();
    if (systemSnippets && systemSnippets.length >= MAX_RELATED) {
      setRelatedSystems(systemSnippets.slice(0, MAX_RELATED));
    }
    setCacheChecked(true);
  }, []);

  useEffect(() => {
    if (cacheChecked && relatedSystems.length < MAX_RELATED && radiusPower < 3) {
      queryForRelatedSystems();
    } else if (cacheChecked) {
      setQueryPerformed(true);
    }
  }, [cacheChecked, relatedSystems]);

  const queryForRelatedSystems = () => {
    if (systemDocData && systemDocData.centroid && systemDocData.maxDist) {
      // convert miles to meters
      const maxDistInMeters = systemDocData.maxDist * MILES_TO_METERS_MULTIPLIER;
      // use radiusPower as multiplier or add 10% if first search
      const radius = maxDistInMeters * (radiusPower ? Math.pow(10, radiusPower) : 1.1);
      // limit to one significant figure (23905 meters -> 20000 meters, 77 -> 70, etc)
      const radiusRounded = parseFloat(radius.toPrecision(1));
      // make coordinate less precise (2 decimals)
      const roundedCentroid = roundCoordinate(systemDocData.centroid, 2);

      getGeoQuery(roundedCentroid, radiusRounded, systemDocData.level).then((querySnapshots) => {
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

          const fullSystemList = currSystems.concat(newSystems);
          saveToLocalStorage(fullSystemList);
          return fullSystemList.slice(0, MAX_RELATED);
        });
      }).catch((e) => {
        console.warn('Error in getGeoQuery:', e);
      });
    }
  }

  const getGeoQuery = async (centroid, radiusInMeters, level) => {
    const serverPromises = [];
    const bounds = geohashQueryBounds([ centroid.lat, centroid.lng ], radiusInMeters);

    // TODO: optimize with new multifield range/inequality filter support?
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

      serverPromises.push(getDocs(geoQuery));
    }

    return Promise.all(serverPromises);
  }

  const fetchFromLocalStorage = () => {
    if (!systemDocData.systemId) return [];

    try {
      const localStorageString = localStorage.getItem(`mdRelated-${systemDocData.systemId}`);
      if (localStorageString) {
        const lsQueryData = JSON.parse(localStorageString);
        const cacheInvalidationTime = getCacheInvalidationTime();
        if ((lsQueryData.timestamp || 0) > cacheInvalidationTime) {
          return lsQueryData.sortedSystemSnippets || [];
        }
      }
    } catch (e) {
      console.warn('Related fetchFromLocalStorage error:', e);
    }

    return [];
  }

  /**
   * Saves snippets of realted systems fetched from the server to local storage along with a
   * timestamp, using the systemId in the key.
   * @param {*} sortedSystems the related systems in ranked order
   * @returns {void}
   */
  const saveToLocalStorage = (sortedSystems) => {
    if (!systemDocData.systemId || !sortedSystems.length >= MAX_RELATED) return;

    try {
      const sortedSystemSnippets = sortedSystems.map(s => ({
        systemId: s.systemId,
        userId: s.userId
      }));

      const cachedData = {
        sortedSystemSnippets,
        timestamp: Date.now()
      }

      localStorage.setItem(`mdRelated-${systemDocData.systemId}`, JSON.stringify(cachedData));
    } catch (e) {
      console.warn('Related saveToLocalStorage error:', e);
    }

    purgeLocalStorage();
  }

  /**
   * Purge related systems entries in localstorage that are order than the cache duration time
   * @returns {void}
   */
  const purgeLocalStorage = () => {
    try {
      const cacheInvalidationTime = getCacheInvalidationTime();

      const keysToDelete = [];
      for (const lsKey of Object.keys(localStorage)) {
        if (lsKey.startsWith('mdRelated-')) {
          const localStorageString = localStorage.getItem(lsKey);
          if (localStorageString) {
            const lsQueryData = JSON.parse(localStorageString);
            if ((lsQueryData.timestamp || 0) < cacheInvalidationTime) {
              keysToDelete.push(lsKey);
            }
          }
        }
      }

      for (const keyToDelete of keysToDelete) {
        localStorage.removeItem(keyToDelete);
      }
    } catch (e) {
      console.warn('Related purgeLocalStorage error:', e);
    }
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
