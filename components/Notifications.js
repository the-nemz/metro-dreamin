import React, { useContext, useState, useEffect } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';
import classNames from 'classnames';

import { renderFadeWrap } from '/util/helpers.js';
import { FirebaseContext } from '/util/firebase.js';
import { NotificationContext } from '/util/notificationProvider.js';

import { Notif } from '/components/Notif.js';

export const Notifications = () => {
  const [ isPulsed, setIsPulsed ] = useState(false);

  const { notifications, newCount, isOpen, setIsOpen } = useContext(NotificationContext);
  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setIsPulsed(currPulse => !currPulse);
    }, 1000);

    return () => clearInterval(pulseInterval);
  }, []);

  const renderTray = () => {
    if (firebaseContext.user && isOpen) {
      const fallback = (
        <div className="Notifications-none">
          You're all caught up!
        </div>
      );

      let renderedNotifs = [];
      for (const notif of (notifications || [])) {
        renderedNotifs.push(
          <Link className={classNames('Notifications-item', { 'Notifications-item--viewed': notif.viewed })}
                key={notif.timestamp} href={notif.destination}
                onClick={() => ReactGA.event({ category: 'Notifications', action: `Click ${notif.type}`, label: notif.destination })}>
            <Notif notif={notif} />
          </Link>
        );
      }
      return(
        <div className="Notifications-tray FadeAnim">
          <h2 className="Notifications-heading">
            Notifications
          </h2>
          <div className="Notifications-items">
            {renderedNotifs.length ? renderedNotifs : fallback}
          </div>
          <button className="Notifications-overlay"
                  onClick={() => {
                    setIsOpen(false);
                    ReactGA.event({ category: 'Notifications', action: 'Close by Overlay' })
                  }}>
          </button>
        </div>
      );
    } else {
      return '';
    }
  }

  const renderButton = () => {
    const buttonClasses = classNames('Notifications-notifsButton', 'ViewHeaderButton', {
                            'Notifications-notifsButton--hasCount': (newCount || 0) > 0,
                            'Notifications-notifsButton--pulsed': isPulsed
                          });
    const countClasses = classNames('Notifications-count', 'Notifications-count--view');

    return (
      <button className={buttonClasses}
              onClick={() => {
                setIsOpen(curr => {
                  const notCurr = !curr;
                  ReactGA.event({
                    category: 'Header',
                    action: notCurr ? 'Open Notifications' : 'Close Notifications'
                  });
                  return notCurr;
                });
              }}>
        <i className="fas fa-bell"></i>
        {newCount ? <span className={countClasses}>{newCount >= 9 ? '9+' : newCount}</span> : ''}
      </button>
    );
  };

  return (
    <div className="Notifications">
      {renderButton()}
      {renderFadeWrap(renderTray(), 'notifications')}
    </div>
  );
}
