import React from 'react';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

import { sortSystems } from '../util.js';

export class Start extends React.Component {

  constructor(props) {
    super(props);
    this.startRef = React.createRef();
    this.state = {
      searchResult: '',
      geocoder: null,
      systemChoices: {}
    };
  }

  loadDefaultData() {
    if (this.props.database === null) {
      return;
    }
    let defaultDoc = this.props.database.doc('users/default');
    defaultDoc.get().then((doc) => {
      if (doc) {
        const data = doc.data();
        if (data && data.systemIds && data.systemIds.length) {
          for (const systemId of data.systemIds) {
            this.loadSystemData(systemId, 'default');
          }
        }
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });
  }

  loadSystemData(systemId, userId) {
    const systemOwner = userId ? userId : this.state.settings.userId;
    const docString = `users/${systemOwner}/systems/${systemId}`
    let systemDoc = this.props.database.doc(docString);
    systemDoc.get().then((doc) => {
      if (doc) {
        const data = doc.data();
        if (data && data.map) {
          let systemChoices = JSON.parse(JSON.stringify(this.state.systemChoices));
          systemChoices[systemId] = data
          this.setState({
            systemChoices: systemChoices
          });
        }
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });
  }

  selectSystem(id) {
    const systemChoices = JSON.parse(JSON.stringify(this.state.systemChoices));
    let meta = {
      systemId: this.props.nextSystemId,
      nextLineId: systemChoices[id].nextLineId,
      nextStationId: systemChoices[id].nextStationId
    }

    this.props.onSelectSystem(systemChoices[id].map, meta);

    ReactGA.event({
      category: 'Start',
      action: 'Select Default Map',
      value: parseInt(id)
    });
  }

  renderDefaultChoices() {
    if (Object.keys(this.state.systemChoices).length) {
      let choices = [];
      for (const system of Object.values(this.state.systemChoices).sort(sortSystems)) {
        choices.push(
          <button className="Start-defaultChoice" key={system.systemId}
                  onClick={() => this.selectSystem(system.systemId)}>
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

    if (!this.props.system.stations.length) {

      let geocoder = new MapboxGeocoder({
        mapboxgl: mapboxgl,
        accessToken: mapboxgl.accessToken,
        placeholder: 'e.g. Berlin, Germany',
        types: 'place,district,region,country'
      })

      this.startRef.current.appendChild(geocoder.onAdd(this.props.map));

      geocoder.on('result', (result) => {
        if (result.result.place_name) {
          this.props.onGetTitle(result.result.place_name, true);

          ReactGA.event({
            category: 'Start',
            action: 'Select Custom Map'
          });
        }

        this.setState({
          searchResult: result.result
        });
      });

      this.setState({
        geocoder: geocoder
      });
    }
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
