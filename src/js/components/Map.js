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
      if (!(this.props.initial && !(this.props.gotData || this.state.searchResult))) {
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
    const changing = this.props.changing;

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

    if (changing.stationIds || changing.all) {
      for (const id of (changing.all ? Object.keys(stations) : changing.stationIds)) {
        const pin = document.getElementById('js-Map-station--' + id);
        if (Object.keys(stations).includes(id) || this.props.initial) {
          if (pin) {
            pin.parentNode.removeChild(pin);
          }

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
        } else {
          if (pin) {
            pin.parentNode.removeChild(pin);
          }
        }
      }
    }

    if (changing.lineKeys || changing.all) {
      for (const lineKey of (changing.all ? Object.keys(lines) : changing.lineKeys)) {
        const layerID = 'js-Map-line--' + lineKey;

        if (!(lineKey in lines)) {
          this.state.map.removeLayer(layerID + '-prev');
          this.state.map.removeSource(layerID + '-prev');
          this.state.map.removeLayer(layerID);
          this.state.map.removeSource(layerID);
          continue;
        }

        const coords = lines[lineKey].stationIds.map(id => [stations[id].lng, stations[id].lat]);
        if (coords.length > 1) {
          const shortTime = 200;
          const longTime = 400;

          const layer = {
            "type": "line",
            "layout": {
                "line-join": "round",
                "line-cap": "round"
            },
            "source": {
              "type": "geojson"
            },
            "paint": {
              "line-color": lines[lineKey].color,
              "line-width": 8,
              "line-opacity-transition": {duration: shortTime}
            }
          };

          const data = {
            "type": "Feature",
            "properties": {},
            "geometry": {
              "type": "LineString",
              "coordinates": coords
            }
          }

          const initialOpacity = 0;
          const finalOpacity = 1;

          if (this.state.map) {
            if (this.state.map.getLayer(layerID)) {
              // Update line
              let newLayer = JSON.parse(JSON.stringify(layer));
              newLayer.id = layerID;
              newLayer.source.data = data;
              newLayer.paint['line-opacity'] = initialOpacity;
              newLayer.paint['line-opacity-transition']['duration'] = longTime;

              this.state.map.removeLayer(layerID);
              this.state.map.removeSource(layerID);
              this.state.map.addLayer(newLayer);
              this.state.map.setPaintProperty(layerID, 'line-opacity', finalOpacity);

              setTimeout(() => {
                this.state.map.setPaintProperty(layerID + '-prev', 'line-opacity', initialOpacity);

                setTimeout(() => {
                  this.state.map.getSource(layerID + '-prev').setData(data);
                  this.state.map.setPaintProperty(layerID + '-prev', 'line-opacity', finalOpacity);
                }, shortTime);
              }, shortTime);

            } else {
              // Initial paint of line
              let newLayer = JSON.parse(JSON.stringify(layer));
              newLayer.id = layerID;
              newLayer.source.data = data;
              newLayer.paint['line-opacity'] = finalOpacity;
              newLayer.paint['line-opacity-transition']['duration'] = longTime;
              this.state.map.addLayer(newLayer);

              let prevLayer = JSON.parse(JSON.stringify(layer));
              prevLayer.id = layerID + '-prev';
              prevLayer.source.data = data;
              prevLayer.paint['line-opacity'] = finalOpacity;
              this.state.map.addLayer(prevLayer);
            }
          }


          this.state.map.on('mousemove', layerID, () => {
            if (this.state.map.getPaintProperty(layerID, 'line-width') !== 12) {
              this.state.map.setPaintProperty(layerID, 'line-width', 12);
              this.state.map.moveLayer(layerID);
            }
          });

          this.state.map.on('mouseleave', layerID, () => {
            this.state.map.setPaintProperty(layerID, 'line-width', 8);
          });

          this.state.map.on('click', layerID, () => {
            this.state.map.moveLayer(layerID);
            this.props.onLineClick(lineKey);
          });
        }
      }
    }

    return (
      <div className="Map" ref={el => this.mapContainer = el}></div>
    );
  }
}
