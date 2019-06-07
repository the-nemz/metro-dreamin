import React from 'react';
import * as turf from '@turf/turf';
import osmtogeojson from 'osmtogeojson';
import ReactTooltip from 'react-tooltip';
import { PieChart, Pie, Legend } from 'recharts';

export class Station extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      nameChanging: false,
      collapsed: false,
      stationId: null,
      gettingData: false
    };
  }

  handleExCol() {
    this.setState({
      collapsed: this.state.collapsed ? false : true
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

  handleLineClick(line) {
    this.props.onLineClick(line);
    this.setState({
      name: '',
      nameChanging: false
    });
  }

  getInfo() {
    const point = turf.point([this.props.station.lng, this.props.station.lat]);
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
      bounds[cardinal] = turf.destination(point, distance, bearingMap[cardinal], options);
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

    const buildingQuery = `http://overpass-api.de/api/interpreter?data=[out:json];(node[building](${bbox});way[building](${bbox});relation[building](${bbox}););out;>;out skel;`;
    let buildingPromise = this.fetchAndHandleBuildings(encodeURI(buildingQuery));

    const parkQuery = `http://overpass-api.de/api/interpreter?data=[out:json];(node[leisure=park](${bbox});way[leisure=park](${bbox});relation[leisure=park](${bbox}););out;>;out skel;`;
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
      const score = (level * coverPercent) + (coverPercent / 2) + (values[0].numNearbyBuildings / 10) + parkBonus;
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
          const buildingSurfaceArea = turf.area(geojson);
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
          let areaWithLevels = turf.area({features: featuresWithLevels, type: 'FeatureCollection'});
          const areaByUsage = {
            residential: turf.area({features: usageMap.residential, type: 'FeatureCollection'}),
            hotel: turf.area({features: usageMap.hotel, type: 'FeatureCollection'}),
            commercial: turf.area({features: usageMap.commercial, type: 'FeatureCollection'}),
            industrial: turf.area({features: usageMap.industrial, type: 'FeatureCollection'}),
            civic: turf.area({features: usageMap.civic, type: 'FeatureCollection'}),
            'other/unknown': turf.area({features: usageMap['other/unknown'], type: 'FeatureCollection'})
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
              const intersect = turf.intersect(park, bboxFeature);
              if (intersect) {
                parklandInArea += turf.area({features: [intersect], type: 'FeatureCollection'});
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
                const intersect = turf.intersect(piece, bboxFeature);
                if (intersect) {
                  parklandInArea += turf.area({features: [intersect], type: 'FeatureCollection'});
                }
              }
            }
          }

          resolve({'parklandInArea': parklandInArea, 'totalParksNearby': turf.area(geojson)});
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
        const featArea = turf.area({features: [pair[0]], type: 'FeatureCollection'});
        weightedLevel += level * featArea;
        areaValid += featArea;
      }
    }
    return Math.round(weightedLevel / areaValid);
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
          <button className="Station-lineWrap" key={lineKey} data-tip={`Show ${lines[lineKey].name}`}
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

  renderInfo() {
    if (this.props.station.info && !this.props.station.info.noData) {
      let numBuildings;
      if (this.props.station.info.numNearbyBuildings === 0 || this.props.station.info.numNearbyBuildings) {
        numBuildings = (
          <div className="Station-fact Station-fact--numBuildings">
            Number of buildings: {this.props.station.info.numNearbyBuildings}
            <i className="far fa-question-circle"
               data-tip="Number of individual buildings near the station">
            </i>
          </div>
        );
      }

      let percentBuilt;
      if (this.props.station.info.buildingArea === 0 || this.props.station.info.numNearbyBuildings) {
        // 647497 is the number of square meters in a 1/4 square mile
        percentBuilt = (
          <div className="Station-fact Station-fact--buildingArea">
            Land area with buildings: {Math.round(1000 * this.props.station.info.buildingArea / 647497) / 10}%
            <i className="far fa-question-circle"
               data-tip="Percent of nearby land improved with buildings">
            </i>
          </div>
        );
      }

      let weightedLevel;
      if (this.props.station.info.weightedLevel) {
        weightedLevel = (
          <div className="Station-fact Station-fact--weightedLevel">
            Average of building levels: {this.props.station.info.weightedLevel}
            <i className="far fa-question-circle"
               data-tip="Weighted avereage of known or estimated levels/stories of nearby buildings">
            </i>
          </div>
        );
      }

      let densityScore;
      if (this.props.station.info.densityScore) {
        densityScore = (
          <div className="Station-fact Station-fact--weightedLevel">
            Station density score: {this.props.station.info.densityScore}
            <i className="far fa-question-circle"
               data-tip="Score based on building number and coverage, floor area, and nearby parks">
            </i>
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
      return (
        <div className="Station-info">
          <div className="Station-infoHeading">
            Around this station:
          </div>
          {numBuildings || ''}
          {percentBuilt || ''}
          {weightedLevel || ''}
          {densityScore || ''}

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
  }

  componentDidMount() {
    ReactTooltip.rebuild();
    if (!this.props.station.info && !this.state.gettingData) {
      this.getInfo();
    }
  }

  componentDidUpdate() {
    ReactTooltip.rebuild();
    if (!this.props.station.info && !this.state.gettingData) {
      this.getInfo();
    }
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
        <button className="Station-close" data-tip="Close station view"
                onClick={() => this.props.onFocusClose()}>
          <i className="fas fa-times-circle"></i>
        </button>

        <div className="Station-nameWrap">
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
          {this.renderInfo(this.props.station.id)}
          {this.props.viewOnly ? '' : addLines}
          {this.props.viewOnly ? '' : deleteWrap}
        </div>
      </div>
    );
  }
}
