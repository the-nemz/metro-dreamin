const rawLines = require('./lines.json');
const rawStations = require('./stations.json');

let data = {
  map: {
    lines: {},
    stations: {},
    title: 'San Francisco BART'
  },
  systemId: '2' // this is the third default map built
}

let stationsByCode = {}; // map from code to new ID
let nextStationId = 0;
let nextLineId = 0;

for (const rawStation of rawStations.stations) {
  if (!(rawStation.abbr in stationsByCode)) {
    stationsByCode[rawStation.abbr] = nextStationId + '';
    data.map.stations[nextStationId + ''] = {
      id: nextStationId + '',
      lat: rawStation.gtfs_latitude,
      lng: rawStation.gtfs_longitude,
      name: rawStation.name
    }
    nextStationId++;
  }
}

data.nextStationId = nextStationId + '';

for (const rawLine of rawLines.lines) {
  let stops = rawLine.config.station.map(abbr => stationsByCode[abbr]);
  data.map.lines[nextLineId + ''] = {
    id: nextLineId + '',
    color: rawLine.color,
    name: rawLine.name,
    stationIds: stops
  }
  nextLineId++;
}

data.nextLineId = nextLineId + '';

console.log(JSON.stringify(data));
