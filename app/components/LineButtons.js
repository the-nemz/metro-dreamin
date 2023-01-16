import React, { useContext, useEffect } from 'react';
import ReactTooltip from 'react-tooltip';
import classNames from 'classnames';

import { sortLines, getLuminance } from '/lib/util.js';

export const LineButtons = ({ system, focus, onLineClick, onAddLine }) => {

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  const renderContent = () => {
    let lineElems = [];

    const lineIds = Object.values(system.lines).sort(sortLines).map(l => l.id);
    for (const lineId of lineIds) {
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

    lineElems.push((
      <li className="LineButtons-item LineButtons-item--new" key={'new'}>
        <button className="LineButtons-button LineButtons-button--new"
                data-lightcolor={false}
                onClick={() => onAddLine()}>
          <div className="LineButtons-addIcon">
            <i className="fas fa-plus"></i>
          </div>
          <div className="LineButtons-addText">
            Add new line
          </div>
        </button>
      </li>
    ));

    return lineElems;
  }

  return (
    <ol className="LineButtons SystemSection">
      {renderContent()}
    </ol>
  );
}
