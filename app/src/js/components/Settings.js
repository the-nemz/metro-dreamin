import React, { useState, useEffect, useContext } from 'react';

import { FirebaseContext } from "../firebaseContext.js";

export function Settings(props) {
  const [usernameShown, setUserNameShown] = useState('Anon');

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    setUserNameShown(firebaseContext.settings.displayName);
  }, [firebaseContext.settings.displayName]);

  return (
    <div className={`Settings FadeAnim ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`}>
      <div className="Settings-container">
        <button className="Settings-close" data-tip="Close settings"
                onClick={() => props.onToggleShowSettings(false)}>
          <i className="fas fa-times-circle"></i>
        </button>

        <div className="Settings-heading">
          Settings
        </div>

        <div className="Settings-content">
          <div className="Settings-setting Settings-setting--name">
            <div className="Settings-settingTitle">
              Username
            </div>
            <input className="Settings-username Settings-username--input" type="text" value={usernameShown}
                  onChange={(e) => { setUserNameShown(e.target.value) }}
                  // TODO: actually save edited username
                  onBlur={(e) => {}}>
            </input>
          </div>

          <div className="Settings-setting Settings-setting--theme">
            <div className="Settings-settingTitle">
              Theme
            </div>
            <button className="Settings-toggleButton Settings-toggleButton--theme Link"
                    onClick={() => props.onToggleTheme(firebaseContext.settings.lightMode ? false : true)}
                    data-tip={'add tip'}>
              <div className={`Settings-toggler${firebaseContext.settings.lightMode ? '' : ' Settings-toggler--on'}`}>
                <div className="Settings-toggleSlider"></div>
              </div>
              <div className="Settings-toggleText">
                Dark Mode {firebaseContext.settings.lightMode ? 'Off' : 'On'}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
