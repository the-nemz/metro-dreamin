import React, { useContext } from 'react';
import ReactGA from 'react-ga';

import { FirebaseContext } from "../firebaseContext.js";

import logo from '../../assets/logo.svg';
import logo_inverted from '../../assets/logo-inverted.svg';

export function Mission(props) {
  const firebaseContext = useContext(FirebaseContext);

  return (
    <div className="Mission FadeAnim">
      <div className="Mission-container Modal-container">
        <button className="Mission-close Modal-close" data-tip="Close mission"
                onClick={() => props.onToggleShowMission(false)}>
          <i className="fas fa-times-circle"></i>
        </button>

        <div className="Mission-heading Modal-heading">
          Our Mission
        </div>

        <div className="Mission-content Modal-content">
          <div className="Mission-logoWrap">
            <img className="Mission-logo" src={firebaseContext.settings.lightMode ? logo_inverted : logo} alt="Metro Dreamin' logo" />
          </div>
          <div className="Mission-text">
            Metrodreamin' is a place for you –⁠ the subway enthusiast, the amateur urban planner, the design geek –⁠ to build the public transportation system of your dreams. It is a nod to freedom of mobility: Our right as humans to move across space with ease, in an affordable, accessible manner. Roads and freeways have for too long cut up our cities and our spaces and made travel hard for people without access to a car. We reject the idea that transportation must be car-driven.
            <br />
            <br />
            Metrodreamin' is also an homage to cities, the densely-built worlds that "have the capability of providing something for everybody, only because, and only when, they are created by everybody” as urbanist Jane Jacobs said. Metrodreamin' honors that idea, of pluralism through collectivity. Here, you can re-envision San Francisco's BART, expand upon Mexico City's sprawling STC, and transpose Tokyo's metro on Paris' map. You can start from scratch or build off an already-existing model. Metrodreamin' is a place to dwell and design a system that works for your transportation vision, and maybe others', too: Crowdsourcing maps isn't only permitted, it's encouraged.
          </div>
        </div>
      </div>
    </div>
  )
}
