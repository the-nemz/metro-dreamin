// TODO: update this for new structure
import React, { useContext } from 'react';

import { FirebaseContext } from '/lib/firebase.js';
import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

export const Auth = (props) => {
  const firebaseContext = useContext(FirebaseContext);

  return (
    <div className={props.show ? 'Auth NoPointer' : 'Auth Auth--gone'}>
      <div className="Auth-top">
        <h1 className="Auth-heading">
          <img className="Auth-logo" src={firebaseContext.settings.lightMode ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
          <div className="Auth-headingText">MetroDreamin'</div>
        </h1>
        <h2 className="Auth-description">
          Sign up or continue as a guest to build your dream transportation system.
        </h2>
      </div>
      <div id="js-Auth-container" className="Auth-container"></div>
      <button className="Auth-nosignin Link" onClick={() => props.onUseAsGuest()}>
        Continue as a guest
      </button>
    </div>
  );
}
