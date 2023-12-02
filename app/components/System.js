import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ReactGA from 'react-ga4';
import classNames from 'classnames';

import { renderFadeWrap, renderFocusWrap, timestampToText, getLevel, isIOS } from '/lib/util.js';
import {
  useCommentsForSystem,
  useStarsForSystem,
  useDescendantsOfSystem,
  useScrollDirection
} from '/lib/hooks.js';
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
                        commentsLocked = false,
                        waypointsHidden = false,
                        recent = {},
                        focusFromEdit = null,
                        alert = null,
                        toast = null,
                        prompt = null,

                        onToggleShowAuth = () => {},
                        preToggleMapStyle = () => {},
                        triggerAllChanged = () => {},
                        postChangingAll = () => {},

                        handleSetToast = () => {},
                        handleSetAlert = () => {},
                        handleSave = () => {},
                        handleDelete = () => {},
                        handleTogglePrivate = () => {},
                        handleToggleCommentsLocked = () => {},
                        handleAddStationToLine = () => {},
                        handleStationDelete = () => {},
                        handleConvertToWaypoint = () => {},
                        handleConvertToStation = () => {},
                        handleWaypointOverride = () => {},
                        handleCreateInterchange = () => {},
                        handleLineInfoChange = () => {},
                        handleRemoveStationFromLine = () => {},
                        handleRemoveWaypointsFromLine = () => {},
                        handleRemoveStationFromInterchange = () => {},
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
  const starData = useStarsForSystem({ systemId: systemDocData.systemId || '' });
  const descendantsData = useDescendantsOfSystem({ systemId: systemDocData.systemId || '' });
  const { isScrolling } = useScrollDirection();

  const [focus, setFocus] = useState(focusFromEdit || {});
  const [map, setMap] = useState();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenFallback, setIsFullscreenFallback] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pinsShown, setPinsShown] = useState(false);

  const handleTogglePins = useCallback(() => {
    if (map) {
      if (!systemDocData || !systemDocData.level) {
        if (!pinsShown) {
          setPinsShown(true);
          triggerAllChanged();
        }
        return;
      }

      const level = getLevel({ key: systemDocData.level });
      if (level) {
        if (!pinsShown && map.getZoom() > (level.zoomThreshold || 0)) {
          setPinsShown(true);
          triggerAllChanged();
        } else if (pinsShown && map.getZoom() <= (level.zoomThreshold || 0)) {
          setPinsShown(false);
          triggerAllChanged();
        }
      }
    }
  }, [systemDocData.level, map, pinsShown]);

  useEffect(() => {
    if (isNew) {
      setTimeout(() => handleSetAlert('Tap the map to add a station!'), FLY_TIME - 2000);
    }

    const fullscreenchanged = () => {
      const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      if (fullscreenElement && fullscreenElement.classList.contains('System')) {
        setIsFullscreen(true);
        ReactGA.event({
          category: 'System',
          action: 'Enter Fullscreen'
        });
        ReactGA.set({ 'fullscreen': 'true' });
      } else {
        setIsFullscreen(false);
        ReactGA.event({
          category: 'System',
          action: 'Exit Fullscreen'
        });
        ReactGA.set({ 'fullscreen': 'false' });
      }
    }

    const eventNames = [ 'fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'mozfullscreenchangeMSFullscreenChange' ];
    for (const eventName of eventNames) {
      document.addEventListener(eventName, fullscreenchanged);
    }

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
    if (Object.keys(focusFromEdit || {}).length === 0) return;

    if (Object.keys(focusFromEdit).sort().join() !== Object.keys(focus).sort().join()) {
      setFocus(focusFromEdit);
    }

    if ('station' in focusFromEdit && 'station' in focus && focusFromEdit.station.id !== focus.station.id) {
      setFocus(focusFromEdit);
    }

    if ('line' in focusFromEdit && 'line' in focus && focusFromEdit.line.id !== focus.line.id) {
      setFocus(focusFromEdit);
    }
  }, [focusFromEdit]);

  useEffect(() => {
    if (map) {
      map.on('zoom', handleTogglePins);
      return () => map.off('zoom', handleTogglePins);
    }
  }, [map, handleTogglePins]);

  const enterFullscreen = (element) => {
    // Check which implementation is available
    let requestMethod = element.requestFullScreen ||
                        element.webkitRequestFullscreen ||
                        element.webkitRequestFullScreen ||
                        element.mozRequestFullScreen ||
                        element.msRequestFullscreen ||
                        element.webkitEnterFullscreen;

    if (requestMethod) {
      try {
        requestMethod.apply(element);
      } catch (e) {
        console.log('enter fullscreen error:', e);
        enterFullscreenFallback();
      }
    } else {
      enterFullscreenFallback();
    }
  }

  // non-video element fullscreen is not supported on iOS,
  // so handle iDevices (and any other failures) separately
  const enterFullscreenFallback = () => {
    setIsFullscreen(true);
    setIsFullscreenFallback(true);
    ReactGA.event({
      category: 'System',
      action: 'Enter Fallback Fullscreen'
    });
    ReactGA.set({ 'fullscreen': 'true' });
  }

  const exitFullscreen = () => {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.webkitExitFullScreen) {
        document.webkitExitFullScreen();
      } else if (document.mozExitFullScreen) {
        document.mozExitFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      } else {
        exitFullscreenFallback();
      }
    } catch (e) {
      console.log('exit fullscreen error:', e);
      exitFullscreenFallback();
    }
  }

  const exitFullscreenFallback = () => {
    setIsFullscreen(false);
    setIsFullscreenFallback(false);
    ReactGA.event({
      category: 'System',
      action: 'Exit Fallback Fullscreen'
    });
    ReactGA.set({ 'fullscreen': 'false' });
  }

  // ensures that data in the focus object is up to date with the system
  const refreshFocus = () => {
    let refreshedFocus = {};

    if ('station' in focus && system.stations[focus.station.id]) {
      refreshedFocus.station = system.stations[focus.station.id];
    }

    if ('line' in focus && system.lines[focus.line.id]) {
      refreshedFocus.line = system.lines[focus.line.id];
    }

    return refreshedFocus;
  }

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
    setFocus({
      station: system.stations[id]
    });

    ReactGA.event({
      category: 'System',
      action: `Show ${system.stations[id].isWaypoint ? 'Waypoint' : 'Station'}`
    });
  }

  const handleLineClick = (id) => {
    setFocus({
      line: system.lines[id]
    });

    ReactGA.event({
      category: 'System',
      action: 'Show Line'
    });
  }

  const handleCloseFocus = () => {
    setFocus({});

    ReactGA.event({
      category: 'System',
      action: 'Close Focus'
    });
  }

  const renderFocus = () => {
    let content;
    if ('station' in focus) {
      const focusedStation = system.stations[focus.station.id];
      if (!focusedStation) return;
      content = <Station station={focusedStation} viewOnly={viewOnly}
                         stations={system.stations} lines={system.lines}
                         interchangesByStationId={system.interchangesByStationId || {}}
                         transfersByStationId={system.transfersByStationId || {}}
                         useLight={firebaseContext.settings.lightMode}
                         onAddToLine={handleAddStationToLine}
                         onDeleteStation={handleStationDelete}
                         onConvertToWaypoint={handleConvertToWaypoint}
                         onConvertToStation={handleConvertToStation}
                         onWaypointOverride={handleWaypointOverride}
                         onCreateInterchange={handleCreateInterchange}
                         onRemoveStationFromInterchange={handleRemoveStationFromInterchange}
                         onLineClick={(line) => handleLineClick(line.id)}
                         onStationInfoChange={handleStationInfoChange}
                         onStopClick={handleStopClick}
                         onFocusClose={handleCloseFocus} />;
    } else if ('line' in focus) {
      const focusedLine = system.lines[focus.line.id];
      if (!focusedLine) return;
      content =  <Line line={focusedLine} system={system} viewOnly={viewOnly}
                       interchangesByStationId={system.interchangesByStationId || {}}
                       transfersByStationId={system.transfersByStationId || {}}
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
        <Shortcut map={map} focus={refreshFocus()} system={system} recent={recent}
                  transfersByStationId={system.transfersByStationId || {}}
                  onAddToLine={handleAddStationToLine}
                  onConvertToWaypoint={handleConvertToWaypoint}
                  onConvertToStation={handleConvertToStation}
                  onDeleteStation={handleStationDelete} />
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
          <button className="System-action System-action--save" data-tip={isSaved && !isNew ? 'Saved!' : 'Save changes'}
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
      <Controls system={system} router={router} firebaseContext={firebaseContext}
                viewOnly={viewOnly}  ownerDocData={ownerDocData}
                meta={meta} isPrivate={isPrivate} waypointsHidden={waypointsHidden}
                systemId={systemDocData.systemId || router.query.systemId} systemDocData={systemDocData}
                handleSetAlert={handleSetAlert}
                onExitFullscreen={exitFullscreen}
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

        <BranchAndCount systemDocData={systemDocData} isPrivate={isPrivate} descendantsData={descendantsData} />

        <CommentAndCount systemDocData={systemDocData}
                         onClick={(focusTextbox) => {
                          if (commentsLocked) {
                            handleSetToast('Comments are locked.');

                            ReactGA.event({
                              category: 'System',
                              action: 'Locked Go to Comments'
                            });
                            return;
                          }

                          if (!commentEl || !commentEl.current) return;

                          commentEl.current.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'center'
                          });

                          if (focusTextbox) {
                            commentEl.current.focus({ preventScroll: true });
                          }

                          ReactGA.event({
                            category: 'System',
                            action: focusTextbox ? 'Focus Comment Box' : 'Go to Comments'
                          });
                         }} />

        <StarAndCount systemId={systemDocData.systemId} systemDocData={systemDocData} starData={starData}
                      onToggleShowAuth={onToggleShowAuth} />
      </div>
    );
  }

  const renderAuthor = () => {
    if (ownerDocData.userId) {
      return (
        <Link className="System-author Link" href={`/user/${ownerDocData.userId}`}
              onClick={() => ReactGA.event({ category: 'System', action: 'Author Click' })}>
          <UserIcon className="System-authorIcon" userDocData={ownerDocData} />

          <div className="System-authorName">
            {ownerDocData.displayName ? ownerDocData.displayName : 'Anon'}
          </div>
        </Link>
      );
    } else {
      return (
        <button className="System-author Link"
                onClick={() => {
                  onToggleShowAuth(true);

                  ReactGA.event({
                    category: 'System',
                    action: 'Anon Author Click'
                  });
                }}>
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

    const privateDiv = <div className="System-privateIcon">
      <i className={isPrivate ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
    </div>;
    const privateText = <div className="System-privateText">
      {`Map ${isNew ? 'will be' : 'is'} ${isPrivate ? 'Private' : 'Public'}`}
    </div>;
    const privateToggle = !viewOnly ? (
      <button className="System-private System-private--button" onClick={handleTogglePrivate}
              data-tip={isPrivate ? 'Click to make this map appear in search and on your profile' : 'Click to make this map only accessible with a link'}>
        {privateDiv}
        {privateText}
      </button>
    ) : (
      <div className="System-private System-private--display"
           data-tip={isPrivate ? 'Map is only accessible by direct link' : 'Map appears in search and on creator profile'}>
        {privateDiv}
        {privateText}
      </div>
    );

    const deleteButton = !viewOnly && !isNew && (
      <button className="System-delete"
              onClick={handleDelete}>
        <div className="System-deleteIcon">
          <i className="fa-solid fa-trash-can"></i>
        </div>

        <div className="System-deleteText">
          Delete map
        </div>
      </button>
    );

    const waypointsToggle = !viewOnly && (
      <Toggle onClick={handleToggleWaypoints}
              tip={waypointsHidden ? 'Click show waypoint icons' : 'Click to hide waypoint icons'}
              isOn={!waypointsHidden || false}
              text={waypointsHidden ? 'Waypoints hidden' : 'Waypoints visible'} />
    );

    return (
      <div className="System-details SystemSection">
        {!viewOnly && <div className="System-detailButtonItems">
          {privateToggle}
          {deleteButton}
          {waypointsToggle}
        </div>}

        <div className="System-detailTextItems">
          {viewOnly && privateToggle}
          {timeElem}
          {statsElem}
        </div>

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
    'System--fullscreenFallback': isFullscreen && isFullscreenFallback,
    'System--normal': !isFullscreen,
    'System--viewOnly': viewOnly,
    'System--scrolling': isScrolling
  });
  return (
    <div className={systemClass} ref={el => (systemEl.current = el)}>
      <div className="System-main">
        {!isFullscreen && isMobile && (
          <LinesDrawer system={system} focus={refreshFocus()} viewOnly={viewOnly}
                      onLineClick={handleLineClick}
                      onAddLine={handleAddLine} />
        )}

        <div className="System-primary">
          <div className="System-map">
            <Map system={system} systemLoaded={true} viewOnly={viewOnly}
                 focus={refreshFocus()} waypointsHidden={waypointsHidden}
                 isFullscreen={isFullscreen} isMobile={isMobile} pinsShown={pinsShown}
                 onStopClick={handleStopClick}
                 onLineClick={handleLineClick}
                 onMapClick={handleMapClick}
                 onMapInit={handleMapInit}
                 onToggleMapStyle={triggerAllChanged}
                 preToggleMapStyle={preToggleMapStyle}
                 postChangingAll={postChangingAll} />

            {!isFullscreen && renderActions()}

            {renderFadeWrap(renderAlert(), 'alert')}
          </div>

          {isFullscreen && renderFullscreenControls()}

          {!isFullscreen && renderLead()}

          {!isFullscreen && !isMobile &&
            <LineButtons extraClasses={['SystemSection']} system={system} focus={refreshFocus()} viewOnly={viewOnly}
                        onLineClick={handleLineClick}
                        onAddLine={handleAddLine} />}

          {!isFullscreen && !isMobile && renderDetails()}

          {!isFullscreen && !isNew && !isMobile &&
            <Comments ref={commentEl} systemId={systemDocData.systemId} commentsCount={systemDocData.commentsCount || 0}
                      ownerUid={systemDocData.userId} commentData={commentData} commentsLocked={commentsLocked}
                      onToggleShowAuth={onToggleShowAuth}
                      onToggleCommentsLocked={handleToggleCommentsLocked} />}
        </div>

        <div className="System-secondary">
          {renderFocusWrap(renderFocus(), 'focus')}

          {!isFullscreen && isMobile && renderDetails()}

          {!isFullscreen && !isNew && isMobile &&
            <Comments ref={commentEl} systemId={systemDocData.systemId} commentsCount={systemDocData.commentsCount || 0}
                      ownerUid={systemDocData.userId} commentData={commentData} commentsLocked={commentsLocked}
                      onToggleShowAuth={onToggleShowAuth}
                      onToggleCommentsLocked={handleToggleCommentsLocked} />}

          {!isNew && <Related systemDocData={systemDocData} />}
        </div>
      </div>

      {renderFadeWrap(renderPrompt(), 'prompt')}
      {renderFadeWrap(renderToast(), 'toast')}
      {renderShortcut()}
    </div>
  );
}
