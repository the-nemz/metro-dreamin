import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

import { getLineIconPath, stationIdsToMultiLineCoordinates } from '/util/helpers.js';

import { COLOR_TO_NAME, FLY_TIME, LINE_ICON_SHAPE_SET } from '/util/constants.js';

mapboxgl.accessToken = 'pk.eyJ1IjoiaWpuZW16ZXIiLCJhIjoiY2xma3B0bW56MGQ4aTQwczdsejVvZ2cyNSJ9.FF2XWl1MkT9OUVL_HBJXNQ';
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v10';
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v10';

export function ResultMap(props) {
  const [ map, setMap ] = useState();
  const [ styleLoaded, setStyleLoaded ] = useState(false);
  const [ hasSystem, setHasSystem ] = useState(false);
  const [ useLight, setUseLight ] = useState(props.useLight);
  const [ segmentFeats, setSegmentFeats ] = useState([]);

  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const systemRef = useRef(null);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: props.useLight ? LIGHT_STYLE : DARK_STYLE,
      projection: 'globe',
      zoom: 2
    });

    // disable map interactions
    map.boxZoom.disable();
    map.scrollZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();

    map.on('webglcontextlost', onContextLost);

    mapRef.current = map;
    setMap(map);
    props.onMapInit(map);

    const interval = setInterval(() => {
      if (mapRef.current.isStyleLoaded() && !styleLoaded) {
        setStyleLoaded(true);
      }
    }, 100);
    return () => {
      clearInterval(interval);
      mapRef.current.remove();
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
      fitMapToStations(FLY_TIME);
    }
  }, [hasSystem]);

  useEffect(() => setStyleLoaded(false), [useLight]);

  useEffect(() => {
    if (!styleLoaded) return;

    renderSystem();

    if (!map) return;

    const loadPointIcon = async (key, icon) => {
      if (map.hasImage(key)) return;

      map.loadImage(icon,
                    (error, image) => {
                      if (error) throw error;
                      // Add the loaded image to the style's sprite with the ID 'kitten'.
                      map.addImage(key, image);
                    }
      );
    }

    for (const line of Object.values(props.system.lines || {})) {
      if (line.icon && LINE_ICON_SHAPE_SET.has(line.icon) && COLOR_TO_NAME[line.color]) {
        const colorName = COLOR_TO_NAME[line.color];
        loadPointIcon(`md_${line.icon}_${colorName}`, getLineIconPath(line.icon, colorName));
      }
    }
  }, [styleLoaded, map]);

  useEffect(() => {
    systemRef.current = props.system;

    if (props.system && Object.keys(props.system.stations || {}).length && !hasSystem) {
      renderSystem();
      setHasSystem(true);
    }
  }, [props.system]);

  useEffect(() => {
    let solidSegments = [];
    let iconSegments = [];
    for (const segmentFeat of segmentFeats) {
      if (segmentFeat.properties?.icon) {
        iconSegments.push(segmentFeat);
      } else {
        solidSegments.push(segmentFeat);
      }
    }

    let linePaintConfig = {
      'line-width': 4,
      'line-offset': ['*', ['get', 'offset'], 4]
    }

    if (props.zoomThresholdsForLines?.length === 3) {
      linePaintConfig = {
        'line-width': [
          'step',
          ['zoom'],
          1,
          props.zoomThresholdsForLines[0], 2,
          props.zoomThresholdsForLines[1], 3,
          props.zoomThresholdsForLines[2], 4
        ],
        'line-offset': [
          'step',
          ['zoom'],
          ['*', ['get', 'offset'], 1],
          props.zoomThresholdsForLines[0], ['*', ['get', 'offset'], 2],
          props.zoomThresholdsForLines[1], ['*', ['get', 'offset'], 3],
          props.zoomThresholdsForLines[2], ['*', ['get', 'offset'], 4]
        ]
      }
    }

    const layerIDSolid = 'js-Map-segments--solid';
    const layerSolid = {
      "type": "line",
      "layout": {
        "line-join": "miter",
        "line-cap": "butt",
        "line-sort-key": 1
      },
      "source": {
        "type": "geojson"
      },
      "paint": {
        ...linePaintConfig,
        "line-color": ["get", "color"]
      }
    };

    let featCollectionSolid = {
      "type": "FeatureCollection",
      "features": solidSegments
    };

    const layerIDIcon = 'js-Map-segments--icon';
    const layerIcon = {
      "type": "line",
      "layout": {
        "line-join": "none",
        "line-sort-key": 1
      },
      "source": {
        "type": "geojson"
      },
      "paint": {
        ...linePaintConfig,
        "line-pattern": ["get", "icon"]
      }
    };

    let featCollectionIcon = {
      "type": "FeatureCollection",
      "features": iconSegments
    };

    renderLayer(layerIDSolid, layerSolid, featCollectionSolid);
    renderLayer(layerIDIcon, layerIcon, featCollectionIcon);
  }, [segmentFeats]);

  // too many maps added/removed, so we need to basically reset the map
  const onContextLost = () => {
    if (!mapEl.current) return;

    setStyleLoaded(false);

    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: props.useLight ? LIGHT_STYLE : DARK_STYLE,
      projection: 'globe',
      zoom: 2
    });

    // disable map interactions
    map.boxZoom.disable();
    map.scrollZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();

    map.on('webglcontextlost', onContextLost);

    mapRef.current = map;
    setMap(map);
    props.onMapInit(map);

    fitMapToStations(0); // do not fly
  }

  // fits map to station bounds
  // uses refs as this can be called in a listener set up on load
  const fitMapToStations = (animationDuration = FLY_TIME) => {
    const stations = (systemRef.current || props.system).stations;
    let bounds = new mapboxgl.LngLatBounds();

    let center;
    if (props.centroid && 'lat' in props.centroid && 'lng' in props.centroid) {
      center = [ props.centroid.lng, props.centroid.lat ];
    }

    for (const sId in stations) {
      if (!('lng' in stations[sId] && 'lat' in stations[sId])) continue;
      bounds.extend(new mapboxgl.LngLat(stations[sId].lng, stations[sId].lat));
    }

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, {
        center: center || bounds.getCenter(),
        padding: 16,
        animation: !props.noZoom,
        duration: props.noZoom ? 0 : animationDuration
      });
    }
  }

  const renderSystem = () => {
    if (styleLoaded) {
      handleSegments();
    }
  }

  const handleSegments = () => {
    const stations = props.system.stations;
    const interlineSegments = props.interlineSegments;

    let updatedSegmentFeatures = {};

    for (const segmentKey of Object.keys(interlineSegments || {})) {
      const segment = interlineSegments[segmentKey];
      const coords = stationIdsToMultiLineCoordinates(stations, segment.stationIds);

      for (const pattern of segment.patterns) {
        const iconName = pattern.icon ? pattern.icon : 'solid';
        const data = {
          "type": "Feature",
          "properties": {
            "segment-key": segmentKey,
            "segment-longkey": segmentKey + '|' + pattern.color + '|' + iconName,
            "color": pattern.color,
            "icon": pattern.icon,
            "offset": segment.offsets[`${pattern.color}|${iconName}`]
          },
          "geometry": {
            "type": "MultiLineString",
            "coordinates": coords
          }
        }

        updatedSegmentFeatures[segmentKey + '|' + pattern.color + '|' + iconName] = data;
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

            if (segKey in interlineSegments) {
              let isStillPresent = false;
              for (const pattern of (interlineSegments[segKey].patterns || [])) {
                if (feat.properties['icon'] && pattern.icon && feat.properties['icon'] === pattern.icon) {
                  isStillPresent = true;
                  break;
                } else if (!feat.properties['icon'] && !pattern.icon && feat.properties['color'] === pattern.color) {
                  isStillPresent = true;
                  break;
                }
              }
              if (isStillPresent) {
                newSegments.push(feat);
                newSegmentsHandled.add(feat.properties['segment-longkey']);
              }
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
