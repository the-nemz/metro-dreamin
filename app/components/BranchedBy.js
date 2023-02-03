import React from 'react';

import { Modal } from '/components/Modal.js';
import { SystemLink } from '/components/SystemLink.js';

export function BranchedBy({ descendantsData, open, onClose }) {

  const clearAndClose = () => {
    onClose();
  }

  const renderMain = () => {
    let directDescendantsItems = [];

    for (const descendant of descendantsData.directDescendants) {
      directDescendantsItems.push((
        <li className="BranchedBy-item" key={descendant.systemId}>
          <SystemLink systemId={descendant.systemId} />
        </li>
      ));
    }

    let indirectDescendantsItems = [];

    for (const descendant of descendantsData.indirectDescendants) {
      indirectDescendantsItems.push((
        <li className="BranchedBy-item" key={descendant.systemId}>
          <SystemLink systemId={descendant.systemId} />
        </li>
      ));
    }

    return (
      <div className="BranchedBy-main">
        {directDescendantsItems.length ? <>
          <div className="BranchedBy-subheading">
            Direct Descendants
          </div>
          <ul className="BranchedBy-list BranchedBy-list--direct">
            {directDescendantsItems}
          </ul>
        </> : null}

        {indirectDescendantsItems.length ? <>
          <div className="BranchedBy-subheading">
            Further Descendants
          </div>
          <ul className="BranchedBy-list BranchedBy-list--direct">
            {indirectDescendantsItems}
          </ul>
        </> : null}
      </div>
    )
  }

  return (
    <Modal baseClass='BranchedBy' open={open}
           heading={'Branched By'}
           content={renderMain()}
           onClose={clearAndClose} />
  )
}
