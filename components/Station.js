import React from 'react';
import osmtogeojson from 'osmtogeojson';
import ReactGA from 'react-ga4';
import { PieChart, Pie } from 'recharts';
import { point as turfPoint } from '@turf/helpers';
import turfArea from '@turf/area';
import turfDestination from '@turf/destination';
import turfIntersect from '@turf/intersect';

import { WALKING_PACE, FOCUS_ANIM_TIME, GEOSPATIAL_API_BASEURL } from '/util/constants.js';
import {
  displayLargeNumber,
  floatifyStationCoord,
  getDistance,
  getLineColorIconStyle,
  getLuminance,
  getMode,
  renderSpinner,
  sortLines
} from '/util/helpers.js';

import { GradeUpdate } from '/components/GradeUpdate.js';
import { InterchangeAdd } from '/components/InterchangeAdd.js';
import { Revenue } from '/components/Revenue.js';

export class Station extends React.Component {
  // TODO: when station that is focused is updated, the state of name and nameChanging should reset

  constructor(props) {
    super(props);
    this.state = {
      nameChanging: false,
      stationId: this.props.station.id,
      gettingData: false,
      gettingDensity: false,
      showInfo: false,
      openInterchangeAdd: false,
      openGradeUpdate: false,
      tempInfo: null,
      tempDensity: null
    };
  }

  handleNameChange(value) {
    this.setState({
      name: value,
      nameChanging: true
    });
  }

