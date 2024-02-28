import React from 'react';
import ReactGA from 'react-ga4';
import Dropdown from 'react-dropdown';
import { lineString as turfLineString } from '@turf/helpers';
import turfLength from '@turf/length';
import { ChromePicker } from 'react-color';

import { getMode, partitionSections, stationIdsToCoordinates, hasWalkingTransfer, getLuminance } from '/util/helpers.js';
import { DEFAULT_LINES, LINE_MODES, FOCUS_ANIM_TIME } from '/util/constants.js';

import { Revenue } from '/components/Revenue.js';

const COLOR_API_URL = 'https://api.color.pizza/v1/';

export class Line extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      nameChanging: false,
      lineId: null,
      showColorPicker: false,
      showColorSlider: false,
      existingColorName: null,
      sliderColor: null,
      sliderColorName: null
    };
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
      showColorPicker: false,
      showColorSlider: false,
      sliderColor: null,
      sliderColorName: null,
      existingColorName: null
    });

    ReactGA.event({
      category: 'Edit',
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
      category: 'Edit',
      action: 'Show Color Picker'
    });

    fetch(`${COLOR_API_URL}?values=${this.props.line.color.replace('#', '')}&list=wikipedia`)
      .then(response => response.json())
      .then(colorJson => {
        if (colorJson && colorJson.paletteTitle) {
          this.setState({ existingColorName: colorJson.paletteTitle });
        } else {
          this.setState({ existingColorName: null });
        }
      })
      .catch(e => {
        console.log('getColorName error:', e);
        this.setState({ existingColorName: null });
      });
  }

  handleColorSelect(chosen) {
    let line = this.props.line;
    const defNames = DEFAULT_LINES.map(d => d.name);

    line.color = chosen.color;
    if (defNames.includes(line.name) || `${this.state.existingColorName || ''} Line` === line.name) {
      // line name not manually updated
      line.name = chosen.name;
    }

    this.props.onLineInfoChange(line, true);

    this.setState({
      showColorPicker: false,
      showColorSlider: false,
      sliderColor: null,
      sliderColorName: null,
      existingColorName: null
    });

    ReactGA.event({
      category: 'Edit',
      action: 'Select Color'
    });
  }

  handleModeChange(option) {
    let line = this.props.line;
    if (line.mode !== option.value) {
      line.mode = option.value;
      this.props.onLineInfoChange(line, true);

      ReactGA.event({
        category: 'Edit',
        action: 'Change Line Mode',
        label: option.value
      });
    }
  }

  handleGroupChange(option) {
    let line = this.props.line;
    if (line.lineGroupId !== option.value) {
      if (option.value) line.lineGroupId = option.value;
      else delete line.lineGroupId;
      this.props.onLineInfoChange(line, true);

      ReactGA.event({
        category: 'Edit',
        action: 'Change Line Group'
      });
    }
  }

  renderColorOptions() {
    let options = [];
    for (const defLine of DEFAULT_LINES) {
      options.push(
        <button className="Line-color" key={defLine.color} data-tooltip-content={defLine.name}
                style={{backgroundColor: defLine.color}}
                onClick={() => this.handleColorSelect(defLine)}>
        </button>
      );
    }
    return <div className="Line-colors">
      {options}
    </div>;
  }

  renderColorSlider() {
    if (this.state.showColorSlider) {
      return <div className="Line-colorPicker">
        <ChromePicker color={this.state.sliderColor || this.props.line.color}
                      disableAlpha
                      onChange={(color, event) => {
                        this.setState({ sliderColor: color.hex });
                      }}
                      onChangeComplete={(color, event) => {
                        fetch(`${COLOR_API_URL}?values=${color.hex.replace('#', '')}&list=wikipedia`)
                          .then(response => response.json())
                          .then(colorJson => {
                            if (colorJson && colorJson.paletteTitle) {
                              this.setState({ sliderColorName: colorJson.paletteTitle });
                            } else {
                              this.setState({ sliderColorName: null });
                            }
                          })
                          .catch(e => {
                            console.log('getColorName error:', e);
                            this.setState({ sliderColorName: null });
                          });
                      }}
        />
        <div className="Line-customColor"
             style={{backgroundColor: this.state.sliderColor || this.props.line.color}}>
        </div>
        {this.state.sliderColor &&
          <button className="Line-customColorConfirm Link"
                  onClick={() => {
                    const lineName = `${this.state.sliderColorName ? this.state.sliderColorName : 'Custom'} Line`;
                    this.handleColorSelect({ color: this.state.sliderColor, name: lineName });
                  }}>
          Confirm {this.state.sliderColorName || 'custom color'}
        </button>}
      </div>;
    } else {
      return <button className="Line-showColorSlider Link"
              onClick={() => this.setState({ showColorSlider: true })}>
        Select a custom color
      </button>
    }
  }

  renderTransfers(stationId) {
    const system = this.props.system;
    const line = this.props.line;

    let transferElems = [];
    let includedLineIds = new Set();
    for (const transfer of (this.props.transfersByStationId?.[stationId]?.hasTransfers ?? [])) {
      const matchesFirst = transfer.length === 2 && transfer[0] === line.id;
      const matchesSecond = transfer.length === 2 && transfer[1] === line.id;
      if (matchesFirst || matchesSecond) {
        const otherLineKey = matchesFirst ? transfer[1] : transfer[0];
        includedLineIds.add(otherLineKey);
        transferElems.push(
          <div className="Line-transfer" key={otherLineKey}>
            <div className="Line-transferPrev" style={{backgroundColor: system.lines[otherLineKey].color}}></div>
          </div>
        );
      }
    }

    const interchange = this.props.interchangesByStationId[stationId];
    if (interchange && interchange.hasLines && interchange.hasLines.length) {
      for (const lineKey of interchange.hasLines) {
        if (lineKey !== line.id && system.lines[lineKey] && !includedLineIds.has(lineKey)) {
          transferElems.push(
            <div className="Line-transfer" key={lineKey}>
              <div className="Line-transferWalk"
                   style={{backgroundColor: system.lines[lineKey].color}}
                   data-lightcolor={getLuminance(system.lines[lineKey].color) > 128}>
                <i className="fas fa-person-walking"></i>
              </div>
            </div>
          );
        }
      }
    }

    if (!transferElems.length) {
      return;
    } else {
      return (
        <div className="Line-transfers">
          {transferElems}
        </div>
      );
    }
  }

  renderStations() {
    const line = this.props.line;
    let stationElems = [];
    let intermediateWaypointIds = [];
    for (const [i, stationId] of line.stationIds.entries()) {
      const station = this.props.system.stations[stationId];
      if (!station) continue;

      // group together all consecutive waypoints to be able to display like: * 4 waypoints (-)
      if (station.isWaypoint || (line.waypointOverrides || []).includes(stationId)) {
        intermediateWaypointIds.push(stationId);
        if (i !== line.stationIds.length - 1) { // handle case where last station is waypoint
          continue;
        }
      }

      if (!this.props.viewOnly && intermediateWaypointIds.length) { // do not show waypoints in viewonly mode
        // display grouped waypoints and reset intermediateWaypointIds
        const wIdsToUse = intermediateWaypointIds;
        const button = this.props.viewOnly ? '' : (
          <button className="Line-waypointsRemove" data-tooltip-content="Remove from line"
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

      if (!station.isWaypoint) {
        const button = this.props.viewOnly ? '' : (
          <button className="Line-stationRemove" data-tooltip-content="Remove from line"
                  onClick={() => this.props.onStationRemove(line, stationId)}>
            <i className="fas fa-minus-circle"></i>
          </button>
        );
        stationElems.push(
          <li className="Line-station" key={stationElems.length}>
            <button className="Line-stationButton Link"
                    onClick={() => this.props.onStopClick(stationId)}>
              <div className="Line-stationName">
                {station.name ? station.name : 'Station Name'}
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
      const wOSet = new Set(this.props.line.waypointOverrides || []);
      const fullStationCount = this.props.line.stationIds.reduce(
        (count, sId) => count + (this.props.system.stations[sId]?.isWaypoint || wOSet.has(sId) ? 0 : 1),
        0
      );
      let totalTime = 0;
      totalTime += fullStationCount * mode.pause / 1000; // amount of time spent at stations; mode.pause is a∂ number of millisecs

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

  renderModeDropdown() {
    const modes = LINE_MODES.map(m => {
      return {
        label: m.label,
        value: m.key
      };
    });

    return (
      <div className="Line-modeSelect">
        <Dropdown disabled={this.props.viewOnly} options={modes} value={getMode(this.props.line.mode).key}
                  placeholder="Select a mode" className="Line-dropdown"
                  onChange={(mode) => this.handleModeChange(mode)} />
        <i className="far fa-question-circle"
           data-tooltip-content="Line mode dictates travel time, station wait time, vehicle speed, etc">
        </i>
      </div>
    );
  }

  renderGroupDropdown() {
    const groupOptions = [];
    for (const group of Object.values(this.props.system.lineGroups || {})) {
      if (!group.id) continue;

      groupOptions.push({
        label: group.label ? group.label : 'Group Name',
        value: group.id
      });
    }

    groupOptions.sort((a, b) => a.label.toLowerCase() < b.label.toLowerCase() ? -1 : 1);

    if (!groupOptions.length) return;

    if (!this.props.viewOnly) {
      groupOptions.unshift({
        label: 'Select a line group',
        value: ''
      });
    }

    return (
      <div className="Line-groupSelect">
        <Dropdown disabled={this.props.viewOnly} options={groupOptions} value={this.props.line.lineGroupId}
                  placeholder="Select a line group"  className="Line-dropdown Line-dropdown--hasDefault"
                  onChange={(groupId) => this.handleGroupChange(groupId)} />
        <i className="far fa-question-circle"
           data-tooltip-content="Custom line groups are used to organize lines">
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
          {this.renderColorSlider()}
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

      // height of travel time + mode + each mode option + group
      const minHeight = this.props.viewOnly ? null : `${20 + 50 + (LINE_MODES.length * 36) + 70}px`;

      return (
        <div className="Line-details" style={{ minHeight }}>
          {this.renderTravelTime()}
          {this.renderModeDropdown()}
          {this.renderGroupDropdown()}
          {this.props.viewOnly || this.props.line.stationIds.length < 2 ? '' : reverseWrap}
          {this.props.viewOnly || this.props.line.stationIds.length < 2 ? '' : duplicateWrap}
          {this.props.viewOnly ? '' : deleteWrap}
          {this.props.isMobile && this.state.transitionDone && <Revenue unitName='focusLineMobile' mutationSelector='.FocusAnim' />}
          {!this.props.isMobile && this.state.transitionDone && <Revenue unitName='focusLineDesktop' mutationSelector='.FocusAnim' />}
          {this.renderStations()}
        </div>
      );
    }
  }

  componentDidMount() {
    if (!this.state.lineId && this.props.line && this.props.line.id) {
      this.setState({
        lineId: this.props.line.id
      });
    }

    setTimeout(() => {
      this.setState({
        transitionDone: true
      });
    }, this.props.entranceAnimation ? FOCUS_ANIM_TIME : 0);
  }

  componentDidUpdate() {
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

  render() {
    const title = this.state.nameChanging ? this.state.name : this.props.line.name;
    const namePrev = this.props.viewOnly ? (
      <div className="Line-namePrev" style={{backgroundColor: this.props.line.color}}></div>
    ) : (
      <button className="Line-namePrev" style={{backgroundColor: this.props.line.color}}
              onClick={() => this.handleColorChange()}
              data-tooltip-content="Change line color"></button>
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
        <button className="Line-close"
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
