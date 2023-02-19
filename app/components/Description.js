import React, { useEffect, useState, useRef, useCallback } from 'react';
import ReactTooltip from 'react-tooltip';
import TextareaAutosize from 'react-textarea-autosize';
import Linkify from 'react-linkify';
import classNames from 'classnames';

export function Description({ description, viewOnly, fallback = '', placeholder = '',
                              onDescriptionChange = (input) => {},
                              onDescriptionBlur = (input) => {} }) {
  const textareaRef = useRef(null)

  const [input, setInput] = useState(description);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  useEffect(() => {
    if (!viewOnly) {
      // workaround because TextareaAutosize doesn't update when initial input is multiline
      // trailing newlines are stripped on submit
      setInput(description ? description + '\n' : description);
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
                          onBlur={() => onDescriptionBlur(input)}
                          onChange={handleDescriptionChange} />
        <i className="fas fa-pen"></i>
      </form>
    );
  }

  const renderContent = () => {
    return (
      <div className="Description-content">
        <Linkify
          componentDecorator={(decoratedHref, decoratedText, key) => (
            <a className="Link--inverse" href={decoratedHref} key={key}
               target="_blank" rel="nofollow noopener noreferrer">
              {decoratedText}
            </a>
          )}
        >
          {description ? description : fallback}
        </Linkify>
      </div>
    );
  }

  return (
    <div className={classNames('Description', { 'Description--viewOnly': viewOnly })}>
      {viewOnly ? renderContent() : renderForm()}
    </div>
  );
}
