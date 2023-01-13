import React from 'react';
import classNames from 'classnames';

import { SystemLink } from '/components/SystemLink.js';

export const Ancestry = ({ systemDocData, ownerDocData }) => {

  const wrapAncestryMember = (child, key, isCurr = false, isDefault = false) => {
    return <li className={classNames('Ancestry-relativeWrap', { 'Ancestry-relativeWrap--curr': isCurr, 'Ancestry-relativeWrap--default': isDefault })}
               key={key}>
      {child}
    </li>
  }

  let ancestorItems = [];
  if (!(systemDocData.ancestors || []).length) {
    ancestorItems.push(wrapAncestryMember(<div className="Ancestry-relative">Built from scratch</div>, 'scratch', false, true));
  }

  for (const ancestorId of (systemDocData.ancestors || [])) {
    if (ancestorId.startsWith('defaultSystems/')) {
      ancestorItems.push(wrapAncestryMember(<div className="Ancestry-relative">Branched from default map</div>, ancestorId, false, true));
    } else {
      ancestorItems.push(wrapAncestryMember(<SystemLink systemId={ancestorId} />, ancestorId))
    }
  }

  const currItem = <div className="System-relative">
    {systemDocData.title} by {ownerDocData.displayName ? ownerDocData.displayName : 'Anon'}
  </div>
  ancestorItems.push(wrapAncestryMember(currItem, 'curr', true));

  return (
    <div className="Ancestry">
      <div className="Ancestry-title">
        Ancestry

        <i className="far fa-question-circle" data-tip="The history of maps this one was branched from"></i>
      </div>
      <ol className="Ancestry-items">
        {ancestorItems}
      </ol>
    </div>
  );
}
