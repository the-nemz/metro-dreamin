import React, { useEffect } from 'react';
import ReactTooltip from 'react-tooltip';
import classNames from 'classnames';

export const CommentAndCount = ({ systemDocData, isPrivate, onClick = () => {} }) => {
  useEffect(() => {
    ReactTooltip.rebuild();
  }, [isPrivate]);

  return (
    <div className={classNames('CommentAndCount', { 'CommentAndCount--none': !systemDocData.commentsCount })}>
      <button className="CommentAndCount-icon"
            data-tip="Add a comment"
            onClick={onClick}>
        <i className="fas fa-comment"></i>
      </button>
      <div className="CommentAndCount-count">
        {systemDocData.commentsCount ? systemDocData.commentsCount : ''}
      </div>
    </div>
  );
}
