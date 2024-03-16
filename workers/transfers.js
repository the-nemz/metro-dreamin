import { getTransfersForStation } from '/util/helpers.js';
self.onmessage = ({ data }) => {
  const lines = data.lines || {};
  const stations = data.stations || {};

  const stopsByLineId = {};
  for (const lineId in lines) {
    stopsByLineId[lineId] = lines[lineId].stationIds.filter(sId => stations[sId] &&
                                                                   !stations[sId].isWaypoint &&
                                                                   !(lines[lineId].waypointOverrides || []).includes(sId));
  }

  let updatedTransfersByStationId = {};
  for (const stationId in stations) {
    updatedTransfersByStationId[stationId] = getTransfersForStation(stationId, lines, stopsByLineId);
  }

  postMessage({ transfersByStationId: updatedTransfersByStationId });
};
