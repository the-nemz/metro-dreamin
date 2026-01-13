import React, { useContext } from 'react';
import { collection } from 'firebase/firestore';

import { usePaginatedQuery } from '/util/hooks.js';
import { FirebaseContext } from '/util/firebase.js';

import { Result } from '/components/Result.js';

export function PaginatedSystems({ collectionPath, clauses, startSize = 6, pageSize = 3, types = [ 'recent' ], execute = true }) {
  const firebaseContext = useContext(FirebaseContext);

  const { docDatas: systems, fetchMore: fetchSystems, allLoaded, queryCompleted } = usePaginatedQuery({
    collection: collection(firebaseContext.database, collectionPath),
    clauses,
    startSize,
    pageSize,
    execute,
  });

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
