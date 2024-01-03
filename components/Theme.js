import React, { useContext } from 'react';

import { FirebaseContext } from '/util/firebase.js';

export const Theme = (props) => {
  const firebaseContext = useContext(FirebaseContext);

  return (
    <div className={`Theme ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`}>
      {props.children}
    </div>
  );
}
