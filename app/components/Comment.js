import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { doc, deleteDoc } from 'firebase/firestore';
import ReactTooltip from 'react-tooltip';
import classNames from 'classnames';

import { timestampToText } from '/lib/util.js';
import { FirebaseContext, getUserDocData } from '/lib/firebase.js';

import { UserIcon } from '/components/UserIcon.js';

export const Comment = ({ comment, isCurrentUser, isOwner }) => {
  const [authorDocData, setAuthorDocData] = useState();
  const [isDeleting, setIsDeleting] = useState(false);

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (comment && comment.userId) {
      getUserDocData(comment.userId).then(userDocData => setAuthorDocData(userDocData))
    }
    ReactTooltip.rebuild();
  }, [comment.userId]);

  const deleteComment = () => {
    if (!comment.id) return;

    try {
      const commentDoc = doc(firebaseContext.database, `systems/${comment.systemId}/comments/${comment.id}`);
      deleteDoc(commentDoc);
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
    const authorElem = <Link className="Comment-author Link" href={`/user/${authorDocData.userId}`}>
      <UserIcon className="Comment-authorIcon" userDocData={authorDocData} />

      <div className="Comment-authorName">
        {authorDocData.displayName ? authorDocData.displayName : 'Anon'}
      </div>
    </Link>;

    const opElem = isOwner && <div className="Comment-op" data-tip="This user created this map">
      OP
    </div>;

    const timeElem = <div className="Comment-timeText">
      {timestampToText(comment.timestamp)}
    </div>;

    const deleteElem = isCurrentUser && renderDelete();

    const divider = <span className="Comment-divider">•</span>;

    return <div className="Comment-top">
      {authorElem}
      {authorElem && (opElem || timeElem || deleteElem) && divider}
      {opElem}
      {opElem && (timeElem || deleteElem) && divider}
      {timeElem}
      {timeElem && deleteElem && divider}
      {deleteElem}
    </div>
  }

  if (!comment || !authorDocData || !authorDocData.userId) {
    return <div className="Comment Comment--loading">
      loading...
    </div>;
  }

  return (
    <div className={classNames('Comment', { 'Comment--isSelf': isCurrentUser, 'Comment--isOP': isOwner })}>
      {renderTop()}

      <div className="Comment-content">
        {comment.content}
      </div>
    </div>
  );
}
