import React, { useEffect } from 'react';

import { Modal } from '/components/Modal.js';
import { SystemLink } from '/components/SystemLink.js';

export function BranchedBy({ systemDocData, descendantsData, open, onClose }) {

  const clearAndClose = () => {
    onClose();
  }

  const renderDescendantItem = (descendantId) => {
    return (
      <li className="BranchedBy-item" key={descendantId}>
        <SystemLink systemId={descendantId}
                    analyticsObject={{ category: 'System', action: 'Descendant Click' }} />
      </li>
    );
  }

  const renderDirectDescendantItems = () => {
    let directDescendantsItems = [];

    for (const descendant of descendantsData.directDescendants) {
      directDescendantsItems.push(renderDescendantItem(descendant.systemId));
    }

    if (descendantsData.directDescendants.length < (systemDocData.directDescendantsCount || 0)) {
      const countDiff = systemDocData.directDescendantsCount - descendantsData.directDescendants.length;
      directDescendantsItems.push((
        <li className="BranchedBy-additional" key={'additional'}>
          {descendantsData.directDescendants.length ? 'and ' : ''}{countDiff} private or deleted {countDiff === 1 ? 'map' : 'maps'}
        </li>
      ));
    }

    return directDescendantsItems;
  }

  const renderIndirectDescendantItems = () => {
    let indirectDescendantsItems = [];

    for (const descendant of descendantsData.indirectDescendants) {
      indirectDescendantsItems.push(renderDescendantItem(descendant.systemId));
    }

    const sysDocIndirectDescCount = (systemDocData.descendantsCount || 0) - (systemDocData.directDescendantsCount || 0);
    if (descendantsData.indirectDescendants.length < sysDocIndirectDescCount) {
      const countDiff = sysDocIndirectDescCount - descendantsData.indirectDescendants.length;
      indirectDescendantsItems.push((
        <li className="BranchedBy-additional" key={'additional'}>
          {descendantsData.indirectDescendants.length ? 'and ' : ''}{countDiff} private or deleted {countDiff === 1 ? 'map' : 'maps'}
        </li>
      ));
    }

    return indirectDescendantsItems;
  }

  const renderMain = () => {
    const directDescendantsItems = renderDirectDescendantItems();
    const indirectDescendantsItems = renderIndirectDescendantItems();

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
