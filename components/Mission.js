import React, { useContext, useEffect, useState } from 'react';

import { FirebaseContext, getGlobalStatsData } from '/util/firebase.js';
import { LOGO, LOGO_INVERTED } from '/util/constants.js';

import { Modal } from '/components/Modal';

export function Mission(props) {
  const [globalStats, setGlobalStats] = useState({});

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    getGlobalStatsData()
      .then(setGlobalStats)
      .catch(e => console.log('getGlobalStatsData error:', e));
  }, [props.open]);

  const renderStats = () => {
    if (globalStats && globalStats.systemsCreated) {
      return <div className="Mission-stats">
        <div className="Mission-systemsCount">
          {globalStats.systemsCreated.toLocaleString()}
        </div>
        <div className="Mission-systemsText">
          maps created and counting
        </div>
      </div>
    }
  }

  const renderContent = () => {
    return <>
      <div className="Mission-logoWrap">
        <img className="Mission-logo" src={firebaseContext.settings.lightMode ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
      </div>
      {renderStats()}
      <div className="Mission-text">
        MetroDreamin' is a place for you — the subway enthusiast, the amateur urban planner, the design geek — to build the public transportation system of your dreams. It is a nod to freedom of mobility: our right as humans to move across space with ease, in an affordable, accessible manner. Roads and freeways have for too long cut up our cities and our spaces and made travel hard for people without access to a car. We reject the idea that transportation must be car-driven.
        <br />
        <br />
        MetroDreamin' is also an homage to cities, the densely-built worlds that "have the capability of providing something for everybody, only because, and only when, they are created by everybody” as urbanist Jane Jacobs said. MetroDreamin' honors that idea, of pluralism through collectivity. Here, you can re-envision San Francisco's BART, expand upon Mexico City's sprawling system, and transpose Tokyo's metro on Paris' map. You can start from scratch or build off an already-existing model. MetroDreamin' is a place to dwell and design a system that works for your transportation vision, and maybe others', too: crowdsourcing maps isn't only permitted, it's encouraged.
      </div>
    </>;
  }

  return (
    <Modal animKey='mission' baseClass='Mission' open={props.open}
           heading='Our Mission' content={renderContent()} onClose={props.onClose} />
  )
}
