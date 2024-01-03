import React from 'react';
import classNames from 'classnames';

import { SystemMiniLink } from '/components/SystemMiniLink.js';

import { getUserDisplayName } from '/lib/util.js';

export const Ancestry = ({ ancestors, title, ownerDocData }) => {

  const wrapAncestryMember = (child, key, isCurr = false, isDefault = false) => {
    return <li className={classNames('Ancestry-relativeWrap', { 'Ancestry-relativeWrap--curr': isCurr, 'Ancestry-relativeWrap--default': isDefault })}
               key={key}>
      {child}
    </li>
  }

  let ancestorItems = [];

  for (const ancestorId of (ancestors || []).slice().reverse()) {
    if (ancestorId.startsWith('defaultSystems/')) {
      ancestorItems.push(wrapAncestryMember(<div className="Ancestry-relative">Branched from default map</div>, ancestorId, false, true));
    } else {
      ancestorItems.push(wrapAncestryMember(<SystemMiniLink systemId={ancestorId}
                                                            analyticsObject={{ category: 'System', action: 'Ancestor Click' }} />,
                                            ancestorId))
    }
  }

  if (ancestorItems.length === 0) {
    ancestorItems.push(wrapAncestryMember(<div className="Ancestry-relative">Built from scratch</div>, 'scratch', false, true));
  }

  const currItem = <div className="System-relative">
    {title ? title : 'Map'} by {getUserDisplayName(ownerDocData)}
  </div>
  ancestorItems.unshift(wrapAncestryMember(currItem, 'curr', true));

  return (
    <div className="Ancestry">
      <div className="Ancestry-title">
        Branch History

        <i className="far fa-question-circle" data-tooltip-content="The history of maps this one was branched from – the lineage of the map"></i>
      </div>
      <ol className="Ancestry-items">
        {ancestorItems}
      </ol>
    </div>
  );
}
