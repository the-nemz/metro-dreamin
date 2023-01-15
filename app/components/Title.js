import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';
import classNames from 'classnames';

import { FirebaseContext } from '/lib/firebase.js';
import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

import { Notifications } from '/components/Notifications.js';

export function Title({ title, viewOnly, onGetTitle }) {
  const [input, setInput] = useState(title);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  useEffect(() => {
    setInput(title);
  }, [title]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input && input !== title) onGetTitle(input);
    else setInput(title);
    document.activeElement.blur();
  }

  const renderInput = () => {
    return (
      <form className="Title-inputForm"
            onSubmit={handleSubmit}>
        <input className="Title-input" value={input} placeholder={'Map title'}
              onChange={(e) => setInput(e.target.value)}
              onBlur={handleSubmit}
        />
        <i className="fas fa-pen"></i>
        {/* <button className="Header-searchButton" type="submit" disabled={input ? false : true}>
          <i className="fas fa-search"></i>
        </button> */}
      </form>
    );
  }

  const renderHeading = () => {
    return (
      <h1 className="Title-heading">
        {title ? title : 'MetroDreamin\''}
      </h1>
    );
  }

  return (
    <div className={classNames('Title', { 'Title--viewOnly': viewOnly })}>
      {viewOnly ? renderHeading() : renderInput()}
    </div>
  );
}
