import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, getDocs } from 'firebase/firestore';
import ReactGA from 'react-ga';
import classNames from 'classnames';

import { addAuthHeader, renderFadeWrap } from '/lib/util.js';
import { FirebaseContext } from '/lib/firebase.js';

import { Notif } from '/components/Notif.js';

export const Notifications = (props) => {
  const [ isOpen, setIsOpen ] = useState(false);
  const [ clear, setClear ] = useState(false);
  const [ notifications, setNotifications ] = useState();
  const [ newCount, setNewCount ] = useState(0);
  const [ isPulsed, setIsPulsed ] = useState(false);
  const [ elapsedSeconds, setElapsedSeconds ] = useState(0);

  const firebaseContext = useContext(FirebaseContext);

  const isViewPage = props.page === 'view';

  const fetchNotifications = (userId) => {
    const notifCollectionString = `users/${userId}/notifications`;
    const notifCollection = collection(firebaseContext.database, notifCollectionString);
    const notifQuery = query(notifCollection);
    getDocs(notifQuery).then((nCol) => {
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

  const markNotifs = async () => {
    if (isOpen && newCount) {
      const uri = `${firebaseContext.apiBaseUrl}/notifications`;
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
        // TODO: may want to incorporate prompt to save so we don't have to open a new tab
        renderedNotifs.push(
          <Link className={classNames('Notifications-item', { 'Notifications-item--viewed': notif.viewed })}
                key={notif.timestamp} href={notif.destination}
                target="_blank" rel="nofollow noopener noreferrer"
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
    const buttonClasses = classNames('Notifications-notifsButton', {
                            'ViewHeaderButton': isViewPage,
                            'DefaultHeaderButton': !isViewPage,
                            'Notifications-notifsButton--hasCount': (newCount || 0) > 0,
                            'Notifications-notifsButton--pulsed': isPulsed
                          });
    const countClasses = classNames('Notifications-count', {
                           'Notifications-count--view': isViewPage,
                           'Notifications-count--default': !isViewPage
                         });

    return (
      <button className={buttonClasses}
              onClick={() => {
                setIsOpen(curr => {
                  const notCurr = !curr;
                  ReactGA.event({
                    category: isViewPage ? 'Main' : 'Explore',
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

  const buttonClasses = classNames('Notifications', {
                          'Notifications--view': isViewPage,
                          'Notifications--default': !isViewPage
                        });
  return (
    <div className={buttonClasses}>
      {renderButton()}
      {renderFadeWrap(renderTray(), 'notifications')}
    </div>
  );
}
