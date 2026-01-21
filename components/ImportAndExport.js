import React, { useContext, useState, useEffect } from 'react';
import { FirebaseContext } from '/util/firebase.js';
import { getFullSystem } from '/util/firebase.js';
import { doc, getDoc } from 'firebase/firestore';
import { Prompt } from '/components/Prompt.js';
import { renderFadeWrap } from '/util/helpers';

// Order properties of objects in a JSON object
function orderProperties(obj, order) {
  const orderedObj = {};
  Object.keys(obj).forEach(key => {
    const orderedSubObj = {};
    order.forEach(prop => {
      if (obj[key][prop] !== undefined) {
        orderedSubObj[prop] = obj[key][prop];
      }
    });
    orderedObj[key] = orderedSubObj;
  });
  return orderedObj;
}

// Format JSON string for readability
function formatJSON(obj) {
  const indentationLevel = 2; // set stringify indentation level
  const jsonString = JSON.stringify(obj, null, indentationLevel);
  const spc = ' '.repeat(indentationLevel); // dynamic indentation spacing

  return jsonString                                                             // Affected objects, properties, and elements...
    // Remove newlines at the opening of objects and arrays
    .replace(/\{\n\s+"name"/g, '{ "name"')                                      // stations and lines
    .replace(/\{\n\s+"isWaypoint"/g, '{ "isWaypoint"')                          // stations
    .replace(/\{\n\s+"stationIds"/g, '{ "stationIds"')                          // interchanges and lines
    .replace(/\{\n\s+"label"/g, '{ "label"')                                    // linegroups
    .replace(/\[\n\s+"/g, '[ "')                                                // stationIds and waypointOverrides

    // Remove newlines between object properties and array elements
    .replace(/",\n\s+"/g, '", "')                                               // most properties and elements
    .replace(/,\n\s+"grade"/g, ', "grade"')                                     // stations
    .replace(/,\n\s+"lat"/g, ', "lat"')                                         // stations
    .replace(/,\n\s+"lng"/g, ', "lng"')                                         // stations
    .replace(/"\n\s+\],\n\s+"waypointOverrides"/g, '" ], "waypointOverrides"')  // lines

    // Remove newlines at the closing of objects and arrays
    .replace(/\n\s+\},/g, ' },')                                                // succeeded objects
    .replace(/\n\s+\}\s+\},/g, ` }\n${spc}${spc}},`)                            // last objects
    .replace(/\n\s+\]\s+\},/g, ' ] },')                                         // succeeded arrays         
    .replace(/\n\s+\]\s+\}/g, ' ] }')                                           // last arrays
    .replace(/\[\]\n\s+\}/g, '[] }')                                            // empty arrays

    // Correct unintended changes
    .replace('", "caption"', `",\n${spc}"caption"`)   // Fix caption property
    .replace('", "map"', `",\n${spc}"map"`)           // Fix map property
    .replace(/\}\n\s+\},\n\s+"meta"/, 
      `\n${spc}${spc}}\n${spc}},\n${spc}"meta"`)      // Fix meta property
    ;
}

// Export system data as JSON file
export function ExportSystemJSON({ systemId, isNew, isSaved, handleSave, onSetToast }) {
  const firebaseContext = useContext(FirebaseContext);
  const [prompt, setPrompt] = useState();

  // Main export function
  const exportSystemData = async () => {
    try {
      // Get system title and creator name
      const systemDoc = await getDoc(doc(firebaseContext.database, `systems/${systemId}`));
      const systemTitle = systemDoc.data().title || 'Untitled_Map';
      const creatorDoc = await getDoc(doc(firebaseContext.database, `users/${systemDoc.data().userId}`));
      const creatorName = creatorDoc.data().displayName || 'Unknown_Creator';

      // Get full system data and order properties
      const fullSystem = await getFullSystem(systemId);
      const orderedSystem = {
        title: fullSystem.map.title,
        caption: fullSystem.map.caption,
        map: {
          stations: orderProperties(fullSystem.map.stations, ['isWaypoint', 'name', 'grade', 'lat', 'lng']),
          interchanges: orderProperties(fullSystem.map.interchanges, ['stationIds']),
          lineGroups: orderProperties(fullSystem.map.lineGroups, ['label']),
          lines: orderProperties(fullSystem.map.lines, ['name', 'color', 'mode', 'lineGroupId', 'stationIds', 'waypointOverrides'])
        },
        meta: {
          systemNumStr: fullSystem.meta.systemNumStr,
          nextStationId: fullSystem.meta.nextStationId,
          nextInterchangeId: fullSystem.meta.nextInterchangeId,
          nextLineGroupId: fullSystem.meta.nextLineGroupId,
          nextLineId: fullSystem.meta.nextLineId
        }
      };
      const systemData = formatJSON(orderedSystem);

      // Create and download JSON file
      const blob = new Blob([systemData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MetroDreamin Map '${systemTitle}' by ${creatorName}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onSetToast('Export successful!');
    } catch (error) {
      console.error('Error exporting system:', error);
      onSetToast('Export failed.');
    }
  };

  // Button click handler
  const handleExport = async () => {
    if (!isNew && !isSaved) {
      setPrompt({
        message: "You have unsaved changes. Do you want to save before exporting?",
        confirmText: "Yes, save and export.",
        denyText: "No, export without my changes.",
        confirmFunc: handleConfirmSave,
        denyFunc: handleDenySave,
      });
    } else {
      await exportSystemData();
    }
  };

  // Handle saving before exporting
  const handleConfirmSave = () => {
    setPrompt(null);
    handleSave(() => {
      exportSystemData();
    });
  };

  // Handle exporting without saving
  const handleDenySave = async () => {
    setPrompt(null);
    exportSystemData();
  };

  return (
    <div className="ImportAndExport">
      <button className="ImportAndExport-button" 
              data-tooltip-content="Download system and map data as JSON"
              onClick={handleExport}>
        <i className="fas fa-download"></i>
      </button>
      
      {renderFadeWrap(
        prompt && (
          <Prompt
            message={prompt.message}
            denyText={prompt.denyText}
            confirmText={prompt.confirmText}
            denyFunc={prompt.denyFunc}
            confirmFunc={prompt.confirmFunc}
          />
        ),
        'prompt'
      )}
    </div>
  );
}
