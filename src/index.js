import React from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl';

import { Map } from './js/components/Map.js';
import { Station } from './js/components/Station.js';

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
          lines: {
            red: {
              name: 'Red Line',
              color: '#ff0000',
              stops: []
            }
          }
        }
      ],
      meta: {
        nextStationId: 0,
        nextLineId: 0
      },
      settings: {
        zoom: 2
      },
      focus: {}
    };
  }

  handleUndo() {
    const history = JSON.parse(JSON.stringify(this.state.history));
    this.setState({
      history: history.slice(0, history.length - 1),
      focus: {}
    });
  }

  handleSave() {
    const data = {
      settings: this.state.settings,
      history: [this.getSystem()]
    }
    alert(`Save this JSON: ${JSON.stringify(data)}`);
  }

  handleMapClick(station) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem(history);
    system.stations = system.stations.concat([station]);
    this.setState({
      history: history.concat([system]),
      focus: {
        station: JSON.parse(JSON.stringify(station))
      }
    });
  }

  handleAddStationToLine(lineKey, station) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem(history);
    system.lines[lineKey].stops = system.lines[lineKey].stops.concat([station]);
    this.setState({
      history: history.concat([system]),
      focus: {
        line: JSON.parse(JSON.stringify(system.lines[lineKey]))
      }
    });
  }

  handleAddLine() {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem(history);

    let lineKey;
    let name;
    let color;
    const lineKeys = Object.keys(system.lines);
    if (!lineKeys.includes('red')) {
      lineKey = 'red';
      name = 'Red Line';
      color = '#ff0000';
    } else if (!lineKeys.includes('blue')) {
      lineKey = 'blue';
      name = 'Blue Line';
      color = '#0000ff';
    } else if (!lineKeys.includes('green')) {
      lineKey = 'green';
      name = 'Green Line';
      color = '#00ff00';
    } else {
      // TODO
      alert('Only three lines currently supported');
      return;
    }

    system.lines[lineKey] = {
      name: name,
      color: color,
      stops: []
    };
    this.setState({
      history: history.concat([system]),
      focus: {
        line: JSON.parse(JSON.stringify(system.lines[lineKey]))
      }
    });
  }

  getSystem(history) {
    const historyCopy = history ? history : this.state.history;
    return JSON.parse(JSON.stringify(historyCopy[historyCopy.length - 1]));
  }

  renderFocus() {
    if (this.state.focus) {
      const type = Object.keys(this.state.focus)[0];
      switch (type) {
        case 'station':
          return <Station station={this.state.focus.station} lines={this.getSystem().lines} onAddToLine={(lineKey, station) => this.handleAddStationToLine(lineKey, station)} />
        default:
          return;
      }
    }
    return;
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
          <button className="Main-save" onClick={() => this.handleSave()}>
            <i className="far fa-save"></i>
          </button>
          <div className="Main-newLineWrap">
            <button onClick={() => this.handleAddLine()}>Add a new line</button>
          </div>
        </div>

        {this.renderFocus()}

        <Map system={system} zoom={zoom} onMapClick={(station) => this.handleMapClick(station)} />
      </div>
    );
  }
}

ReactDOM.render(<Main />, document.getElementById('root'));
