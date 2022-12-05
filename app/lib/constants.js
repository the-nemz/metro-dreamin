// convenience file for constants used in various places

export const LOADING = '/assets/loading.gif';
export const LOGO = '/assets/logo.svg';
export const LOGO_INVERTED = '/assets/logo-inverted.svg';

export const MAX_HISTORY_SIZE = 25;

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
