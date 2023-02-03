import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga';
import ReactTooltip from 'react-tooltip';
import classNames from 'classnames';

import { BranchedBy } from '/components/BranchedBy.js';

export const BranchAndCount = ({ systemDocData, isPrivate, descendantsData }) => {
  const [ showBranchedByModal, setShowBranchedByModal ] = useState(false);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, [isPrivate]);

  return (
    <div className={classNames('BranchAndCount', { 'BranchAndCount--none': !systemDocData.descendantsCount })}>
      {isPrivate ? (
        <div className="BranchAndCount-icon BranchAndCount-icon--private"
              data-tip="Private maps cannot be branched">
          <i className="fas fa-code-branch"></i>
        </div>
      ) : (
        <Link className="BranchAndCount-icon"
              data-tip="Branch from this map"
              href={{
                pathname: '/edit/new',
                query: { fromSystem: systemDocData.systemId },
              }}
              onClick={() => ReactGA.event({
                category: 'ViewOnly',
                action: 'Branch',
                value: systemDocData.systemId
              })}>
          <i className="fas fa-code-branch"></i>
        </Link>
      )}

      <button className="BranchAndCount-count Link"
              onClick={() => setShowBranchedByModal(true)} >
        {systemDocData.descendantsCount ? systemDocData.descendantsCount : ''}
      </button>

      <BranchedBy open={showBranchedByModal} descendantsData={descendantsData}
                  onClose={() => setShowBranchedByModal(false)} />
    </div>
  );
}
