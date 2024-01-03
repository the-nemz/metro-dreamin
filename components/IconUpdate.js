import React, { useState } from 'react';
import ReactGA from 'react-ga4';

import { getUserIcon, getUserColor, getIconDropShadow, getLuminance } from '/lib/util.js';
import { USER_ICONS, COLOR_TO_FILTER } from '/lib/constants.js';

import { Modal } from '/components/Modal';

export function IconUpdate({ open, currColor, currShadow, onComboSelected, onClose }) {
  const [showColors, setShowColors] = useState(false);
  const [iconKeySelected, setIconKeySelected] = useState();

  const clearAndClose = () => {
    setShowColors(false);
    setIconKeySelected(null);
    onClose();

    ReactGA.event({
      category: 'User',
      action: 'Cancel Icon Update'
    });
  }

  const renderColors = () => {
    let colorElems = [];

    const icon = getUserIcon({ icon: { key: iconKeySelected } });
    for (const hex in COLOR_TO_FILTER) {
      const color = getUserColor({ icon: { color: hex } });
      const shadow = getIconDropShadow(getLuminance(color.color) > 128 ? 'dark' : 'light');
      colorElems.push(
        <button className="IconUpdate-colorButton" key={hex}
                onClick={() => {
                  onComboSelected({ key: iconKeySelected, color: hex });
                  setShowColors(false);
                  setIconKeySelected(null);

                  ReactGA.event({
                    category: 'User',
                    action: 'Select Icon Color'
                  });
                }}>
          <img className="IconUpdate-icon" src={icon.path} alt={icon.icon.alt}
              style={{ filter: `${color.filter} ${shadow}` }} />
        </button>
      )
    }

    return (
      <div className="IconUpdate-colors">
        {colorElems}
      </div>
    );
  }

  const renderIcons = () => {
    let iconElems = [];

    for (const iconKey in USER_ICONS) {
      const icon = getUserIcon({ icon: { key: iconKey } });
      iconElems.push(
        <button className="IconUpdate-iconButton" key={iconKey}
                onClick={() => {
                  setIconKeySelected(iconKey);
                  setShowColors(true);

                  ReactGA.event({
                    category: 'User',
                    action: 'Select Icon Image'
                  });
                }}>
          <img className="IconUpdate-icon" src={icon.path} alt={icon.icon.alt}
              style={{ filter: `${currColor.filter} ${currShadow}` }} />
        </button>
      )
    }

    return (
      <div className="IconUpdate-icons">
        {iconElems}
      </div>
    );
  }

  const renderMain = () => {
    return (
      <div className="IconUpdate-main">
        {showColors ? renderColors() : renderIcons()}

        <button className="IconUpdate-cancel Link"
                onClick={clearAndClose}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <Modal baseClass='IconUpdate' open={open}
           heading={showColors ? 'Choose a Color' : 'Choose an Icon'}
           content={renderMain()}
           onClose={clearAndClose} />
  )
}
