import React from 'react';
import { useNotifications } from '/util/hooks.js';

export const NotificationContext = React.createContext({});

export const NotificationProvider = ({ children }) => {
  const notificationProps = useNotifications();

  return (
    <NotificationContext.Provider value={notificationProps}>
      {children}
    </NotificationContext.Provider>
  );
}
