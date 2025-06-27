import React, { useState } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';
import classNames from 'classnames';

import { displayLargeNumber } from '/util/helpers.js';

import { BranchedBy } from '/components/BranchedBy.js';

export const BranchAndCount = ({ systemDocData, isPrivate }) => {
  const [ showBranchedByModal, setShowBranchedByModal ] = useState(false);

  return (
    <div className={classNames('BranchAndCount', { 'BranchAndCount--none': !systemDocData.descendantsCount })}>
      {isPrivate ? (
        <div className="BranchAndCount-icon BranchAndCount-icon--private"
              data-tooltip-content="Private maps cannot be branched">
          <i className="fas fa-code-branch"></i>
        </div>
      ) : (
        <Link className="BranchAndCount-icon"
              data-tooltip-content="Branch from this map"
              href={{
                pathname: '/edit/new',
                query: { fromSystem: systemDocData.systemId },
              }}
              onClick={() => ReactGA.event({
                category: 'System',
                action: 'Branch',
                value: systemDocData.systemId
              })}>
          <i className="fas fa-code-branch"></i>
        </Link>
      )}

      <button className="BranchAndCount-count Link"
              onClick={() => {
                setShowBranchedByModal(true);
                ReactGA.event({
                  category: 'System',
                  action: 'Show Branched By'
                });
              }}>
        {systemDocData.descendantsCount ? displayLargeNumber(systemDocData.descendantsCount, 3) : ''}
      </button>

      <BranchedBy open={showBranchedByModal} systemDocData={systemDocData}
                  onClose={() => setShowBranchedByModal(false)} />
    </div>
  );
}
