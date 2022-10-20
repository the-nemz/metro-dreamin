import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import ReactGA from 'react-ga';
import ReactTooltip from 'react-tooltip';

import { FirebaseContext } from "../firebaseContext.js";

export function Settings(props) {
  const [usernameShown, setUsernameShown] = useState('');

  const firebaseContext = useContext(FirebaseContext);

  const usernameChanged = (firebaseContext.settings.displayName || '') !== usernameShown;

  useEffect(() => {
    ReactTooltip.rebuild();
    ReactGA.event({
      category: 'Settings',
      action: 'Open'
    });
  }, []);

  useEffect(() => {
    setUsernameShown(firebaseContext.settings.displayName ? firebaseContext.settings.displayName : 'Anon');
  }, [firebaseContext.settings.displayName]);

  const renderToggle = (classModifier, settingTitle, onClick, toggleTip, isOn, toggleText, settingTip = '') => {
    return (
      <div className={`Settings-setting Settings-setting--${classModifier}`}>
        <div className="Settings-settingTitle">
          {settingTitle}
          {settingTip ? <i className="far fa-question-circle"
                          data-tip={settingTip}>
                        </i>
                      : ''}
        </div>
        <button className={`Settings-toggleButton Settings-toggleButton--${classModifier} Link`}
                onClick={onClick}
                data-tip={toggleTip}>
          <div className={`Settings-toggler${isOn ? ' Settings-toggler--on' : ''}`}>
            <div className="Settings-toggleSlider"></div>
          </div>
          <div className="Settings-toggleText">
            {toggleText}
          </div>
        </button>
      </div>
    );
  }

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
        <button className="Settings-submitButton" type="submit" data-tip={usernameChanged ? 'Save username' : 'Username is saved'}>
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
      <Link className="Settings-signUp Button--primary" to={'/view'} target="_blank" rel="nofollow noopener noreferrer"
             onClick={() => ReactGA.event({ category: 'Settings', action: 'Sign In' })}>
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
                onClick={() => {
                          ReactTooltip.hide();
                          props.onToggleShowSettings(false);
                        }}>
          <i className="fas fa-times-circle"></i>
        </button>

        <div className="Settings-heading">
          Settings
        </div>

        <div className="Settings-content">
          {firebaseContext.user ? nameElem : signUpElem}

          {renderToggle('theme',
                        'Theme',
                        () => props.onToggleTheme(firebaseContext.settings.lightMode ? false : true),
                        firebaseContext.settings.lightMode ? 'Turn on Dark Mode' : 'Turn off Dark Mode',
                        firebaseContext.settings.lightMode ? false : true,
                        `Dark Mode ${firebaseContext.settings.lightMode ? 'Off' : 'On'}`)}

          {renderToggle('performance',
                        'Performance',
                        () => props.onTogglePerformance(firebaseContext.settings.lowPerformance ? false : true),
                        firebaseContext.settings.lowPerformance ? 'Use High Performance' : 'Use Low Performance',
                        firebaseContext.settings.lowPerformance ? false : true,
                        `${firebaseContext.settings.lowPerformance ? 'Low Performance' : 'High Performance'}`,
                        'Toggle animations like the moving vehicles to improve performance on large maps or slow devices')}

          {firebaseContext.user ? signOutElem : ''}
        </div>
      </div>
    </div>
  )
}
