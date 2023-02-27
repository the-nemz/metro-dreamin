import React from 'react';

import logo from '../../assets/logo.svg';

export const Migration = () => {
  return (
    <section className="Migration">
      <div className="Migration-logoWrap">
        <img className="Migration-logo" src={logo} alt="MetroDreamin' logo" />
      </div>

      <div className="Migration-text">
        <p>
          Something exciting is coming...
        </p>
        <p>
          Check back soon to see the all new MetroDreamin'!
        </p>
      </div>
    </section>
  );
}
