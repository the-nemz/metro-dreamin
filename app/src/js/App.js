import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import mapboxgl from 'mapbox-gl';
import firebase from 'firebase';
import firebaseui from 'firebaseui';

import { Controls } from './components/Controls.js';
import { Line } from './components/Line.js';
import { Map } from './components/Map.js';
import { Shortcut } from './components/Shortcut.js';
import { Start } from './components/Start.js';
import { Station } from './components/Station.js';

import browserHistory from "./history.js";
import { sortSystems, getViewPath, getViewURL, getDistance } from './util.js';

import '../default.scss';
import logo from '../assets/logo.svg';

import 'mapbox-gl/dist/mapbox-gl.css';
import 'firebaseui/dist/firebaseui.css';
import 'focus-visible/dist/focus-visible.min.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

export class App extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      history: [
        {
          stations: {},
          lines: {
            '0': {
              id: '0',
              name: 'Red Line',
              color: '#e6194b',
              stationIds: []
            }
          },
          title: 'Metro Dreamin\''
        }
      ],
      meta: {
        nextStationId: '0',
        nextLineId: '1',
        systemId: '0'
      },
      settings: {
        noSave: true
      },
      systemChoices: {},
      initial: true,
      isSaved: true,
      showAuth: false,
      viewOnly: this.props.viewId ? true : false,
      focus: {},
      changing: {
        all: true
      },
      recent: {},
      alert: '',
      windowDims: {
        width: window.innerWidth || 0,
        height: window.innerHeight || 0
      }
    };

    this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
  }

  componentDidMount() {
    if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
      document.body.classList.add('isIOS');
    }

    const config = {
      apiKey: "AIzaSyBIMlulR8OTOoF-57DHty1NuXM0kqVoL5c",
      authDomain: "metrodreamin.firebaseapp.com",
      databaseURL: "https://metrodreamin.firebaseio.com",
      projectId: "metrodreamin",
      storageBucket: "metrodreamin.appspot.com",
      messagingSenderId: "86165148906"
    };
    firebase.initializeApp(config);

    window.ui = new firebaseui.auth.AuthUI(firebase.auth());

    this.database = firebase.firestore();

    firebase.auth().onAuthStateChanged((user) => {
      const currentUser = firebase.auth().currentUser;
      if (currentUser && currentUser.uid) {
        this.signIn(user, currentUser.uid);
      } else {
        if (!this.state.viewOnly) {
          this.setupSignIn();
        }
      }
    });

    if (this.state.viewOnly) {
      this.handleNoSave();
      this.startViewOnly();
    }

    ReactGA.initialize('UA-143422261-1');
    ReactGA.pageview('root');

    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);
  }

  updateWindowDimensions() {
    let windowDims = {
      height: window.innerHeight,
      width: window.innerWidth
    }
    this.setState({
      windowDims: windowDims
    });
  }

  setupSignIn() {
    const uiConfig = {
      callbacks: {
        signInSuccessWithAuthResult: (user) => {
          const currentUser = firebase.auth().currentUser;
          this.signIn(user, currentUser.uid);
          return false;
        },
      },
      signInFlow: 'popup',
      signInOptions: [
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.FacebookAuthProvider.PROVIDER_ID
      ]
    };

    window.ui.start('#js-Auth-container', uiConfig);

    this.setState({ showAuth: true });
  }

  initUser(user, uid) {
    let email = '';
    if (user.email) {
      email = user.email;
    } else if (user.additionalUserInfo.profile && user.additionalUserInfo.profile.email) {
      email = user.additionalUserInfo.profile.email;
    } else if (user.user && user.user.email) {
      email = user.user.email;
    }

    let displayName = 'Anon';
    if (user.displayName) {
      displayName = user.displayName;
    } else if (user.additionalUserInfo.profile && user.additionalUserInfo.profile.name) {
      displayName = user.additionalUserInfo.profile.name;
    } else if (user.user && user.user.displayName) {
      displayName = user.user.displayName;
    }

    let userDoc = this.database.doc('users/' + uid);
    userDoc.set({
      userId: uid,
      email: email,
      displayName: displayName,
      creationDate: Date.now(),
      lastLogin: Date.now()
    }).then(() => {
      this.setState({
        settings: {
          email: email,
          displayName: displayName,
          userId: uid
        }
      });

      ReactGA.event({
        category: 'User',
        action: 'Initialized Account'
      });
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });
  }

  signIn(user, uid) {
    if (user.additionalUserInfo && user.additionalUserInfo.isNewUser) {
      this.initUser(user, uid);
      return;
    }

    if (this.state.viewOnly) {
      this.loadSettings(uid);
      const { otherUid, systemId } = this.getViewOnlyInfo();

      // If a user is viewing their own map
      if (uid === otherUid && systemId) {
        this.setState({
          viewOnly: false,
          viewSelf: true
        });
      }
    } else {
      this.loadUserData(uid);
    }

    let userDoc = this.database.doc('users/' + uid);
    userDoc.update({
      lastLogin: Date.now()
    }).then(() => {
      ReactGA.event({
        category: 'User',
        action: 'Signed In'
      });
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });

    if (user.email && user.displayName) {
      this.setState({
        showAuth: false,
        settings: {
          email: user.email,
          displayName: user.displayName,
          userId: uid,
          mapOwnerName: this.state.viewOnly ? this.state.settings.mapOwnerName : null,
          noSave: false
        }
      });
    }

    this.setUpSaveWarning();
  }

  setUpSaveWarning() {
    window.onbeforeunload = () => {
      if (!this.state.isSaved) {
        return 'You have unsaved changes to your map! Do you want to continue?';
      }
    }
  }

  startViewOnly() {
    const { otherUid, systemId } = this.getViewOnlyInfo();
    this.loadUserData(otherUid, systemId);
  }

  getViewOnlyInfo() {
    let encoded = this.props.viewId;
    try {
      const otherUid = window.atob(encoded).split('|')[0];
      const systemId = window.atob(encoded).split('|')[1];
      return { otherUid, systemId };
    } catch (e) {
      console.log('Unexpected Error:', e);
    }
    return {};
  }

  loadSettings(uid) {
    // Should only be called when an authenticated user is viewing someone else's map
    let userDoc = this.database.doc('users/' + uid);
    userDoc.get().then((doc) => {
      if (doc) {
        const data = doc.data();
        if (data) {
          let settings = JSON.parse(JSON.stringify(this.state.settings));
          for (const key in data) {
            settings[key] = data[key];
          }

          this.setState({
            settings: settings
          });
        }
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });
  }

  loadUserData(uid, autoSelectId = '') {
    let userDoc = this.database.doc('users/' + uid);
    userDoc.get().then((doc) => {
      if (doc) {
        const data = doc.data();
        if (data) {
          let settings = JSON.parse(JSON.stringify(this.state.settings));

          if (this.state.viewOnly) {
            settings.mapOwnerName = data.displayName ? data.displayName : 'Anonymous';
          } else {
            for (const key in data) {
              settings[key] = data[key];
            }
          }

          let sysCollection = userDoc.collection('systems');
          sysCollection.get().then((collection) => {
            if (collection && (collection.docs || []).length) {
              for (const doc of (collection.docs || [])) {
                this.loadSystemData(doc, autoSelectId);
              }
              this.setState({
                newSystem: false
              });
            } else {
              this.setState({
                newSystem: true
              });
            }
          }).catch((e) => {
            if (e.name && e.name === 'FirebaseError') {
              console.log('User has no saved systems');
              this.setState({
                newSystem: true
              });
            } else {
              console.log('Unexpected Error:', e);
            }
          });

          this.setState({
            settings: settings,
            newSystem: false
          });
        } else if (doc.exists === false) {
          if (firebase.auth().currentUser && firebase.auth().currentUser.uid && firebase.auth().currentUser.uid === uid) {
            console.log('User doc does not exist. Initializing user.');
            this.initUser(firebase.auth().currentUser, firebase.auth().currentUser.uid);
            this.setState({
              newSystem: true
            });
          } else {
            this.handleSetAlert('This map no longer exists.');
            browserHistory.push('/view');
            setTimeout(() => {
              browserHistory.go(0);
            }, 3000);
          }
        }
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });
  }

  loadSystemData(systemDoc, autoSelectId = '') {
    if (systemDoc) {
      const data = systemDoc.data();
      if (data && data.systemId && data.map) {
        let systemChoices = JSON.parse(JSON.stringify(this.state.systemChoices));
        systemChoices[data.systemId] = data;
        this.setState({
          systemChoices: systemChoices
        });

        if (data.systemId === autoSelectId) {
          this.selectSystem(data.systemId);
        }
      } else {
        this.handleSetAlert('This map no longer exists.');
        browserHistory.push('/view');
        setTimeout(() => {
          browserHistory.go(0);
        }, 3000);
      }
    }
  }

  selectSystem(id) {
    if (this.props.writeDefault && window.location.hostname === 'localhost') {
      // writeDefault should be the name of the file without extension
      // Put the file in src/
      // Used for building default systems
      const defSystem = require(`./${this.props.writeDefault}.json`);
      let meta = {
        systemId: defSystem.systemId,
        nextLineId: defSystem.nextLineId,
        nextStationId: defSystem.nextStationId
      }

      this.setSystem(defSystem.map, meta);
    } else {
      const systemChoices = JSON.parse(JSON.stringify(this.state.systemChoices));
      let meta = {
        systemId: systemChoices[id].systemId,
        nextLineId: systemChoices[id].nextLineId,
        nextStationId: systemChoices[id].nextStationId
      }

      this.setSystem(systemChoices[id].map, meta);
      this.pushViewState(id, systemChoices[id].map);

      ReactGA.event({
        category: 'Action',
        action: 'Select Existing System'
      });
    }
  }

  setSystem(system, meta, showAlert) {
    if (system && system.title) {
      document.querySelector('head title').innerHTML = 'Metro Dreamin\' | ' + system.title;
    }

    this.setState({
      history: [system],
      meta: meta,
      gotData: true
    });

    if (showAlert) {
      this.handleSetAlert('Tap the map to add a station!');
    }
  }

  pushViewState(systemId, system) {
    if (!this.props.viewId && !this.state.settings.noSave && this.state.settings.userId) {
      let title = 'Metro Dreamin\'';
      if (system && system.title) {
        title = 'Metro Dreamin\' | ' + system.title;
      }
      document.querySelector('head title').innerHTML = title;
      browserHistory.push(getViewPath(this.state.settings.userId, systemId));
    }
  }

  newSystem() {
    const meta = JSON.parse(JSON.stringify(this.state.meta));
    meta.systemId = this.getNextSystemId();

    this.setState({
      newSystem: true,
      meta: meta
    });

    ReactGA.event({
      category: 'Action',
      action: 'Start New System'
    });
  }

  signOut() {
    firebase.auth().signOut();
    ReactGA.event({
      category: 'User',
      action: 'Signed Out'
    });
    window.location.reload();
  }

  handleGetShareableLink() {
    if (this.state.settings.noSave || this.state.viewOnly || !this.state.settings.userId) {
      return;
    }

    const el = document.createElement('textarea');
    el.value = getViewURL(this.state.settings.userId, this.state.meta.systemId);
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);

    this.handleSetAlert('Copied link to clipboard!');

    ReactGA.event({
      category: 'Share',
      action: 'Clipboard'
    });
  }

  handleShareToFacebook() {
    ReactGA.event({
      category: 'Share',
      action: 'Facebook'
    });
    window.FB.ui({
      method: 'share',
      href: getViewURL(this.state.settings.userId, this.state.meta.systemId),
    }, (response) => {});
  }

  handleOtherSystemSelect(systemId) {
    browserHistory.push(getViewPath(this.state.settings.userId, systemId));
  }

  handleGetTitle(title, showAlert) {
    document.querySelector('head title').innerHTML = 'Metro Dreamin\' | ' + title;
    const history = JSON.parse(JSON.stringify(this.state.history));

    let system = this.getSystem();
    system.title = title;
    this.setState({
      history: history.concat([system]),
      newSystemSelected: true,
      isSaved: false
    });

    if (showAlert) {
      this.handleSetAlert('Tap the map to add a station!');
    }
  }

  handleUndo() {
    const history = JSON.parse(JSON.stringify(this.state.history));
    if (history.length < 2 || this.state.viewOnly) {
      return;
    }
    const system = this.getSystem();
    const prevSystem = history[history.length - 2];

    let stationSet = new Set();
    Object.keys(system.stations).forEach(sID => stationSet.add(sID));
    Object.keys(prevSystem.stations).forEach(sID => stationSet.add(sID));

    let lineSet = new Set();
    Object.keys(system.lines).forEach(lID => lineSet.add(lID));
    Object.keys(prevSystem.lines).forEach(lID => lineSet.add(lID));

    this.setState({
      history: history.slice(0, history.length - 1),
      focus: {},
      initial: false,
      changing: {
        stationIds: Array.from(stationSet),
        lineKeys: Array.from(lineSet)
      }
    });

    ReactGA.event({
      category: 'Action',
      action: 'Undo'
    });
  }

  handleNoSave() {
    let settings = JSON.parse(JSON.stringify(this.state.settings));
    settings.noSave = true;
    this.setState({
      settings: settings,
      showAuth: false,
      newSystem: true
    });

    ReactGA.event({
      category: 'User',
      action: 'Use as Guest'
    });
  }

  handleSave() {
    if (this.state.settings.noSave) {
      this.setupSignIn();
      this.handleSetAlert('Sign in to save!');
    } else {
      const orphans = this.getOrphans();
      if (orphans.length) {
        this.setState({
          focus: {},
          initial: false
        });

        const itThem = orphans.length === 1 ? 'it.' : 'them.';
        const message = 'Do you want to remove ' + orphans.length +
                        (orphans.length === 1 ? ' station that is ' :  ' stations that are ') +
                        'not connected to any lines?';
        this.setState({
          prompt: {
            message: message,
            confirmText: 'Yes, remove ' + itThem,
            denyText: 'No, keep ' + itThem,
            confirmFunc: () => {
              this.setState({
                prompt: null
              });
              this.deleteOrphans(() => this.performSave());
            },
            denyFunc: () => {
              this.setState({
                prompt: null
              });
              this.performSave();
            }
          }
        });
      } else {
        this.performSave();
      }
    }
  }

  getOrphans() {
    let orphans = [];
    let system = this.getSystem();
    for (const stationId in system.stations) {
      let isOrphan = true;
      for (const line of Object.values(system.lines)) {
        if (line.stationIds.includes(stationId)) {
          isOrphan = false;
        }
      }
      if (isOrphan) {
        orphans.push(stationId);
      }
    }
    return orphans;
  }

  deleteOrphans(setStateCallBack) {
    this.setState({
      focus: {},
      initial: false
    });

    const orphans = this.getOrphans();
    if (orphans.length) {
      const history = JSON.parse(JSON.stringify(this.state.history));
      let system = this.getSystem();

      for (const orphanId of orphans) {
        delete system.stations[orphanId];
      }

      this.setState({
        history: history.concat([system]),
        focus: {},
        initial: false,
        isSaved: false,
        changing: {
          stationIds: orphans
        }
      }, setStateCallBack);

      ReactGA.event({
        category: 'Action',
        action: 'Delete Orphans'
      });
    }
  }

  performSave() {
    let uid = this.state.settings.userId;
    if (this.props.writeDefault && window.location.hostname === 'localhost') {
      // Used for building default systems
      uid = 'default';
      console.log('Saving to default system with id "' + this.state.meta.systemId + '".');
    }

    const docString = `users/${uid}/systems/${this.state.meta.systemId}`
    let systemDoc = this.database.doc(docString);
    let systemToSave = {
      nextLineId: this.state.meta.nextLineId,
      nextStationId: this.state.meta.nextStationId,
      systemId: this.state.meta.systemId,
      map: this.getSystem()
    }
    console.log('Saving system:', JSON.stringify(systemToSave));

    systemDoc.set(systemToSave).then(() => {
      this.handleSetAlert('Saved!');
      this.pushViewState(this.state.meta.systemId, systemToSave.map);
      this.setState({
        isSaved: true
      });

      ReactGA.event({
        category: 'Action',
        action: 'Saved'
      });
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });

    let userDoc = this.database.doc('users/' + uid);
    userDoc.get().then((doc) => {
      if (doc) {
        const data = doc.data();
        if (data && !(data.systemIds || []).includes(this.state.meta.systemId)) {
          userDoc.update({
            systemIds: (data.systemIds || []).concat([this.state.meta.systemId])
          }).then(() => {
            ReactGA.event({
              category: 'Action',
              action: 'Initial Map Save'
            });
          }).catch((error) => {
            console.log('Unexpected Error:', error);
          });
        }
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });
  }

  saveSettings(propertiesToSave, trackAction = 'Update') {
    if (!this.state.settings.noSave && this.state.settings.userId && Object.keys(propertiesToSave).length) {
      propertiesToSave.lastLogin = Date.now();

      let userDoc = this.database.doc('users/' + this.state.settings.userId);
      userDoc.update(propertiesToSave).then(() => {
        ReactGA.event({
          category: 'Settings',
          action: trackAction
        });
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });
    }
  }

  handleToggleTheme() {
    let settings = JSON.parse(JSON.stringify(this.state.settings));
    const useLight = settings.lightMode ? false : true;

    this.saveSettings({ lightMode: useLight }, useLight ? 'Light Mode On' : 'Dark Mode On');
    settings.lightMode = useLight;

    this.setState({
      settings: settings,
      changing: {},
    });
  }

  handleToggleMapStyle(map, style) {
    map.setStyle(style);
    map.once('styledata', () => {
      this.setState({
        changing: {
          all: true
        },
      });
    });
  }

  handleCloseFocus() {
    this.setState({
      focus: {}
    });

    ReactGA.event({
      category: 'Action',
      action: 'Close Focus'
    });
  }

  async getStationName(station) {
    let str = `https://api.mapbox.com/geocoding/v5/mapbox.places/${station.lng},${station.lat}.json?access_token=${mapboxgl.accessToken}`;
    let req = new XMLHttpRequest();
    req.addEventListener('load', () => {
      let history = JSON.parse(JSON.stringify(this.state.history));
      const system = this.getSystem();
      const resp = JSON.parse(req.response);
      for (const feature of resp.features) {
        if (feature.text) {
          station.name = feature.text;
          break;
        }
      }
      system.stations[station.id] = station;
      history[history.length - 1] = system;
      this.setState({
        history: history,
        focus: {
          station: JSON.parse(JSON.stringify(station))
        },
        changing: {}
      });
    });
    req.open('GET', str);
    req.send();
  }

  async handleMapClick(station) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let meta = JSON.parse(JSON.stringify(this.state.meta));

    await this.getStationName(station);

    let system = this.getSystem();
    system.stations[station['id']] = station;
    meta.nextStationId = parseInt(this.state.meta.nextStationId) + 1 + '';

    let recent = JSON.parse(JSON.stringify(this.state.recent));
    recent.stationId = station.id;

    this.setState({
      history: history.concat([system]),
      meta: meta,
      changing: {
        stationIds: [station['id']]
      },
      recent: recent,
      initial: false,
      isSaved: false
    });

    ReactGA.event({
      category: 'Action',
      action: 'Add New Station'
    });
  }

  handleMapInit(map) {
    this.setState({
      map: map
    });
  }

  handleStationDelete(station) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem();
    delete system.stations[station['id']];

    let modifiedLines = [];
    for (const lineKey in system.lines) {
      let line = JSON.parse(JSON.stringify(system.lines[lineKey]));
      for (let i = line.stationIds.length - 1; i >= 0; i--) {
        if (line.stationIds[i] === station['id']) {
          line.stationIds.splice(i, 1);
          modifiedLines.push(lineKey);
        }
      }
      system.lines[lineKey] = line;
    }

    let recent = JSON.parse(JSON.stringify(this.state.recent));
    recent.stationId = null;

    this.setState({
      history: history.concat([system]),
      focus: {},
      changing: {
        lineKeys: modifiedLines,
        stationIds: [station['id']]
      },
      recent: recent,
      initial: false,
      isSaved: false
    });

    ReactGA.event({
      category: 'Action',
      action: 'Delete Station'
    });
  }

  getNearestIndex(lineKey, station) {
    let system = this.getSystem();
    const line = system.lines[lineKey];
    const stations = system.stations;

    if (line.stationIds.length === 0 || line.stationIds.length === 1) {
      return 0;
    }

    let nearestIndex = 0;
    let nearestId;
    let nearestDist = Number.MAX_SAFE_INTEGER;
    for (const [i, stationId] of line.stationIds.entries()) {
      let dist = getDistance(station, stations[stationId]);
      if (dist < nearestDist) {
        nearestIndex = i;
        nearestId = stationId;
        nearestDist = dist;
      }
    }

    if (nearestIndex !== 0 && line.stationIds[0] === nearestId) {
      // If nearest is loop point at start
      return 0;
    } else if (nearestIndex !== line.stationIds.length - 1 &&
               line.stationIds[line.stationIds.length - 1] === nearestId) {
      // If nearest is loop point at end
      return line.stationIds.length;
    }

    if (nearestIndex === 0) {
      const nearStation = stations[line.stationIds[nearestIndex]];
      const nextStation = stations[line.stationIds[nearestIndex + 1]];
      const otherDist = getDistance(nearStation, nextStation);
      const nextDist = getDistance(station, nextStation);
      if (nextDist > otherDist) {
        return 0;
      }
      return 1;
    } else if (nearestIndex === line.stationIds.length - 1) {
      const nearStation = stations[line.stationIds[nearestIndex]];
      const nextStation = stations[line.stationIds[nearestIndex - 1]];
      const otherDist = getDistance(nearStation, nextStation);
      const nextDist = getDistance(station, nextStation);
      if (nextDist > otherDist) {
        return line.stationIds.length;
      }
      return line.stationIds.length - 1;
    } else {
      const prevStation = stations[line.stationIds[nearestIndex - 1]];
      const nextStation = stations[line.stationIds[nearestIndex + 1]];
      const prevDist = getDistance(station, prevStation);
      const nextDist = getDistance(station, nextStation);
      const nearToPrevDist = getDistance(stations[line.stationIds[nearestIndex]], prevStation);
      const nearToNextDist = getDistance(stations[line.stationIds[nearestIndex]], nextStation);
      if (prevDist < nextDist) {
        if (nearToPrevDist < prevDist) return nearestIndex + 1;
        return nearestIndex;
      } else {
        if (nearToNextDist < nextDist) return nearestIndex;
        return nearestIndex + 1;
      }
    }
  }

  handleAddStationToLine(lineKey, station, position) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem(history);
    let line = system.lines[lineKey];

    if (position !== 0 && !position) {
      position = this.getNearestIndex(lineKey, station);
    }

    if (position === 0) {
      line.stationIds = [station.id].concat(line.stationIds);
    } else if (position < line.stationIds.length) {
      line.stationIds.splice(position, 0, station.id);
    } else {
      line.stationIds = line.stationIds.concat([station.id]);
    }

    system.lines[lineKey] = line;
    this.setState({
      history: history.concat([system]),
      focus: {
        line: JSON.parse(JSON.stringify(line))
      },
      changing: {
        lineKeys: [lineKey],
        stationIds: [station.id]
      },
      recent: {
        lineKey: lineKey,
        stationId: station.id
      },
      initial: false,
      isSaved: false
    });

    ReactGA.event({
      category: 'Action',
      action: 'Add Station to Line'
    });
  }

  handleRemoveStationFromLine(line, stationId) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem(history);

    line.stationIds = line.stationIds.filter((sId, index, arr) => {
      return sId !== stationId;
    });

    system.lines[line.id] = line;
    this.setState({
      history: history.concat([system]),
      focus: {
        line: JSON.parse(JSON.stringify(line))
      },
      changing: {
        lineKeys: [line.id],
        stationIds: [stationId]
      },
      recent: {
        lineKey: line.id,
        stationId: stationId
      },
      initial: false,
      isSaved: false
    });

    ReactGA.event({
      category: 'Action',
      action: 'Remove Station from Line'
    });
  }

  handleStopClick(id) {
    const focus = {
      station: this.getSystem().stations[id]
    }
    this.setState({
      focus: focus,
      initial: false,
      changing: {}
    });
  }

  handleLineClick(id) {
    const focus = {
      line: this.getSystem().lines[id]
    }
    this.setState({
      focus: focus,
      initial: false,
      changing: {}
    });
  }

  handleAddLine() {
    const defaultLines = [
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

    const history = JSON.parse(JSON.stringify(this.state.history));
    let meta = JSON.parse(JSON.stringify(this.state.meta));
    let system = this.getSystem();
    const lineKeys = Object.keys(system.lines);

    let currColors = [];
    for (const key of lineKeys) {
      currColors.push(system.lines[key].color);
    }

    let index = 0;
    if (lineKeys.length >= 21) {
      index = Math.floor(Math.random() * 21);
    }
    let nextLine = JSON.parse(JSON.stringify(defaultLines[index]));
    for (const defLine of defaultLines) {
      if (!currColors.includes(defLine.color)) {
        nextLine = JSON.parse(JSON.stringify(defLine));
        break;
      }
    }

    const lineKey = meta.nextLineId;
    nextLine.stationIds = [];
    nextLine.id = lineKey;
    system.lines[lineKey] = nextLine;

    meta.nextLineId = parseInt(lineKey) + 1 + '';

    let recent = JSON.parse(JSON.stringify(this.state.recent));
    recent.lineKey = lineKey;

    this.setState({
      history: history.concat([system]),
      meta: meta,
      focus: {
        line: JSON.parse(JSON.stringify(system.lines[lineKey]))
      },
      initial: false,
      changing: {},
      recent: recent,
      isSaved: false
    });

    ReactGA.event({
      category: 'Action',
      action: 'Add New Line'
    });
  }

  handleLineDelete(line) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem();
    delete system.lines[line.id];

    let recent = JSON.parse(JSON.stringify(this.state.recent));
    recent.lineKey = null;

    this.setState({
      history: history.concat([system]),
      focus: {},
      changing: {
        lineKeys: [line.id],
        stationIds: line.stationIds
      },
      recent: recent,
      initial: false,
      isSaved: false
    });

    ReactGA.event({
      category: 'Action',
      action: 'Delete Line'
    });
  }

  handleLineDuplicate(line) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let meta = JSON.parse(JSON.stringify(this.state.meta));
    let system = this.getSystem();

    const lineKey = meta.nextLineId;
    let forkedLine = JSON.parse(JSON.stringify(line));
    forkedLine.id = lineKey;
    forkedLine.name = line.name + ' - Fork';
    system.lines[lineKey] = forkedLine;

    meta.nextLineId = parseInt(lineKey) + 1 + '';

    let recent = JSON.parse(JSON.stringify(this.state.recent));
    recent.lineKey = line.id;

    this.setState({
      history: history.concat([system]),
      meta: meta,
      focus: {
        line: JSON.parse(JSON.stringify(system.lines[lineKey]))
      },
      initial: false,
      changing: {
        lineKeys: [lineKey]
      },
      recent: recent,
      isSaved: false
    });

    ReactGA.event({
      category: 'Action',
      action: 'Fork Line'
    });
  }

  handleLineInfoChange(line, renderMap) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem();
    system.lines[line.id] = line;

    let changing = {};
    if (renderMap) {
      changing.lineKeys = [line.id];
    }

    let recent = JSON.parse(JSON.stringify(this.state.recent));
    recent.lineKey = line.id;

    this.setState({
      history: history.concat([system]),
      focus: {
        line: JSON.parse(JSON.stringify(line))
      },
      initial: false,
      changing: changing,
      recent: recent,
      isSaved: false
    });

    ReactGA.event({
      category: 'Action',
      action: 'Change Line Info'
    });
  }

  handleStationInfoChange(station, replace = false) {
    let history = JSON.parse(JSON.stringify(this.state.history));
    let recent = JSON.parse(JSON.stringify(this.state.recent));
    let system = this.getSystem();
    system.stations[station.id] = station;

    if (replace) {
      history[history.length - 1] = system;
    } else {
      history = history.concat([system]);
      recent.stationId = station.id;
      ReactGA.event({
        category: 'Action',
        action: 'Change Station Info'
      });
    }
    this.setState({
      history: history,
      initial: false,
      changing: {},
      recent: recent,
      isSaved: replace ? this.state.isSaved : false
    });
  }

  handlLineElemClick(line) {
    this.setState({
      focus: {
        line: JSON.parse(JSON.stringify(line))
      },
      initial: false,
      changing: {lineKeys: [line.id]}
    });
  }

  handleSetAlert(message) {
    this.setState({
      alert: message
    });

    setTimeout(() => {
      this.setState({
        alert: ''
      })
    }, 3000);
  }

  getSystem() {
    return JSON.parse(JSON.stringify(this.state.history[this.state.history.length - 1]));
  }

  getNextSystemId() {
    if (Object.keys(this.state.systemChoices).length) {
      let intIds = (Object.keys(this.state.systemChoices)).map((a) => parseInt(a));
      return Math.max(...intIds) + 1 + '';
    } else {
      return '0';
    }
  }

  renderLines(system) {
    const lines = system.lines;
    let lineElems = [];
    for (const lineKey in lines) {
      lineElems.push(
        <button className="Main-lineWrap Link" key={lineKey} onClick={() => this.handlLineElemClick(lines[lineKey])}>
          <div className="Main-linePrev" style={{backgroundColor: lines[lineKey].color}}></div>
          <div className="Main-line">
            {lines[lineKey].name}
          </div>
        </button>
      );
    }
    return (
      <div className="Main-lines">
        {lineElems}
      </div>
    );
  }

  renderFocus() {
    let content = '';
    if (this.state.focus) {
      const type = Object.keys(this.state.focus)[0];
      switch (type) {
        case 'station':
          content = <Station viewOnly={this.state.viewOnly} useLight={this.state.settings.lightMode}
                             station={this.state.focus.station} lines={this.getSystem().lines} stations={this.getSystem().stations}
                             onAddToLine={(lineKey, station, position) => this.handleAddStationToLine(lineKey, station, position)}
                             onDeleteStation={(station) => this.handleStationDelete(station)}
                             onStationInfoChange={(station, replace) => this.handleStationInfoChange(station, replace)}
                             onLineClick={(line) => this.handlLineElemClick(line)}
                             onFocusClose={() => this.handleCloseFocus()} />;
          break;
        case 'line':
          content =  <Line viewOnly={this.state.viewOnly} line={this.state.focus.line} system={this.getSystem()}
                           onLineInfoChange={(line, renderMap) => this.handleLineInfoChange(line, renderMap)}
                           onStationRemove={(line, stationId) => this.handleRemoveStationFromLine(line, stationId)}
                           onDeleteLine={(line) => this.handleLineDelete(line)}
                           onDuplicateLine={(line) => this.handleLineDuplicate(line)}
                           onStopClick={(stationId) => this.handleStopClick(stationId)}
                           onFocusClose={() => this.handleCloseFocus()} />;
          break;
        default:
          break;
      }
    }
    return content;
  }

  renderSystemChoices() {
    if (!this.state.gotData && Object.keys(this.state.systemChoices).length && !this.state.newSystem) {
      let choices = [];
      for (const system of Object.values(this.state.systemChoices).sort(sortSystems)) {
        choices.push(
          <button className="Main-systemChoice" key={system.systemId}
                  onClick={() => this.selectSystem(system.systemId)}>
            {system.map.title ? system.map.title : 'Unnamed System'}
          </button>
        );
      }
      return(
        <div className="Main-systemChoicesWrap FadeAnim">
          <div className="Main-systemChoices">
            {choices}
            <button className="Main-newSystem Link" onClick={() => this.newSystem()}>
              Start a new map
            </button>
          </div>
        </div>
      );
    }
  }

  renderAlert() {
    if (this.state.alert) {
      return (
        <div className="Main-alert FadeAnim">
          <div className="Main-alertMessage">
            {this.state.alert}
          </div>
        </div>
      );
    }
  }

  renderViewOnly() {
    const system = this.getSystem();
    const sysTitle = (
      <span className="Main-viewTitleBold">
        {system.title ? system.title : 'Metro Dreamin\''}
      </span>
    );
    const ownerName = this.state.settings.mapOwnerName;
    const title = (
      <div className="Main-viewTitle">
        {'Viewing '}{sysTitle}{ownerName ? ' by ' + ownerName : ''}
      </div>
    );
    return (
      <div className="Main-viewOnly FadeAnim">
        <div className="Main-viewOnlyWrap">
          {title}
          <button className="Main-viewStart Link"
                  onClick={() => {
                    ReactGA.event({
                      category: 'ViewOnly',
                      action: 'Own Maps'
                    });
                    browserHistory.push('/view');
                    browserHistory.go(0);
                  }}>
            {this.state.settings.userId ? 'Work on your own maps' : 'Get started on your own map'}
          </button>
        </div>
      </div>
    );
  }

  renderPrompt() {
    if (this.state.prompt && this.state.prompt.message &&
        this.state.prompt.denyFunc && this.state.prompt.confirmFunc) {
      return (
        <div className="Main-prompt FadeAnim">
          <div className="Main-promptContent">
            <div className="Main-promptMessage">
              {this.state.prompt.message}
            </div>
            <div className="Main-promptButtons">
              <button className="Main-promptDeny" onClick={this.state.prompt.denyFunc}>
                {this.state.prompt.denyText ? this.state.prompt.denyText : 'No'}
              </button>
              <button className="Main-promptConfirm" onClick={this.state.prompt.confirmFunc}>
                {this.state.prompt.confirmText ? this.state.prompt.confirmText : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  renderFadeWrap(content) {
    return (
      <ReactCSSTransitionGroup
          transitionName="FadeAnim"
          transitionAppear={true}
          transitionAppearTimeout={400}
          transitionEnter={true}
          transitionEnterTimeout={400}
          transitionLeave={true}
          transitionLeaveTimeout={400}>
        {content}
      </ReactCSSTransitionGroup>
    );
  }

  render() {
    const system = this.getSystem();
    const meta = this.state.meta;
    const settings = this.state.settings;

    const auth = (
      <div className={this.state.showAuth ? 'Auth' : 'Auth Auth--gone'}>
        <div className="Auth-top">
          <h1 className="Auth-heading">
            <img className="Auth-logo" src={logo} alt="Metro Dreamin' logo" />
            <div className="Auth-headingText">Metro Dreamin'</div>
          </h1>
          <h2 className="Auth-description">
            Sign up or continue as a guest to build your dream transportation system.
          </h2>
        </div>
        <div id="js-Auth-container" className="Auth-container"></div>
        <button className="Auth-nosignin Link" onClick={() => this.handleNoSave()}>
          Continue as a guest
        </button>
      </div>
    );

    const showChoices = !this.state.gotData && Object.keys(this.state.systemChoices).length && !this.state.newSystem;
    const choices = showChoices ? this.renderSystemChoices() : '';

    const showStart = this.state.newSystem && !this.state.gotData && !this.state.newSystemSelected &&
                      !this.state.viewOnly && !this.state.viewSelf;
    const start = (
      <Start system={system} map={this.state.map} database={this.database}
             nextSystemId={this.getNextSystemId()}
             onGetTitle={(title) => this.handleGetTitle(title, true)}
             onSelectSystem={(system, meta) => this.setSystem(system, meta, true)} />
    );

    const showSplash = !this.state.showAuth && !showChoices && !showStart &&
                       !this.state.gotData && !this.state.newSystemSelected;
    const splash = (
      <div className="Main-splashWrap FadeAnim">
        <img className="Main-splash" src={logo} alt="Metro Dreamin' logo" />
      </div>
    );

    const showViewOnly = this.state.viewOnly && !showSplash &&
                         !(this.state.windowDims.width <= 767 && Object.keys(this.state.focus).length);
    const viewOnly = showViewOnly ? this.renderViewOnly() : '';

    const showShortcut = !this.state.viewOnly && this.state.focus !== {} && 'station' in this.state.focus && this.state.windowDims.width > 767;
    const shortcut = (
      <Shortcut map={this.state.map} station={this.state.focus.station}
                show={showShortcut} system={system} recent={this.state.recent}
                onAddToLine={(lineKey, station, position) => this.handleAddStationToLine(lineKey, station, position)}
                onDeleteStation={(station) => this.handleStationDelete(station)} />
    );

    const mainClass = `Main ${this.state.settings.lightMode ? 'LightMode' : 'DarkMode'}`
    return (
      <div className={mainClass}>
        {auth}
        {this.renderFadeWrap(showSplash ? splash : '')}
        {this.renderFadeWrap(this.renderAlert())}
        {this.renderFadeWrap(choices)}
        {this.renderFadeWrap(showStart ? start : '')}
        {this.renderFadeWrap(showViewOnly ? viewOnly : '')}
        {this.renderFadeWrap(this.renderPrompt())}

        {shortcut}

        <Controls system={system} settings={settings} viewOnly={this.state.viewOnly}
                  initial={this.state.initial} gotData={this.state.gotData} useLight={this.state.settings.lightMode}
                  systemChoices={this.state.systemChoices} meta={this.state.meta}
                  newSystemSelected={this.state.newSystemSelected || false}
                  signOut={() => this.signOut()}
                  setupSignIn={() => this.setupSignIn()}
                  onSave={() => this.handleSave()}
                  onUndo={() => this.handleUndo()}
                  onAddLine={(line) => this.handleAddLine(line)}
                  onLineElemClick={(line) => this.handlLineElemClick(line)}
                  onGetShareableLink={() => this.handleGetShareableLink()}
                  onShareToFacebook={() => this.handleShareToFacebook()}
                  onOtherSystemSelect={(systemId) => this.handleOtherSystemSelect(systemId)}
                  onGetTitle={(title) => this.handleGetTitle(title)}
                  onToggleTheme={() => this.handleToggleTheme()} />

        <ReactCSSTransitionGroup
            transitionName="FocusAnim"
            transitionAppear={true}
            transitionAppearTimeout={400}
            transitionEnter={true}
            transitionEnterTimeout={400}
            transitionLeave={true}
            transitionLeaveTimeout={400}>
          {this.renderFocus()}
        </ReactCSSTransitionGroup>

        <Map system={system} meta={meta} changing={this.state.changing} focus={this.state.focus}
             initial={this.state.initial} gotData={this.state.gotData} viewOnly={this.state.viewOnly}
             newSystemSelected={this.state.newSystemSelected || false} useLight={this.state.settings.lightMode}
             onStopClick={(id) => this.handleStopClick(id)}
             onLineClick={(id) => this.handleLineClick(id)}
             onMapClick={(station) => this.handleMapClick(station)}
             onMapInit={(map) => this.handleMapInit(map)}
             onToggleMapStyle={(map, style) => this.handleToggleMapStyle(map, style)} />

        <ReactTooltip delayShow={400} border={true} type={this.state.settings.lightMode ? 'light' : 'dark'} />
      </div>
    );
  }
}
