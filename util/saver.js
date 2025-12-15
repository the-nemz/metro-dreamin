import { writeBatch, collection, doc, getDoc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import { geohashForLocation } from 'geofire-common';
import { lineString as turfLineString } from '@turf/helpers';
import turfLength from '@turf/length';
import sizeof from 'firestore-size';

import { DEFAULT_LINE_MODE, INDIVIDUAL_STRUCTURE, MS_IN_SIX_HOURS, PARTITIONED_STRUCTURE } from '/util/constants.js';
import {
  getPartsFromSystemId,
  floatifyStationCoord,
  divideLineSections,
  stationIdsToCoordinates,
  getLevel,
  normalizeLongitude,
  roundCoordinate,
  trimDecimals,
  partitionSystem
} from '/util/helpers.js';
import { CrudClient } from '/util/crudClient.js';
import {
  analyzeDependencies,
  groupParallelOperations,
  getLinesForStation,
  getInterchangesForStation,
  needsMetadataRecalc,
  createStationOp,
  updateStationOp,
  deleteStationOp,
  createLineOp,
  updateLineOp,
  deleteLineOp,
  createInterchangeOp,
  updateInterchangeOp,
  deleteInterchangeOp,
  createLineGroupOp,
  updateLineGroupOp,
  deleteLineGroupOp
} from '/util/types/granular-crud.js';

mapboxgl.accessToken = 'pk.eyJ1IjoiaWpuZW16ZXIiLCJhIjoiY2xma3B0bW56MGQ4aTQwczdsejVvZ2cyNSJ9.FF2XWl1MkT9OUVL_HBJXNQ';
const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;
const MAX_FIRESTORE_BYTES = 1048576;

export class Saver {
  constructor(firebaseContext,
              systemId,
              system = {},
              meta = {},
              makePrivate = false,
              hideScore = false,
              lockComments = false,
              ancestors = [],
              isNew = false,
              intendedStructure = PARTITIONED_STRUCTURE) {
    this.firebaseContext = firebaseContext;
    this.systemId = systemId;
    this.system = system;
    this.meta = meta;
    this.makePrivate = makePrivate;
    this.hideScore = hideScore;
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

    // Initialize CrudClient for granular operations
    this.crudClient = new CrudClient(firebaseContext, systemId);
    
    // Baseline snapshot for diff-based saves (set after successful save)
    this.lastSavedSnapshot = null;
  }

  /**
   * Sets the baseline snapshot for diff-based saves
   * Should be called after a successful save or when loading an existing system
   * @param {Object} system - The system state to use as baseline
   */
  setBaseline(system) {
    this.lastSavedSnapshot = JSON.parse(JSON.stringify(system));
  }

  /**
   * Clears the baseline snapshot
   * Useful when switching systems or after a full save
   */
  clearBaseline() {
    this.lastSavedSnapshot = null;
  }

  /**
   * Generates EntityOperation[] by comparing current system to baseline snapshot
   * - CREATE: Entity exists in current but not in baseline
   * - UPDATE: Entity exists in both but has changed
   * - DELETE: Entity exists in baseline but not in current
   * 
   * CRITICAL: Always diffs against baseline, not accumulated change IDs.
   * This ensures undo/redo works correctly.
   * 
   * @param {Object} currentSystem - The current system state
   * @returns {import('./types/granular-crud.js').EntityOperation[]} Array of operations
   */
  generateOperationsFromDiff(currentSystem) {
    if (!this.lastSavedSnapshot) {
      return [];
    }

    const operations = [];
    const baseline = this.lastSavedSnapshot;

    // Compare stations
    const baselineStations = baseline.stations || {};
    const currentStations = currentSystem.stations || {};
    
    for (const stationId in currentStations) {
      if (!(stationId in baselineStations)) {
        // CREATE: exists in current but not in baseline
        // Spread entity first, then override id to ensure correct ID is used
        operations.push(createStationOp({ ...currentStations[stationId], id: stationId }));
      } else if (this.hasEntityChanged(baselineStations[stationId], currentStations[stationId])) {
        // UPDATE: exists in both but has changed
        // Ensure id field is correct in case entity has stale id
        const entityData = { ...currentStations[stationId], id: stationId };
        operations.push(updateStationOp(stationId, entityData));
      }
    }
    for (const stationId in baselineStations) {
      if (!(stationId in currentStations)) {
        // DELETE: exists in baseline but not in current
        // Generate cascade operations for station delete
        const cascadeOps = this.generateStationDeleteBundle(stationId, currentSystem, baseline);
        operations.push(...cascadeOps);
      }
    }

    // Compare lines
    const baselineLines = baseline.lines || {};
    const currentLines = currentSystem.lines || {};
    
    for (const lineId in currentLines) {
      if (!(lineId in baselineLines)) {
        // Spread entity first, then override id to ensure correct ID is used
        operations.push(createLineOp({ ...currentLines[lineId], id: lineId }));
      } else if (this.hasEntityChanged(baselineLines[lineId], currentLines[lineId])) {
        // Ensure id field is correct in case entity has stale id
        const entityData = { ...currentLines[lineId], id: lineId };
        operations.push(updateLineOp(lineId, entityData));
      }
    }
    for (const lineId in baselineLines) {
      if (!(lineId in currentLines)) {
        operations.push(deleteLineOp(lineId));
      }
    }

    // Compare interchanges
    const baselineInterchanges = baseline.interchanges || {};
    const currentInterchanges = currentSystem.interchanges || {};
    
    for (const icId in currentInterchanges) {
      if (!(icId in baselineInterchanges)) {
        // Spread entity first, then override id to ensure correct ID is used
        operations.push(createInterchangeOp({ ...currentInterchanges[icId], id: icId }));
      } else if (this.hasEntityChanged(baselineInterchanges[icId], currentInterchanges[icId])) {
        // Ensure id field is correct in case entity has stale id
        const entityData = { ...currentInterchanges[icId], id: icId };
        operations.push(updateInterchangeOp(icId, entityData));
      }
    }
    for (const icId in baselineInterchanges) {
      if (!(icId in currentInterchanges)) {
        operations.push(deleteInterchangeOp(icId));
      }
    }

    // Compare lineGroups
    const baselineLineGroups = baseline.lineGroups || {};
    const currentLineGroups = currentSystem.lineGroups || {};
    
    for (const lgId in currentLineGroups) {
      if (!(lgId in baselineLineGroups)) {
        // Spread entity first, then override id to ensure correct ID is used
        operations.push(createLineGroupOp({ ...currentLineGroups[lgId], id: lgId }));
      } else if (this.hasEntityChanged(baselineLineGroups[lgId], currentLineGroups[lgId])) {
        // Ensure id field is correct in case entity has stale id
        const entityData = { ...currentLineGroups[lgId], id: lgId };
        operations.push(updateLineGroupOp(lgId, entityData));
      }
    }
    for (const lgId in baselineLineGroups) {
      if (!(lgId in currentLineGroups)) {
        // DELETE: exists in baseline but not in current
        // Generate cascade operations for lineGroup delete (updates affected lines)
        const cascadeOps = this.generateLineGroupDeleteBundle(lgId, currentSystem);
        operations.push(...cascadeOps);
      }
    }

    return operations;
  }

  /**
   * Compares two entities to determine if they have changed
   * @param {Object} baseline - The baseline entity
   * @param {Object} current - The current entity
   * @returns {boolean} True if the entities are different
   */
  hasEntityChanged(baseline, current) {
    return JSON.stringify(baseline) !== JSON.stringify(current);
  }

  /**
   * Generates cascade operations for deleting a station
   * CrudClient does NOT automatically update related entities, so Saver must generate
   * multi-entity bundles for referential integrity.
   * 
   * @param {string} stationId - The station ID to delete
   * @param {Object} currentSystem - The current system state
   * @param {Object} baseline - The baseline system state (for finding references)
   * @returns {import('./types/granular-crud.js').EntityOperation[]} Array of operations
   */
  generateStationDeleteBundle(stationId, currentSystem, baseline) {
    const ops = [];
    
    // Find and update all lines referencing this station in the baseline
    // We use baseline because the station might have already been removed from lines in currentSystem
    const affectedLines = getLinesForStation(stationId, baseline);
    for (const lineId of affectedLines) {
      const currentLine = currentSystem.lines?.[lineId];
      if (currentLine) {
        // Line still exists, update it to remove the station
        const updatedStationIds = currentLine.stationIds.filter(id => id !== stationId);
        if (updatedStationIds.length !== currentLine.stationIds.length) {
          ops.push(updateLineOp(lineId, {
            stationIds: updatedStationIds
          }));
        }
      }
    }
    
    // Find and update/delete affected interchanges
    const affectedInterchanges = getInterchangesForStation(stationId, baseline);
    for (const icId of affectedInterchanges) {
      const currentIc = currentSystem.interchanges?.[icId];
      if (currentIc) {
        // Interchange still exists
        const remainingStations = currentIc.stationIds.filter(id => id !== stationId);
        if (remainingStations.length <= 1) {
          // Delete if only 1 or fewer stations remain (interchange needs at least 2)
          ops.push(deleteInterchangeOp(icId));
        } else if (remainingStations.length !== currentIc.stationIds.length) {
          // Update to remove the station
          ops.push(updateInterchangeOp(icId, {
            stationIds: remainingStations
          }));
        }
      }
    }
    
    // Finally, delete the station itself
    ops.push(deleteStationOp(stationId));
    
    return ops;
  }

  /**
   * Generates a bundle of operations for deleting a lineGroup and updating affected lines.
   * When a lineGroup is deleted, all lines that reference it via lineGroupId need to be updated
   * to remove the reference (set lineGroupId to null/undefined).
   * 
   * @param {string} lineGroupId - The ID of the lineGroup being deleted
   * @param {Object} currentSystem - The current system state
   * @returns {import('./types/granular-crud.js').EntityOperation[]}
   */
  generateLineGroupDeleteBundle(lineGroupId, currentSystem) {
    const ops = [];
    
    // Find all lines that reference this lineGroup
    const currentLines = currentSystem.lines || {};
    for (const [lineId, line] of Object.entries(currentLines)) {
      if (line.lineGroupId === lineGroupId) {
        // Update line to remove the lineGroup reference
        const { lineGroupId: _, ...lineWithoutGroup } = line;
        ops.push(updateLineOp(lineId, lineWithoutGroup));
      }
    }
    
    // Finally, delete the lineGroup itself
    ops.push(deleteLineGroupOp(lineGroupId));
    
    return ops;
  }

  /**
   * Saves only the changed entities using granular CRUD operations
   * This method uses diff-based detection and dependency analysis for efficient saves.
   * 
   * IMPORTANT: This method always updates the system doc with title, caption, meta,
   * and visibility settings to ensure meta-only edits are persisted.
   * 
   * @param {Object} currentSystem - The current system state
   * @returns {Promise<{success: boolean, noChanges?: boolean, conflicts?: Array, results?: Array}>}
   */
  async saveChangedEntities(currentSystem) {
    // 1. Generate operations from diff
    const operations = this.generateOperationsFromDiff(currentSystem);
    
    // Always update system doc fields (title, caption, meta, visibility)
    // This ensures meta-only edits are persisted even when no entity changes
    const hasEntityChanges = operations.length > 0;
    
    if (!hasEntityChanges) {
      // Even with no entity changes, we need to persist meta/title/caption changes
      await this.updateSystemDocFields(currentSystem);
      return { success: true, noChanges: true };
    }

    // 2. Analyze dependencies
    const analysis = analyzeDependencies(operations, currentSystem);

    // 3. Check for conflicts
    if (analysis.conflicts.length > 0) {
      console.warn('Saver.saveChangedEntities: conflicts detected', analysis.conflicts);
      // Clear baseline on conflict to force full save next time
      this.clearBaseline();
      return { success: false, conflicts: analysis.conflicts };
    }

    try {
      // 4. Execute transactional groups first (must succeed)
      for (const group of analysis.transactionalGroups) {
        const result = await this.crudClient.executeTransaction({
          systemId: this.systemId,
          operations: group
        });
        if (!result.success) {
          console.error('Saver.saveChangedEntities: transactional group failed', result);
          // Clear baseline on failure to force full save next time
          // This ensures we don't have inconsistent state between local and remote
          this.clearBaseline();
          return result;
        }
      }

      // 5. Execute dependent chains sequentially
      for (const chain of analysis.dependentChains) {
        const result = await this.crudClient.executeBatch({
          systemId: this.systemId,
          operations: chain,
          atomic: true
        });
        if (!result.success) {
          console.error('Saver.saveChangedEntities: dependent chain failed', result);
          // Clear baseline on failure to force full save next time
          // This ensures we don't have inconsistent state between local and remote
          this.clearBaseline();
          return result;
        }
      }

      // 6. Execute parallelizable groups
      const parallelGroups = groupParallelOperations(analysis.independentOps, currentSystem);
      const parallelResults = await Promise.all(
        parallelGroups.map(group => 
          this.crudClient.executeBatch({
            systemId: this.systemId,
            operations: group,
            atomic: false
          })
        )
      );

      // Check for any failures in parallel execution
      const failedResults = parallelResults.filter(r => !r.success);
      if (failedResults.length > 0) {
        console.error('Saver.saveChangedEntities: parallel batch failed', failedResults);
        // Clear baseline on failure to force full save next time
        // This ensures we don't have inconsistent state between local and remote
        this.clearBaseline();
        return { success: false, results: parallelResults };
      }

      // 7. Update metadata if needed
      if (needsMetadataRecalc(operations)) {
        await this.updateMetadata(currentSystem);
      }

      // 8. Always update system doc fields (title, caption, meta, visibility)
      await this.updateSystemDocFields(currentSystem);

      // 9. Update baseline snapshot
      this.setBaseline(currentSystem);

      return { success: true, results: parallelResults };
    } catch (e) {
      console.error('Saver.saveChangedEntities error:', e);
      // On partial failure, clear baseline to force full save next time
      // This ensures we don't have inconsistent state between local and remote
      this.clearBaseline();
      return { success: false, error: e.message };
    }
  }

  /**
   * Updates system metadata (geohash, keywords, level, centroid, counts)
   * This preserves the existing metadata logic from the original Saver.
   * 
   * @param {Object} currentSystem - The current system state
   */
  async updateMetadata(currentSystem) {
    // Temporarily set this.system to currentSystem for metadata generation
    const originalSystem = this.system;
    this.system = currentSystem;

    try {
      const titleWords = this.generateTitleKeywords();
      const { centroid, maxDist, avgDist } = this.getGeoData();
      const { trackLength, avgSpacing, level } = this.getTrackInfo();
      const geoWords = await this.generateGeoKeywords(centroid, maxDist);
      const keywords = [...titleWords, ...geoWords];
      const uniqueKeywords = keywords.filter((kw, ind) => kw && ind === keywords.indexOf(kw));

      const numLines = Object.keys(currentSystem.lines || {}).length;
      const numInterchanges = Object.keys(currentSystem.interchanges || {}).length;
      const numLineGroups = Object.keys(currentSystem.lineGroups || {}).length;

      const modeSet = new Set();
      for (const line of Object.values(currentSystem.lines || {})) {
        modeSet.add(line.mode ? line.mode : DEFAULT_LINE_MODE);
      }
      const numModes = modeSet.size;

      let numStations = 0;
      let numWaypoints = 0;
      for (const station of Object.values(currentSystem.stations || {})) {
        if (station.isWaypoint) {
          numWaypoints++;
        } else {
          numStations++;
        }
      }

      const timestamp = Date.now();
      const systemDoc = doc(this.firebaseContext.database, `systems/${this.systemId}`);
      
      await updateDoc(systemDoc, {
        lastUpdated: timestamp,
        keywords: uniqueKeywords,
        centroid: centroid || null,
        geohash: centroid ? geohashForLocation([centroid.lat, centroid.lng], 10) : null,
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
    } finally {
      // Restore original system
      this.system = originalSystem;
    }
  }

  /**
   * Updates system doc fields that are NOT recalculated from entity data.
   * This includes title, caption, meta, and visibility settings.
   * Called on every granular save to ensure meta-only edits are persisted.
   * 
   * @param {Object} currentSystem - The current system state
   */
  async updateSystemDocFields(currentSystem) {
    const timestamp = Date.now();
    const systemDoc = doc(this.firebaseContext.database, `systems/${this.systemId}`);
    
    await updateDoc(systemDoc, {
      lastUpdated: timestamp,
      isPrivate: this.makePrivate ? true : false,
      scoreIsHidden: this.hideScore ? true : false,
      commentsLocked: this.lockComments ? true : false,
      title: currentSystem.title ? currentSystem.title : 'Map',
      caption: currentSystem.caption ? currentSystem.caption : '',
      meta: this.meta
    });
  }

  /**
   * Returns generated operations without executing them (for testing)
   * @param {Object} currentSystem - The current system state
   * @returns {{operations: import('./types/granular-crud.js').EntityOperation[], analysis: import('./types/granular-crud.js').DependencyAnalysis}}
   */
  dryRun(currentSystem) {
    const operations = this.generateOperationsFromDiff(currentSystem);
    const analysis = analyzeDependencies(operations, currentSystem);
    return { operations, analysis };
  }

  /**
   * Main save method that chooses between granular and full save
   * Uses granular saves for INDIVIDUAL_STRUCTURE when baseline exists,
   * falls back to full save for PARTITIONED_STRUCTURE or when no baseline.
   * 
   * IMPORTANT: For PARTITIONED_STRUCTURE, the current CrudClient has potential issues
   * with getDocs() inside transactions. For this session, we use granular saves ONLY
   * for INDIVIDUAL_STRUCTURE and fall back to existing full-save logic for PARTITIONED_STRUCTURE.
   */
  async save() {
    if (!this.checkIsSavable()) return;

    // Check if we can use granular saves
    const structure = await this.crudClient.getStorageStructure();
    
    if (structure === INDIVIDUAL_STRUCTURE && this.lastSavedSnapshot && !this.isNew) {
      // Use granular save for INDIVIDUAL_STRUCTURE when we have a baseline
      const result = await this.saveChangedEntities(this.system);
      if (result.success) {
        console.log('System saved successfully using granular CRUD!');
        return true;
      } else if (result.noChanges) {
        console.log('No changes to save.');
        return true;
      } else {
        console.error('Granular save failed, falling back to full save:', result);
        // Fall through to full save
      }
    }

    // Fall back to existing full save logic
    return this.saveFullSystem();
  }

  /**
   * Performs a full system save using the original batch-based approach.
   * This is used for PARTITIONED_STRUCTURE, new systems, or when granular save fails.
   */
  async saveFullSystem() {
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

      await Promise.all(this.batchArray.map(b => b.commit()));

      // Set baseline after successful full save
      this.setBaseline(this.system);

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

  async updateScoreIsHidden() {
    if (!this.checkIsSavable()) return;

    try {
      const systemDoc = doc(this.firebaseContext.database, `systems/${this.systemId}`);
      const systemSnap = await getDoc(systemDoc);

      if (systemSnap.exists()) {
        await updateDoc(systemDoc, {
          scoreIsHidden: this.hideScore ? true : false
        });

        console.log('System score visibility updated successfully!');
        return true;
      }
    } catch (e) {
      console.error('Saver.updateScoreIsHidden error: ', e);
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
   * Checks whether the map is savable based on a variety of required fields and conditions
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

    const { centroid, maxDist, avgDist } = this.getGeoData();
    const { trackLength, avgSpacing, level } = this.getTrackInfo();

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
      const systemDocFieldsToUpdate = {
        structure: structure,
        lastUpdated: timestamp,
        timeBlock: Math.floor(timestamp / MS_IN_SIX_HOURS),
        isPrivate: this.makePrivate ? true : false,
        scoreIsHidden: this.hideScore ? true : false,
        title: this.system.title ? this.system.title : 'Map',
        caption: this.system.caption ? this.system.caption : '',
        meta: this.meta,
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
      };

      const prevTime = systemSnap.data().debouncedTime || 0;
      const debouceDuration = parseInt(process.env.NEXT_PUBLIC_SAVE_DEBOUNCE_MS) || 600000; // default to ten mins
      if (prevTime < timestamp - debouceDuration) {
        systemDocFieldsToUpdate.debouncedTime = timestamp;
        // debounce generating new geo keywords
        systemDocFieldsToUpdate.keywords = await this.generateNewKeywords(centroid, maxDist);
      } else {
        systemDocFieldsToUpdate.keywords = this.appendTitleKeywords(systemSnap.data().keywords || []);
      }

      this.batchArray[this.batchIndex].update(systemDoc, systemDocFieldsToUpdate);

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

        const uniqueKeywords = await this.generateNewKeywords(centroid, maxDist);

        this.batchArray[this.batchIndex].set(systemDoc, {
          structure: structure,
          systemId: this.systemId,
          userId: this.userId,
          systemNumStr: this.systemNumStr,
          creationDate: timestamp,
          lastUpdated: timestamp,
          debouncedTime: timestamp,
          timeBlock: Math.floor(timestamp / MS_IN_SIX_HOURS),
          isPrivate: this.makePrivate ? true : false,
          scoreIsHidden: this.hideScore ? true : false,
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

    // each partition should be up to 80% of the max document size
    const partitionCount = Math.ceil(sizeof(mapData) / (MAX_FIRESTORE_BYTES * 0.8));
    return partitionSystem(mapData, partitionCount);
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

  async generateNewKeywords(centroid, maxDist) {
    const titleWords = this.generateTitleKeywords();
    const geoWords = await this.generateGeoKeywords(centroid, maxDist);
    const keywords = [...titleWords, ...geoWords];
    return keywords.filter((kw, ind) => kw && ind === keywords.indexOf(kw));
  }

  appendTitleKeywords(existingKeywords) {
    const titleWords = this.generateTitleKeywords();
    const keywords = [...titleWords, ...existingKeywords];
    return keywords.filter((kw, ind) => kw && ind === keywords.indexOf(kw));
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
    const allPoints = Object.values(this.system.stations).map(s => floatifyStationCoord(s));
    const fullStations = allPoints.filter(s => !s.isWaypoint);
    // fall back to use waypoints on waypoint-only maps
    const pointsForAverages = fullStations.length ? fullStations : allPoints;

    if (!allPoints.length || !pointsForAverages.length) return {};

    // Get centroid, bounding box, and average distance to centroid of all stations.

    const sum = (total, curr) => total + curr;

    const allLats = allPoints.map(s => s.lat);
    const allLngs = allPoints.map(s => normalizeLongitude(s.lng));
    const stationLats = pointsForAverages.map(s => s.lat);
    const stationLngs = pointsForAverages.map(s => normalizeLongitude(s.lng));

    const corners = [
      {lat: Math.max(...allLats), lng: Math.min(...allLngs)},
      {lat: Math.max(...allLats), lng: Math.max(...allLngs)},
      {lat: Math.min(...allLats), lng: Math.max(...allLngs)},
      {lat: Math.min(...allLats), lng: Math.min(...allLngs)}
    ];

    const latAvg = stationLats.reduce(sum) / pointsForAverages.length;
    const lngAvg = stationLngs.reduce(sum) / pointsForAverages.length;

    const centroidReg = {
      lat: latAvg,
      lng: normalizeLongitude(lngAvg)
    };
    const centroidOpp = {
      lat: latAvg,
      lng: normalizeLongitude(lngAvg + 180)
    };

    const avgDistReg = pointsForAverages.map(s => this.getDistance(centroidReg, s)).reduce(sum) / pointsForAverages.length;
    const avgDistOpp = pointsForAverages.map(s => this.getDistance(centroidOpp, s)).reduce(sum) / pointsForAverages.length;

    const avgDist = Math.min(avgDistReg, avgDistOpp);
    const centroid = avgDistReg <= avgDistOpp ? centroidReg : centroidOpp;
    const maxDist = Math.max(...corners.map(c => this.getDistance(centroid, c)));

    return {
      centroid: roundCoordinate(centroid, 4),
      maxDist: trimDecimals(maxDist, 3),
      avgDist: trimDecimals(avgDist, 3)
    };
  }

  getTrackInfo() {
    let trackLength = 0;
    let avgSpacing;
    let level;

    try {
      const lines = Object.values(this.system.lines || {});
      if (lines.length) {
        let pairSet = new Set();
        let sectionSet = new Set();
        let numSections = 0;

        for (const line of lines) {
          for (let i = 0; i < line.stationIds.length - 1; i++) {
            const currStationId = line.stationIds[i];
            const nextStationId = line.stationIds[i + 1];
            const orderedPair = [currStationId, nextStationId].sort();
            const pairKey = orderedPair.join('|');

            if (!pairSet.has(pairKey)) {
              trackLength += turfLength(turfLineString(stationIdsToCoordinates(this.system.stations, orderedPair)),
                                        { units: 'miles' });
              pairSet.add(pairKey);
            }
          }

          const sections = divideLineSections(line, this.system.stations);
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
                numSections++;
                sectionSet.add(orderedStr);
              }
            }
          }
        }

        if (trackLength && numSections) {
          avgSpacing = trimDecimals(trackLength / numSections, 3);
          level = getLevel({ avgSpacing }).key;
          trackLength = trimDecimals(trackLength, 3);
        }
      }
    } catch (e) {
      console.log('getTrackInfo error:', e);
    }

    return { trackLength, avgSpacing, level };
  }
}
