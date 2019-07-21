import React from 'react';
import osmtogeojson from 'osmtogeojson';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';
import { PieChart, Pie, Legend } from 'recharts';

import { point as turfPoint } from '@turf/helpers';
import turfArea from '@turf/area';
import turfDestination from '@turf/destination';
import turfIntersect from '@turf/intersect';

import { sortLines, getDistance } from '../util.js';
import loading from '../../assets/loading.gif';

export class Station extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      nameChanging: false,
      collapsed: false,
      stationId: null,
      gettingData: false,
      showInfo: false
    };
  }

  handleExCol() {
    this.setState({
      collapsed: this.state.collapsed ? false : true
    });

    ReactGA.event({
      category: 'Station',
      action: 'Expand/Collapse'
    });
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
      station.name = value.trim();
      this.props.onStationInfoChange(station);
    }
    this.setState({
      name: '',
      nameChanging: false
    });
  }

  handleShowInfoToggle() {
    this.setState({
      showInfo: this.state.showInfo ? false : true
    });

    ReactGA.event({
      category: 'Station',
      action: 'Toggle Show Info'
    });
  }

  handleLineClick(line) {
    this.props.onLineClick(line);
    this.setState({
      name: '',
      nameChanging: false
    });
  }

  getInfo() {
    const point = turfPoint([this.props.station.lng, this.props.station.lat]);
    const distance = 0.25;
    const options = {units: 'miles'};
    const bearingMap = {
      'north': 0,
      'east': 90,
      'south': 180,
      'west': -90
    }

    let bounds = {};
    for (const cardinal in bearingMap) {
      bounds[cardinal] = turfDestination(point, distance, bearingMap[cardinal], options);
    }
    const bbox = `${bounds.south.geometry.coordinates[1]},${bounds.west.geometry.coordinates[0]},${bounds.north.geometry.coordinates[1]},${bounds.east.geometry.coordinates[0]}`;
    const bboxFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [bounds.west.geometry.coordinates[0], bounds.south.geometry.coordinates[1]],
            [bounds.west.geometry.coordinates[0], bounds.north.geometry.coordinates[1]],
            [bounds.east.geometry.coordinates[0], bounds.north.geometry.coordinates[1]],
            [bounds.east.geometry.coordinates[0], bounds.south.geometry.coordinates[1]],
            [bounds.west.geometry.coordinates[0], bounds.south.geometry.coordinates[1]]
          ]
        ]
      }
    }

    const buildingQuery = `https://overpass-api.de/api/interpreter?data=[out:json];(node[building](${bbox});way[building](${bbox});relation[building](${bbox}););out;>;out skel;`;
    let buildingPromise = this.fetchAndHandleBuildings(encodeURI(buildingQuery));

    const parkQuery = `https://overpass-api.de/api/interpreter?data=[out:json];(node[leisure=park](${bbox});way[leisure=park](${bbox});relation[leisure=park](${bbox}););out;>;out skel;`;
    let parkPromise = this.fetchAndHandleParks(encodeURI(parkQuery), bboxFeature);

    let station = this.props.station;
    Promise.all([buildingPromise, parkPromise])
    .then((values) => {
      if (values[0].areaByUsage) {
        values[0].areaByUsage.park = values[1].parklandInArea || 0
      }
      const level = values[0].weightedLevel || 2;
      const coverPercent = 100 * values[0].buildingArea / 647497;
      const parkBonus = Math.min(values[0].areaByUsage.park / 2000, 50);
      const score = ((level + 1) * coverPercent) + (values[0].numNearbyBuildings / 20) + parkBonus;
      values[0].densityScore = Math.round(score);

      station.info = values[0];
      this.props.onStationInfoChange(station, true);
      this.setState({
        gettingData: false
      });
    })
    .catch((error) => {
      console.error('Error getting station info:', error);
      station.info = {noData: true};
      this.props.onStationInfoChange(station, true);
      this.setState({
        gettingData: false
      });
    });

    this.setState({
      gettingData: true
    });
  }

  fetchAndHandleBuildings(encodedQuery) {
    return new Promise((resolve, reject) => {
      let req = new XMLHttpRequest();

      req.onload = () => {
        if (req.status !== 200) {
          reject({
            status: req.status,
            statusText: req.statusText
          });
          return;
        }

        const resp = JSON.parse(req.response);
        let info = {};
        if (resp && resp.elements) {
          const geojson = osmtogeojson(resp);
          const buildingSurfaceArea = turfArea(geojson);
          const typeMap = {
            apartments: 'residential',
            house: 'residential',
            detached: 'residential',
            residemtial: 'residential',
            dormitory: 'residential',
            houseboat: 'residential',
            bungalow: 'residential',
            static_caravan: 'residential',

            hotel: 'hotel',

            commercial: 'commercial',
            office: 'commercial',
            retail: 'commercial',
            supermarket: 'commercial',
            kiosk: 'commercial',

            industrial: 'industrial',
            warehouse: 'industrial',
            service: 'industrial',
            shed: 'industrial',
            factory: 'industrial',

            civic: 'civic',
            college: 'civic',
            government: 'civic',
            hospital: 'civic',
            school: 'civic',
            stadium: 'civic',
            train_station: 'civic',
            transportation: 'civic',
            university: 'civic',
            public: 'civic'
          };
          const levelMap = { // in meters
            residential: 3.048,
            hotel: 3.048,
            commercial: 3.6576,
            industrial: 3.6576,
            civic: 3.3528,
            'other/unknown': 3.3528
          };
          let usageMap = {
            residential: [],
            hotel: [],
            commercial: [],
            industrial: [],
            civic: [],
            'other/unknown': []
          };
          let levelPairs = [];
          let featuresWithLevels = [];
          for (const feature of geojson.features || []) {
            let typeKey = typeMap[feature.properties.building] || 'other/unknown';
            if (feature.properties.tourism && ['hotel', 'motel', 'hostel'].includes(feature.properties.tourism)) {
              typeKey = 'hotel';
            }
            if (feature.properties['building:levels']) {
              levelPairs.push([feature, feature.properties['building:levels']]);
              featuresWithLevels.push(feature);
            } else if (feature.properties['building:height']) {
              const estimatedLevels = feature.properties['building:height'] / levelMap[typeKey];
              levelPairs.push([feature, Math.floor(estimatedLevels)]);
              featuresWithLevels.push(feature);
            }
            usageMap[typeKey].push(feature);
          }
          let areaWithLevels = turfArea({features: featuresWithLevels, type: 'FeatureCollection'});
          const areaByUsage = {
            residential: turfArea({features: usageMap.residential, type: 'FeatureCollection'}),
            hotel: turfArea({features: usageMap.hotel, type: 'FeatureCollection'}),
            commercial: turfArea({features: usageMap.commercial, type: 'FeatureCollection'}),
            industrial: turfArea({features: usageMap.industrial, type: 'FeatureCollection'}),
            civic: turfArea({features: usageMap.civic, type: 'FeatureCollection'}),
            'other/unknown': turfArea({features: usageMap['other/unknown'], type: 'FeatureCollection'})
          };
          info.numNearbyBuildings = geojson && geojson.features ? geojson.features.length : 0;
          info.buildingArea = buildingSurfaceArea ? buildingSurfaceArea : 0;
          info.areaByUsage = areaByUsage;
          if (areaWithLevels / buildingSurfaceArea > 0.3 ||
              featuresWithLevels.length / geojson.features.length > 0.2) {
            info.weightedLevel = this.getWeightedLevel(levelPairs);
          }
        }

        resolve(info);
      };

      req.onerror = function () {
        reject({
          status: req.status,
          statusText: req.statusText
        });
      };

      req.open('GET', encodedQuery);
      req.send();
    });
  }

  fetchAndHandleParks(encodedQuery, bboxFeature) {
    return new Promise((resolve, reject) => {
      let req = new XMLHttpRequest();
      req.onload = () => {
        if (req.status !== 200) {
          reject({
            status: req.status,
            statusText: req.statusText
          });
          return;
        }

        const resp = JSON.parse(req.response);
        if (resp && resp.elements) {
          const geojson = osmtogeojson(resp);

          let parklandInArea = 0;
          for (const park of geojson.features || []) {
            if (park.geometry.type === 'Polygon') {
              const intersect = turfIntersect(park, bboxFeature);
              if (intersect) {
                parklandInArea += turfArea({features: [intersect], type: 'FeatureCollection'});
              }
            } else if (park.geometry.type === 'MultiPolygon') {
              for (const coords of park.geometry.coordinates) {
                const piece = {
                  type: 'Feature',
                  geometry: {
                    type: 'Polygon',
                    coordinates: coords
                  }
                }
                const intersect = turfIntersect(piece, bboxFeature);
                if (intersect) {
                  parklandInArea += turfArea({features: [intersect], type: 'FeatureCollection'});
                }
              }
            }
          }

          resolve({'parklandInArea': parklandInArea, 'totalParksNearby': turfArea(geojson)});
        }
      };

      req.onerror = function () {
        reject({
          status: req.status,
          statusText: req.statusText
        });
      };

      req.open('GET', encodedQuery);
      req.send();
    });
  }

  getWeightedLevel(levelPairs) {
    let weightedLevel = 0;
    let areaValid = 0;
    for (const pair of levelPairs) {
      const level = parseFloat(pair[1]);
      if (level) {
        const featArea = turfArea({features: [pair[0]], type: 'FeatureCollection'});
        weightedLevel += level * featArea;
        areaValid += featArea;
      }
    }
    return Math.round(weightedLevel / areaValid);
  }

  addToLine(lineKey) {
    this.props.onAddToLine(lineKey, this.props.station, this.getNearestIndex(lineKey));
  }

  loopInLine(lineKey, position) {
    const line = this.props.lines[lineKey];
    if (position === 0) {
      this.props.onAddToLine(lineKey, this.props.station, line.stationIds.length);
    } else if (position === line.stationIds.length - 1) {
      this.props.onAddToLine(lineKey, this.props.station, 0);
    } else {
      const startDist = getDistance(this.props.station, this.props.stations[line.stationIds[0]]);
      const endDist = getDistance(this.props.station, this.props.stations[line.stationIds[line.stationIds.length - 1]]);
      this.props.onAddToLine(lineKey, this.props.station, startDist < endDist ? 0 : line.stationIds.length);
    }
  }

  getNearestIndex(lineKey) {
    const line = this.props.lines[lineKey];

    if (line.stationIds.length === 0 || line.stationIds.length === 1) {
      return 0;
    }

    let nearestIndex = 0;
    let nearestId;
    let nearestDist = Number.MAX_SAFE_INTEGER;
    for (const [i, stationId] of line.stationIds.entries()) {
      let dist = getDistance(this.props.station, this.props.stations[stationId]);
      if (dist < nearestDist) {
        nearestIndex = i;
        nearestId = stationId;
        nearestDist = dist;
      }
    }

    if (nearestIndex !== 0 && line.stationIds[0] === nearestId) {
      // If nearest is loop point at start
      return 0;
    } else if (nearestIndex !== line.stationIds.length - 1 &&
               line.stationIds[line.stationIds.length - 1] === nearestId) {
      // If nearest is loop point at end
      return line.stationIds.length;
    }

    if (nearestIndex === 0) {
      const nearStation = this.props.stations[line.stationIds[nearestIndex]];
      const nextStation = this.props.stations[line.stationIds[nearestIndex + 1]];
      const otherDist = getDistance(nearStation, nextStation);
      const nextDist = getDistance(this.props.station, nextStation);
      if (nextDist > otherDist) {
        return 0;
      }
      return 1;
    } else if (nearestIndex === line.stationIds.length - 1) {
      const nearStation = this.props.stations[line.stationIds[nearestIndex]];
      const nextStation = this.props.stations[line.stationIds[nearestIndex - 1]];
      const otherDist = getDistance(nearStation, nextStation);
      const nextDist = getDistance(this.props.station, nextStation);
      if (nextDist > otherDist) {
        return line.stationIds.length;
      }
      return line.stationIds.length - 1;
    } else {
      const prevStation = this.props.stations[line.stationIds[nearestIndex - 1]];
      const nextStation = this.props.stations[line.stationIds[nearestIndex + 1]];
      const prevDist = getDistance(this.props.station, prevStation);
      const nextDist = getDistance(this.props.station, nextStation);
      const nearToPrevDist = getDistance(this.props.stations[line.stationIds[nearestIndex]], prevStation);
      const nearToNextDist = getDistance(this.props.stations[line.stationIds[nearestIndex]], nextStation);
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
    const lines = Object.values(this.props.lines).sort(sortLines);
    let isOnLines = [];
    for (const line of lines) {
      if (line.stationIds.includes(id)) {
        isOnLines.push(
          <button className="Station-lineWrap" key={line.id} data-tip={`Show ${line.name}`}
                  onClick={() => this.handleLineClick(line)}>
            <div className="Station-linePrev" style={{backgroundColor: line.color}}></div>
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
    let lines = Object.values(this.props.lines).filter(l => !l.stationIds.includes(id));
    let addLines = [];
    for (const line of lines.sort(sortLines)) {
      addLines.push(
        <button className="Station-addButtonWrap Link" key={line.id} onClick={() => this.addToLine(line.id)}>
          <div className="Station-addButtonPrev" style={{backgroundColor: line.color}}></div>
          <div className="Station-addButton">
            Add to {line.name}
          </div>
        </button>
      );
    }
    return addLines;
  }

  renderAddLoops(id) {
    const lines = Object.values(this.props.lines).sort(sortLines);
    let addLines = [];
    for (const line of lines) {
      const count = line.stationIds.reduce((n, stopId) => n + (stopId === id), 0);
      const invalidPositions = [1, line.stationIds.length - 2];
      const position = line.stationIds.indexOf(id);
      if (count === 1 && !invalidPositions.includes(position)) {
        addLines.push(
          <button className="Station-addButtonWrap Link" key={line.id} onClick={() => this.loopInLine(line.id, position)}>
            <div className="Station-addButtonPrev" style={{backgroundColor: line.color}}></div>
            <div className="Station-addButton">
              Make loop in {line.name}
            </div>
          </button>
        );
      }
    }
    return addLines;
  }

  renderInfo() {
    if (this.props.station.info && !this.props.station.info.noData) {
      let numBuildings;
      if (this.props.station.info.numNearbyBuildings === 0 || this.props.station.info.numNearbyBuildings) {
        numBuildings = (
          <div className="Station-fact Station-fact--numBuildings">
            Number of buildings: <span className="Station-factValue">{this.props.station.info.numNearbyBuildings}</span>
            <i className="far fa-question-circle"
               data-tip="Number of individual buildings near the station">
            </i>
          </div>
        );
      }

      let percentBuilt;
      if (this.props.station.info.buildingArea === 0 || this.props.station.info.buildingArea) {
        // 647497 is the number of square meters in a 1/4 square mile
        percentBuilt = (
          <div className="Station-fact Station-fact--buildingArea">
            Land area with buildings: <span className="Station-factValue">{Math.round(1000 * this.props.station.info.buildingArea / 647497) / 10}%</span>
            <i className="far fa-question-circle"
               data-tip="Percent of nearby land improved with buildings">
            </i>
          </div>
        );
      }

      let weightedLevel = (
        <div className="Station-fact Station-fact--weightedLevel">
          Average building levels: <span className="Station-factValue">{this.props.station.info.weightedLevel || 'unknown'}</span>
          <i className="far fa-question-circle"
              data-tip="Weighted avereage of known or estimated levels/stories of nearby buildings">
          </i>
        </div>
      );

      let densityScore;
      if (this.props.station.info.densityScore === 0 || this.props.station.info.densityScore) {
        densityScore = (
          <div className="Station-densityScore">
            <div className="Station-densityTitleWrap">
              <span className="Station-densityTitle">Density Score</span>
              <i className="far fa-question-circle"
                data-tip="Score based on building number and coverage, floor area, and nearby parks">
              </i>
            </div>
            <div className="Station-densityScoreNum">
              {this.props.station.info.densityScore}
            </div>
          </div>
        );
      }

      const colors = {
        'park': '#3cb44b',
        'residential': '#4363d8',
        'hotel': '#911eb4',
        'civic': '#ffe119',
        'industrial': '#9A6324',
        'commercial': '#e6194b',
        'other/unknown': '#a9a9a9'
      }
      let pieData = [];
      for (const typeKey in this.props.station.info.areaByUsage) {
        pieData.push({
          name: typeKey,
          value: this.props.station.info.areaByUsage[typeKey],
          fill: colors[typeKey]
        })
      }
      let usage;
      if (this.props.station.info.buildingArea) {
        usage = (
          <div className="Station-usageWrap">
            <div className="Station-usageHeading">
              Landuse around Station
            </div>
            <PieChart className="Station-usageChart" width={200} height={180}>
              <Pie data={pieData} startAngle={180} endAngle={0} dataKey="value" nameKey="name" cx="50%" cy="100%" outerRadius={94} fill={'#ff0000'} />
              <Legend verticalAlign="bottom" iconType="circle" />
            </PieChart>
          </div>
        );
      }

      return (
        <div className="Station-info">
          {usage || ''}
          {densityScore || ''}

          <div className="Station-facts">
            {percentBuilt || ''}
            {weightedLevel || ''}
            {numBuildings || ''}
          </div>
        </div>
      );
    } else if (this.state.gettingData) {
      return (
        <div className="Station-info Station-info--loading">
          <img className="State-loadingIcon" src={loading} alt="Loading Spinner" />
          <div className="Station-loadingText">
            Crunching the data...
          </div>
        </div>
      );
    }
  }

  componentDidMount() {
    ReactTooltip.rebuild();
    if (!this.state.gettingData) {
      if (!this.props.station.info || this.props.station.info.noData) {
        this.getInfo();
      }
    }
  }

  componentDidUpdate() {
    ReactTooltip.rebuild();
    if (!this.state.gettingData) {
      if (!this.props.station.info || this.props.station.info.noData) {
        this.getInfo();
      }
    }
  }

  componentWillUnmount() {
    ReactTooltip.hide();
  }

  render() {
    const title = this.state.nameChanging ? this.state.name : this.props.station.name;
    const addLines = (
      <div className="Station-addButtons">
        {this.renderAddLines(this.props.station.id)}
      </div>
    );
    const addLoops = (
      <div className="Station-addButtons">
        {this.renderAddLoops(this.props.station.id)}
      </div>
    );
    const deleteWrap = (
      <div className="Station-deleteWrap">
        <button className="Station-delete Link" onClick={() => this.props.onDeleteStation(this.props.station)}>
          Delete this station
        </button>
      </div>
    );
    const infoButton = (
      <button className="Station-infoButton" data-tip={this.state.showInfo ? 'Hide station statistics' : 'Show station statistics'}
              onClick={() => this.handleShowInfoToggle()}>
        <i className={this.state.showInfo ? 'fas fa-arrow-left fa-fw' : 'fas fa-chart-bar'}></i>
      </button>
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
    const lowerContent = this.state.showInfo || this.props.viewOnly ? (
      this.renderInfo(this.props.station.id)
    ) : (
      <div className="Station-operations">
        {this.props.viewOnly ? '' : addLines}
        {this.props.viewOnly ? '' : addLoops}
        {this.props.viewOnly ? '' : deleteWrap}
      </div>
    );

    const topClass = 'Station FocusAnim ' + (this.props.viewOnly ? 'Focus Focus--viewOnly': 'Focus');
    return (
      <div className={topClass}>
        <button className="Station-close" data-tip="Close station view"
                onClick={() => this.props.onFocusClose()}>
          <i className="fas fa-times-circle"></i>
        </button>

        <div className="Station-nameWrap">
          {!this.props.viewOnly ? infoButton : ''}
          {nameElem}
        </div>

        <button className={`Station-exCol Station-exCol--${this.state.collapsed ? 'collapsed' : 'expanded'}`}
                onClick={() => this.handleExCol()}>
          <span className="Station-exColText">
            {this.state.collapsed ? 'Show Details' : 'Hide Details'}
          </span>
          <i className="fas fa-chevron-down"></i>
        </button>

        <div className={`Station-content Station-content--${this.state.collapsed ? 'collapsed' : 'expanded'}`}>
          <div className="Station-lines">
            {this.renderOnLines(this.props.station.id)}
          </div>
          {lowerContent}
        </div>
      </div>
    );
  }
}
