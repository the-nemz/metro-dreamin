import React from 'react';

import { useStarsForSystem } from '/util/hooks.js';

import { Modal } from '/components/Modal.js';
import { UserLink } from '/components/UserLink.js';

export function StarredBy({ systemDocData, open, onClose }) {
  const starData = useStarsForSystem({ systemId: systemDocData.systemId || '', execute: open });

  const clearAndClose = () => {
    onClose();
  }

  const renderMain = () => {
    let userElems = [];

    for (const star of starData.stars) {
      userElems.push((
        <li className="StarredBy-item" key={star.timestamp}>
          <UserLink userId={star.userId} baseClass={'StarredBy'}
                    analyticsObject={{ category: 'System', action: 'Starrer Click' }} />
        </li>
      ));
    }

    return (
      <div className="StarredBy-main">
        <ul className="StarredBy-list">
          {userElems}
        </ul>
      </div>
    )
  }

  return (
    <Modal baseClass='StarredBy' open={open}
           heading={'Starred By'}
           content={renderMain()}
           onClose={clearAndClose} />
  )
}
