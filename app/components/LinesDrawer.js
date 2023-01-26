import React, { useContext, useEffect, useState } from 'react';
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
      <button className="LinesDrawer-menuButton"
              onClick={() => setIsOpen(open => !open)}>
        <div className="LinesDrawer-menuLine LinesDrawer-menuLine--top"></div>
        <div className="LinesDrawer-menuLine LinesDrawer-menuLine--middle"></div>
        <div className="LinesDrawer-menuLine LinesDrawer-menuLine--bottom"></div>
        <span className="sr-only">Menu open/close</span>
      </button>
    );
  }

  return (
    <section className={classNames('LinesDrawer', { 'LinesDrawer--closed': !isOpen, 'LinesDrawer--open': isOpen })}>
      {renderMenuButton()}

      <LineButtons extraClasses={['LineButtons--inDrawer']} system={system} focus={focus} viewOnly={viewOnly}
                  onLineClick={onLineClick}
                  onAddLine={onAddLine} />
    </section>
  );
}
