import React from 'react';

export function Toggle(props) {
  return (
    <button className="Toggle Link"
            onClick={props.onClick}
            data-tooltip-content={props.tip}>
      <div className={`Toggle-toggler${props.isOn ? ' Toggle-toggler--on' : ''}`}>
        <div className="Toggle-slider"></div>
      </div>
      <div className="Toggle-text">
        {props.text}
      </div>
    </button>
  )
}
