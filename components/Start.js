import React, { useState, useRef, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import ReactGA from 'react-ga4';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';;

import { getNextSystemNumStr } from '/lib/util.js';
import { INITIAL_SYSTEM, INITIAL_META } from '/lib/constants.js';

export function Start(props) {
  const [systemChoices, setSystemChoices] = useState({});

  const geocoderRef = useRef(null);

  useEffect(() => {
    loadDefaultData();

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      types: 'place,district,region,country',
      placeholder: 'e.g. Berlin, Germany or Japan'
    });

    geocoder.addTo(geocoderRef.current);

    geocoder.on('result', (e) => handleCustomSelected(e.result));

    return () => geocoder.off('result', () => {});
  }, [])

  const loadDefaultData = () => {
    if (props.database === null) {
      return;
    }

    const defaultSystemsCollection = collection(props.database, 'defaultSystems');
    const defaultSystemsQuery = query(defaultSystemsCollection, orderBy('title'));

    getDocs(defaultSystemsQuery)
      .then(async (systemsSnapshot) => {
        let sysChoices = {};
        for (const sDoc of systemsSnapshot.docs) {
          const sysDocData = sDoc.data();
          sysChoices[sysDocData.defaultId] = sysDocData;
        }

        setSystemChoices(sysChoices);
      })
      .catch((error) => {
        console.log("Error getting documents: ", error);
      });
  }

  const handleCustomSelected = (result) => {
    if (result.place_name) {
      let system = INITIAL_SYSTEM;
      system.title = result.place_name;

      let meta = INITIAL_META;
      meta.systemNumStr = getNextSystemNumStr(props.settings);
      props.onSelectSystem(system, meta, result.bbox, []);

      ReactGA.event({
        category: 'New',
        action: 'Select Custom Map'
      });
    }
  }

  const renderDefaultChoices = () => {
    if (Object.keys(systemChoices).length) {
      let choices = [];
      for (const system of Object.values(systemChoices)) {
        choices.push(
          <Link className="Start-defaultChoice" key={system.defaultId}
                href={{
                  pathname: '/edit/new',
                  query: { fromDefault: system.defaultId },
                }}
                onClick={() => ReactGA.event({
                  category: 'New',
                  action: 'Select Default Map',
                  value: system.defaultId
                })}>
            {system.title ? system.title : 'Unnamed System'}
          </Link>
        );
      }
      return(
        <div className="Start-defaultChoices">
          {choices}
        </div>
      );
    }
    return '';
  }

  return (
    <div className="Start FadeAnim">
      <div className="Start-upper">
        <div className="Start-heading">
          Start from a preset city
        </div>
        {renderDefaultChoices()}
      </div>
      <div className="Start-lower">
        <div className="Start-heading">
          Search for a different city
        </div>

        <div className="Start-geocoderWrap" ref={geocoderRef}>
          {/* geocoder inserted here */}
        </div>
      </div>
    </div>
  );
}
