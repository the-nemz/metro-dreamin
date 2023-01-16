import React, { useState, useContext, useRef, useEffect, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

import { FirebaseContext } from '/lib/firebase.js';

import { Comment } from '/components/Comment.js';

export const Comments = ({ commentData }) => {
  const firebaseContext = useContext(FirebaseContext);
  const textareaRef = useRef(null)

  const [input, setInput] = useState('');

  const handleChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  const handleAddComment = (e) => {
    e.preventDefault();
    alert('TODO' + input); // TODO: add comment
  }

  const renderComments = () => {
    let commentElems = [];

    for (const comment of commentData.comments) {
      commentElems.push((
        <li className="Comments-item" key={`${comment.userId}|${comment.timestamp}`}>
          <Comment comment={comment} />
        </li>
      ))
    }

    return <ol className="Comments-list">
      {commentElems}
    </ol>;
  }

  return (
    <div className="Comments SystemSection">
      <h2 className="Comments-heading">
        {commentData.commentsLoaded ? `${commentData.comments.length} ` : ''}{commentData.comments.length === 1 ? 'Comment' : 'Comments'}
      </h2>

      <form className="Comments-new" onSubmit={handleAddComment}>
        <TextareaAutosize className="Comments-textarea" ref={textareaRef} value={input}
                          onChange={handleChange} />
        <button className="Comments-submit Button--primary" type="submit" disabled={input === ''}>
          Comment
        </button>
      </form>

      {commentData.commentsLoaded && renderComments()}
    </div>
  );
}
