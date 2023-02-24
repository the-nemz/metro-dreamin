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
