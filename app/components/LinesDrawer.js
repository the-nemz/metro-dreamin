import React, { useState } from 'react';
import classNames from 'classnames';
import ReactGA from 'react-ga4';

import { LineButtons } from '/components/LineButtons.js';

export function LinesDrawer({ system, focus, viewOnly, onLineClick, onAddLine }) {
  const [ isOpen, setIsOpen ] = useState(false);

  const renderMenuButton = () => {
    return (
      <button className="LinesDrawer-menuButton Hamburger"
              onClick={() => {
                setIsOpen(open => !open);
                ReactGA.event({
                  category: 'System',
                  action: 'Toggle Lines Drawer'
                });
              }}>
        <div className="Hamburger-top"></div>
        <div className="Hamburger-middle"></div>
        <div className="Hamburger-bottom"></div>
        <span className="sr-only">Lines open/close</span>
      </button>
    );
  }

  return (
    <section className={classNames('LinesDrawer', { 'LinesDrawer--closed': !isOpen, 'LinesDrawer--open': isOpen, 'Hamburger--open': isOpen })}>
      {renderMenuButton()}

      <LineButtons extraClasses={['LineButtons--inDrawer']} system={system} focus={focus} viewOnly={viewOnly}
                  onLineClick={(lineId) => {
                    onLineClick(lineId);
                    setIsOpen(false);
                  }}
                  onAddLine={() => {
                    onAddLine();
                    setIsOpen(false);
                  }} />
    </section>
  );
}
