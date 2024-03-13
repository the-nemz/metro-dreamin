import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { doc, deleteDoc } from 'firebase/firestore';
import ReactGA from 'react-ga4';
import Linkify from 'react-linkify';
import classNames from 'classnames';

import { timestampToText, getUserDisplayName } from '/util/helpers.js';
import { FirebaseContext, getUserDocData } from '/util/firebase.js';

import { UserIcon } from '/components/UserIcon.js';

export const Comment = ({ comment, isCurrentUser, isOwner }) => {
  const [authorDocData, setAuthorDocData] = useState();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (comment && comment.userId) {
      getUserDocData(comment.userId)
        .then(userDocData => setAuthorDocData(userDocData))
        .catch(e => console.log('comment author error:', e));
    }
  }, [comment.userId]);

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

  if (isDeleted) return;
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
      <meta itemProp="text" content={comment.content} />
      <meta itemProp="dateCreated" content={(new Date(comment.timestamp).toISOString())} />
    </div>
  );
}
