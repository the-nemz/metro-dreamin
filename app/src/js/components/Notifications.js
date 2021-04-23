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

  const firebaseContext = useContext(FirebaseContext);

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
          console.log(notif);
          notifs.unshift(notif);
          if (!notif.viewed) {
            unseenCount++;
          }
        }
        // setNotifications(notifs.concat(notifs).concat(notifs).concat(notifs));
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

  return (
    <div className="Notifications">
      <button className="Notifications-notifsButton ExploreHeaderButton"
              onClick={() => setIsOpen(curr => !curr)}>
        <i className="fas fa-bell"></i>
      </button>
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
