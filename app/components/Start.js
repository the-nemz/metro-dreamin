import React from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

import { sortSystems, getNextSystemNumStr } from '/lib/util.js';
import { INITIAL_SYSTEM, INITIAL_META } from '/lib/constants.js';

export class Start extends React.Component {

  constructor(props) {
    super(props);
    this.startRef = React.createRef();
    this.state = {
      systemChoices: {}
    };
  }

  loadDefaultData() {
    if (this.props.database === null) {
      return;
    }

    const defaultSystemsCollection = collection(this.props.database, 'defaultSystems');
    const defaultSystemsQuery = query(defaultSystemsCollection, orderBy('title'));

    getDocs(defaultSystemsQuery)
      .then(async (systemsSnapshot) => {
        // TODO: consider adding loading icon
        for (const sDoc of systemsSnapshot.docs) {
          const sysDocData = sDoc.data();

          let lines = {};
          const linesSnap = await getDocs(collection(this.props.database, `defaultSystems/${sDoc.id}/lines`));
          linesSnap.forEach((lineDoc) => {
            const lineData = lineDoc.data();
            lines[lineData.id] = lineData;
          });

          let stations = {};
          const stationsSnap = await getDocs(collection(this.props.database, `defaultSystems/${sDoc.id}/stations`));
          stationsSnap.forEach((stationDoc) => {
            const stationData = stationDoc.data();
            stations[stationData.id] = stationData;
          });

          const defaultSystem = {
            map: {
              lines: lines,
              stations: stations,
              title: sysDocData.title
            },
            meta: sysDocData.meta,
            defaultId: sysDocData.defaultId
          };

          let sysChoices = this.state.systemChoices;
          sysChoices[sysDocData.defaultId] = defaultSystem;

          this.setState({
            systemChoices: sysChoices
          });
        }
      })
      .catch((error) => {
        console.log("Error getting documents: ", error);
      });
  }

  selectSystem(defaultId) {
    const meta = {
      ...this.state.systemChoices[defaultId].meta,
      systemNumStr: getNextSystemNumStr(this.props.settings)
    }

    this.props.onSelectSystem(this.state.systemChoices[defaultId].map, meta, [], [ `defaultSystems/${defaultId}` ]);

    ReactGA.event({
      category: 'Start',
      action: 'Select Default Map',
      value: defaultId
    });
  }

  renderDefaultChoices() {
    if (Object.keys(this.state.systemChoices).length) {
      let choices = [];
      for (const system of Object.values(this.state.systemChoices).sort(sortSystems)) {
        choices.push(
          <button className="Start-defaultChoice" key={system.defaultId}
                  onClick={() => this.selectSystem(system.defaultId)}>
            {system.map.title ? system.map.title : 'Unnamed System'}
          </button>
        );
      }
      return(
        <div className="Start-defaultChoices">
          {choices}
        </div>
      );
    }
    return '';
  }

  componentDidMount() {
    ReactTooltip.rebuild();
    this.loadDefaultData();

    let geocoder = new MapboxGeocoder({
      mapboxgl: mapboxgl,
      accessToken: mapboxgl.accessToken,
      placeholder: 'e.g. Berlin, Germany',
      types: 'place,district,region,country'
    })

    this.startRef.current.appendChild(geocoder.onAdd(this.props.map));

    geocoder.on('result', (result) => {
      if (result.result.place_name) {
        let system = INITIAL_SYSTEM;
        system.title = result.result.place_name;

        let meta = INITIAL_META;
        meta.systemNumStr = getNextSystemNumStr(this.props.settings);
        this.props.onSelectSystem(system, meta, result.result.bbox, []);

        ReactGA.event({
          category: 'Start',
          action: 'Select Custom Map'
        });
      }
    });
  }

  render() {
    return (
      <div className="Start FadeAnim">
        <div className="Start-upper">
          <div className="Start-heading">
            Start from a Preset City
          </div>
          {this.renderDefaultChoices()}
        </div>
        <div className="Start-lower" ref={this.startRef}>
          <div className="Start-heading">
            Search for a Different City
          </div>
        </div>
      </div>
    );
  }
}
