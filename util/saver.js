import { writeBatch, collection, doc, getDoc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import { geohashForLocation } from 'geofire-common';
import { lineString as turfLineString } from '@turf/helpers';
import turfLength from '@turf/length';
import sizeof from 'firestore-size';

import { getPartsFromSystemId, floatifyStationCoord, partitionSections, stationIdsToCoordinates, getLevel } from '/util/helpers.js';
import { DEFAULT_LINE_MODE, INDIVIDUAL_STRUCTURE, PARTITIONED_STRUCTURE } from '/util/constants.js';

mapboxgl.accessToken = 'pk.eyJ1IjoiaWpuZW16ZXIiLCJhIjoiY2xma3B0bW56MGQ4aTQwczdsejVvZ2cyNSJ9.FF2XWl1MkT9OUVL_HBJXNQ';
const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;
const MAX_FIRESTORE_BYTES = 1048576;

export class Saver {
  constructor(firebaseContext,
              systemId,
              system = {},
              meta = {},
              makePrivate = false,
              lockComments = false,
              ancestors = [],
              isNew = false,
              intendedStructure = PARTITIONED_STRUCTURE) {
    this.firebaseContext = firebaseContext;
    this.systemId = systemId;
    this.system = system;
    this.meta = meta;
    this.makePrivate = makePrivate;
    this.lockComments = lockComments;
    this.ancestors = ancestors;
    this.isNew = isNew;
    this.intendedStructure = intendedStructure;

    const viewParts = getPartsFromSystemId(this.systemId);
    this.userId = viewParts.userId;
    this.systemNumStr = viewParts.systemNumStr;

    this.batchArray = [];
    this.operationCounter = 0;
    this.batchIndex = 0;
  }

  async save() {
    if (!this.checkIsSavable()) return;

    try {
      this.resetBatcher();
      this.batchArray.push(writeBatch(this.firebaseContext.database));

      switch(this.intendedStructure) {
        case PARTITIONED_STRUCTURE:
          await this.handleSystemDoc(PARTITIONED_STRUCTURE);

          const mapPartitions = this.getMapPartitions();
          await this.handleRemovedPartitions(mapPartitions);
          await this.handleChangedPartitions(mapPartitions);
          break;
        case INDIVIDUAL_STRUCTURE:
          await this.handleSystemDoc(INDIVIDUAL_STRUCTURE);

          await this.handleRemovedLines();
          await this.handleRemovedStations();
          await this.handleRemovedInterchanges();
          await this.handleRemovedLineGroups();
          await this.handleChangedLines();
          await this.handleChangedStations();
          await this.handleChangedInterchanges();
          await this.handleChangedLineGroups();
          break;
        default:
          throw `this.intendedStructure must be '${INDIVIDUAL_STRUCTURE}' or '${PARTITIONED_STRUCTURE}'`;
          break;
      }

      this.batchArray.forEach(async batch => await batch.commit());
      console.log('System saved successfully!');
      return true;
    } catch (e) {
      console.error('Saver.save error: ', e);
    }
  }

  async updatePrivate() {
    if (!this.checkIsSavable()) return;

    try {
      const systemDoc = doc(this.firebaseContext.database, `systems/${this.systemId}`);
      const systemSnap = await getDoc(systemDoc);

      if (systemSnap.exists()) {
        await updateDoc(systemDoc, {
          isPrivate: this.makePrivate ? true : false
        });

        console.log('System visibility updated successfully!');
        return true;
      }
    } catch (e) {
      console.error('Saver.updateVisibility error: ', e);
    }
  }

  async updateCommentsLocked() {
    if (!this.checkIsSavable()) return;

    try {
      const systemDoc = doc(this.firebaseContext.database, `systems/${this.systemId}`);
      const systemSnap = await getDoc(systemDoc);

      if (systemSnap.exists()) {
        await updateDoc(systemDoc, {
          commentsLocked: this.lockComments ? true : false
        });

        console.log('System comments locked updated successfully!');
        return true;
      }
    } catch (e) {
      console.error('Saver.updateCommentsLocked error: ', e);
    }
  }

  async delete() {
    if (!this.checkIsSavable()) return;

    try {
      const systemDoc = doc(this.firebaseContext.database, `systems/${this.systemId}`);
      await deleteDoc(systemDoc);

      console.log('System deleted successfully!');
      return true;
    } catch (e) {
      console.error('Saver.delete error: ', e);
    }
  }

  /**
   * Checks whether the map is savable based ona variety of required fields and conditions
   * @returns {boolean} if the map is savable
   */
  checkIsSavable() {
    if (!this.firebaseContext) return false;
    if (!this.systemId) return false;
    if (Object.keys(this.system).length === 0) return false;
    if (Object.keys(this.meta).length === 0) return false;

    if (!(this.firebaseContext.user && this.firebaseContext.user.uid && this.firebaseContext.user.uid === this.userId)) {
      // current user does not match one in systemId
      return false;
    }

    if (this.isNew && this.checkIsBlocked()) return false;

    return true;
  }

  /**
   * Checks if the owner of the direct ancestor has blocked the saving user or vice versa
   * @returns {boolean} the result of the bidirectional block check
   */
  checkIsBlocked() {
    if ((this.ancestors || []).length) {
      const directAncestor = this.ancestors[this.ancestors.length - 1];
      if (!directAncestor.startsWith('defaultSystems/')) {
        const ancestorParts = getPartsFromSystemId(directAncestor);
        if (this.firebaseContext.checkBidirectionalBlocks(ancestorParts.userId)) {
          return true;
        }
      }
    }

    return false;
  }

  resetBatcher() {
    this.batchArray = [];
    this.operationCounter = 0;
    this.batchIndex = 0;
  }

  async handleSystemDoc(structure) {
    const systemDoc = doc(this.firebaseContext.database, `systems/${this.systemId}`);
    const systemSnap = await getDoc(systemDoc);

    const titleWords = this.generateTitleKeywords();
    const { centroid, maxDist, avgDist } = this.getGeoData();
    const { trackLength, avgSpacing, level } = this.getTrackInfo();
    const geoWords = await this.generateGeoKeywords(centroid, maxDist);
    const keywords = [...titleWords, ...geoWords];
    const uniqueKeywords = keywords.filter((kw, ind) => kw && ind === keywords.indexOf(kw));

    const numLines = Object.keys(this.system.lines || {}).length;
    const numInterchanges = Object.keys(this.system.interchanges || {}).length;
    const numLineGroups = Object.keys(this.system.lineGroups || {}).length;

    const modeSet = new Set();
    for (const line of Object.values(this.system.lines || {})) {
      modeSet.add(line.mode ? line.mode : DEFAULT_LINE_MODE);
    }
    const numModes = modeSet.size;

    let numStations = 0;
    let numWaypoints = 0;
    for (const station of Object.values(this.system.stations || {})) {
      if (station.isWaypoint) {
        numWaypoints++;
      } else {
        numStations++;
      }
    }

    const timestamp = Date.now();

    if (!this.isNew && systemSnap.exists()) {
      let prevTime = systemSnap.data().debouncedTime || 0;
      const debouceDuration = parseInt(process.env.NEXT_PUBLIC_SAVE_DEBOUNCE_MS) || 600000; // default to ten mins
      if (prevTime < timestamp - debouceDuration) {
        prevTime = timestamp;
      }

      this.batchArray[this.batchIndex].update(systemDoc, {
        structure: structure,
        lastUpdated: timestamp,
        debouncedTime: prevTime,
        isPrivate: this.makePrivate ? true : false,
        title: this.system.title ? this.system.title : 'Map',
        caption: this.system.caption ? this.system.caption : '',
        meta: this.meta,
        keywords: uniqueKeywords,
        centroid: centroid || null,
        geohash: centroid ? geohashForLocation([ centroid.lat, centroid.lng ], 10) : null,
        maxDist: maxDist || null,
        avgDist: avgDist || null,
        trackLength: trackLength || null,
        avgSpacing: avgSpacing || null,
        level: level || null,
        numStations: numStations,
        numWaypoints: numWaypoints,
        numLines: numLines,
        numInterchanges: numInterchanges,
        numLineGroups: numLineGroups,
        numModes: numModes
      });

      this.operationCounter++;
    } else if (this.isNew && !systemSnap.exists()) {
      const userDoc = doc(this.firebaseContext.database, `users/${this.userId}`);
      const userSnap = await getDoc(userDoc);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.systemsCreated || userData.systemsCreated === 0) {
          this.batchArray[this.batchIndex].update(userDoc, {
            systemsCreated: userData.systemsCreated + 1
          });
        } else if (userData.systemIds) {
          // for backfilling
          const intIds = [...userData.systemIds, this.systemNumStr].map((a) => parseInt(a));
          this.batchArray[this.batchIndex].update(userDoc, {
            systemsCreated: Math.max(...intIds) + 1
          });
        } else {
          this.batchArray[this.batchIndex].update(userDoc, {
            systemsCreated: (parseInt(this.systemNumStr) || 0) + 1
          });
        }

        this.batchArray[this.batchIndex].set(systemDoc, {
          structure: structure,
          systemId: this.systemId,
          userId: this.userId,
          systemNumStr: this.systemNumStr,
          creationDate: timestamp,
          lastUpdated: timestamp,
          debouncedTime: timestamp,
          isPrivate: this.makePrivate ? true : false,
          title: this.system.title ? this.system.title : 'Map',
          caption: this.system.caption ? this.system.caption : '',
          meta: this.meta,
          ancestors: this.ancestors,
          keywords: uniqueKeywords,
          centroid: centroid || null,
          geohash: centroid ? geohashForLocation([ centroid.lat, centroid.lng ], 10) : null,
          maxDist: maxDist || null,
          avgDist: avgDist || null,
          trackLength: trackLength || null,
          avgSpacing: avgSpacing || null,
          level: level || null,
          numStations: numStations,
          numWaypoints: numWaypoints,
          numLines: numLines,
          numInterchanges: numInterchanges,
          numLineGroups: numLineGroups,
          numModes: numModes
        });

        this.operationCounter += 2;
      } else {
        throw 'userSnap does not exist';
      }
    } else {
      throw 'isNew and systemSnap.exists() must not be the same';
    }
  }

  getMapPartitions() {
    const mapData = {
      stations: this.system.stations || {},
      lines: this.system.lines || {},
      interchanges: this.system.interchanges || {},
      lineGroups: this.system.lineGroups || {}
    };

    if (sizeof(mapData) > (MAX_FIRESTORE_BYTES * 0.5)) {
      // trim out station info if map is > 1/2 the max firestore document size of 1 MB
      mapData.stations = this.trimStations();
      console.log('Map is large; trimming station info.');
    }

    const stationIds = Object.keys(mapData.stations);
    const lineIds = Object.keys(mapData.lines);
    const interchangeIds = Object.keys(mapData.interchanges);
    const lineGroupIds = Object.keys(mapData.lineGroups);

    // each partition should be up to 80% of the max document size
    const partitionCount = Math.ceil(sizeof(mapData) / (MAX_FIRESTORE_BYTES * 0.8));
    const stationsIndexInterval = stationIds.length / partitionCount;
    const linesIndexInterval = lineIds.length / partitionCount;
    const interchangesIndexInterval = interchangeIds.length / partitionCount;
    const lineGroupsIndexInterval = lineGroupIds.length / partitionCount;

    let partitions = {};
    let stationStartIndex = 0;
    let lineStartIndex = 0;
    let interchangeStartIndex = 0;
    let lineGroupStartIndex = 0;
    for (let i = 0; i < partitionCount; i++) {
      const stationEndIndex = Math.min(Math.ceil(stationStartIndex + stationsIndexInterval), stationIds.length);
      let stationsPartition = {};
      for (const sId of stationIds.slice(stationStartIndex, stationEndIndex)) {
        stationsPartition[sId] = mapData.stations[sId];
      }
      stationStartIndex = stationEndIndex;

      const lineEndIndex = Math.min(Math.ceil(lineStartIndex + linesIndexInterval), lineIds.length);
      let linesPartition = {};
      for (const sId of lineIds.slice(lineStartIndex, lineEndIndex)) {
        linesPartition[sId] = mapData.lines[sId];
      }
      lineStartIndex = lineEndIndex;

      const interchangeEndIndex = Math.min(Math.ceil(interchangeStartIndex + interchangesIndexInterval), interchangeIds.length);
      let interchangesPartition = {};
      for (const sId of interchangeIds.slice(interchangeStartIndex, interchangeEndIndex)) {
        interchangesPartition[sId] = mapData.interchanges[sId];
      }
      interchangeStartIndex = interchangeEndIndex;

      const lineGroupEndIndex = Math.min(Math.ceil(lineGroupStartIndex + lineGroupsIndexInterval), lineGroupIds.length);
      let lineGroupsPartition = {};
      for (const sId of lineGroupIds.slice(lineGroupStartIndex, lineGroupEndIndex)) {
        lineGroupsPartition[sId] = mapData.lineGroups[sId];
      }
      lineGroupStartIndex = lineGroupEndIndex;

      const partitionId = `${i}`;
      partitions[partitionId] = {
        id: partitionId,
        stations: stationsPartition,
        lines: linesPartition,
        interchanges: interchangesPartition,
        lineGroups: lineGroupsPartition
      }
    }

    return partitions;
  }

  trimStations() {
    let trimmedStations = {};
    for (const sId in this.system.stations) {
      if (this.system.stations[sId].info) {
        let stationWithoutInfo = JSON.parse(JSON.stringify(this.system.stations[sId]));
        delete stationWithoutInfo.info;
        trimmedStations[sId] = stationWithoutInfo;
      } else {
        trimmedStations[sId] = this.system.stations[sId];
      }
    }
    return trimmedStations;
  }

  checkAndHandleBatching() {
    if (this.operationCounter >= 449) { // max of 500 but leaving a bit of space for reasons
      this.batchArray.push(writeBatch(this.firebaseContext.database));
      this.batchIndex++;
      this.operationCounter = 0;
    }
  }

  // The handle*Partitions functions are used for saving systems with PARTITIONED structure

  async handleRemovedPartitions(mapPartitions) {
    if (!Object.keys(mapPartitions || {}).length) {
      throw `no partitions found to save`;
    }

    const partitionsSnap = await getDocs(collection(this.firebaseContext.database, `systems/${this.systemId}/partitions`));
    partitionsSnap.forEach((partitionDoc) => {
      if (!(partitionDoc.id in mapPartitions)) {
        this.checkAndHandleBatching();

        this.batchArray[this.batchIndex].delete(partitionDoc.ref);
        this.operationCounter++;
      }
    });
  }

  async handleChangedPartitions(mapPartitions) {
    if (!Object.keys(mapPartitions || {}).length) {
      throw `no partitions found to save`;
    }

    for (const partitionId in mapPartitions) {
      this.checkAndHandleBatching();

      const partitionDoc = doc(this.firebaseContext.database, `systems/${this.systemId}/partitions/${partitionId}`);
      this.batchArray[this.batchIndex].set(partitionDoc, mapPartitions[partitionId]);
      this.operationCounter++;
    }
  }

  // The handleRemoved*s and handleChanged*s functions are used for saving systems with INDIVIDUAL structure

  async handleRemovedLines() {
    const linesSnap = await getDocs(collection(this.firebaseContext.database, `systems/${this.systemId}/lines`));
    linesSnap.forEach((lineDoc) => {
      if (!(lineDoc.id in (this.system.lines || {}))) {
        this.checkAndHandleBatching();

        this.batchArray[this.batchIndex].delete(lineDoc.ref);
        this.operationCounter++;
      }
    });
  }

  async handleRemovedStations() {
    const stationsSnap = await getDocs(collection(this.firebaseContext.database, `systems/${this.systemId}/stations`));
    stationsSnap.forEach((stationDoc) => {
      if (!(stationDoc.id in (this.system.stations || {}))) {
        this.checkAndHandleBatching();

        this.batchArray[this.batchIndex].delete(stationDoc.ref);
        this.operationCounter++;
      }
    });
  }

  async handleRemovedInterchanges() {
    const interchangesSnap = await getDocs(collection(this.firebaseContext.database, `systems/${this.systemId}/interchanges`));
    interchangesSnap.forEach((interchangeDoc) => {
      if (!(interchangeDoc.id in (this.system.interchanges || {}))) {
        this.checkAndHandleBatching();

        this.batchArray[this.batchIndex].delete(interchangeDoc.ref);
        this.operationCounter++;
      }
    });
  }

  async handleRemovedLineGroups() {
    const lineGroupsSnap = await getDocs(collection(this.firebaseContext.database, `systems/${this.systemId}/lineGroups`));
    lineGroupsSnap.forEach((lineGroupDoc) => {
      if (!(lineGroupDoc.id in (this.system.lineGroups || {}))) {
        this.checkAndHandleBatching();

        this.batchArray[this.batchIndex].delete(lineGroupDoc.ref);
        this.operationCounter++;
      }
    });
  }

  async handleChangedLines() {
    for (const lineKey in (this.system.lines || {})) {
      this.checkAndHandleBatching();

      const lineDoc = doc(this.firebaseContext.database, `systems/${this.systemId}/lines/${lineKey}`);
      this.batchArray[this.batchIndex].set(lineDoc, this.system.lines[lineKey]);
      this.operationCounter++;
    }
  }

  async handleChangedStations() {
    for (const stationId in (this.system.stations || {})) {
      this.checkAndHandleBatching();

      const stationDoc = doc(this.firebaseContext.database, `systems/${this.systemId}/stations/${stationId}`);
      this.batchArray[this.batchIndex].set(stationDoc, this.system.stations[stationId]);
      this.operationCounter++;
    }
  }

  async handleChangedInterchanges() {
    for (const interchangeId in (this.system.interchanges || {})) {
      this.checkAndHandleBatching();

      const interchangeDoc = doc(this.firebaseContext.database, `systems/${this.systemId}/interchanges/${interchangeId}`);
      this.batchArray[this.batchIndex].set(interchangeDoc, this.system.interchanges[interchangeId]);
      this.operationCounter++;
    }
  }

  async handleChangedLineGroups() {
    for (const lineGroupId in (this.system.lineGroups || {})) {
      this.checkAndHandleBatching();

      const lineGroupDoc = doc(this.firebaseContext.database, `systems/${this.systemId}/lineGroups/${lineGroupId}`);
      this.batchArray[this.batchIndex].set(lineGroupDoc, this.system.lineGroups[lineGroupId]);
      this.operationCounter++;
    }
  }

  // functions below here were migrated from the v1 API

  generateTitleKeywords() {
    let keywords = [];
    if (this.system.title) {
      // Split the lowercase title on whitespace and special characters.
      // Add full title and each word of the title to the keywords.
      let title = this.system.title.toLowerCase();
      let titleWords = title.split(SPLIT_REGEX);
      keywords.push(...titleWords);
    }
    return keywords;
  }

  async generateGeoKeywords(coord, maxDist) {
    if (!coord) {
      return [];
    }

    let words = [];
    let placeType = 'place';
    if (maxDist > 3000) {
      return ['world', 'worldwide', 'global', 'earth', 'international'];
    } else if (maxDist > 1500) {
      placeType = 'country';
      words.push('international');
    } else if (maxDist > 500) {
      placeType = 'country';
    } else if (maxDist > 60) {
      placeType = 'region';
    }

    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coord.lng},${coord.lat}.json?access_token=${mapboxgl.accessToken}`;
    let request = new XMLHttpRequest();
    request.open('GET', geocodeUrl, false);  // `false` makes the request synchronous
    request.send(null);

    if (request.status !== 200) {
      return words;
    }

    try {
      const result = JSON.parse(request.response);
      if (result && result.features) {
        const placeFeatures = result.features.filter((feature) => feature.place_type.includes(placeType));
        if (!placeFeatures.length) {
          return words;
        }

        const placeFeature = placeFeatures[0]; // should only be one
        let placeWords = (placeFeature.text || '').toLowerCase().split(SPLIT_REGEX);
        words.push(...placeWords);
        if (placeFeature.properties && placeFeature.properties.short_code) {
          let shortWords = placeFeature.properties.short_code.toLowerCase().split(SPLIT_REGEX);
          words.push(...shortWords);
        }

        for (const item of (placeFeature.context || [])) {
          let additionalWords = (item.text || '').toLowerCase().split(SPLIT_REGEX);
          let shortWords = (item.short_code || '').toLowerCase().split(SPLIT_REGEX);
          words.push(...additionalWords, ...shortWords);
        }
      }
    } catch (e) {
      console.log('generateGeoKeywords error:', e);
    }

    return words;
  }

  getDistance(coord1, coord2) {
    const unit = 'M';
    const lat1 = coord1.lat;
    const lon1 = coord1.lng;
    const lat2 = coord2.lat;
    const lon2 = coord2.lng;

    if ((lat1 === lat2) && (lon1 === lon2)) {
      return 0;
    } else {
      let radlat1 = Math.PI * lat1 / 180;
      let radlat2 = Math.PI * lat2 / 180;
      let theta = lon1 - lon2;
      let radtheta = Math.PI * theta / 180;
      let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);

      if (dist > 1) {
        dist = 1;
      }

      dist = Math.acos(dist);
      dist = dist * 180 / Math.PI;
      dist = dist * 60 * 1.1515;

      if (unit === 'K') {
        dist = dist * 1.609344
      }
      return dist;
    }
  }

  getGeoData() {
    let cleanedStations = Object.values(this.system.stations).filter(s => !s.isWaypoint).map(s => floatifyStationCoord(s));
    if (cleanedStations.length) {
      // Get centroid, bounding box, and average distance to centroid of all stations.

      const sum = (total, curr) => total + curr;

      let lats = cleanedStations.map(s => s.lat);
      let lngs = cleanedStations.map(s => s.lng);

      const corners = [
        {lat: Math.max(...lats), lng: Math.min(...lngs)},
        {lat: Math.max(...lats), lng: Math.max(...lngs)},
        {lat: Math.min(...lats), lng: Math.max(...lngs)},
        {lat: Math.min(...lats), lng: Math.min(...lngs)}
      ];
      const centroid = {
        lat: lats.reduce(sum) / cleanedStations.length,
        lng: lngs.reduce(sum) / cleanedStations.length
      };
      const maxDist = Math.max(...corners.map(c => this.getDistance(centroid, c)));
      const avgDist = cleanedStations.map(s => this.getDistance(centroid, s)).reduce(sum) / cleanedStations.length;

      return { centroid, maxDist, avgDist };
    }

    return {};
  }

  getTrackInfo() {
    let trackLength = 0;
    let avgSpacing;
    let level;
    try {
      const lines = Object.values(this.system.lines || {});
      if (lines.length) {
        let sectionSet = new Set();
        let numSections = 0;
        for (const line of lines) {
          const sections = partitionSections(line, this.system.stations);

          for (const section of sections) {
            if (section.length >= 2) {
              // ensure we don't double count reversed sections
              let orderedSection = section.slice();
              if (section[section.length - 1] > section[0]) {
                orderedSection = section.slice().reverse();
              }
              const orderedStr = orderedSection.join('|');

              // only count each section once
              if (!sectionSet.has(orderedStr)) {
                trackLength += turfLength(turfLineString(stationIdsToCoordinates(this.system.stations, orderedSection)),
                                          { units: 'miles' });
                numSections++;
                sectionSet.add(orderedStr);
              }
            }
          }
        }

        if (trackLength && numSections) {
          avgSpacing = trackLength / numSections;
          level = getLevel({ avgSpacing }).key;
        }
      }
    } catch (e) {
      console.log('getTrackInfo error:', e);
    }

    return { trackLength, avgSpacing, level };
  }
}
