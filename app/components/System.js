import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga';

import { FirebaseContext } from '/lib/firebaseContext.js';
import { renderFadeWrap } from '/lib/util.js';
import { INITIAL_SYSTEM, INITIAL_META, FLY_TIME } from '/lib/constants.js';

import { Controls } from '/components/Controls.js';
import { Line } from '/components/Line.js';
import { Map } from '/components/Map.js';
import { Metatags } from '/components/Metatags.js';
import { Shortcut } from '/components/Shortcut.js';
import { Station } from '/components/Station.js';
import { SystemHeader } from '/components/SystemHeader.js';
import { ViewOnly } from '/components/ViewOnly.js';

export function System({ownerDocData = {},
                        systemDocData = {},
                        viewDocData = {},
                        isNew = false,
                        newMapBounds = [],
                        viewOnly = true,
                        system = INITIAL_SYSTEM,
                        meta = INITIAL_META,
                        isSaved = true,
                        waypointsHidden = false,
                        recent = {},
                        changing = { all: true },
                        interlineSegments = {},
                        focusFromEdit = null,
                        toastFromEdit = null,

                        handleAddStationToLine = () => {},
                        handleStationDelete = () => {},
                        handleConvertToWaypoint = () => {},
                        handleConvertToStation = () => {},
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
                        handleStationInfoChange = () => {}}) {

  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  const [focus, setFocus] = useState(focusFromEdit || {});
  const [alert, setAlert] = useState(null);
  const [toast, setToast] = useState(null);
  const [prompt, setPrompt] = useState();
  const [map, setMap] = useState();
  // const [windowDims, setWindowDims] = useState({ width: window.innerWidth || 0, height: window.innerHeight || 0 });

  useEffect(() => {
    if (isNew) {
      setTimeout(() => handleSetAlert('Tap the map to add a station!'), FLY_TIME - 2000);
    }
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

  useEffect(() => {
    if (toastFromEdit && toastFromEdit !== toast) {
      handleSetToast(toastFromEdit);
    }
  }, [toastFromEdit]);

  const handleMapInit = (map) => {
    setMap(map);
  }

  const handleHomeClick = () => {
    ReactGA.event({
      category: 'View',
      action: 'Home'
    });

    const goHome = () => {
      router.push({
        pathname: '/explore'
      });
    }

    if (!isSaved) {
      setPrompt({
        message: 'You have unsaved changes to your map. Do you want to save before leaving?',
        confirmText: 'Yes, save it!',
        denyText: 'No, do not save.',
        confirmFunc: () => {
          setPrompt(null);
          // this.handleSave(goHome);
        },
        denyFunc: () => {
          setPrompt(null);
          // setIsSaved(true); // needed to skip the unload page alert
          goHome();
        }
      });
    } else {
      goHome();
    }
  }

  const handleToggleMapStyle = (map, style) => {
    map.setStyle(style);

    // TODO: figure out where to put this
    // map.once('styledata', () => {
    //   setChanging({ all: true });
    // });

    // setChanging({});
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

  const handleSetAlert = (message) => {
    setAlert(message);

    setTimeout(() => {
      setAlert(null);
    }, 3000);
  }

  const handleSetToast = (message) => {
    setToast(message);

    setTimeout(() => {
      setToast(null);
    }, 2000);
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
        <div className="View-alert FadeAnim">
          <div className="View-alertMessage">
            {alert}
          </div>
        </div>
      );
    }
  }

  const renderToast = () => {
    if (toast) {
      return (
        <div className="View-toast FadeAnim">
          <div className="View-toastMessage">
            {toast}
          </div>
        </div>
      );
    }
  }

  const renderPrompt = () => {
    if (prompt && prompt.message && prompt.denyFunc && prompt.confirmFunc) {
      return (
        <div className="View-prompt FadeAnim">
          <div className="View-promptContent">
            <div className="View-promptMessage">
              {prompt.message}
            </div>
            <div className="View-promptButtons">
              <button className="View-promptDeny Button--inverse" onClick={prompt.denyFunc}>
                {prompt.denyText ? prompt.denyText : 'No'}
              </button>
              <button className="View-promptConfirm Button--primary" onClick={prompt.confirmFunc}>
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
        <ViewOnly system={system} ownerName={ownerDocData.displayName} viewId={viewDocData.viewId || router.query.viewId}
                  viewDocData={viewDocData}
                  // setupSignIn={() => this.setupSignIn()}
                  // onStarredViewsUpdated={this.props.onStarredViewsUpdated}
                  onSetToast={handleSetToast} />
      );
    }
  }

  return (
    <>
      <Metatags title={viewDocData && viewDocData.title ? 'MetroDreamin\' | ' + viewDocData.title : null} />

      <SystemHeader handleHomeClick={handleHomeClick} />

      <Map system={system} interlineSegments={interlineSegments} changing={changing} focus={focus}
           settings={firebaseContext.settings} systemLoaded={systemDocData && systemDocData.map}
           viewOnly={viewOnly} waypointsHidden={waypointsHidden}
           onStopClick={handleStopClick}
           onLineClick={handleLineClick}
           onMapClick={handleMapClick}
           onMapInit={handleMapInit}
           onToggleMapStyle={handleToggleMapStyle} />

      <Controls system={system} router={router} settings={firebaseContext.settings} viewOnly={viewOnly}
                useLight={firebaseContext.settings.lightMode} ownerDocData={ownerDocData}
                meta={meta} isPrivate={viewDocData.isPrivate || false} waypointsHidden={waypointsHidden}
                viewId={viewDocData.viewId || router.query.viewId} viewDocData={viewDocData}
                // signOut={() => this.props.signOut()}
                // setupSignIn={() => this.setupSignIn()}
                // onSave={() => this.handleSave()}
                onUndo={handleUndo}
                onAddLine={handleAddLine}
                onLineElemClick={(line) => handleLineClick(line.id)}
                setToast={handleSetToast}
                // onShareToFacebook={() => this.handleShareToFacebook()}
                // onOtherSystemSelect={(systemId) => this.handleOtherSystemSelect(systemId)}
                onGetTitle={handleGetTitle}
                // onTogglePrivate={() => this.handleTogglePrivate()}
                onToggleWapoints={handleToggleWaypoints}
                // onStarredViewsUpdated={this.props.onStarredViewsUpdated}
                onSetAlert={handleSetAlert}
                onSetToast={handleSetToast}
                onHomeClick={handleHomeClick} />

      {renderFadeWrap(renderFocus(), 'focus')}
      {renderFadeWrap(renderViewOnly(), 'viewOnly')}
      {renderFadeWrap(renderPrompt(), 'prompt')}
      {renderFadeWrap(renderAlert(), 'alert')}
      {renderFadeWrap(renderToast(), 'toast')}
      {renderShortcut()}
    </>
  );
}
