import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v10';
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v10';
const SHORT_TIME = 200;
const LONG_TIME = 400;

export function ResultMap(props) {
  const mapEl = useRef(null);
  const [ map, setMap ] = useState();
  const [ styleLoaded, setStyleLoaded ] = useState(false);
  const [ hasSystem, setHasSystem ] = useState(false);
  const [ useLight, setUseLight ] = useState(false);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: props.useLight ? LIGHT_STYLE : DARK_STYLE,
      zoom: 2,
      center: props.centroid
    });

    // disable map interactions
    map.boxZoom.disable();
    map.scrollZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();

    setMap(map);
    props.onMapInit(map);

    const interval = setInterval(() => {
      if (map.isStyleLoaded() && !styleLoaded) {
        setStyleLoaded(true);
      }
    }, 100);
    return () => {
      clearInterval(interval);
      map.remove();
    };
  }, []);

  useEffect(() => {
    // This handles changing the map style
    if (map && props.useLight && !useLight) {
      map.setStyle(LIGHT_STYLE);
      map.once('styledata', () => setUseLight(true));
    } else if (map && !props.useLight && useLight) {
      map.setStyle(DARK_STYLE);
      map.once('styledata', () => setUseLight(false));
    }
  }, [props.useLight]);

  useEffect(() => {
    if (hasSystem) {
      const stations = props.system.stations;
      let bounds = new mapboxgl.LngLatBounds();
      for (const sId in stations) {
        bounds.extend(new mapboxgl.LngLat(stations[sId].lng, stations[sId].lat));
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          center: bounds.getCenter(),
          padding: 16
        });
      }
    }
  }, [hasSystem]);

  useEffect(() => setStyleLoaded(false), [useLight]);

  useEffect(() => renderSystem(), [styleLoaded]);

  useEffect(() => {
    if (props.system && Object.keys(props.system.stations || {}).length && !hasSystem) {
      renderSystem();
      setHasSystem(true);
    }
  }, [props.system]);

  const renderSystem = () => {
    if (styleLoaded) {
      handleLines();
      handleSegments();
    }
  }

  const handleLines = () => {
    const stations = props.system.stations;
    const lines = props.system.lines;

    for (const lineKey of Object.keys(lines || {})) {
      const layerID = 'js-Map-line--' + lineKey;

      const coords = lines[lineKey].stationIds.map(id => [stations[id].lng, stations[id].lat]);
      if (coords.length > 1) {
        const layer = {
          "type": "line",
          "layout": {
              "line-join": "round",
              "line-cap": "round",
              "line-sort-key": 1
          },
          "source": {
            "type": "geojson"
          },
          "paint": {
            "line-color": lines[lineKey].color,
            "line-width": 4,
            "line-opacity-transition": {duration: SHORT_TIME}
          }
        };

        const data = {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "type": "LineString",
            "coordinates": coords
          }
        }

        renderLayer(layerID, layer, data, true);
      }
    }
  }

  const handleSegments = () => {
    const stations = props.system.stations;
    const interlineSegments = props.interlineSegments;

    for (const segmentKey of Object.keys(interlineSegments || {})) {

      const segment = interlineSegments[segmentKey];
      for (const color of segment.colors) {
        const layerID = 'js-Map-segment--' + segmentKey + '|' + color;

        const layer = {
          "type": "line",
          "layout": {
              "line-join": "round",
              "line-cap": "round",
              "line-sort-key": 2,
          },
          "source": {
            "type": "geojson"
          },
          "paint": {
            "line-color": color,
            "line-width": 4,
            "line-translate": segment.offsets[color],
            "line-opacity-transition": {duration: SHORT_TIME}
          }
        };

        const data = {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "type": "LineString",
            "coordinates": interlineSegments[segmentKey].stationIds.map(id => [stations[id].lng, stations[id].lat])
          }
        }

        renderLayer(layerID, layer, data);
      }
    }
  }

  const renderLayer = (layerID, layer, data, underPrevLayer = false) => {
    if (map) {
      initialLinePaint(layer, layerID, data);
    }
  }

  const initialLinePaint = (layer, layerID, data, finalOpacity) => {
    // Initial paint of line
    if (!map.getLayer(layerID)) {
      let newLayer = JSON.parse(JSON.stringify(layer));
      newLayer.id = layerID;
      newLayer.source.data = data;
      newLayer.paint['line-opacity'] = 1;
      newLayer.paint['line-opacity-transition']['duration'] = LONG_TIME;
      map.addLayer(newLayer);
    }

    if (!map.getLayer(layerID + '-prev')) {
      let prevLayer = JSON.parse(JSON.stringify(layer));
      prevLayer.id = layerID + '-prev';
      prevLayer.source.data = data;
      prevLayer.paint['line-opacity'] = 1;
      map.addLayer(prevLayer);
    }
  }

  return (
    <div className="Map Map--searchResult" ref={el => (mapEl.current = el)}></div>
  );
}
