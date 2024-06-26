import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import ReactGA from 'react-ga4';
import classNames from 'classnames';

import { FUNCTIONS_API_BASEURL } from '/util/constants.js';
import { addAuthHeader, renderFadeWrap } from '/util/helpers.js';
import { FirebaseContext } from '/util/firebase.js';

import { Notif } from '/components/Notif.js';

const MAX_NEW_NOTIFS_SHOWN = 100;
const DEFAULT_COUNT_SHOWN = 10;
const MIN_VIEWED_NOTIFS_SHOWN = 5;

export const Notifications = (props) => {
  const [ isOpen, setIsOpen ] = useState(false);
  const [ clear, setClear ] = useState(false);
  const [ notifications, setNotifications ] = useState();
  const [ newCount, setNewCount ] = useState(0);
  const [ isPulsed, setIsPulsed ] = useState(false);
  const [ elapsedSeconds, setElapsedSeconds ] = useState(0);

  const firebaseContext = useContext(FirebaseContext);

  const fetchNotifications = async (userId) => {
    const notifCollectionString = `users/${userId}/notifications`;
    const notifCollection = collection(firebaseContext.database, notifCollectionString);

    try {
      const newNotifQuery = query(notifCollection,
                                  where('viewed', '==', false),
                                  orderBy('timestamp', 'desc'),
                                  limit(MAX_NEW_NOTIFS_SHOWN));
      const newNotifCol = await getDocs(newNotifQuery);

      const viewedCountToShow = DEFAULT_COUNT_SHOWN - newNotifCol.size;
      const viewedNotifQuery = query(notifCollection,
                                     where('viewed', '==', true),
                                     orderBy('timestamp', 'desc'),
                                     limit(Math.max(viewedCountToShow, MIN_VIEWED_NOTIFS_SHOWN)));
      const viewedNotifCol = await getDocs(viewedNotifQuery);

      const notifDataToDisplay = [ ...newNotifCol.docs, ...viewedNotifCol.docs ].map(notifShot => notifShot.data());
      setNotifications(notifDataToDisplay);
      setNewCount(newNotifCol.size);
    } catch (e) {
      console.log('Unexpected Error:', e);
    }
  }

  const markNotifs = async () => {
    if (isOpen && newCount) {
      const uri = `${FUNCTIONS_API_BASEURL}/notifications`;
      let req = new XMLHttpRequest();
      req.onerror = () => console.error('Error marking notifs as viewed:', req.status, req.statusText);

      req.onload = () => {
        if (req.status !== 200) {
          console.error('Error marking notifs as viewed:', req.status, req.statusText);
          return;
        } else {
          setClear(true);

          ReactGA.event({
            category: 'Notifications',
            action: 'Send Viewed'
          });
          return;
        }
      };

      req.open('PATCH', encodeURI(uri));
      req = await addAuthHeader(firebaseContext.user, req);
      req.send();
    }
  }

  useEffect(() => {
    if (firebaseContext.user) {
      fetchNotifications(firebaseContext.user.uid);
    }
  }, [firebaseContext.user]);

  useEffect(() => {
    if (clear) {
      setNotifications((notifications || []).map(item => {
        item.viewed = true;
        return item;
      }));
      setNewCount(0);
      setClear(false);
    } else {
      markNotifs()
    }
  }, [isOpen]);

  useEffect(() => {
    if (elapsedSeconds >= 60) {
      setElapsedSeconds(0);
      if (firebaseContext.user && !isOpen) {
        fetchNotifications(firebaseContext.user.uid);
      }
    }
  }, [elapsedSeconds]);

  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setIsPulsed(currPulse => !currPulse);
      setElapsedSeconds(currSecs => currSecs + 1)
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
