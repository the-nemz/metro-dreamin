import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';

export function Own({ userSystems }) {
  const router = useRouter();
  const [ userSystemsFiltered, setUserSystemsFiltered ] = useState();
  const [input, setInput] = useState('');

  useEffect(() => {
    if (input) {
      const filteredSystems = userSystems.filter((s) => {
        return (s.title || '').toLowerCase().includes(input.toLowerCase())
      });
      setUserSystemsFiltered(filteredSystems);
    } else {
      setUserSystemsFiltered(null);
    }
  }, [input]);

  const handleChange = (value) => {
    setInput(value);
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (userSystemsFiltered && userSystemsFiltered.length) {
      setInput(userSystemsFiltered[0].title);

      router.push({
        pathname: `/edit/${userSystemsFiltered[0].systemId}`
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
  for (const system of (input && userSystemsFiltered ? userSystemsFiltered : userSystems)) {
    choices.push(
      <Link className="Own-systemChoice" key={system.systemNumStr} href={`/edit/${system.systemId}`}>
        {system.title ? system.title : 'Unnamed System'}
      </Link>
    );
  }
  return(
    <div className="Own FadeAnim">
      <div className="Own-container">
        <h1 className="Own-systemChoicesHeading">
          Your maps
        </h1>

        {userSystems.length > 5 && renderInput()}

        <div className="Own-systemChoices">
          {choices}
          <Link className="Own-newSystem Link" href={`/edit/new`}>
            Start a new map
          </Link>
        </div>
      </div>
    </div>
  );
}
