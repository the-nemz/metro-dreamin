import React, { useContext, useEffect } from 'react';
import ReactTooltip from 'react-tooltip';
import classNames from 'classnames';

import { timestampToText } from '/lib/util.js';
import { FirebaseContext } from '/lib/firebase.js';
import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

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
            <img src={firebaseContext.settings.lightMode ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
          </div>
        );
    }
  }

  const renderTime = () => {
    const datetime = new Date(props.notif.timestamp);
    return (
      <div className="Notif-time" data-tip={datetime.toLocaleString()}>
        {timestampToText(props.notif.timestamp)}
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
