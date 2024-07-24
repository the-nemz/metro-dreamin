import React from 'react';
import { FirebaseContext, getFullSystem, getUserDocData } from '/util/firebase.js';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '/util/firebase.js';

export function ImportAndExport({ systemId, onSetToast }) {
  const firebaseContext = React.useContext(FirebaseContext);

  const handleExport = async () => {
    try {
      const fullSystem = await getFullSystem(systemId);
      const systemDocRef = doc(firestore, `systems/${systemId}`);
      const systemDoc = await getDoc(systemDocRef);
      const systemData = systemDoc.data();

      if (!systemData) {
        throw new Error('System data not found');
      }

      const userDoc = await getUserDocData(systemData.userId);
      const mapTitle = systemData.title || 'map';
      const mapCreator = userDoc?.displayName || 'unknown_creator';

      const formattedFileName = `${mapTitle}_by_${mapCreator}.json`;

      const systemDataJSON = JSON.stringify(fullSystem, null, 2);
      const blob = new Blob([systemDataJSON], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = formattedFileName;
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
        <i className="fas fa-download"></i>
      </button>
      {/* Future Import functionality will be added here */}
    </div>
  );
}
