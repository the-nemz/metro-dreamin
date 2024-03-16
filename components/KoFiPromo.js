import React, { useContext } from "react";
import Link from 'next/link';
import ReactGA from 'react-ga4';

import { FirebaseContext } from '/util/firebase.js';

import { Revenue } from '/components/Revenue.js';

export const KoFiPromo = ({
  fallbackRevenueUnitName = 'explore2',
  onToggleShowContribute,
}) => {
  const firebaseContext = useContext(FirebaseContext);

  const renderPromo = () => {
    const hasContributeFunc = onToggleShowContribute && typeof onToggleShowContribute === 'function';
    return (
      <div className="KoFiPromo-content">
        <div className="KoFiPromo-text">
          Help keep MetroDreamin' chuggin'!<span> </span><br />Support us on <span className="KoFiPromo-nobreak">Ko-fi</span> if you love making maps.
        </div>

        {
          hasContributeFunc ? (
            <button className="KoFiPromo-button Button--secondary"
                    onClick={() => {
                      onToggleShowContribute(true);
                      ReactGA.event({
                        category: 'Discover',
                        action: 'Toggle Contribute'
                      });
                    }}>
              Contribute!
            </button>
          ) : (
            <Link className="KoFiPromo-button Button--secondary"
                  href="https://ko-fi.com/metrodreamin"
                  target="_blank" rel="nofollow noopener noreferrer"
                  onClick={() => ReactGA.event({ category: 'Discover', action: 'Ko-fi' })}>
               Contribute!
            </Link>
          )
        }
      </div>
    )
  }

  if (!firebaseContext.authStateLoading && !firebaseContext.user) {
    return <Revenue unitName={fallbackRevenueUnitName} />
  }

  return (
    <div className={`KoFiPromo`}>
      {!firebaseContext.authStateLoading && renderPromo()}
    </div>
  );
}
