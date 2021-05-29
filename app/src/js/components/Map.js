import React from 'react';
import mapboxgl from 'mapbox-gl';
import { lineString } from '@turf/helpers';
import turfBezier from '@turf/bezier-spline';

import { checkForTransfer } from '../util.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v10';
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v10';

export class Map extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      focusedId: null,
      hideStations: false,
      useLight: false
    };
  }

  componentDidMount() {
    const map = new mapboxgl.Map({
      container: this.mapContainer,
      style: this.props.useLight ? LIGHT_STYLE : DARK_STYLE,
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
      if (e.originalEvent.cancelBubble || this.props.viewOnly) {
        return;
      }

      if (!(this.props.initial && !(this.props.gotData || this.props.newSystemSelected))) {
        const { lng, lat } = e.lngLat;

        this.props.onMapClick({
          lng: lng,
          lat: lat,
          id: this.props.meta.nextStationId,
          name: 'Station Name'
        });
      }
    });

    this.setState({
      map: map,
      listened: false,
      interactive: false
    });

    this.props.onMapInit(map);
  }

  componentDidUpdate() {
    if (this.props.useLight && !this.state.useLight) {
      this.props.onToggleMapStyle(this.state.map, LIGHT_STYLE);
      this.setState({
        useLight: true
      });
    } else if (!this.props.useLight && this.state.useLight) {
      this.props.onToggleMapStyle(this.state.map, DARK_STYLE);
      this.setState({
        useLight: false
      });
    }

    // This determines which, if any, station should be focused
    if (this.props.focus && this.props.focus.station) {
      if (this.props.focus.station.id !== this.state.focusedId) {
        this.setState({
          focusedId: this.props.focus.station.id
        });
        return this.props.focus.station.id;
      } else if (this.props.focus.station.id === this.state.focusedId) {
        return this.state.focusedId;
      }
    } else if (this.state.focusedId !== null) {
      const curr = this.state.focusedId;
      this.setState({
        focusedId: null
      });
      return curr;
    } else {
      return null;
    }
  }

  initialLinePaint(layer, layerID, data, finalOpacity, longTime) {
    // Initial paint of line
    if (!this.state.map.getLayer(layerID)) {
      let newLayer = JSON.parse(JSON.stringify(layer));
      newLayer.id = layerID;
      newLayer.source.data = data;
      newLayer.paint['line-opacity'] = finalOpacity;
      newLayer.paint['line-opacity-transition']['duration'] = longTime;
      this.state.map.addLayer(newLayer);
    }

    if (!this.state.map.getLayer(layerID + '-prev')) {
      let prevLayer = JSON.parse(JSON.stringify(layer));
      prevLayer.id = layerID + '-prev';
      prevLayer.source.data = data;
      prevLayer.paint['line-opacity'] = finalOpacity;
      this.state.map.addLayer(prevLayer);
    }
  }

  enableStationsAndInteractions() {
    if (!this.state.interactive) {
      this.state.map.once('idle', () => {
        // re-enable map interactions
        this.state.map.boxZoom.enable();
        this.state.map.scrollZoom.enable();
        this.state.map.dragPan.enable();
        this.state.map.dragRotate.enable();
        this.state.map.keyboard.enable();
        this.state.map.doubleClickZoom.enable();
        this.state.map.touchZoomRotate.enable();

        this.setState({
          interactive: true
        });
      });
    }
  }

  // Previously used, no longer
  shouldShowStations(count) {
    const zoom = this.state.map.getZoom();
    if (count <= 50 && zoom > 9.5) {
      return true;
    } else if (count > 50 && count < 150 && zoom > 10) {
      return true;
    } else if (count > 150 && count < 300 && zoom > 10.5) {
      return true;
    } else if (count > 300 && zoom > 11.5) {
      return true;
    }
    return false;
  }

  render() {
    const stations = this.props.system.stations;
    const lines = this.props.system.lines;
    const focusedId = this.state.focusedId;
    let changing = this.props.changing;
    if (focusedId !== null) {
      if (changing.stationIds) {
        changing.stationIds.push(focusedId);
      } else {
        changing.stationIds = [focusedId];
      }
    }

    if (this.props.initial) {
      let bounds = new mapboxgl.LngLatBounds();
      for (const sId in stations) {
        bounds.extend(new mapboxgl.LngLat(stations[sId].lng, stations[sId].lat));
      }
      if (!bounds.isEmpty()) {
        this.state.map.fitBounds(bounds, {
          center: bounds.getCenter(),
          padding: Math.min(window.innerHeight, window.innerWidth) / 10
        });
      }

      if (!bounds.isEmpty() || this.props.newSystemSelected) {
        this.enableStationsAndInteractions();
      }
    }

    if (changing.stationIds || changing.all) {
      const stationKeys = Object.keys(stations);
      for (const id of (changing.all ? stationKeys : changing.stationIds)) {
        const pin = document.getElementById('js-Map-station--' + id);
        if (stationKeys.includes(id) || this.props.initial) {
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
            this.props.onStopClick(id);
            e.stopPropagation();
          });

          new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .addTo(this.state.map);
        } else {
          if (pin) {
            pin.parentNode.removeChild(pin);
          }
        }
      }
    }

    if (changing.lineKeys || changing.all) {
      for (const lineKey of (changing.all ? Object.keys(lines) : changing.lineKeys)) {
        const layerID = 'js-Map-line--' + lineKey;

        if (!(lineKey in lines) || lines[lineKey].stationIds.length <= 1) {
          if (this.state.map && this.state.map.getLayer(layerID)) {
            this.state.map.removeLayer(layerID + '-prev');
            this.state.map.removeSource(layerID + '-prev');
            this.state.map.removeLayer(layerID);
            this.state.map.removeSource(layerID);
          }
          continue;
        }

        const coords = lines[lineKey].stationIds.map(id => [stations[id].lng, stations[id].lat]);
        if (coords.length > 1) {
          const shortTime = 200;
          const longTime = 400;

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
              "line-color": lines[lineKey].color,
              "line-width": 8,
              "line-opacity-transition": {duration: shortTime}
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

          const straightSegments = lineString(coords);
          const curvedSegments = turfBezier(straightSegments)

          const initialOpacity = 0;
          const finalOpacity = 1;

          if (this.state.map) {
            if (this.state.map.getLayer(layerID)) {
              // Update line
              let newLayer = JSON.parse(JSON.stringify(layer));
              newLayer.id = layerID;
              newLayer.source.data = curvedSegments;
              newLayer.paint['line-opacity'] = initialOpacity;
              newLayer.paint['line-opacity-transition']['duration'] = longTime;

              this.state.map.removeLayer(layerID);
              this.state.map.removeSource(layerID);
              this.state.map.addLayer(newLayer);
              this.state.map.setPaintProperty(layerID, 'line-opacity', finalOpacity);

              setTimeout(() => {
                if (this.state.map.isStyleLoaded()) {
                  if (!this.state.map.getLayer(layerID + '-prev')) {
                    let tempLayer = JSON.parse(JSON.stringify(newLayer));
                    tempLayer.id = layerID + '-prev';
                    this.state.map.addLayer(tempLayer);
                  }
                  this.state.map.setPaintProperty(layerID + '-prev', 'line-opacity', initialOpacity);

                  setTimeout(() => {
                    let source = this.state.map.getSource(layerID + '-prev');
                    if (source) {
                      source.setData(curvedSegments);
                      if (this.state.map.getLayer(layerID + '-prev')) {
                        this.state.map.setPaintProperty(layerID + '-prev', 'line-opacity', finalOpacity);
                      }
                    }
                  }, shortTime);
                }
              }, shortTime);

            } else {
              this.initialLinePaint(layer, layerID, curvedSegments, finalOpacity, longTime);
            }
          }

          this.state.map.on('mousemove', layerID, () => {
            if (this.state.map.getPaintProperty(layerID, 'line-width') !== 12) {
              this.state.map.setPaintProperty(layerID, 'line-width', 12);
              this.state.map.moveLayer(layerID);
            }
          });

          this.state.map.on('mouseleave', layerID, () => {
            this.state.map.setPaintProperty(layerID, 'line-width', 8);
          });
        }
      }
    }

    return (
      <div className="Map" ref={el => this.mapContainer = el}></div>
    );
  }
}
