import React, { useContext, useEffect } from 'react';
import ReactTooltip from 'react-tooltip';
import classNames from "classnames";

import { FirebaseContext } from "../firebaseContext.js";

import logo from '../../assets/logo.svg';
import logo_inverted from '../../assets/logo-inverted.svg';

export const Notif = (props) => {

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  const renderIcon = () => {
    switch (props.notif.type) {
      case 'star':
        return (
          <div className="Notif-iconWrap Notif-iconWrap--star">
            <i className="fas fa-star"></i>
          </div>
        );
      default:
        return (
          <div className="Notif-iconWrap Notif-iconWrap--system">
            <img src={firebaseContext.settings.lightMode ? logo_inverted : logo} alt="Metro Dreamin' logo" />
          </div>
        );
    }
  }

  const renderTime = () => {
    const datetime = new Date(props.notif.timestamp);
    const diffTime = Date.now() - datetime.getTime();
    let timeText = datetime.toLocaleString();
    if (diffTime < 1000 * 60) {
      // in the last minute
      timeText = 'Just now!';
    } else if (diffTime < 1000 * 60 * 60) {
      // in the last hour
      const numMins = Math.round(diffTime / (1000 * 60));
      timeText = `${numMins} ${numMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffTime < 1000 * 60 * 60 * 24) {
      // in the last day
      const numHours = Math.round(diffTime / (1000 * 60 * 60));
      timeText = `${numHours} ${numHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffTime < 1000 * 60 * 60 * 24 * 7) {
      // in the last week
      const numDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      timeText = `${numDays} ${numDays === 1 ? 'day' : 'days'} ago`;
    } else {
      const numWeeks = Math.round(diffTime / (1000 * 60 * 60 * 24 * 7));
      timeText = `${numWeeks} ${numWeeks === 1 ? 'week' : 'weeks'} ago`;
    }
    return (
      <div className="Notif-time" data-tip={datetime.toLocaleString()}>
        {timeText}
      </div>
    );
  }

  const renderContent = () => {
    let content = props.notif.content.text;
    for (const [replaceKey, replaceVal] of Object.entries(props.notif.content.replacements || {})) {
      const textClasses = classNames({
        'Notif-styledText--bold': (replaceVal.styles || []).includes('bold'),
        'Notif-styledText--big': (replaceVal.styles || []).includes('big'),
        'Notif-styledText--italic': (replaceVal.styles || []).includes('italic')
      });
      const replacer = `<span class="${textClasses}">${replaceVal.text}</span>`
      content = content.split(`[[${replaceKey}]]`).join(replacer);
    }

    return (
      <div className="Notif-content">
        {renderIcon()}
        <div className="Notif-main">
          <div className="Notif-text" dangerouslySetInnerHTML={{__html: content}}></div>
          {renderTime()}
        </div>
      </div>
    );
  }

  if (!props.notif || !props.notif.content) {
    return <></>;
  }

  return (
    <div className="Notif">
      {renderContent()}
    </div>
  );
}
