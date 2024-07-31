import React from "react";
import Link from 'next/link';
import ReactGA from 'react-ga4';

export const KoFiPromo = ({ onToggleShowContribute }) => {

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

  return (
    <div className={`KoFiPromo`}>
      {renderPromo()}
    </div>
  );
}
