import React, { useState } from 'react';

import { getMode } from '/util/helpers.js';

export const LineGroup = ({ group, groupIds, groupsDisplayed, setGroupsDisplayed = () => {} }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!group) return;

  const showGroup = () => {
    const groups = [ ...(groupsDisplayed || []), group.mode ];
    setGroupsDisplayed(Array.from(new Set(groups)));
  }

  const hideGroup = () => {
    if (groupsDisplayed?.length) {
      setGroupsDisplayed(groupsDisplayed.filter(gId => gId !== group.mode));
    } else {
      setGroupsDisplayed(groupIds.filter(gId => gId !== group.mode));
    }
  }

  const isShown = !groupsDisplayed || groupsDisplayed.includes(group.mode);
  const label = getMode(group.mode).label;
  const tooltip = isShown ? `Hide ${label} line group` : `Show ${label} line group`;

  return (
    <div className="LineGroup">
      <div className="LineGroup-upper">
        <button className={`LineGroup-toggle LineGroup-toggle--${isCollapsed ? 'collapsed' : 'expanded'}`}
                onClick={() => setIsCollapsed(curr => !curr)}>
          <span className="sr-only">{isCollapsed ? `Expand ${label}` : `Collapse ${label}`}</span>
          <i className="fas fa-chevron-down"></i>
        </button>
        <h2 className={`LineGroup-label LineGroup-label--${isShown ? 'shown' : 'hidden'}`}>
          {label}
        </h2>

        <button className="LineGroup-hide LineGroup-hide--hidden" onClick={() => !isShown ? showGroup() : hideGroup()}
                data-tooltip-content={tooltip}>
          <div className="LineGroup-hideIcon">
            <i className={!isShown ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
          </div>
          <span className="sr-only">{tooltip}</span>
        </button>
      </div>
      <div className={`LineGroup-lines LineGroup-lines--${isCollapsed ? 'collapsed' : 'expanded'} LineGroup-lines--${isShown ? 'shown' : 'hidden'}`}>
        {group.lineElems}
      </div>
    </div>
  );
}
