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

// Function to format JSON string with custom formatting rules
function formatJSON(obj) {
  const jsonString = JSON.stringify(obj, null, 2);
  return jsonString
    // Removes newlines between stationIds for interchange and line objects
    .replace(/\{\n\s+"stationIds"/g, '{ "stationIds"')                            // Removes newlines between start of interchange object { and stationIds
    .replace(/\{\n\s+"label"/g, '{ "label"')                                      // Removes newlines between start of lineGroup object { and label
    .replace(/"\n\s+\],\n\s+"waypointOverrides"/g, '" ], "waypointOverrides"')    // Removes newlines between stationIds and waypointOverrides in lines
    .replace(/\[\n\s+"/g, '[ "') // Replaces '[\n "'                              // Removes newlines between start of array [ and Ids                       
    .replace(/",\n\s+"/g, '", "') // Replaces '",\n "'                            // Removes newlines between all properties and Ids
      // Corrects affected data
      .replace(/, "caption"/g, ',\n  "caption"') // Replaces ', "caption"'        // Adds newlines between title and caption
      .replace(/, "map"/g, ',\n  "map"') // Replaces ', "map"'                    // Adds newlines between caption and map
    .replace(/"\n\s+\]\s+\}/g, '" ] }') // Replaces '"\n ] }'                     // Removes newlines between Ids and end of line object ] } 
    .replace(/"\n\s+\]\s+\},/g, '" ] },') // Replaces '"\n ] },'                  // Removes newlines between Ids and end of line object ] },

    // Removes newlines between station properties
    .replace(/{\n\s+"name"/g, '{ "name"') // for lines too      // Removes newlines between start of object { and name
    .replace(/{\n\s+"isWaypoint"/g, '{ "isWaypoint"')           // Removes newlines between start of object { and isWaypoint
    .replace(/,\n\s+"grade"/g, ', "grade"')                     // Removes newlines between name/isWaypoint and grade
    .replace(/,\n\s+"lat"/g, ', "lat"')                         // Removes newlines between name/isWaypoint/grade and lat
    .replace(/,\n\s+"lng"/g, ', "lng"')                         // Removes newlines between lat and lng
    .replace(/\n\s+\},/g, ' },')                                // Removes newlines between lng and end of object },
    .replace(/\n\s+\}\s+\},/g, ' }\n    },')                    // Removes newlines between lng and end of object } }, for last station
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
