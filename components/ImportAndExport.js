import React from 'react';
import { FirebaseContext } from '/util/firebase.js';
import { getFullSystem } from '/util/firebase.js';
import { doc, getDoc } from 'firebase/firestore';

// Function to sort station objects and order properties as specified
function sortStations(stations) {
  const sortedStations = {};
  Object.keys(stations).sort().forEach(stationId => {
    const { id, info, densityInfo, ...stationWithoutId } = stations[stationId];
    sortedStations[stationId] = {
      isWaypoint: stationWithoutId.isWaypoint,
      name: stationWithoutId.name,
      grade: stationWithoutId.grade,
      lat: stationWithoutId.lat,
      lng: stationWithoutId.lng,
    };
  });
  return sortedStations;
}

// Function to sort interchange objects and keep only stationIds
function sortInterchanges(interchanges) {
  const sortedInterchanges = {};
  Object.keys(interchanges).sort().forEach(interchangeId => {
    sortedInterchanges[interchangeId] = {
      stationIds: interchanges[interchangeId].stationIds,
    };
  });
  return sortedInterchanges;
}

// Function to sort line group objects and keep only label
function sortLineGroups(lineGroups) {
  const sortedLineGroups = {};
  Object.keys(lineGroups).sort().forEach(lineGroupId => {
    sortedLineGroups[lineGroupId] = {
      label: lineGroups[lineGroupId].label,
    };
  });
  return sortedLineGroups;
}

// Function to sort line objects and order properties as specified
function sortLines(lines) {
  const sortedLines = {};
  Object.keys(lines).sort().forEach(lineId => {
    const { id, ridershipInfo, ...lineWithoutId } = lines[lineId];
    sortedLines[lineId] = {
      name: lineWithoutId.name,
      color: lineWithoutId.color,
      mode: lineWithoutId.mode || 'RAPID', // Default mode value
      lineGroupId: lineWithoutId.lineGroupId,
      stationIds: lineWithoutId.stationIds,
      waypointOverrides: lineWithoutId.waypointOverrides,
    };
  });
  return sortedLines;
}

// Function to format JSON string with custom formatting rules
function formatJSON(obj) {
  const jsonString = JSON.stringify(obj, null, 2);
  return jsonString
    //.replace(/,\n\s+/g, ', ');
    //.replace()
    .replace();
}

// Main Export component
export function ImportAndExport({ systemId, onSetToast }) {
  const firebaseContext = React.useContext(FirebaseContext);

  const handleExport = async () => {
    try {
      // Fetching the full system data
      const fullSystem = await getFullSystem(systemId);

      // Sorting and formatting the system data
      const sortedSystem = {
        title: fullSystem.map.title,
        caption: fullSystem.map.caption,
        map: {
          stations: sortStations(fullSystem.map.stations),
          interchanges: sortInterchanges(fullSystem.map.interchanges),
          lineGroups: sortLineGroups(fullSystem.map.lineGroups),
          lines: sortLines(fullSystem.map.lines),
        },
        meta: {
          systemNumStr: fullSystem.meta.systemNumStr,
          nextStationId: fullSystem.meta.nextStationId,
          nextInterchangeId: fullSystem.meta.nextInterchangeId,
          nextLineGroupId: fullSystem.meta.nextLineGroupId,
          nextLineId: fullSystem.meta.nextLineId,
        },
      };

      // Formatting the system data as JSON string
      const systemData = formatJSON(sortedSystem);

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
