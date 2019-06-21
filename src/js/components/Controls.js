import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactTooltip from 'react-tooltip';

import { sortLines, sortSystems } from '../util.js';
import logo from '../../assets/logo.svg';

export class Controls extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      showSettings: false,
      titleChanging: false,
      collapsed: true
    };
  }

  handleExCol() {
    this.setState({
      collapsed: this.state.collapsed ? false : true
    });
  }

  toggleShowSettings() {
    ReactTooltip.hide();
    this.setState({
      showSettings: !this.state.showSettings,
      collapsed: false
    });
  }

  handleTitleChange(value) {
    this.setState({
      title: value,
      titleChanging: true
    });
  }

  handleTitleBlur(value) {
    if (value && value !== this.props.system.title) {
      this.props.onGetTitle(value.trim());
    }
    this.setState({
      title: '',
      titleChanging: false
    });
  }

  renderLines() {
    const lines = Object.values(this.props.system.lines).sort(sortLines);
    let lineElems = [];
    for (const lineKey in lines) {
      lineElems.push(
        <button className="Controls-lineWrap Link" key={lineKey} onClick={() => this.props.onLineElemClick(lines[lineKey])}>
          <div className="Controls-linePrev" style={{backgroundColor: lines[lineKey].color}}></div>
          <div className="Controls-line">
            {lines[lineKey].name}
          </div>
        </button>
      );
    }
    return (
      <div className="Controls-lines">
        {lineElems}
      </div>
    );
  }

  renderControls() {
    const system = this.props.system;

    const newLineWrap = (
      <div className="Controls-newLineWrap">
        <button className="Controls-newLine Link" onClick={() => this.props.onAddLine()}>Add a new line</button>
      </div>
    );

    return this.renderTransition(
      <div className={`Controls-right FadeAnim Controls-right--${this.state.collapsed ? 'collapsed' : 'expanded'}`}>
        {this.renderLines(system)}
        {this.props.viewOnly ? '' : newLineWrap}
      </div>
    );
  }

  renderOtherSystems() {
    let choices = [];
    if (Object.keys(this.props.systemChoices).length > 1) {
      for (const system of Object.values(this.props.systemChoices).sort(sortSystems)) {
        if (system.systemId !== this.props.meta.systemId) {
          choices.push(
            <button className="Controls-otherSystem Link" key={system.systemId}
                    onClick={() => this.props.onOtherSystemSelect(system.systemId)}>
              {system.map.title ? system.map.title : 'Unnamed System'}
            </button>
          );
        }
      }
    }
    return choices;
  }

  renderSettings() {
    const showName = this.props.settings.displayName && !this.props.settings.noSave;

    const signOutButton = (
      <button className="Controls-signOut Link" onClick={() => this.props.signOut()}>
        Sign Out
      </button>
    );

    const signInButton = (
      <button className="Controls-signIn Link" onClick={() => this.props.setupSignIn()}>
        Sign In
      </button>
    );

    const shareableWrap = (
      <div className="Controls-shareableWrap">
        <button className="Controls-shareable Link" onClick={() => this.props.onGetShareableLink()}>
          Get shareable link
        </button>
      </div>
    );

    const otherSystems = (
      <div className="Controls-otherSystems">
        <div className="Controls=otherSystemTitle">
          {this.props.viewOnly ? this.props.settings.displayName : 'Your'} other systems:
        </div>
        {this.renderOtherSystems()}
      </div>
    );

    return this.renderTransition(
      <div className="Controls-right FadeAnim">
        <div className="Controls-userRow">
          <div className="Controls-name">
            Hello, {showName ? this.props.settings.displayName : 'Anon'}
          </div>
          {this.props.settings.noSave ? signInButton : signOutButton}
        </div>

        {this.props.viewOnly ? '' : shareableWrap}

        {Object.keys(this.props.systemChoices).length > 1 ? otherSystems : ''}

        <div className="Controls-designation">
          <img className="Controls-logo" src={logo} alt="Metro Dreamin'" />
          <div className="Controls-copyright">
            Metro Dreamin', 2019
          </div>
        </div>
      </div>
    );
  }

  renderTitle() {
    if (!this.props.initial || this.props.gotData) {
      const sysTitle = this.props.system.title ? this.props.system.title : 'Metro Dreamin\'';
      let title = this.state.titleChanging ? this.state.title : sysTitle;
      const titleElem = this.props.viewOnly ? (
        <input className="Controls-title"
               type="text" readOnly={this.props.viewOnly === true}
               value={title ? title : ''}></input>
      ) : (
        <input className="Controls-title Controls-title--input"
               type="text" readOnly={this.props.viewOnly === true}
               data-tip="Tap to change title" value={title ? title : ''}
               onChange={(e) => this.handleTitleChange(e.target.value)}
               onBlur={(e) => this.handleTitleBlur(e.target.value)}></input>
      );
      return (
        <div className="Controls-titleWrap">
          {titleElem}
        </div>
      );
    }
  }

  renderTransition(content) {
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

  componentDidMount() {
    ReactTooltip.rebuild();
  }

  componentDidUpdate() {
    ReactTooltip.rebuild();
  }

  render() {
    const system = this.props.system;

    const settingsButton = (
      <button className="Controls-settings" onClick={() => this.toggleShowSettings()} data-tip="Settings">
        <i className="fas fa-ellipsis-v fa-fw"></i>
      </button>
    );

    const saveButton = (
      <button className="Controls-save" onClick={() => this.props.onSave()} data-tip="Save">
        <i className="far fa-save fa-fw"></i>
      </button>
    );

    const undoButton = (
      <button className="Controls-undo" onClick={() => this.props.onUndo()} data-tip="Undo">
        <i className="fas fa-undo fa-fw"></i>
      </button>
    );

    const backButton = (
      <button className="Controls-back" onClick={() => this.toggleShowSettings()} data-tip="Lines">
        <i className="fas fa-arrow-left fa-fw"></i>
      </button>
    );

    const buttonToUse = this.state.showSettings ? backButton : settingsButton;

    if (Object.keys(system.stations).length > 0 || this.props.newSystemSelected ||
        (!this.props.initial && this.props.gotData)) {
      return (
        <div className={`Controls Controls--${this.state.showSettings ? 'settings' : 'main'}`}>
          {this.renderTitle()}

          <div className="Controls-main">
            <div className="Controls-left">
              {buttonToUse}
              {this.props.viewOnly ? '' : saveButton}
              {this.props.viewOnly ? '' : undoButton}

              <button className={`Controls-exCol Controls-exCol--${this.state.collapsed ? 'collapsed' : 'expanded'}`}
                      onClick={() => this.handleExCol()}>
                <span className="Controls-exColText">
                  {this.state.collapsed ? 'Show Lines' : 'Hide Lines'}
                </span>
                <i className="fas fa-chevron-down"></i>
              </button>
            </div>

            {this.state.showSettings ? this.renderSettings() : ''}
            {this.state.showSettings ? '' : this.renderControls()}
          </div>
        </div>
      );
    }

    return null;
  }
}
