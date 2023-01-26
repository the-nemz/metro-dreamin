import React, { useEffect } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga';
import ReactTooltip from 'react-tooltip';
import classNames from 'classnames';

export const BranchAndCount = ({ systemDocData, isPrivate }) => {
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
      <div className="BranchAndCount-count">
        {systemDocData.descendantsCount ? systemDocData.descendantsCount : ''}
      </div>
    </div>
  );
}
