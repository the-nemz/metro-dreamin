import React, { useState, useContext, useEffect } from 'react';

import { timestampToText } from '/lib/util.js';
import { FirebaseContext, getUserDocData } from '/lib/firebase.js';

export const Comment = ({ comment }) => {
  const [authorDocData, setAuthorDocData] = useState();

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (comment && comment.userId) {
      getUserDocData(comment.userId).then(userDocData => setAuthorDocData(userDocData))
    }
  }, []);

  if (!comment || !authorDocData || !authorDocData.userId) {
    return <div className="Comment Comment--loading">
      loading...
    </div>;
  }

  const isOwnComment = firebaseContext.user && firebaseContext.user.uid === comment.userId;

  const renderTop = () => {
    const authorElem = <div className="Comment-author">
      <i className="fa-solid fa-user"></i>
      <div className="Comment-authorName">
        {authorDocData.displayName ? authorDocData.displayName : 'Anon'}
      </div>
    </div>;

    const timeElem = <div className="Comment-timeText">
      {timestampToText(comment.timestamp)}
    </div>;

    const divider = <span className="Comment-divider">•</span>;

    return <div className="Comment-top">
      {authorElem}
      {authorElem && timeElem && divider}
      {timeElem}
    </div>
  }

  const commentClass = `Comment${isOwnComment ? ' Comment--own' : ''}`;
  return (
    <div className={commentClass}>
      {renderTop()}

      <div className="Comment-content">
        {comment.content}
      </div>
    </div>
  );
}
