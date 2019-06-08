const rawLines = require('./lines.json');
const rawStations = require('./stations.json');

let data = {
  map: {
    lines: {},
    stations: {},
    title: 'Washington, DC Metro'
  },
  systemId: '0' // this is the first default map built
}

let stationsByCode = {}; // map from code to new ID
let nextStationId = 0;
let nextLineId = 0;

for (const rawStation of rawStations.stations) {
  if (!(rawStation.Code in stationsByCode)) {
    stationsByCode[rawStation.Code] = nextStationId + '';
    data.map.stations[nextStationId + ''] = {
      id: nextStationId + '',
      lat: rawStation.Lat,
      lng: rawStation.Lon,
      name: rawStation.Name
    }
    nextStationId++;
  }
}

data.nextStationId = nextStationId + '';

const colorMap = {
  'Red Line': '#e6194b',
  'Green Line': '#3cb44b',
  'Yellow Line': '#ffe119',
  'Blue Line': '#4363d8',
  'Orange Line': '#f58231',
  'Silver Line': '#a9a9a9'
}

for (const lineName in rawLines) {
  const rawLine = rawLines[lineName];
  let stops = rawLine.map(rawStop => stationsByCode[rawStop.StationCode]);
  data.map.lines[nextLineId + ''] = {
    id: nextLineId + '',
    color: colorMap[lineName],
    name: lineName,
    stationIds: stops
  }
  nextLineId++;
}

data.nextLineId = nextLineId + '';

console.log(JSON.stringify(data));
console.log('NOTE: There is an oddity with the data for transfers for a few stations which was fixed by hand.');
