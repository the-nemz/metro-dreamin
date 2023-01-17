import React, { useState, useContext, useRef, useCallback } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import TextareaAutosize from 'react-textarea-autosize';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

import { Comment } from '/components/Comment.js';

export const Comments = ({ commentData, systemId, ownerUid, onToggleShowAuth }) => {
  const firebaseContext = useContext(FirebaseContext);
  const textareaRef = useRef(null)

  const [input, setInput] = useState('');

  const handleChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  const handleAddComment = async (e) => {
    e.preventDefault();

    if (!firebaseContext.user) {
      onToggleShowAuth(true);
      return;
    }

    try {
      const commentsCollection = collection(firebaseContext.database, `systems/${systemId}/comments`);
      await addDoc(commentsCollection, {
        userId: firebaseContext.user.uid,
        content: input,
        systemId: systemId,
        timestamp: Date.now()
      });

      ReactGA.event({
        category: 'Comments',
        action: 'Add'
      });

      setInput('');
    } catch (e) {
      console.log('Unexpected Error:', e)
    }
  }

  const renderComments = () => {
    let commentElems = [];

    for (const comment of commentData.comments) {
      commentElems.push((
        <li className="Comments-item" key={comment.id}>
          <Comment comment={comment}
                   isCurrentUser={firebaseContext.user && firebaseContext.user.uid === comment.userId}
                   isOwner={ownerUid === comment.userId} />
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
