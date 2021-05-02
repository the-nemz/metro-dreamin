import React, { useContext } from 'react';
import classNames from "classnames";

import { FirebaseContext } from "../firebaseContext.js";

import logo from '../../assets/logo.svg';
import logo_bordered from '../../assets/logo-inverted.svg';

export const Notif = (props) => {

  const firebaseContext = useContext(FirebaseContext);

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
            <img src={firebaseContext.settings.lightMode ? logo_bordered : logo} alt="Metro Dreamin' logo" />
          </div>
        );
    }
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
      content = content.replaceAll(`[[${replaceKey}]]`, replacer);
    }

    return (
      <div className="Notif-content">
        {renderIcon()}
        <div className="Notif-text" dangerouslySetInnerHTML={{__html: content}}></div>
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
