import React from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl';

import { Map } from './js/components/Map.js';

import './default.scss';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

class Main extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      history: [
        {
          stations: [],
          lines: []
        }
      ],
      settings: {
        zoom: 2
      }
    };
  }

  handleUndo() {
    const history = JSON.parse(JSON.stringify(this.state.history));
    this.setState({
      history: history.slice(0, history.length - 1)
    });

  }

  handleMapClick(station) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = JSON.parse(JSON.stringify(history[history.length - 1]));
    system.stations = system.stations.concat([station]);
    this.setState({
      history: history.concat([system])
    });
  }

  render() {
    const system = this.state.history[this.state.history.length - 1];
    const { zoom } = this.state.settings;

    return (
      <div className="Main">
        <div className="Main-upper">
          <div className="Main-text">{`Number of Stations: ${system.stations.length}`}</div>
          <button className="Main-undo" onClick={() => this.handleUndo()}>
            <i className="fas fa-undo"></i>
          </button>
        </div>

        <Map system={system} zoom={zoom} onMapClick={(station) => this.handleMapClick(station)} />
      </div>
    );
  }
}

ReactDOM.render(<Main />, document.getElementById('root'));
