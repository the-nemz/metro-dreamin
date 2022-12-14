import React, { useEffect, useContext } from 'react';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';
import { useTheme } from '/lib/hooks.js';
import { renderFadeWrap } from '/lib/util.js';

export function Modal({ animKey = 'modal',
                        baseClass = 'Modal',
                        open = false,
                        heading = '',
                        content = <></>,
                        onClose = () => {} }) {

  const firebaseContext = useContext(FirebaseContext);
  const { themeClass } = useTheme();

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  const renderModal = () => {
    if (!open) return;

    const classNames = ['Modal', 'FadeAnim', baseClass, themeClass];
    return (
      <div className={classNames.join(' ')}>
        <div className={`${baseClass}-container Modal-container`}>
          <button className={`${baseClass}-close Modal-close`} data-tip={`Close`}
                  onClick={() => {
                            ReactTooltip.hide();
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
                  ReactTooltip.hide();
                  onClose(false);
                  ReactGA.event({ category: 'Modal', action: 'Close by Overlay', label: baseClass });
                }}>
        </button>
      </div>
    );
  }

  return renderFadeWrap(renderModal(), animKey);
}
