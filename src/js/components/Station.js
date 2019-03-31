import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';

export class Station extends React.Component {

  constructor(props) {
    super(props);
    this.state = {};
  }

  addToLine(lineKey) {
    this.props.onAddToLine(lineKey, this.props.station);
  }

  renderOnLines(id) {
    const lines = this.props.lines;
    let isOnLines = [];
    for (const lineKey in lines) {
      if (lines[lineKey].stationIds.includes(id)) {
        isOnLines.push(
          <div className="Station-lineWrap" key={lineKey}>
            <div className="Station-linePrev" style={{backgroundColor: this.props.lines[lineKey].color}}></div>
            <div className="Station-line">
              On {lines[lineKey].name}
            </div>
          </div>
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
          <div className="Station-addButtonWrap" key={lineKey}>
            <div className="Station-addButtonPrev" style={{backgroundColor: this.props.lines[lineKey].color}}></div>
            <button className="Station-addButton" onClick={() => this.addToLine(lineKey)}>
              Add to {this.props.lines[lineKey].name}
            </button>
          </div>
        );
      }
    }
    return addLines;
  }

  render() {

    return (
      <ReactCSSTransitionGroup
        transitionName="Focus"
        transitionAppear={true}
        transitionAppearTimeout={200}
        transitionEnter={false}
        transitionLeave={false}>
        <div className="Station">
          <div className="Station-name">{this.props.station.name}</div>
          <div className="Station-lat">Latitude: {this.props.station.lat}</div>
          <div className="Station-lng">Longitude: {this.props.station.lng}</div>
          <div className="Station-lines">
            {this.renderOnLines(this.props.station.id)}
          </div>
          <div className="Station-addButtons">
            {this.renderAddLines(this.props.station.id)}
          </div>
          <div className="Station-deleteWrap">
            <button className="Station-delete" onClick={() => this.props.onDeleteStation(this.props.station)}>
              Delete this station
            </button>
          </div>
        </div>
      </ReactCSSTransitionGroup>
    );
  }
}
