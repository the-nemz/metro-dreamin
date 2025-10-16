import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import mapboxgl, { ScaleControl } from 'mapbox-gl';
import turfAlong from '@turf/along';
import turfCircle from '@turf/circle';
import {
  point as turfPoint,
  lineString as turfLineString
} from '@turf/helpers';
import turfLength from '@turf/length';
import turfPointToPolygonDistance from '@turf/point-to-polygon-distance';
import {
  bboxPolygon as turfBboxPolygon,
  bearing as turfBearing,
  booleanContains as turfBooleanContains,
  combine as turfCombine,
  lineChunk as turfLineChunk,
  lineSlice as turfLineSlice,
  lineSliceAlong as turfLineSliceAlong
} from '@turf/turf';
import ReactGA from 'react-ga4';

import {
  FLY_TIME, FOCUS_ANIM_TIME, MILES_TO_KMS_MULTIPLIER,
  COLOR_TO_NAME, LINE_ICON_SHAPES, LINE_ICON_SHAPE_SET,
  STATION, STATION_DISCON, TRANSFER, WAYPOINT_DARK, WAYPOINT_LIGHT
} from '/util/constants.js';
import { FirebaseContext } from '/util/firebase.js';
import {
  getMode,
  divideLineSections,
  stationIdsToCoordinates,
  stationIdsToMultiLineCoordinates,
  floatifyStationCoord,
  getLineIconPath,
  getColoredIcon,
  getLuminance,
  normalizeLongitude,
  escapeHtml,
  getLineColorIconStyle
} from '/util/helpers.js';
import { useMapbox } from '../util/mapProvider.js';

import MapSlot from '/components/MapSlot.js';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v10';
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v10';
const SATELLITE_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';
const TOPO_SOURCE = 'mapbox://mapbox.mapbox-terrain-v2';
const RAILWAYS_SOURCE = 'mapbox://mapbox.mapbox-streets-v8';

