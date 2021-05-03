import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import ReactGA from 'react-ga';

import { FirebaseContext } from "../firebaseContext.js";

export function Settings(props) {
  const [usernameShown, setUsernameShown] = useState('');

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    ReactGA.event({
      category: 'Settings',
      action: 'Open'
    });
  }, []);

  useEffect(() => {
    setUsernameShown(firebaseContext.settings.displayName ? firebaseContext.settings.displayName : 'Anon');
  }, [firebaseContext.settings.displayName]);

  const usernameChanged = (firebaseContext.settings.displayName || '') !== usernameShown;

  const handleUsernameChanged = (e) => {
    e.preventDefault();
    if (usernameChanged) {
      props.onUpdateDisplayName(usernameShown);
    }
  }

  const nameElem = (
    <div className="Settings-setting Settings-setting--name">
      <div className="Settings-settingTitle">
        Username
      </div>
      <form className="Settings-username Settings-username--input" onSubmit={handleUsernameChanged}>
        <input className="Settings-usernameInput Settings-username--input" type="text" value={usernameShown}
              onChange={(e) => { setUsernameShown(e.target.value) }}
        />
        <button className="Settings-submitButton" type="submit">
          {usernameChanged ? <i className="far fa-save fa-fw"></i> : <i className="far fa-check-circle"></i>}
        </button>
      </form>
    </div>
  );

  const signUpElem = (
    <div className="Settings-setting Settings-setting--signIn">
      <div className="Settings-settingTitle">
        Hello, Anon
      </div>
      <Link className="Settings-signUp Button--primary" to={'/view'} onClick={() => props.onToggleShowSettings(false)}>
        Sign in
      </Link>
    </div>
  );

  const signOutElem = (
    <div className="Settings-setting Settings-setting--signOut">
      <button className="Settings-signOut Link" onClick={() => props.signOut()}>
        Sign Out
      </button>
    </div>
  );

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
          {firebaseContext.user ? nameElem : signUpElem}

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

          {firebaseContext.user ? signOutElem : ''}
        </div>
      </div>
    </div>
  )
}
