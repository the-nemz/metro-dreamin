import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import turfAlong from '@turf/along';
import turfCircle from '@turf/circle';
import { lineString as turfLineString } from '@turf/helpers';
import turfLength from '@turf/length';

import { checkForTransfer, getMode, partitionSections, stationIdsToCoordinates, floatifyStationCoord } from '../util.js';

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
  const [ focusBlink, setFocusBlink ] = useState(false);
  const [ focusedIdPrev, setFocusedIdPrev ] = useState();
  const [ focusedId, setFocusedId ] = useState();
  const [ useLight, setUseLight ] = useState(props.useLight);
  const [ useLow, setUseLow ] = useState(props.useLow);
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

    const styleLoadedInterval = setInterval(() => {
      if (map.isStyleLoaded() && !styleLoaded) {
        setStyleLoaded(true);
      }
    }, 100);

    const focusInterval = setInterval(() => {
      setFocusBlink(focusBlink => !focusBlink);
    }, 500);

    return () => {
      clearInterval(styleLoadedInterval);
      clearInterval(focusInterval);
    };
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
    // This adds and removes vehicles when performance settings change
    if (props.useLow && !useLow) {
      const existingLayers = map ? map.getStyle().layers : [];
      for (const existingLayer of existingLayers.filter(eL => eL.id.startsWith('js-Map-vehicles--'))) {
        map.removeLayer(existingLayer.id);
        map.removeSource(existingLayer.id);
      }
      setUseLow(true);
    } else if (!props.useLow && useLow) {
      handleVehicles(props.system.lines);
      setUseLow(false);
    }
  }, [props.useLow]);

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
      } else if (props.gotData) {
        // no zooming happening, immediately enable interactions
        setTimeout(() => setEnableClicks(true), 0);
      }

      if (!bounds.isEmpty() || props.newSystemSelected || props.gotData) {
        enableStationsAndInteractions(!bounds.isEmpty() || props.newSystemSelected ? FLY_TIME - 1000 : 0);
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
    if (!map) return;

    const focusLayerId = `js-Map-focus`;
    let existingLayer = map.getLayer(focusLayerId);

    if (props.focus && props.focus.line && (props.focus.line.stationIds || []).length) {
      const coords = stationIdsToCoordinates(props.system.stations, props.focus.line.stationIds);
      const focusFeature = {
        "type": "Feature",
        "properties": {
          "line-key": props.focus.line.id
        },
        "geometry": {
          "type": "LineString",
          "coordinates": coords
        }
      }

      if (existingLayer) {
        let existingSource = map.getSource(focusLayerId);
        if (existingSource && existingSource._data && existingSource._data.properties &&
            existingSource._data.properties['line-key'] === props.focus.line.id) {
          // update focus line opacity and return
          existingSource.setData(focusFeature);
          map.setPaintProperty(existingLayer.id, 'line-opacity', focusBlink ? 1 : 0);
          map.moveLayer(existingLayer.id);
          return;
        } else if (existingSource) {
          // existing focus line is for a different line
          map.removeLayer(existingLayer.id);
          map.removeSource(existingLayer.id);
        }
      }

      const layer = {
        "type": "line",
        "layout": {
            "line-join": "round",
            "line-cap": "round"
        },
        "source": {
          "type": "geojson"
        },
        "paint": {
          "line-color": useLight ? '#000000' : '#ffffff',
          "line-opacity": focusBlink ? 1 : 0,
          "line-width": 4,
          "line-gap-width": 12,
          "line-opacity-transition": { duration: 500 }
        }
      };

      renderLayer(focusLayerId, layer, focusFeature, true);
    } else if (existingLayer) {
      map.removeLayer(existingLayer.id);
      map.removeSource(existingLayer.id);
    }
  }, [focusBlink]);

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

  const enableStationsAndInteractions = (waitTime) => {
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
      }, waitTime);
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
    if (!map) return;

    const vehicleLayerId = `js-Map-vehicles--${(new Date()).getTime()}`; // timestamp allows us to add new vehicle layer before removing old ones, eliminating flash

    let vehicleValuesByLineId = {};
    let layerIdToRemove;
    const existingLayers = map.getStyle().layers;
    for (const existingLayer of existingLayers.filter(eL => eL.id.startsWith('js-Map-vehicles--'))) {
      const existingSource = map.getSource(existingLayer.id);
      if (existingSource) {
        // vehicle state (position, speed, color, etc) is stored in source data properties
        // grab existing state properties of existing source on map
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
      // generate new collection of vehicles for updated lines
      if ((line.stationIds || []).length <= 1) continue;

      let vehicleValues = {};
      if (line.id in vehicleValuesByLineId) {
        // use exising vehicle's values if one exists for the line
        vehicleValues = vehicleValuesByLineId[line.id];

        // override these values when a line becomes/stops being a circle
        if (line.stationIds[0] === line.stationIds[line.stationIds.length - 1]) {
          vehicleValues.isCircular = true;
          vehicleValues.forward = true;
        } else {
          vehicleValues.isCircular = false;
        }
      } else {
        // otherwise create new vehicle values
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
      let sectionCoords = stationIdsToCoordinates(props.system.stations, sections[sectionIndex]);
      let backwardCoords = sectionCoords.slice().reverse();

      if (!(sectionCoords || []).length) {
        continue;
      }

      // create new vehicle and add to features list
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

    // actually animate the change in vehicle position per render frame
    const animateVehicles = (time) => {
      let updatedVehicles = {
        "type": "FeatureCollection",
        "features": []
      };

      for (const line of Object.values(lines)) {
        // vehicle travels 60x actual speed, so 60 km/min instead of 60 kph irl
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
            vehicleValues.speed = Math.max(slowingSpeed, 0.05);
          } else if (vehicleValues.distance <= (noTopSpeed ? vehicleValues.routeDistance / 2 : accelDistance)) {
            // if vehicle is accelerating out of a station
            vehicleValues.speed = Math.max(mode.speed * (vehicleValues.distance / accelDistance), 0.05);
          } else {
            // vehicle is at top speed
            vehicleValues.speed = mode.speed;
          }

          vehicleValues.distance += vehicleValues.speed * (time - vehicleValues.lastTime) / 1000;
        }

        vehicleValues.lastTime = time;

        if (!vehicleValues.sectionCoords) {
          continue;
        }

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

          vehicleValues.lastTime = null;
          vehicleValues.speed = 0.0;
          vehicleValues.distance = 0.0;

          // move to next section
          vehicleValues.sectionIndex += vehicleValues.forward ? 1 : -1;
          if (vehicleValues.sectionIndex >= vehicleValues.sections.length) {
            const endStationId = line.stationIds[line.stationIds.length - 1];
            if (vehicleValues.isCircular) {
              vehicleValues.sectionIndex = 0;
            } else if (line.stationIds.slice(0, line.stationIds.length - 1).includes(endStationId)) {
              // if this is the end of a loop, jump to section not in loop instead of reversing from end
              for (const [i, section] of vehicleValues.sections.entries()) {
                let additionalIndex = section.indexOf(endStationId);
                if (additionalIndex !== -1) {
                  vehicleValues.sectionIndex = i;

                  // if a waypoint is at the end of the loop, we need to travel part distance of the new section
                  if (additionalIndex !== 0 && additionalIndex !== (section.length - 1)) {
                    const fullSectionDistance = turfLength(turfLineString(stationIdsToCoordinates(props.system.stations, section)));
                    const stationCoordsBefore = stationIdsToCoordinates(props.system.stations, section.slice(0, additionalIndex + 1));
                    const uncompletedDistance = turfLength(turfLineString(stationCoordsBefore));
                    vehicleValues.distance = fullSectionDistance - uncompletedDistance;
                  }

                  break;
                }
              }
            } else {
              vehicleValues.sectionIndex = vehicleValues.sections.length - 1;
            }
            vehicleValues.forward = vehicleValues.isCircular ? vehicleValues.forward : !vehicleValues.forward; // circular lines do not switch direction
          } else if (vehicleValues.sectionIndex < 0) {
            const startStationId = line.stationIds[0];
            if (vehicleValues.isCircular) {
              vehicleValues.sectionIndex = 0;
            } else if (line.stationIds.slice(1).includes(startStationId)) {
              // if this is the end of a loop, jump to section not in loop instead of reversing from start
              for (const [i, section] of vehicleValues.sections.slice().reverse().entries()) {
                let additionalIndex = section.indexOf(startStationId);
                if (additionalIndex !== -1) {
                  vehicleValues.sectionIndex = vehicleValues.sections.length - 1 - i;

                  // if a waypoint is at the start of the loop, we need to travel part distance of the new section
                  if (additionalIndex !== 0 && additionalIndex !== (section.length - 1)) {
                    const fullSectionDistance = turfLength(turfLineString(stationIdsToCoordinates(props.system.stations, section)));
                    const stationCoordsAfter = stationIdsToCoordinates(props.system.stations, section.slice(additionalIndex));
                    const uncompletedDistance = turfLength(turfLineString(stationCoordsAfter));
                    vehicleValues.distance = fullSectionDistance - uncompletedDistance;
                  }

                  break;
                }
              }
            } else {
              vehicleValues.sectionIndex = 0;
            }
            vehicleValues.forward = vehicleValues.isCircular ? vehicleValues.forward : !vehicleValues.forward; // circular lines do not switch direction
          }

          vehicleValues.sectionCoords.forwards = stationIdsToCoordinates(props.system.stations, vehicleValues.sections[vehicleValues.sectionIndex]);
          vehicleValues.sectionCoords.backwards = vehicleValues.sectionCoords.forwards.slice().reverse();
          vehicleValues.routeDistance = turfLength(turfLineString(vehicleValues.sectionCoords.forwards));

          if (!destIsWaypoint) {
            // pause at non-waypoints; amount of pause time comes from line mode
            vehicleValues.pauseTime = time;
          }
        }

        // update vehicleValues for next frame
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
          const station = floatifyStationCoord(stations[id]);
          if (pin) {
            pin.parentNode.removeChild(pin);
          }

          if (props.viewOnly && station.isWaypoint) {
            // do not show waypoints in viewonly mode
            continue;
          }

          const { lng, lat } = station;

          let color = '#888';
          let hasTransfer = false;
          for (const lineKey in lines) {
            if (lines[lineKey].stationIds.includes(id)) {
              color = '#fff';
              for (const otherLineKey in lines) {
                if (lineKey !== otherLineKey && checkForTransfer(id, lines[lineKey], lines[otherLineKey], stations)) {
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
          if (station.isWaypoint) {
            el.className += ' Map-station--waypoint';
          } else if (hasTransfer) {
            el.className += ' Map-station--interchange';
          }

          if (id === focusedId) {
            el.className += ' js-Map-station--focused Map-station--focused';

            if (!station.isWaypoint && !map.getLayer(circleId)) {
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
            } else if (station.isWaypoint && map.getLayer(circleId)) {
              map.removeLayer(circleId);
              map.removeSource(circleId);
            }
          } else if (id === focusedIdPrev && map.getLayer(circleId)) {
            map.removeLayer(circleId);
            map.removeSource(circleId);
          }

          el.dataset.tip = station.isWaypoint ? 'Waypoint' : station.name || 'Station';
          el.innerHTML = station.isWaypoint ? svgWaypoint : (hasTransfer ? svgInterchange : svgStation);

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

    if (!useLow) {
      handleVehicles(lines);
    }
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
            "coordinates": stationIdsToCoordinates(stations, interlineSegments[segmentKey].stationIds)
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
