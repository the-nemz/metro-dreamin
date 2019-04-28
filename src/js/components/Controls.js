import React from 'react';

export class Controls extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      showSettings: false
    };
  }

  handleSettingsClick() {
    this.setState({
      showSettings: true
    });
  }

  renderLines() {
    const lines = this.props.system.lines;
    let lineElems = [];
    for (const lineKey in lines) {
      lineElems.push(
        <button className="Main-lineWrap Link" key={lineKey} onClick={() => this.props.onLineElemClick(lines[lineKey])}>
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

  renderMain() {
    const system = this.props.system;
    const settings = this.props.settings;

    const settingsButton = (
      <button className="Main-settings" onClick={() => this.handleSettingsClick()} title="Settings">
        <i className="fas fa-ellipsis-v fa-fw"></i>
      </button>
    );

    const saveButton = (
      <button className="Main-save" onClick={() => this.props.onSave()} title="Save">
        <i className="far fa-save fa-fw"></i>
      </button>
    );

    const undoButton = (
      <button className="Main-undo" onClick={() => this.props.onUndo()} title="Undo">
        <i className="fas fa-undo fa-fw"></i>
      </button>
    );

    const newLineWrap = (
      <div className="Main-newLineWrap">
        <button className="Main-newLine Link" onClick={() => this.props.onAddLine()}>Add a new line</button>
      </div>
    );

    return (
      <div className="Main-upper Main-upper--default">
        <div className="Main-upperLeft">
          {this.props.viewOnly ? '' : settingsButton}
          {this.props.viewOnly ? '' : saveButton}
          {this.props.viewOnly ? '' : undoButton}
        </div>
        <div className="Main-upperRight">
          {this.renderLines(system)}
          {newLineWrap}
        </div>
      </div>
    );
  }

  renderSettings() {
    const showName = this.props.settings.displayName && !this.props.settings.noSave;
    const signOutButton = (
      <button className="Main-signOut Link" onClick={() => this.props.signOut()}>
        Sign Out
      </button>
    );
    const signInButton = (
      <button className="Main-signIn Link" onClick={() => this.props.setupSignIn()}>
        Sign In
      </button>
    );
    const shareableWrap = (
      <div className="Main-shareableWrap">
        <button className="Main-shareable Link" onClick={() => this.props.onGetShareableLink()}>
          Get shareable link
        </button>
      </div>
    );

    return (
      <div className="Main-upper Main-upper--settings">
        <div className="Main-userRow">
          <div className="Main-name">
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
    const settings = this.props.settings;

    if (Object.keys(system.stations).length > 0 || (!this.props.initial && this.props.gotData)) {
      const showName = settings.displayName && !settings.noSave;
      // const shareableWrap = (
      //   <div className="Main-shareableWrap">
      //     <button className="Main-shareable Link" onClick={() => this.handleGetShareableLink()}>Get shareable link</button>
      //   </div>
      // );
      const newLineWrap = (
        <div className="Main-newLineWrap">
          <button className="Main-newLine Link" onClick={() => this.props.onAddLine()}>Add a new line</button>
        </div>
      );
      return this.state.showSettings ? this.renderSettings() : this.renderMain()
      // return (
      //     {/* <div className="Main-userRow">
      //       <div className="Main-name">
      //         Hello, {showName ? this.state.settings.displayName : 'Anon' }
      //       </div>
      //       {this.state.settings.noSave ? signInButton : signOutButton}
      //     </div>
      //     {this.state.viewOnly ? '' : shareableWrap}
      //     {this.state.viewOnly ? '' : saveButton}
      //     {this.state.viewOnly ? '' : undoButton}
      //     {this.renderLines(system)}
      //     {this.state.viewOnly ? '' : newLineWrap} */}

      //     {this.state.showSettings ? this.renderSettings() : this.renderMain()}
      // );
    }

    return null;
  }
}
