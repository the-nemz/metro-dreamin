import React, { useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga4';

import { FirebaseContext } from '/util/firebase.js';

export function CookiePreference({ onClose = () => {}, onAccept = () => {} }) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const allowCookies = () => {
    localStorage.setItem('mdCookiePreference', 'allow');
    onAccept();
    onClose(false);
    ReactGA.event({ category: 'CookiePreference', action: 'Allow' });
  }

  const denyCookies = () => {
    const prevPreference = localStorage.getItem('mdCookiePreference');

    localStorage.setItem('mdCookiePreference', 'deny');
    onClose(false);

    if (prevPreference && prevPreference === 'allow') {
      router.reload();
    }
  }

  const privacyLink = (
    <Link href="/privacy.html" className="Link--inverse"
          target="_blank" rel="nofollow noopener noreferrer">
      Privacy Policy
    </Link>
  )

  const cookieLink = (
    <Link href="/cookies.html" className="Link--inverse"
          target="_blank" rel="nofollow noopener noreferrer">
      here
    </Link>
  );

  return (
    <div className={`CookiePreference FadeAnim ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`}>
      <div className="CookiePreference-content">
        <div className="CookiePreference-message">
          We use cookies to enhance your experience on MetroDreamin'. By clicking 'Allow,' you agree to the use of cookies. Your data is handled securely in accordance with our {privacyLink}. You can manage your preferences or learn more by clicking 'Cookies' at the bottom of any page or by clicking {cookieLink}.
        </div>
        <div className="CookiePreference-buttons">
          <button className="CookiePreference-deny Link"
                  onClick={denyCookies}>
            Deny
          </button>
          <button className="CookiePreference-confirm Button--primary"
                  onClick={allowCookies}>
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
