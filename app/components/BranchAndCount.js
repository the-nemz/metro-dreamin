import React, { useEffect } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga';
import ReactTooltip from 'react-tooltip';

export const BranchAndCount = ({ systemDocData }) => {
  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  return (
    <div className="BranchAndCount">
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
      <div className="BranchAndCount-count">
        {systemDocData.descendantsCount ? systemDocData.descendantsCount : ''}
      </div>
    </div>
  );
}
