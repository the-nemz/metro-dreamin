import React from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl';
import firebase from 'firebase';
import firebaseui from 'firebaseui';
import URI from 'urijs';

import { Line } from './js/components/Line.js';
import { Map } from './js/components/Map.js';
import { Station } from './js/components/Station.js';

import './default.scss';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'firebaseui/dist/firebaseui.css';
import 'focus-visible/dist/focus-visible.min.js';

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
        nextLineId: '1'
      },
      settings: {
        noSave: true
      },
      initial: true,
      viewOnly: qParams.view ? true : false,
      queryParams: qParams,
      focus: {},
      changing: {
        all: true
      }
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
      this.startViewOnly();
    }
  }

  setupSignIn() {
    const uiConfig = {
      callbacks: {
        signInSuccessWithAuthResult: (user) => {
          const currentUser = firebase.auth().currentUser;
          this.signIn(user, currentUser.uid);
          document.querySelector('#js-Auth').style.display = 'none';
          return false;
        },
      },
      signInOptions: [
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
        firebase.auth.GoogleAuthProvider.PROVIDER_ID
      ]
    };

    window.ui.start('#js-Auth', uiConfig);
    document.querySelector('#js-Auth').style.display = 'flex';
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
          viewOnly: false
        });
      }
    } else {
      this.loadData(userDoc);
    }

    userDoc.update({
      lastLogin: Date.now()
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });

    if (user.email && user.displayName) {
      this.setState({
        settings: {
          email: user.email,
          displayName: user.displayName,
          userId: uid,
          noSave: false
        }
      });
    }
  }

  startViewOnly() {
    let encoded = this.state.queryParams.view;
    let otherUid = window.atob(encoded).split('|')[0];
    let userDoc = this.database.doc('users/' + otherUid);
    this.loadData(userDoc);

    return otherUid;
  }

  loadData(userDoc) {
    userDoc.get().then((doc) => {
      if (doc) {
        const data = doc.data();
        if (data && data.map) {
          if (data.map.title) {
            document.querySelector('head title').innerHTML = 'Metro Dreamin | ' + data.map.title;
          }

          let heading = document.querySelector('.Map-heading');
          let geoElem = document.querySelector('.mapboxgl-ctrl-geocoder');
          geoElem.dataset.removed = true;
          heading.style.display = 'none';
          geoElem.style.display = 'none';

          let meta = {
            nextLineId: data.nextLineId ? data.nextLineId : '1',
            nextStationId: data.nextStationId ? data.nextStationId : '0'
          };

          let settings = JSON.parse(JSON.stringify(this.state.settings));
          settings.displayName = data.displayName;

          this.setState({
            history: [data.map],
            meta: meta,
            gotData: true,
            settings: settings
          });
        }
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
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
    const domain = 'https://metrodreamin.com';
    let encoded = window.btoa(`${this.state.settings.userId}|0`);
    alert(`${domain}?view=${encoded}`);
  }

  handleGetTitle(title) {
    document.querySelector('head title').innerHTML = 'Metro Dreamin | ' + title;
    const history = JSON.parse(JSON.stringify(this.state.history));

    let system = this.getSystem();
    system.title = title;
    this.setState({
      history: history.concat([system])
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
    document.querySelector('#js-Auth').style.display = 'none';
    let settings = JSON.parse(JSON.stringify(this.state.settings));
    settings.noSave = true;
    this.setState({
      settings: settings
    });
  }

  handleSave() {
    if (this.state.viewOnly) {
      return;
    }

    if (this.state.settings.noSave) {
      this.setupSignIn();
      alert('Sign in to save!');
    } else {
      let userDoc = this.database.doc('users/' + this.state.settings.userId);
      userDoc.update({
        nextLineId: this.state.meta.nextLineId,
        nextStationId: this.state.meta.nextStationId,
        map: this.getSystem()
      }).then(() => {
        alert('Saved!');
      }).catch((error) => {
        console.log('Unexpected Error:', error);
      });
    }
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
      initial: false
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
      initial: false
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
      initial: false
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
      initial: false
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
      changing: {}
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
      changing: changing
    });
  }

  handleStationInfoChange(station) {
    const history = JSON.parse(JSON.stringify(this.state.history));
    let system = this.getSystem();
    system.stations[station.id] = station;

    this.setState({
      history: history.concat([system]),
      focus: {
        station: JSON.parse(JSON.stringify(station))
      },
      initial: false,
      changing: {}
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

  getSystem() {
    return JSON.parse(JSON.stringify(this.state.history[this.state.history.length - 1]));
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
    if (this.state.focus) {
      const type = Object.keys(this.state.focus)[0];
      switch (type) {
        case 'station':
          return <Station viewOnly={this.state.viewOnly} station={this.state.focus.station}
                          lines={this.getSystem().lines} stations={this.getSystem().stations}
                          onAddToLine={(lineKey, station, position) => this.handleAddStationToLine(lineKey, station, position)}
                          onDeleteStation={(station) => this.handleStationDelete(station)}
                          onStationInfoChange={(station) => this.handleStationInfoChange(station)}
                          onLineClick={(line) => this.handlLineElemClick(line)} />
        case 'line':
          return <Line viewOnly={this.state.viewOnly} line={this.state.focus.line} system={this.getSystem()}
                       onLineInfoChange={(line, renderMap) => this.handleLineInfoChange(line, renderMap)}
                       onStationRemove={(line, stationId) => this.handleRemoveStationFromLine(line, stationId)} />
        default:
          return;
      }
    }
    return;
  }

  renderTitle() {
    const system = this.getSystem();

    if (Object.keys(system.stations).length === 0) {
      return (
        <div className="Main-titleWrap">
          <div className="Main-initial">
            Click on the map to add a station
          </div>
        </div>
      );
    } else if (!this.state.initial || this.state.gotData) {
      let title = system.title ? system.title : 'Metro Dreamin\'';
      if (this.state.viewOnly) {
        const name = this.state.settings.displayName;
        title = `Viewing ${title}${name ? ' by ' + name : ''}`;
      }
      return (
        <div className="Main-titleWrap">
          <div className="Main-title">
            {title}
          </div>
        </div>
      );
    }
  }

  renderMain() {
    const system = this.getSystem();

    const signOutButton = (
      <button className="Main-signOut Link" onClick={() => this.signOut()}>
        Sign Out
      </button>
    );
    const signInButton = (
      <button className="Main-signIn Link" onClick={() => this.setupSignIn()}>
        Sign In
      </button>
    );

    if (Object.keys(system.stations).length > 0 || (!this.state.initial && this.state.gotData)) {
      const showName = this.state.settings.displayName && !this.state.settings.noSave;
      const shareableWrap = (
        <div className="Main-shareableWrap">
          <button className="Main-shareable Link" onClick={() => this.handleGetShareableLink()}>Get shareable link</button>
        </div>
      );
      const saveButton = (
        <button className="Main-save" onClick={() => this.handleSave()} title="Save">
          <i className="far fa-save"></i>
        </button>
      );
      const undoButton = (
        <button className="Main-undo" onClick={() => this.handleUndo()} title="Undo">
          <i className="fas fa-undo"></i>
        </button>
      );
      const newLineWrap = (
        <div className="Main-newLineWrap">
          <button className="Main-newLine Link" onClick={() => this.handleAddLine()}>Add a new line</button>
        </div>
      );
      return (
        <div className="Main-upper">
          <div className="Main-userRow">
            <div className="Main-name">
              Hello, {showName ? this.state.settings.displayName : 'Anon' }
            </div>
            {this.state.settings.noSave ? signInButton : signOutButton}
          </div>
          {this.state.viewOnly ? '' : shareableWrap}
          {this.state.viewOnly ? '' : saveButton}
          {this.state.viewOnly ? '' : undoButton}
          {this.renderLines(system)}
          {this.state.viewOnly ? '' : newLineWrap}
        </div>
      );
    } else {
      return;
    }
  }

  render() {
    const system = this.getSystem();
    const meta = this.state.meta;

    return (
      <div className="Main">
        <div id="js-Auth" className="Auth">
          <button className="Auth-nosignin Link" onClick={() => this.handleNoSave()}>
            Continue without saving
          </button>
        </div>

        {this.renderTitle()}
        {this.renderMain()}
        {this.renderFocus()}

        <Map system={system} meta={meta} changing={this.state.changing}
             initial={this.state.initial} gotData={this.state.gotData} viewOnly={this.state.viewOnly}
             onStopClick={(id) => this.handleStopClick(id)}
             onLineClick={(id) => this.handleLineClick(id)}
             onMapClick={(station) => this.handleMapClick(station)}
             onGetTitle={(title) => this.handleGetTitle(title) } />
      </div>
    );
  }
}

ReactDOM.render(<Main />, document.getElementById('root'));
