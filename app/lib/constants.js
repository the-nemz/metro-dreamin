// convenience file for constants used in various places

export const LOADING = '/assets/loading.gif';
export const LOGO = '/assets/logo.svg';
export const LOGO_INVERTED = '/assets/logo-inverted.svg';

export const MAX_HISTORY_SIZE = 25;

export const FLY_TIME = 4000; // millisecs to zoom/pan into map

export const INITIAL_SYSTEM = {
  title: 'MetroDreamin\'',
  stations: {},
  lines: {
    '0': {
      id: '0',
      name: 'Red Line',
      color: '#e6194b',
      stationIds: []
    }
  },
  manualUpdate: 0
};

export const INITIAL_META = {
  nextStationId: '0',
  nextLineId: '1',
  systemId: '0'
};

export const DEFAULT_LINE_MODE = 'RAPID';
export const LINE_MODES = [
  {
    key: 'BUS',
    label: 'local bus',
    speed: 0.4, // 24 kph
    acceleration: 2,
    pause: 500
  },
  {
    key: 'TRAM',
    label: 'BRT/tram',
    speed: 0.6, // 36 kph
    acceleration: 2,
    pause: 500
  },
  {
    key: 'RAPID',
    label: 'metro/rapid transit',
    speed: 1, // 60 kph
    acceleration: 2,
    pause: 500
  },
  {
    key: 'REGIONAL',
    label: 'regional rail',
    speed: 2, // 120 kph
    acceleration: 1,
    pause: 1500
  },
  {
    key: 'HSR',
    label: 'high speed rail',
    speed: 5, // 300 kph
    acceleration: 1,
    pause: 2000
  }
];

export const DEFAULT_LINES = [
  {
    'name': 'Red Line',
    'color': '#e6194b'
  },
  {
    'name': 'Green Line',
    'color': '#3cb44b'
  },
  {
    'name': 'Yellow Line',
    'color': '#ffe119'
  },
  {
    'name': 'Blue Line',
    'color': '#4363d8'
  },
  {
    'name': 'Orange Line',
    'color': '#f58231'
  },
  {
    'name': 'Purple Line',
    'color': '#911eb4'
  },
  {
    'name': 'Cyan Line',
    'color': '#42d4f4'
  },
  {
    'name': 'Magenta Line',
    'color': '#f032e6'
  },
  {
    'name': 'Lime Line',
    'color': '#bfef45'
  },
  {
    'name': 'Pink Line',
    'color': '#fabebe'
  },
  {
    'name': 'Teal Line',
    'color': '#469990'
  },
  {
    'name': 'Lavender Line',
    'color': '#e6beff'
  },
  {
    'name': 'Brown Line',
    'color': '#9A6324'
  },
  {
    'name': 'Beige Line',
    'color': '#fffac8'
  },
  {
    'name': 'Maroon Line',
    'color': '#800000'
  },
  {
    'name': 'Mint Line',
    'color': '#aaffc3'
  },
  {
    'name': 'Olive Line',
    'color': '#808000'
  },
  {
    'name': 'Apricot Line',
    'color': '#ffd8b1'
  },
  {
    'name': 'Navy Line',
    'color': '#000075'
  },
  {
    'name': 'Grey Line',
    'color': '#a9a9a9'
  },
  {
    'name': 'Black Line',
    'color': '#191919'
  }
];
