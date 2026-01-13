import React from 'react';
import mapboxgl from 'mapbox-gl';
import ReactGA from 'react-ga4';

import { getDistance, getLineColorIconStyle, getMode } from '/util/helpers.js';

export class Shortcut extends React.Component {

  constructor(props) {
    super(props);
    this.shortcutRef = React.createRef();
    this.state = {
      show: false
    };
  }

  componentDidMount() {
    this.setup();
  }

  componentDidUpdate() {
    this.setup();
  }

  componentWillUnmount() {
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
      const colorIconStyle = getLineColorIconStyle(lines[id]);
      return (
        <button className="Shortcut-lineAdd" key={id} data-tooltip-content={`Add to ${lines[id].name}`}
                style={colorIconStyle.parent}
                onClick={() => {
                  this.props.onAddToLine(id, this.state.station);
                  ReactGA.event({
                    category: 'Edit',
                    action: `(Shortcut) Add ${this.state.station.isWaypoint ? 'Waypoint' : 'Station'} to Line`
                  });
                }}>
          <div style={colorIconStyle.child}></div>
        </button>
      );
    }
  }

  getOtherLineDists(onLinesSet) {
    if (!this.state.station) return;

    const lines = this.props.system.lines;
    const stations = this.props.system.stations;

    const groupsDisplayedSet = new Set(this.props.groupsDisplayed || []);
    const linesDisplayed = Object.values(this.props.system?.lines ?? {})
                                 .filter(line => !this.props.groupsDisplayed ||
                                                 groupsDisplayedSet.has(line.lineGroupId ?
                                                                        line.lineGroupId :
                                                                        getMode(line.mode).key))
                                 .map(l => l.id);
    const linesDisplayedSet = new Set(linesDisplayed);

    const isBigMap = Object.keys(this.props.system.lines).length > 100 || Object.keys(this.props.system.stations).length > 10_000;

    let otherLineDists = [];
    if (isBigMap) {
      // Query nearby stations from the map layer using progressive bounding box sizes
      const minLinesNeeded = 3;
      const bboxSizes = [50, 250, 1250, 6250, 32500];

      if (this.props.map && this.props.map.getLayer('js-Map-stations')) {
        // Convert station lat/lng to screen pixel coordinates for spatial query
        const point = this.props.map.project([this.state.station.lng, this.state.station.lat]);

        let stationDists = {};
        for (const size of bboxSizes) {
          const bbox = [
            [point.x - size, point.y - size],
            [point.x + size, point.y + size]
          ];

          const nearbyFeatures = this.props.map.queryRenderedFeatures(bbox, { layers: ['js-Map-stations'] });

          // Track the nearest distance per line
          const lineDistMap = {};
          for (const feat of nearbyFeatures) {
            const stationId = feat?.properties?.stationId;
            if (!stationId || stationId === this.state.stationId) continue;

            const otherStation = stations[stationId];
            if (!otherStation) continue;

            const stationOnLines = this.props.transfersByStationId?.[stationId]?.onLines ?? [];

            for (const onLine of stationOnLines) {
              const lineId = onLine?.lineId;
              if (lineId && !onLinesSet.has(lineId) && linesDisplayedSet.has(lineId)) {
                const dist = stationDists[stationId] ?? getDistance(this.state.station, otherStation);
                if (!(lineId in lineDistMap) || dist < lineDistMap[lineId]) {
                  lineDistMap[lineId] = dist;
                }
                stationDists[stationId] = dist;
              }
            }
          }

          otherLineDists = Object.entries(lineDistMap).map(([id, dist]) => ({ id, dist }));

          if (otherLineDists.length >= minLinesNeeded) {
            break;
          }
        }
      }
    } else {
      // Otherwise iterate over all stations as previously
      const lineDistMap = {};
      for (const line of Object.values(lines)) {
        if (!onLinesSet.has(line.id) && linesDisplayedSet.has(line.id)) {
          let nearestDist = Number.MAX_SAFE_INTEGER;
          for (const stationId of line.stationIds) {
            const otherStation = stations[stationId];
            if (!otherStation) continue;

            const dist = getDistance(this.state.station, otherStation);
            if (dist < nearestDist) {
              nearestDist = dist;
            }
          }
          lineDistMap[line.id] = nearestDist;
        }
      }
      otherLineDists = Object.entries(lineDistMap).map(([id, dist]) => ({ id, dist }));
    }

    otherLineDists.sort((a, b) => { return a.dist > b.dist ? 1 : -1; });
    return otherLineDists;
  }

  renderButtons() {
    const onLineIds = (this.props.transfersByStationId?.[this.state.stationId]?.onLines ?? []).map(oL => (oL?.lineId ?? ''));
    const onLinesSet = new Set(onLineIds);

    const otherLineDists = this.getOtherLineDists(onLinesSet);

    let buttons = [];
    if (this.props.recent.lineKey && !onLinesSet.has(this.props.recent.lineKey)) {
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
      <button className="Shortcut-convert" key="converter" data-tooltip-content={currentlyIsWaypoint ? 'Convert to station' : 'Convert to waypoint'}
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
      <button className="Shortcut-delete" key="deleter" data-tooltip-content="Delete this station"
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
