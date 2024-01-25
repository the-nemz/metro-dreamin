import React, { useState } from 'react';
import ReactGA from 'react-ga4';

export const LineGroup = ({ group, groupIds, groupsDisplayed, lineElems, setGroupsDisplayed = () => {} }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!group) return;

  const showGroup = () => {
    const groups = [ ...(groupsDisplayed || []), group.id ];
    setGroupsDisplayed(Array.from(new Set(groups)));

    ReactGA.event({
      category: 'System',
      action: `Show Line Group`
    });
  }

  const hideGroup = () => {
    if (groupsDisplayed?.length) {
      setGroupsDisplayed(groupsDisplayed.filter(gId => gId !== group.id));
    } else {
      setGroupsDisplayed(groupIds.filter(gId => gId !== group.id));
    }

    ReactGA.event({
      category: 'System',
      action: `Hide Line Group`
    });
  }

  const isShown = !groupsDisplayed || groupsDisplayed.includes(group.id);
  const label = group.label ? group.label : 'Group Name';
  const tooltip = isShown ? `${label} line group is shown` : `${label} line group is hidden`;

  return (
    <div className="LineGroup">
      <div className="LineGroup-upper">
        <button className={`LineGroup-toggle LineGroup-toggle--${isCollapsed ? 'collapsed' : 'expanded'}`}
                onClick={() => setIsCollapsed(curr => !curr)}>
          <span className="sr-only">{isCollapsed ? `Expand ${label}` : `Collapse ${label}`}</span>
          <i className="fas fa-chevron-down"></i>
        </button>

        <button className={`LineGroup-hide LineGroup-hide--${isShown ? 'shown' : 'hidden'}`}
                data-tooltip-content={tooltip}
                onClick={() => !isShown ? showGroup() : hideGroup()}>
          <span className="sr-only">{tooltip}</span>
        </button>

        <h2 className={`LineGroup-label LineGroup-label--${isShown ? 'shown' : 'hidden'}`}>
          {label}
        </h2>
      </div>
      <div className={`LineGroup-lines LineGroup-lines--${isCollapsed ? 'collapsed' : 'expanded'} LineGroup-lines--${isShown ? 'shown' : 'hidden'}`}>
        {lineElems}
      </div>
    </div>
  );
}
