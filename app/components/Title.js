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

    const trimmedInput = input.trim();
    if (trimmedInput && trimmedInput !== title) onGetTitle(trimmedInput);
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
    const text = title ? title : fallback
    return (
      <h1 className="Title-heading" data-tip={text}>
        {text}
      </h1>
    );
  }

  return (
    <div className={classNames('Title', { 'Title--viewOnly': viewOnly })}>
      {viewOnly ? renderHeading() : renderInput()}
    </div>
  );
}
