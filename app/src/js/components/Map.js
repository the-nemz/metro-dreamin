import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import turfAlong from '@turf/along';
import turfCircle from '@turf/circle';
import { lineString as turfLineString } from '@turf/helpers';
import turfLength from '@turf/length';

import { checkForTransfer, getMode, partitionSections } from '../util.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v10';
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v10';
const FLY_TIME = 4000;

export function Map(props) {
  const mapEl = useRef(null);
  const [ map, setMap ] = useState();
  const [ styleLoaded, setStyleLoaded ] = useState(false);
  const [ hasSystem, setHasSystem ] = useState(false);
  const [ clickListened, setClickListened ] = useState(false);
  const [ enableClicks, setEnableClicks ] = useState(false);
  const [ interactive, setInteractive ] = useState(false);
  const [ focusedIdPrev, setFocusedIdPrev ] = useState();
  const [ focusedId, setFocusedId ] = useState();
  const [ useLight, setUseLight ] = useState(props.useLight);
  const [lineFeats, setLineFeats] = useState([]);
  const [segmentFeatsByOffset, setSegmentFeatsByOffset] = useState({});

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
        setFocusedIdPrev(focusedId);
        setFocusedId(props.focus.station.id);
      } else if (props.focus.station.id === focusedId) {
        // Already set
      }
    } else if (focusedId !== null) {
      setFocusedIdPrev(focusedId);
      setFocusedId(null);
    }
  }, [props.focus]);

  useEffect(() => {
    if (enableClicks && !clickListened) {
      map.on('click', (e) => {
        if (e.originalEvent.cancelBubble) {
          return;
        }

        const { lng, lat } = e.lngLat;
        props.onMapClick(lat, lng);
      });

      setClickListened(true);
    }
  }, [enableClicks]);

  useEffect(() => {
    const stations = props.system.stations;
    if (props.initial) {
      let bounds = new mapboxgl.LngLatBounds();
      for (const sId in stations) {
        bounds.extend(new mapboxgl.LngLat(stations[sId].lng, stations[sId].lat));
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          center: bounds.getCenter(),
          padding: Math.min(window.innerHeight, window.innerWidth) / 10,
          duration: FLY_TIME
        });

        setTimeout(() => setEnableClicks(true), FLY_TIME - 1000);
      }

      if (!bounds.isEmpty() || props.newSystemSelected) {
        enableStationsAndInteractions();
      }
    }
  }, [props.initial, props.system, map]);

  useEffect(() => {
    if (props.newSystemSelected) {
      setTimeout(() => setEnableClicks(true), FLY_TIME - 1000);
    }
  }, [props.newSystemSelected]);

  useEffect(() => handleStations(), [focusedId]);

  useEffect(() => renderSystem(), [styleLoaded]);

  useEffect(() => {
    if (Object.keys(props.changing).length) {
      renderSystem();
    }
  }, [props.changing]);

  useEffect(() => {
    if (Object.keys(props.system.stations).length && !hasSystem) {
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
        "line-width": 8,
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
    const existingLayers = map ? map.getStyle().layers : [];
    for (const existingLayer of existingLayers.filter(eL => eL.id.startsWith('js-Map-segments--'))) {
      if (!(existingLayer.id.replace('js-Map-segments--', '') in segmentFeatsByOffset)) {
        // remove layers for this segment offset
        if (map.getLayer(existingLayer.id)) {
          map.removeLayer(existingLayer.id);
          map.removeSource(existingLayer.id);
        }
      }
    }

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
          "line-width": 8,
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

    for (const existingLayer of existingLayers) {
      if (existingLayer.id.startsWith('js-Map-vehicles--')) {
        map.moveLayer(existingLayer.id);
      }
    }
  }, [segmentFeatsByOffset]);

  const enableStationsAndInteractions = () => {
    if (map && !interactive) {
      setTimeout(() => {
        // re-enable map interactions
        map.boxZoom.enable();
        map.scrollZoom.enable();
        map.dragPan.enable();
        map.dragRotate.enable();
        map.keyboard.enable();
        map.doubleClickZoom.enable();
        map.touchZoomRotate.enable();
      }, FLY_TIME - 1000);
      setInteractive(true);
    }
  }

  // get the index of the section where the vehicle is
  const getSectionIndex = (sections, prevStationId, prevSectionIndex, forward) => {
    let sectionIndex = Math.floor(Math.random() * sections.length); // grab a random section
    if (prevStationId || (prevSectionIndex || prevSectionIndex === 0)) {
      let currentSectionIndexForStation;
      for (const [i, sect] of sections.entries()) {
        if (forward && sect[0] === prevStationId) { // station would be at start of section
          if (currentSectionIndexForStation == null || Math.abs(i - (prevSectionIndex || 0)) <= 1) { // handle case where station appears twice in line
            currentSectionIndexForStation = i;
          }
        } else if (!forward && sect[sect.length - 1] === prevStationId) { // station would be at end of section
          if (currentSectionIndexForStation == null || Math.abs(i - (prevSectionIndex || 0)) <= 1) { // handle case where station appears twice in line
            currentSectionIndexForStation = i;
          }
        }
      }

      sectionIndex = currentSectionIndexForStation;
      if (sectionIndex == null) {
        // station no longer exists on line; use vehicle's last section index
        if (forward) {
          sectionIndex = Math.min(Math.max(prevSectionIndex - 1, 0), sections.length - 1);
        } else {
          sectionIndex = Math.max(Math.min(prevSectionIndex, sections.length - 1), 0);
        }
      }
    }

    return sectionIndex;
  }

  const handleVehicles = (lines) => {
    const vehicleLayerId = `js-Map-vehicles--${(new Date()).getTime()}`;

    let vehicleValuesByLineId = {};
    let layerIdToRemove;
    const existingLayers = map ? map.getStyle().layers : [];
    for (const existingLayer of existingLayers.filter(eL => eL.id.startsWith('js-Map-vehicles--'))) {
      const existingSource = map.getSource(existingLayer.id);
      if (existingSource) {
        for (const feat of existingSource._data.features) {
          if (feat.properties.lineKey) {
            vehicleValuesByLineId[feat.properties.lineKey] = {
              'lineKey': feat.properties.lineKey,
              'color': feat.properties.color,
              'prevStationId': feat.properties.prevStationId,
              'prevSectionIndex': feat.properties.prevSectionIndex,
              'speed': feat.properties.speed,
              'distance': feat.properties.distance,
              'forward': feat.properties.forward,
              'isCircular': feat.properties.isCircular
            }
          }
        }
      }
      layerIdToRemove = existingLayer.id;
    }

    let vehicles = {
      "type": "FeatureCollection",
      "features": []
    };
    for (const line of Object.values(lines)) {
      if ((line.stationIds || []).length <= 1) continue;

      let vehicleValues = {};
      if (line.id in vehicleValuesByLineId) {
        vehicleValues = vehicleValuesByLineId[line.id];
      } else {
        vehicleValues.isCircular = line.stationIds[0] === line.stationIds[line.stationIds.length - 1];
        vehicleValues.existingVehicleId = null;
        vehicleValues.prevStationId = null;
        vehicleValues.prevSectionIndex = null;
        vehicleValues.speed = 0;
        vehicleValues.distance = 0;
        vehicleValues.lastTime = null;
        vehicleValues.forward = vehicleValues.isCircular ? true : Math.random() < 0.5; // circular lines always go in the same direction
      }

      const sections = partitionSections(line, props.system.stations);
      let sectionIndex = getSectionIndex(sections, vehicleValues.prevStationId, vehicleValues.prevSectionIndex, vehicleValues.forward);
      let sectionCoords = sections[sectionIndex].map(id => [props.system.stations[id].lng, props.system.stations[id].lat]);
      let backwardCoords = sectionCoords.slice().reverse();

      // add new vehicle
      const vehicleData = {
        "type": "Feature",
        "properties": {
          'lineKey': line.id,
          'color': line.color,
          'prevStationId': sections[sectionIndex][vehicleValues.forward ? 0 : sections[sectionIndex].length - 1],
          'prevSectionIndex': sectionIndex,
          'speed': vehicleValues.speed,
          'distance': vehicleValues.distance,
          'forward': vehicleValues.forward,
          'isCircular': vehicleValues.isCircular
        },
        "geometry": {
          'type': 'Point',
          'coordinates': sectionCoords[0],
        }
      }
      vehicles.features.push(vehicleData);

      // get the distance of the section to interpolate along it
      vehicleValues.routeDistance = turfLength(turfLineString(sectionCoords));

      vehicleValues.sections = sections;
      vehicleValues.sectionIndex = sectionIndex;
      vehicleValues.sectionCoords = {
        forwards: sectionCoords,
        backwards: backwardCoords
      }

      vehicleValuesByLineId[line.id] = vehicleValues;
    }

    if (!map.getLayer(vehicleLayerId)) {
      let newVehicleLayer = {
        'source': {
          'type': 'geojson'
        },
        'type': 'circle',
        'paint': {
          'circle-radius': 14,
          'circle-color': ['get', 'color'],
        }
      }
      renderLayer(vehicleLayerId, newVehicleLayer, vehicles, true);
    }

    if (layerIdToRemove) {
      // remove existing vehicles a moment later to ensure smooth transition with no rendering flash
      setTimeout(() => {
        if (map.getLayer(layerIdToRemove)) {
          map.removeLayer(layerIdToRemove);
          map.removeSource(layerIdToRemove);
        }
      }, 100);
    }

    // vehicle travels 60x actual speed, so 60 km/min instead of 60 kph irl
    const animateVehicles = (time) => {
      let updatedVehicles = {
        "type": "FeatureCollection",
        "features": []
      };

      for (const line of Object.values(lines)) {
        let vehicleValues = vehicleValuesByLineId[line.id];
        if (!vehicleValues) continue;
        if (!vehicleValues.lastTime) vehicleValues.lastTime = time;

        if (!vehicleValues.pauseTime || time - vehicleValues.pauseTime >= getMode(line.mode).pause) { // check if vehicle is paused at a station
          delete vehicleValues.pauseTime;

          const mode = getMode(line.mode);
          const accelDistance = mode.speed / mode.acceleration;
          const noTopSpeed = vehicleValues.routeDistance < accelDistance * 2; // distance is too short to reach top speed

          if (vehicleValues.distance > (noTopSpeed ? vehicleValues.routeDistance / 2 : vehicleValues.routeDistance - accelDistance)) {
            // if vehicle is slowing down approaching a station
            const slowingDist = vehicleValues.distance - (noTopSpeed ? vehicleValues.routeDistance / 2 : vehicleValues.routeDistance - accelDistance); // how far past the braking point it is
            const topSpeedRatio = noTopSpeed ? (vehicleValues.routeDistance / (accelDistance * 2)) : 1; // what percentage of the top speed it gets to in this section
            const slowingDistanceRatio = slowingDist / (noTopSpeed ? (vehicleValues.routeDistance / 2) : accelDistance); // percentage of the braking zone it has gone through
            const slowingSpeed = mode.speed * topSpeedRatio * (1 - slowingDistanceRatio); // current speed in deceleration
            vehicleValues.speed = Math.max(slowingSpeed, 0.1);
          } else if (vehicleValues.distance <= (noTopSpeed ? vehicleValues.routeDistance / 2 : accelDistance)) {
            // if vehicle is accelerating out of a station
            vehicleValues.speed = Math.max(mode.speed * (vehicleValues.distance / accelDistance), 0.1);
          } else {
            // vehicle is at top speed
            vehicleValues.speed = mode.speed;
          }

          vehicleValues.distance += vehicleValues.speed * (time - vehicleValues.lastTime) / 1000;
        }

        vehicleValues.lastTime = time;
        // console.log('here1')

        try {
          // find coordinates along route
          const alongRoute = turfAlong(
            turfLineString(vehicleValues.forward ? vehicleValues.sectionCoords.forwards : vehicleValues.sectionCoords.backwards),
            vehicleValues.distance
          ).geometry.coordinates;

          updatedVehicles.features.push({
            "type": "Feature",
            "properties": {
              'lineKey': line.id,
              'color': line.color,
              'prevStationId': vehicleValues.sections[vehicleValues.sectionIndex][vehicleValues.forward ? 0 : vehicleValues.sections[vehicleValues.sectionIndex].length - 1],
              'prevSectionIndex': vehicleValues.sectionIndex,
              'speed': vehicleValues.speed,
              'distance': vehicleValues.distance,
              'lastTime': time,
              'forward': vehicleValues.forward,
              'isCircular': vehicleValues.isCircular
            },
            "geometry": {
              'type': 'Point',
              'coordinates': [alongRoute[0], alongRoute[1]],
            }
          });
        } catch (e) {
          console.error('animateVehicle error:', e);
        }

        // when vehicle has made it 100% of the way to the next station, calculate the next animation
        if (vehicleValues.distance > vehicleValues.routeDistance) {
          const currSection = vehicleValues.sections[vehicleValues.sectionIndex];
          const destStationId = vehicleValues.forward ? currSection[currSection.length - 1] : currSection[0];
          const destIsWaypoint = props.system.stations[destStationId].isWaypoint;

          // move to next section
          vehicleValues.sectionIndex += vehicleValues.forward ? 1 : -1;
          vehicleValues.lastTime = null;
          vehicleValues.speed = 0.0;
          vehicleValues.distance = 0.0;

          if (vehicleValues.sectionIndex >= vehicleValues.sections.length) {
            vehicleValues.sectionIndex = vehicleValues.isCircular ? 0 : vehicleValues.sections.length - 1;
            vehicleValues.forward = vehicleValues.isCircular ? vehicleValues.forward : !vehicleValues.forward; // circular lines do not switch direction
          } else if (vehicleValues.sectionIndex < 0) {
            vehicleValues.sectionIndex = 0;
            vehicleValues.forward = vehicleValues.isCircular ? vehicleValues.forward : !vehicleValues.forward; // circular lines do not switch direction
          }

          vehicleValues.sectionCoords.forwards = vehicleValues.sections[vehicleValues.sectionIndex].map(id => [props.system.stations[id].lng, props.system.stations[id].lat]);
          vehicleValues.sectionCoords.backwards = vehicleValues.sectionCoords.forwards.slice().reverse();
          vehicleValues.routeDistance = turfLength(turfLineString(vehicleValues.sectionCoords.forwards));

          if (!destIsWaypoint) {
            // pause at non-waypoints; amount of pause time comes from line mode
            vehicleValues.pauseTime = time;
          }
        }

        vehicleValuesByLineId[line.id] = vehicleValues;
      }

      let source = map.getSource(vehicleLayerId);
      if (source) {
        source.setData(updatedVehicles);
      } else {
        return;
      }

      requestAnimationFrame(animateVehicles);
    }

    requestAnimationFrame(animateVehicles);
  }

  const renderSystem = () => {
    if (styleLoaded) {
      handleStations();
      handleLines();
      handleSegments();
    }
  }

  const handleStations = () => {
    const stations = props.system.stations;
    const lines = props.system.lines;

    let stationIdsToHandle = [];
    if (props.changing.all) {
      stationIdsToHandle = Object.keys(stations);
    } else if (props.changing.stationIds) {
      stationIdsToHandle = props.changing.stationIds;
    }

    if (focusedId) {
      stationIdsToHandle.push(focusedId);
    }
    if (focusedIdPrev) {
      stationIdsToHandle.push(focusedIdPrev);
    }

    if (stationIdsToHandle.length) {
      const stationKeys = Object.keys(stations);
      for (const id of stationIdsToHandle) {
        const pin = document.getElementById('js-Map-station--' + id);
        const circleId = 'js-Map-focusCircle--' + id;
        if (stationKeys.includes(id) || props.initial) {
          if (pin) {
            pin.parentNode.removeChild(pin);
          }

          const { lng, lat } = stations[id];

          let color = '#888';
          let hasTransfer = false;
          for (const lineKey in lines) {
            if (lines[lineKey].stationIds.includes(id)) {
              color = '#fff';
              for (const otherLineKey in lines) {
                if (lineKey !== otherLineKey && checkForTransfer(id, lines[lineKey], lines[otherLineKey])) {
                  hasTransfer = true
                  break;
                }
              }
              if (hasTransfer) {
                break;
              };
            }
          }

          const svgWaypoint = `<svg height="16" width="16">
                                 <line x1="4" y1="4" x2="12" y2="12" stroke="${useLight ? '#353638' : '#e6e5e3'}" stroke-width="2" />
                                 <line x1="4" y1="12" x2="12" y2="4" stroke="${useLight ? '#353638' : '#e6e5e3'}" stroke-width="2" />
                               </svg>`;

          const svgStation = `<svg height="16" width="16">
                                <circle cx="8" cy="8" r="6" stroke="#000" stroke-width="2" fill="${color}" />
                              </svg>`;

          const svgInterchange = `<svg height="20" width="20">
                                    <rect rx="3" ry="3" x="0" y="0" height="14.14" width="14.14" stroke="#000" stroke-width="2" fill="${color}" transform="translate(10, 0) rotate(45)" />
                                  </svg>`;

          let el = document.createElement('button');
          el.id = 'js-Map-station--' + id;
          el.className = 'js-Map-station Map-station';
          if (stations[id].isWaypoint) {
            el.className += ' Map-station--waypoint';
          } else if (hasTransfer) {
            el.className += ' Map-station--interchange';
          }

          if (id === focusedId) {
            el.className += ' js-Map-station--focused Map-station--focused';

            if (!stations[id].isWaypoint && !map.getLayer(circleId)) {
              const circleData = turfCircle([parseFloat(lng), parseFloat(lat)], 0.5, {units: 'miles'});
              const circleLayer = {
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
                  "line-color": useLight ? '#353638' : '#e6e5e3',
                  "line-width": 4,
                  "line-opacity": 0.5
                }
              };

              circleLayer.id = circleId;
              circleLayer.source.data = circleData;
              map.addLayer(circleLayer);
            } else if (stations[id].isWaypoint && map.getLayer(circleId)) {
              map.removeLayer(circleId);
              map.removeSource(circleId);
            }
          } else if (id === focusedIdPrev && map.getLayer(circleId)) {
            map.removeLayer(circleId);
            map.removeSource(circleId);
          }

          el.dataset.tip = stations[id].isWaypoint ? 'Waypoint' : stations[id].name || 'Station';
          el.innerHTML = stations[id].isWaypoint ? svgWaypoint : (hasTransfer ? svgInterchange : svgStation);

          el.addEventListener('click', (e) => {
            props.onStopClick(id);
            e.stopPropagation();
          });

          new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .addTo(map);
        } else {
          if (pin) {
            pin.parentNode.removeChild(pin);
          }
          if (map.getLayer(circleId)) {
            map.removeLayer(circleId);
            map.removeSource(circleId);
          }
        }
      }
    }
  }

  const handleLines = () => {
    const stations = props.system.stations;
    const lines = props.system.lines;

    let updatedLineFeatures = {};
    if (props.changing.lineKeys || props.changing.all) {
      for (const lineKey of (props.changing.all ? Object.keys(lines) : props.changing.lineKeys)) {
        if (!(lineKey in lines) || lines[lineKey].stationIds.length <= 1) {
          updatedLineFeatures[lineKey] = {};

          const existingLayers = map ? map.getStyle().layers : [];
          for (const existingLayer of existingLayers.filter(eL => eL.id.startsWith('js-Map-vehicle--'))) {
            if (existingLayer.id.replace('js-Map-vehicle--', '').split('|')[0] === lineKey) {
              // remove the previous vehicle
              map.removeLayer(existingLayer.id);
              map.removeSource(existingLayer.id);
            }
          }

          continue;
        }

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
      }
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

    handleVehicles(lines);
  }

  const handleSegments = () => {
    const stations = props.system.stations;
    const lines = props.system.lines;
    const interlineSegments = props.interlineSegments;

    let updatedSegmentFeatures = {};
    for (const segmentKey of (props.changing.all ? Object.keys(interlineSegments) : (props.changing.segmentKeys || []))) {
      if (!(segmentKey in interlineSegments)) {
        for (const lineKey of Object.keys(lines)) {
          updatedSegmentFeatures[segmentKey + '|' + lines[lineKey].color] = {};
        }
        continue;
      }

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
            const segLongKeyParts = feat.properties['segment-longkey'].split('|'); // stationId stationId color
            if (segLongKeyParts.length === 3) {
              const potentialSeg = interlineSegments[segLongKeyParts.slice(0, 2).join('|')]; // "stationId|stationId"
              if (potentialSeg && potentialSeg.colors.includes(segLongKeyParts[2])) {
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
    <div className="Map" ref={el => (mapEl.current = el)}></div>
  );
}
