import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
// import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';

import { FirebaseContext } from '/lib/firebaseContext.js';
import { INITIAL_SYSTEM } from '/lib/constants.js';

import { Map } from '/components/Map.js';
import { Metatags } from '/components/Metatags.js';
import { Notifications } from '/components/Notifications.js';
import { Start } from '/components/Start.js';
import Edit from '/pages/edit/[[...viewId]].js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

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

  const renderHeader = () => {
    // TODO: make this a component
    const notifOrCreate = firebaseContext.user ?
      <Notifications page={'view'} /> :
      <button className="View-signInButton Link" onClick={setupSignIn}>
        Sign in
      </button>;

    return (
      <div className="View-header">
        <div className="View-headerLeft">
          <button className="View-homeLink ViewHeaderButton" onClick={handleHomeClick}>
            <i className="fas fa-home"></i>
          </button>
        </div>
        <div className="View-headerRight">
          {!firebaseContext.authStateLoading && notifOrCreate}

          <button className="View-settingsButton ViewHeaderButton"
                  onClick={() => {
                                   this.props.onToggleShowSettings(isOpen => !isOpen);
                                   ReactGA.event({
                                     category: 'View',
                                     action: 'Toggle Settings'
                                   });
                                 }}>
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </div>
    );
  }

  if (systemDoc && systemDoc.systemId) {
    // render full View component
    return <Edit systemDocData={systemDoc} ownerDocData={firebaseContext.settings} isNew={true} newMapBounds={mapBounds} />
  }

  const mainClass = `View ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <main className={mainClass}>
      <Metatags />

      {renderHeader()}

      {!firebaseContext.authStateLoading &&
        <Start map={map} database={firebaseContext.database} settings={firebaseContext.settings}
               onSelectSystem={(system, meta, mapBounds) => handleSelectSystem(system, meta, mapBounds)} />}

      <Map system={INITIAL_SYSTEM} interlineSegments={{}} changing={{}} focus={{}}
           systemLoaded={false} viewOnly={false} waypointsHidden={false}
           useLight={firebaseContext.settings.lightMode} useLow={firebaseContext.settings.lowPerformance} // newSystemSelected={this.state.newSystemSelected || false}
           onMapInit={handleMapInit}
           onToggleMapStyle={handleToggleMapStyle} />
    </main>
  );
}
