import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga4';

import { FirebaseContext } from '/lib/firebase.js';

export function Own(props) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [ userSystemsFiltered, setUserSystemsFiltered ] = useState();
  const [input, setInput] = useState('');

  useEffect(() => {
    if (input) {
      const filteredSystems = firebaseContext.ownSystemDocs.filter((s) => {
        return (s.title || '').toLowerCase().includes(input.toLowerCase())
      });
      setUserSystemsFiltered(filteredSystems);
    } else {
      setUserSystemsFiltered(null);
    }
  }, [input]);

  const handleChange = (value) => {
    setInput(value);

    ReactGA.event({
      category: 'Own',
      action: 'Filter Systems'
    });
  }

  const handleSubmit = (e) => {
    e.preventDefault();

    if (userSystemsFiltered && userSystemsFiltered.length) {
      setInput(userSystemsFiltered[0].title);

      router.push({
        pathname: `/edit/${encodeURIComponent(userSystemsFiltered[0].systemId)}`
      });

      ReactGA.event({
        category: 'Own',
        action: 'Select by Search'
      });
    }
  }

  const renderInput = () => {
    return (
      <form className="Own-inputWrap" onSubmit={handleSubmit}>
        <input className="Own-input" value={input} placeholder={"Search your maps"}
              onChange={(e) => handleChange(e.target.value)}
        />
      </form>
    );
  }

  let choices = [];
  for (const system of (input && userSystemsFiltered ? userSystemsFiltered : firebaseContext.ownSystemDocs)) {
    choices.push(
      <Link className="Own-choice" key={system.systemNumStr} href={`/edit/${encodeURIComponent(system.systemId)}`}
            onClick={() => ReactGA.event({
                category: 'Own',
                action: 'Select System'
            })}>
        {system.title ? system.title : 'Unnamed System'}
      </Link>
    );
  }

  return(
    <div className="Own FadeAnim">
      <div className="Own-container">
        <h1 className="Own-heading">
          Your maps
        </h1>

        {firebaseContext.ownSystemDocs.length > 5 && renderInput()}

        <div className="Own-choices">
          {choices}

          <Link className="Own-newSystem Link" href={`/edit/new`}>
            Start a new map
          </Link>
        </div>
      </div>
    </div>
  );
}
