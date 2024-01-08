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

    try {
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

      // TODO: may be possible to use a timeout + mutation observer to
      // get a fairly high confidence that the unit was blocked

      return () => observer.disconnect();
    } catch (e) {
      console.warn('mutation observer error:', e);
    }
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
    case 'profileDesktop':
      slot = '1228768250';
      break;
    case 'profileMobile':
      slot = '4314930740';
      break;
    case 'searchDesktop':
      slot = '7386110350';
      break;
    case 'searchMobile':
      slot = '5547820043';
      break;
    case 'system1':
      slot = '2310178965';
      break;
    default:
      break;
  }

  if (!slot) return;

  return (
    <div className={`Revenue Revenue--${unitName}`}>
      <ins className="adsbygoogle Revenue-unit"
           style={{ display: 'flex', justifyContent: 'center' }}
           data-ad-client="ca-pub-8639649236007814"
           data-ad-slot={slot}
           data-adtest={AD_TEST ? 'on' : 'off'} />
    </div>
  );
}
