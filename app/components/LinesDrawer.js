import React, { useContext, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import classNames from 'classnames';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';

import { LineButtons } from '/components/LineButtons.js';

export function LinesDrawer({ system, focus, viewOnly, onLineClick, onAddLine }) {
  const [ isOpen, setIsOpen ] = useState(false);

  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const renderMenuButton = () => {
    return (
      <button className="LinesDrawer-menuButton Hamburger"
              onClick={() => setIsOpen(open => !open)}>
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