export function Map({ system,
                      focus = {},
                      centroid = null,
                      systemLoaded = false,
                      viewOnly = true,
                      waypointsHidden = false,
                      vehiclesHidden = false,
                      groupsDisplayed = null,
                      isFullscreen = false,
                      isMobile = false,
                      zoomThresholdForStations = 9,
                      zoomThresholdsForLines = [ 2, 4, 8 ],
                      mapStyleOverride = '',
                      vehicleRideId = '',
                      setVehicleRideId = () => {},
                      onStopClick = () => {},
                      onLineClick = () => {},
                      onMapClick = () => {},
                      onMapInit = () => {},
                      onToggleMapStyle = () => {},
                      preToggleMapStyle = () => {},
                      postChangingAll = () => {} }) {

  const firebaseContext = useContext(FirebaseContext);
  const { map: sharedMap } = useMapbox();
  const animationRef = useRef(null);
  const systemRef = useRef(null);
  const prevHoveredIdsRef = useRef(null);
  const popupRef = useRef(null);
  const scaleControlAddedRef = useRef(false);

  const [ map, setMap ] = useState();
  const [ styleLoaded, setStyleLoaded ] = useState(false);
  const [ hasSystem, setHasSystem ] = useState(false);
  const [ clickListened, setClickListened ] = useState(false);
  const [ enableClicks, setEnableClicks ] = useState(false);
  const [ clickInfo, setClickInfo ] = useState();
  const [ interactive, setInteractive ] = useState(false);
  const [ focusBeat, setFocusBeat ] = useState(0);
  const [ focusedIdPrev, setFocusedIdPrev ] = useState();
  const [ focusedId, setFocusedId ] = useState();
  const [ hoveredIds, setHoveredIds ] = useState([]);
  const [ linesDisplayedSet, setLinesDisplayedSet ] = useState(new Set());
  const [ mapStyle, setMapStyle ] = useState((firebaseContext.settings || {}).lightMode ? LIGHT_STYLE : DARK_STYLE);
  const [ stationFeats, setStationFeats ] = useState([]);
  const [ segmentFeats, setSegmentFeats ] = useState([]);
  const [ interchangeFeats, setInterchangeFeats ] = useState([]);

  const popupDomElem = useMemo(() => {
    if (map) {
      const container = window.document.createElement('div');
      return { root: createRoot(container), container };
    }
  }, [map]);

  useEffect(() => {
    if (!sharedMap) return;

    sharedMap.setCenter([0, 0]);
    sharedMap.setZoom(1);

    preToggleMapStyle();
    if (sharedMap.isStyleLoaded()) {
      onToggleMapStyle();
      setStyleLoaded(true);
    } else {
      sharedMap.once('styledata', async () => {
        onToggleMapStyle();
        setStyleLoaded(true);
      });
    }

    // temporarily disable map interactions
    sharedMap.boxZoom.disable();
    sharedMap.scrollZoom.disable();
    sharedMap.dragPan.disable();
    sharedMap.dragRotate.disable();
    sharedMap.keyboard.disable();
    sharedMap.doubleClickZoom.disable();
    sharedMap.touchZoomRotate.disable();

    sharedMap.on('webglcontextlost', onContextLost);

    if (!scaleControlAddedRef.current) {
      sharedMap.addControl(new ScaleControl({ unit: (navigator?.language ?? 'en').toLowerCase() === 'en-us' ? 'imperial' : 'metric' }),
                           'bottom-right');
      scaleControlAddedRef.current = true;
    }

    setMap(sharedMap);
    onMapInit(sharedMap);

    // 8 beats over 1.6 seconds
    const focusInterval = setInterval(() => {
      setFocusBeat(focusBeat => (focusBeat + 1) % 8);
    }, FOCUS_ANIM_TIME / 2);

    return () => {
      clearInterval(focusInterval);
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      sharedMap.off('webglcontextlost', onContextLost);
      if (popupRef.current) {
        popupRef.current.remove();
      }
    };
  }, [sharedMap]);

  useEffect(() => {
    systemRef.current = system;
  }, [system])

  useEffect(() => {
    if (sharedMap) {
      sharedMap.resize();
    }
  }, [sharedMap, isFullscreen, isMobile]);

  useEffect(() => {
    if (!styleLoaded || !map) return;

    loadPointIcon('md_station', STATION);
    loadPointIcon('md_stationDiscon', STATION_DISCON);
    loadPointIcon('md_transfer', TRANSFER);
    loadPointIcon('md_waypoint_dark', WAYPOINT_DARK);
    loadPointIcon('md_waypoint_light', WAYPOINT_LIGHT);
  }, [styleLoaded, map]);

  useEffect(() => {
    if (!map || !styleLoaded) return;

    let styleForTheme = getUseLight() ? LIGHT_STYLE : DARK_STYLE;
    switch (mapStyleOverride) {
      case 'satellite':
        styleForTheme = SATELLITE_STYLE;
        break;
      case 'topographic':
        addTopographicLayer();
        break;
      case 'railways':
        addRailwaysLayer();
        break;
      default:
        break;
    }

    if (styleForTheme !== mapStyle) {
      setStyleLoaded(false);
      setMapStyle(styleForTheme);
      map.setStyle(styleForTheme);
      preToggleMapStyle();
      map.once('styledata', async () => {
        if (map.isStyleLoaded()) return;

        setTimeout(() => {
          setStyleLoaded(true);
          onToggleMapStyle();
        }, 1000)
      });
    } else {
      if (mapStyleOverride !== 'topographic' && map.getLayer('js-Map-terrain')) {
        map.removeLayer('js-Map-terrain');
      }
      if (mapStyleOverride !== 'railways' && map.getLayer('js-Map-railways')) {
        map.removeLayer('js-Map-railways');
      }

      addBuildingsLayer();
    }
  }, [map, styleLoaded, firebaseContext.settings.lightMode, mapStyleOverride]);

  useEffect(() => {
    // This adds and removes vehicles when performance settings change
    if (map && styleLoaded && getUseLow()) {
      const existingLayers = getMapLayers();
      for (const existingLayer of existingLayers.filter(eL => eL.id.startsWith('js-Map-vehicles--'))) {
        map.removeLayer(existingLayer.id);
        map.removeSource(existingLayer.id);
      }
      if (popupRef.current) {
        popupRef.current.remove();
      }
      setVehicleRideId('');
    } else if (map && styleLoaded) {
      handleVehicles(system.lines);
    }
  }, [map, styleLoaded, vehiclesHidden, firebaseContext.settings.lowPerformance]);

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

    if ((!focus?.line?.id || focus?.line?.id !== clickInfo?.lineId) &&
        (!vehicleRideId || vehicleRideId !== clickInfo?.lineId) &&
        clickInfo?.featureType === 'vehicle') {
      setClickInfo(null);
      try {
        popupRef.current?.remove();
      } catch (e) {
        console.warn(e);
      }
    }
  }, [focus]);

  useEffect(() => {
    if (enableClicks && !clickListened) {
      map.on('click', (e) => {
        if (e.originalEvent.cancelBubble) {
          return;
        }

        // set `bbox` as 6px reactangle area around clicked point.
        const bbox = [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6]
        ];
        // find features intersecting the bounding box.
        const selectedFeatures = map.getLayer('js-Map-stations') ?
                                 map.queryRenderedFeatures(bbox, { layers: [ 'js-Map-stations' ] }) :
                                 [];

        // select highest priority station in the returned features
        let stationId;
        let highestPriority = 0;
        for (const feat of (selectedFeatures || [])) {
          if (feat?.properties?.stationId) {
            if (feat?.properties?.name) {
              // currently hovered, choose this one
              stationId = feat.properties.stationId;
              break;
            }

            if (feat?.properties?.priority && feat.properties.priority > highestPriority) {
              stationId = feat.properties.stationId;
              highestPriority = feat.properties.priority;
            }
          }
        }

        const { lng, lat } = e.lngLat;
        if (stationId) {
          setClickInfo({
            timestamp: Date.now(),
            coord: { lng, lat },
            featureType: 'station',
            stationId: stationId
          });
          return;
        }

        const otherFeatures = map.queryRenderedFeatures(bbox);
        for (const feature of otherFeatures) {
          if ((feature?.layer?.id ?? '').startsWith('js-Map-vehicles--') &&
              feature?.properties?.lineKey &&
              feature.properties.lineKey in system.lines) {
            const line = system.lines[feature.properties.lineKey];
            setClickInfo({
              timestamp: Date.now(),
              coord: { lng, lat },
              featureType: 'vehicle',
              lineId: feature.properties.lineKey,
              line: line
            });

            popupRef.current?.remove();
            popupRef.current = (new mapboxgl.Popup({
              anchor: 'bottom',
              maxWidth: '240px',
              closeButton: false,
              focusAfterOpen: false,
              className: 'Map-popup',
              offset: {
                bottom: [ 0, -8 ]
              }
            })).addTo(map);

            handleVehiclePopupContent(
              line,
              divideLineSections(line, system.stations),
              feature.properties.prevSectionIndex || 0,
              !!feature.properties.forward,
              0,
              false
            );

            handleVehiclePopupPosition(new turfPoint([ lng, lat ]));
            return;
          }
        }

        setClickInfo({
          timestamp: Date.now(),
          coord: { lng, lat },
          featureType: null
        });
      });

      map.on('mousemove', 'js-Map-stations', (e) => {
        const stationIds = (e.features || []).filter(f => f?.properties?.stationId).map(f => f.properties.stationId);
		    if (stationIds && stationIds.length) {
          setHoveredIds(stationIds);
		    } else {
		      setHoveredIds([]);
		    }
		  });

		  map.on('mouseleave', 'js-Map-stations', (e) => setHoveredIds([]));

      setClickListened(true);
    }
  }, [enableClicks]);

  useEffect(() => {
    if (!map || !hoveredIds?.length || !map.getLayer('js-Map-stations')) return;

    const featsShowingName = map.querySourceFeatures('js-Map-stations', {
      filter: ['!', ['==', '', ['get', 'name']]]
    });
    const stationIds = featsShowingName.filter(f => f?.properties?.stationId).map(f => f.properties.stationId);
    prevHoveredIdsRef.current = stationIds;
  }, [hoveredIds, map]);

  useEffect(() => {
    if (clickInfo?.featureType === 'station' && clickInfo?.stationId && !vehicleRideId) {
      onStopClick(clickInfo.stationId);
    } else if (clickInfo?.featureType === 'vehicle' && clickInfo?.lineId && clickInfo?.line) {
      popupRef.current && popupRef.current.on('close', () => {
        setClickInfo(cI => cI?.featureType === 'vehicle' ? null : cI);
      });
      ReactGA.event({
        category: 'System',
        action: 'Open Vehicle Popup'
      });
    } else if (clickInfo?.coord && 'lat' in clickInfo.coord && 'lng' in clickInfo.coord && !vehicleRideId) {
      const { lat, lng } = clickInfo.coord;
      onMapClick(lat, lng)
    }
    handleVehicles(system.lines || {});
  }, [clickInfo]);

  useEffect(() => {
    if (!map) return;

    if (styleLoaded && vehicleRideId) {
      handleVehicles(system.lines || {});
      map.boxZoom.disable();
      map.scrollZoom.disable();
      map.dragPan.disable();
      map.dragRotate.disable();
      map.keyboard.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
    } else if (styleLoaded) {
      handleVehicles(system.lines || {});
      map.flyTo({
        zoom: 15,
        pitch: 0,
        bearing: 0,
        duration: FLY_TIME / 2
      });
      enableMapInteractions();
    }
  }, [vehicleRideId]);

  useEffect(() => {
    if (systemLoaded && !interactive) {
      fitMapToStations(map, FLY_TIME);

      setTimeout(() => setEnableClicks(true), FLY_TIME - 1000);
      enableStationsAndInteractions(Object.keys(system.stations).length ? FLY_TIME - 1000 : 0);
    }
  }, [ systemLoaded, interactive ]);

  useEffect(() => {
    if (!systemLoaded || !styleLoaded | !map) return;

    const iconsHandled = new Set();
    for (const line of Object.values(system?.lines || {})) {
      if (line.icon && LINE_ICON_SHAPE_SET.has(line.icon) && COLOR_TO_NAME[line.color]) {
        const colorName = COLOR_TO_NAME[line.color];
        loadPointIcon(`md_${line.icon}_${colorName}`, getLineIconPath(line.icon, colorName));
        iconsHandled.add(`md_${line.icon}_${colorName}`);
      }
    }

    for (const shape of LINE_ICON_SHAPES) {
      for (const colorName of Object.values(COLOR_TO_NAME)) {
        if (iconsHandled.has(`md_${shape}_${colorName}`)) continue;

        loadPointIcon(`md_${shape}_${colorName}`, getLineIconPath(shape, colorName));
      }
    }
  }, [ systemLoaded, styleLoaded, map ]);

  useEffect(() => {
    if (!system.systemIsTrimmed) {
      onToggleMapStyle();
    }
  }, [ system.systemIsTrimmed ]);

  useEffect(() => handleStations(), [focusedId, hoveredIds, prevHoveredIdsRef.current]);

  useEffect(() => {
    renderSystem()
  }, [styleLoaded]);

  useEffect(() => {
    if (Object.keys(system.changing || {}).length) {
      renderSystem();
    }
  }, [
    system.changing?.all,
    system.changing?.stationIds,
    system.changing?.lineKeys,
    system.changing?.segmentKeys,
    linesDisplayedSet
  ]);

  useEffect(() => {
    if (Object.keys(system.stations).length && !hasSystem && systemLoaded) {
      renderSystem();
      setHasSystem(true);
    }
  }, [system, systemLoaded]);

  useEffect(() => {
    if (!groupsDisplayed) {
      setLinesDisplayedSet(new Set(Object.keys(system.lines)));
    } else {
      const groupsDisplayedSet = new Set(groupsDisplayed);
      const tempLineSet = new Set();
      for (const line of Object.values(system.lines || {})) {
        if (groupsDisplayedSet.has(line.lineGroupId ? line.lineGroupId : getMode(line.mode).key)) {
          tempLineSet.add(line.id);
        }
      }
      if (focus?.line?.id) {
        tempLineSet.add(focus.line.id)
      }
      setLinesDisplayedSet(tempLineSet);
    }
  }, [system.lines, system.changing?.lineKeys, groupsDisplayed, focus?.line?.id]);

  useEffect(() => {
    if (!map) return;

    const focusLayerId = `js-Map-focus`;
    let existingLayer = map.getLayer(focusLayerId);

    if (!vehicleRideId && focus && focus.line && (focus.line.stationIds || []).length) {
      const coords = stationIdsToMultiLineCoordinates(system.stations, focus.line.stationIds);
      const focusFeature = {
        "type": "Feature",
        "properties": {
          "line-key": focus.line.id
        },
        "geometry": {
          "type": "MultiLineString",
          "coordinates": coords
        }
      }

      // Beats 0-3 show the highlight outline.
      // Beats 4-7 show the line color or pattern.
      // Beats 3 and 7 are for the opacity transition, happening at the same time as
      // the switch between highlight and color/icon. This enables the ability to have
      // the transitions only take up a total of one fourth of the loop duration.

      if (existingLayer) {
        let existingSource = map.getSource(focusLayerId);
        if (existingSource && existingSource._data && existingSource._data.properties &&
            existingSource._data.properties['line-key'] === focus.line.id) {
          // update focus line opacity and return
          existingSource.setData(focusFeature);

          const highlightColor = getUseLight() ? '#000000' : '#ffffff';
          map.setPaintProperty(existingLayer.id, 'line-pattern', focusBeat < 4 ? '' : getColoredIcon(focus.line));
          map.setPaintProperty(existingLayer.id, 'line-color', focusBeat < 4 ? highlightColor : focus.line.color);
          map.setPaintProperty(existingLayer.id, 'line-width', focusBeat < 4 ? 4 : 12);
          map.setPaintProperty(existingLayer.id, 'line-gap-width', focusBeat < 4 ? 12 : 0);
          map.setPaintProperty(existingLayer.id, 'line-opacity', focusBeat === 3 || focusBeat === 7 ? 0 : 1);

          map.moveLayer(existingLayer.id);
        } else if (existingSource) {
          // existing focus line is for a different line
          map.removeLayer(existingLayer.id);
          map.removeSource(existingLayer.id);
        }
      } else {
        // create new focus line layer
        const layer = {
          'type': 'line',
          'layout': {
            'line-join': 'miter',
            'line-cap': 'butt',
            'line-sort-key': 3
          },
          'source': {
            'type': 'geojson'
          },
          'paint': {
            'line-width': focusBeat < 4 ? 4 : 12,
            'line-gap-width': focusBeat < 4 ? 12 : 0,
            'line-opacity-transition': { duration: FOCUS_ANIM_TIME / 2 }
          }
        };

        const highlightColor = getUseLight() ? '#000000' : '#ffffff';
        layer.paint['line-pattern'] = focusBeat < 4 ? '' : getColoredIcon(focus.line);
        layer.paint['line-color'] = focusBeat < 4 ? highlightColor : focus.line.color;
        layer.paint['line-opacity'] = focusBeat === 3 || focusBeat === 7 ? 0 : 1;

        renderLayer(focusLayerId, layer, focusFeature);
      }

      // ensure (only) stations stay on top when color/pattern is shown
      if (focusBeat >= 4) touchStationLayers();
    } else if (existingLayer) {
      map.removeLayer(existingLayer.id);
      map.removeSource(existingLayer.id);
    }
  }, [focusBeat]);

  useEffect(() => {
    const layerID = 'js-Map-stations';
    const layer = {
      'source': {
        'type': 'geojson'
      },
      'type': 'symbol',
      'filter': [
        'any',
        ['==', ['get', 'priority'], 5],
        ['>=', ['zoom'], zoomThresholdForStations]
      ],
      'layout': {
        'icon-allow-overlap': true,
        'icon-image': ['get', 'icon'],
        'icon-size': ['get', 'size'],
        'icon-padding': 0,
        'icon-pitch-alignment': 'map',
        'text-allow-overlap': true,
        'text-anchor': 'right',
        'text-field': ['get', 'name'],
        'text-padding': 16,
        'symbol-sort-key': ['to-number', ['get', 'priority']]
      },
      'paint': {
        'text-color': '#fff',
        'text-halo-color': '#000',
        'text-halo-width': 2,
        'text-translate': [-16, 0]
      }
    };

    let featCollection = {
      "type": "FeatureCollection",
      "features": stationFeats
    };

    renderLayer(layerID, layer, featCollection);
  }, [stationFeats, zoomThresholdForStations]);

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
      'line-width': 8,
      'line-offset': ['*', ['get', 'offset'], 4]
    }

    if (zoomThresholdsForLines.length === 3) {
      linePaintConfig = {
        'line-width': [
          'step',
          ['zoom'],
          2,
          zoomThresholdsForLines[0], 4,
          zoomThresholdsForLines[1], 6,
          zoomThresholdsForLines[2], 8
        ],
        'line-offset': [
          'step',
          ['zoom'],
          ['*', ['get', 'offset'], 1],
          zoomThresholdsForLines[0], ['*', ['get', 'offset'], 2],
          zoomThresholdsForLines[1], ['*', ['get', 'offset'], 3],
          zoomThresholdsForLines[2], ['*', ['get', 'offset'], 4]
        ]
      }
    }

    const layerIDSolid = 'js-Map-segments--solid';
    const layerSolid = {
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
        "line-sort-key": 2
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

    renderLayer(layerIDSolid, layerSolid, featCollectionSolid, 'js-Map-stations');
    renderLayer(layerIDIcon, layerIcon, featCollectionIcon, 'js-Map-stations');

    touchUpperMapLayers();
  }, [segmentFeats, zoomThresholdsForLines]);

  useEffect(() => {
    const layerIDInner = 'js-Map-interchanges--inner';
    const layerInner = {
      "type": "line",
      "minzoom": zoomThresholdForStations + 0.5, // account for rounding in filter
      "layout": {
        "line-join": "bevel",
        "line-cap": "butt",
        "line-sort-key": 1
      },
      "source": {
        "type": "geojson"
      },
      "paint": {
        "line-color": "#ffffff",
        "line-width": 8
      }
    };

    let featCollectionInner = {
      "type": "FeatureCollection",
      "features": interchangeFeats
    };

    renderLayer(layerIDInner, layerInner, featCollectionInner, 'js-Map-stations');


    const layerIDOuter = 'js-Map-interchanges--outer';
    const layerOuter = {
      "type": "line",
      "minzoom": zoomThresholdForStations + 0.5, // account for rounding in filter
      "layout": {
        "line-join": "bevel",
        "line-cap": "butt",
        "line-sort-key": 1
      },
      "source": {
        "type": "geojson"
      },
      "paint": {
        "line-color": "#000000",
        "line-width": 2,
        "line-gap-width": 8
      }
    };

    let featCollectionOuter = {
      "type": "FeatureCollection",
      "features": interchangeFeats
    };

    renderLayer(layerIDOuter, layerOuter, featCollectionOuter, 'js-Map-stations');

    touchUpperMapLayers();
  }, [interchangeFeats, zoomThresholdForStations]);

  const getUseLight = () => (firebaseContext.settings || {}).lightMode || false;

  const getUseLow = () => vehiclesHidden || (firebaseContext.settings || {}).lowPerformance || false;

  // Provider owns map lifecycle; on context loss, mark style not loaded and re-arm clicks
  const onContextLost = () => {
    setStyleLoaded(false);
    setClickListened(false);
    setEnableClicks(false);
    setTimeout(() => setEnableClicks(true), 100);
  }

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

  const getMapLayers = () => {
    if (!map) return [];

    try {
      return map.getStyle().layers;
    } catch (e) {
      console.log('getMapLayers error:', e);
      return [];
    }
  }

  const touchUpperMapLayers = () => {
    touchStyleLayers();
    touchVehicleLayers();
    touchFocusLayers();
    touchStationLayers()
  }

  const touchStyleLayers = () => {
    if (!map) return;

    if (map.getLayer('js-Map-terrain')) {
      map.moveLayer('js-Map-terrain');
    }

    if (map.getLayer('js-Map-railways')) {
      map.moveLayer('js-Map-railways');
    }

    if (map.getLayer('js-Map-railways')) {
      map.moveLayer('js-Map-railways');
    }
  }

  const touchVehicleLayers = () => {
    if (!map) return;

    for (const existingLayer of getMapLayers()) {
      if (existingLayer.id.startsWith('js-Map-vehicles--')) {
        // ensure vehicles remain on the top
        map.moveLayer(existingLayer.id);
      }
    }
  }

  const touchFocusLayers = () => {
    if (!map) return;

    if (map.getLayer('js-Map-focus')) {
      map.moveLayer('js-Map-focus');
    }

    const focusCircleLayerId = `js-Map-focusCircle--${focusedId}`;
    if (map.getLayer(focusCircleLayerId)) {
      map.moveLayer(focusCircleLayerId);
    }

    const focusCircleLayerIdPrev = `js-Map-focusCircle--${focusedIdPrev}`;
    if (map.getLayer(focusCircleLayerIdPrev)) {
      map.moveLayer(focusCircleLayerIdPrev);
    }
  }

  const touchStationLayers = () => {
    if (!map) return;

    if (map.getLayer('js-Map-interchanges--inner')) {
      map.moveLayer('js-Map-interchanges--inner');
    }

    if (map.getLayer('js-Map-interchanges--outer')) {
      map.moveLayer('js-Map-interchanges--outer');
    }

    if (map.getLayer('js-Map-stations')) {
      map.moveLayer('js-Map-stations');
    }
  }

  const addTopographicLayer = () => {
    if (!map.getSource('js-Map-terrain')) {
      map.addSource('js-Map-terrain', {
        'type': 'vector',
        'url': TOPO_SOURCE
      });
    }
    if (!map.getLayer('js-Map-terrain')) {
      map.addLayer({
        'id': 'js-Map-terrain',
        'type': 'line',
        'source': 'js-Map-terrain',
        'source-layer': 'contour',
        'layout': {},
        'paint': {
          'line-color': [
            'match',
            ['get', 'index'],
            [-1, 5, 10],
            '#cfbd25',
            '#4db86b'
          ],
          'line-width': 1,
        }
      });

      touchUpperMapLayers();
    }
  }

  const addRailwaysLayer = () => {
    if (!map.getSource('js-Map-railways')) {
      map.addSource('js-Map-railways', {
        'type': 'vector',
        'url': RAILWAYS_SOURCE
      });
    }
    if (!map.getLayer('js-Map-railways')) {
      map.addLayer({
        'id': 'js-Map-railways',
        'type': 'line',
        'source': 'js-Map-railways',
        'source-layer': 'road',
        'layout': {},
        'paint': {
          'line-color': [
            'case',
            ['==', ['get', 'class'], 'major_rail'],
            '#ff6993',
            ['==', ['get', 'class'], 'minor_rail'],
            '#dc69ff',
            '#8a69ff'
          ],
          'line-opacity': [
            'match',
            ['get', 'class'],
            ['major_rail', 'minor_rail', 'service_rail'],
            1,
            0
          ],
          'line-width': 1
        }
      });

      touchUpperMapLayers();
    }
  }

  const addBuildingsLayer = () => {
    if (!map.getLayer('js-Map-buildings')) {
      const labelLayerId = getMapLayers().find(
        (layer) => layer.type === 'symbol' && layer.layout['text-field']
      ).id;
      map.addLayer(
        {
          'id': 'js-Map-buildings',
          'source': 'composite',
          'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'],
          'type': 'fill-extrusion',
          'minzoom': 13,
          'paint': {
            'fill-extrusion-color': getUseLight() ? '#dddddd' : '#888888',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
          }
        },
        labelLayerId
      );
    }
  }

  // fits map to station bounds
  // uses system ref as this can be called in a listener set up on load
  const fitMapToStations = (map, animationDuration = FLY_TIME) => {
    const stations = systemRef.current?.stations ?? system.stations;

    let center;
    if (centroid && 'lat' in centroid && 'lng' in centroid) {
      center = [ centroid.lng, centroid.lat ];
    }

    let bounds = new mapboxgl.LngLatBounds();
    for (const sId in stations) {
      if (!stations[sId]?.lng || !stations[sId]?.lat) continue;
      bounds.extend(new mapboxgl.LngLat(stations[sId].lng, stations[sId].lat));
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: 32,
        duration: animationDuration,
        center: center || bounds.getCenter()
      });
    }
  }

  const enableMapInteractions = () => {
    if (!map) return;

    map.boxZoom.enable();
    map.scrollZoom.enable();
    map.dragPan.enable();
    map.dragRotate.enable();
    map.keyboard.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
  }

  const enableStationsAndInteractions = (waitTime) => {
    if (map && !interactive) {
      setTimeout(() => {
        // re-enable map interactions
        enableMapInteractions();
      }, waitTime);
      setInteractive(true);
    }
  }

  // returns the bbox that the map is currently showing, as well as the diagonal length of the bbox
  const getVisibleBbox = () => {
    let bbox;
    let diagonalLength = 0;

    if (map) {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      sw.lng = normalizeLongitude(sw.lng);
      ne.lng = normalizeLongitude(ne.lng);

      // prevent issue where maps spanning antimeridian are "centered" on opposite side of the world
      const spansAntimeridian = Math.abs(sw.lng - ne.lng) > 180;
      if (spansAntimeridian) ne.lng += 360;

      bbox = turfBboxPolygon([sw.lng, sw.lat, ne.lng, ne.lat]);
      diagonalLength = turfLength(turfLineString([ [sw.lng, sw.lat], [ne.lng, ne.lat] ]));
    }

    return { bbox, diagonalLength };
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

  const getVehicleCoords = (vehicleValues, bbox, diagonalLength) => {
    if (!vehicleValues || Object.keys(vehicleValues).length === 0) return { vehicleLineSliceCoords: [[]], vehicleCenterPoint: null };

    const vehicleLength = vehicleValues.mode?.vehicleLength ?? 0.1;
    const carCount = vehicleValues.mode?.carCount ?? 1;

    // if the map size is over 2000x the vehicle size, don't show the vehicle
    const vehicleIsTiny = (diagonalLength / vehicleLength) > 2000;
    // pad the visible map by 10% or the vehicle length, whichever is greater
    const hiddenMapPadding = Math.max(diagonalLength / 10, vehicleLength);

    const coords = vehicleValues.forward ? vehicleValues.sectionCoords.forwards : vehicleValues.sectionCoords.backwards;
    if (!coords?.length) return { vehicleLineSliceCoords: [[]], vehicleCenterPoint: null };

    const sectionLineString = turfLineString(coords);
    const currPosition = turfAlong(sectionLineString, vehicleValues.distance || 0);
    currPosition.geometry.coordinates = [ normalizeLongitude(currPosition.geometry.coordinates[0]), currPosition.geometry.coordinates[1] ];

    if (!vehicleRideId || vehicleRideId !== vehicleValues.lineKey) {
      if (vehicleIsTiny || turfPointToPolygonDistance(currPosition, bbox) > hiddenMapPadding) {
        // don't calculate coords if the vehicle is too small to see or if the vehicle is off screen
        return { vehicleLineSliceCoords: [[]], vehicleCenterPoint: currPosition };
      }
    }

    const directedLineString = vehicleValues.forward ? vehicleValues.lineString : vehicleValues.lineStringRev;
    const lineStringToPosition = turfLineSlice(turfPoint(directedLineString.geometry.coordinates[0]), currPosition, directedLineString);
    const distToPosition = turfLength(lineStringToPosition);

    // calculate coords if the vehicle is visible
    const distAhead = Math.min(vehicleValues.lineLength, distToPosition + (vehicleLength / 2));
    const distBehind = Math.max(0, distToPosition - (vehicleLength / 2));
    const vehicleLineSlice = turfLineSliceAlong(directedLineString, distBehind, distAhead);

    // TODO: more gracefully account for lasso and loop lines

    let multiChunk;
    if (carCount > 1) {
      // add small breaks between vehicle cars
      try {
        const carLength = 1.01 * vehicleLength / carCount;
        let lineChunks = turfLineChunk(vehicleLineSlice, carLength, { reverse: distBehind === 0 });
        lineChunks.features = lineChunks.features.map((lineFeat) => {
          try {
            return turfLineSliceAlong(lineFeat, carLength / 10, 9 * carLength / 10);
          } catch (e) {
            // vehicle is short due to being at the end of a line
            return lineFeat;
          }
        });
        multiChunk = turfCombine(lineChunks);
      } catch (e) {
        // failed to divide vehicle, use full length
      }
    }

    let vehicleLineSliceCoords = [vehicleLineSlice?.geometry?.coordinates ?? []];
    if (multiChunk?.features?.[0]?.geometry?.coordinates) {
      vehicleLineSliceCoords = multiChunk.features[0].geometry.coordinates;
    }

    if (vehicleLineSliceCoords.length >= 2 && vehicleLineSliceCoords[0].length && vehicleLineSliceCoords[vehicleLineSliceCoords.length - 1].length &&
        Math.abs(vehicleLineSliceCoords[0][0][0] - vehicleLineSliceCoords[vehicleLineSliceCoords.length - 1][vehicleLineSliceCoords[vehicleLineSliceCoords.length - 1].length - 1][0]) > 180) {
      // vehicle is spanning antimeridian
      vehicleLineSliceCoords = vehicleLineSliceCoords.map(lSliceCoords => {
        return lSliceCoords.map(coord => ([
          (coord[0] + 360) % 360,
          coord[1]
        ]));
      });
    }

    return {
      vehicleLineSliceCoords,
      vehicleCenterPoint: currPosition,
      isReversed: distBehind === 0 && carCount > 1
    };
  }

  const handleVehiclePopupContent = (line, sections, sectionIndex, forward, speed, isRiding) => {
    if (popupRef.current && popupDomElem?.root) {
      popupDomElem.root.render(getVehiclePopupContent(line, sections, sectionIndex, forward, speed, isRiding));
      popupRef.current = popupRef.current.setDOMContent(popupDomElem.container);
    }
  }

  const handleVehiclePopupPosition = (vehicleCenterPoint) => {
    if (popupRef.current && vehicleCenterPoint) {
      popupRef.current = popupRef.current.setLngLat(vehicleCenterPoint.geometry.coordinates)
    }
  }

  const doVehicleCameraUpdate = (vehicleValues, vehicleLineSliceCoords, isReversed) => {
    const camera = map.getFreeCameraOptions();
    const cameraChunk = Math.floor((vehicleLineSliceCoords.length - 1) / 2);

    const cameraInd = isReversed ? vehicleLineSliceCoords[cameraChunk].length - 1 : 0;
    const lookAtInd = isReversed ? 0 : vehicleLineSliceCoords[cameraChunk].length - 1;

    camera.position = mapboxgl.MercatorCoordinate.fromLngLat(
      {
        lng: vehicleLineSliceCoords[cameraChunk][cameraInd][0],
        lat: vehicleLineSliceCoords[cameraChunk][cameraInd][1]
      },
      10
    );

    const updatedBearing = turfBearing(
      vehicleLineSliceCoords[cameraChunk][cameraInd],
      vehicleLineSliceCoords[cameraChunk][lookAtInd]
    );

    camera.setPitchBearing(75, updatedBearing);

    map.setFreeCameraOptions(camera);
  }

  const getVehiclePopupContent = (line, sections, sectionIndex, forward, speed, isRiding) => {
    const nextSection = sections[sectionIndex];
    const nextStationId = forward ? nextSection[nextSection.length - 1] : nextSection[0];
    let lastStationId;
    if (forward) {
      const lastSection = sections[sections.length - 1];
      if (lastSection[lastSection.length - 1] in system.stations && !system.stations[lastSection[lastSection.length - 1]]?.isWaypoint) {
        lastStationId = lastSection[lastSection.length - 1];
      } else if (lastSection[lastSection.length - 2] in system.stations && !system.stations[lastSection[lastSection.length - 2]]?.isWaypoint) {
        lastStationId = lastSection[lastSection.length - 2];
      }
    } else {
      const firstSection = sections[0];
      if (firstSection[0] in system.stations && !system.stations[firstSection[0]]?.isWaypoint) {
        lastStationId = firstSection[0];
      } else if (firstSection[1] in system.stations && !system.stations[firstSection[1]]?.isWaypoint) {
        lastStationId = firstSection[1];
      }
    }

    const colorIconStyle = getLineColorIconStyle(line);
    const mode = getMode(line.mode);

    let speedContent;
    if (isRiding) {
      const usesImperial = (navigator?.language ?? 'en').toLowerCase() === 'en-us';
      const divider = usesImperial ? MILES_TO_KMS_MULTIPLIER : 1;
      if (speed === 0) {
        speedContent = 'Stationary';
      } else {
        speedContent = `${Math.round(60 * speed / divider)} ${usesImperial ? 'mph' : 'kph'}`;
      }
    }

    const popupContent = (
      <div className="Map-popupContent">
        <button className="Map-popupHead"
                onClick={() => onLineClick(line.id)}>
          <div className="Map-popupIcon"
              style={colorIconStyle.parent}
              data-lightcolor={getLuminance(line.color) > 128}>
            <div style={colorIconStyle.child}></div>
          </div>
          <div className="Map-popupLineName">
            {escapeHtml(line.name)}
          </div>
        </button>
        {nextStationId && system.stations[nextStationId].name && (
          <div className="Map-popupStationRow">
            Next Stop: <span className="Map-popupStationName">{escapeHtml(system.stations[nextStationId].name)}</span>
          </div>
        )}
        {lastStationId && system.stations[lastStationId].name && (
          <div className="Map-popupStationRow">
            Last Stop: <span className="Map-popupStationName">{escapeHtml(system.stations[lastStationId].name)}</span>
          </div>
        )}
        {isRiding && (
          <div className="Map-popupStationRow">
            Speed: <span className="Map-popupStationName">{escapeHtml(speedContent)}</span>
          </div>
        )}
        {!isRiding && (
          <button className="Map-popupRide Link" onClick={() => {
            setVehicleRideId(line.id);
            ReactGA.event({
              category: 'System',
              action: 'Ride Along (Popup)'
            });
          }}>
            <i className={mode.faIcon} />
            Ride this {mode.shortName}
          </button>
        )}
      </div>
    );
    return popupContent;
  }

  const handleVehicles = (lines) => {
    if (!map || getUseLow()) {
      animationRef.current = null;
      return;
    }

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
      if ((line.stationIds || []).length <= 1 || (interactive && !linesDisplayedSet.has(line.id))) continue;

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

      const sections = divideLineSections(line, system.stations);
      let sectionIndex = getSectionIndex(sections, vehicleValues.prevStationId, vehicleValues.prevSectionIndex, vehicleValues.forward);
      let sectionCoords = stationIdsToCoordinates(system.stations, sections[sectionIndex]);
      let backwardCoords = sectionCoords.slice().reverse();

      if (!(sectionCoords || []).length) {
        continue;
      }

      // get the distance of the section to interpolate along it
      vehicleValues.routeDistance = turfLength(turfLineString(sectionCoords));

      vehicleValues.sections = sections;
      vehicleValues.sectionIndex = sectionIndex;
      vehicleValues.sectionCoords = {
        forwards: sectionCoords,
        backwards: backwardCoords
      }

      // use multicoords to get exact rendered distances and positions
      const multiLineCoordsFlat = stationIdsToMultiLineCoordinates(system.stations, line.stationIds).flat();
      vehicleValues.lineString = turfLineString(multiLineCoordsFlat);
      vehicleValues.lineStringRev = turfLineString(multiLineCoordsFlat.slice().reverse());
      vehicleValues.lineLength = turfLength(vehicleValues.lineString);
      vehicleValues.mode = getMode(line.mode);

      vehicleValuesByLineId[line.id] = vehicleValues;

      // create new vehicle and add to features list
      const vehicleData = {
        "type": "Feature",
        "properties": {
          'lineKey': line.id,
          'color': getLuminance(line.color) > 128 ? '#000000' : '#ffffff',
          'width': 4,
          'prevStationId': sections[sectionIndex][vehicleValues.forward ? 0 : sections[sectionIndex].length - 1],
          'prevSectionIndex': sectionIndex,
          'speed': vehicleValues.speed,
          'distance': vehicleValues.distance,
          'forward': vehicleValues.forward,
          'isCircular': vehicleValues.isCircular
        },
        "geometry": {
          'type': 'MultiLineString',
          'coordinates': [[]],
        }
      }
      vehicles.features.push(vehicleData);
    }

    if (!map.getLayer(vehicleLayerId)) {
      let newVehicleLayer = {
        'source': {
          'type': 'geojson'
        },
        'type': 'line',
        'layout': {
            'line-join': 'round',
            'line-cap': 'square',
            'line-sort-key': 1
        },
        'source': {
          'type': 'geojson'
        },
        'paint': {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
        }
      }
      renderLayer(vehicleLayerId, newVehicleLayer, vehicles, 'js-Map-stations');
    }

    if (layerIdToRemove) {
      // remove existing vehicles a moment later to ensure smooth transition with no rendering flash
      setTimeout(() => {
        if (map.getLayer(layerIdToRemove)) {
          map.removeLayer(layerIdToRemove);
        }

        if (map.getSource(layerIdToRemove)) {
          map.removeSource(layerIdToRemove);
        }
      }, 10);
    }

    // actually animate the change in vehicle position per render frame
    const animateVehicles = (time) => {
      const { bbox, diagonalLength } = getVisibleBbox();

      let updatedVehicles = {
        "type": "FeatureCollection",
        "features": []
      };

      for (const line of Object.values(lines)) {
        // vehicle travels 60x actual speed, so 60 km/min instead of 60 kph irl
        let vehicleValues = vehicleValuesByLineId[line.id];
        if (!vehicleValues) continue;
        if (!vehicleValues.lastTime) vehicleValues.lastTime = time;

        const mode = vehicleValues.mode || getMode(line.mode);
        vehicleValues.mode = mode;

        // when riding a vehicle, time slows down to only 6x real time (normally 60x)
        let pauseForEnv = mode.pause;
        let speedForEnv = mode.speed;
        let accelerationForEnv = mode.acceleration;
        let minSpeedForEnv = 0.01;
        if (vehicleRideId) {
          pauseForEnv = mode.pause * 10;
          speedForEnv = mode.speed / 10;
          accelerationForEnv = mode.acceleration / 3;
          minSpeedForEnv = 0.01 / 3;
        }

        if (!vehicleValues.pauseTime || time - vehicleValues.pauseTime >= pauseForEnv) { // check if vehicle is paused at a station
          delete vehicleValues.pauseTime;

          const accelDistance = speedForEnv / accelerationForEnv;
          const noTopSpeed = vehicleValues.routeDistance < accelDistance * 2; // distance is too short to reach top speed

          if (vehicleValues.distance > (noTopSpeed ? vehicleValues.routeDistance / 2 : vehicleValues.routeDistance - accelDistance)) {
            // if vehicle is slowing down approaching a station
            const slowingDist = vehicleValues.distance - (noTopSpeed ? vehicleValues.routeDistance / 2 : vehicleValues.routeDistance - accelDistance); // how far past the braking point it is
            const topSpeedRatio = noTopSpeed ? (vehicleValues.routeDistance / (accelDistance * 2)) : 1; // what percentage of the top speed it gets to in this section
            const slowingDistanceRatio = slowingDist / (noTopSpeed ? (vehicleValues.routeDistance / 2) : accelDistance); // percentage of the braking zone it has gone through
            const slowingSpeed = speedForEnv * topSpeedRatio * (1 - slowingDistanceRatio); // current speed in deceleration
            vehicleValues.speed = Math.max(slowingSpeed, minSpeedForEnv);
          } else if (vehicleValues.distance <= (noTopSpeed ? vehicleValues.routeDistance / 2 : accelDistance)) {
            // if vehicle is accelerating out of a station
            vehicleValues.speed = Math.max(speedForEnv * (vehicleValues.distance / accelDistance), minSpeedForEnv);
          } else {
            // vehicle is at top speed
            vehicleValues.speed = speedForEnv;
          }

          vehicleValues.distance += vehicleValues.speed * (time - vehicleValues.lastTime) / 1000;
        }

        vehicleValues.lastTime = time;

        if (!vehicleValues.sectionCoords ||
            (vehicleValues.sectionCoords.forwards || []).length < 2 ||
            (vehicleValues.sectionCoords.backwards || []).length < 2) {
          continue;
        }

        if (!map || !bbox || !diagonalLength) continue;

        let hasPopup = false;
        try {
          const { vehicleLineSliceCoords, vehicleCenterPoint, isReversed } = getVehicleCoords(vehicleValues, bbox, diagonalLength);

          if (vehicleRideId && vehicleRideId === line.id) {
            doVehicleCameraUpdate(vehicleValues, vehicleLineSliceCoords, isReversed);
            handleVehiclePopupContent(
              line,
              vehicleValues.sections,
              vehicleValues.sectionIndex,
              vehicleValues.forward,
              vehicleValues.speed * (vehicleRideId ? 10 : 1),
              true
            );
          }

          if (vehicleCenterPoint && clickInfo?.featureType === 'vehicle' && clickInfo?.lineId && clickInfo.lineId === line.id && popupRef.current) {
            hasPopup = true;
            if (vehicleRideId && vehicleRideId === line.id) {
              // if vehicle is being ridden, put popup in center of map
              const center = map.getCenter();
              const popupPosition = turfPoint([ center.lng, center.lat ]);
              handleVehiclePopupPosition(popupPosition);
            } else {
              handleVehiclePopupPosition(vehicleCenterPoint);
            }
          }

          updatedVehicles.features.push({
            "type": "Feature",
            "properties": {
              'lineKey': line.id,
              'color': getLuminance(line.color) > 128 ? '#000000' : '#ffffff',
              'width': hasPopup ? 8 : 4,
              'prevStationId': vehicleValues.sections[vehicleValues.sectionIndex][vehicleValues.forward ? 0 : vehicleValues.sections[vehicleValues.sectionIndex].length - 1],
              'prevSectionIndex': vehicleValues.sectionIndex,
              'speed': vehicleValues.speed,
              'distance': vehicleValues.distance,
              'lastTime': time,
              'forward': vehicleValues.forward,
              'isCircular': vehicleValues.isCircular
            },
            "geometry": {
              'type': 'MultiLineString',
              'coordinates': vehicleLineSliceCoords,
            }
          });
        } catch (e) {
          continue;
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

          const nextSection = vehicleValues.sections[vehicleValues.sectionIndex];
          vehicleValues.sectionCoords.forwards = stationIdsToCoordinates(system.stations, nextSection);
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

          if (hasPopup) {
            handleVehiclePopupContent(
              line,
              vehicleValues.sections,
              vehicleValues.sectionIndex,
              vehicleValues.forward,
              0,
              vehicleRideId && vehicleRideId === line.id
            );
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

      if (system.changing && system.changing.all) {
        postChangingAll();
      }
    }
  }

  const stationAttributesToSymbolName = ({ isWaypoint, hasLine, hasTransfer }) => {
    if (isWaypoint) {
      return getUseLight() ? 'md_waypoint_dark' : 'md_waypoint_light';
    } else if (hasTransfer) {
      return 'md_transfer';
    } else if (hasLine) {
      return 'md_station';
    } else {
      return 'md_stationDiscon';
    }
  }

  const stationAttributesToSymbolPriority = ({ isWaypoint, hasLine, hasTransfer, isFocused }) => {
    if (isFocused) {
      return 5;
    } else if (!hasLine) {
      return 4;
    } else if (hasTransfer) {
      return 3;
    } else if (!isWaypoint) {
      return 2;
    } else {
      return 1;
    }
  }

  const handleStations = () => {
    const stations = system.stations;

    let stationIdsToHandle = [];
    if (system.changing?.all) {
      stationIdsToHandle = Object.keys(stations);
    } else if (system.changing?.stationIds) {
      stationIdsToHandle = system.changing.stationIds;
    }

    if (focusedId) {
      stationIdsToHandle.push(focusedId);
    }
    if (focusedIdPrev) {
      stationIdsToHandle.push(focusedIdPrev);
    }
    if (hoveredIds?.length) {
      stationIdsToHandle.push(...hoveredIds);
    }
    if (prevHoveredIdsRef.current?.length) {
      stationIdsToHandle.push(...prevHoveredIdsRef.current);
    }
    if (focus?.line?.stationIds) {
      stationIdsToHandle.push(...focus.line.stationIds);
    }

    let updatedStationFeatures = {};
    if (stationIdsToHandle.length) {
      for (const id of stationIdsToHandle) {
        updatedStationFeatures[id] = {};

        // station has been deleted
        if (!stations[id]) {
          handleStationCircle({ id });
          continue;
        };

        const station = floatifyStationCoord(stations[id]);

        // check for invalid station
        if (!('lat' in station) || !('lng' in station)) continue;
        // do not show waypoints in viewonly mode
        if (viewOnly && station.isWaypoint) continue;
        // do not show waypoints unless it is focused
        if (waypointsHidden && station.isWaypoint && id !== focusedId) continue;

        const { lng, lat } = station;

        let onLines = false;
        let hasLine = false;
        let hasTransfer = false;
        if (system.transfersByStationId?.[id]) {
          if ((system.transfersByStationId[id].onLines || []).length) {
            hasLine = true;
            onLines = system.transfersByStationId[id].onLines;
          };
          if ((system.transfersByStationId[id].hasTransfers || []).length) {
            hasTransfer = true;
          };
        }

        // hide stations that are only on lines that are hidden
        let showStation = true;
        if (hasLine) {
          showStation = false;
          for (const onLine of onLines) {
            const isInDisplayedSet = linesDisplayedSet.has(onLine.lineId);
            if (onLine.lineId && (isInDisplayedSet || onLine.lineId === focusedId)) {
              showStation = true;
              break;
            }
          }
        }

        if (!showStation && id !== focusedId)  {
          handleStationCircle({ id });
          continue;
        };;

        const symbolName = stationAttributesToSymbolName({
          isWaypoint: station.isWaypoint,
          hasLine,
          hasTransfer
        });
        const symbolPriority = stationAttributesToSymbolPriority({
          isWaypoint: station.isWaypoint,
          isFocused: id === focusedId,
          hasLine,
          hasTransfer
        });

        const targetHoveredId = (hoveredIds?.[0] ?? '');
        let name = '';
        if (station.isWaypoint && id === targetHoveredId) {
          name = 'Waypoint'
        } else if (!station.isWaypoint &&
                  (id === targetHoveredId || id === focusedId) &&
                  station.name !== 'Station Name') {
          name = station.name ? station.name : 'Station'
        }

        const feature = {
          "type": "Feature",
          "properties": {
            'stationId': id,
            'icon': symbolName,
            'name': name,
            'size': id === focusedId ? 0.375 : 0.25,
            'priority': symbolPriority
          },
          "geometry": {
            'type': 'Point',
            'coordinates': [lng, lat],
          }
        }

        updatedStationFeatures[id] = feature;

        handleStationCircle(station);
      }
    }

    if (Object.keys(updatedStationFeatures).length) {
      setStationFeats(stationFeats => {
        let newFeats = {};
        for (const feat of stationFeats) {
          newFeats[feat.properties['stationId']] = feat;
        }
        for (const featId in updatedStationFeatures) {
          newFeats[featId] = updatedStationFeatures[featId];
        }
        return Object.values(newFeats).filter(nF => nF.type);
      });
    }
  }

  const handleStationCircle = (station) => {
    if (!map) return;

    const circleId = 'js-Map-focusCircle--' + station.id;
    const { lng, lat } = station;

    if (station?.id && station.id === focusedId && lng && lat) {
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

        renderLayer(circleId, circleLayer, circleData, 'js-Map-stations')
      } else if (station.isWaypoint && map.getLayer(circleId)) {
        map.removeLayer(circleId);
        map.removeSource(circleId);
      }
    } else if (station.id === focusedIdPrev && map.getLayer(circleId)) {
      map.removeLayer(circleId);
      map.removeSource(circleId);
    }
  }

  const handleLines = () => {
    const hasChanging = system.changing?.lineKeys || system.changing?.all || focus?.line?.id;
    if (hasChanging) {
      handleVehicles(system.lines);
    }
  }

  const handleSegments = () => {
    const stations = system.stations || {};
    const lines = system.lines || {};
    const interlineSegments = system.interlineSegments || {};

    const segmentsBeingHandled = system.changing?.all ? Object.keys(interlineSegments) : (system.changing?.segmentKeys ?? []);

    let updatedSegmentFeatures = {};

    for (const segmentKey of segmentsBeingHandled) {
      if (!(segmentKey in interlineSegments)) {
        for (const lineKey of Object.keys(lines)) {
          updatedSegmentFeatures[segmentKey + '|' + lines[lineKey].color + '|' + getColoredIcon(lines[lineKey], 'solid')] = {};
        }
        continue;
      }

      const segment = interlineSegments[segmentKey];
      const coords = stationIdsToMultiLineCoordinates(stations, segment.stationIds);

      for (const pattern of segment.patterns) {
        if (pattern.icon) {
          const data = {
            "type": "Feature",
            "properties": {
              "segment-key": segmentKey,
              "segment-longkey": segmentKey + '|' + pattern.color + '|' + pattern.icon,
              "icon": pattern.icon,
              "offset": segment.offsets[`${pattern.color}|${pattern.icon}`]
            },
            "geometry": {
              "type": "MultiLineString",
              "coordinates": coords
            }
          }

          updatedSegmentFeatures[segmentKey + '|' + pattern.color + '|' + pattern.icon] = data;
        } else {
          const data = {
            "type": "Feature",
            "properties": {
              "segment-key": segmentKey,
              "segment-longkey": segmentKey + '|' + pattern.color + '|solid',
              "color": pattern.color,
              "offset": segment.offsets[`${pattern.color}|${pattern.icon ? pattern.icon : 'solid'}`]
            },
            "geometry": {
              "type": "MultiLineString",
              "coordinates": coords
            }
          }

          updatedSegmentFeatures[segmentKey + '|' + pattern.color + '|solid'] = data;
        }
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

  const handleInterchanges = () => {
    const stations = system.stations;
    const interchanges = system.interchanges;

    let updatedInterchangeFeatures = {};
    if (system.changing?.interchangeIds || system.changing?.all) {
      for (const interchangeId of (system.changing.all ? Object.keys(interchanges) : system.changing.interchangeIds)) {
        if (!(interchangeId in interchanges) ||
            (interchanges[interchangeId].stationIds?.length ?? 0) <= 1) {
          updatedInterchangeFeatures[interchangeId] = {};
          continue;
        }

        let showInterchange = true;
        let hasAtLeastOneLine = false;
        for (const sId of interchanges[interchangeId].stationIds) {
          if (sId === focusedId) {
            showInterchange = true;
            break;
          }

          const onLines = system.transfersByStationId?.[sId]?.onLines || [];
          hasAtLeastOneLine = hasAtLeastOneLine || (onLines.length !== 0);
          for (const onLine of onLines) {
            // only show interchanges connected to displayed lines
            if (onLine.lineId && linesDisplayedSet.has(onLine.lineId)) {
              showInterchange = true;
              break;
            } else {
              showInterchange = false;
            }
          }

          if (showInterchange) break;
        }

        if (!showInterchange) {
          updatedInterchangeFeatures[interchangeId] = {};
          continue;
        }

        const multiCoords = stationIdsToMultiLineCoordinates(stations, interchanges[interchangeId].stationIds);
        if (multiCoords.length > 0 && multiCoords[0].length > 1) {
          const feature = {
            "type": "Feature",
            "properties": {
              "interchange-id": interchangeId,
              "is-connected": hasAtLeastOneLine,
              "color": "#ffffff" // TODO: perhaps gray out when !hasAtLeastOneLine
            },
            "geometry": {
              "type": "MultiLineString",
              "coordinates": multiCoords
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

  const renderLayer = (layerID, layer, data, beforeLayerId = '') => {
    if (map) {
      if (map.getLayer(layerID)) {
        // Update layer with new features
        map.getSource(layerID).setData(data);
        // TODO: may need to update filter, line, paint too
      } else {
        initialLinePaint(layer, layerID, data, beforeLayerId);
      }
    }
  }

  const initialLinePaint = (layer, layerID, data, beforeLayerId) => {
    // Initial paint of line
    if (styleLoaded && !map.getLayer(layerID)) {
      let newLayer = JSON.parse(JSON.stringify(layer));
      newLayer.id = layerID;
      newLayer.source.data = data;

      if (beforeLayerId && map.getLayer(beforeLayerId)) {
        map.addLayer(newLayer, beforeLayerId ? beforeLayerId : undefined);
      } else {
        map.addLayer(newLayer);
      }
    }
  }

  return (
    <MapSlot className="Map" />
  );
}
