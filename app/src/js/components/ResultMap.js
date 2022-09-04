import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

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
  const [segmentFeatsByOffset, setSegmentFeatsByOffset] = useState({});

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
    return () => clearInterval(interval);
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

  useEffect(() => {
    const layerID = 'js-Map-lines';
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
        "line-width": 4,
        "line-color": ['get', 'color']
      }
    };

    let featCollection = {
      "type": "FeatureCollection",
      "features": lineFeats
    };

    renderLayer(layerID, layer, featCollection, true);
  }, [lineFeats]);

  useEffect(() => {
    for (const offsetKey in segmentFeatsByOffset) {
      const layerID = 'js-Map-segments--' + offsetKey;
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
          "line-width": 4,
          "line-color": ['get', 'color'],
          "line-translate": offsetKey.split('|').map(i => parseFloat(i)),
          // this is what i acually want https://github.com/mapbox/mapbox-gl-js/issues/6155
          // "line-translate": ['[]', ['get', 'translation-x'], ['get', 'translation-y']],
        }
      };

      let featCollection = {
        "type": "FeatureCollection",
        "features": segmentFeatsByOffset[offsetKey]
      };

      renderLayer(layerID, layer, featCollection, true);
    }
  }, [segmentFeatsByOffset]);

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
      const coords = lines[lineKey].stationIds.map(id => [stations[id].lng, stations[id].lat]);
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
            "segment-longkey": segmentKey + '|' + color,
            "color": color,
            "translation-x": Math.round(segment.offsets[color][0] * 2.0) / 2.0,
            "translation-y": Math.round(segment.offsets[color][1] * 2.0) / 2.0,
          },
          "geometry": {
            "type": "LineString",
            "coordinates": interlineSegments[segmentKey].stationIds.map(id => [stations[id].lng, stations[id].lat])
          }
        }

        updatedSegmentFeatures[segmentKey + '|' + color] = data;
      }
    }

    if (Object.keys(updatedSegmentFeatures).length) {
      setSegmentFeatsByOffset(segmentFeatsByOffset => {
        let newSegments = {};

        for (const offsetKey in segmentFeatsByOffset) {
          for (const feat of segmentFeatsByOffset[offsetKey]) {
            // TODO: tidy this up a bit
            const sLKParts = feat.properties['segment-longkey'].split('|');
            if (sLKParts.length === 3) {
              const potentialSeg = interlineSegments[sLKParts.slice(0, 2).join('|')];
              if (potentialSeg && potentialSeg.colors.includes(sLKParts[2])) {
                newSegments[feat.properties['segment-longkey']] = feat;
              }
            }
          }
        }

        for (const featId in updatedSegmentFeatures) {
          if (updatedSegmentFeatures[featId].type) { // should be truthy unless intentionally removing it
            newSegments[featId] = updatedSegmentFeatures[featId];
          }
        }

        let newOffsetKeySegments = {};
        for (const seg of Object.values(newSegments)) {
          const offestKey = seg.properties['translation-x'] + '|' + seg.properties['translation-y'];
          if (!(offestKey in newOffsetKeySegments)) {
            newOffsetKeySegments[offestKey] = [];
          };
          newOffsetKeySegments[offestKey].push(seg);
        }

        return newOffsetKeySegments;
      });
    }
  }

  const renderLayer = (layerID, layer, data, underPrevLayer = false) => {
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
