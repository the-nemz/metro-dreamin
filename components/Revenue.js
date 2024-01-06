import React, { useEffect, useState } from "react";

const AD_TEST = process.env.NEXT_PUBLIC_STAGING === 'true' || process.env.NEXT_PUBLIC_LOCAL === 'true';

export const Revenue = ({ unitName = '', mutationSelector = '' }) => {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error('error adding unit:', e);
    }

    if (!mutationSelector) return;

    // strangely, Google adds inline styling to parent elements overriding height and max-height :/
    // so we observe the target element and remove the inline styling the moment it is added
    let currWrapper = document.querySelector(mutationSelector);
    const observer = new MutationObserver((mutations, observer) => {
      currWrapper.removeAttribute('style');
    });

    if (currWrapper) {
      observer.observe(currWrapper, {
        attributes: true,
        attributeFilter: ['style']
      });
    }

    return () => observer.disconnect();
  }, []);

  let slot;
  switch (unitName) {
    case 'explore1':
      slot = '5267746302';
      break;
    case 'explore2':
      slot = '9283847081';
      break;
    case 'focusLineDesktop':
      slot = '9058284679';
      break;
    case 'focusLineMobile':
      slot = '5749595053';
      break;
    case 'focusStationDesktop':
      slot = '4002804083';
      break;
    case 'focusStationMobile':
      slot = '2977497029';
      break;
    default:
      break;
  }

  if (!slot) return;

  return <div className={`Revenue Revenue--${unitName}`}>
    <ins className="adsbygoogle Revenue-unit"
        style={{ display: 'flex', justifyContent: 'center' }}
        data-ad-client="ca-pub-8639649236007814"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-adtest={AD_TEST ? 'on' : 'off'}
        data-full-width-responsive="true" />
  </div>;
}
