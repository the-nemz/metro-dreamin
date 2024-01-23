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
        {lineElems}
      </div>
    </div>
  );
}
