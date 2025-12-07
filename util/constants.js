// convenience file for constants used in various places

export const FUNCTIONS_API_BASEURL = process.env.NEXT_PUBLIC_FUNCTIONS_API_BASEURL;
export const GEOSPATIAL_API_BASEURL = process.env.NEXT_PUBLIC_GEOSPATIAL_API_BASEURL;

export const FOUR_OH_FOUR = '/assets/fourohfour.gif';
export const FOUR_OH_THREE = '/assets/fourohthree.gif';
export const LOADING = '/assets/loading.gif';
export const LOGO = '/assets/logo.svg';
export const LOGO_INVERTED = '/assets/logo-inverted.svg';
export const LOGO_PNG = '/assets/metrodreamin-square.png';

export const ACCESSIBLE = '/assets/user/accessible.svg';
export const BICYCLE = '/assets/user/bicycle.svg';
export const BUS = '/assets/user/bus.svg';
export const CITY = '/assets/user/city.svg';
export const CLOUD = '/assets/user/cloud.svg';
export const FERRY = '/assets/user/ferry.svg';
export const GONDOLA = '/assets/user/gondola.svg';
export const METRO = '/assets/user/metro.svg';
export const PEDESTRIAN = '/assets/user/pedestrian.svg';
export const SHUTTLE = '/assets/user/shuttle.svg';
export const TRAIN = '/assets/user/train.svg';
export const TRAM = '/assets/user/tram.svg';

export const USER_BASIC = '/assets/user/basic.svg';

export const EMAIL = '/assets/auth/email.svg';
export const GOOGLE = '/assets/auth/google.svg';

export const STATION = '/assets/map/station.png';
export const STATION_DISCON = '/assets/map/station-discon.png';
export const TRANSFER = '/assets/map/transfer.png';
export const WAYPOINT_DARK = '/assets/map/waypoint-dark.png';
export const WAYPOINT_LIGHT = '/assets/map/waypoint-light.png';
export const LINE_ICONS_PNG_DIR = '/assets/map/icons';
export const LINE_ICONS_SVG_DIR = '/assets/line';

export const MAX_HISTORY_SIZE = 25;

export const FLY_TIME = 4000; // millisecs to zoom/pan into map
export const FOCUS_ANIM_TIME = 400; // millisecs for focus fade/slide

export const MILES_TO_METERS_MULTIPLIER = 1609.344;
export const MILES_TO_KMS_MULTIPLIER = 1.609344;
export const MS_IN_SIX_HOURS = 6 * 60 * 60 * 1000;


export const WALKING_DISTANCE = 0.5; // miles
export const WALKING_PACE = 20; // minutes per mile

export const INDIVIDUAL_STRUCTURE = 'INDIVIDUAL';
export const PARTITIONED_STRUCTURE = 'PARTITIONED';

export const INITIAL_SYSTEM = {
  title: 'MetroDreamin\'',
  stations: {},
  interchanges: {},
  lines: {
    '0': {
      id: '0',
      name: 'Red Line',
      color: '#e6194b',
      stationIds: []
    }
  },
  lineGroups: {},
  manualUpdate: 0
};

export const INITIAL_META = {
  nextStationId: '0',
  nextLineId: '1',
  nextLineGroupId: '0',
  nextInterchangeId: '0',
  systemNumStr: '0'
};

