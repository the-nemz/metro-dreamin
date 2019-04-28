import React from 'react';

export class Controls extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      showSettings: false
    };
  }

  toggleShowSettings() {
    this.setState({
      showSettings: !this.state.showSettings
    });
  }

  renderLines() {
    const lines = this.props.system.lines;
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
    const settings = this.props.settings;

    const settingsButton = (
      <button className="Controls-settings" onClick={() => this.toggleShowSettings()} title="Settings">
        <i className="fas fa-ellipsis-v fa-fw"></i>
      </button>
    );

    const saveButton = (
      <button className="Controls-save" onClick={() => this.props.onSave()} title="Save">
        <i className="far fa-save fa-fw"></i>
      </button>
    );

    const undoButton = (
      <button className="Controls-undo" onClick={() => this.props.onUndo()} title="Undo">
        <i className="fas fa-undo fa-fw"></i>
      </button>
    );

    const newLineWrap = (
      <div className="Controls-newLineWrap">
        <button className="Controls-newLine Link" onClick={() => this.props.onAddLine()}>Add a new line</button>
      </div>
    );

    return (
      <div className="Controls Controls--default">
        <div className="Controls-left">
          {this.props.viewOnly ? '' : settingsButton}
          {this.props.viewOnly ? '' : saveButton}
          {this.props.viewOnly ? '' : undoButton}
        </div>
        <div className="Controls-right">
          {this.renderLines(system)}
          {newLineWrap}
        </div>
      </div>
    );
  }

  renderSettings() {
    const showName = this.props.settings.displayName && !this.props.settings.noSave;

    const backButton = (
      <button className="Controls-back" onClick={() => this.toggleShowSettings()} title="Settings">
        <i className="fas fa-arrow-left fa-fw"></i>
      </button>
    );

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

    return (
      <div className="Controls Controls--settings">
        {backButton}
        <div className="Controls-userRow">
          <div className="Controls-name">
            Hello, {showName ? this.props.settings.displayName : 'Anon' }
          </div>
          {this.props.settings.noSave ? signInButton : signOutButton}
        </div>

        {this.props.viewOnly ? '' : shareableWrap}
      </div>
    );
  }

  render() {
    const system = this.props.system;

    if (Object.keys(system.stations).length > 0 || (!this.props.initial && this.props.gotData)) {

      return this.state.showSettings ? this.renderSettings() : this.renderControls()
    }

    return null;
  }
}
