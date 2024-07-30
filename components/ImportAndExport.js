import React from 'react';
import { FirebaseContext } from '/util/firebase.js';
import { getFullSystem } from '/util/firebase.js';
import { doc, getDoc } from 'firebase/firestore';

// Helper function to order station properties, remove unwanted data
function orderStations(stations) {
  const orderedStations = {};
  Object.keys(stations).forEach(stationId => {
    const station = stations[stationId];
    orderedStations[stationId] = {
      isWaypoint: station.isWaypoint,
      name: station.name,
      grade: station.grade,
      lat: station.lat,
      lng: station.lng
    };
  });
  return orderedStations;
}

// Helper function to order interchange properties, remove unwanted data
function orderInterchanges(interchanges) {
  const orderedInterchanges = {};
  Object.keys(interchanges).forEach(interchangeId => {
    const interchange = interchanges[interchangeId];
    orderedInterchanges[interchangeId] = {
      stationIds: interchange.stationIds
    };
  });
  return orderedInterchanges;
}

// Helper function to order line group properties, remove unwanted data
function orderLineGroups(lineGroups) {
  const orderedLineGroups = {};
  Object.keys(lineGroups).forEach(lineGroupId => {
    const lineGroup = lineGroups[lineGroupId];
    orderedLineGroups[lineGroupId] = {
      label: lineGroup.label
    };
  });
  return orderedLineGroups;
}

// Helper function to order line properties, remove unwanted data
function orderLines(lines) {
  const orderedLines = {};
  Object.keys(lines).forEach(lineId => {
    const line = lines[lineId];
    orderedLines[lineId] = {
      name: line.name,
      color: line.color,
      mode: line.mode || 'RAPID', // Default mode value
      lineGroupId: line.lineGroupId,
      stationIds: line.stationIds,
      waypointOverrides: line.waypointOverrides
    };
  });
  return orderedLines;
}

// Function to format JSON string with custom rules
function formatJSON(obj) {
  const jsonString = JSON.stringify(obj, null, 2);      // JSON string with 2-space indentation between all properties

  return jsonString                                     // Affected Objects         // Description
    // Rules for opening objects and arrays
    .replace(/{\n\s+"name"/g, '{ "name"')               // stations & lines         // Removes newlines between the start of an object '{' and the name property
    .replace(/{\n\s+"isWaypoint"/g, '{ "isWaypoint"')   // stations                 // Removes newlines between the start of an object '{' and the isWaypoint property
    .replace(/\{\n\s+"stationIds"/g, '{ "stationIds"')  // interchanges             // Removes newlines between the start of an object '{' and the stationIds property
    .replace(/\{\n\s+"label"/g, '{ "label"')            // linegroups               // Removes newlines between the start of an object '{' and the label property
    .replace(/\[\n\s+"/g, '[ "')                        // interchanges & lines     // Removes newlines between the start of an array '[' and its elements

    // Rules for object properties and array elements
    .replace(/",\n\s+"/g, '", "')                       // general                  // Removes newlines between all object properties and array elements
        // Corrects unintentionally affected data
        .replace(/, "caption"/g, ',\n  "caption"')      // root                     // Restores newlines between the title and caption properties
        .replace(/, "map"/g, ',\n  "map"')              // root                     // Restores newlines between the caption property and the map object
    .replace(/,\n\s+"grade"/g, ', "grade"')             // stations                 // Removes newlines between the name/isWaypoint and grade properties
    .replace(/,\n\s+"lat"/g, ', "lat"')                 // stations                 // Removes newlines between the name/isWaypoint/grade and lat properties
    .replace(/,\n\s+"lng"/g, ', "lng"')                 // stations                 // Removes newlines between the lat and lng properties
    .replace(/"\n\s+\],\n\s+"waypointOverrides"/g,
      '" ], "waypointOverrides"')                       // lines                    // Removes newlines between the last element of stationIds array and the waypointOverrides property

    // Rules for closing objects and arrays
    .replace(/\n\s+\},/g, ' },')                        // map properties' objects  // Removes newlines between the last object property and '},' for the next object
    .replace(/\n\s+\}\s+\},/g, ' }\n    },')            // map properties' objects  // Removes newlines between the last object property of the last object '}' and '},' for the next map property
        // Corrects unintentionally affected data
        .replace(/\s+\}\n\s+\},\n\s+"meta"/g,
          '\n    }\n  },\n  "meta"')                    // root                     // Restores newlines between end of last object in lines property '}' and the meta properrty
    .replace(/"\n\s+\]\s+\},/g, '" ] },')               // interchanges & lines     // Removes newlines between the last element of an array and ']' for the end of the object
    .replace(/"\n\s+\]\s+\}/g, '" ] }')                 // interchanges             // Removes newlines between the last element of an array of the last object and '] }' for the next map property
    ;
}

// Main Export component
export function ImportAndExport({ systemId, onSetToast }) {
  const firebaseContext = React.useContext(FirebaseContext);

  const handleExport = async () => {
    try {
      // Fetching the full system data
      const fullSystem = await getFullSystem(systemId);

      // Constructing the ordered system object
      const orderedSystem = {
        title: fullSystem.map.title,
        caption: fullSystem.map.caption,
        map: {
          stations: orderStations(fullSystem.map.stations),
          interchanges: orderInterchanges(fullSystem.map.interchanges),
          lineGroups: orderLineGroups(fullSystem.map.lineGroups),
          lines: orderLines(fullSystem.map.lines),
        },
        meta: {
          systemNumStr: fullSystem.meta.systemNumStr,
          nextStationId: fullSystem.meta.nextStationId,
          nextInterchangeId: fullSystem.meta.nextInterchangeId,
          nextLineGroupId: fullSystem.meta.nextLineGroupId,
          nextLineId: fullSystem.meta.nextLineId
        }
      };
    
      // Formatting the system data as JSON string
      const systemData = formatJSON(orderedSystem);

      // Fetching system document to get system title
      const systemDoc = await getDoc(doc(firebaseContext.database, `systems/${systemId}`));
      const systemTitle = systemDoc.data().title || 'Untitled_Map';

      // Fetching creator document to get creator name
      const creatorDoc = await getDoc(doc(firebaseContext.database, `users/${systemDoc.data().userId}`));
      const creatorName = creatorDoc.data().displayName || 'Unknown_Creator';

      // Creating a temporary link to trigger the download
      const blob = new Blob([systemData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MetroDreamin Map '${systemTitle}' by ${creatorName}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Displaying a success message
      onSetToast('Export successful!');
    } catch (error) {
        // Displaying an error message
        console.error('Error exporting system:', error);
        onSetToast('Export failed.');
    }
  };

  return (
    <div className="ImportAndExport">
      <button className="ImportAndExport-button" onClick={handleExport}>
        <i className="fas fa-download" style={{ color: 'orange' }}></i>
      </button>
      {/* Future Import functionality will be added here */}
    </div>
  );
}
