import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import ReactGA from 'react-ga';
import ReactTooltip from 'react-tooltip';

import { FirebaseContext } from '/lib/firebase.js';
import { INITIAL_SYSTEM } from '/lib/constants.js';

import { Map } from '/components/Map.js';
import { Metatags } from '/components/Metatags.js';
import { SystemHeader } from '/components/SystemHeader.js';

export default function ViewOwn(props) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [ userSystems, setUserSystems ] = useState([]);

  useEffect(() => {
    if (!firebaseContext.authStateLoading && firebaseContext.user && firebaseContext.user.uid) {
      const systemsCollection = collection(firebaseContext.database, 'systems');
      // TODO: add db index for sorting
      // const userViewsQuery = query(systemsCollection, where('userId', '==', firebaseContext.user.uid), orderBy('keywords', 'asc'));
      const userViewsQuery = query(systemsCollection, where('userId', '==', firebaseContext.user.uid));
      getDocs(userViewsQuery)
        .then((systemsSnapshot) => {
          let sysChoices = [];
          systemsSnapshot.forEach(sDoc => sysChoices.push(sDoc.data()));
          setUserSystems(sysChoices);
          ReactTooltip.rebuild();
        })
        .catch((error) => {
          console.log("Error getting documents: ", error);
        });
    }
  }, [firebaseContext.user, firebaseContext.authStateLoading]);

  const handleHomeClick = () => {
    ReactGA.event({
      category: 'View',
      action: 'Home'
    });

    const goHome = () => {
      router.push({
        pathname: '/explore'
      });
    }

    goHome();
  }

  const renderChoices = () => {
    let choices = [];
    for (const system of userSystems) {
      choices.push(
        <Link className="Own-systemChoice" key={system.systemId} href={`/edit/${system.viewId}`}>
          {system.title ? system.title : 'Unnamed System'}
        </Link>
      );
    }
    return(
      <div className="Own-systemChoicesWrap FadeAnim">
        <h1 className="Own-systemChoicesHeading">
          Your maps
        </h1>
        <div className="Own-systemChoices">
          {choices}
          <Link className="Own-newSystem Link" href={`/edit/new`}>
            Start a new map
          </Link>
        </div>
      </div>
    );
  }

  const mainClass = `ViewOwn SystemWrap ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <main className={mainClass}>
      <Metatags />

      <SystemHeader onHomeClick={handleHomeClick} onToggleShowSettings={props.onToggleShowSettings} onToggleShowAuth={props.onToggleShowAuth} />

      {!firebaseContext.authStateLoading && renderChoices()}

      <Map system={INITIAL_SYSTEM} interlineSegments={{}} changing={{}} focus={{}}
           systemLoaded={false} viewOnly={false} waypointsHidden={false} />
    </main>
  );
}
