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
      this.props.onMapClick({lng: lng, lat: lat, onLines: [], id: this.props.meta.nextStationId});
    });

    this.setState({
      map: map
    });
  }

  render() {
    const stations = this.props.system.stations;
    const lines = this.props.system.lines;

    let elements = document.getElementsByClassName('Map-station');
    while (elements.length > 0) {
      elements[0].parentNode.removeChild(elements[0]);
    }

    for (const id in stations) {
      const { lng, lat } = stations[id];

      let color = '#888';
      for (const lineKey in lines) {
        if (lines[lineKey].stationIds.includes(id)) {
          color = '#fff';
        }
      }

      const svgCircle = `<svg height="16" width="16"><circle cx="8" cy="8" r="6" stroke="#000" stroke-width="2" fill="${color}" /></svg>`;

      let el = document.createElement('button');
      el.id = 'js-Map-station--' + id;
      el.className = 'Map-station';
      el.innerHTML = svgCircle;
      el.addEventListener('click', (e) => {
        this.props.onStopClick(id);
        e.stopPropagation();
      });

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

      if (lines[lineKey].stationIds.length > 1) {
        const coords = lines[lineKey].stationIds.map(id => [stations[id].lng, stations[id].lat]);
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
