import React from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl';

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
              id: '0',
              name: 'Red Line',
              color: '#e6194b',
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
    let meta = JSON.parse(JSON.stringify(this.state.meta));

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

  handleAddStationToLine(lineKey, station, position) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem(history);
    let line = system.lines[lineKey];

    if (position === 0) {
      line.stationIds = [station.id].concat(line.stationIds);
    } else if (position < line.stationIds.length) {
      line.stationIds.splice(position, 0, station.id);
    } else {
      line.stationIds = line.stationIds.concat([station.id]);
    }

    system.lines[lineKey] = line;
    this.setState({
      history: history.concat([system]),
      focus: {
        line: JSON.parse(JSON.stringify(line))
      }
    });
  }

  handleStopClick(id) {
    const focus = {
      station: this.getSystem().stations[id]
    }
    this.setState({
      focus: focus
    });
  }

  handleLineClick(id) {
    const focus = {
      line: this.getSystem().lines[id]
    }
    this.setState({
      focus: focus
    });
  }

  handleAddLine() {
    const defaultLines = [
      {
        'name': 'Red Line',
        'color': '#e6194b'
      },
      {
        'name': 'Green Line',
        'color': '#3cb44b'
      },
      {
        'name': 'Yellow Line',
        'color': '#ffe119'
      },
      {
        'name': 'Blue Line',
        'color': '#4363d8'
      },
      {
        'name': 'Orange Line',
        'color': '#f58231'
      },
      {
        'name': 'Purple Line',
        'color': '#911eb4'
      },
      {
        'name': 'Cyan Line',
        'color': '#42d4f4'
      },
      {
        'name': 'Magenta Line',
        'color': '#f032e6'
      },
      {
        'name': 'Lime Line',
        'color': '#bfef45'
      },
      {
        'name': 'Pink Line',
        'color': '#fabebe'
      },
      {
        'name': 'Teal Line',
        'color': '#469990'
      },
      {
        'name': 'Lavender Line',
        'color': '#e6beff'
      },
      {
        'name': 'Brown Line',
        'color': '#9A6324'
      },
      {
        'name': 'Beige Line',
        'color': '#fffac8'
      },
      {
        'name': 'Maroon Line',
        'color': '#800000'
      },
      {
        'name': 'Mint Line',
        'color': '#aaffc3'
      },
      {
        'name': 'Olive Line',
        'color': '#808000'
      },
      {
        'name': 'Apricot Line',
        'color': '#ffd8b1'
      },
      {
        'name': 'Navy Line',
        'color': '#000075'
      },
      {
        'name': 'Grey Line',
        'color': '#a9a9a9'
      }
    ]

    const history = JSON.parse(JSON.stringify(this.state.history));
    let meta = JSON.parse(JSON.stringify(this.state.meta));
    let system = this.getSystem();
    const lineKeys = Object.keys(system.lines);

    let currColors = [];
    for (const key of lineKeys) {
      currColors.push(system.lines[key].color);
    }

    let index = 0;
    if (lineKeys.length >= 20) {
      index = Math.floor(Math.random() * 20);
    }
    let nextLine = JSON.parse(JSON.stringify(defaultLines[index]));
    for (const defLine of defaultLines) {
      if (!currColors.includes(defLine.color)) {
        nextLine = JSON.parse(JSON.stringify(defLine));
        break;
      }
    }

    const lineKey = meta.nextLineId;
    nextLine.stationIds = [];
    nextLine.id = lineKey;
    system.lines[lineKey] = nextLine;

    meta.nextLineId = parseInt(lineKey) + 1 + '';

    this.setState({
      history: history.concat([system]),
      meta: meta,
      focus: {
        line: JSON.parse(JSON.stringify(system.lines[lineKey]))
      }
    });
  }

  handleLineNameChange(line) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem();
    system.lines[line.id] = line;

    this.setState({
      history: history.concat([system]),
      focus: {
        line: JSON.parse(JSON.stringify(line))
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
          return <Station station={this.state.focus.station} lines={this.getSystem().lines} stations={this.getSystem().stations}
                          onAddToLine={(lineKey, station, position) => this.handleAddStationToLine(lineKey, station, position)}
                          onDeleteStation={(station) => this.handleStationDelete(station)} />
        case 'line':
          return <Line line={this.state.focus.line} system={this.getSystem()}
                       onLineNameChange={(line) => this.handleLineNameChange(line)} />
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

        <Map system={system} meta={meta} zoom={zoom}
             onStopClick={(id) => this.handleStopClick(id)}
             onLineClick={(id) => this.handleLineClick(id)}
             onMapClick={(station) => this.handleMapClick(station)}
             onSearch={() => this.handleSearch()} />
      </div>
    );
  }
}

ReactDOM.render(<Main />, document.getElementById('root'));
