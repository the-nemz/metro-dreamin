import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebase.js';
import { renderFadeWrap } from '/lib/util.js';

import Edit from '/pages/edit/[[...systemId]].js';
import { Map } from '/components/Map.js';
import { Metatags } from '/components/Metatags.js';
import { Start } from '/components/Start.js';
import { SystemHeader } from '/components/SystemHeader.js';

export default function EditNew(props) {
  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [systemDoc, setSystemDoc] = useState();
  const [mapBounds, setMapBounds] = useState();
  const [map, setMap] = useState();

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

  const handleSelectSystem = (system, meta, mapBounds = []) => {
    setSystemDoc({
      map: system,
      ...meta
    });
    setMapBounds(mapBounds);
  }

  const renderEdit = () => {
    // render full Edit component
    return <Edit systemDocData={systemDoc} ownerDocData={firebaseContext.settings} isNew={true} newMapBounds={mapBounds}
                 onToggleShowSettings={props.onToggleShowSettings} onToggleShowAuth={props.onToggleShowAuth} />
  }

  const renderNew = () => {
    return (
      <>
        <Metatags />

        <SystemHeader onHomeClick={handleHomeClick} onToggleShowSettings={props.onToggleShowSettings} onToggleShowAuth={props.onToggleShowAuth} />

        {renderFadeWrap(!firebaseContext.authStateLoading &&
                          <Start map={map} database={firebaseContext.database} settings={firebaseContext.settings}
                                onSelectSystem={(system, meta, mapBounds) => handleSelectSystem(system, meta, mapBounds)} />,
                        'start')}

        <Map system={{ lines: {}, stations: {} }} interlineSegments={{}} changing={{}} focus={{}}
             systemLoaded={false} viewOnly={false} waypointsHidden={false}
             onMapInit={handleMapInit} />
      </>
    );
  }

  const mainClass = `EditNew SystemWrap ${firebaseContext.settings.lightMode ? 'LightMode' : 'DarkMode'}`
  return (
    <main className={mainClass}>
      {systemDoc && systemDoc.systemNumStr ? renderEdit() : renderNew()}
    </main>
  );
}
