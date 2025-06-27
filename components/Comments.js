import React, { useState, useContext, useCallback, forwardRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import TextareaAutosize from 'react-textarea-autosize';
import ReactGA from 'react-ga4';

import { FirebaseContext } from '/util/firebase.js';
import { displayLargeNumber, getUserDisplayName } from '/util/helpers.js';

import { Comment } from '/components/Comment.js';

export const Comments = forwardRef(({ commentData,
                                      systemId,
                                      ownerUid,
                                      commentsCount,
                                      commentsLocked,
                                      onToggleShowAuth,
                                      onToggleShowEmailVerification,
                                      onToggleCommentsLocked,
                                      handleSetToast },
                                    textareaRef) => {
  const firebaseContext = useContext(FirebaseContext);

  const [ input, setInput ] = useState('');
  const [ replyToConfig, setReplyToConfig ] = useState();
  const [ commentTimestamps, setCommentTimestamps ] = useState([]);

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

    if (!firebaseContext.user.emailVerified) {
      onToggleShowEmailVerification(true);
      ReactGA.event({ category: 'System', action: 'Unverified Email Comment' });
      return;
    }

    const commentContent = input.replace(/^\n+/, '').replace(/\n+$/, '').replace(/\n\n\n+/gm, '\n\n\n').substring(0, 10000);
    if (!commentContent) return;

    if (checkSoftRateLimitViolation()) {
      handleSetToast('Slow down!');
      return;
    }

    let commentFields = {
      userId: firebaseContext.user.uid,
      content: commentContent,
      systemId: systemId,
      timestamp: Date.now()
    }

    if (replyToConfig?.comment?.id) {
      commentFields.replyToId = replyToConfig.comment.id;
    }

    try {
      const commentsCollection = collection(firebaseContext.database, `systems/${systemId}/comments`);
      await addDoc(commentsCollection, commentFields);

      ReactGA.event({
        category: 'System',
        action: 'Add Comment'
      });

      setInput('');
      setReplyToConfig(null);
      setCommentTimestamps(currTimestamps => [ ...currTimestamps, Date.now() ]);
    } catch (e) {
      console.log('handleAddComment error:', e)
    }
  }

  // if there have been at least three comments in the past minute, block the comment
  const checkSoftRateLimitViolation = () => {
    if (commentTimestamps && commentTimestamps.length >= 3) {
      const index = commentTimestamps.length - 3;
      if (Date.now() - commentTimestamps[index] < 60_000) {
        return true;
      }
    }

    return false;
  }

  const getHeadingText = () => {
    const numComments = Math.max((commentData.comments || []).length, commentsCount);
    if (!commentData.commentsLoaded || !numComments) {
      return 'Comments';
    } else if (numComments === 1) {
      return '1 Comment';
    } else {
      return `${displayLargeNumber(numComments)} Comments`;
    }
  }

  const renderLockButton = () => {
    return (
      <button className="Comments-lockButton" onClick={onToggleCommentsLocked}>
        {commentsLocked ?
          <i className="fa-solid fa-lock" data-tooltip-content="Comments locked; tap to unlock comments"></i> :
          <i className="fa-solid fa-lock-open" data-tooltip-content="Comments unlocked; tap to lock comments"></i>}
      </button>
    );
  }

  const renderLockedMessage = () => {
    return <div className="Comments-locked">
      Comments are locked.
    </div>
  }

  const renderReplyTo = () => {
    if (!replyToConfig?.author || !replyToConfig?.comment) return;

    return (
      <div className="Comments-replyTo">
        <i className="fas fa-arrow-turn-up" />
        <div className="Comments-replyToAuthorName">{getUserDisplayName(replyToConfig.author)}</div>
        <div className="Comments-replyToContent">{replyToConfig.comment?.content ?? ''}</div>
        <button className="Comments-replyCancel" data-tooltip-content="Cancel reply"
                onClick={() => {
                  setReplyToConfig(null);

                  ReactGA.event({
                    category: 'System',
                    action: 'Cancel Reply To Comment'
                  });
                }}>
          <span className="sr-only">Cancel reply</span>
          <i className="fas fa-xmark" />
        </button>
      </div>
    )
  }

  const renderForm = () => {
    return (
      <form className="Comments-new" onSubmit={handleAddComment}>
        {renderReplyTo()}
        <TextareaAutosize className="Comments-textarea" ref={textareaRef}
                          value={input} placeholder="Add a comment..."
                          onChange={handleChange} />
        <button className="Comments-submit Button--primary" type="submit" disabled={input.trim() === ''}>
          Comment
        </button>
      </form>
    );
  }

  const renderComments = () => {
    if (!commentsLocked && !(commentData.comments || []).length) {
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
                   isOwner={ownerUid === comment.userId}
                   onReply={(replyCommentData, replyAuthorData) => {
                    if (textareaRef && textareaRef.current) {
                      textareaRef.current.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'center'
                      });

                      textareaRef.current.focus({ preventScroll: true });
                    }

                    if (replyCommentData?.id && replyAuthorData?.userId) {
                      setReplyToConfig({ comment: replyCommentData, author: replyAuthorData });
                    }
                   }}
                   onToggleShowAuth={onToggleShowAuth}
                   onToggleShowEmailVerification={onToggleShowEmailVerification} />
        </li>
      ))
    }

    return <ol className="Comments-list">
      {commentElems}
    </ol>;
  }

  return (
    <div className="Comments SystemSection">
      <div className="Comments-top">
        <h2 className="Comments-heading">
          {getHeadingText()}
        </h2>

        {!firebaseContext.authStateLoading && firebaseContext.user && firebaseContext.user.uid === ownerUid && renderLockButton()}
      </div>

      {commentsLocked ? renderLockedMessage() : renderForm()}

      {commentData.commentsLoaded && renderComments()}

      {commentData.commentsLoaded && commentData.hasMoreComments && (
        <button className="Comments-showAll"
                onClick={() => {
                  commentData.loadMoreComments();
                  ReactGA.event({
                    category: 'System',
                    action: 'Load More Comments'
                  });
                }}
        >
          <i className="fas fa-chevron-circle-down"></i>
          <span className="Comments-allText">Show more comments</span>
        </button>
      )}
    </div>
  );
});
