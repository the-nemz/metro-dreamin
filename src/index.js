import React from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl';
// import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

import { Line } from './js/components/Line.js';
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
          stations: {},
          lines: {
            '0': {
              name: 'Red Line',
              color: '#ff0000',
              stationIds: []
            }
          }
        }
      ],
      meta: {
        nextStationId: '0',
        nextLineId: '1'
      },
      settings: {
        zoom: 2
      },
      initial: true,
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
      history: [this.getSystem()],
      meta: this.state.meta
    }
    alert(`Save this JSON: ${JSON.stringify(data)}`);
  }

  async getStationName(station) {
    let str = `https://api.mapbox.com/geocoding/v5/mapbox.places/${station.lng},${station.lat}.json?access_token=${mapboxgl.accessToken}`;
    let req = new XMLHttpRequest();
    req.addEventListener('load', () => {
      let history = JSON.parse(JSON.stringify(this.state.history));
      const system = this.getSystem();
      const resp = JSON.parse(req.response);
      for (const feature of resp.features) {
        if (feature.text) {
          station.name = feature.text;
          break;
        }
      }
      system.stations[station.id] = station;
      history[history.length - 1] = system;
      this.setState({
        history: history,
        focus: {
          station: JSON.parse(JSON.stringify(station))
        }
      });
    });
    req.open('GET', str);
    req.send();
  }

  async handleMapClick(station) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    const meta = JSON.parse(JSON.stringify(this.state.meta));

    await this.getStationName(station);

    let system = this.getSystem();
    system.stations[station['id']] = station;
    meta.nextStationId = parseInt(this.state.meta.nextStationId) + 1 + '';
    this.setState({
      history: history.concat([system]),
      meta: meta,
      focus: {
        station: JSON.parse(JSON.stringify(station))
      }
    });
  }

  handleStationDelete(station) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem();
    delete system.stations[station['id']];
    for (const lineKey in system.lines) {
      let line = JSON.parse(JSON.stringify(system.lines[lineKey]));
      for (let i = line.stationIds.length - 1; i >= 0; i--) {
        if (line.stationIds[i] === station['id']) {
          line.stationIds.splice(i, 1);
        }
      }
      system.lines[lineKey] = line;
    }
    this.setState({
      history: history.concat([system]),
      focus: {}
    });
  }

  handleAddStationToLine(lineKey, station) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem(history);
    system.lines[lineKey].stationIds = system.lines[lineKey].stationIds.concat([station.id]);
    this.setState({
      history: history.concat([system]),
      focus: {
        line: JSON.parse(JSON.stringify(system.lines[lineKey]))
      }
    });
  }

  handleStopClick(id) {
    const focus = {
      station: this.getSystem().stations[id]
    }
    this.setState({
      focus: focus
    })
  }

  handleAddLine() {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem();

    let lineKey;
    let name;
    let color;
    const lineKeys = Object.keys(system.lines);
    if (!lineKeys.includes('0')) {
      lineKey = '0';
      name = 'Red Line';
      color = '#ff0000';
    } else if (!lineKeys.includes('1')) {
      lineKey = '1';
      name = 'Blue Line';
      color = '#0000ff';
    } else if (!lineKeys.includes('2')) {
      lineKey = '2';
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
      stationIds: []
    };
    this.setState({
      history: history.concat([system]),
      focus: {
        line: JSON.parse(JSON.stringify(system.lines[lineKey]))
      }
    });
  }

  handleSearch() {
    this.setState({
      initial: false
    })
  }

  getSystem() {
    return JSON.parse(JSON.stringify(this.state.history[this.state.history.length - 1]));
  }

  renderFocus() {
    if (this.state.focus) {
      const type = Object.keys(this.state.focus)[0];
      switch (type) {
        case 'station':
          return <Station station={this.state.focus.station} lines={this.getSystem().lines}
                          onAddToLine={(lineKey, station) => this.handleAddStationToLine(lineKey, station)}
                          onDeleteStation={(station) => this.handleStationDelete(station)} />
        case 'line':
          return <Line line={this.state.focus.line} system={this.getSystem()} />
        default:
          return;
      }
    }
    return;
  }

  renderMain() {
    const system = this.getSystem();

    if (this.state.initial) {
      return;
    } else if (this.state.history.length <= 1) {
      return (
        <div className="Main-initial">
          Click on the map to add a station
        </div>
      );
    } else {
      return (
        <div className="Main-upper">
          <div className="Main-text">{`Number of Stations: ${Object.keys(system.stations).length}`}</div>
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
      );
    }
  }

  render() {
    const system = this.getSystem();
    const meta = this.state.meta;
    const { zoom } = this.state.settings;

    return (
      <div className="Main">
        {this.renderMain()}
        {this.renderFocus()}

        <Map histLength={this.state.history.length} system={system} meta={meta} zoom={zoom}
             onStopClick={(id) => this.handleStopClick(id)}
             onMapClick={(station) => this.handleMapClick(station)}
             onSearch={() => this.handleSearch()} />
      </div>
    );
  }
}

ReactDOM.render(<Main />, document.getElementById('root'));
