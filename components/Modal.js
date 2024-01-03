import React, { useContext } from 'react';
import ReactGA from 'react-ga4';

import { renderFadeWrap } from '/lib/util.js';
import { FirebaseContext } from '/lib/firebase.js';

export function Modal({ animKey = 'modal',
                        baseClass = 'Modal',
                        open = false,
                        heading = '',
                        content = <></>,
                        onClose = () => {} }) {

  const firebaseContext = useContext(FirebaseContext);

  const renderModal = () => {
    if (!open) return;

    const classNames = ['Modal', 'FadeAnim', baseClass, firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'];
    return (
      <div className={classNames.join(' ')}>
        <div className={`${baseClass}-container Modal-container`}>
          <button className={`${baseClass}-close Modal-close`}
                  onClick={() => {
                            onClose(false);
                            ReactGA.event({ category: 'Modal', action: 'Close by Button', label: baseClass });
                          }}>
            <i className={`fas fa-times-circle`}></i>
          </button>

          <div className={`${baseClass}-heading Modal-heading`}>
            {heading}
          </div>

          <div className={`${baseClass}-content Modal-content`}>
            {content}
          </div>
        </div>

        <button className={`${baseClass}-overlay Modal-overlay`}
                onClick={() => {
                  onClose(false);
                  ReactGA.event({ category: 'Modal', action: 'Close by Overlay', label: baseClass });
                }}>
        </button>
      </div>
    );
  }

  return renderFadeWrap(renderModal(), animKey);
}
