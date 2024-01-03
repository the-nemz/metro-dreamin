import React from 'react';
import classNames from 'classnames';

export const CommentAndCount = ({ systemDocData, isPrivate, onClick = () => {} }) => {

  return (
    <div className={classNames('CommentAndCount', { 'CommentAndCount--none': !systemDocData.commentsCount })}>
      <button className="CommentAndCount-icon"
            data-tooltip-content="Add a comment"
            onClick={() => onClick(true)}>
        <i className="fas fa-comment"></i>
      </button>
      <button className="CommentAndCount-count Link"
              onClick={() => onClick(false)}>
        {systemDocData.commentsCount ? systemDocData.commentsCount : ''}
      </button>
    </div>
  );
}
