import React from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl';

import './default.scss';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

class Application extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      stations: [],
      zoom: 2
    };
  }

  componentDidMount() {
    const { zoom } = this.state;

    const map = new mapboxgl.Map({
      container: this.mapContainer,
      style: 'mapbox://styles/mapbox/dark-v10',
      zoom: zoom
    });

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;

      const stations = this.state.stations.slice(0, this.state.stations.length + 1);

      this.setState({
        stations: stations.concat([[lng, lat]])
      });
      // console.log(this.state.stations);

      const svgCircle = '<svg height="16" width="16"><circle cx="8" cy="8" r="6" stroke="#000" stroke-width="2" fill="#fff" /></svg>';

      let el = document.createElement('button');
      el.className = 'Map-station';
      el.innerHTML = svgCircle;

      new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(map);

      if (this.state.stations.length > 1) {
        let newlayer = {
          "id": "Map-line" + this.state.stations.length,
          "type": "line",
          "source": {
            "type": "geojson",
            "data": {
              "type": "Feature",
              "properties": {},
              "geometry": {
                "type": "LineString",
                "coordinates": this.state.stations
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

        map.addLayer(newlayer);

        if (this.state.stations.length > 2) {
          map.removeLayer(`Map-line${this.state.stations.length - 1}`);
        }
      }
    });
  }

  render() {
    const { lng, lat } = this.state;

    return (
      <div className="Map">
        <div className="Map-textWrap">
          <div className="Map-text">{`Number of Stations: ${this.state.stations.length}`}</div>
        </div>
        <div className="Map-mapWrap" ref={el => this.mapContainer = el}/>
      </div>
    );
  }
}

ReactDOM.render(<Application />, document.getElementById('root'));
