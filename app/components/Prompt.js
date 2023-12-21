import React from 'react';

export function Prompt({
                          message,
                          denyText,
                          confirmText,
                          denyFunc,
                          confirmFunc
                       }) {

  if (!message || !denyFunc || !confirmFunc) return;

  return (
    <div className="Prompt FadeAnim">
      <div className="Prompt-content">
        <div className="Prompt-message">
          {message}
        </div>
        <div className="Prompt-buttons">
          <button className="Prompt-deny Button--inverse" onClick={denyFunc}>
            {denyText ? denyText : 'No'}
          </button>
          <button className="Prompt-confirm Button--primary" onClick={confirmFunc}>
            {confirmText ? confirmText : 'Yes'}
          </button>
        </div>
      </div>
    </div>
  );
}
