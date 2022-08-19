import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

import { checkForTransfer } from '../util.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v10';
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v10';
const SHORT_TIME = 200;
const LONG_TIME = 400;
const INITIAL_OPACITY = 0;
const FINAL_OPACITY = 1;

export function Map(props) {
  const mapEl = useRef(null);
  const [ map, setMap ] = useState();
  const [ hasSystem, setHasSystem ] = useState(false);
  const [ clickListened, setClickListened ] = useState(false);
  const [ enableClicks, setEnableClicks ] = useState(false);
  const [ interactive, setInteractive ] = useState(false);
  const [ focusedId, setFocusId ] = useState();
  const [ hideStations, setHideStations ] = useState(false);
  const [ useLight, setUseLight ] = useState(false);

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
    // TODO: fix this

    // This determines which, if any, station should be focused
    if (props.focus && props.focus.station) {
      if (props.focus.station.id !== focusedId) {
        setFocusId(props.focus.station.id);
      } else if (props.focus.station.id === focusedId) {
        // Already set
      }
    } else if (focusedId !== null) {
      setFocusId(null);
    }
  }, [props.focus]);

  const initialLinePaint = (layer, layerID, data, FINAL_OPACITY, LONG_TIME) => {
    // Initial paint of line
    if (!map.getLayer(layerID)) {
      let newLayer = JSON.parse(JSON.stringify(layer));
      newLayer.id = layerID;
      newLayer.source.data = data;
      newLayer.paint['line-opacity'] = FINAL_OPACITY;
      newLayer.paint['line-opacity-transition']['duration'] = LONG_TIME;
      map.addLayer(newLayer);
    }

    if (!map.getLayer(layerID + '-prev')) {
      let prevLayer = JSON.parse(JSON.stringify(layer));
      prevLayer.id = layerID + '-prev';
      prevLayer.source.data = data;
      prevLayer.paint['line-opacity'] = FINAL_OPACITY;
      map.addLayer(prevLayer);
    }
  }

  const enableStationsAndInteractions = () => {
    if (map && !interactive) {
      // TODO: may need to check if this happened already
      map.once('idle', () => {
        // re-enable map interactions
        map.boxZoom.enable();
        map.scrollZoom.enable();
        map.dragPan.enable();
        map.dragRotate.enable();
        map.keyboard.enable();
        map.doubleClickZoom.enable();
        map.touchZoomRotate.enable();
      });
      setInteractive(true);
    }
  }

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
          padding: Math.min(window.innerHeight, window.innerWidth) / 10
        });

        map.once('idle', () => {
          setEnableClicks(true);
        });
      }

      if (!bounds.isEmpty() || props.newSystemSelected) {
        enableStationsAndInteractions();
      }
    }
  }, [props.initial, props.system, map]);

  useEffect(() => {
    if (props.newSystemSelected) {
      map.once('idle', () => {
        setEnableClicks(true);
      });
    }
  }, [props.newSystemSelected]);

  useEffect(() => {
    if (Object.keys(props.changing).length) {
      handleStations();
      handleLines();
      handleSegments();
    }
  }, [props.changing]);

  useEffect(() => {
    if (Object.keys(props.system.stations).length && !hasSystem) {
      handleStations();
      handleLines();
      handleSegments();

      setHasSystem(true);
    }
  }, [props.system]);

  const handleStations = () => {
    const stations = props.system.stations;
    const lines = props.system.lines;
    const interlineSegments = props.system.interlineSegments;

    if (props.changing.stationIds || props.changing.all) {
      const stationKeys = Object.keys(stations);
      for (const id of (props.changing.all ? stationKeys : props.changing.stationIds)) {
        const pin = document.getElementById('js-Map-station--' + id);
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

          const svgCircle = `<svg height="16" width="16">
                              <circle cx="8" cy="8" r="6" stroke="#000" stroke-width="2" fill="${color}" />
                            </svg>`;
          const svgRhombus = `<svg height="20" width="20">
                                <rect rx="3" ry="3" x="0" y="0" height="14.14" width="14.14" stroke="#000" stroke-width="2" fill="${color}" transform="translate(10, 0) rotate(45)" />
                              </svg>`;

          let el = document.createElement('button');
          el.id = 'js-Map-station--' + id;
          el.className = 'js-Map-station Map-station';
          if (hasTransfer) {
            el.className += ' Map-station--interchange';
          }
          if (id === focusedId) {
            el.className += ' js-Map-station--focused Map-station--focused';
          }
          el.dataset.tip = stations[id].name || 'Station';
          el.innerHTML = hasTransfer ? svgRhombus : svgCircle;

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
        }
      }
    }
  }

  const handleLines = () => {
    const stations = props.system.stations;
    const lines = props.system.lines;
    const interlineSegments = props.system.interlineSegments;

    if (props.changing.lineKeys || props.changing.all) {
      for (const lineKey of (props.changing.all ? Object.keys(lines) : props.changing.lineKeys)) {
        const layerID = 'js-Map-line--' + lineKey;

        if (!(lineKey in lines) || lines[lineKey].stationIds.length <= 1) {
          if (map && map.getLayer(layerID)) {
            map.removeLayer(layerID + '-prev');
            map.removeSource(layerID + '-prev');
            map.removeLayer(layerID);
            map.removeSource(layerID);
          }
          continue;
        }

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
              "line-width": 8,
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

          if (map) {
            if (map.getLayer(layerID)) {
              // Update line
              let newLayer = JSON.parse(JSON.stringify(layer));
              newLayer.id = layerID;
              newLayer.source.data = data;
              newLayer.paint['line-opacity'] = INITIAL_OPACITY;
              newLayer.paint['line-opacity-transition']['duration'] = LONG_TIME;

              map.removeLayer(layerID);
              map.removeSource(layerID);
              map.addLayer(newLayer, layerID + '-prev');
              map.setPaintProperty(layerID, 'line-opacity', FINAL_OPACITY);

              setTimeout(() => {
                // TODO: do we even need isStyleLoaded?
                if (!map.getLayer(layerID + '-prev')) {
                  let tempLayer = JSON.parse(JSON.stringify(newLayer));
                  tempLayer.id = layerID + '-prev';
                  map.addLayer(tempLayer);
                }
                map.setPaintProperty(layerID + '-prev', 'line-opacity', INITIAL_OPACITY);

                setTimeout(() => {
                  let source = map.getSource(layerID + '-prev');
                  if (source) {
                    source.setData(data);
                    if (map.getLayer(layerID + '-prev')) {
                      map.setPaintProperty(layerID + '-prev', 'line-opacity', FINAL_OPACITY);
                    }
                  }
                }, SHORT_TIME);
              }, SHORT_TIME);

            } else {
              initialLinePaint(layer, layerID, data, FINAL_OPACITY, LONG_TIME);
            }
          }
        }
      }
    }
  }

  const handleSegments = () => {
    const stations = props.system.stations;
    const lines = props.system.lines;
    const interlineSegments = props.interlineSegments;

    for (const segmentKey of (props.changing.all ? Object.keys(interlineSegments) : (props.changing.segmentKeys || []))) {
      for (const layerID of Object.keys(lines).map(lKey => 'js-Map-segment--' + segmentKey + '|' + lines[lKey].color)) {
        // remove matching layers of all possible colors
        if (map && map.getLayer(layerID)) {
          map.removeLayer(layerID + '-prev');
          map.removeSource(layerID + '-prev');
          map.removeLayer(layerID);
          map.removeSource(layerID);
        }
      }

      if (!(segmentKey in interlineSegments)) {
        continue;
      }

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
            "line-width": 8,
            "line-translate": segment.offests[color],
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

        // TODO: this should be abstracted
        if (map) {
          if (map.getLayer(layerID)) {
            // Update line
            let newLayer = JSON.parse(JSON.stringify(layer));
            newLayer.id = layerID;
            newLayer.source.data = data;
            newLayer.paint['line-opacity'] = INITIAL_OPACITY;
            newLayer.paint['line-opacity-transition']['duration'] = LONG_TIME;

            map.removeLayer(layerID);
            map.removeSource(layerID);
            map.addLayer(newLayer);
            map.setPaintProperty(layerID, 'line-opacity', FINAL_OPACITY);

            setTimeout(() => {
              // TODO: do we even need isStyleLoaded?
              if (!map.getLayer(layerID + '-prev')) {
                let tempLayer = JSON.parse(JSON.stringify(newLayer));
                tempLayer.id = layerID + '-prev';
                map.addLayer(tempLayer);
              }
              map.setPaintProperty(layerID + '-prev', 'line-opacity', INITIAL_OPACITY);

              setTimeout(() => {
                let source = map.getSource(layerID + '-prev');
                if (source) {
                  source.setData(data);
                  if (map.getLayer(layerID + '-prev')) {
                    map.setPaintProperty(layerID + '-prev', 'line-opacity', FINAL_OPACITY);
                  }
                }
              }, SHORT_TIME);
            }, SHORT_TIME);

          } else {
            initialLinePaint(layer, layerID, data, FINAL_OPACITY, LONG_TIME);
          }
        }
      }
    }
  }

  return (
    <div className="Map" ref={el => (mapEl.current = el)}></div>
  );
}
