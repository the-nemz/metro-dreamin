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
      this.props.onMapClick({lng: lng, lat: lat});
    });

    this.setState({
      map: map
    });
  }

  render() {
    const stations = this.props.system.stations.slice(0, this.props.system.stations.length);

    const lineId = 'js-Map-line';
    if (this.state.map) {
      if (this.state.map.getLayer(lineId)) {
        this.state.map.removeLayer(lineId);
      }

      if (this.state.map.getSource(lineId)){
        this.state.map.removeSource(lineId);
      }
    }

    let elements = document.getElementsByClassName('Map-station');
    while (elements.length > 0) {
      elements[0].parentNode.removeChild(elements[0]);
    }

    for (const station of stations) {
      const { lng, lat } = station;

      const svgCircle = '<svg height="16" width="16"><circle cx="8" cy="8" r="6" stroke="#000" stroke-width="2" fill="#fff" /></svg>';

      let el = document.createElement('button');
      el.className = 'Map-station';
      el.innerHTML = svgCircle;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(this.state.map);
    }

    if (stations.length > 1) {
      const coords = stations.map(s => [s.lng, s.lat]);
      let layer = {
        "id": lineId,
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
            "line-color": "#ff0000",
            "line-width": 8
        }
      };

      this.state.map.addLayer(layer);
    }

    return (
      <div className="Map" ref={el => this.mapContainer = el}></div>
    );
  }
}
