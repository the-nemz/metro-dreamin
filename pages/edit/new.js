import React, { useState, useContext } from 'react';

import { FirebaseContext, getSystemFromBranch } from '/util/firebase.js';
import { renderFadeWrap } from '/util/helpers.js';

import Edit from '/pages/edit/[systemId].js';

import { Drawer } from '/components/Drawer.js';
import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
import { Map } from '/components/Map.js';
import { Metatags } from '/components/Metatags.js';
import { Start } from '/components/Start.js';
import { Theme } from '/components/Theme.js';
import { DEFAULT_LINE_MODE } from '/util/constants.js';

export async function getServerSideProps({ params, query }) {
  let systemFromBranch;
  let newFromSystemId = '';

  try {
    if (query.fromDefault) {
      systemFromBranch = await getSystemFromBranch(query.fromDefault, true);
    } else if (query.fromSystem) {
      systemFromBranch = await getSystemFromBranch(query.fromSystem, false, { trimLargeSystems: true });
      newFromSystemId = query.fromSystem;
    }
  } catch (e) {
    console.log('edit/new error:', e);
    return { notFound: true };
  }

  if (systemFromBranch && systemFromBranch.map && systemFromBranch.meta && systemFromBranch.ancestors) {
    systemFromBranch.numWaypoints = Object.values(systemFromBranch.map.stations || {}).filter(s => s.isWaypoint).length;
    systemFromBranch.numStations = Object.keys(systemFromBranch.map.stations || {}).length - systemFromBranch.numWaypoints;
    systemFromBranch.numInterchanges = Object.keys(systemFromBranch.map.interchanges || {}).length;
    systemFromBranch.numLines = Object.keys(systemFromBranch.map.lines || {}).length;

    return { props: { systemFromBranch, newFromSystemId } };
  }

  return { props: {} };
}

export default function EditNew(props) {
  const firebaseContext = useContext(FirebaseContext);

  const [systemDoc, setSystemDoc] = useState(props.systemFromBranch);
  const [mapBounds, setMapBounds] = useState();
  const [map, setMap] = useState();

  const handleMapInit = (map) => {
    setMap(map);
  }

  const handleSelectSystem = (system, meta, mapBounds = [], ancestors = []) => {
    setSystemDoc({
      map: system,
      meta,
      ancestors,
      numStations: 0,
      numWaypoints: 0,
      numLines: 1,
      numInterchanges: 0
    });
    setMapBounds(mapBounds);
  }

  if (systemDoc && systemDoc.meta) {
    // render full Edit component
    return <Edit systemDocData={{ ...systemDoc, map: undefined }}
                 fullSystem={systemDoc}
                 ownerDocData={firebaseContext.settings}
                 isNew={true}
                 newFromSystemId={props.newFromSystemId}
                 newMapBounds={mapBounds}
                 onToggleShowSettings={props.onToggleShowSettings}
                 onToggleShowAuth={props.onToggleShowAuth}
                 onToggleShowEmailVerification={props.onToggleShowEmailVerification}
                 onToggleShowMission={props.onToggleShowMission} />
  }

  return <Theme>
    <Metatags />
    <Header onToggleShowSettings={props.onToggleShowSettings} onToggleShowAuth={props.onToggleShowAuth} />
    <Drawer onToggleShowAuth={props.onToggleShowAuth} />

    <main className="EditNew">
      {renderFadeWrap(!firebaseContext.authStateLoading && <Start map={map} database={firebaseContext.database}
                                                                  settings={firebaseContext.settings}
                                                                  onSelectSystem={handleSelectSystem} />,
                      'start')}

      <Map system={{ lines: {}, stations: {} }} interlineSegments={{}} changing={{}} focus={{}}
            systemLoaded={false} viewOnly={false} waypointsHidden={false}
            onMapInit={handleMapInit} />
    </main>

    <Footer onToggleShowMission={props.onToggleShowMission}
            onToggleShowContribute={props.onToggleShowContribute}
            onToggleShowConduct={props.onToggleShowConduct} />
  </Theme>;
}
