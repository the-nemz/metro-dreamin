import React, { useEffect, useState, useRef, useCallback } from 'react';
import ReactTooltip from 'react-tooltip';
import TextareaAutosize from 'react-textarea-autosize';
import classNames from 'classnames';

export function Description({ description, viewOnly, fallback = '', placeholder = '', onDescriptionChange = (input) => {} }) {
  const textareaRef = useRef(null)
  
  const [input, setInput] = useState(description);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  useEffect(() => {
    if (!viewOnly) {
      // workaround because TextareaAutosize doesn't update when initial input is multiline
      // trailing newlines are stripped on submit
      setInput(description + '\n');
    } else {
      setInput(description);
    }
  }, [viewOnly]);

  useEffect(() => {
    setInput(description);
  }, [description]);

  const handleDescriptionChange = (e) => {
    onDescriptionChange(e.target.value);
    setInput(e.target.value);
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    onDescriptionChange(e.target.value);
    setInput(e.target.value);
    document.activeElement.blur();
  }

  const renderForm = () => {
    return (
      <form className="Description-inputForm"
            onSubmit={handleSubmit}>
        <TextareaAutosize className="Description-textarea" ref={textareaRef}
                          value={input} placeholder={placeholder}
                          onChange={handleDescriptionChange} />
        <i className="fas fa-pen"></i>
      </form>
    );
  }

  const renderContent = () => {
    return (
      <div className="Description-content">
        {description ? description : fallback}
      </div>
    );
  }

  return (
    <div className={classNames('Description', { 'Description--viewOnly': viewOnly })}>
      {viewOnly ? renderContent() : renderForm()}
    </div>
  );
}
