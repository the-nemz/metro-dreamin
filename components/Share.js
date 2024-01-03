import React, { useState } from 'react';
import ReactGA from 'react-ga4';

import { getShareableSystemURL } from '/util/helpers.js';

import { Modal } from '/components/Modal.js';

export function Share({ systemDocData, handleSetToast }) {
  const [ isOpen, setIsOpen ] = useState(false);

  const handleGetShareableLink = async () => {
    const shareUrl = getShareableSystemURL(systemDocData.systemId);
    try {
      await navigator.clipboard.writeText(shareUrl);
      handleSetToast('Copied to clipboard!');

      ReactGA.event({
        category: 'Share',
        action: 'Copy Link'
      });
    } catch (err) {
      console.error('handleGetShareableLink: ', err);
      handleSetToast('Failed to copy');
    }
  }

  const handleTwitterShare = () => {
    const shareUrl = getShareableSystemURL(systemDocData.systemId);
    const tweetText = "&text=" + encodeURIComponent("Check out my dream map" +
                                                    (systemDocData.title ? " of " + systemDocData.title : "") +
                                                    "!");
    const twitterUrl = "https://twitter.com/intent/tweet?url=" + encodeURI(shareUrl) + tweetText;
    ReactGA.event({
      category: 'Share',
      action: 'Twitter'
    });
    window.open(twitterUrl, '_blank');
  }

  const renderMain = () => {
    const shareableWrap = (
      <div className="Share-buttonWrap">
        <button className="Share-button Share-button--copy"
                onClick={handleGetShareableLink}>
          <i className="fas fa-copy"></i>
          <span className="Share-buttonText">Copy shareable link</span>
        </button>
      </div>
    );

    const twitterWrap = (
      <div className="Share-buttonWrap">
        <button className="Share-button Share-button--twitter"
                onClick={handleTwitterShare}>
          <i className="fab fa-twitter"></i>
          <span className="Share-buttonText">Share on Twitter</span>
        </button>
      </div>
    );

    return <>
      {shareableWrap}
      {twitterWrap}
    </>;
  }

  if (!systemDocData || !systemDocData.systemId) {
    return;
  }

  return <div className="Share">
    <button className="Share-openButton"
            data-tooltip-content="Share on social media or copy shareable link to clipboard"
            onClick={() => {
              setIsOpen(curr => !curr);
              ReactGA.event({
                category: 'System',
                action: 'Show Share Modal'
              });
            }}>
        <i className="fas fa-share"></i>
    </button>

    <Modal baseClass='Share' open={isOpen} heading={'Share'} content={renderMain()}
           onClose={() => setIsOpen(false)} />
  </div>;
}
