import React, { useEffect, useState } from 'react';
import ReactTooltip from 'react-tooltip';
import classNames from 'classnames';

export function Title({ title, viewOnly, fallback = 'MetroDreamin\'', placeholder = 'Map title', onGetTitle = (input) => {} }) {
  const [input, setInput] = useState(title);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  useEffect(() => {
    setInput(title);
  }, [viewOnly]);

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
        <input className="Title-input" value={input} placeholder={placeholder}
              onChange={(e) => setInput(e.target.value)}
              onBlur={handleSubmit}
        />
        <i className="fas fa-pen"></i>
      </form>
    );
  }

  const renderHeading = () => {
    return (
      <h1 className="Title-heading">
        {title ? title : fallback}
      </h1>
    );
  }

  return (
    <div className={classNames('Title', { 'Title--viewOnly': viewOnly })}>
      {viewOnly ? renderHeading() : renderInput()}
    </div>
  );
}
