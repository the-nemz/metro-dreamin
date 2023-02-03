import React from 'react';

import { Modal } from '/components/Modal.js';
import { UserLink } from '/components/UserLink.js';

export function StarredBy({ starData, open, onClose }) {

  const clearAndClose = () => {
    onClose();
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
    let userElems = [];

    for (const star of starData.stars) {
      userElems.push((
        <li className="StarredBy-item" key={star.timestamp}>
          <UserLink userId={star.userId} baseClass={'StarredBy'} />
        </li>
      ));
    }

    return (
      <div className="StarredBy-main">
        <ul className="StarredBy-list">
          {userElems}
        </ul>
      </div>
    )
  }

  return (
    <Modal baseClass='StarredBy' open={open}
           heading={'Starred By'}
           content={renderMain()}
           onClose={clearAndClose} />
  )
}
