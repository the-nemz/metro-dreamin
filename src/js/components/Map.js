import React from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export class Map extends React.Component {

  constructor(props) {
    super(props);
    this.state = {markers: []};
  }

  componentDidMount() {
    const { zoom } = this.props;

    const map = new mapboxgl.Map({
      container: this.mapContainer,
      style: 'mapbox://styles/mapbox/dark-v10',
      zoom: zoom
    });

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      this.props.onMapClick({lng: lng, lat: lat, onLines: []});
    });

    this.setState({
      map: map
    });
  }

  render() {
    const stations = this.props.system.stations.slice(0, this.props.system.stations.length);
    const lines = this.props.system.lines;

    let elements = document.getElementsByClassName('Map-station');
    while (elements.length > 0) {
      elements[0].parentNode.removeChild(elements[0]);
    }

    for (const station of stations) {
      const { lng, lat } = station;

      let color = '#888';
      for (const lineKey in lines) {
        for (const stop of lines[lineKey].stops) {
          if (stop.lng === lng && stop.lat === lat) {
            color = '#fff';
            break;
          }
        }
      }

      const svgCircle = `<svg height="16" width="16"><circle cx="8" cy="8" r="6" stroke="#000" stroke-width="2" fill="${color}" /></svg>`;

      let el = document.createElement('button');
      el.className = 'Map-station';
      el.innerHTML = svgCircle;

      new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(this.state.map);
    }

    for (const lineKey in lines) {
      const layerID = 'js-Map-line--' + lineKey;

      if (this.state.map) {
        if (this.state.map.getLayer(layerID)) {
          this.state.map.removeLayer(layerID);
        }

        if (this.state.map.getSource(layerID)){
          this.state.map.removeSource(layerID);
        }
      }

      if (lines[lineKey].stops.length > 1) {
        const coords = lines[lineKey].stops.map(s => [s.lng, s.lat]);
        let layer = {
          "id": layerID,
          "type": "line",
          "source": {
            "type": "geojson",
            "data": {
              "type": "Feature",
              "properties": {},
              "geometry": {
                "type": "LineString",
                "coordinates": coords
              }
            },
          },
          "layout": {
              "line-join": "round",
              "line-cap": "round"
          },
          "paint": {
              "line-color": lines[lineKey].color,
              "line-width": 8
          }
        };

        this.state.map.addLayer(layer);
      }
    }

    return (
      <div className="Map" ref={el => this.mapContainer = el}></div>
    );
  }
}
