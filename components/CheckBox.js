import React from 'react';

export const CheckBox = ({ onClick, tip, isOn, text }) => {

  if (!onClick || typeof onClick !== 'function' || !text) return;

  return (
    <label className='CheckBox' data-tooltip-content={tip}>
      <span className='CheckBox-text'>{text}</span>
      <input className='CheckBox-input'
             type='checkbox'
             checked={!!isOn}
             onChange={onClick} />
      <span className='CheckBox-check' />
    </label>
  )
}
