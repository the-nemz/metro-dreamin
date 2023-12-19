import React, { useEffect, useContext } from 'react';
import ReactTooltip from 'react-tooltip';

import { FirebaseContext } from '/lib/firebase.js';
import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

import { Modal } from '/components/Modal';

export function CodeOfConduct(props) {

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, [props.open]);

  const renderContent = () => {
    return <>
      <div className="CodeOfConduct-logoWrap">
        <img className="CodeOfConduct-logo" src={firebaseContext.settings.lightMode ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
      </div>

      <div className="CodeOfConduct-text">
        <p className="CodeOfConduct-paragraph">
          Welcome to MetroDreamin', a space designed for community building and transit discussions. While spirited debates are encouraged, and disagreements are expected, it is crucial to prioritize maintaining MetroDreamin' as a positive and welcoming environment in all interactions on the platform.
        </p>

        <p className="CodeOfConduct-paragraph">
          The following is a non-exhaustive list of basic rules and guidelines:
        </p>

        <ol className="CodeOfConduct-list">
          <li className="CodeOfConduct-listItem">
            Always treat others with kindness and respect, even if you don’t agree with them.
          </li>
          <li className="CodeOfConduct-listItem">
            Stay on topic, avoid intentionally derailing threads, refrain from excessive trolling, and don’t spam.
          </li>
          <li className="CodeOfConduct-listItem">
            Do not intentionally insult or offend others.
          </li>
          <li className="CodeOfConduct-listItem">
            Bigotry is strictly prohibited on the platform. We uphold a zero-tolerance policy for any comments that are racist, homophobic, transphobic, or sexist, as well as any other content that is prejudiced, discriminatory, or exclusionary in nature. Engaging in such language may result in immediate suspension or removal.
          </li>
          <li className="CodeOfConduct-listItem">
            Threats of violence, harassment, or privacy breach—even as a joke—are strictly prohibited.
          </li>
        </ol>

        <p className="CodeOfConduct-paragraph">
          If you see someone breaking these rules, please send us an email at <a className="Link--inverse" href="mailto:metrodreamin@gmail.com">metrodreamin@gmail.com</a>, including a link to the offending content, and we will look into it.
        </p>
      </div>
    </>;
  }

  return (
    <Modal animKey='conduct' baseClass='CodeOfConduct' open={props.open}
           heading='Code of Conduct' content={renderContent()} onClose={props.onClose} />
  )
}
