import React from 'react';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';
import Dropdown from 'react-dropdown';
import { lineString as turfLineString } from '@turf/helpers';
import turfLength from '@turf/length';

import { checkForTransfer, getMode, partitionSections, stationIdsToCoordinates } from '/lib/util.js';
import { DEFAULT_LINES, LINE_MODES } from '/lib/constants.js';

export class Line extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      showColorPicker: false,
      nameChanging: false,
      lineId: null    };
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
    const defNames = DEFAULT_LINES.map(d => d.name);
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

  handleModeChange(option) {
    let line = this.props.line;
    if (line.mode !== option.value) {
      line.mode = option.value;
      this.props.onLineInfoChange(line, true);

      ReactGA.event({
        category: 'Action',
        action: 'Change Line Mode',
        label: option.value
      });
    }
  }

  renderColorOptions() {
    let options = [];
    for (const defLine of DEFAULT_LINES) {
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
      if (lineKey !== line.id && checkForTransfer(stationId, line, system.lines[lineKey], system.stations)) {
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
      // group together all consecutive waypoints to be able to display like: * 4 waypoints (-)
      if (this.props.system.stations[stationId].isWaypoint || (line.waypointOverrides || []).includes(stationId)) {
        intermediateWaypointIds.push(stationId);
        if (i !== line.stationIds.length - 1) { // handle case where last station is waypoint
          continue;
        }
      }

      if (!this.props.viewOnly && intermediateWaypointIds.length) { // do not show waypoints in viewonly mode
        // display grouped waypoints and reset intermediateWaypointIds
        const wIdsToUse = intermediateWaypointIds;
        const button = this.props.viewOnly ? '' : (
          <button className="Line-waypointsRemove" data-tip="Remove from line"
                  onClick={() => this.props.onWaypointsRemove(line, wIdsToUse)}>
            <i className="fas fa-minus-circle"></i>
          </button>
        );
        stationElems.push(
          <li className="Line-waypoints" key={stationElems.length}>
            <div className="Line-waypointsButton">
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
    // vehicle travels 60x actual speed, so 60 km/min instead of 60 kph irl
    const mode = getMode(this.props.line.mode);
    let travelText = `n/a`;

    if (this.props.line.stationIds.length > 1) {
      const fullStationCount = this.props.line.stationIds.reduce((count, sId) => count + (this.props.system.stations[sId].isWaypoint ? 0 : 1), 0);
      let totalTime = 0;
      totalTime += fullStationCount * mode.pause / 1000; // amount of time spent at stations; mode.pause is a number of millisecs

      const sections = partitionSections(this.props.line, this.props.system.stations);
      for (const section of sections) {
        const sectionCoords = stationIdsToCoordinates(this.props.system.stations, section);
        const routeDistance = turfLength(turfLineString(sectionCoords));
        const accelDistance = mode.speed / mode.acceleration;
        if (routeDistance < accelDistance * 2) { // route is shorter than distance accelerating to top speed + distance delelerating from top speed
          const topSpeedRatio = (accelDistance * 2) / routeDistance; // what percentage of the top speed it gets to in this section
          const time = routeDistance / (mode.speed * topSpeedRatio);
          totalTime += time;
        } else { // route is long enough to get to top speed and slow down in time
          const accelTime = accelDistance / (mode.speed / 2);
          const topSpeedTime = (routeDistance - (2 * accelDistance)) / mode.speed;
          const time = accelTime + topSpeedTime;
          totalTime += time;
        }
      }
      const travelValue = Math.round(totalTime);

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

  renderDropdown() {
    const modes = LINE_MODES.map(m => {
      return {
        label: m.label,
        value: m.key
      };
    });

    return (
      <div className="Line-modeSelect">
        <Dropdown disabled={this.props.viewOnly} options={modes} onChange={(mode) => this.handleModeChange(mode)} value={getMode(this.props.line.mode).key} placeholder="Select a mode" />
        <i className="far fa-question-circle"
           data-tip="Line mode dictates travel time, station wait time, vehicle speed, etc">
        </i>
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
      const reverseWrap = (
        <div className="Line-reverseWrap">
          <button className="Line-reverse Link" onClick={() => this.props.onReverseStationOrder(this.props.line)}>
            Reverse station order
          </button>
        </div>
      );
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
          {this.renderDropdown()}
          {this.props.viewOnly || this.props.line.stationIds.length < 2 ? '' : reverseWrap}
          {this.props.viewOnly || this.props.line.stationIds.length < 2 ? '' : duplicateWrap}
          {this.props.viewOnly ? '' : deleteWrap}
          {this.renderStations()}
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
          lineId: this.props.line.id
        });
      }
    } else if (this.props.line) {
      this.setState({
        showColorPicker: false,
        nameChanging: false,
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

        <div className="Line-content Focus-content">
          {this.renderContent()}
        </div>
      </div>
    );
  }
}
