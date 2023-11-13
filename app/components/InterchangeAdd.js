import React, { useEffect } from 'react';
import ReactTooltip from 'react-tooltip';

import { getDistance } from '/lib/util.js';
import { WALKING_DISTANCE, WALKING_PACE } from '/lib/constants.js';

import { Modal } from '/components/Modal.js';

export function InterchangeAdd({ station,
                                 interchangesByStationId,
                                 transfersByStationId,
                                 stations,
                                 lines,
                                 open,
                                 onAddInterchange,
                                 onClose }) {

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  const renderLines = (otherStation) => {
    const lineItems = [];

    // for (const line of Object.values(lines)) {
    //   const filteredIds = (line.stationIds || []).filter(sId => stations[sId] &&
    //                                                             !stations[sId].isWaypoint &&
    //                                                             !(line.waypointOverrides || []).includes(sId));
    //   const idsOnLine = new Set(filteredIds);

    //   if (idsOnLine.has(otherStation.id) && !idsOnLine.has(station.id)) {
    //     lineItems.push(
    //       <div className="InterchangeAdd-line" key={line.id}
    //            style={{backgroundColor: line.color}}>
    //       </div>
    //     );
    //   }
    // }

    for (const onLineKey of (transfersByStationId?.[otherStation.id]?.onLines ?? [])) {
      if (!lines[onLineKey]) continue;
      if ((lines[onLineKey].waypointOverrides || []).includes(otherStation.id)) continue;

      const currAlsoIsOnLine = (transfersByStationId?.[station.id]?.onLines ?? []).includes(onLineKey);
      if (!currAlsoIsOnLine) {
        lineItems.push(
          <div className="InterchangeAdd-line" key={onLineKey}
               style={{backgroundColor: lines[onLineKey].color}}>
          </div>
        );
      }
    }

    return <div className="InterchangeAdd-lines">
      {lineItems}
    </div>;
  }

  const renderMain = () => {
    const currentInterchange = (interchangesByStationId || {})[station.id] || {};
    const currentStationIds = new Set(currentInterchange.stationIds || []);

    let interchangeOptions = [];
    for (const potentialStation of Object.values(stations)) {
      if (!potentialStation.isWaypoint &&
          potentialStation.id !== station.id &&
          !currentStationIds.has(potentialStation.id)) {
        const distance = getDistance(potentialStation, station);
        if (distance < WALKING_DISTANCE) {
          interchangeOptions.push({ ...potentialStation, distance });
        }
      }
    }

    let content;
    if (interchangeOptions.length === 0) {
      content = (
        <div className="InterchangeAdd-noneNearby">
          No {currentStationIds.size ? 'other ' : ''}stations nearby.
        </div>
      )
    } else {
      const sortedOptions = interchangeOptions.sort((a, b) => a.distance - b.distance);

      content = (
        <ul className="InterchangeAdd-options">
          {sortedOptions.map(otherStation => (
            <li className="InterchangeAdd-option" key={otherStation.id}>
              <button className="InterchangeAdd-addButton"
                      onClick={() => onAddInterchange(otherStation)}>
                <div className="InterchangeAdd-stationName">
                  {otherStation.name}
                </div>

                <div className="InterchangeAdd-walkTime">
                  ({ Math.round(WALKING_PACE * otherStation.distance) } min)
                </div>

                {renderLines(otherStation)}
              </button>
            </li>
          ))}
        </ul>
      );
    }

    return (
      <div className="InterchangeAdd-main">
        {content}
      </div>
    )
  }

  return (
    <Modal baseClass='InterchangeAdd' open={open}
           heading={'Add Walking Connection'}
           content={renderMain()}
           onClose={onClose} />
  )
}
