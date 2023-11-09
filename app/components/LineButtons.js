import React, { useEffect, useMemo } from 'react';
import ReactTooltip from 'react-tooltip';
import classNames from 'classnames';

import { sortLines, getLuminance } from '/lib/util.js';

export const LineButtons = ({ extraClasses = [], system, focus, viewOnly, onLineClick, onAddLine }) => {

  const sortedLineIds = useMemo(() => {
    return Object.values(system.lines).sort(sortLines).map(l => l.id);
  }, [
    Object.keys(system.lines).join(),
    focus?.line?.id && system.lines[focus.line.id]?.name
  ]);

  const itemElems = useMemo(() => {
    let lineElems = [];

    for (const lineId of sortedLineIds) {
      const color = system.lines[lineId].color;
      const name = system.lines[lineId].name;
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
                  onClick={onAddLine}>
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
  }, [
    sortedLineIds,
    focus.line?.id,
    focus.line?.id && system.lines?.[focus.line.id]?.color,
    focus.line?.id && system.lines?.[focus.line.id]?.name
  ]);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  return (
    <ol className={['LineButtons', ...extraClasses].join(' ')}>
      {itemElems}
    </ol>
  );
}
