import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';

export class Line extends React.Component {

  constructor(props) {
    super(props);
    this.state = {};
  }

  handleNameChange(value) {
    let line = this.props.line;
    line.name = value;
    this.props.onLineNameChange(line);
  }

  renderStations() {
    const line = this.props.line;
    let stationElems = [];
    for (const stationId of line.stationIds) {
      stationElems.push(
        <li className="Line-station" key={stationId}>
          {this.props.system.stations[stationId].name}
        </li>
      );
    }
    if (!stationElems.length) {
      return <div className="Line-noStations">Not stations on this line yet!</div>;
    }
    return (
      <ul className="Line-stations">
        {stationElems}
      </ul>
    );
  }

  render() {
    return (
      <ReactCSSTransitionGroup
        transitionName="Focus"
        transitionAppear={true}
        transitionAppearTimeout={200}
        transitionEnter={false}
        transitionLeave={false}>
        <div className="Line">
          <div className="Line-title">
            <div className="Line-namePrev" style={{backgroundColor: this.props.line.color}}></div>
            <input className="Line-name" type="text" value={this.props.line.name} onChange={(e) => this.handleNameChange(e.target.value)}></input>
          </div>

          <div className="Line-stationsWrap">
            <div className="Line-staionsText">Stations:</div>
            {this.renderStations()}
          </div>
        </div>
      </ReactCSSTransitionGroup>
    );
  }
}
