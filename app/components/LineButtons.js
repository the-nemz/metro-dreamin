import React, { useContext, useEffect } from 'react';
import ReactTooltip from 'react-tooltip';
import classNames from 'classnames';

import { sortLines, getLuminance } from '/lib/util.js';

export const LineButtons = ({ system, focus, onLineClick }) => {

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  const renderContent = () => {
    let lines = [];

    for (const lineId in Object.values(system.lines).sort(sortLines)) {
      const color = system.lines[lineId].color;
      const name = system.lines[lineId].name;
      let isFocused = focus && focus.line && focus.line.id === lineId;

      lines.push((
        <li className={classNames('LineButtons-item', { 'LineButtons-item--focused': isFocused })} key={lineId}>
          <button className="LineButtons-button" key={lineId}
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

    return lines;
  }

  return (
    <ol className="LineButtons">
      {renderContent()}
    </ol>
  );
}
