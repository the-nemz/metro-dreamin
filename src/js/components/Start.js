import React from 'react';
import ReactTooltip from 'react-tooltip';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

export class Start extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      searchResult: '',
      geocoder: null,
      systemChoices: []
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

          // let start = document.querySelector('.Start');
          // let geoElem = document.querySelector('.mapboxgl-ctrl-geocoder');
          // geoElem.dataset.removed = true;
          // start.style.display = 'none';
          // geoElem.style.display = 'none';

          // if (getChoices) {
            for (const systemId of data.systemIds) {
              this.loadSystemData(systemId);
            }
          // }

          // let settings = JSON.parse(JSON.stringify(this.state.settings));
          // settings.displayName = data.displayName;

          // this.setState({
          //   settings: settings
          // });
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

          // if (autoSelect) {
          //   this.selectSystem(systemId);
          // }
        }
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });
  }

  renderSystemChoices() {
    if (Object.keys(this.state.systemChoices).length) {
      let choices = [];
      for (const id in this.state.systemChoices) {
        choices.push(
          <button className="Start-defaultChoice" key={id}
                  onClick={() => this.selectSystem(id)}>
            {this.state.systemChoices[id].map.title ? this.state.systemChoices[id].map.title : 'Unnamed System'}
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
      // let wrapper = document.createElement('div');
      // wrapper.className = 'Start';
      // wrapper.appendChild(this.renderSystemChoices());

      // let heading = document.createElement('div');
      // heading.className = 'Start-heading';
      // heading.innerHTML = 'Search for a City to Get Started';
      // wrapper.appendChild(heading);
      // document.querySelector('.mapboxgl-ctrl-top-right').appendChild(wrapper);

      let geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        placeholder: 'e.g. Paris, France',
        types: 'place,district,region,country'
      })

      // this.props.map.addControl(geocoder);
      let startElem = document.querySelector('.Start');
      console.log('here', startElem);
      if (startElem) {
        startElem.appendChild(geocoder.onAdd(this.props.map));
      }

      geocoder.on('result', (result) => {
        // let geoElem = document.querySelector('.mapboxgl-ctrl-geocoder');
        // geoElem.dataset.removed = true;
        // wrapper.style.display = 'none';
        // geoElem.style.display = 'none';

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
    // return '';
    return (
      <div className="Start">
        <div className="Start-heading">
          Search for a City to Get Started
        </div>
      </div>
    );
  }
}
