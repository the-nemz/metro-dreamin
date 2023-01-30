import React, { useState, useEffect, useContext, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ReactGA from 'react-ga';
import classNames from 'classnames';

import { renderFadeWrap, renderFocusWrap, timestampToText, enterFullscreen } from '/lib/util.js';
import { useCommentsForSystem } from '/lib/hooks.js';
import { FirebaseContext } from '/lib/firebase.js';
import { INITIAL_SYSTEM, INITIAL_META, FLY_TIME } from '/lib/constants.js';

import { Ancestry } from '/components/Ancestry.js';
import { BranchAndCount } from '/components/BranchAndCount.js';
import { CommentAndCount } from '/components/CommentAndCount.js';
import { Comments } from '/components/Comments.js';
import { Controls } from '/components/Controls.js';
import { Description } from '/components/Description.js';
import { Line } from '/components/Line.js';
import { LineButtons } from '/components/LineButtons.js';
import { LinesDrawer } from '/components/LinesDrawer.js';
import { Map } from '/components/Map.js';
import { Related } from '/components/Related.js';
import { Share } from '/components/Share.js';
import { Shortcut } from '/components/Shortcut.js';
import { StarAndCount } from '/components/StarAndCount.js';
import { Station } from '/components/Station.js';
import { Title } from '/components/Title.js';
import { Toggle } from '/components/Toggle.js';
import { UserIcon } from '/components/UserIcon.js';
import { ViewOnly } from '/components/ViewOnly.js';

export function System({ownerDocData = {},
                        systemDocData = {},
                        isNew = false,
                        thumbnail = null,
                        newMapBounds = [],
                        viewOnly = true,
                        system = INITIAL_SYSTEM,
                        meta = INITIAL_META,
                        isSaved = true,
                        isPrivate = false,
                        waypointsHidden = false,
                        recent = {},
                        changing = { all: true },
                        interlineSegments = {},
                        focusFromEdit = null,
                        alert = null,
                        toast = null,
                        prompt = null,

                        onToggleShowAuth = () => {},
                        preToggleMapStyle = () => {},
                        onToggleMapStyle = () => {},

                        handleSetToast = () => {},
                        handleSetAlert = () => {},
                        handleSave = () => {},
                        handleTogglePrivate = () => {},
                        handleAddStationToLine = () => {},
                        handleStationDelete = () => {},
                        handleConvertToWaypoint = () => {},
                        handleConvertToStation = () => {},
                        handleWaypointOverride= () => {},
                        handleLineInfoChange = () => {},
                        handleRemoveStationFromLine = () => {},
                        handleRemoveWaypointsFromLine = () => {},
                        handleReverseStationOrder = () => {},
                        handleLineDelete = () => {},
                        handleLineDuplicate = () => {},
                        handleMapClick = () => {},
                        handleToggleWaypoints = () => {},
                        handleUndo = () => {},
                        handleAddLine = () => {},
                        handleGetTitle = () => {},
                        handleSetCaption = () => {},
                        handleStationInfoChange = () => {}}) {

  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);
  const systemEl = useRef(null);
  const commentEl = useRef(null);
  const commentData = useCommentsForSystem({ systemId: systemDocData.systemId || '' });

  const [focus, setFocus] = useState(focusFromEdit || {});
  const [map, setMap] = useState();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ isMobile, setIsMobile ] = useState(false);
  const [ isOpen, setIsOpen ] = useState(true);
  // const [windowDims, setWindowDims] = useState({ width: window.innerWidth || 0, height: window.innerHeight || 0 });

  useEffect(() => {
    if (isNew) {
      setTimeout(() => handleSetAlert('Tap the map to add a station!'), FLY_TIME - 2000);
    }

    const fullscreenchanged = () => {
      if (document.fullscreenElement && document.fullscreenElement.classList.contains('System')) {
        setIsFullscreen(true);
      } else {
        setIsFullscreen(false);
      }
    }

    document.addEventListener('fullscreenchange', fullscreenchanged);

    let resizeTimeout;
    if (window) {
      handleResize();
  
      onresize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 50);
      };
    }

    return () => {
      document.removeEventListener('fullscreenchange', fullscreenchanged);
      clearTimeout(resizeTimeout);
      onresize = () => {};
    };
  }, []);

  useEffect(() => {
    if (!viewOnly && !isSaved) {
      window.onbeforeunload = function(e) {
        e.returnValue = 'You have unsaved changes to your map! Do you want to continue?';
      };
    } else {
      window.onbeforeunload = null;
    }
  }, [viewOnly, isSaved]);

  useEffect(() => {
    if (map && isNew && (newMapBounds || []).length) {
      map.fitBounds(newMapBounds, { duration: FLY_TIME });
    }
  }, [map, newMapBounds]);

  useEffect(() => {
    if (focusFromEdit == null) return;

    if (Object.keys(focusFromEdit).join() !== Object.keys(focus).join()) {
      setFocus(focusFromEdit);
    }

    if ('station' in focusFromEdit && 'station' in focus && focusFromEdit.station.id !== focus.station.id) {
      setFocus(focusFromEdit);
    }

    if ('line' in focusFromEdit && 'line' in focus && focusFromEdit.line.id !== focus.line.id) {
      setFocus(focusFromEdit);
    }
  }, [focusFromEdit]);

  const handleResize = () => {
    const isMobileWidth = window.innerWidth <= 991;
    if (isMobileWidth && !isMobile) {
      setIsMobile(true);
    } else if (!isMobileWidth) {
      setIsMobile(false);
    }
  }

  const handleMapInit = (map) => {
    setMap(map);
  }

  const handleStopClick = (id) => {
    // setChanging({});
    setFocus({
      station: system.stations[id]
    });
  }

  const handleLineClick = (id) => {
    // TODO: figure out where to put this
    // setChanging({});
    setFocus({
      line: system.lines[id]
    });
  }

  const handleCloseFocus = () => {
    setFocus({});

    ReactGA.event({
      category: 'Action',
      action: 'Close Focus'
    });
  }

  const renderFocus = () => {
    let content;
    if ('station' in focus) {
      content = <Station station={focus.station} lines={system.lines} stations={system.stations}
                         viewOnly={viewOnly} useLight={firebaseContext.settings.lightMode}
                         onAddToLine={handleAddStationToLine}
                         onDeleteStation={handleStationDelete}
                         onConvertToWaypoint={handleConvertToWaypoint}
                         onConvertToStation={handleConvertToStation}
                         onWaypointOverride={handleWaypointOverride}
                         onLineClick={(line) => handleLineClick(line.id)}
                         onStationInfoChange={handleStationInfoChange}
                         onFocusClose={handleCloseFocus} />;
    } else if ('line' in focus) {
      content =  <Line line={focus.line} system={system} viewOnly={viewOnly}
                       onLineInfoChange={handleLineInfoChange}
                       onStationRemove={handleRemoveStationFromLine}
                       onWaypointsRemove={handleRemoveWaypointsFromLine}
                       onReverseStationOrder={handleReverseStationOrder}
                       onDeleteLine={handleLineDelete}
                       onDuplicateLine={handleLineDuplicate}
                       onStopClick={handleStopClick}
                       onFocusClose={handleCloseFocus} />;
    }
    return content;
  }

  const renderAlert = () => {
    if (alert) {
      return (
        <div className="System-alert FadeAnim">
          <div className="System-alertMessage">
            {alert}
          </div>
        </div>
      );
    }
  }

  const renderToast = () => {
    if (toast) {
      return (
        <div className="System-toast FadeAnim">
          <div className="System-toastMessage">
            {toast}
          </div>
        </div>
      );
    }
  }

  const renderPrompt = () => {
    if (prompt && prompt.message && prompt.denyFunc && prompt.confirmFunc) {
      return (
        <div className="System-prompt FadeAnim">
          <div className="System-promptContent">
            <div className="System-promptMessage">
              {prompt.message}
            </div>
            <div className="System-promptButtons">
              <button className="System-promptDeny Button--inverse" onClick={prompt.denyFunc}>
                {prompt.denyText ? prompt.denyText : 'No'}
              </button>
              <button className="System-promptConfirm Button--primary" onClick={prompt.confirmFunc}>
                {prompt.confirmText ? prompt.confirmText : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  const renderShortcut = () => {
    if (!viewOnly && map) {
      return (
        <Shortcut map={map} focus={focus} system={system} recent={recent}
                  onAddToLine={handleAddStationToLine}
                  onConvertToWaypoint={handleConvertToWaypoint}
                  onConvertToStation={handleConvertToStation}
                  onDeleteStation={handleStationDelete} />
      );
    }
  }

  const renderViewOnly = () => {
    if (viewOnly && !firebaseContext.authStateLoading) {
      return (
        <ViewOnly system={system} ownerName={ownerDocData.displayName} systemId={systemDocData.systemId} systemDocData={systemDocData}
                  onToggleShowAuth={onToggleShowAuth} />
      );
    }
  }

  const renderActions = () => {
    return (
      <div className="System-actions">
        <button className="System-action System-action--fullscreen" data-tip="Enter fullscreen"
                onClick={() => enterFullscreen(systemEl.current)}>
          <i className="fas fa-expand"></i>
        </button>

        {!viewOnly && (
          <button className="System-action System-action--save" data-tip={isSaved ? 'Saved!' : 'Save changes'}
                  onClick={handleSave}>
            <i className="far fa-save fa-fw"></i>

            <div className={classNames('System-saveStatus', {
                                                              'System-saveStatus--saved': isSaved && !isNew,
                                                              'System-saveStatus--unsaved': !isSaved || isNew
                                                            })}>
            </div>
          </button>
        )}

        {!viewOnly && (
          <button className="System-action System-action--undo" data-tip="Undo"
                  onClick={handleUndo}>
            <i className="fas fa-undo fa-fw"></i>
          </button>
        )}
      </div>
    );
  }

  const renderFullscreenControls = () => {
    return (
      <Controls system={system} router={router} settings={firebaseContext.settings} viewOnly={viewOnly}
                useLight={firebaseContext.settings.lightMode} ownerDocData={ownerDocData}
                meta={meta} isPrivate={isPrivate} waypointsHidden={waypointsHidden}
                systemId={systemDocData.systemId || router.query.systemId} systemDocData={systemDocData}
                onSave={handleSave}
                onUndo={handleUndo}
                onAddLine={handleAddLine}
                onLineElemClick={(line) => handleLineClick(line.id)}
                onGetTitle={handleGetTitle} />
    );
  }

  const renderSocial = () => {
    return (
      <div className="System-social">
        <Share systemDocData={systemDocData}
               handleSetToast={handleSetToast} />

        <BranchAndCount systemDocData={systemDocData} isPrivate={isPrivate} />

        <CommentAndCount systemDocData={systemDocData}
                         onClick={() => {
                          commentEl.current.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'center'
                          });
                          commentEl.current.focus({ preventScroll: true });
                         }} />

        <StarAndCount systemId={systemDocData.systemId} systemDocData={systemDocData}
                      onToggleShowAuth={onToggleShowAuth} />
      </div>
    );
  }

  const renderAuthor = () => {
    if (ownerDocData.userId) {
      return (
        <Link className="System-author Link" href={`/user/${ownerDocData.userId}`}>
          <UserIcon className="System-authorIcon" userDocData={ownerDocData} />

          <div className="System-authorName">
            {ownerDocData.displayName ? ownerDocData.displayName : 'Anon'}
          </div>
        </Link>
      );
    } else {
      return (
        <button className="System-author Link"
                onClick={() => onToggleShowAuth(true)}>
          <i className="fas fa-user"></i>

          <div className="System-authorName">
            Anon
          </div>
        </button>
      );
    }
  }

  const renderLead = () => {
    return (
      <div className="System-lead">
        {renderAuthor()}

        <div className="System-title">
          <Title title={system.title} viewOnly={viewOnly} onGetTitle={handleGetTitle} />
        </div>

        {!isNew && renderSocial()}
      </div>
    );
  }

  const renderDetails = () => {
    const timeElem = !isNew && (
      <div className="System-timeText">
        updated {timestampToText(systemDocData.lastUpdated)}
      </div>
    );

    const statsElem = !isNew && (
      <div className="System-stats">
        {systemDocData.numLines} {systemDocData.numLines === 1 ? 'line' : 'lines'}, {systemDocData.numStations} {systemDocData.numStations === 1 ? 'station' : 'stations'}
      </div>
    );

    const privateDiv = <div className="System-private">
      <i className={isPrivate ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
    </div>;
    const privateText = <div className="System-privateText">
      {`Map ${isNew ? 'will be' : 'is'} ${isPrivate ? 'Private' : 'Public'}`}
    </div>;
    const privateToggle = !viewOnly ? (
      <button className="System-privateButton" onClick={handleTogglePrivate}
              data-tip={isPrivate ? 'Click to make this map appear in search and on your profile' : 'Click to make this map only accessible with a link'}>
        {privateDiv}
        {privateText}
      </button>
    ) : (
      <div className="System-privateButton">
        {privateDiv}
        {privateText}
      </div>
    );

    const waypointsToggle = !viewOnly && (
      <Toggle onClick={handleToggleWaypoints}
              tip={waypointsHidden ? 'Click show waypoints' : 'Click to hide waypoints'}
              isOn={!waypointsHidden || false}
              text={waypointsHidden ? 'Waypoints hidden' : 'Waypoints visible'} />
    );

    const divider = <span className="System-detailsDivider">•</span>;

    return (
      <div className="System-details SystemSection">
        {timeElem}
        {timeElem && (statsElem || privateToggle || waypointsToggle) && divider}
        {statsElem}
        {statsElem && (privateToggle || waypointsToggle) && divider}
        {privateToggle}
        {privateToggle && waypointsToggle && divider}
        {waypointsToggle}

        {(!viewOnly || system.caption) && (
          <div className="System-caption">
            <Description description={system.caption ? system.caption : ''}
                        viewOnly={viewOnly}
                        placeholder={'Add a caption...'}
                        onDescriptionBlur={handleSetCaption} />
          </div>
        )}

        <div className="System-ancestry">
          <Ancestry ancestors={systemDocData.ancestors} title={system.title} ownerDocData={ownerDocData} />
        </div>
      </div>
    );
  }

  const systemClass= classNames('System', {
    'System--fullscreen': isFullscreen,
    'System--normal': !isFullscreen,
    'System--viewOnly': viewOnly
  });
  return (
    <div className={systemClass} ref={el => (systemEl.current = el)}>
      <div className="System-main">
        {!isFullscreen && isMobile && (
          <LinesDrawer system={system} focus={focus} viewOnly={viewOnly}
                      onLineClick={handleLineClick}
                      onAddLine={handleAddLine} />
        )}
        <div className="System-primary">
          <div className="System-map">
            <Map system={system} interlineSegments={interlineSegments} changing={changing} focus={focus}
                 systemLoaded={true} viewOnly={viewOnly} waypointsHidden={waypointsHidden}
                 isFullscreen={isFullscreen} isMobile={isMobile}
                 onStopClick={handleStopClick}
                 onLineClick={handleLineClick}
                 onMapClick={handleMapClick}
                 onMapInit={handleMapInit}
                 onToggleMapStyle={onToggleMapStyle}
                 preToggleMapStyle={preToggleMapStyle} />

            {!isFullscreen && renderActions()}

            {renderFadeWrap(renderAlert(), 'alert')}
          </div>

          {isFullscreen && renderFullscreenControls()}

          {!isFullscreen && renderLead()}

          {!isFullscreen && !isMobile &&
            <LineButtons extraClasses={['SystemSection']} system={system} focus={focus} viewOnly={viewOnly}
                        onLineClick={handleLineClick}
                        onAddLine={handleAddLine} />}

          {isMobile && renderFocusWrap(renderFocus(), 'focus')}

          {!isFullscreen && !isMobile && renderDetails()}

          {!isFullscreen && !isNew && !isMobile &&
            <Comments ref={commentEl} systemId={systemDocData.systemId}
                      ownerUid={systemDocData.userId} commentData={commentData}
                      onToggleShowAuth={onToggleShowAuth} />}
        </div>

        {!isMobile && (
          <div className="System-secondary">
            {renderFocusWrap(renderFocus(), 'focus')}

            {!isFullscreen && !isNew && <Related systemDocData={systemDocData} />}
          </div>
        )}
        
        {!isFullscreen && isMobile && renderDetails()}

        {!isFullscreen && !isNew && isMobile &&
          <Comments ref={commentEl} systemId={systemDocData.systemId}
                    ownerUid={systemDocData.userId} commentData={commentData}
                    onToggleShowAuth={onToggleShowAuth} />}

        {!isFullscreen && !isNew && isMobile && <Related systemDocData={systemDocData} />}
      </div>

      {renderFadeWrap(renderPrompt(), 'prompt')}
      {renderFadeWrap(renderToast(), 'toast')}
      {renderShortcut()}
    </div>
  );
}
