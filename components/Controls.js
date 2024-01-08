import React from 'react';
import ReactGA from 'react-ga4';

import { sortLines } from '/util/helpers.js';

import { MapStyles } from '/components/MapStyles.js';

export class Controls extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      titleChanging: false,
      collapsed: true
    };
  }

  handleExCol() {
    this.setState({
      collapsed: this.state.collapsed ? false : true
    });

    ReactGA.event({
      category: 'System',
      action: 'Expand/Collapse Controls'
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
        <button className="Controls-lineWrap Link" key={lineKey} onClick={() => {
            if (this.props.isMobile) this.setState({ collapsed: true });
            this.props.onLineElemClick(lines[lineKey]);
          }}>
          <div className="Controls-linePrev" style={{backgroundColor: lines[lineKey].color}}></div>
          <div className="Controls-line">
            {lines[lineKey].name}
          </div>
        </button>
      );
    }

    return (
      <div className="Controls-lines">
        {lineElems.length ? lineElems : 'No lines yet'}
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

    return (
      <div className={`Controls-right FadeAnim Controls-right--${this.state.collapsed ? 'collapsed' : 'expanded'}`}>
        <MapStyles mapStyleOverride={this.props.mapStyleOverride} setMapStyleOverride={this.props.setMapStyleOverride} />
        {this.renderLines(system)}
        {this.props.viewOnly ? '' : newLineWrap}
      </div>
    );
  }

  renderTitle() {
    const sysTitle = this.props.system.title ? this.props.system.title : 'MetroDreamin\'';
    let title = this.state.titleChanging ? this.state.title : sysTitle;
    const titleElem = this.props.viewOnly ? (
      <input className="Controls-title"
              type="text" readOnly={this.props.viewOnly === true}
              value={title ? title : ''}></input>
    ) : (
      <input className="Controls-title Controls-title--input"
              type="text" readOnly={this.props.viewOnly === true}
              data-tooltip-content="Tap to change title" value={title ? title : ''}
              onChange={(e) => this.handleTitleChange(e.target.value)}
              onBlur={(e) => this.handleTitleBlur(e.target.value)}></input>
    );

    return (
      <div className="Controls-titleWrap">
        {titleElem}
      </div>
    );
  }

  render() {
    const collapseButton = (
      <button className="Controls-compress" onClick={() => this.props.onExitFullscreen()} data-tooltip-content="Exit fullscreen">
        <i className="fas fa-compress"></i>
      </button>
    );

    const saveButton = (
      <button className="Controls-save" data-tooltip-content="Save"
              onClick={() => {
                if (!this.props.firebaseContext.user || !this.props.firebaseContext.user.uid) {
                  this.props.handleSetAlert('Log in to save your map!');
                }
                this.props.onSave();
              }}>
        <i className="far fa-save fa-fw"></i>
      </button>
    );

    const undoButton = (
      <button className="Controls-undo" onClick={() => this.props.onUndo()} data-tooltip-content="Undo">
        <i className="fas fa-undo fa-fw"></i>
      </button>
    );

    return (
      <div className={`Controls Controls--${this.state.showSettings ? 'settings' : 'main'}`}>
        {this.renderTitle()}

        <div className="Controls-main">
          <div className="Controls-left">
            {collapseButton}
            {!this.props.viewOnly && saveButton}
            {!this.props.viewOnly && undoButton}

            <button className={`Controls-exCol Controls-exCol--${this.state.collapsed ? 'collapsed' : 'expanded'}`}
                    onClick={() => this.handleExCol()}>
              <span className="Controls-exColText">
                {this.state.collapsed ? 'Show more' : 'Show less'}
              </span>
              <i className="fas fa-chevron-down"></i>
            </button>
          </div>

          {this.renderControls()}
        </div>
      </div>
    );
  }
}
