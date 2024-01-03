import React from 'react';

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

  const renderLines = (otherStation) => {
    const lineItems = [];
    for (const onLine of (transfersByStationId?.[otherStation.id]?.onLines ?? [])) {
      if (!onLine?.lineId || !lines[onLine.lineId]) continue;
      if ((lines[onLine.lineId].waypointOverrides || []).includes(otherStation.id)) continue;
      if ((interchangesByStationId?.[station.id]?.hasLines ?? []).includes(onLine.lineId)) continue;

      const currAlsoIsOnLine = (transfersByStationId?.[station.id]?.onLines ?? []).find(oL => (oL?.lineId ?? '') === onLine.lineId);
      if (!currAlsoIsOnLine) {
        lineItems.push(
          <div className="InterchangeAdd-line" key={onLine.lineId}
               style={{backgroundColor: lines[onLine.lineId].color}}>
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
