import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
// import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebaseContext.js';
import { INITIAL_SYSTEM } from '/lib/constants.js';

import Edit from '/pages/edit/[[...viewId]].js';
import { Map } from '/components/Map.js';
import { Metatags } from '/components/Metatags.js';
import { Start } from '/components/Start.js';
import { SystemHeader } from '/components/SystemHeader.js';

export default function New() {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [systemDoc, setSystemDoc] = useState();
  const [mapBounds, setMapBounds] = useState();
  const [map, setMap] = useState();

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

  const handleSelectSystem = (system, meta, mapBounds = []) => {
    setSystemDoc({
      map: system,
      ...meta
    });
    setMapBounds(mapBounds);
  }

  if (systemDoc && systemDoc.systemId) {
    // render full View component
    return <Edit systemDocData={systemDoc} ownerDocData={firebaseContext.settings} isNew={true} newMapBounds={mapBounds} />
  }

  const mainClass = `View ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <main className={mainClass}>
      <Metatags />

      <SystemHeader handleHomeClick={handleHomeClick} />

      {!firebaseContext.authStateLoading &&
        <Start map={map} database={firebaseContext.database} settings={firebaseContext.settings}
               onSelectSystem={(system, meta, mapBounds) => handleSelectSystem(system, meta, mapBounds)} />}

      <Map system={INITIAL_SYSTEM} interlineSegments={{}} changing={{}} focus={{}}
           systemLoaded={false} viewOnly={false} waypointsHidden={false}
           useLight={firebaseContext.settings.lightMode} useLow={firebaseContext.settings.lowPerformance}
           onMapInit={handleMapInit}
           onToggleMapStyle={handleToggleMapStyle} />
    </main>
  );
}