export const DEFAULT_LINE_MODE = 'RAPID';
export const LINE_MODES = [
    {
    key: 'WALK',
    label: 'Walking trail',
    useAdminName: false,
    speed: 0.09, // 5.4 kph
    acceleration: 9.81,
    pause: 1/2,
    defaultGrade: 'at'
  },
  {
    key: 'STAIR',
    label: 'Staircase',
    useAdminName: false,
    speed: 0.0125, // 627 m/h
    acceleration: 9.81,
    pause: 1/2,
    defaultGrade: 'at'
  },
  {
    key: 'GONDOLA',
    label: 'Gondola/aerial tram',
    useAdminName: false,
    speed: 1/3, // 20 kph
    acceleration: 2,
    pause: 0,
    defaultGrade: 'above'
  },
  {
    key: 'BUS',
    label: 'Local bus (mandatory stops)',
    useAdminName: false,
    speed: 0.4, // 24 kph
    acceleration: 2,
    pause: 300,
    defaultGrade: 'at'
  },
  {
    key: 'REQUESTSTOP',
    label: 'Local bus (request stops)',
    useAdminName: false,
    speed: 0.5, // 30 kph
    acceleration: 2,
    pause: 10,
    defaultGrade: 'at'
  },
  {
    key: 'FUNICULAR',
    label: 'Funicular/rack tram',
    useAdminName: false,
    speed: 0.5, // 30 kph
    acceleration: 2,
    pause: 500,
    defaultGrade: 'below'
  },
  {
    key: 'RACK',
    label: 'Rack railway (rack and pinion throughout the route)',
    useAdminName: false,
    speed: 0.5, // 30 kph
    acceleration: 2,
    pause: 500,
    defaultGrade: 'at'
  },
  {
    key: 'TRAM',
    label: 'Tram',
    useAdminName: false,
    speed: 0.6, // 36 kph
    acceleration: 2,
    pause: 300,
    defaultGrade: 'at'
  },
  {
    key: 'FERRY',
    label: 'Ferry',
    useAdminName: false,
    speed: 0.7, // 42 kph
    acceleration: 0.5,
    pause: 1500,
    defaultGrade: 'at'
  },
  {
    key: 'BRT',
    label: 'Bus rapid transit',
    useAdminName: false,
    speed: 0.8, // 48 kph
    acceleration: 2,
    pause: 500,
    defaultGrade: 'at'
  },
  {
    key: 'LIGHT',
    label: 'Light rail/interurban',
    useAdminName: false,
    speed: 0.9, // 54 kph
    acceleration: 2,
    pause: 500,
    defaultGrade: 'at'
  },
  {
    key: 'RAPID',
    label: 'Metro/rapid transit',
    useAdminName: false, // use street or POI names as station name
    speed: 1, // 60 kph
    acceleration: 2,
    pause: 500,
    defaultGrade: 'below'
  },
  {
    key: 'NIGHT',
    label: 'Sleeper train/bus',
    useAdminName: true, // use lowest administrative area (usually city) as station name
    speed: 1.5, // 90 kph
    acceleration: 1.5,
    pause: 1500,
    defaultGrade: 'at'
  },
  {
    key: 'REGIONAL',
    label: 'Commuter/suburban rail',
    useAdminName: true, // use lowest administrative area (usually city) as station name
    speed: 5/3, // 100 kph
    acceleration: 1,
    pause: 1500,
    defaultGrade: 'at'
  },
  {
    key: 'MLDISTANCE',
    label: 'Medium/long distance rail',
    useAdminName: true,
    speed: 8/3, // 160 kph
    acceleration: 1,
    pause: 2000,
    defaultGrade: 'at'
  },
  {
    key: 'TALGO',
    label: 'Talgo train/High speed sleeper train',
    useAdminName: true,
    speed: 4.25, // 255 kph
    acceleration: 1,
    pause: 3000,
    defaultGrade: 'at'
  },
  {
    key: 'HSR',
    label: 'High speed rail',
    useAdminName: true,
    speed: 5, // 300 kph
    acceleration: 1,
    pause: 3000,
    defaultGrade: 'at'
  },
  {
    key: 'MAGLEV',
    label: 'High speed rail (maglev/vactrain)',
    useAdminName: true,
    speed: 7.5, // 450 kph
    acceleration: 4,
    pause: 1500,
    defaultGrade: 'below'
  },
  {
    key: 'AIR',
    label: 'Airliner',
    useAdminName: true,
    speed: 15, // 900 kph
    acceleration: 3/4,
    pause: 30000,
    defaultGrade: 'at'
  },
  {
    key: 'ROCKET',
    label: 'Intercontinental Rocket',
    useAdminName: true,
    speed: 500, // halfway around the earth in an hour
    acceleration: 9.81, 
    pause: 30000,
    defaultGrade: 'at'
  }
];

