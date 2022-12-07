import React from 'react';
import Link from 'next/link';
// import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';

import { sortLines, sortSystems, getViewURL } from '/lib/util.js';
import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

import { StarAndCount } from '/components/StarAndCount.js';
import { Toggle } from '/components/Toggle.js';

export class Controls extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      showSettings: false,
      titleChanging: false,
      collapsed: true
    };
  }

  toggleShowSettings() {
    ReactTooltip.hide();
    this.setState({
      showSettings: !this.state.showSettings,
      collapsed: false
    });

    ReactGA.event({
      category: 'Controls',
      action: 'Toggle Show Settings'
    });
  }

  isShareable() {
    // TODO: add a toast if the map isn't shareable yet (not saved)
    return this.props.ownerDocData && this.props.ownerDocData.userId && this.props.meta.systemId;
  }

  handleExCol() {
    this.setState({
      collapsed: this.state.collapsed ? false : true
    });

    ReactGA.event({
      category: 'Controls',
      action: 'Expand/Collapse'
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

    ReactGA.event({
      category: 'Controls',
      action: 'Change Map Title'
    });
  }

  handleSignIn() {
    this.handleExCol();
    this.props.setupSignIn();
  }

  handleTwitterShare() {
    if (!this.isShareable()) return;

    const shareUrl = getViewURL(this.props.ownerDocData.userId, this.props.meta.systemId);
    const tweetText = "&text=" + encodeURIComponent("Check out my dream map" +
                                                    (this.props.system.title ? " of " + this.props.system.title : "") +
                                                    "!");
    const twitterUrl = "https://twitter.com/intent/tweet?url=" + encodeURI(shareUrl) + tweetText;
    ReactGA.event({
      category: 'Share',
      action: 'Twitter'
    });
    window.open(twitterUrl, '_blank');
  }

  async handleGetShareableLink() {
    if (!this.isShareable()) return;

    const shareUrl = getViewURL(this.props.ownerDocData.userId, this.props.meta.systemId);
    try {
      await navigator.clipboard.writeText(shareUrl);
      this.props.setToast('Copied to clipboard!')
    } catch (err) {
      console.error('handleGetShareableLink: ', err);
      this.props.setToast('Failed to copy');
    }
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
        {this.renderLines(system)}
        {this.props.viewOnly ? '' : newLineWrap}
      </div>
    );
  }

  renderOtherSystems() {
    let choices = [];
    if (Object.keys(this.props.systemChoices).length) {
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

    const startNew = () => {
      this.props.router.push({
        pathname: '/view'
      });
    };
    choices.push(
      <button className="Controls-otherSystem Link" key="new" onClick={startNew}>
        Start a new map
      </button>
    );
    return choices;
  }

  renderSettings() {
    const showName = this.props.settings.displayName && this.props.settings.userId;

    const signOutButton = (
      <button className="Controls-signOut Link" onClick={() => this.props.signOut()}>
        Sign Out
      </button>
    );

    const signInButton = (
      <button className="Controls-signIn Link" onClick={() => this.handleSignIn()}>
        Sign In
      </button>
    );

    // TODO: add this back if we actually want it
    // const facebookWrap = (
    //   <div className="Controls-shareWrap">
    //     <button className="Controls-share Controls-share--facebook" onClick={() => this.props.onShareToFacebook()}>
    //       <i className="fab fa-facebook"></i>
    //       <span className="Controls-shareText">Share on Facebook</span>
    //     </button>
    //   </div>
    // );

    const twitterWrap = (
      <div className="Controls-shareWrap">
        <button className="Controls-share Controls-share--twitter"
                onClick={() => this.handleTwitterShare()}>
          <i className="fab fa-twitter"></i>
          <span className="Controls-shareText">Share on Twitter</span>
        </button>
      </div>
    );

    const shareableWrap = (
      <div className="Controls-shareWrap">
        <button className="Controls-share Controls-share--copy"
                onClick={() => this.handleGetShareableLink()}>
          <i className="fas fa-copy"></i>
          <span className="Controls-shareText">Copy shareable link</span>
        </button>
      </div>
    );

    const privateToggle = (
      <button className="Controls-privateButton Link" onClick={() => this.props.onTogglePrivate()}
              data-tip={this.props.isPrivate ? 'Click to make this map appear in search' : 'Click to make this map only accessible with a link'}>
        <div className={`Controls-private`}>
          <i className={this.props.isPrivate ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
        </div>
        <div className="Controls-privateText">
          {this.props.isPrivate ? 'Map is Private' : 'Map is Public'}
        </div>
      </button>
    );

    const waypointsToggle = (
      <Toggle onClick={() => this.props.onToggleWapoints()}
              tip={this.props.waypointsHidden ? 'Click show waypoints' : 'Click to hide waypoints'}
              isOn={!this.props.waypointsHidden || false}
              text={this.props.waypointsHidden ? 'Waypoints hidden' : 'Waypoints visible'} />
    );

    let otherMapsText = 'Get started on your own map';
    if (this.props.settings.userId) {
      if (this.props.viewOnly) {
        otherMapsText = 'Work on your own maps';
      } else {
        otherMapsText = 'Work on your other maps';
      }
    }
    const ownSystems = (
      <div className="Controls-ownSystems">
        <Link className="Controls-ownSystem Link" href="/view/own"
                onClick={() => {
                  ReactGA.event({
                    category: 'Controls',
                    action: 'Own Maps'
                  });
                }}>
          {otherMapsText}
        </Link>
      </div>
    );

    return this.renderTransition(
      <div className={`Controls-right FadeAnim Controls-right--${this.state.collapsed ? 'collapsed' : 'expanded'}`}>
        <div className="Controls-userRow">
          <div className="Controls-name">
            Hello, {showName ? this.props.settings.displayName : 'Anon'}
          </div>
          {this.props.settings.userId ? signOutButton : signInButton}
        </div>

        {/* {this.props.viewOnly ? '' : facebookWrap} */}
        {twitterWrap}
        {shareableWrap}

        <div className="Controls-toggles">
          {this.props.viewOnly ? '' : privateToggle}
          {this.props.viewOnly ? '' : waypointsToggle}
        </div>

        {ownSystems}

        <div className="Controls-designation">
          <button className="Link" onClick={this.props.onHomeClick}>
            <img className="Controls-logo" src={this.props.useLight ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
            <div className="Controls-copyright">
              © {(new Date()).getFullYear()} MetroDreamin'
            </div>
          </button>
          <div className="Controls-miscLinks">
            <a className="Controls-privacy Link" href="privacypolicy.html"
              target="_blank" rel="nofollow noopener noreferrer"
              onClick={() => ReactGA.event({ category: 'Controls', action: 'Privacy' })}>
              Privacy Policy
            </a>
            <a className="Controls-source Link" href="https://github.com/the-nemz/metro-dreamin"
              target="_blank" rel="nofollow noopener noreferrer"
              onClick={() => ReactGA.event({ category: 'Controls', action: 'GitHub' })}>
              Source Code
            </a>
          </div>
        </div>
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
              data-tip="Tap to change title" value={title ? title : ''}
              onChange={(e) => this.handleTitleChange(e.target.value)}
              onBlur={(e) => this.handleTitleBlur(e.target.value)}></input>
    );

    const starButton = this.props.viewId ? <StarAndCount {...this.props} modifier={'controls'} /> : (
      <button className="Controls-dummyStar" onClick={() => {
                                                              this.props.onSetAlert('Save your map before starring!');
                                                              ReactGA.event({ category: 'Controls', action: 'Star not Saved' });
                                                            }}>
        <i className="far fa-star"></i>
      </button>
    );

    return (
      <div className="Controls-titleWrap">
        {titleElem}

        {this.props.viewOnly ? '' : starButton}
      </div>
    );
  }

  renderTransition(content) {
    // return (
    //   <ReactCSSTransitionGroup
    //       transitionName="FadeAnim"
    //       transitionAppear={true}
    //       transitionAppearTimeout={400}
    //       transitionEnter={true}
    //       transitionEnterTimeout={400}
    //       transitionLeave={true}
    //       transitionLeaveTimeout={400}>
    //     {content}
    //   </ReactCSSTransitionGroup>
    // );
    return (
      <>
        {content}
      </>
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
      <button className="Controls-settings" onClick={() => this.toggleShowSettings()} data-tip="More options">
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
    return (
      <div className={`Controls Controls--${this.state.showSettings ? 'settings' : 'main'}`}>
        {this.renderTitle()}

        <div className="Controls-main">
          <div className="Controls-left">
            {buttonToUse}
            {!this.props.viewOnly && saveButton}
            {!this.props.viewOnly && undoButton}

            <button className={`Controls-exCol Controls-exCol--${this.state.collapsed ? 'collapsed' : 'expanded'}`}
                    onClick={() => this.handleExCol()}>
              <span className="Controls-exColText">
                {this.state.collapsed ? 'Show Lines' : 'Hide Lines'}
              </span>
              <i className="fas fa-chevron-down"></i>
            </button>
          </div>

          {this.state.showSettings ? this.renderSettings() : this.renderControls()}
        </div>
      </div>
    );
  }
}
