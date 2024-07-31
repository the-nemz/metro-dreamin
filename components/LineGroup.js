import React, { useState } from 'react';
import ReactGA from 'react-ga4';

export const LineGroup = ({
  viewOnly,
  group,
  isCustom,
  initiallyCollapsed,
  groupIds,
  groupsDisplayed,
  lineElems,
  onLineGroupInfoChange = () => {},
  onLineGroupDelete = () => {},
  setGroupsDisplayed = () => {}
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState(group.label ? group.label : 'Group Name');

  if (!group) return;

  // TODO: consider moving showGroup and hideGroup functions to higher level component

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

  const renderLabel = () => {
    if (viewOnly || !isCustom) {
      return (
        <div className="LineGroup-labelWrap LineGroup-labelWrap--static">
          <h2 className={`LineGroup-label LineGroup-label--${isShown ? 'shown' : 'hidden'}`}>
            {label}
          </h2>
        </div>
      );
    } else {
      if (isEditing) {
        const onSubmit = () => {
          const trimmedInput = input.trim();
          onLineGroupInfoChange({ ...group, label: trimmedInput ? trimmedInput : 'Group Line' });
          setIsEditing(false);
          setInput(trimmedInput);
        }
        return (
          <form className="LineGroup-labelForm" onSubmit={onSubmit}>
            <input className="LineGroup-label LineGroup-label--input" value={input}
                  placeholder={'Group Name'} autoFocus
                  onChange={(e) => setInput(e.target.value)}
                  onBlur={onSubmit} />
            <i className="fas fa-pen"></i>
          </form>
        );
      } else {
        return (
          <div className="LineGroup-labelWrap LineGroup-labelWrap--editable">
            <h2 className={`LineGroup-label LineGroup-label--${isShown ? 'shown' : 'hidden'}`}>
              {label}
            </h2>

            <button className="LineGroup-edit" data-tooltip-content="Edit line group name"
                    onClick={() => setIsEditing(true)}>
              <i className="fas fa-pen"></i>
              <span className="sr-only">Edit line group name</span>
            </button>

            <button className="LineGroup-delete" data-tooltip-content="Delete line group (but not lines)"
                    onClick={() => onLineGroupDelete(group)}>
              <i className="fas fa-trash-can"></i>
              <span className="sr-only">Delete line group (but not lines)</span>
            </button>
          </div>
        );
      }
    }
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

        {!isEditing && (
          <button className={`LineGroup-hide LineGroup-hide--${isShown ? 'shown' : 'hidden'}`}
                  data-tooltip-content={tooltip}
                  onClick={() => !isShown ? showGroup() : hideGroup()}>
            <span className="sr-only">{tooltip}</span>
          </button>
        )}

        {renderLabel()}
      </div>
      <div className={`LineGroup-lines LineGroup-lines--${isCollapsed ? 'collapsed' : 'expanded'} LineGroup-lines--${isShown ? 'shown' : 'hidden'}`}>
        {lineElems}
      </div>
    </div>
  );
}