export const SYSTEM_LEVELS = [
  {
    key: 'LOCAL',
    label: 'local',
    spacingThreshold: 2,
    radiusThreshold: 40,
    zoomThreshold: 9.5
  },
  {
    key: 'REGIONAL',
    label: 'regional',
    spacingThreshold: 10,
    radiusThreshold: 200,
    zoomThreshold: 7
  },
  {
    key: 'LONG',
    label: 'long distance',
    spacingThreshold: 50,
    radiusThreshold: 1000,
    zoomThreshold: 3.5
  },
  {
    key: 'XLONG',
    label: 'extra long distance',
    spacingThreshold: Number.MAX_SAFE_INTEGER,
    radiusThreshold: Number.MAX_SAFE_INTEGER,
    zoomThreshold: 1.1
  },
]

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
    'color': '#9a6324'
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

export const COLOR_TO_NAME = {
  '#e6194b': 'red',
  '#3cb44b': 'green',
  '#ffe119': 'yellow',
  '#4363d8': 'blue',
  '#f58231': 'orange',
  '#911eb4': 'purple',
  '#42d4f4': 'cyan',
  '#f032e6': 'magenta',
  '#bfef45': 'lime',
  '#fabebe': 'pink',
  '#469990': 'teal',
  '#e6beff': 'lavender',
  '#9a6324': 'brown',
  '#fffac8': 'beige',
  '#800000': 'maroon',
  '#aaffc3': 'mint',
  '#808000': 'olive',
  '#ffd8b1': 'apricot',
  '#000075': 'navy',
  '#a9a9a9': 'grey',
  '#191919': 'black'
};

export const COLOR_TO_FILTER = {
  '#e6194b': 'invert(21%) sepia(58%) saturate(4219%) hue-rotate(332deg) brightness(89%) contrast(102%)',
  '#3cb44b': 'invert(55%) sepia(54%) saturate(608%) hue-rotate(76deg) brightness(97%) contrast(82%)',
  '#ffe119': 'invert(91%) sepia(87%) saturate(5844%) hue-rotate(335deg) brightness(99%) contrast(105%)',
  '#4363d8': 'invert(34%) sepia(78%) saturate(1323%) hue-rotate(209deg) brightness(89%) contrast(90%)',
  '#f58231': 'invert(58%) sepia(75%) saturate(2403%) hue-rotate(342deg) brightness(106%) contrast(92%)',
  '#911eb4': 'invert(18%) sepia(73%) saturate(6079%) hue-rotate(282deg) brightness(79%) contrast(90%)',
  '#42d4f4': 'invert(65%) sepia(58%) saturate(557%) hue-rotate(154deg) brightness(104%) contrast(91%)',
  '#f032e6': 'invert(26%) sepia(59%) saturate(4002%) hue-rotate(287deg) brightness(108%) contrast(93%)',
  '#bfef45': 'invert(80%) sepia(72%) saturate(426%) hue-rotate(22deg) brightness(102%) contrast(90%)',
  '#fabebe': 'invert(83%) sepia(96%) saturate(4014%) hue-rotate(290deg) brightness(111%) contrast(96%)',
  '#469990': 'invert(50%) sepia(56%) saturate(357%) hue-rotate(124deg) brightness(96%) contrast(87%)',
  '#e6beff': 'invert(75%) sepia(36%) saturate(646%) hue-rotate(211deg) brightness(101%) contrast(105%)',
  '#9a6324': 'invert(35%) sepia(84%) saturate(434%) hue-rotate(352deg) brightness(97%) contrast(86%)',
  '#fffac8': 'invert(99%) sepia(84%) saturate(710%) hue-rotate(312deg) brightness(109%) contrast(102%)',
  '#800000': 'invert(12%) sepia(54%) saturate(4193%) hue-rotate(349deg) brightness(92%) contrast(120%)',
  '#aaffc3': 'invert(88%) sepia(21%) saturate(574%) hue-rotate(76deg) brightness(101%) contrast(102%)',
  '#808000': 'invert(37%) sepia(96%) saturate(1048%) hue-rotate(39deg) brightness(94%) contrast(101%)',
  '#ffd8b1': 'invert(78%) sepia(38%) saturate(322%) hue-rotate(336deg) brightness(104%) contrast(104%)',
  '#000075': 'invert(13%) sepia(86%) saturate(2191%) hue-rotate(230deg) brightness(86%) contrast(142%)',
  '#a9a9a9': 'invert(68%) sepia(0%) saturate(0%) hue-rotate(54deg) brightness(98%) contrast(95%)',
  '#191919': 'invert(0%) sepia(91%) saturate(135%) hue-rotate(352deg) brightness(95%) contrast(80%)'
};

