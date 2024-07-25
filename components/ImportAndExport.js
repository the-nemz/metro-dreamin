import React from 'react';
import { FirebaseContext } from '/util/firebase.js';
import { getFullSystem } from '/util/firebase.js';
import { doc, getDoc } from 'firebase/firestore';

function sortObjectByKey(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {});
}

function sortStations(stations) {
  const sortedStations = {};
  Object.keys(stations).sort().forEach(stationId => {
    const station = stations[stationId];
    sortedStations[stationId] = {
      id: station.id,
      name: station.name,
      lat: station.lat,
      lng: station.lng,
      ...(station.info && { info: sortObjectByKey(station.info) }),
      ...(station.densityInfo && { densityInfo: sortObjectByKey(station.densityInfo) }),
    };
  });
  return sortedStations;
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
      link.download = `${systemTitle.replace(/\s+/g, '_')}_by_${creatorName.replace(/\s+/g, '_')}.json`;
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
