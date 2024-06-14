import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { doc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import ReactGA from 'react-ga4';
import Linkify from 'react-linkify';
import classNames from 'classnames';

import { timestampToText, getUserDisplayName } from '/util/helpers.js';
import { FirebaseContext, getUserDocData } from '/util/firebase.js';

import { UserIcon } from '/components/UserIcon.js';

export const Comment = ({ comment, isCurrentUser, isOwner, onReply, onToggleShowAuth }) => {
  const [authorDocData, setAuthorDocData] = useState();
  const [netVotes, setNetVotes] = useState(comment?.netVotes);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [isReported, setIsReported] = useState(false);
  const [isUpvoted, setIsUpvoted] = useState(false);
  const [isDownvoted, setIsDownvoted] = useState(false);

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (comment && comment.userId) {
      getUserDocData(comment.userId)
        .then(userDocData => setAuthorDocData(userDocData))
        .catch(e => console.log('comment author error:', e));
    }
  }, [comment.userId]);

  useEffect(() => {
    if (firebaseContext.user?.uid && comment.id && comment.systemId) {
      const voteDoc = doc(firebaseContext.database,
                          `systems/${comment.systemId}/comments/${comment.id}/votes/${firebaseContext.user.uid}`);

      getDoc(voteDoc).then((voteDocSnap) => {
        if (voteDocSnap.exists()) {
          const voteDocData = voteDocSnap.data();
          setIsUpvoted(voteDocData.direction === 'UP');
          setIsDownvoted(voteDocData.direction === 'DOWN');
        }
      });

      const reportDoc = doc(firebaseContext.database,
                            `systems/${comment.systemId}/comments/${comment.id}/reports/${firebaseContext.user.uid}`);

      getDoc(reportDoc).then((reportDocSnap) => {
        if (reportDocSnap.exists()) {
          setIsReported(true);
        }
      });
    }
  }, [ firebaseContext.user, comment.id, comment.systemId ])

  const deleteComment = () => {
    if (!comment.id) return;

    try {
      const commentDoc = doc(firebaseContext.database, `systems/${comment.systemId}/comments/${comment.id}`);
      deleteDoc(commentDoc).then(() => setIsDeleted(true));

      ReactGA.event({
        category: 'System',
        action: 'Delete Comment'
      });
    } catch (e) {
      console.log('Unexpected Error:', e);
    }
  }

  const reportComment = () => {
    if (!comment.id || !comment.userId || !firebaseContext.user?.uid) return;

    try {
      const reportDoc = doc(firebaseContext.database,
                            `systems/${comment.systemId}/comments/${comment.id}/reports/${firebaseContext.user.uid}`);

      setDoc(reportDoc, {
        authorId: comment.userId,
        reporterId: firebaseContext.user.uid,
        content: comment.content,
        timestamp: Date.now()
      });

      setIsReported(true);

      ReactGA.event({
        category: 'System',
        action: 'Report Comment'
      });
    } catch (e) {
      console.log('Unexpected Error:', e);
    }
  }

  const vote = (direction = '') => {
    if (!comment.id || !comment.userId) return;
    if (!firebaseContext.user?.uid) {
      onToggleShowAuth(true);
      return;
    }

    try {
      const voteData = {
        voterId: firebaseContext.user.uid,
        systemId: comment.systemId,
        commentId: comment.id
      }

      const voteDoc = doc(firebaseContext.database,
                          `systems/${comment.systemId}/comments/${comment.id}/votes/${firebaseContext.user.uid}`);

      let gaEvent = '';
      switch (direction) {
        case 'UP':
          if (isUpvoted) {
            deleteDoc(voteDoc);
            setIsUpvoted(false);
            setNetVotes(v => (v || 0) - 1);
            gaEvent= 'Comment Remove Upvote';
          } else {
            voteData.value = 1;
            voteData.direction = direction;
            setDoc(voteDoc, voteData);
            setIsUpvoted(true);
            if (isDownvoted) {
              setIsDownvoted(false);
              setNetVotes(v => (v || 0) + 2);
            } else {
              setNetVotes(v => (v || 0) + 1);
            }
            gaEvent = 'Comment Upvote';
          }
          break;
        case 'DOWN':
          if (isDownvoted) {
            deleteDoc(voteDoc);
            setIsDownvoted(false);
            setNetVotes(v => (v || 0) + 1);
            gaEvent = 'Comment Remove Downvote';
          } else {
            voteData.value = -1;
            voteData.direction = direction;
            setDoc(voteDoc, voteData);
            setIsDownvoted(true);
            if (isUpvoted) {
              setIsUpvoted(false);
              setNetVotes(v => (v || 0) - 2);
            } else {
              setNetVotes(v => (v || 0) - 1);
            }
            gaEvent = 'Comment Downvote';
          }
          break;
        default:
          return;
      }

      ReactGA.event({
        category: 'System',
        action: gaEvent
      });
    } catch (e) {
      console.log('Unexpected Error:', e);
    }
  }

  const reply = () =>{
    if (!comment.id || !comment.userId) return;
    if (!authorDocData?.userId) return;
    if (!firebaseContext.user?.uid) {
      onToggleShowAuth(true);
      return;
    }

    onReply(comment, authorDocData);
  }

  const renderDelete = () => {
    if (isDeleting) {
      return (
        <div className="Comment-deleteCheck">
          <div className="Comment-deleteCheckPrompt">
            Are you sure you want to delete?
          </div>
          <button className="Comment-deleteConfirm Link" onClick={deleteComment}>
            Delete
          </button>
          <button className="Comment-deleteCancel Link" onClick={() => setIsDeleting(false)}>
            Cancel
          </button>
        </div>
      );
    } else {
      return (
        <button className="Comment-delete Link" onClick={() => setIsDeleting(true)}>
          Delete
        </button>
      );
    }
  }

  const renderReply = () =>{
    return (
      <button className="Comment-reply Link" onClick={reply}>
        Reply
      </button>
    );
  }

  const renderReport = () => {
    if (isReporting) {
      return (
        <div className="Comment-reportCheck">
          <div className="Comment-reportCheckPrompt">
            Are you sure you want to report this comment?
          </div>
          <button className="Comment-reportConfirm Link" onClick={reportComment}>
            Report
          </button>
          <button className="Comment-reportCancel Link" onClick={() => setIsReporting(false)}>
            Cancel
          </button>
        </div>
      );
    } else {
      return (
        <button className="Comment-report Link" onClick={() => setIsReporting(true)}>
          Report
        </button>
      );
    }
  }

  const renderBallot = () => {
    let voteText = 'Vote';
    if (netVotes || netVotes === 0) {
      voteText = `${netVotes}`;
    } else if (isCurrentUser) {
      voteText = '–'; // intentional n-dash
    }

    return (
      <div className="Comment-ballot">
        <button className={`Comment-vote Comment-vote--up ${isUpvoted ? 'Comment-vote--on' : 'Comment-vote--off'}`}
                disabled={isCurrentUser}
                onClick={() => vote('UP')}>
          <span className="sr-only">Upvote</span>
          <i className="fas fa-chevron-up"></i>
        </button>
        <div className="Comment-votes">
          {voteText}
        </div>
        <button className={`Comment-vote Comment-vote--down ${isDownvoted ? 'Comment-vote--on' : 'Comment-vote--off'}`}
                disabled={isCurrentUser}
                onClick={() => vote('DOWN')}>
          <span className="sr-only">Downvote</span>
          <i className="fas fa-chevron-down"></i>
        </button>
      </div>
    );
  }

  const renderTop = () => {
    const authorElem = (
      <Link className="Comment-author Link" href={`/user/${authorDocData.userId}`}
            onClick={() =>  ReactGA.event({ category: 'System', action: 'Comment Author Click' })}>
        <UserIcon className="Comment-authorIcon" userDocData={authorDocData} />

        <div className="Comment-authorName" itemProp="author" itemScope itemType="https://schema.org/Person">
          <span itemProp="name">{getUserDisplayName(authorDocData)}</span>
          <meta itemProp="url" content={`https://metrodreamin.com/user/${authorDocData.userId}`} />
        </div>
      </Link>
    );

    const adminElem = authorDocData.isAdmin && <div className="Comment-admin" data-tooltip-content="This user is a MetroDreamin' administrator">
      <i className="fas fa-shield-halved"></i>
    </div>;

    const opElem = isOwner && <div className="Comment-op" data-tooltip-content="This user created this map">
      OP
    </div>;

    const datetime = new Date(comment.timestamp);
    const timeElem = <div className="Comment-timeText" data-tooltip-content={datetime.toLocaleString()}>
      {timestampToText(comment.timestamp)}
    </div>;

    const deleteElem = isCurrentUser && renderDelete();

    const divider = <span className="Comment-divider">•</span>;

    return <div className="Comment-top">
      {authorElem}
      {authorElem && (adminElem || opElem || timeElem || deleteElem) && divider}
      {adminElem}
      {adminElem && (opElem || timeElem || deleteElem) && divider}
      {opElem}
      {opElem && (timeElem || deleteElem) && divider}
      {timeElem}
      {timeElem && deleteElem && divider}
      {deleteElem}
    </div>
  }

  const renderActionRow = () => {
    const reportElem = firebaseContext.user && !isCurrentUser && !authorDocData.isAdmin && renderReport();

    return (
      <div className="Comment-actionRow">
        {renderBallot()}
        {renderReply()}
        {reportElem}
      </div>
    );
  }

  if (isDeleted || isReported) return;
  if (firebaseContext.checkBidirectionalBlocks(comment.userId)) return;

  if (!comment || !authorDocData || !authorDocData.userId) {
    return <div className="Comment Comment--loading">
      loading...
    </div>;
  }

  return (
    <div className={classNames('Comment', { 'Comment--isSelf': isCurrentUser, 'Comment--isOP': isOwner })}
         itemProp="comment" itemType="https://schema.org/Comment" itemScope>
      {renderTop()}

      <div className="Comment-content">
        <Linkify
          componentDecorator={(decoratedHref, decoratedText, key) => (
            <a className="Linkify Link--inverse" href={decoratedHref} key={key}
               target="_blank" rel="nofollow noopener noreferrer">
              {decoratedText}
            </a>
          )}
        >
          {comment.content}
        </Linkify>
      </div>

      {renderActionRow()}
      <meta itemProp="text" content={comment.content} />
      <meta itemProp="dateCreated" content={(new Date(comment.timestamp).toISOString())} />
    </div>
  );
}
