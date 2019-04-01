import React from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export class Map extends React.Component {

  constructor(props) {
    super(props);
    this.state = {markers: []};
  }

  componentDidMount() {
    const map = new mapboxgl.Map({
      container: this.mapContainer,
      style: 'mapbox://styles/mapbox/dark-v10',
      zoom: 2
    });

    map.on('click', (e) => {
      if (Object.keys(this.props.system.stations).length) {
        const { lng, lat } = e.lngLat;
        this.props.onMapClick({
          lng: lng,
          lat: lat,
          onLines: [],
          id: this.props.meta.nextStationId,
          name: 'Station Name'
        });
      }
    });

    if (!this.props.system.stations.length) {
      let heading = document.createElement('h1');
      heading.className = 'Map-heading';
      heading.innerHTML = 'Search for a City to Get Started';
      document.querySelector('.mapboxgl-ctrl-top-right').appendChild(heading);

      let geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        placeholder: 'e.g. Tokyo, Japan',
        types: 'place,district,region,country'
      })

      map.addControl(geocoder);

      geocoder.on('result', (result) => {
        let geoElem = document.querySelector('.mapboxgl-ctrl-geocoder');
        geoElem.dataset.removed = true;
        heading.style.display = 'none';
        geoElem.style.display = 'none';

        if (result.result.place_name) {
          this.props.onGetTitle(result.result.place_name);
        }

        this.setState({
          searchResult: result.result
        });
      });
    }

    this.setState({
      map: map,
      listened: false
    });
  }

  render() {
    const stations = this.props.system.stations;
    const lines = this.props.system.lines;

    if (this.props.initial) {
      let lnglats = [];
      for (const sId in stations) {
        lnglats.push({
          lng: stations[sId].lng,
          lat: stations[sId].lat
        })
      }
      if (lnglats.length) {
        this.state.map.fitBounds(lnglats, {
          padding: Math.min(window.innerHeight, window.innerWidth) / 4
        });
      }
    }

    let elements = document.getElementsByClassName('Map-station');
    while (elements.length > 0) {
      elements[0].parentNode.removeChild(elements[0]);
    }

    for (const id in stations) {
      const { lng, lat } = stations[id];

      let color = '#888';
      for (const lineKey in lines) {
        if (lines[lineKey].stationIds.includes(id)) {
          color = '#fff';
          break;
        }
      }
      const svgCircle = `<svg height="16" width="16"><circle cx="8" cy="8" r="6" stroke="#000" stroke-width="2" fill="${color}" /></svg>`;

      let el = document.createElement('button');
      el.id = 'js-Map-station--' + id;
      el.className = 'Map-station';
      el.innerHTML = svgCircle;
      el.addEventListener('click', (e) => {
        this.props.onStopClick(id);
        e.stopPropagation();
      });

      new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(this.state.map);
    }

    for (const lineKey in lines) {
      const layerID = 'js-Map-line--' + lineKey;

      if (this.state.map) {
        if (this.state.map.getLayer(layerID)) {
          this.state.map.removeLayer(layerID);
        }

        if (this.state.map.getSource(layerID)){
          this.state.map.removeSource(layerID);
        }
      }

      const coords = lines[lineKey].stationIds.map(id => [stations[id].lng, stations[id].lat]);
      if (coords.length > 1) {
        let layer = {
          "id": layerID,
          "type": "line",
          "source": {
            "type": "geojson",
            "data": {
              "type": "Feature",
              "properties": {},
              "geometry": {
                "type": "LineString",
                "coordinates": coords
              }
            },
          },
          "layout": {
              "line-join": "round",
              "line-cap": "round"
          },
          "paint": {
              "line-color": lines[lineKey].color,
              "line-width": 8
          }
        };

        this.state.map.addLayer(layer);

        this.state.map.on('click', layerID, () => {
          this.props.onLineClick(lineKey);
        })
      }
    }

    return (
      <div className="Map" ref={el => this.mapContainer = el}></div>
    );
  }
}
