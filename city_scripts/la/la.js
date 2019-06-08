const rawLines = require('./lines.json');

let data = {
  map: {
    lines: {},
    stations: {},
    title: 'Los Angeles Metro'
  },
  systemId: '1' // this is the second default map built
}

let stationsByCode = {}; // map from code to new ID
let nextStationId = 0;
let nextLineId = 0;

for (const lineName in rawLines) {
  const rawLine = rawLines[lineName];
  for (const rawStation of rawLine) {
    if (!(rawStation.id in stationsByCode)) {
      stationsByCode[rawStation.id] = nextStationId + '';
      data.map.stations[nextStationId + ''] = {
        id: nextStationId + '',
        lat: rawStation.latitude,
        lng: rawStation.longitude,
        name: rawStation.display_name
      }
      nextStationId++;
    }
  }
}

data.nextStationId = nextStationId + '';

const colorMap = {
  'Red Line': '#e6194b',
  'Green Line': '#3cb44b',
  'Blue Line': '#4363d8',
  'Purple Line': '#911eb4',
  'Expo Line': '#42d4f4',
  'Gold Line': '#ffe119'
}

for (const lineName in rawLines) {
  const rawLine = rawLines[lineName];
  let stops = rawLine.map(rawStop => stationsByCode[rawStop.id]);
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
