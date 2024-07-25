import React from 'react';
import { FirebaseContext } from '/util/firebase.js';
import { getFullSystem } from '/util/firebase.js';
import { doc, getDoc } from 'firebase/firestore';

function sortStations(stations) {
  const sortedStations = {};
  Object.keys(stations).sort().forEach(stationId => {
    const { id, info, densityInfo, ...stationWithoutId } = stations[stationId];
    sortedStations[stationId] = {
      name: stationWithoutId.name,
      lat: stationWithoutId.lat,
      lng: stationWithoutId.lng,
      ...stationWithoutId,
    };
  });
  return sortedStations;
}

function sortLines(lines) {
  const sortedLines = {};
  Object.keys(lines).sort().forEach(lineId => {
    const { id, ridershipInfo, ...lineWithoutId } = lines[lineId];
    sortedLines[lineId] = {
      name: lineWithoutId.name,
      color: lineWithoutId.color,
      stationIds: lineWithoutId.stationIds,
      ...lineWithoutId,
    };
  });
  return sortedLines;
}

export function ImportAndExport({ systemId, onSetToast }) {
  const firebaseContext = React.useContext(FirebaseContext);

  const handleExport = async () => {
    try {
      const fullSystem = await getFullSystem(systemId);
      const sortedSystem = {
        ...fullSystem,
        map: {
          ...fullSystem.map,
          stations: sortStations(fullSystem.map.stations),
          lines: sortLines(fullSystem.map.lines),
        },
      };
      const systemData = JSON.stringify(sortedSystem, null, 2);
      const systemDoc = await getDoc(doc(firebaseContext.database, `systems/${systemId}`));
      const systemTitle = systemDoc.data().title || 'Untitled_Map';
      const creatorDoc = await getDoc(doc(firebaseContext.database, `users/${systemDoc.data().userId}`));
      const creatorName = creatorDoc.data().displayName || 'Unknown_Creator';
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

  return (
    <div className="ImportAndExport">
      <button className="ImportAndExport-button" onClick={handleExport}>
        <i className="fas fa-download" style={{ color: 'orange' }}></i>
      </button>
      {/* Future Import functionality will be added here */}
    </div>
  );
}
