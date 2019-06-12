import React from 'react';
import ReactTooltip from 'react-tooltip';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

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
    // if (this.state.queryParams && this.state.queryParams.writeDefault && (new URI()).hostname() === 'localhost') {
    //   // writeDefault should be the name of the file without extension
    //   // Put the file in src/
    //   // Used for building default systems
    //   const defSystem = require(`./${this.state.queryParams.writeDefault}.json`);
    //   let meta = {
    //     systemId: defSystem.systemId,
    //     nextLineId: defSystem.nextLineId,
    //     nextStationId: defSystem.nextStationId
    //   }

    //   if (defSystem.map && defSystem.map.title) {
    //     document.querySelector('head title').innerHTML = 'Metro Dreamin\' | ' + defSystem.map.title;
    //   }

    //   this.setState({
    //     history: [defSystem.map],
    //     meta: meta,
    //     gotData: true
    //   });
    // } else {
      const systemChoices = JSON.parse(JSON.stringify(this.state.systemChoices));
      let meta = {
        systemId: this.props.nextSystemId,
        nextLineId: systemChoices[id].nextLineId,
        nextStationId: systemChoices[id].nextStationId
      }

      this.props.onSelectSystem(systemChoices[id].map, meta);
    // }
  }

  renderDefaultChoices() {
    const sorter = (a, b) => {
      return a.map.title.toLowerCase() > b.map.title.toLowerCase() ? 1 : -1;
    }

    if (Object.keys(this.state.systemChoices).length) {
      let choices = [];
      for (const system of Object.values(this.state.systemChoices).sort(sorter)) {
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
        accessToken: mapboxgl.accessToken,
        placeholder: 'e.g. Paris, France',
        types: 'place,district,region,country'
      })

      this.startRef.current.appendChild(geocoder.onAdd(this.props.map));

      geocoder.on('result', (result) => {
        if (result.result.place_name) {
          this.props.onGetTitle(result.result.place_name);
        }

        this.setState({
          searchResult: result.result,
          geocoder: geocoder
        });
      });
    }
  }

  componentDidUpdate() {
    ReactTooltip.rebuild();
    if (this.state.searchResult && this.state.geocoder) {
      this.props.map.removeControl(this.state.geocoder);

      this.setState({
        geocoder: null
      });
    }
  }

  render() {
    return (
      <div className="Start">
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
