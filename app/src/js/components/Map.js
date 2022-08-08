import React from 'react';
import mapboxgl from 'mapbox-gl';

import { checkForTransfer } from '../util.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v10';
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v10';
const SHORT_TIME = 200;
const LONG_TIME = 400;
const INITIAL_OPACITY = 0;
const FINAL_OPACITY = 1;

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

  buildInterlines() {
    let interlineSegments = {};
    for (const lineId in this.props.system.lines) { // TODO: switch to lineKey
      const line = this.props.system.lines[lineId];
      for (let i = 0; i < line.stationIds.length - 1; i++) {
        const currStationId = line.stationIds[i];
        const nextStationId = line.stationIds[i + 1];
        for (const lineIdBeingChecked in this.props.system.lines) {
          const lineBeingChecked = this.props.system.lines[lineIdBeingChecked];
          if (lineId !== lineIdBeingChecked) { // TODO: move color check to here instead of id?
            const indexOfCurrStation = lineBeingChecked.stationIds.indexOf(currStationId);
            const indexOfNextStation = lineBeingChecked.stationIds.indexOf(nextStationId); // TODO: could be optimized
            if (indexOfCurrStation >= 0 && indexOfNextStation > 0 && Math.abs(indexOfCurrStation - indexOfNextStation) === 1) { // if stations are next to each other
              if (line.color !== lineBeingChecked.color) {
                const orderedPair = [currStationId, nextStationId].sort();
                console.log('add between', orderedPair)
                const segmentKey = orderedPair.join('|');
                let lineIdsInSegment = [ lineId ];
                if (segmentKey in interlineSegments) {
                  lineIdsInSegment = interlineSegments[segmentKey].lineIds;
                }
                lineIdsInSegment.push(lineIdBeingChecked);
                lineIdsInSegment = [...new Set(lineIdsInSegment)]

                const slope = (this.props.system.stations[currStationId].lat - this.props.system.stations[nextStationId].lat) / (this.props.system.stations[currStationId].lng - this.props.system.stations[nextStationId].lng);
                interlineSegments[segmentKey] = {
                  stationIds: orderedPair,
                  lineIds: lineIdsInSegment,
                  slope: slope,
                  offests: this.calculateOffsets(lineIdsInSegment.sort(), slope)
                };
              }
            }
          }
        }
      }
    }
    console.log(interlineSegments);

    // this.setState({
    //   interlineSegments: interlineSegments
    // });

    return interlineSegments;
  }

  calculateOffsets(lineIds, slope) {
    let offsets = {};
    const centered = lineIds.length % 2 === 1; // center if odd number of lines
    let moveNegative = slope < 0;
    for (const [i, lineId] of lineIds.entries()) {
      let displacement = moveNegative ? -8 : 8;
      let offsetDistance = 0;
      // let offsetDistance = centered ? (i * displacement) : ((slope < 0 ? -4 : 4) + (i * displacement));
      if (centered) {
        offsetDistance = Math.floor((i + 1) / 2) * displacement;
      } else {
        offsetDistance = (slope < 0 ? -4 : 4) + (Math.floor((i + 1) / 2) * displacement);
        console.log('offsetDistance', offsetDistance)
      }

      const negInvSlope = -1 / slope;
      // line is y = negInvSlope * x
      // solve for x = 1
      // goes through through (0, 0) and (1, negInvSlope)
      const distanceRatio = offsetDistance / Math.sqrt(1 + (negInvSlope * negInvSlope));
      const offsetX = ((1 - distanceRatio) * 0) + (distanceRatio * 1);
      const offsetY = ((1 - distanceRatio) * 0) + (distanceRatio * negInvSlope);
      // offsets.push([offsetX, offsetY]);
      // offsets[lineId] = [offsetX, -offsetY]; // y is inverted (positive is south)
      offsets[lineId] = [offsetX * (slope < 0 ? -1 : 1), -offsetY * (slope < 0 ? -1 : 1)]; // y is inverted (positive is south)

      // TODO: i think to solve the flipping, the signs of the offsets should be negated, not the offset distance sign

      moveNegative = !moveNegative;
    }
    // console.log('offsets', offsets);
    return offsets;
  }

  initialLinePaint(layer, layerID, data, FINAL_OPACITY, LONG_TIME) {
    // Initial paint of line
    if (!this.state.map.getLayer(layerID)) {
      let newLayer = JSON.parse(JSON.stringify(layer));
      newLayer.id = layerID;
      newLayer.source.data = data;
      newLayer.paint['line-opacity'] = FINAL_OPACITY;
      newLayer.paint['line-opacity-transition']['duration'] = LONG_TIME;
      this.state.map.addLayer(newLayer);
    }

    if (!this.state.map.getLayer(layerID + '-prev')) {
      let prevLayer = JSON.parse(JSON.stringify(layer));
      prevLayer.id = layerID + '-prev';
      prevLayer.source.data = data;
      prevLayer.paint['line-opacity'] = FINAL_OPACITY;
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
          // if (id === focusedId) {
          //   el.className += ' js-Map-station--focused Map-station--focused';
          // }
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
              // "line-translate": [-5, -5],
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

          if (this.state.map) {
            if (this.state.map.getLayer(layerID)) {
              // Update line
              let newLayer = JSON.parse(JSON.stringify(layer));
              newLayer.id = layerID;
              newLayer.source.data = data;
              newLayer.paint['line-opacity'] = INITIAL_OPACITY;
              newLayer.paint['line-opacity-transition']['duration'] = LONG_TIME;

              this.state.map.removeLayer(layerID);
              this.state.map.removeSource(layerID);
              this.state.map.addLayer(newLayer);
              this.state.map.setPaintProperty(layerID, 'line-opacity', FINAL_OPACITY);

              setTimeout(() => {
                if (this.state.map.isStyleLoaded()) {
                  if (!this.state.map.getLayer(layerID + '-prev')) {
                    let tempLayer = JSON.parse(JSON.stringify(newLayer));
                    tempLayer.id = layerID + '-prev';
                    this.state.map.addLayer(tempLayer);
                  }
                  this.state.map.setPaintProperty(layerID + '-prev', 'line-opacity', INITIAL_OPACITY);

                  setTimeout(() => {
                    let source = this.state.map.getSource(layerID + '-prev');
                    if (source) {
                      source.setData(data);
                      if (this.state.map.getLayer(layerID + '-prev')) {
                        this.state.map.setPaintProperty(layerID + '-prev', 'line-opacity', FINAL_OPACITY);
                      }
                    }
                  }, SHORT_TIME);
                }
              }, SHORT_TIME);

            } else {
              this.initialLinePaint(layer, layerID, data, FINAL_OPACITY, LONG_TIME);
            }
          }

          // this.state.map.on('mousemove', layerID, () => {
          //   if (this.state.map.getPaintProperty(layerID, 'line-width') !== 12) {
          //     this.state.map.setPaintProperty(layerID, 'line-width', 12);
          //     this.state.map.moveLayer(layerID);
          //   }
          // });

          // this.state.map.on('mouseleave', layerID, () => {
          //   this.state.map.setPaintProperty(layerID, 'line-width', 8);
          // });
        }
      }
    }

    const interlineSegments = this.buildInterlines();
    console.log(Object.keys(interlineSegments).length);
    for (const segmentKey in interlineSegments) {
      const segment = interlineSegments[segmentKey];
      for (const lineId of segment.lineIds) {
        if (segmentKey == '16|8') {
          console.log(lines[lineId].name)
          // console.log(lines[lineId].name)
          console.log(segment.offests[lineId])
        }

        const layerID = 'js-Map-segment--' + segmentKey + '|' + lineId;

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
            "line-color": lines[lineId].color,
            "line-width": 8,
            "line-translate": segment.offests[lineId],
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

        if (this.state.map) {
          if (this.state.map.getLayer(layerID)) {
            // Update line
            let newLayer = JSON.parse(JSON.stringify(layer));
            newLayer.id = layerID;
            newLayer.source.data = data;
            newLayer.paint['line-opacity'] = INITIAL_OPACITY;
            newLayer.paint['line-opacity-transition']['duration'] = LONG_TIME;

            this.state.map.removeLayer(layerID);
            this.state.map.removeSource(layerID);
            this.state.map.addLayer(newLayer);
            this.state.map.setPaintProperty(layerID, 'line-opacity', FINAL_OPACITY);

            if (segmentKey == '16|8') {
              console.log('made it here');
            }

            setTimeout(() => {
              if (this.state.map.isStyleLoaded()) {
                if (!this.state.map.getLayer(layerID + '-prev')) {
                  let tempLayer = JSON.parse(JSON.stringify(newLayer));
                  tempLayer.id = layerID + '-prev';
                  this.state.map.addLayer(tempLayer);
                }
                this.state.map.setPaintProperty(layerID + '-prev', 'line-opacity', INITIAL_OPACITY);

                setTimeout(() => {
                  let source = this.state.map.getSource(layerID + '-prev');
                  if (source) {
                    source.setData(data);
                    if (this.state.map.getLayer(layerID + '-prev')) {
                      this.state.map.setPaintProperty(layerID + '-prev', 'line-opacity', FINAL_OPACITY);
                    }
                  }
                }, SHORT_TIME);
              }
            }, SHORT_TIME);

          } else {
            this.initialLinePaint(layer, layerID, data, FINAL_OPACITY, LONG_TIME);
          }
        }
      }
    }

    return (
      <div className="Map" ref={el => this.mapContainer = el}></div>
    );
  }
}
