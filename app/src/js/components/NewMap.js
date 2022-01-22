import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

import { checkForTransfer } from '../util.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v10';
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v10';

export function Map(props) {
  const mapEl = useRef(null);
  const [ map, setMap ] = useState();
  const [ interactive, setInteractive ] = useState(false);
  const [ focusedId, setFocusId ] = useState();
  const [ hideStations, setHideStations ] = useState(false);
  const [ useLight, setUseLight ] = useState(false);
  const [ interactive, setInteractive ] = useState(false);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: props.useLight ? LIGHT_STYLE : DARK_STYLE,
      zoom: 2
    });

    // temporarily disable map interactions
    map.boxZoom.disable();
    map.scrollZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();

    map.on('click', (e) => {
      if (e.originalEvent.cancelBubble || props.viewOnly) {
        return;
      }

      if (!(props.initial && !(props.gotData || props.newSystemSelected))) {
        const { lng, lat } = e.lngLat;

        props.onMapClick({
          lng: lng,
          lat: lat,
          id: props.meta.nextStationId,
          name: 'Station Name'
        });
      }
    });

    setMap(map);
    props.onMapInit(map);
  }, []);

  useEffect(() => {
    // This handles changing the map style
    if (props.useLight && !useLight) {
      props.onToggleMapStyle(map, LIGHT_STYLE);
      setUseLight(true);
    } else if (!props.useLight && useLight) {
      props.onToggleMapStyle(map, DARK_STYLE);
      setUseLight(false);
    }
  }, [props.useLight]);

  useEffect(() => {
    // This determines which, if any, station should be focused
    if (props.focus && props.focus.station) {
      if (props.focus.station.id !== focusedId) {
        setFocusId(props.focus.station.id);
      } else if (this.props.focus.station.id === this.state.focusedId) {
        // Already set
        console.log('already set')
      }
    } else if (focusedId !== null) {
      setFocusId(null);
    }
  }, [props.focus]);

  return (
    <div className="Map" ref={el => (mapEl.current = el)}></div>
  );
}
