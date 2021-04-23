import React, { useState, useContext, useEffect } from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import { Link } from 'react-router-dom';
import classNames from "classnames";

import { FirebaseContext } from "../firebaseContext.js";
import { Notif } from './Notif.js';

export const Notifications = (props) => {
  const [ isOpen, setIsOpen ] = useState(false);
  const [ notifications, setNotifications ] = useState();
  const [ newCount, setNewCount ] = useState(0);
  const [ isPulsed, setIsPulsed ] = useState(false);

  const firebaseContext = useContext(FirebaseContext);

  const isViewPage = props.page === 'view';

  const fetchNotifications = async (userId) => {
    console.log('fetchNotifications')
    const notifCollectionString = `users/${userId}/notifications`;
    let notifCollection = firebaseContext.database.collection(notifCollectionString);
    notifCollection.get().then((nCol) => {
      if (nCol && (nCol.docs || []).length) {
        let notifs = [];
        let unseenCount = 0;
        for (const notifShot of nCol.docs) {
          const notif = notifShot.data();
          notifs.unshift(notif);
          if (!notif.viewed) {
            unseenCount++;
          }
        }

        setNotifications(notifs);
        setNewCount(unseenCount);
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });
  }

  useEffect(() => {
    if (firebaseContext.user) {
      fetchNotifications(firebaseContext.user.uid)
    }
  }, [firebaseContext.user]);

  useEffect(() => {
    setInterval(() => setIsPulsed(curr => !curr), 1000)
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
          <Link className={classNames('Notifications-item', { 'Notifications-item--viewed': notif.viewed })} key={notif.timestamp}
                to={notif.destination}
                onClick={() => console.log(notif)}>
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
                  }}>
          </button>
        </div>
      );
    } else {
      return '';
    }
  }

  const renderButton = () => {
    const buttonClasses = classNames('Notifications-notifsButton', {
                            'ViewHeaderButton': isViewPage,
                            'DefaultHeaderButton': !isViewPage,
                            'Notifications-notifsButton--hasCount': newCount || 0 > 0,
                            'Notifications-notifsButton--pulsed': isPulsed
                          });
    const countClasses = classNames('Notifications-count',
                                    { 'Notifications-count--view': props.page === 'view', 'Notifications-count--default': props.page !== 'view' });

                                    return (
      <button className={buttonClasses}
              onClick={() => setIsOpen(curr => !curr)}>
        <i className="fas fa-bell"></i>
        {newCount ? <span className={countClasses}>{newCount >= 9 ? '9+' : newCount}</span> : ''}
      </button>
    );
  };

  const buttonClasses = classNames('Notifications', {
    'Notifications--view': isViewPage,
    'Notifications--default': !isViewPage
  });
  return (
    <div className={buttonClasses}>
      {renderButton()}
      <ReactCSSTransitionGroup
          transitionName="FadeAnim"
          transitionAppear={true}
          transitionAppearTimeout={400}
          transitionEnter={true}
          transitionEnterTimeout={400}
          transitionLeave={true}
          transitionLeaveTimeout={400}>
        {renderTray()}
      </ReactCSSTransitionGroup>
    </div>
  );
}
