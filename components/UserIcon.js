import React, { useState, useEffect } from 'react';

import { getUserIcon, getUserColor, getLuminance, getIconDropShadow } from '/util/helpers.js';

export const UserIcon = ({ className, userDocData = {} }) => {
  const [icon, setIcon] = useState();
  const [color, setColor] = useState();
  const [shadow, setShadow] = useState();

  useEffect(() => {
    if (userDocData) {
      const clr = getUserColor(userDocData);
      setIcon(getUserIcon(userDocData))
      setColor(clr)
      setShadow(getIconDropShadow(getLuminance(clr.color) > 128 ? 'dark' : 'light'))
    }
  }, [userDocData]);

  if (!icon || !color) {
    return <></>;
  }

  const iconClasses = className ? [...className.split(' '), 'UserIcon'] : ['UserIcon'];
  return (
    <img className={iconClasses.join(' ')}
         src={icon.path}
         alt={icon.icon.alt}
         style={{ filter: `${color.filter} ${shadow}` }} />
  );
}
