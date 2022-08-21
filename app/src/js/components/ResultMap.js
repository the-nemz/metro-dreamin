import React from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v10';
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v10';
const SHORT_TIME = 200;
const LONG_TIME = 400;

export class ResultMap extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      useLight: false
    };
  }

  componentDidMount() {
    const map = new mapboxgl.Map({
      container: this.mapContainer,
      style: this.props.useLight ? LIGHT_STYLE : DARK_STYLE,
      zoom: 2,
      center: this.props.centroid
    });

    // disable map interactions
    map.boxZoom.disable();
    map.scrollZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();

    this.setState({
      map: map
    });

    this.props.onMapInit(map);
  }

  componentDidUpdate() {
    if (this.props.useLight && !this.state.useLight) {
      this.state.map.setStyle(LIGHT_STYLE);
      this.state.map.once('styledata', () => {
        this.setState({
          useLight: true
        });
      });
    } else if (!this.props.useLight && this.state.useLight) {
      this.state.map.setStyle(DARK_STYLE);
      this.state.map.once('styledata', () => {
        this.setState({
          useLight: false
        });
      });
    }
  }

  componentWillUnmount() {
    this.state.map.remove();
  }

  initialLinePaint(layer, layerID, data, finalOpacity) {
    if (this.props.useLight === this.state.useLight) {
      // Initial paint of line
      if (!this.state.map.getLayer(layerID)) {
        let newLayer = JSON.parse(JSON.stringify(layer));
        newLayer.id = layerID;
        newLayer.source.data = data;
        newLayer.paint['line-opacity'] = finalOpacity;
        newLayer.paint['line-opacity-transition']['duration'] = LONG_TIME;
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
  }

  render() {
    const stations = this.props.system.stations;
    const lines = this.props.system.lines;
    const interlineSegments = this.props.interlineSegments;

    let bounds = new mapboxgl.LngLatBounds();
    for (const sId in stations) {
      bounds.extend(new mapboxgl.LngLat(stations[sId].lng, stations[sId].lat));
    }
    if (!bounds.isEmpty()) {
      this.state.map.fitBounds(bounds, {
        center: bounds.getCenter(),
        padding: 16
      });
    }

    for (const lineKey of Object.keys(lines || {})) {
      const layerID = 'js-Map-line--' + lineKey;

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
            "line-width": 4,
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

        const finalOpacity = 1;
        if (this.state.map) {
          this.initialLinePaint(layer, layerID, data, finalOpacity);
        }
      }
    }

    for (const segmentKey of Object.keys(interlineSegments || {})) {
      const segment = interlineSegments[segmentKey];
      for (const color of segment.colors) {
        const layerID = 'js-Map-segment--' + segmentKey + '|' + color;

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
            "line-color": color,
            "line-width": 4,
            "line-translate": segment.offsets[color],
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

        const finalOpacity = 1;
        if (this.state.map) {
          this.initialLinePaint(layer, layerID, data, finalOpacity);
        }
      }
    }

    return (
      <div className="Map Map--searchResult" ref={el => this.mapContainer = el}></div>
    );
  }
}
