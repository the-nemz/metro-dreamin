import React from 'react';
import classNames from 'classnames';

import { SystemLink } from '/components/SystemLink.js';

export const Ancestry = ({ ancestors, title, ownerDocData }) => {

  const wrapAncestryMember = (child, key, isCurr = false, isDefault = false) => {
    return <li className={classNames('Ancestry-relativeWrap', { 'Ancestry-relativeWrap--curr': isCurr, 'Ancestry-relativeWrap--default': isDefault })}
               key={key}>
      {child}
    </li>
  }

  let ancestorItems = [];

  let hasDefault = false;
  for (const ancestorId of (ancestors || []).slice().reverse()) {
    if (ancestorId.startsWith('defaultSystems/')) {
      hasDefault = true;
      ancestorItems.push(wrapAncestryMember(<div className="Ancestry-relative">Branched from default map</div>, ancestorId, false, true));
    } else {
      ancestorItems.push(wrapAncestryMember(<SystemLink systemId={ancestorId} />, ancestorId))
    }
  }

  if (!hasDefault) {
    ancestorItems.push(wrapAncestryMember(<div className="Ancestry-relative">Built from scratch</div>, 'scratch', false, true));
  }

  const currItem = <div className="System-relative">
    {title ? title : 'Map'} by {ownerDocData.displayName ? ownerDocData.displayName : 'Anon'}
  </div>
  ancestorItems.unshift(wrapAncestryMember(currItem, 'curr', true));

  return (
    <div className="Ancestry">
      <div className="Ancestry-title">
        Branch History

        <i className="far fa-question-circle" data-tip="The history of maps this one was branched from – the lineage of the map"></i>
      </div>
      <ol className="Ancestry-items">
        {ancestorItems}
      </ol>
    </div>
  );
}
