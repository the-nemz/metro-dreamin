import React from 'react';

export class Station extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      nameChanging: false
    };
  }

  handleNameChange(value) {
    this.setState({
      name: value,
      nameChanging: true
    });
  }

  handleNameBlur(value) {
    let station = this.props.station;
    if (station.name !== value) {
      station.name = value;
      this.props.onStationInfoChange(station);
    }
    this.setState({
      name: '',
      nameChanging: false
    });
  }

  handleLineClick(line) {
    this.props.onLineClick(line);
    this.setState({
      name: '',
      nameChanging: false
    });
  }

  addToLine(lineKey) {
    this.props.onAddToLine(lineKey, this.props.station, this.getNearestIndex(lineKey));
  }

  getDistance(station1, station2) {
    const unit = 'M';
    const lat1 = station1.lat;
    const lon1 = station1.lng;
    const lat2 = station2.lat;
    const lon2 = station2.lng;

    if ((lat1 === lat2) && (lon1 === lon2)) {
      return 0;
    }
    else {
      let radlat1 = Math.PI * lat1 / 180;
      let radlat2 = Math.PI * lat2 / 180;
      let theta = lon1 - lon2;
      let radtheta = Math.PI * theta / 180;
      let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);

      if (dist > 1) {
        dist = 1;
      }

      dist = Math.acos(dist);
      dist = dist * 180 / Math.PI;
      dist = dist * 60 * 1.1515;

      if (unit === 'K') {
        dist = dist * 1.609344
      }
      return dist;
    }

  }

  getNearestIndex(lineKey) {
    const line = this.props.lines[lineKey];

    if (line.stationIds.length === 0 || line.stationIds.length === 1) {
      return 0;
    }

    let nearestIndex = 0;
    let nearestDist = Number.MAX_SAFE_INTEGER;
    for (const [i, stationId] of line.stationIds.entries()) {
      let dist = this.getDistance(this.props.station, this.props.stations[stationId])
      if (dist < nearestDist) {
        nearestIndex = i;
        nearestDist = dist;
      }
    }

    if (nearestIndex === 0) {
      const nearStation = this.props.stations[line.stationIds[nearestIndex]];
      const nextStation = this.props.stations[line.stationIds[nearestIndex + 1]];
      const otherDist = this.getDistance(nearStation, nextStation);
      const nextDist = this.getDistance(this.props.station, nextStation);
      if (nextDist > otherDist) {
        return 0;
      }
      return 1;
    } else if (nearestIndex === line.stationIds.length - 1) {
      const nearStation = this.props.stations[line.stationIds[nearestIndex]];
      const nextStation = this.props.stations[line.stationIds[nearestIndex - 1]];
      const otherDist = this.getDistance(nearStation, nextStation);
      const nextDist = this.getDistance(this.props.station, nextStation);
      if (nextDist > otherDist) {
        return line.stationIds.length ;
      }
      return line.stationIds.length - 1;
    } else {
      const prevStation = this.props.stations[line.stationIds[nearestIndex - 1]];
      const nextStation = this.props.stations[line.stationIds[nearestIndex + 1]];
      const prevDist = this.getDistance(this.props.station, prevStation);
      const nextDist = this.getDistance(this.props.station, nextStation);
      const nearToPrevDist = this.getDistance(this.props.stations[line.stationIds[nearestIndex]], prevStation);
      const nearToNextDist = this.getDistance(this.props.stations[line.stationIds[nearestIndex]], nextStation);
      if (prevDist < nextDist) {
        if (nearToPrevDist < prevDist) return nearestIndex + 1;
        return nearestIndex;
      } else {
        if (nearToNextDist < nextDist) return nearestIndex;
        return nearestIndex + 1;
      }
    }
  }

  renderOnLines(id) {
    const lines = this.props.lines;
    let isOnLines = [];
    for (const lineKey in lines) {
      if (lines[lineKey].stationIds.includes(id)) {
        isOnLines.push(
          <button className="Station-lineWrap" key={lineKey} title={`Show ${lines[lineKey].name}`}
                  onClick={() => this.handleLineClick(lines[lineKey])}>
            <div className="Station-linePrev" style={{backgroundColor: lines[lineKey].color}}></div>
          </button>
        );
      }
    }
    if (!isOnLines.length) {
      return <div className="Station-noLine">Not on any lines yet!</div>;
    }
    return isOnLines;
  }

  renderAddLines(id) {
    const lines = this.props.lines;
    let addLines = [];
    for (const lineKey in lines) {
      if (!lines[lineKey].stationIds.includes(id)) {
        addLines.push(
          <button className="Station-addButtonWrap Link" key={lineKey} onClick={() => this.addToLine(lineKey)}>
            <div className="Station-addButtonPrev" style={{backgroundColor: lines[lineKey].color}}></div>
            <div className="Station-addButton">
              Add to {lines[lineKey].name}
            </div>
          </button>
        );
      }
    }
    return addLines;
  }

  render() {
    const title = this.state.nameChanging ? this.state.name : this.props.station.name;
    const addLines = (
      <div className="Station-addButtons">
        {this.renderAddLines(this.props.station.id)}
      </div>
    );
    const deleteWrap = (
      <div className="Station-deleteWrap">
        <button className="Station-delete Link" onClick={() => this.props.onDeleteStation(this.props.station)}>
          Delete this station
        </button>
      </div>
    );
    const nameElem = this.props.viewOnly ? (
      <div className="Station-name">
        {title ? title : ''}
      </div>
    ) : (
      <input className="Station-name Station-name--input" type="text" value={title ? title : ''}
             onChange={(e) => this.handleNameChange(e.target.value)}
             onBlur={(e) => this.handleNameBlur(e.target.value)}>
      </input>
    );
    return (
      <div className="Station Focus FocusAnim">
        <button className="Station-close" title="Close station view"
                onClick={() => this.props.onFocusClose()}>
          <i className="fas fa-times-circle"></i>
        </button>

        <div className="Station-nameWrap">
          {nameElem}
        </div>
        <div className="Station-content">
          <div className="Station-lines">
            {this.renderOnLines(this.props.station.id)}
          </div>
          {this.props.viewOnly ? '' : addLines}
          {this.props.viewOnly ? '' : deleteWrap}
        </div>
      </div>
    );
  }
}
