import React from 'react';
import { CombineLatestOperator } from 'rxjs/internal/observable/combineLatest';

export class Station extends React.Component {

  constructor(props) {
    super(props);
    this.state = {};
  }

  addToLine(lineKey) {
    console.log('add to line:', lineKey);
    this.props.onAddToLine(lineKey, this.props.station);
  }

  render() {
    const addButtons = Object.keys(this.props.lines).map((lineKey) =>
      <button key={lineKey} onClick={() => this.addToLine(lineKey)}>Add to {this.props.lines[lineKey].name}</button>
    );

    return (
      <div className="Station">
        <div className="Station-name">Station Name</div>
        <div className="Station-lat">Latitude: {this.props.station.lat}</div>
        <div className="Station-lng">Longitude: {this.props.station.lng}</div>
        {addButtons}
      </div>
    );
  }
}
