const rawLines = require('./lines.json');

let data = {
  map: {
    lines: {},
    stations: {},
    title: 'London Underground'
  },
  systemId: '5' // this is the second default map built
}

let stationsByCode = {}; // map from code to new ID
let nextStationId = 0;
let nextLineId = 0;

let handleStation = (rawStation) => {
  if (rawStation.stationId && !(rawStation.stationId in stationsByCode)) {
    stationsByCode[rawStation.stationId] = nextStationId + '';
    let name = rawStation.name;
    if (name.indexOf(' Underground Station') > 0) {
      name = name.substring(0, name.indexOf(' Underground Station'));
    } else if (name.indexOf(' Station') > 0) {
      name = name.substring(0, name.indexOf(' Station'));
    }
    data.map.stations[nextStationId + ''] = {
      id: nextStationId + '',
      lat: rawStation.lat,
      lng: rawStation.lon,
      name: name
    }
    nextStationId++;
  }
}

for (const rawLine of rawLines) {
  for (const rawStation of rawLine.stations) {
    handleStation(rawStation);
  }

  for (const sequence of rawLine.stopPointSequences) {
    for (const rawStation of sequence.stopPoint) {
      handleStation(rawStation);
    }
  }
}

data.nextStationId = nextStationId + '';

for (const rawLine of rawLines) {
  for (const [i, orderedRoute] of rawLine.orderedLineRoutes.entries()) {
    let stops = orderedRoute.naptanIds.map(stopId => stationsByCode[stopId]);
    data.map.lines[nextLineId + ''] = {
      id: nextLineId + '',
      color: rawLine.color,
      name: rawLine.lineName + (i > 0 ? ' ' + i : ''),
      stationIds: stops
    }
    nextLineId++;
  }
}

data.nextLineId = nextLineId + '';

console.log(JSON.stringify(data));
