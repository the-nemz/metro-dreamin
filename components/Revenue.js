import React, { useEffect, useState } from "react";

const AD_TEST = process.env.NEXT_PUBLIC_STAGING === 'true' || process.env.NEXT_PUBLIC_LOCAL === 'true';

export const Revenue = ({ unitName = '' }) => {

  let slot;
  switch (unitName) {
    case 'explore1':
      slot = '5267746302';
      break;
    case 'explore2':
      slot = '9283847081';
      break;
    default:
      break;
  }

  if (!slot) return;

  return <div className={`Revenue Revenue--${unitName}`}>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8639649236007814"
            crossOrigin="anonymous"></script>
    <ins className="adsbygoogle"
        style={{ display: 'flex', justifyContent: 'center' }}
        data-ad-client="ca-pub-8639649236007814"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-adtest={AD_TEST ? 'on' : 'off'}
        data-full-width-responsive="true" />
    <script>
      {'(adsbygoogle = window.adsbygoogle || []).push({});'}
    </script>
  </div>;
}
