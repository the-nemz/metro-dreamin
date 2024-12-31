import React from 'react';
import ReactGA from 'react-ga4';
import Dropdown from 'react-dropdown';
import { lineString as turfLineString } from '@turf/helpers';
import turfLength from '@turf/length';
import { ChromePicker } from 'react-color';

import {
  displayLargeNumber,
  divideLineSections,
  getLineColorIconStyle,
  getLuminance,
  getMode,
  getNameForCustomColor,
  hasCustomLineName,
  stationIdsToCoordinates,
  trimStations
} from '/util/helpers.js';
import {
  COLOR_TO_NAME,
  DEFAULT_LINE_MODE,
  DEFAULT_LINES,
  FOCUS_ANIM_TIME,
  GEOSPATIAL_API_BASEURL,
  LINE_ICON_SHAPES,
  LINE_MODES,
  MILES_TO_KMS_MULTIPLIER,
} from '/util/constants.js';

import { GradeUpdate } from '/components/GradeUpdate.js';
import { Revenue } from '/components/Revenue.js';

export class Line extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      nameChanging: false,
      lineId: null,
      showColorPicker: false,
      showColorSlider: false,
      iconName: this.props.line.icon,
      sliderColor: null,
      sliderColorName: null,
      stationForGrade: null,
      waypointIdsForGrade: null,
      gettingRidership: false,
      tempRidership: null
    };
  }

  handleNameChange(value) {
    this.setState({
      name: value,
      nameChanging: true
    });
  }

  handleNameBlur(value) {
    const trimmedValue = value.trim().substring(0, 100);
    let line = this.props.line;
    if (trimmedValue && line.name !== trimmedValue) {
      line.name = trimmedValue;
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
      iconName: this.props.line.icon,
      sliderColor: null,
      sliderColorName: null,
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
  }

  handleColorSelect(chosen) {
    let line = this.props.line;

    if (!hasCustomLineName(line)) {
      // line name not manually updated
      line.name = chosen.name;
    }

    line.color = chosen.color;

    if (this.state.iconName) line.icon = this.state.iconName;
    else delete line.icon;

    this.props.onLineInfoChange(line, true);

    this.setState({
      showColorPicker: false,
      showColorSlider: false,
      iconName: line.icon,
      sliderColor: null,
      sliderColorName: null,
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

  handleIconChange(option) {
    let line = this.props.line;
    if (line.icon !== option.value) {
      if (option.value) this.setState({ iconName: option.value });
      else this.setState({ iconName: null });

      ReactGA.event({
        category: 'Edit',
        action: 'Select Line Icon'
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

  buildRidershipPayload() {
    const lineKeysHandled = new Set();
    const transferCounts = {};
    const stationsToSend = {};
    for (const stationId of this.props.line.stationIds || []) {
      if (!(stationId in this.props.system.stations)) continue;
      stationsToSend[stationId] = this.props.system.stations[stationId];

      const modesHandledForStation = new Set();
      for (const transfer of (this.props.transfersByStationId?.[stationId]?.hasTransfers ?? [])) {
        const matchesFirst = transfer.length === 2 && transfer[0] === this.props.line.id;
        const matchesSecond = transfer.length === 2 && transfer[1] === this.props.line.id;
        if (matchesFirst || matchesSecond) {
          const otherLineKey = matchesFirst ? transfer[1] : transfer[0];
          const otherMode = this.props.system.lines[otherLineKey]?.mode ?? DEFAULT_LINE_MODE;

          if (!lineKeysHandled.has(otherLineKey) && !modesHandledForStation.has(otherMode)) {
            transferCounts[otherMode] = (transferCounts[otherMode] || 0) + 1;
          }

          lineKeysHandled.add(otherLineKey);
          modesHandledForStation.add(otherMode);
        }
      }
    }

    const lines = {};
    lines[this.props.line.id] = this.props.line;
    const mode = this.props.line.mode ? this.props.line.mode : DEFAULT_LINE_MODE;
    const transferCountsByMode = {};
    transferCountsByMode[mode] = transferCounts;

    return {
      transferCountsByMode,
      lines,
      stations: trimStations(stationsToSend)
    }
  }

  getRidership() {
    this.setState({ gettingRidership: true });

    const mode = this.props.line.mode ? this.props.line.mode : DEFAULT_LINE_MODE;

    fetch(`${GEOSPATIAL_API_BASEURL}/ridership`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(this.buildRidershipPayload())
    }).then(resp => resp.json())
      .then(respJson => {
        if (respJson.modes && mode in respJson.modes) {
          if (this.props.viewOnly) {
            this.setState({ tempRidership: respJson.modes[mode] })
          } else {
            const updatedLine = {
              ...this.props.line,
              ridershipInfo: respJson.modes[mode]
            };
            this.props.onLineInfoChange(updatedLine, false, true);
          }
        }
      })
      .catch(e => console.warn('Error getting ridership:', e))
      .finally(() => this.setState({ gettingRidership: false }));
  }

  getGradeText(grade) {
    let gradeText = '';
    switch (grade) {
      case 'at':
        gradeText = 'At grade';
        break;
      case 'above':
        gradeText = 'Above grade';
        break;
      case 'below':
        gradeText = 'Below grade';
        break;
    }
    return gradeText;
  }

  renderColorOptions() {
    let options = [];
    for (const defLine of DEFAULT_LINES) {
      let tooltip = COLOR_TO_NAME[defLine.color];
      if (this.state.iconName && this.state.iconName !== 'solid') {
        tooltip += ` ${this.state.iconName}`;
      }

      const lineColorIconStyles = getLineColorIconStyle({ color: defLine.color, icon: this.state.iconName });
      options.push(
        <button className="Line-color" key={defLine.color} data-tooltip-content={tooltip}
                style={lineColorIconStyles.parent}
                onClick={() => this.handleColorSelect(defLine)}>
          <div style={lineColorIconStyles.child}></div>
        </button>
      );
    }
    return <div className="Line-colors">
      {options}
    </div>;
  }

  renderColorSlider() {
    const isDisabled = this.state.iconName && this.state.iconName !== 'solid';

    if (this.state.showColorSlider && !isDisabled) {
      return <div className="Line-colorPicker">
        <ChromePicker color={this.state.sliderColor || this.props.line.color}
                      disableAlpha
                      onChange={(color, event) => {
                        this.setState({ sliderColor: color.hex });
                      }}
                      onChangeComplete={(color, event) => {
                        try {
                          const colorName = getNameForCustomColor(color.hex);
                          if (colorName) {
                            this.setState({ sliderColorName: colorName });
                          } else {
                            this.setState({ sliderColorName: null });
                          }
                        } catch (e) {
                          console.log('getNameForCustomColor error:', e);
                          this.setState({ sliderColorName: null });
                        }
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
      const buttonClass = isDisabled ? 'Line-showColorSlider' : 'Line-showColorSlider Link';
      return <button className={buttonClass} disabled={isDisabled}
                     onClick={() => this.setState({ showColorSlider: true })}>
        Select a custom color
      </button>
    }
  }

  renderTransfers(stationId) {
    const system = this.props.system;
    const line = this.props.line;

    const groupsDisplayedSet = new Set(this.props.groupsDisplayed || []);
    const lineIdsDisplayed = Object.values(system.lines || {})
                                   .filter(line => !this.props.groupsDisplayed ||
                                                   groupsDisplayedSet.has(line.lineGroupId ?
                                                                          line.lineGroupId :
                                                                          getMode(line.mode).key))
                                   .map(l => l.id);
    const lineIdsDisplayedSet = new Set(lineIdsDisplayed);

    let transferElems = [];
    let hiddenTransferElems = [];
    let includedLineIds = new Set();
    for (const transfer of (this.props.transfersByStationId?.[stationId]?.hasTransfers ?? [])) {
      const matchesFirst = transfer.length === 2 && transfer[0] === line.id;
      const matchesSecond = transfer.length === 2 && transfer[1] === line.id;
      if (matchesFirst || matchesSecond) {
        const otherLineKey = matchesFirst ? transfer[1] : transfer[0];
        includedLineIds.add(otherLineKey);
        const transferElem = (
          <div className={`Line-transfer Line-transfer--${lineIdsDisplayedSet.has(otherLineKey) ? 'shown' : 'hidden'}`}
               key={otherLineKey}>
            <div className="Line-transferPrev" style={{backgroundColor: system.lines[otherLineKey].color}}></div>
          </div>
        );

        if (lineIdsDisplayedSet.has(otherLineKey)) {
          transferElems.push(transferElem);
        } else {
          hiddenTransferElems.push(transferElem);
        }
      }
    }

    const interchange = this.props.interchangesByStationId[stationId];
    if (interchange && interchange.hasLines && interchange.hasLines.length) {
      for (const lineKey of interchange.hasLines) {
        if (lineKey !== line.id && system.lines[lineKey] && !includedLineIds.has(lineKey)) {
          const transferElem = (
            <div className={`Line-transfer Line-transfer--${lineIdsDisplayedSet.has(lineKey) ? 'shown' : 'hidden'}`}
                 key={lineKey}>
              <div className="Line-transferWalk"
                   style={{backgroundColor: system.lines[lineKey].color}}
                   data-lightcolor={getLuminance(system.lines[lineKey].color) > 128}>
                <i className="fas fa-person-walking"></i>
              </div>
            </div>
          );

          if (lineIdsDisplayedSet.has(lineKey)) {
            transferElems.push(transferElem);
          } else {
            hiddenTransferElems.push(transferElem);
          }
        }
      }
    }

    if (!transferElems.length && !hiddenTransferElems.length) {
      return;
    } else {
      return (
        <div className="Line-transfers">
          {transferElems}
          {hiddenTransferElems}
        </div>
      );
    }
  }

  renderStations() {
    const line = this.props.line;
    const mode = getMode(line.mode);

    let stationElems = [];
    let intermediateWaypointIdGroups = [];
    let gradeFallback = mode.defaultGrade;
    for (const [i, stationId] of line.stationIds.entries()) {
      const station = this.props.system.stations[stationId];
      if (!station) continue;

      let grade = station.grade ? station.grade : mode.defaultGrade;

      // group together all consecutive waypoints to be able to display like: * 4 waypoints (-)
      if (station.isWaypoint || (line.waypointOverrides || []).includes(stationId)) {
        // use previous full station grade if there is no explicit grade set
        grade = station.grade ? station.grade : gradeFallback;

        const waypointGroupCount = intermediateWaypointIdGroups.length;
        let currWaypointGroup = waypointGroupCount && intermediateWaypointIdGroups[waypointGroupCount - 1];
        if (currWaypointGroup && currWaypointGroup?.grade === grade) {
          intermediateWaypointIdGroups[waypointGroupCount - 1]?.waypointIds?.push(stationId);
        } else {
          intermediateWaypointIdGroups.push({
            grade: grade,
            waypointIds: [ stationId ]
          });
        }
        if (i !== line.stationIds.length - 1) { // handle case where last station is waypoint
          continue;
        }
      } else {
        // set full station grade for use on subsequent ungraded waypoints
        gradeFallback = grade;
      }

      if (!this.props.viewOnly && !this.props.waypointsHidden && intermediateWaypointIdGroups.length) { // do not show waypoints in viewonly mode
        // display grouped waypoints and reset intermediateWaypointIdGroups
        for (const waypointGroup of intermediateWaypointIdGroups) {
          const wIdsToUse = waypointGroup.waypointIds || [];
          const gradeText = this.getGradeText(waypointGroup.grade);

          const button = this.props.viewOnly ? '' : (
            <button className="Line-waypointsRemove" data-tooltip-content="Remove from line"
                    onClick={() => this.props.onWaypointsRemove(line, wIdsToUse)}>
              <i className="fas fa-minus-circle"></i>
            </button>
          );

          stationElems.push(
            <li className="Line-waypoints" key={stationElems.length}>
              <button className={`Line-stationGrade Line-stationGrade--${waypointGroup.grade}`}
                      data-tooltip-content={gradeText}
                      onClick={() => this.setState({ waypointIdsForGrade: wIdsToUse })}
                      style={{
                        '--color': line.color,
                        '--color-inverse': getLuminance(line.color) > 128 ? '#000' : '#fff'
                      }}>
                <span className="sr-only">{gradeText}</span>
              </button>
              <div className="Line-waypointsButton">
                <div className="Line-waypointsName">
                  {wIdsToUse.length} {wIdsToUse.length === 1 ? 'waypoint' : 'waypoints'}
                </div>
              </div>
              {button}
            </li>
          );
        }
        intermediateWaypointIdGroups = [];
      }

      if (!station.isWaypoint) {
        const gradeText = this.getGradeText(grade);

        const button = this.props.viewOnly ? '' : (
          <button className="Line-stationRemove" data-tooltip-content="Remove from line"
                  onClick={() => this.props.onStationRemove(line, stationId)}>
            <i className="fas fa-minus-circle"></i>
          </button>
        );

        stationElems.push(
          <li className="Line-station" key={stationElems.length}>
            <button className={`Line-stationGrade Line-stationGrade--${grade}`}
                    data-tooltip-content={gradeText}
                    onClick={() => this.setState({ stationForGrade: station })}
                    style={{
                      '--color': line.color,
                      '--color-inverse': getLuminance(line.color) > 128 ? '#000' : '#fff'
                    }}>
              <span className="sr-only">{gradeText}</span>
            </button>
            <button className="Line-stationButton"
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

  renderStats() {
    // vehicle travels 60x actual speed, so 60 km/min instead of 60 kph irl
    const mode = getMode(this.props.line.mode);
    const wOSet = new Set(this.props.line.waypointOverrides || []);
    let travelText = `n/a`;
    let distanceText = '0';
    let fullStationCount = (this.props.line.stationIds || []).reduce(
      (count, sId) => count + (this.props.system.stations[sId]?.isWaypoint || wOSet.has(sId) ? 0 : 1),
      0
    );

    const ridershipInfo = this.state.tempRidership || this.props.line.ridershipInfo || {};
    let ridershipElem;
    let costElem;

    if (this.props.line.stationIds.length > 0) {
      let totalDistance = 0;
      let totalTime = 0;
      totalTime += fullStationCount * mode.pause / 1000; // amount of time spent at stations; mode.pause is a∂ number of millisecs

      const sections = divideLineSections(this.props.line, this.props.system.stations);
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
        totalDistance += routeDistance;
      }
      const travelValue = Math.round(totalTime);

      const firstStationId = this.props.line.stationIds[0];
      const lastStationId = this.props.line.stationIds[this.props.line.stationIds.length - 1];
      if (firstStationId === lastStationId &&
          this.props.line.stationIds.length !== 1 &&
          !(this.props.system.stations[firstStationId]?.isWaypoint || wOSet.has(firstStationId))) {
        // don't double count circular stations
        fullStationCount--;
      }

      if (this.props.line.stationIds.length > 1) {
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

        const usesImperial = (navigator?.language ?? 'en').toLowerCase() === 'en-us';
        const divider = usesImperial ? MILES_TO_KMS_MULTIPLIER : 1;
        if (totalDistance >= 10) {
          distanceText = `${Math.round(totalDistance / divider)} ${usesImperial ? 'mi' : 'km'}`;
        } else {
          distanceText = `${(totalDistance / divider).toPrecision(2)} ${usesImperial ? 'mi' : 'km'}`;
        }
      }

      let ridershipStatElem;
      if ('ridership' in (ridershipInfo || {})) {
        const ridershipNumStr = displayLargeNumber(ridershipInfo.ridership, 3);
        ridershipStatElem = <span className="Line-statValue">{ridershipNumStr}</span>;
      } else if (this.state.gettingRidership) {
        ridershipStatElem = <span className="Line-statLoader Ellipsis"></span>;
      }

      if (ridershipStatElem) {
        ridershipElem = (
          <div className="Line-bigStat">
            Annual ridership: {ridershipStatElem}
            <i className="far fa-question-circle"
               data-tooltip-content="Estimated from served population, connectivity, area characteristics, and more">
            </i>
          </div>
        );
      }

      let costStatElem;
      if ('cost' in (ridershipInfo || {})) {
        const costNumStr = displayLargeNumber(ridershipInfo.cost * 1_000_000, 3);
        costStatElem = <span className="Line-statValue">$ {costNumStr}</span>;
      } else if (this.state.gettingRidership) {
        costStatElem = <span className="Line-statLoader Ellipsis"></span>;
      }

      if (costStatElem) {
        costElem = (
          <div className="Line-bigStat">
            Construction cost: {costStatElem}
            <i className="far fa-question-circle"
               data-tooltip-content="Estimated from mode type, grade, country, and more">
            </i>
          </div>
        );
      }
    }

    return (
      <div className="Line-stats">
        <span className="Line-stat">Time: <span className="Line-statValue">{travelText}</span></span>
        <span className="Line-stat">Length: <span className="Line-statValue">{distanceText}</span></span>
        <span className="Line-stat">Stations: <span className="Line-statValue">{fullStationCount}</span></span>

        {ridershipElem}
        {costElem}
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
    if (!this.props.line.lineGroupId && this.props.viewOnly) return;

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
                  placeholder="Select a line group" className="Line-dropdown Line-dropdown--hasDefault"
                  onChange={(groupId) => this.handleGroupChange(groupId)} />
        <i className="far fa-question-circle"
           data-tooltip-content="Custom line groups are used to organize lines">
        </i>
      </div>
    );
  }

  renderIconDropdown() {
    if (!this.props.line.icon && this.props.viewOnly) return;

    const iconOptions = [{
      label: 'Solid (no icon)',
      value: 'solid'
    }];
    for (const icon of LINE_ICON_SHAPES) {
      iconOptions.push({
        label: icon.charAt(0).toUpperCase() + icon.slice(1),
        value: icon
      });
    }

    return (
      <div className="Line-iconSelect">
        <Dropdown disabled={this.props.viewOnly} options={iconOptions}
                  value={this.state.iconName ? this.state.iconName : 'solid'}
                  placeholder="Solid (no icon)" className="Line-dropdown Line-dropdown--hasDefault"
                  onChange={(icon) => this.handleIconChange(icon)} />
        <i className="far fa-question-circle"
           data-tooltip-content="Icon patterns can only be used with default colors">
        </i>
      </div>
    );
  }

  renderGradeModal() {
    if (this.props.viewOnly) return;

    return (
      <GradeUpdate station={this.state.stationForGrade} waypointIds={this.state.waypointIdsForGrade}
                   open={this.state.stationForGrade || this.state.waypointIdsForGrade ? true : false}
                   onStationsGradeChange={this.props.onStationsGradeChange}
                   onClose={() => this.setState({ stationForGrade: null, waypointIdsForGrade: null })} />
    )
  }

  renderContent() {
    if (this.state.showColorPicker) {
      return (
        <div className="Line-colorsWrap">
          <div className="Line-iconText">Choose a pattern:</div>
          {this.renderIconDropdown()}

          <div className="Line-colorsText">Choose a color:</div>
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

      // height of travel time + mode + each mode option + group + 4
      const minHeight = this.props.viewOnly ? null : `${20 + 50 + (LINE_MODES.length * 36) + 70 + 4}px`;

      return (
        <div className="Line-details" style={{ minHeight }}>
          {this.renderStats()}
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

    if (!this.state.gettingRidership) {
      if (!this.state.tempRidership && (!this.props.viewOnly || !this.props.line.ridershipInfo)) {
        this.getRidership();
      }
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
          lineId: this.props.line.id,
          iconName: this.props.line.icon,
          tempRidership: null
        });

        if (!this.state.gettingRidership) {
          if (!this.state.tempRidership && (!this.props.viewOnly || !this.props.line.ridershipInfo)) {
            this.getRidership();
          }
        }
      }
    } else if (this.props.line) {
      this.setState({
        showColorPicker: false,
        nameChanging: false,
        lineId: this.props.line.id,
        iconName: this.props.line.icon,
        tempRidership: null
      });

      if (!this.state.gettingRidership) {
        if (!this.state.tempRidership && (!this.props.viewOnly || !this.props.line.ridershipInfo)) {
          this.getRidership();
        }
      }
    }
  }

  render() {
    const title = this.state.nameChanging ? this.state.name : this.props.line.name;
    const colorIconStyle = getLineColorIconStyle(this.props.line);
    const namePrev = this.props.viewOnly ? (
      <div className="Line-namePrev" style={colorIconStyle.parent}>
        <div style={colorIconStyle.child}></div>
      </div>
    ) : (
      <button className="Line-namePrev" style={colorIconStyle.parent}
              onClick={() => this.handleColorChange()}
              data-tooltip-content="Change line color or icon">
        <div style={colorIconStyle.child}></div>
      </button>
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

        {this.renderGradeModal()}
      </div>
    );
  }
}
