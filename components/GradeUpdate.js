import React from 'react';

import { Modal } from '/components/Modal.js';

export function GradeUpdate({ station,
                              waypointIds,
                              open,
                              onStationsGradeChange,
                              onClose }) {

  const handleGradeSelection = (grade) => {
    if (waypointIds?.length) {
      onStationsGradeChange(waypointIds, grade);
    } else {
      if (station?.grade !== grade) {
        onStationsGradeChange([ station.id ], grade);
      }
    }
    onClose();
  }

  const renderMain = () => {
    const currGrade = station?.grade ?? '';

    let name = 'Station Name';
    if (station?.isWaypoint) name = 'Waypoint';
    else if (station?.name) name = station.name;
    else if (waypointIds?.length === 1) name = '1 waypoint';
    else if (waypointIds?.length > 1) name = `${waypointIds.length} waypoints`

    return (
      <div className="GradeUpdate-main">
        <div className="GradeUpdate-name">
          {name}
        </div>

        <div className="GradeUpdate-options">
          <button className={`GradeUpdate-option GradeUpdate-option--above GradeUpdate-option--${currGrade === 'above' ? 'selected' : 'unselected'}`}
                  onClick={() => handleGradeSelection('above')}>
            Above grade
          </button>
          <button className={`GradeUpdate-option GradeUpdate-option--at GradeUpdate-option--${currGrade === 'at' ? 'selected' : 'unselected'}`}
                  onClick={() => handleGradeSelection('at')}>
            At grade
          </button>
          <button className={`GradeUpdate-option GradeUpdate-option--below GradeUpdate-option--${currGrade === 'below' ? 'selected' : 'unselected'}`}
                  onClick={() => handleGradeSelection('below')}>
            Below grade
          </button>
        </div>

        <div className="GradeUpdate-help">
          What is grade?
          <i className="far fa-circle-question"
             data-tooltip-content="Grade is ground level. A station can be below ground, at ground level, or elevated above ground">
          </i>
        </div>
      </div>
    )
  }

  return (
    <Modal baseClass='GradeUpdate' open={open}
           heading={'Change Grade'}
           content={renderMain()}
           onClose={onClose} />
  )
}
