import React, { useState, useContext, useCallback, forwardRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import TextareaAutosize from 'react-textarea-autosize';
import ReactGA from 'react-ga4';

import { FirebaseContext } from '/lib/firebase.js';

import { Comment } from '/components/Comment.js';

export const Comments = forwardRef(({ commentData, systemId, ownerUid, commentsCount, onToggleShowAuth }, textareaRef) => {
  const firebaseContext = useContext(FirebaseContext);

  const [input, setInput] = useState('');

  const handleChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  const handleAddComment = async (e) => {
    e.preventDefault();

    if (!firebaseContext.user) {
      onToggleShowAuth(true);
      ReactGA.event({ category: 'System', action: 'Unauthenticated Comment' });
      return;
    }

    const commentContent = input.replace(/^\n+/, '').replace(/\n+$/, '');
    if (!commentContent) return;

    try {
      const commentsCollection = collection(firebaseContext.database, `systems/${systemId}/comments`);
      await addDoc(commentsCollection, {
        userId: firebaseContext.user.uid,
        content: commentContent,
        systemId: systemId,
        timestamp: Date.now()
      });

      ReactGA.event({
        category: 'System',
        action: 'Add Comment'
      });

      setInput('');
    } catch (e) {
      console.log('handleAddComment error:', e)
    }
  }

  const getHeadingText = () => {
    const numComments = Math.max((commentData.comments || []).length, commentsCount);
    if (!commentData.commentsLoaded || !numComments) {
      return 'Comments';
    } else if (numComments === 1) {
      return '1 Comment';
    } else {
      return `${numComments} Comments`;
    }
  }

  const renderComments = () => {
    if (!(commentData.comments || []).length) {
      return <div className="Comments-none">
        No comments yet. Add one!
      </div>
    }

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
        {getHeadingText()}
      </h2>

      <form className="Comments-new" onSubmit={handleAddComment}>
        <TextareaAutosize className="Comments-textarea" ref={textareaRef}
                          value={input} placeholder="Add a comment..."
                          onChange={handleChange} />
        <button className="Comments-submit Button--primary" type="submit" disabled={input.trim() === ''}>
          Comment
        </button>
      </form>

      {commentData.commentsLoaded && renderComments()}

      {commentData.commentsLoaded && !commentData.showAllComments && (
        <button className="Comments-showAll"
                onClick={() => {
                  commentData.setShowAllComments(true);
                  ReactGA.event({
                    category: 'System',
                    action: 'Show All Comments'
                  });
                }}
        >
          <i className="fas fa-chevron-circle-down"></i>
          <span className="Comments-allText">Show all comments</span>
        </button>
      )}
    </div>
  );
});
