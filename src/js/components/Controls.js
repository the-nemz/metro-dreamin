import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
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
    this.setState({
      showSettings: !this.state.showSettings
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
      this.props.onGetTitle(value);
    }
    this.setState({
      title: '',
      titleChanging: false
    });
  }

  renderLines() {
    let sorter = (a, b) => {
      const aName = a.name.toUpperCase();
      const bName = b.name.toUpperCase();
      const partsA = aName.split(' ');
      const partsB = bName.split(' ');

      const firstA = parseInt(partsA[0]);
      const firstB = parseInt(partsB[0]);
      const lastA = parseInt(partsA[partsA.length - 1]);
      const lastB = parseInt(partsB[partsB.length - 1]);

      if (!isNaN(firstA) && !isNaN(firstB)) {
        return firstA === firstB ? (aName > bName ? 1 : -1) : firstA - firstB;
      } else if (!isNaN(lastA) && !isNaN(lastB)) {
        return lastA === lastB ? (aName > bName ? 1 : -1) : lastA - lastB;
      } else {
        return aName > bName ? 1 : -1
      }
    }

    const lines = Object.values(this.props.system.lines).sort(sorter);
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

    return this.renderTransition(
      <div className="Controls-right FadeAnim">
        <div className="Controls-userRow">
          <div className="Controls-name">
            Hello, {showName ? this.props.settings.displayName : 'Anon' }
          </div>
          {this.props.settings.noSave ? signInButton : signOutButton}
        </div>

        {this.props.viewOnly ? '' : shareableWrap}

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
      if (this.props.viewOnly) {
        const name = this.props.settings.displayName;
        title = `Viewing ${title}${name ? ' by ' + name : ''}`;
      }
      const titleElem = this.props.viewOnly ? (
        <input className="Controls-title"
               type="text" readOnly={this.props.viewOnly === true}
               title={title ? title : ''} value={title ? title : ''}>
        </input>
      ) : (
        <input className="Controls-title Controls-title--input"
               type="text" readOnly={this.props.viewOnly === true}
               title={title ? title : ''} value={title ? title : ''}
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

  render() {
    const system = this.props.system;

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

    const backButton = (
      <button className="Controls-back" onClick={() => this.toggleShowSettings()} title="Settings">
        <i className="fas fa-arrow-left fa-fw"></i>
      </button>
    );

    const buttonToUse = this.state.showSettings ? backButton : settingsButton;

    if (Object.keys(system.stations).length > 0 || (!this.props.initial && this.props.gotData)) {
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
                {this.state.collapsed ? 'Show Lines' : 'Hide Lines'}
                <i class="fas fa-chevron-down"></i>
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
