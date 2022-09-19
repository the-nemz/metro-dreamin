import React from 'react';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import { lineString as turfLineString } from '@turf/helpers';
import turfLength from '@turf/length';

import { checkForTransfer } from '../util.js';

export class Line extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      showColorPicker: false,
      nameChanging: false,
      lineId: null,
      collapsed: false
    };

    this.defaultLines = [
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
      },
      {
        'name': 'Black Line',
        'color': '#191919'
      }
    ];
  }

  handleExCol() {
    this.setState({
      collapsed: this.state.collapsed ? false : true
    });

    ReactGA.event({
      category: 'Line',
      action: 'Expand/Collapse'
    });
  }

  handleNameChange(value) {
    this.setState({
      name: value,
      nameChanging: true
    });
  }

  handleNameBlur(value) {
    let line = this.props.line;
    if (line.name !== value) {
      line.name = value.trim();
      this.props.onLineInfoChange(line);
    }
    this.setState({
      name: '',
      nameChanging: false
    });
  }

  handleColorCancel() {
    this.setState({
      showColorPicker: false
    });

    ReactGA.event({
      category: 'Line',
      action: 'Cancel Color Picker'
    });
  }

  handleColorChange() {
    if (this.props.viewOnly) {
      return;
    }
    this.setState({
      showColorPicker: true
    });

    ReactGA.event({
      category: 'Line',
      action: 'Show Color Picker'
    });
  }

  handleColorSelect(chosen) {
    let line = this.props.line;
    const defNames = this.defaultLines.map(d => d.name);
    if (!defNames.includes(line.name)) {
      line.color = chosen.color;
    } else {
      line.color = chosen.color;
      line.name = chosen.name;
    }
    this.props.onLineInfoChange(line, true);
    this.setState({
      showColorPicker: false
    });

    ReactGA.event({
      category: 'Line',
      action: 'Select Color'
    });
  }

  renderColorOptions() {
    let options = [];
    for (const defLine of this.defaultLines) {
      options.push(
        <button className="Line-color" key={defLine.color} data-tip={defLine.name}
                style={{backgroundColor: defLine.color}}
                onClick={() => this.handleColorSelect(defLine)}>
        </button>
      );
    }
    return options;
  }

  renderTransfers(stationId) {
    const system = this.props.system;
    const line = this.props.line;

    let transfers = [];
    for (const lineKey in (system.lines || {})) {
      if (lineKey !== line.id && checkForTransfer(stationId, line, system.lines[lineKey])) {
        transfers.push(
          <div className="Line-transfer" key={lineKey}>
            <div className="Line-transferPrev" style={{backgroundColor: system.lines[lineKey].color}}></div>
          </div>
        );
      }
    }

    if (!transfers.length) {
      return;
    } else {
      return (
        <div className="Line-transfers">
          {transfers}
        </div>
      );
    }
  }

  renderStations() {
    const line = this.props.line;
    let stationElems = [];
    let intermediateWaypointIds = [];
    for (const [i, stationId] of line.stationIds.entries()) {
      if (this.props.system.stations[stationId].isWaypoint) {
        intermediateWaypointIds.push(stationId);
        if (i !== line.stationIds.length - 1) { // handle case where last station is waypoint
          continue;
        }
      }

      if (intermediateWaypointIds.length) {
        const wIdsToUse = intermediateWaypointIds;
        const button = this.props.viewOnly ? '' : (
          <button className="Line-waypointsRemove" data-tip="Remove from line"
                  onClick={() => this.props.onWaypointsRemove(line, wIdsToUse)}>
            <i className="fas fa-minus-circle"></i>
          </button>
        );
        stationElems.push(
          <li className="Line-waypoints" key={stationElems.length}>
            <div className="Line-waypointsButton"
                    onClick={() => this.props.onStopClick(stationId)}>
              <div className="Line-waypointsName">
                {wIdsToUse.length} {wIdsToUse.length === 1 ? 'waypoint' : 'waypoints'}
              </div>
            </div>
            {button}
          </li>
        );
        intermediateWaypointIds = [];
      }

      if (!this.props.system.stations[stationId].isWaypoint) {
        const button = this.props.viewOnly ? '' : (
          <button className="Line-stationRemove" data-tip="Remove from line"
                  onClick={() => this.props.onStationRemove(line, stationId)}>
            <i className="fas fa-minus-circle"></i>
          </button>
        );
        stationElems.push(
          <li className="Line-station" key={stationElems.length}>
            <button className="Line-stationButton Link"
                    onClick={() => this.props.onStopClick(stationId)}>
              <div className="Line-stationName">
                {this.props.system.stations[stationId].name}
              </div>
              {this.renderTransfers(stationId)}
            </button>
            {button}
          </li>
        );
      }
    }
    if (!stationElems.length) {
      return <div className="Line-noStations">No stations on this line yet!</div>;
    }
    return (
      <ul className="Line-stations">
        {stationElems}
      </ul>
    );
  }

  renderTravelTime() {
    let travelText = `n/a`;

    if (this.props.line.stationIds.length > 1) {
      // travel time assumes speeds of 60 km/min on map (60 kph irl)
      const coords = this.props.line.stationIds.map(sId => [this.props.system.stations[sId].lng, this.props.system.stations[sId].lat]);
      const routeDistance = turfLength(turfLineString(coords)); // length of line in km
      const fullStationCount = this.props.line.stationIds.reduce((count, sId) => count + (this.props.system.stations[sId].isWaypoint ? 0 : 1), 0);
      const travelValue = Math.round(routeDistance + (fullStationCount / 2.0)); // add half a second stationary time per stop

      // text will show 1 sec => 1 min, 1 min => 1 hr, etc
      // this matches the speed vehicles visually travel along the line
      travelText = `${travelValue} min`;
      if (travelValue > 60 * 24) {
        const dayVal = Math.floor(travelValue / (60 * 24));
        const hrVal = Math.floor((travelValue - (dayVal * 60 * 24)) / 60);
        const minVal = travelValue % 60;
        travelText = `${dayVal} day ${hrVal} hr ${minVal} min`;
      } else if (travelValue > 60) {
        const hrVal = Math.floor(travelValue / 60);
        const minVal = travelValue % 60;
        travelText = `${hrVal} hr ${minVal} min`;
      }
    }

    return (
      <div className="Line-travel">
        Travel time: <span className="Line-travelTime">{travelText}</span>
      </div>
    );
  }

  renderContent() {
    if (this.state.showColorPicker) {
      return (
        <div className="Line-colorsWrap">
          <div className="Line-colorsText">Choose a new color:</div>
          {this.renderColorOptions()}
          <button className="Line-colorsCancel Link" onClick={() => this.handleColorCancel()}>
            Cancel
          </button>
        </div>
      );
    } else {
      const duplicateWrap = (
        <div className="Line-duplicateWrap">
          <button className="Line-duplicate Link" onClick={() => this.props.onDuplicateLine(this.props.line)}>
            Fork this line
          </button>
        </div>
      );
      const deleteWrap = (
        <div className="Line-deleteWrap">
          <button className="Line-delete Link" onClick={() => this.props.onDeleteLine(this.props.line)}>
            Delete this line
          </button>
        </div>
      );
      return (
        <div className="Line-stationsWrap">
          {this.renderTravelTime()}
          {this.props.viewOnly || this.props.line.stationIds.length < 2 ? '' : duplicateWrap}
          {this.renderStations()}
          {this.props.viewOnly ? '' : deleteWrap}
        </div>
      );
    }
  }

  componentDidMount() {
    ReactTooltip.rebuild();

    if (!this.state.lineId && this.props.line && this.props.line.id) {
      this.setState({
        lineId: this.props.line.id
      });
    }
  }

  componentDidUpdate() {
    ReactTooltip.rebuild();
    if (this.state.lineId !== null) {
      if (this.props.line && this.props.line.id && this.props.line.id === this.state.lineId) {
        // do nothing
      } else if (this.props.line) {
        this.setState({
          showColorPicker: false,
          nameChanging: false,
          collapsed: true,
          lineId: this.props.line.id
        });
      }
    } else if (this.props.line) {
      this.setState({
        showColorPicker: false,
        nameChanging: false,
        collapsed: true,
        lineId: this.props.line.id
      });

    }
  }

  componentWillUnmount() {
    ReactTooltip.hide();
  }

  render() {
    const title = this.state.nameChanging ? this.state.name : this.props.line.name;
    const namePrev = this.props.viewOnly ? (
      <div className="Line-namePrev" style={{backgroundColor: this.props.line.color}}></div>
    ) : (
      <button className="Line-namePrev" style={{backgroundColor: this.props.line.color}}
              onClick={() => this.handleColorChange()}
              data-tip="Change line color"></button>
    );
    const nameElem = this.props.viewOnly ? (
      <div className="Line-name">
        {title ? title : ''}
      </div>
    ) : (
      <input className="Line-name Line-name--input" type="text" value={title ? title : ''}
             onChange={(e) => this.handleNameChange(e.target.value)}
             onBlur={(e) => this.handleNameBlur(e.target.value)}>
      </input>
    );

    const topClass = 'Line FocusAnim ' + (this.props.viewOnly ? 'Focus Focus--viewOnly': 'Focus');
    return (
      <div className={topClass}>
        <button className="Line-close" data-tip="Close line view"
                onClick={() => this.props.onFocusClose()}>
          <i className="fas fa-times-circle"></i>
        </button>

        <div className="Line-title">
          {namePrev}
          {nameElem}
        </div>

        <button className={`Line-exCol Line-exCol--${this.state.collapsed ? 'collapsed' : 'expanded'}`}
                onClick={() => this.handleExCol()}>
          <span className="Line-exColText">
            {this.state.collapsed ? 'Show Details' : 'Hide Details'}
          </span>
          <i className="fas fa-chevron-down"></i>
        </button>

        <div className={`Line-content Focus-content Focus-content--${this.state.collapsed ? 'collapsed' : 'expanded'}`}>
          {this.renderContent()}
        </div>
      </div>
    );
  }
}