export const USER_ICONS = {
  'ACCESSIBLE': {
    key: 'ACCESSIBLE',
    alt: 'accessiblity',
    filename: 'accessible.svg'
  },
  'BICYCLE': {
    key: 'BICYCLE',
    alt: 'bicycle',
    filename: 'bicycle.svg'
  },
  'BUS': {
    key: 'BUS',
    alt: 'bus',
    filename: 'bus.svg',
    default: true
  },
  'CITY': {
    key: 'CITY',
    alt: 'city',
    filename: 'city.svg'
  },
  'CLOUD': {
    key: 'CLOUD',
    alt: 'cloud for MetroDreamin\'',
    filename: 'cloud.svg'
  },
  'FERRY': {
    key: 'FERRY',
    alt: 'ferry',
    filename: 'ferry.svg'
  },
  'GONDOLA': {
    key: 'GONDOLA',
    alt: 'gondola/cable car/aerial tram ',
    filename: 'accessible.svg'
  },
  'METRO': {
    key: 'METRO',
    alt: 'metro/rapid transit',
    filename: 'metro.svg',
    default: true
  },
  'PEDESTRIAN': {
    key: 'PEDESTRIAN',
    alt: 'pedestrian/walking',
    filename: 'accessible.svg'
  },
  'SHUTTLE': {
    key: 'SHUTTLE',
    alt: 'shuttle',
    filename: 'shuttle.svg'
  },
  'TRAIN': {
    key: 'TRAIN',
    alt: 'train',
    filename: 'train.svg',
    default: true
  },
  'TRAM': {
    key: 'TRAM',
    alt: 'tram',
    filename: 'tram.svg',
    default: true
  },
};

export const LINE_ICON_SHAPES = [ 'circle', 'diamond', 'heart', 'plus', 'star' ];
export const LINE_ICON_SHAPE_SET = new Set([ 'circle', 'diamond', 'heart', 'plus', 'star' ]);

// Stop requirement values:
// Negative (-t): Mandatory stop with minimum dwell time of |t| seconds
// Zero (0): On-sight request stop (flag/queue)
// Positive (+t): Reservation-only stop requiring t seconds advance booking
// null/undefined: Use mode's default pause time (mandatory)
export const STOP_REQUIREMENT_PRESETS = [
  { value: null, label: 'Mandatory (default)', description: 'Uses mode default dwell time' },
  { value: 0, label: 'Request stop', description: 'On-sight request stop (flag/queue)' },
  { value: 300, label: 'Reservation (5 min)', description: 'Requires 5 minute advance booking' }
];

export const STOP_REQUIREMENT_LABELS = {
  mandatory: 'Mandatory',
  request: 'Request',
  reservation: 'Reservation'
};

export const getStopRequirementType = (value) => {
  if (value === null || value === undefined) return 'mandatory';
  if (value < 0) return 'mandatory';
  if (value === 0) return 'request';
  return 'reservation';
};

export const getStopRequirementLabel = (value, mode) => {
  if (value === null || value === undefined) {
    return `Mandatory (${mode?.pause ? mode.pause / 1000 : 0}s)`;
  }
  if (value < 0) return `Mandatory (${Math.abs(value)}s min)`;
  if (value === 0) return 'Request stop';
  return `Reservation (${value}s ahead)`;
}
