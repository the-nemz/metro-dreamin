import React, { useState, useEffect, useContext, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import turfAlong from '@turf/along';
import turfCircle from '@turf/circle';
import { lineString as turfLineString } from '@turf/helpers';
import turfLength from '@turf/length';

import { FirebaseContext } from '/lib/firebase.js';
import {
  checkForTransfer,
  getMode,
  partitionSections,
  stationIdsToCoordinates,
  floatifyStationCoord
} from '/lib/util.js';
import { FLY_TIME } from '/lib/constants.js';

mapboxgl.accessToken = 'pk.eyJ1IjoiaWpuZW16ZXIiLCJhIjoiY2xma3B0bW56MGQ4aTQwczdsejVvZ2cyNSJ9.FF2XWl1MkT9OUVL_HBJXNQ';
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v10';
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v10';

export function Map({ system,
                      interlineSegments = {},
                      changing = {},
                      focus = {},
                      systemLoaded = false,
                      viewOnly = true,
                      waypointsHidden = false,
                      isFullscreen = false,
                      isMobile = false,
                      onStopClick = () => {},
                      onLineClick = () => {},
                      onMapClick = () => {},
                      onMapInit = () => {},
                      onToggleMapStyle = () => {},
                      preToggleMapStyle = () => {} }) {

  const firebaseContext = useContext(FirebaseContext);
  const mapEl = useRef(null);
  const animationRef = useRef(null);
  const systemRef = useRef(null);

  const [ map, setMap ] = useState();
  const [ styleLoaded, setStyleLoaded ] = useState(false);
  const [ hasSystem, setHasSystem ] = useState(false);
  const [ clickListened, setClickListened ] = useState(false);
  const [ enableClicks, setEnableClicks ] = useState(false);
  const [ interactive, setInteractive ] = useState(false);
  const [ focusBlink, setFocusBlink ] = useState(false);
  const [ focusedIdPrev, setFocusedIdPrev ] = useState();
  const [ focusedId, setFocusedId ] = useState();
  const [ mapStyle, setMapStyle ] = useState((firebaseContext.settings || {}).lightMode ? LIGHT_STYLE : DARK_STYLE);
  const [lineFeats, setLineFeats] = useState([]);
  const [segmentFeats, setSegmentFeats] = useState([]);
  const [interchangeFeats, setInterchangeFeats] = useState([]);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: getUseLight() ? LIGHT_STYLE : DARK_STYLE,
      zoom: 2
    });

    preToggleMapStyle();
    map.once('styledata', () => {
      onToggleMapStyle();
      setStyleLoaded(true);
    });

    // temporarily disable map interactions
    map.boxZoom.disable();
    map.scrollZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();

    map.on('webglcontextlost', onContextLost);

    setMap(map);
    onMapInit(map);

    const focusInterval = setInterval(() => {
      setFocusBlink(focusBlink => !focusBlink);
    }, 500);

    return () => {
      clearInterval(focusInterval);
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    systemRef.current = system;
  }, [system])

  useEffect(() => {
    if (map) {
      map.resize();
    }
  }, [isFullscreen, isMobile]);

  useEffect(() => {
    const styleForTheme = getUseLight() ? LIGHT_STYLE : DARK_STYLE;
    if (map && styleLoaded && styleForTheme !== mapStyle) {
      setStyleLoaded(false);
      setMapStyle(styleForTheme);
      map.setStyle(styleForTheme);
      preToggleMapStyle();
      map.once('styledata', () => {
        setStyleLoaded(true);
        onToggleMapStyle();
      });
    };
  }, [map, styleLoaded, firebaseContext.settings.lightMode]);

  useEffect(() => {
    // This adds and removes vehicles when performance settings change
    if (map && styleLoaded && getUseLow()) {
      const existingLayers = getMapLayers();
      for (const existingLayer of existingLayers.filter(eL => eL.id.startsWith('js-Map-vehicles--'))) {
        map.removeLayer(existingLayer.id);
        map.removeSource(existingLayer.id);
      }
    } else if (map && styleLoaded && !getUseLow()) {
      handleVehicles(system.lines);
    }
  }, [map, styleLoaded, firebaseContext.settings.lowPerformance]);

  useEffect(() => {
    // This determines which, if any, station should be focused
    if (focus && focus.station) {
      if (focus.station.id !== focusedId) {
        setFocusedIdPrev(focusedId);
        setFocusedId(focus.station.id);
      } else if (focus.station.id === focusedId) {
        // Already set
      }
    } else if (focusedId !== null) {
      setFocusedIdPrev(focusedId);
      setFocusedId(null);
    }
  }, [focus]);

  useEffect(() => {
    if (enableClicks && !clickListened) {
      map.on('click', (e) => {
        if (e.originalEvent.cancelBubble) {
          return;
        }

        const { lng, lat } = e.lngLat;
        onMapClick(lat, lng);
      });

      setClickListened(true);
    }
  }, [enableClicks]);

  useEffect(() => {
    if (systemLoaded && styleLoaded) {
      fitMapToStations(map, FLY_TIME);

      setTimeout(() => setEnableClicks(true), FLY_TIME - 1000);
      enableStationsAndInteractions(Object.keys(system.stations).length ? FLY_TIME - 1000 : 0);
    }
  }, [ systemLoaded, styleLoaded ]);

  useEffect(() => handleStations(), [focusedId]);

  useEffect(() => {
    renderSystem()
  }, [styleLoaded]);

  useEffect(() => {
    if (Object.keys(changing).length) {
      renderSystem();
    }
  }, [changing.all, changing.stationIds, changing.lineKeys, changing.segmentKeys]);

  useEffect(() => {
    if (styleLoaded) {
      handleSegments();
    }
  }, [interlineSegments]);

  useEffect(() => {
    if (Object.keys(system.stations).length && !hasSystem) {
      renderSystem();
      setHasSystem(true);
    }
  }, [system]);

  useEffect(() => {
    if (!map) return;

    const focusLayerId = `js-Map-focus`;
    let existingLayer = map.getLayer(focusLayerId);

    if (focus && focus.line && (focus.line.stationIds || []).length) {
      const coords = stationIdsToCoordinates(system.stations, focus.line.stationIds);
      const focusFeature = {
        "type": "Feature",
        "properties": {
          "line-key": focus.line.id
        },
        "geometry": {
          "type": "LineString",
          "coordinates": coords
        }
      }

      if (existingLayer) {
        let existingSource = map.getSource(focusLayerId);
        if (existingSource && existingSource._data && existingSource._data.properties &&
            existingSource._data.properties['line-key'] === focus.line.id) {
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
          "line-join": "miter",
          "line-cap": "butt",
          "line-sort-key": 3
        },
        "source": {
          "type": "geojson"
        },
        "paint": {
          "line-color": getUseLight() ? '#000000' : '#ffffff',
          "line-opacity": focusBlink ? 1 : 0,
          "line-width": 4,
          "line-gap-width": 12,
          "line-opacity-transition": { duration: 500 }
        }
      };

      renderLayer(focusLayerId, layer, focusFeature);
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
        "line-join": "miter",
        "line-cap": "butt",
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

    renderLayer(layerID, layer, featCollection);
  }, [lineFeats]);

  useEffect(() => {
    const layerID = 'js-Map-segments';
    const layer = {
      "type": "line",
      "layout": {
        "line-join": "miter",
        "line-cap": "butt",
        "line-sort-key": 2
      },
      "source": {
        "type": "geojson"
      },
      "paint": {
        "line-width": 8,
        "line-color": ['get', 'color'],
        "line-offset": ['get', 'offset']
      }
    };

    let featCollection = {
      "type": "FeatureCollection",
      "features": segmentFeats
    };

    renderLayer(layerID, layer, featCollection);

    for (const existingLayer of getMapLayers()) {
      if (existingLayer.id.startsWith('js-Map-vehicles--')) {
        // ensure vehicles remain on the top
        map.moveLayer(existingLayer.id);
      }
    }
  }, [segmentFeats]);

  useEffect(() => {
    const layerID = 'js-Map-interchanges';
    const layer = {
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
        "line-color": getUseLight() ? '#000000' : '#ffffff',
        "line-width": 8,
        "line-dasharray": [ 1, 1 ]
      }
    };

    let featCollection = {
      "type": "FeatureCollection",
      "features": interchangeFeats
    };

    renderLayer(layerID, layer, featCollection);
  }, [interchangeFeats]);

  const getUseLight = () => (firebaseContext.settings || {}).lightMode || false;

  const getUseLow = () => (firebaseContext.settings || {}).lowPerformance || false;

  // too many maps added/removed, so we need to basically reset the map
  const onContextLost = () => {
    if (!mapEl.current) return;

    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: getUseLight() ? LIGHT_STYLE : DARK_STYLE,
      zoom: 2,
      attributionControl: false
    })
      .addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

    setMap(map);
    onMapInit(map);
    onToggleMapStyle();
    fitMapToStations(map, 0); // do not fly

    setClickListened(false);
    setEnableClicks(false);
    setTimeout(() => setEnableClicks(true), 100);
  }

  const getMapLayers = () => {
    if (!map) return [];

    try {
      return map.getStyle().layers;
    } catch (e) {
      console.log('getMapLayers error:', e);
      return [];
    }
  }

  // fits map to station bounds
  // uses system ref as this can be called in a listener set up on load
  const fitMapToStations = (map, animationDuration = FLY_TIME) => {
    const stations = systemRef.current.stations;

    let bounds = new mapboxgl.LngLatBounds();
    for (const sId in stations) {
      bounds.extend(new mapboxgl.LngLat(stations[sId].lng, stations[sId].lat));
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: 32,
        duration: animationDuration
      });
    }
  }

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
    const existingLayers = getMapLayers();
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

      const sections = partitionSections(line, system.stations);
      let sectionIndex = getSectionIndex(sections, vehicleValues.prevStationId, vehicleValues.prevSectionIndex, vehicleValues.forward);
      let sectionCoords = stationIdsToCoordinates(system.stations, sections[sectionIndex]);
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
      renderLayer(vehicleLayerId, newVehicleLayer, vehicles);
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

        if (!vehicleValues.sectionCoords ||
            (vehicleValues.sectionCoords.forwards || []).length < 2 ||
            (vehicleValues.sectionCoords.backwards || []).length < 2) {
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
          if (!(destStationId in system.stations)) continue; // in case station was recently deleted
          const destIsWaypoint = system.stations[destStationId].isWaypoint;

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
                    const fullSectionDistance = turfLength(turfLineString(stationIdsToCoordinates(system.stations, section)));
                    const stationCoordsBefore = stationIdsToCoordinates(system.stations, section.slice(0, additionalIndex + 1));
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
                    const fullSectionDistance = turfLength(turfLineString(stationIdsToCoordinates(system.stations, section)));
                    const stationCoordsAfter = stationIdsToCoordinates(system.stations, section.slice(additionalIndex));
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

          vehicleValues.sectionCoords.forwards = stationIdsToCoordinates(system.stations, vehicleValues.sections[vehicleValues.sectionIndex]);
          vehicleValues.sectionCoords.backwards = vehicleValues.sectionCoords.forwards.slice().reverse();
          if ((vehicleValues.sectionCoords.forwards || []).length >= 2) {
            vehicleValues.routeDistance = turfLength(turfLineString(vehicleValues.sectionCoords.forwards));
          } else {
            // for rare case where sectionCoords gets into bad state of <2 entries
            console.warn('handleVehicles warning: sectionCoords length is less than 2, default distance to 1');
            vehicleValues.routeDistance = 1;
          }

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
      }

      if (animationRef.current != null) {
        animationRef.current = requestAnimationFrame(animateVehicles);
      } else {
        return;
      }
    }

    if (animationRef.current != null) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animateVehicles);
  }

  const renderSystem = () => {
    if (styleLoaded) {
      handleStations();
      handleLines();
      handleSegments();
      handleInterchanges();
    }
  }

  const handleStations = () => {
    if (!map) return; // needed for certain next rerenders like /edit/new -> /edit/systemId

    const stations = system.stations;
    const lines = system.lines;

    let stationIdsToHandle = [];
    if (changing.all) {
      stationIdsToHandle = Object.keys(stations);
    } else if (changing.stationIds) {
      stationIdsToHandle = changing.stationIds;
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
        if (stationKeys.includes(id)) {
          const station = floatifyStationCoord(stations[id]);
          if (pin) {
            pin.parentNode.removeChild(pin);
          }

          if (viewOnly && station.isWaypoint) {
            // do not show waypoints in viewonly mode
            continue;
          }

          if (waypointsHidden && station.isWaypoint && id !== focusedId) {
            // do not show waypoints unless it is focused
            continue;
          }

          const { lng, lat } = station;

          let color = '#888';
          let hasTransfer = false;
          for (const lineKey in lines) {
            if (lines[lineKey].stationIds.includes(id) && !(lines[lineKey].waypointOverrides || []).includes(id)) {
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
                                 <line x1="4" y1="4" x2="12" y2="12" stroke="${getUseLight() ? '#353638' : '#e6e5e3'}" stroke-width="2" />
                                 <line x1="4" y1="12" x2="12" y2="4" stroke="${getUseLight() ? '#353638' : '#e6e5e3'}" stroke-width="2" />
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
                  "line-color": getUseLight() ? '#353638' : '#e6e5e3',
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
            onStopClick(id);
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
    const stations = system.stations;
    const lines = system.lines;

    let updatedLineFeatures = {};
    if (changing.lineKeys || changing.all) {
      for (const lineKey of (changing.all ? Object.keys(lines) : changing.lineKeys)) {
        if (!(lineKey in lines) || lines[lineKey].stationIds.length <= 1) {
          updatedLineFeatures[lineKey] = {};

          const existingLayers = getMapLayers();
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

    if (!getUseLow()) {
      handleVehicles(lines);
    }
  }

  const handleSegments = () => {
    const stations = system.stations;
    const lines = system.lines;
    const segmentsBeingHandled = changing.all ? Object.keys(interlineSegments) : (changing.segmentKeys || []);

    let updatedSegmentFeatures = {};

    for (const segmentKey of segmentsBeingHandled) {
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

  const handleInterchanges = () => {
    const stations = system.stations;
    const interchanges = system.interchanges;

    let updatedInterchangeFeatures = {};
    if (changing.interchangeIds || changing.all) {
      for (const interchangeId of (changing.all ? Object.keys(interchanges) : changing.interchangeIds)) {
        if (!(interchangeId in interchanges) || interchanges[interchangeId].stationIds.length <= 1) {
          updatedInterchangeFeatures[interchangeId] = {};
          continue;
        }

        const coords = stationIdsToCoordinates(stations, interchanges[interchangeId].stationIds);
        if (coords.length > 1) {
          const feature = {
            "type": "Feature",
            "properties": {
              "interchange-id": interchangeId
            },
            "geometry": {
              "type": "LineString",
              "coordinates": coords
            }
          }

          updatedInterchangeFeatures[interchangeId] = feature;
        }
      }
    }

    if (Object.keys(updatedInterchangeFeatures).length) {
      setInterchangeFeats(interchangeFeats => {
        let newFeats = {};
        for (const feat of interchangeFeats) {
          newFeats[feat.properties['interchange-id']] = feat;
        }
        for (const featId in updatedInterchangeFeatures) {
          newFeats[featId] = updatedInterchangeFeatures[featId];
        }
        return Object.values(newFeats).filter(nF => nF.type);
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
    <div className="Map" ref={el => (mapEl.current = el)}></div>
  );
}
