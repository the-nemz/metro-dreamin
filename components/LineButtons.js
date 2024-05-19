import React, { useMemo } from 'react';
import classNames from 'classnames';

import { DEFAULT_LINE_MODE } from '/util/constants.js';
import { sortLines, getLuminance, getMode, getLineColorIconStyle } from '/util/helpers.js';

import { LineGroup } from '/components/LineGroup.js';

export const LineButtons = ({
  extraClasses = [],
  system,
  focus,
  recent,
  groupsDisplayed,
  viewOnly,
  setGroupsDisplayed,
  onLineGroupInfoChange,
  onLineGroupDelete,
  onLineClick,
  onAddLine,
  onAddLineGroup
}) => {

  const buildLineElemsForGroup = (lines, lineIds, groupId) => {
    let lineElems = [];
    for (const lineId of (lineIds || [])) {
      const color = lines[lineId].color;
      const name = lines[lineId].name;
      let isFocused = focus && focus.line && focus.line.id === lineId;

      lineElems.push((
        <li className={classNames('LineButtons-item', { 'LineButtons-item--focused': isFocused })} key={lineId}>
          <button className="LineButtons-button"
                  data-lightcolor={getLuminance(color) > 128}
                  style={isFocused ? { backgroundColor: color } : {}}
                  onClick={() => onLineClick(lineId)}>
            <div className="LineButtons-linePrev" style={getLineColorIconStyle(lines[lineId])}></div>
            <div className="LineButtons-line">
              {name}
            </div>
          </button>
        </li>
      ));
    }

    if (!viewOnly) {
      lineElems.push((
        <li className="LineButtons-item LineButtons-item--new" key={'new'}>
          <button className="LineButtons-button LineButtons-button--new"
                  data-lightcolor={false}
                  onClick={() => {
                    if (isNaN(parseInt(groupId))) {
                      onAddLine({ mode: groupId });
                    } else {
                      onAddLine({ lineGroupId: groupId });
                    }
                  }}>
            <div className="LineButtons-addIcon">
              <i className="fas fa-plus"></i>
            </div>
            <div className="LineButtons-addText">
              Add new line
            </div>
          </button>
        </li>
      ));
    }

    return lineElems;
  }

  const groupedLineIds = useMemo(() => {
    const sortedLines = Object.values(system.lines || {}).sort(sortLines);
    const _groupedLineIds = sortedLines.reduce((groups, line) => {
      let groupId = line.lineGroupId ? line.lineGroupId : getMode(line.mode).key;
      if (!groups[groupId]?.length) {
        groups[groupId] = [];
      }
      groups[groupId].push(line.id);
      return groups;
    }, {});

    for (const lineGroupId in system.lineGroups) {
      if (!(lineGroupId in _groupedLineIds)) {
        _groupedLineIds[lineGroupId] = [];
      }
    }

    return _groupedLineIds;
  }, [
    Object.values(system.lines).map(l => `${l.id}|${l.mode}|${l.lineGroupId}|${l.name}`).join(),
    Object.keys(system.lineGroups).join()
  ]);

  const groupElems = useMemo(() => {
    const groupIds = Object.keys(groupedLineIds || {});

    // if there are no groups because there are no lines
    if (groupIds.length === 0) {
      groupedLineIds[DEFAULT_LINE_MODE] = [];
      groupIds.push(DEFAULT_LINE_MODE);
    }

    const sortedGroupIds = groupIds.sort((a, b) => {
      const parsedA = parseInt(a);
      const parsedB = parseInt(b);

      if (isNaN(parsedA)) return -1;
      if (isNaN(parsedB)) return 1;

      const aLabel = (system.lineGroups[a]?.label ?? '').toLowerCase();
      const bLabel = (system.lineGroups[b]?.label ?? '').toLowerCase();
      if (!aLabel) return 1;
      if (!bLabel) return -1
      return aLabel < bLabel ? -1 : 1;
    })

    let elems = [];
    for (const groupId of sortedGroupIds) {
      const group = system.lineGroups[groupId] ?
                      system.lineGroups[groupId] :
                      {
                        id: groupId, // this will be a mode
                        label: getMode(groupId).label
                      };

      elems.push(<LineGroup key={groupId}
                            viewOnly={viewOnly}
                            focus={focus}
                            groupsDisplayed={groupsDisplayed}
                            lineElems={buildLineElemsForGroup(system.lines, groupedLineIds[groupId], groupId)}
                            isCustom={system.lineGroups[groupId] ? true : false}
                            group={group}
                            groupIds={groupIds}
                            setGroupsDisplayed={setGroupsDisplayed}
                            onLineGroupInfoChange={onLineGroupInfoChange}
                            onLineGroupDelete={onLineGroupDelete}
                            onAddLine={onAddLine}
                            onLineClick={onLineClick} />);
    }

    if (!viewOnly) {
      elems.push((
        <button className="LineButtons-addNewGroup" key="addNewGroup"
                onClick={() => onAddLineGroup()}>
          <i className="fas fa-plus"></i>
          <div className="LineButtons-addNewGroupText">Add custom line group</div>
        </button>
      ));
    }

    return elems;
  }, [
    focus?.line,
    focus?.line?.id && system.lines[focus.line.id]?.name,
    focus?.line?.id && system.lines[focus.line.id]?.color,
    focus?.line?.id && system.lines[focus.line.id]?.lineGroupId,
    groupedLineIds,
    groupsDisplayed,
    viewOnly,
    onLineClick,
    onAddLine,
    onAddLineGroup
  ]);

  return (
    <ol className={['LineButtons', ...extraClasses].join(' ')}>
      <div className="LineButtons-groups">
        {groupElems}
      </div>
    </ol>
  );
}
