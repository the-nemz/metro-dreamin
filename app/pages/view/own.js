import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
// import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactGA from 'react-ga';
import ReactTooltip from 'react-tooltip';
import mapboxgl from 'mapbox-gl';

import { FirebaseContext } from '/lib/firebaseContext.js';
import { INITIAL_SYSTEM } from '/lib/constants.js';

import { Map } from '/components/Map.js';
import { Metatags } from '/components/Metatags.js';
import { SystemHeader } from '/components/SystemHeader.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export default function Own() {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [ userSystems, setUserSystems ] = useState([]);
  const [ map, setMap ] = useState();

  useEffect(() => {
    if (!firebaseContext.authStateLoading && firebaseContext.user && firebaseContext.user.uid) {
      const viewsCollection = collection(firebaseContext.database, 'views');
      // TODO: add db index for sorting
      // const userViewsQuery = query(viewsCollection, where('userId', '==', firebaseContext.user.uid), orderBy('keywords', 'asc'));
      const userViewsQuery = query(viewsCollection, where('userId', '==', firebaseContext.user.uid));
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

  const setupSignIn = () => {
    window.alert('TODO: sign up');
  }

  const handleMapInit = (map) => {
    setMap(map);
  }

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

  const handleToggleMapStyle = (map, style) => {
    map.setStyle(style);
  }

  const renderChoices = () => {
    let choices = [];
    for (const system of userSystems) {
      choices.push(
        <Link className="View-systemChoice" key={system.systemId} href={`/edit/${system.viewId}`}>
          {system.title ? system.title : 'Unnamed System'}
        </Link>
      );
    }
    return(
      <div className="View-systemChoicesWrap FadeAnim">
        <h1 className="View-systemChoicesHeading">
          Your maps
        </h1>
        <div className="View-systemChoices">
          {choices}
          <Link className="View-newSystem Link" href={`/edit/new`}>
            Start a new map
          </Link>
        </div>
      </div>
    );
  }

  const mainClass = `View ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <main className={mainClass}>
      <Metatags />

      <SystemHeader handleHomeClick={handleHomeClick} />

      {!firebaseContext.authStateLoading && renderChoices()}

      <Map system={INITIAL_SYSTEM} interlineSegments={{}} changing={{}} focus={{}}
           systemLoaded={false} viewOnly={false} waypointsHidden={false}
           useLight={firebaseContext.settings.lightMode} useLow={firebaseContext.settings.lowPerformance} // newSystemSelected={this.state.newSystemSelected || false}
           onMapInit={handleMapInit}
           onToggleMapStyle={handleToggleMapStyle} />
    </main>
  );
}
