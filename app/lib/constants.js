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
