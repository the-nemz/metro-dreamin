import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

import { stationIdsToCoordinates } from '/lib/util.js';

import { FLY_TIME } from '/lib/constants.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v10';
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v10';

export function ResultMap(props) {
  const mapEl = useRef(null);
  const [ map, setMap ] = useState();
  const [ styleLoaded, setStyleLoaded ] = useState(false);
  const [ hasSystem, setHasSystem ] = useState(false);
  const [ useLight, setUseLight ] = useState(props.useLight);
  const [lineFeats, setLineFeats] = useState([]);
  const [segmentFeats, setSegmentFeats] = useState([]);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: props.useLight ? LIGHT_STYLE : DARK_STYLE,
      zoom: 2,
      center: props.centroid || [ 0, 0 ]
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
          padding: 16,
          animation: !props.noZoom,
          duration: props.noZoom ? 0 : FLY_TIME
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

  useEffect(() => {
    const layerID = 'js-Map-lines';
    const layer = {
      "type": "line",
      "layout": {
        "line-join": "miter",
        "line-cap": "square",
        "line-sort-key": 1
      },
      "source": {
        "type": "geojson"
      },
      "paint": {
        "line-width": 4,
        "line-color": ['get', 'color']
      }
    };

    let featCollection = {
      "type": "FeatureCollection",
      "features": lineFeats
    };

    renderLayer(layerID, layer, featCollection);
  }, [lineFeats]);

  useEffect(() => {
    const layerID = 'js-Map-segments';
    const layer = {
      "type": "line",
      "layout": {
        "line-join": "miter",
        "line-cap": "square",
        "line-sort-key": 1
      },
      "source": {
        "type": "geojson"
      },
      "paint": {
        "line-width": 4,
        "line-color": ['get', 'color'],
        "line-offset": ['get', 'offset']
      }
    };

    let featCollection = {
      "type": "FeatureCollection",
      "features": segmentFeats
    };

    renderLayer(layerID, layer, featCollection);
  }, [segmentFeats]);

  const renderSystem = () => {
    if (styleLoaded) {
      handleLines();
      handleSegments();
    }
  }

  const handleLines = () => {
    const stations = props.system.stations;
    const lines = props.system.lines;

    let updatedLineFeatures = {};
    for (const lineKey of Object.keys(lines || {})) {
      const coords = stationIdsToCoordinates(stations, lines[lineKey].stationIds);
      if (coords.length > 1) {
        const feature = {
          "type": "Feature",
          "properties": {
            "line-key": lineKey,
            "color": lines[lineKey].color
          },
          "geometry": {
            "type": "LineString",
            "coordinates": coords
          }
        }

        updatedLineFeatures[lineKey] = feature;
      }

      if (Object.keys(updatedLineFeatures).length) {
        setLineFeats(lineFeats => {
          let newFeats = {};
          for (const feat of lineFeats) {
            newFeats[feat.properties['line-key']] = feat;
          }
          for (const featId in updatedLineFeatures) {
            newFeats[featId] = updatedLineFeatures[featId];
          }
          return Object.values(newFeats).filter(nF => nF.type);
        });
      }
    }
  }

  const handleSegments = () => {
    const stations = props.system.stations;
    const interlineSegments = props.interlineSegments;

    let updatedSegmentFeatures = {};

    for (const segmentKey of Object.keys(interlineSegments || {})) {
      const segment = interlineSegments[segmentKey];

      for (const color of segment.colors) {
        const data = {
          "type": "Feature",
          "properties": {
            "segment-key": segmentKey,
            "segment-longkey": segmentKey + '|' + color,
            "color": color,
            "offset": segment.offsets[color]
          },
          "geometry": {
            "type": "LineString",
            "coordinates": stationIdsToCoordinates(stations, interlineSegments[segmentKey].stationIds)
          }
        }

        updatedSegmentFeatures[segmentKey + '|' + color] = data;
      }
    }

    if (Object.keys(updatedSegmentFeatures).length) {
      setSegmentFeats(segmentFeats => {
        let newSegments = [];
        let newSegmentsHandled = new Set();
        for (const featId in updatedSegmentFeatures) {
          if (updatedSegmentFeatures[featId].type) { // should be truthy unless intentionally removing it
            newSegments.push(updatedSegmentFeatures[featId]);
          }
          newSegmentsHandled.add(featId);
        }

        for (const feat of segmentFeats) {
          if (!newSegmentsHandled.has(feat.properties['segment-longkey'])) {
            const segKey = feat.properties['segment-key'];
            if (segKey in interlineSegments && interlineSegments[segKey].colors.includes(feat.properties['color'])) {
              newSegments.push(feat);
              newSegmentsHandled.add(feat.properties['segment-longkey']);
            }
          }
        }
        return newSegments;
      });
    }
  }

  const renderLayer = (layerID, layer, data) => {
    if (map) {
      if (map.getLayer(layerID)) {
        // Update layer with new features
        map.getSource(layerID).setData(data);
      } else {
        initialLinePaint(layer, layerID, data);
      }
    }
  }

  const initialLinePaint = (layer, layerID, data) => {
    // Initial paint of line
    if (!map.getLayer(layerID)) {
      let newLayer = JSON.parse(JSON.stringify(layer));
      newLayer.id = layerID;
      newLayer.source.data = data;
      map.addLayer(newLayer);
    }
  }

  return (
    <div className="Map Map--searchResult" ref={el => (mapEl.current = el)}></div>
  );
}
