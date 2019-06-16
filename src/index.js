import React from 'react';
import ReactDOM from 'react-dom';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactTooltip from 'react-tooltip';

import mapboxgl from 'mapbox-gl';
import firebase from 'firebase';
import firebaseui from 'firebaseui';
import URI from 'urijs';

import { Start } from './js/components/Start.js';
import { Controls } from './js/components/Controls.js';
import { Map } from './js/components/Map.js';
import { Station } from './js/components/Station.js';
import { Line } from './js/components/Line.js';

import './default.scss';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'firebaseui/dist/firebaseui.css';
import 'focus-visible/dist/focus-visible.min.js';

import logo from './assets/logo.svg';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

class Main extends React.Component {

  constructor(props) {
    super(props);

    const qParams = new URI().query(true);
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
      viewOnly: qParams.view ? true : false,
      queryParams: qParams,
      focus: {},
      changing: {
        all: true
      },
      alert: ''
    };
  }

  componentDidMount() {
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
      signInOptions: [
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
        firebase.auth.GoogleAuthProvider.PROVIDER_ID
      ]
    };

    window.ui.start('#js-Auth', uiConfig);

    this.setState({ showAuth: true });
  }

  initUser(user, uid) {
    let userDoc = this.database.doc('users/' + uid);
    userDoc.set({
      userId: uid,
      email: user.additionalUserInfo.profile.email,
      displayName: user.additionalUserInfo.profile.name,
      creationDate: Date.now(),
      lastLogin: Date.now()
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    })

    this.setState({
      settings: {
        email: user.additionalUserInfo.profile.email,
        displayName: user.additionalUserInfo.profile.name,
        userId: uid
      }
    });
  }

  signIn(user, uid) {
    if (user.additionalUserInfo && user.additionalUserInfo.isNewUser) {
      this.initUser(user, uid);
      return;
    }

    let userDoc = this.database.doc('users/' + uid);
    if (this.state.viewOnly) {
      const otherUid = this.startViewOnly();

      // If a user is viewing their own map
      if (uid === otherUid) {
        this.setState({
          viewOnly: false,
          viewSelf: true
        });
      }
    } else {
      this.loadUserData(userDoc);
    }

    userDoc.update({
      lastLogin: Date.now()
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
    let encoded = this.state.queryParams.view;
    let otherUid = window.atob(encoded).split('|')[0];
    let systemId = window.atob(encoded).split('|')[1];
    let userDoc = this.database.doc('users/' + otherUid);
    this.loadUserData(userDoc, systemId);
    this.loadSystemData(systemId, otherUid, true);

    return otherUid;
  }

  loadUserData(userDoc, autoSelectId) {
    userDoc.get().then((doc) => {
      if (doc) {
        const data = doc.data();
        if (data && data.systemIds && data.systemIds.length) {
          for (const systemId of data.systemIds) {
            // autoSelectId will be null except when view qparam is present
            if (systemId !== autoSelectId) {
              this.loadSystemData(systemId);
            }
          }

          let settings = JSON.parse(JSON.stringify(this.state.settings));
          settings.displayName = data.displayName;

          this.setState({
            settings: settings
          });
        } else if (data && (data.systemIds || []).length === 0) {
          let settings = JSON.parse(JSON.stringify(this.state.settings));
          settings.displayName = data.displayName;

          this.setState({
            settings: settings,
            newSystem: true
          });
        }
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });
  }

  loadSystemData(systemId, userId, autoSelect = false) {
    const systemOwner = userId ? userId : this.state.settings.userId;
    const docString = `users/${systemOwner}/systems/${systemId}`
    let systemDoc = this.database.doc(docString);
    systemDoc.get().then((doc) => {
      if (doc) {
        const data = doc.data();
        if (data && data.map) {
          let systemChoices = JSON.parse(JSON.stringify(this.state.systemChoices));
          systemChoices[systemId] = data;
          this.setState({
            systemChoices: systemChoices
          });

          if (autoSelect) {
            this.selectSystem(systemId);
          }
        }
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });
  }

  selectSystem(id) {
    if (this.state.queryParams && this.state.queryParams.writeDefault && (new URI()).hostname() === 'localhost') {
      // writeDefault should be the name of the file without extension
      // Put the file in src/
      // Used for building default systems
      const defSystem = require(`./${this.state.queryParams.writeDefault}.json`);
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
    }
  }

  setSystem(system, meta) {
    if (system && system.title) {
      document.querySelector('head title').innerHTML = 'Metro Dreamin\' | ' + system.title;
    }

    this.setState({
      history: [system],
      meta: meta,
      gotData: true
    });
  }

  newSystem() {
    const meta = JSON.parse(JSON.stringify(this.state.meta));
    meta.systemId = this.getNextSystemId();

    this.setState({
      newSystem: true,
      meta: meta
    });
  }

  signOut() {
    firebase.auth().signOut();
    window.location.reload();
  }

  handleGetShareableLink() {
    if (this.state.settings.noSave || this.state.viewOnly || !this.state.settings.userId) {
      return;
    }

    const el = document.createElement('textarea');
    el.value = this.getViewValue(this.state.meta.systemId);
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);

    this.handleSetAlert('Copied link to clipboard!');
  }

  handleOtherSystemSelect(systemId) {
    window.location.href =  this.getViewValue(systemId);
  }

  getViewValue(systemId) {
    let uri = new URI('https://metrodreamin.com');
    let encoded = window.btoa(`${this.state.settings.userId}|${systemId}`);
    uri.addQuery('view', encoded);
    return uri.toString();
  }

  handleGetTitle(title) {
    document.querySelector('head title').innerHTML = 'Metro Dreamin\' | ' + title;
    const history = JSON.parse(JSON.stringify(this.state.history));

    let system = this.getSystem();
    system.title = title;
    this.setState({
      history: history.concat([system]),
      newSystemSelected: true,
      isSaved: false
    });
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

    if (history.length > 1) {
      this.setState({
        history: history.slice(0, history.length - 1),
        focus: {},
        initial: false,
        changing: {
          stationIds: Array.from(stationSet),
          lineKeys: Array.from(lineSet)
        }
      });
    }
  }

  handleNoSave() {
    let settings = JSON.parse(JSON.stringify(this.state.settings));
    settings.noSave = true;
    this.setState({
      settings: settings,
      showAuth: false,
      newSystem : true
    });
  }

  handleSave() {
    let uid = this.state.settings.userId;
    if (this.state.queryParams && this.state.queryParams.writeDefault && (new URI()).hostname() === 'localhost') {
      // Used for building default systems
      uid = 'default';
      console.log('Saving to default system with id "' + this.state.meta.systemId + '".');
    }
    if (this.state.settings.noSave) {
      this.setupSignIn();
      this.handleSetAlert('Sign in to save!');
    } else {
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
        this.setState({
          isSaved: true
        })
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
            }).catch((error) => {
              console.log('Unexpected Error:', error);
            });
          }
        }
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });
    }
  }

  handleCloseFocus() {
    this.setState({
      focus: {}
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
    this.setState({
      history: history.concat([system]),
      meta: meta,
      focus: {
        station: JSON.parse(JSON.stringify(station))
      },
      changing: {
        stationIds: [station['id']]
      },
      initial: false,
      isSaved: false
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
    this.setState({
      history: history.concat([system]),
      focus: {},
      changing: {
        lineKeys: modifiedLines,
        stationIds: [station['id']]
      },
      initial: false,
      isSaved: false
    });
  }

  handleAddStationToLine(lineKey, station, position) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem(history);
    let line = system.lines[lineKey];

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
      initial: false,
      isSaved: false
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
      initial: false,
      isSaved: false
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
    if (lineKeys.length >= 20) {
      index = Math.floor(Math.random() * 20);
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

    this.setState({
      history: history.concat([system]),
      meta: meta,
      focus: {
        line: JSON.parse(JSON.stringify(system.lines[lineKey]))
      },
      initial: false,
      changing: {},
      isSaved: false
    });
  }

  handleLineDelete(line) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem();
    delete system.lines[line.id];

    this.setState({
      history: history.concat([system]),
      focus: {},
      changing: {
        lineKeys: [line.id],
        stationIds: line.stationIds
      },
      initial: false,
      isSaved: false
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

    this.setState({
      history: history.concat([system]),
      focus: {
        line: JSON.parse(JSON.stringify(line))
      },
      initial: false,
      changing: changing,
      isSaved: false
    });
  }

  handleStationInfoChange(station, replace = false) {
    let history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem();
    system.stations[station.id] = station;

    if (replace) {
      history[history.length - 1] = system;
    } else {
      history = history.concat([system]);
    }
    this.setState({
      history: history,
      initial: false,
      changing: {},
      isSaved: false
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
          content = <Station viewOnly={this.state.viewOnly} station={this.state.focus.station}
                             lines={this.getSystem().lines} stations={this.getSystem().stations}
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
    const sorter = (a, b) => {
      return a.map.title.toLowerCase() > b.map.title.toLowerCase() ? 1 : -1;
    }
    if (!this.state.gotData && Object.keys(this.state.systemChoices).length && !this.state.newSystem) {
      let choices = [];
      for (const system of Object.values(this.state.systemChoices).sort(sorter)) {
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
              Or start a new map
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
      <div id="js-Auth" className={this.state.showAuth ? 'Auth' : 'Auth Auth--gone'}>
        <button className="Auth-nosignin Link" onClick={() => this.handleNoSave()}>
          Continue without saving
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
             onGetTitle={(title) => this.handleGetTitle(title)}
             onSelectSystem={(system, meta) => this.setSystem(system, meta)} />
    );

    const showSplash = !this.state.showAuth && !showChoices && !showStart &&
                       !this.state.gotData && !this.state.newSystemSelected;
    const splash = (
      <div className="Main-splashWrap FadeAnim">
        <img className="Main-splash" src={logo} alt="Metro Dreamin'" />
      </div>
    );

    return (
      <div className="Main">
        {auth}
        {this.renderFadeWrap(showSplash ? splash : '')}
        {this.renderFadeWrap(this.renderAlert())}
        {this.renderFadeWrap(choices)}
        {this.renderFadeWrap(showStart ? start : '')}

        <Controls system={system} settings={settings} viewOnly={this.state.viewOnly}
                  initial={this.state.initial} gotData={this.state.gotData}
                  systemChoices={this.state.systemChoices} meta={this.state.meta}
                  newSystemSelected={this.state.newSystemSelected || false}
                  signOut={() => this.signOut()}
                  setupSignIn={() => this.setupSignIn()}
                  onSave={() => this.handleSave()}
                  onUndo={() => this.handleUndo()}
                  onAddLine={(line) => this.handleAddLine(line)}
                  onLineElemClick={(line) => this.handlLineElemClick(line)}
                  onGetShareableLink={() => this.handleGetShareableLink()}
                  onOtherSystemSelect={(systemId) => this.handleOtherSystemSelect(systemId)}
                  onGetTitle={(title) => this.handleGetTitle(title) } />

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
             newSystemSelected={this.state.newSystemSelected || false}
             onStopClick={(id) => this.handleStopClick(id)}
             onLineClick={(id) => this.handleLineClick(id)}
             onMapClick={(station) => this.handleMapClick(station)}
             onGetTitle={(title) => this.handleGetTitle(title)}
             onMapInit={(map) => this.handleMapInit(map)} />

        <ReactTooltip delayShow={400} border={true} />
      </div>
    );
  }
}

ReactDOM.render(<Main />, document.getElementById('root'));
