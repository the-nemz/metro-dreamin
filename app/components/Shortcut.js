import React from 'react';
import mapboxgl from 'mapbox-gl';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga4';

import { getDistance } from '/lib/util.js';

export class Shortcut extends React.Component {

  constructor(props) {
    super(props);
    this.shortcutRef = React.createRef();
    this.state = {
      show: false
    };
  }

  componentDidMount() {
    ReactTooltip.rebuild();
    this.setup();
  }

  componentDidUpdate() {
    ReactTooltip.rebuild();
    this.setup();
  }

  componentWillUnmount() {
    ReactTooltip.rebuild();
    if (this.state.popup && this.state.popup.isOpen()) {
      this.state.popup.remove();
    }
  }

  setup() {
    if ('station' in (this.props.focus || {})) {
      const newStation = this.props.focus.station;
      if (this.state.stationId !== newStation.id) {
        let options = {
          offset: {
            left: [16, 0]
          },
          anchor: 'left',
          closeButton: false,
          className: 'Shortcut-popup'
        }

        if (this.state.popup && this.state.popup.isOpen()) {
          this.state.popup.remove();
        }

        const popup = new mapboxgl.Popup(options)
          .setLngLat([newStation.lng, newStation.lat])
          .setDOMContent(this.shortcutRef.current)
          .addTo(this.props.map);

        this.setState({
          stationId: newStation.id,
          station: newStation,
          popup: popup,
          show: true
        });
      } else {
        // station not changing, do nothing
      }
      return;
    }

    if (this.state.show || this.state.stationId || this.state.station) {
      // station not focused, clear existing state
      this.setState({
        stationId: null,
        station: null,
        show: false
      });
    }

    if (this.state.popup && this.state.popup.isOpen()) {
      this.state.popup.remove();
      this.setState({
        popup: null
      });
    }
  }

  renderLineButton(id) {
    const lines = this.props.system.lines;

    if (lines[id]) {
      return (
        <button className="Shortcut-lineAdd" key={id} data-tip={`Add to ${lines[id].name}`}
                style={{backgroundColor: lines[id].color}}
                onClick={() => {
                  this.props.onAddToLine(id, this.state.station);
                  ReactGA.event({
                    category: 'Edit',
                    action: `(Shortcut) Add ${this.state.station.isWaypoint ? 'Waypoint' : 'Station'} to Line`
                  });
                }}>
        </button>
      );
    }
  }

  renderButtons() {
    const lines = this.props.system.lines;
    const stations = this.props.system.stations;

    let onLines = [];
    for (const line of Object.values(lines)) {
      if (line.stationIds.includes(this.state.stationId)) {
        onLines.push(line.id);
      }
    }

    let otherLineDists = [];
    for (const line of Object.values(lines)) {
      if (!onLines.includes(line.id)) {
        const stationsOnLine = line.stationIds.map(id => stations[id]);
        let nearestDist = Number.MAX_SAFE_INTEGER;
        for (const otherStation of stationsOnLine) {
          let dist = getDistance(this.state.station, otherStation);
          if (dist < nearestDist) {
            nearestDist = dist;
          }
        }
        otherLineDists.push({id: line.id, dist: nearestDist});
      }
    }

    otherLineDists.sort((a, b) => { return a.dist > b.dist ? 1 : -1; });

    let buttons = [];
    if (this.props.recent.lineKey && !onLines.includes(this.props.recent.lineKey)) {
      buttons.push(this.renderLineButton(this.props.recent.lineKey));
    }

    for (const otherLine of otherLineDists) {
      if (buttons.length > 2) {
        break;
      }
      if (otherLine.id !== this.props.recent.lineKey) {
        buttons.push(this.renderLineButton(otherLine.id));
      }
    }

    const currentlyIsWaypoint = this.state.station.isWaypoint;
    buttons.push(
      <button className="Shortcut-convert" key="converter" data-tip={currentlyIsWaypoint ? 'Convert to station' : 'Convert to waypoint'}
              onClick={() => {
                currentlyIsWaypoint ? this.props.onConvertToStation(this.state.station) : this.props.onConvertToWaypoint(this.state.station);
                ReactGA.event({
                  category: 'Edit',
                  action: `(Shortcut) ${currentlyIsWaypoint ? 'Convert to Station' :'Convert to Waypoint'}`
                });
              }}>
        {this.state.station.isWaypoint ? <i className="fas fa-circle-stop"></i> : <i className="fas fa-arrow-turn-up"></i>}
      </button>
    );

    buttons.push(
      <button className="Shortcut-delete" key="deleter" data-tip="Delete this station"
              onClick={() => {
                this.props.onDeleteStation(this.state.station);
                ReactGA.event({
                  category: 'Edit',
                  action: `(Shortcut) Delete ${currentlyIsWaypoint ? 'Waypoint' : 'Station'}`
                });
              }}>
        <i className="fas fa-trash-alt"></i>
      </button>
    );
    return (
      <div className="Shortcut-buttons">
        {buttons}
      </div>
    );
  }

  render() {
    return (
      <div className="Shortcut">
        <div className="Shortcut-ref" ref={this.shortcutRef}>
          {this.state.show && this.renderButtons()}
        </div>
      </div>
    );
  }
}
