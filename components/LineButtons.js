import React, { useMemo } from 'react';
import classNames from 'classnames';

import { DEFAULT_LINE_MODE } from '/util/constants.js';
import { sortLines, getLuminance, getMode } from '/util/helpers.js';

import { LineGroup } from '/components/LineGroup.js';

export const LineButtons = ({
  extraClasses = [],
  system,
  focus,
  groupsDisplayed,
  viewOnly,
  setGroupsDisplayed,
  onLineClick,
  onAddLine
}) => {

  const buildLineElemsForGroup = (lines, lineIds, mode) => {
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
            <div className="LineButtons-linePrev" style={{ backgroundColor: color }}></div>
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
                  onClick={() => onAddLine({ mode })}>
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
    return sortedLines.reduce((groups, line) => {
      const modeKey = getMode(line.mode).key;
      if (!groups[modeKey]?.length) {
        groups[modeKey] = [];
      }
      groups[modeKey].push(line.id);
      return groups;
    }, {});
  }, [
    Object.keys(system.lines).join(),
    focus?.line,
    focus?.line?.id && system.lines[focus.line.id]?.name,
    focus?.line?.id && system.lines[focus.line.id]?.color,
    focus?.line?.id && system.lines[focus.line.id]?.mode
  ]);

  const groupElems = useMemo(() => {
    const sortedLines = Object.values(system.lines || {}).sort(sortLines);
    const groupedLineIds = sortedLines.reduce((groups, line) => {
      const modeKey = getMode(line.mode).key;
      if (!groups[modeKey]?.length) {
        groups[modeKey] = [];
      }
      groups[modeKey].push(line.id);
      return groups;
    }, {});

    const groupIds = Object.keys(groupedLineIds);

    // if there are no groups because there are no lines
    if (groupIds.length === 0) {
      groupedLineIds[DEFAULT_LINE_MODE] = [];
      groupIds.push(DEFAULT_LINE_MODE);
    }

    let elems = [];
    for (const mode of groupIds.sort()) {
      elems.push(<LineGroup key={mode}
                            viewOnly={viewOnly}
                            focus={focus}
                            groupsDisplayed={groupsDisplayed}
                            lines={system.lines}
                            group={{
                              mode: mode,
                              lineElems: buildLineElemsForGroup(system.lines, groupedLineIds[mode], mode)
                            }}
                            groupIds={groupIds}
                            setGroupsDisplayed={setGroupsDisplayed}
                            onAddLine={onAddLine}
                            onLineClick={onLineClick} />);
    }

    return elems;
  }, [groupedLineIds, groupsDisplayed]);

  return (
    <ol className={['LineButtons', ...extraClasses].join(' ')}>
      <div className="LineButtons-groups">
        {groupElems}
      </div>
    </ol>
  );
}