  handleNameBlur(value) {
    let newName = value.trim().substring(0, 100);
    if (newName && this.props.station.name !== newName) {
      this.props.onStationInfoChange(this.state.stationId, { name: newName });
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

    ReactGA.event({
      category: 'Station',
      action: 'Show Line'
    });
  }

  getDensity() {
    const station = floatifyStationCoord(this.props.station);

    if (!('lat' in station) || !('lng' in station)) return;

    const { lat, lng } = station;
    const r = 0.5;

    fetch(`${GEOSPATIAL_API_BASEURL}/density`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lat, lng, r })
    }).then(resp => resp.json())
      .then(respJson => {
        if (this.props.viewOnly) {
          this.setState({ tempDensity: respJson });
        } else {
          this.props.onStationInfoChange(station.id, { densityInfo: respJson },  true);
        }
        this.setState({
          gettingDensity: false
        });
      })
      .catch(e => console.warn('Error getting density:', e));

    this.setState({ gettingDensity: true });
  }

  getInfo() {
    const station = floatifyStationCoord(this.props.station);
    const point = turfPoint([ station.lng, station.lat ]);
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

      if (this.props.viewOnly) {
        this.setState({
          tempInfo: values[0],
          gettingData: false
        });
      } else {
        this.props.onStationInfoChange(station.id, { info: values[0] },  true);
        this.setState({
          gettingData: false
        });
      }
    })
    .catch((error) => {
      console.error('Error getting station info:', error);
      const info = { noData: true };
      this.props.onStationInfoChange(station.id, { info: info }, true);

      if (error.status !== 400) {
        // don't repeatedly send bad requests
        this.setState({
          gettingData: false
        });
      }
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
              try {
                const intersect = turfIntersect(park, bboxFeature);
                if (intersect) {
                  parklandInArea += turfArea({features: [intersect], type: 'FeatureCollection'});
                }
              } catch (e) {
                console.log('Error finding polygon parkland:');
                console.error(e);
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
                try {
                  const intersect = turfIntersect(piece, bboxFeature);
                  if (intersect) {
                    parklandInArea += turfArea({features: [intersect], type: 'FeatureCollection'});
                  }
                } catch (e) {
                  console.log('Error finding multipolygon parkland:');
                  console.error(e);
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

  renderOnLines(id) {
    let lineKeysIncluded = new Set();
    let prioritizedOnLines = [];
    for (const onLine of (this.props.transfersByStationId?.[id]?.onLines ?? [])) {
      if (!onLine?.lineId) continue;
      prioritizedOnLines.push({ line: this.props.lines[onLine.lineId],
                                isWaypointOverride: onLine.isWaypointOverride,
                                priority: onLine.isWaypointOverride ? 2 : 1 });
      lineKeysIncluded.add(onLine.lineId);
    }

    for (const hasLineKey of (this.props.interchangesByStationId[id]?.hasLines ?? [])) {
      if (!lineKeysIncluded.has(hasLineKey)) {
        prioritizedOnLines.push({ line: this.props.lines[hasLineKey], isWalkingConnection: true, priority: 3 });
      }
    }

    if (!prioritizedOnLines.length) {
      return <div className="Station-noLine">Not on any lines yet!</div>;
    }

    const groupsDisplayedSet = new Set(this.props.groupsDisplayed || []);
    const lineIdsDisplayed = Object.values(this.props.lines || {})
                                   .filter(line => !this.props.groupsDisplayed ||
                                                   groupsDisplayedSet.has(line.lineGroupId ?
                                                                          line.lineGroupId :
                                                                          getMode(line.mode).key))
                                   .map(l => l.id);
    const lineIdsDisplayedSet = new Set(lineIdsDisplayed);

    return prioritizedOnLines
            .sort((a, b) => {
              const aIsShown = a.line?.id && lineIdsDisplayedSet.has(a.line.id);
              const bIsShown = b.line?.id && lineIdsDisplayedSet.has(b.line.id);
              if (aIsShown && !bIsShown) {
                return -1;
              } else if (bIsShown && !aIsShown) {
                return 1;
              }

              if (a.priority === b.priority) {
                return sortLines(a.line, b.line);
              }

              return a.priority - b.priority;
            })
            .map(({ line, isWaypointOverride, isWalkingConnection }) => {
              const showColorIcon = !(this.props.station.isWaypoint || isWaypointOverride || isWalkingConnection);
              const colorIconStyles = getLineColorIconStyle(line);
              return <button className="Station-lineWrap" key={line.id} data-tooltip-content={`On ${line.name}`}
                             onClick={() => this.handleLineClick(line)}>
                <div className={`Station-linePrev Station-linePrev--${lineIdsDisplayedSet.has(line.id) ? 'shown' : 'hidden'}`}
                     // do not show line icon if waypoint or walking connection
                     style={!showColorIcon ? { backgroundColor: line.color } : colorIconStyles.parent}>
                  {showColorIcon && <div style={colorIconStyles.child}></div>}
                  {(this.props.station.isWaypoint || isWaypointOverride) && (
                    <div className="Station-indicator Station-indicator--waypoint"
                         data-lightcolor={getLuminance(line.color) > 128}
                         data-tooltip-content={`Is waypoint for ${line.name}`}>
                      <i className="fas fa-arrow-turn-up"></i>
                    </div>
                  )}
                  {isWalkingConnection && (
                    <div className="Station-indicator Station-indicator--walking"
                         data-lightcolor={getLuminance(line.color) > 128}
                         data-tooltip-content={`Interchange for ${line.name}`}>
                      <i className="fas fa-person-walking"></i>
                    </div>
                  )}
                </div>
              </button>
            });
  }

  renderInterchange(interchange) {
    const removeButton = !this.props.viewOnly && (
      <button className="Station-interchangeRemove" data-tooltip-content="Remove interchange"
              onClick={() => {
                this.props.onRemoveStationFromInterchange(interchange.station.id);
                ReactGA.event({
                  category: 'Edit',
                  action: 'Remove Station from Interchange'
                });
              }}>
        <i className="fas fa-minus-circle"></i>
      </button>
    );

    return (
      <li className="Station-interchange" key={interchange.station.id}>
        <button className="Station-interchangeButton"
                onClick={() => this.props.onStopClick(interchange.station.id)}>
          <i className="fas fa-person-walking"></i>
          <div className="Station-interchangeText">
            <span className="Station-interchangeName">
              {interchange.station.name}
            </span>
            <span className="Station-interchangeWalkTime">
              ({ Math.round(WALKING_PACE * interchange.distance) } min)
            </span>
          </div>
        </button>

        {removeButton}
      </li>
    );
  }

  renderInterchanges(id) {
    let interchangeButtons = [];

    if (id in (this.props.interchangesByStationId || {})) {
      let interchangeStations = [];
      for (const otherStationId of this.props.interchangesByStationId[id].stationIds) {
        const otherStation = this.props.stations[otherStationId];
        if (otherStation && otherStationId !== id) {
          interchangeStations.push({
            station: otherStation,
            distance: getDistance(this.props.station, otherStation)
          });
        }
      }

      for (const interchange of interchangeStations.sort((a, b) => a.distance - b.distance)) {
        interchangeButtons.push(this.renderInterchange(interchange));
      }
    }

    if (!this.props.viewOnly && !this.props.station.isWaypoint) {
      interchangeButtons.push(
        <li className="Station-interchange" key={'add'}>
          <button className="Station-interchangeButton Station-interchangeButton--add"
                  onClick={() => this.setState({ openInterchangeAdd: true })}>
            <i className="fas fa-person-walking"></i>
            <div className="Station-interchangeText">
              Add interchange
            </div>
          </button>
        </li>
      );
    }

    if (interchangeButtons.length) {
      return <ol className="Station-interchanges">
        {interchangeButtons}
      </ol>;
    }
  }

  renderGrade() {
    let gradeText;
    switch (this.props.station.grade) {
      case 'at':
        gradeText = 'At grade';
        break;
      case 'above':
        gradeText = 'Above grade';
        break;
      case 'below':
        gradeText = 'Below grade';
    }

    const icon = <i className="fas fa-elevator"></i>;

    if (this.props.viewOnly) {
      if (!gradeText) return;

      return (
        <div className="Station-grade">
          {icon}
          <div className="Station-gradeText">
            {gradeText}
          </div>
        </div>
      )
    } else {
      return (
        <button className="Station-grade Station-grade--button"
                onClick={() => this.setState({ openGradeUpdate: true })}>
          {icon}
          {gradeText || 'Select grade'}
        </button>
      )
    }
  }

  renderInterchangeModal() {
    if (this.props.viewOnly || this.props.station.isWaypoint) return;

    return (
      <InterchangeAdd station={this.props.station}
                      interchangesByStationId={this.props.interchangesByStationId}
                      transfersByStationId={this.props.transfersByStationId}
                      stations={this.props.stations} lines={this.props.lines}
                      open={this.state.openInterchangeAdd}
                      onAddInterchange={(otherStation) => {
                        this.setState({ openInterchangeAdd: false });
                        this.props.onCreateInterchange(this.props.station, otherStation);
                      }}
                      onClose={() => this.setState({ openInterchangeAdd: false })} />
    )
  }

  renderGradeModal() {
    if (this.props.viewOnly) return;

    return (
      <GradeUpdate station={this.props.station}
                   open={this.state.openGradeUpdate}
                   onStationsGradeChange={this.props.onStationsGradeChange}
                   onClose={() => this.setState({ openGradeUpdate: false })} />
    )
  }

  renderAddLines(sortedLinesToInclude) {
    let addLines = [];
    for (const line of sortedLinesToInclude) {
      const colorIconStyles = getLineColorIconStyle(line);
      addLines.push(
        <button className="Station-addButtonWrap" key={line.id} onClick={() => this.props.onAddToLine(line.id, this.props.station)}>
          <div className="Station-addButtonPrev" style={colorIconStyles.parent}>
            <div style={colorIconStyles.child}></div>
          </div>
          <div className="Station-addButton">
            Add to {line.name}
          </div>
        </button>
      );
    }
    return addLines;
  }

  renderAddLoops(sortedLinesToInclude) {
    let addLines = [];
    for (const line of sortedLinesToInclude) {
      const colorIconStyles = getLineColorIconStyle(line);
      const count = line.stationIds.reduce((n, stopId) => n + (stopId === this.props.station.id), 0);
      const invalidPositions = [1, line.stationIds.length - 2];
      const position = line.stationIds.indexOf(this.props.station.id);
      if (count === 1 && line.stationIds.length >= 3 && !invalidPositions.includes(position)) {
        addLines.push(
          <button className="Station-addButtonWrap" key={line.id} onClick={() => this.loopInLine(line.id, position)}>
            <div className="Station-addButtonPrev" style={colorIconStyles.parent}>
              <div style={colorIconStyles.child}></div>
            </div>
            <div className="Station-addButton">
              Make loop in {line.name}
            </div>
          </button>
        );
      }
    }
    return addLines;
  }

  renderConvertWaypoints(id) {
    const lines = Object.values(this.props.lines).sort(sortLines);
    let convertWaypoints = [];

    convertWaypoints.push((
      <button className="Station-convert Link" key={'all'}
              onClick={() => this.props.station.isWaypoint ?
                             this.props.onConvertToStation(this.props.station) :
                             this.props.onConvertToWaypoint(this.props.station)}>
        {this.props.station.isWaypoint ? 'Convert to station' : 'Convert to waypoint'}
      </button>
    ));

    if (!this.props.station.isWaypoint) {
      let lineKeysWithStation = [];
      for (const line of lines) {
        if (line.stationIds.includes(id)) lineKeysWithStation.push(line.id);
      }

      if (lineKeysWithStation.length > 1) {
        for (const lineKey of lineKeysWithStation) {
          const line = this.props.lines[lineKey];
          const isOverridden = (line.waypointOverrides || []).includes(id);
          convertWaypoints.push(
            <button className="Station-convert Station-convert--individual Link" key={line.id}
                    onClick={() => isOverridden ?
                                   this.props.onWaypointOverride(line.id, this.props.station, 'Remove') :
                                   this.props.onWaypointOverride(line.id, this.props.station, 'Add')}>
              {`Make ${isOverridden ? 'station' : 'waypoint'} for ${line.name} only`}
            </button>
          );
        }
      }
    }
    return convertWaypoints;
  }

  renderPie() {
    const info = this.props.station.info && !this.props.station.info.noData ? this.props.station.info : this.state.tempInfo;
    if (!info || info.noData) return;

    const colors = {
      'park': '#3cb44b',
      'residential': '#4363d8',
      'hotel': '#911eb4',
      'civic': '#ffe119',
      'industrial': '#9a6324',
      'commercial': '#e6194b',
      'other/unknown': '#a9a9a9'
    }
    let pieData = [];
    for (const typeKey of Object.keys(info.areaByUsage).sort()) {
      pieData.push({
        name: typeKey,
        value: info.areaByUsage[typeKey],
        fill: colors[typeKey]
      })
    }

    if (info.buildingArea) {
      return (
        <div className="Station-usageWrap">
          <div className="Station-usageHeading">
            Landuse around Station
          </div>
          <PieChart className="Station-usageChart" width={200} height={100}>
            <Pie data={pieData} startAngle={180} endAngle={0} dataKey="value" nameKey="name" cx="50%" cy="100%"
                 outerRadius={94} stroke={this.props.useLight ? '#000' : '#fff'} />
            {/* unable to use Legend due to this issue https://github.com/recharts/recharts/issues/1347 */}
          </PieChart>
          <ul className="Station-chartLegend">
            {pieData.map(pdEntry => (
              <li className={`Station-chartLegendEntry Station-chartLegendEntry--${pdEntry.fill.replace('#', '')}`}
                  key={pdEntry.name}>
                {pdEntry.name}
              </li>
            ))}
          </ul>
        </div>
      );
    }
  }

  renderInfo() {
    if (this.props.station.isWaypoint) return;

    const densityInfo = this.props.station.densityInfo || this.state.tempDensity;
    const info = this.props.station.info && !this.props.station.info.noData ? this.props.station.info : this.state.tempInfo;
    if (info && !info.noData) {
      let population;
      if ('population' in (densityInfo || {})) {
        population = (
          <div className="Station-fact Station-fact--population">
            Resident population: <span className="Station-factValue">{displayLargeNumber(densityInfo.population, 3)}</span>
            <i className="far fa-question-circle"
               data-tooltip-content="Resident population within walking distance">
            </i>
          </div>
        );
      }

      let employment;
      if ('employment' in (densityInfo || {})) {
        employment = (
          <div className="Station-fact Station-fact--population">
            Jobs/students/others: <span className="Station-factValue">{displayLargeNumber(densityInfo.employment, 3)}</span>
            <i className="far fa-question-circle"
               data-tooltip-content="Estimated jobs, students, recreational users, etc. within walking distance">
            </i>
          </div>
        );
      }

      let builtV;
      if ('builtV' in (densityInfo || {})) {
        builtV = (
          <div className="Station-fact Station-fact--builtV">
            Building volume: <span className="Station-factValue">{displayLargeNumber(densityInfo.builtV, 3)} m<sup>3</sup></span>
            <i className="far fa-question-circle"
               data-tooltip-content="Volume of buildings within walking distance">
            </i>
          </div>
        );
      }

      const densityScore = 'density' in (densityInfo || {}) && (
        <div className="Station-densityScore">
          <div className="Station-densityTitleWrap">
            <span className="Station-densityTitle">Density Score</span>
            <i className="far fa-question-circle"
              data-tooltip-content="Score based on nearby resident population and building volume">
            </i>
          </div>
          <div className="Station-densityScoreNum">
            {densityInfo.density}
          </div>
        </div>
      );

      return (
        <div className="Station-info">
          {this.renderPie()}
          {densityScore}

          <div className="Station-facts">
            {population}
            {employment}
            {builtV}
          </div>
        </div>
      );
    } else if (this.state.gettingData || this.state.gettingDensity) {
      return (
        <div className="Station-info Station-info--loading">
          {renderSpinner('Station-spinner')}
          <div className="Station-loadingText">
            Crunching the data...
          </div>
        </div>
      );
    }
  }

  renderOperations() {
    const groupsDisplayedSet = new Set(this.props.groupsDisplayed || []);
    const lines = Object.values(this.props.lines || {})
                        .filter(line => !this.props.groupsDisplayed ||
                                        groupsDisplayedSet.has(line.lineGroupId ?
                                                               line.lineGroupId :
                                                               getMode(line.mode).key))
                        .sort(sortLines);

    const addButtons = this.renderAddLines(lines.filter(line => !line.stationIds.includes(this.props.station.id)));
    const addLines = addButtons.length ? (
      <div className="Station-addButtons">
        {addButtons}
      </div>
    ) : null;

    const loopButtons = this.renderAddLoops(lines);
    const addLoops = loopButtons.length ? (
      <div className="Station-addButtons">
        {loopButtons}
      </div>
    ) : null;

    const convertWaypoints = (
      <div className="Station-convertWaypoints">
        {this.renderConvertWaypoints(this.props.station.id)}
      </div>
    );

    const deleteWrap = (
      <div className="Station-deleteWrap">
        <button className="Station-delete Link" onClick={() => this.props.onDeleteStation(this.props.station)}>
          Delete this station
        </button>
      </div>
    );

    return (
      <div className="Station-operations">
        {!this.props.viewOnly && addLines}
        {!this.props.viewOnly && addLoops}
        {!this.props.viewOnly && convertWaypoints}
        {!this.props.viewOnly && deleteWrap}
      </div>
    );
  }

  componentDidMount() {
    if (!this.state.gettingData && !this.props.station.isWaypoint) {
      if (!this.props.station.info || this.props.station.info.noData) {
        this.getInfo();
      }
    }

    if (!this.state.gettingDensity && !this.props.station.isWaypoint) {
      if (!this.props.station.densityInfo && !this.state.tempDensity) {
        this.getDensity();
      }
    }

    if (this.state.showInfo && this.props.station.isWaypoint) {
      this.setState({
        showInfo: false
      });
    }

    setTimeout(() => {
      this.setState({
        transitionDone: true
      });
    }, this.props.entranceAnimation ? FOCUS_ANIM_TIME : 0);
  }

  componentDidUpdate() {
    if (!this.state.gettingData && !this.props.station.isWaypoint) {
      if (!this.props.station.info || this.props.station.info.noData) {
        this.getInfo();
      }
    }

    if (!this.state.gettingDensity && !this.props.station.isWaypoint) {
      if (!this.props.station.densityInfo && !this.state.tempDensity) {
        this.getDensity();
      }
    }

    if (this.state.showInfo && this.props.station.isWaypoint) {
      this.setState({
        showInfo: false
      });
    }

    if (this.props.station.id && this.state.stationId !== this.props.station.id) {
      this.setState({
        stationId: this.props.station.id,
        name: '',
        nameChanging: false,
        tempInfo: null,
        tempDensity: null
      });
    }
  }

  render() {
    const title = this.props.station.isWaypoint ? 'Waypoint' : (this.state.nameChanging ? this.state.name : this.props.station.name);

    const infoButton = (
      <button className="Station-infoButton" data-tooltip-content={this.state.showInfo ? 'Hide station statistics' : 'Show station statistics'}
              onClick={() => this.handleShowInfoToggle()}>
        <i className={this.state.showInfo ? 'fas fa-arrow-left fa-fw' : 'fas fa-chart-column'}></i>
      </button>
    );

    const nameElem = this.props.viewOnly || this.props.station.isWaypoint ? (
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
      this.renderOperations()
    );

    const topClass = 'Station FocusAnim ' + (this.props.viewOnly ? 'Focus Focus--viewOnly': 'Focus');
    return (
      <div className={topClass}>
        <button className="Station-close"
                onClick={() => this.props.onFocusClose()}>
          <i className="fas fa-times-circle"></i>
        </button>

        <div className="Station-nameWrap">
          {!this.props.viewOnly && !this.props.station.isWaypoint ? infoButton : ''}
          {nameElem}
        </div>

        <div className={`Station-content${this.props.station.isWaypoint ? ' Station-content--waypoint' : ''} Focus-content`}>
          <div className="Station-lines">
            {this.renderOnLines(this.props.station.id)}
          </div>

          {this.renderGrade()}
          {this.renderInterchanges(this.props.station.id)}

          {this.props.isMobile && this.state.transitionDone && <Revenue unitName='focusStationMobile' mutationSelector='.FocusAnim' />}
          {!this.props.isMobile && this.state.transitionDone && <Revenue unitName='focusStationDesktop' mutationSelector='.FocusAnim' />}

          {lowerContent}
        </div>

        {this.renderGradeModal()}
        {this.renderInterchangeModal()}
      </div>
    );
  }
}
