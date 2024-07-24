import React, { useState, useEffect, useContext } from 'react';
import ReactGA from 'react-ga4';
import { collection, getDocs, limit, query, startAt } from 'firebase/firestore';

import { FirebaseContext } from '/util/firebase.js';

import { Result } from '/components/Result.js';

export function PaginatedSystems({ collectionPath, clauses, startSize = 6, pageSize = 3, types = [ 'recent' ] }) {
  const firebaseContext = useContext(FirebaseContext);

  const [ systems, setSystems ] = useState([]);
  const [ startAfterSystem, setStartAfterSystem ] = useState();
  const [ allLoaded, setAllLoaded ] = useState(false);
  const [ queryInitiated, setQueryInitiated ] = useState(false);
  const [ queryCompleted, setQueryCompleted ] = useState(false);

  useEffect(() => {
    if (!collectionPath || !clauses || queryInitiated) return;

    fetchSystems();
  }, [ collectionPath, clauses ]);

  const fetchSystems = () => {
    let queryParts = [ collection(firebaseContext.database, collectionPath), ...clauses ];
    if (startAfterSystem) {
      queryParts.push(startAt(startAfterSystem));
      queryParts.push(limit(pageSize + 1));
    } else {
      queryParts.push(limit(startSize + 1));
    }

    setQueryInitiated(true);

    getDocs(query(...queryParts))
      .then((querySnapshot) => {
        if (!querySnapshot.size) {
          setAllLoaded(true);
          return;
        }

        if (startAfterSystem && querySnapshot.size <= pageSize) setAllLoaded(true);
        if (!startAfterSystem && querySnapshot.size <= startSize) setAllLoaded(true);

        const systemDatas = querySnapshot.docs
                              .slice(0, startAfterSystem ? pageSize : startSize)
                              .map(doc => doc.data());

        setStartAfterSystem(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setSystems(currSystems => currSystems.concat(systemDatas));
      })
      .catch((error) => {
        console.log("fetchSystems error:", error);
      })
      .finally(() => setQueryCompleted(true));

    ReactGA.event({
      category: 'PaginatedSystems',
      action: 'Show More',
      label: `Current Count: ${systems?.length ?? 0}`
    });
  }

  const renderSystem = (system, key) => {
    if (system && system.systemId) {
      return (
        <div className="PaginatedSystems-col Discover-col--system" key={key}>
          <div className="PaginatedSystems-system">
            <Result viewData={system} key={system.systemId} types={types} />
          </div>
        </div>
      );
    } else {
      return (
        <div className="PaginatedSystems-col PaginatedSystems-col--systemPlaceholder" key={key}>
          <div className="PaginatedSystems-system PaginatedSystems-system--placeholder">
            <div className="PaginatedSystems-resultPlaceholder"></div>
          </div>
        </div>
      );
    }
  }

  const renderSystems = () => {
    if (!queryCompleted) {
      return <div className="PaginatedSystems-none">
        Loading...
      </div>;
    };

    if (!systems.length) {
      return <div className="PaginatedSystems-none">
        None yet!
      </div>;
    }

    return <ol className="PaginatedSystems-list">
      {systems.map((sys, ind) => renderSystem(sys, sys.systemId ? sys.systemId : `${types.join('-')}-${ind}`))}
    </ol>;
  }

  return (
    <div className="PaginatedSystems">
      {renderSystems()}

      {queryCompleted && !allLoaded && (
        <button className="PaginatedSystems-showMore" onClick={fetchSystems}>
          <i className="fas fa-chevron-circle-down"></i>
          <span className="PaginatedSystems-moreText">Show more</span>
        </button>
      )}
    </div>
  );
}
