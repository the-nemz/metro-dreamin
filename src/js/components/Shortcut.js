import React from 'react';
import mapboxgl from 'mapbox-gl';
import ReactTooltip from 'react-tooltip';

import { getDistance } from '../util.js';

export class Shortcut extends React.Component {

  constructor(props) {
    super(props);
    this.shortcutRef = React.createRef();
  }

  componentDidMount() {
    this.setup();
  }

  componentDidUpdate() {
    this.setup();
  }

  setup() {
    ReactTooltip.rebuild();

    let options = {
      offset: {
        left: [16, 0]
      },
      anchor: 'left',
      closeButton: false,
      className: 'Shortcut-popup'
    }
    new mapboxgl.Popup(options)
      .setLngLat([this.props.station.lng, this.props.station.lat])
      .setDOMContent(this.shortcutRef.current)
      .addTo(this.props.map);
  }

  renderLineButton(id) {
    const lines = this.props.system.lines;
    return (
      <button className="Shortcut-lineAdd" key={id} data-tip={`Add to ${lines[id].name}`}
              style={{backgroundColor: lines[id].color}}
              onClick={() => this.addToLine(id)}>
      </button>
    );
  }

  renderButtons() {
    const lines = this.props.system.lines;
    const stations = this.props.system.stations;

    let onLines = [];
    for (const line of Object.values(lines)) {
      if (line.stationIds.includes(this.props.station.id)) {
        onLines.push(line.id);
      }
    }

    let otherLineDists = [];
    for (const line of Object.values(lines)) {
      if (!onLines.includes(line.id)) {
        const stationsOnLine = line.stationIds.map(id => stations[id]);
        let nearestDist = Number.MAX_SAFE_INTEGER;
        for (const otherStation of stationsOnLine) {
          let dist = getDistance(this.props.station, otherStation);
          if (dist < nearestDist) {
            nearestDist = dist;
          }
        }
        otherLineDists.push({id: line.id, dist: nearestDist});
      }
    }

    otherLineDists.sort((a, b) => { return a.dist > b.dist ? 1 : -1; });

    let buttons = [];
    for (const [i, otherLine] of otherLineDists.entries()) {
      if (i > 1) {
        break;
      }
      buttons.push(this.renderLineButton(otherLine.id));
    }

    buttons.push(
      <button className="Shortcut-delete" key="deleter" data-tip="Delete this station"
              onClick={() => this.props.onDeleteStation(this.props.station)}>
        <i className="fas fa-trash-alt"></i>
      </button>
    );
    return buttons;
  }

  render() {
    return (
      <div className="Shortcut" ref={this.shortcutRef}>
        {this.renderButtons()}
      </div>
    );
  }
}
