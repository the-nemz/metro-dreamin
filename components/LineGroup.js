import React, { useState } from 'react';

import { getMode } from '/util/helpers.js';

export const LineGroup = ({ group }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!group) return;

  const label = getMode(group.mode).label;
  return (
    <div className="LineGroup">
      <div className="LineGroup-upper">
        <button className={`LineGroup-toggle LineGroup-toggle--${isCollapsed ? 'collapsed' : 'expanded'}`}
                onClick={() => setIsCollapsed(curr => !curr)}>
          <span className="sr-only">{isCollapsed ? `Expand ${label}` : `Collapse ${label}`}</span>
          <i className="fas fa-chevron-down"></i>
        </button>
        <h2 className="LineGroup-label">
          {label}
        </h2>
      </div>
      <div className={`LineGroup-lines LineGroup-lines--${isCollapsed ? 'collapsed' : 'expanded'}`}>
        {group.lineElems}
      </div>
    </div>
  );
}
