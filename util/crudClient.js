/**
 * Firebase CRUD Client for Metro-Dreamin
 * 
 * This module provides a client for performing granular CRUD operations
 * on metro system entities (stations, lines, interchanges, lineGroups).
 * 
 * @fileoverview Firebase CRUD client implementation
 * @see docs/granular-crud-api-design.md for full specification
 */

import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  runTransaction
} from 'firebase/firestore';

import { INDIVIDUAL_STRUCTURE, PARTITIONED_STRUCTURE } from '/util/constants.js';
import {
  splitIntoBatches,
  isRetryableError,
  ErrorCodes,
  needsMetadataRecalc
} from '/util/types/granular-crud.js';

/**
 * Default batch size limit (conservative, Firestore max is 500)
 */
const DEFAULT_BATCH_SIZE = 450;

/**
 * Default maximum retries for retryable errors
 */
const DEFAULT_MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff (in milliseconds)
 */
const BASE_RETRY_DELAY = 1000;

/**
 * CRUD Client for performing granular operations on metro system entities
 */
export class CrudClient {
  /**
   * Creates a new CrudClient instance
   * @param {Object} firebaseContext - Firebase context with database reference
   * @param {string} systemId - The system ID to operate on
   */
  constructor(firebaseContext, systemId) {
    if (!firebaseContext || !firebaseContext.database) {
      throw new Error('firebaseContext with database is required');
    }
    if (!systemId) {
      throw new Error('systemId is required');
    }
    
    this.db = firebaseContext.database;
    this.firebaseContext = firebaseContext;
    this.systemId = systemId;
    this._cachedStructure = null;
  }

  // ============================================================================
  // Storage Structure Detection
  // ============================================================================

  /**
   * Detects the storage structure used by the system
   * @returns {Promise<string>} INDIVIDUAL_STRUCTURE or PARTITIONED_STRUCTURE
   */
  async getStorageStructure() {
    if (this._cachedStructure) {
      return this._cachedStructure;
    }

    try {
      const systemDoc = await getDoc(doc(this.db, `systems/${this.systemId}`));
      
      if (!systemDoc.exists()) {
        // Default to partitioned for new systems
        this._cachedStructure = PARTITIONED_STRUCTURE;
        return this._cachedStructure;
      }

      const data = systemDoc.data();
      this._cachedStructure = data.structure || PARTITIONED_STRUCTURE;
      return this._cachedStructure;
    } catch (error) {
      console.error('Error detecting storage structure:', error);
      // Default to partitioned on error
      return PARTITIONED_STRUCTURE;
    }
  }

  /**
   * Clears the cached storage structure (useful after structure changes)
   */
  clearStructureCache() {
    this._cachedStructure = null;
  }

  // ============================================================================
  // Single Entity Operations - Stations
  // ============================================================================

  /**
   * Creates a new station
   * @param {import('./types/granular-crud.js').Station} station - Station to create
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async createStation(station) {
    return this.executeWithRetry(async () => {
      const structure = await this.getStorageStructure();
      
      if (structure === INDIVIDUAL_STRUCTURE) {
        const stationDoc = doc(this.db, `systems/${this.systemId}/stations/${station.id}`);
        
        // Check if station already exists
        const existing = await getDoc(stationDoc);
        if (existing.exists()) {
          return {
            success: false,
            entityId: station.id,
            entityType: 'station',
            operationType: 'CREATE',
            error: 'Station already exists',
            errorCode: ErrorCodes.ENTITY_ALREADY_EXISTS,
            serverTimestamp: Date.now()
          };
        }
        
        await setDoc(stationDoc, station);
        
        return {
          success: true,
          entityId: station.id,
          entityType: 'station',
          operationType: 'CREATE',
          serverTimestamp: Date.now()
        };
      } else {
        // For partitioned structure, use transaction to update partition
        return this.createEntityInPartition('stations', station);
      }
    });
  }

  /**
   * Updates an existing station
   * @param {string} stationId - ID of station to update
   * @param {Partial<import('./types/granular-crud.js').Station>} updates - Updates to apply
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async updateStation(stationId, updates) {
    return this.executeWithRetry(async () => {
      const structure = await this.getStorageStructure();
      
      if (structure === INDIVIDUAL_STRUCTURE) {
        const stationDoc = doc(this.db, `systems/${this.systemId}/stations/${stationId}`);
        
        // Check if station exists
        const existing = await getDoc(stationDoc);
        if (!existing.exists()) {
          return {
            success: false,
            entityId: stationId,
            entityType: 'station',
            operationType: 'UPDATE',
            error: 'Station not found',
            errorCode: ErrorCodes.ENTITY_NOT_FOUND,
            serverTimestamp: Date.now()
          };
        }
        
        await updateDoc(stationDoc, updates);
        
        return {
          success: true,
          entityId: stationId,
          entityType: 'station',
          operationType: 'UPDATE',
          serverTimestamp: Date.now()
        };
      } else {
        return this.updateEntityInPartition('stations', stationId, updates);
      }
    });
  }

  /**
   * Deletes a station
   * @param {string} stationId - ID of station to delete
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async deleteStation(stationId) {
    return this.executeWithRetry(async () => {
      const structure = await this.getStorageStructure();
      
      if (structure === INDIVIDUAL_STRUCTURE) {
        const stationDoc = doc(this.db, `systems/${this.systemId}/stations/${stationId}`);
        
        // Check if station exists
        const existing = await getDoc(stationDoc);
        if (!existing.exists()) {
          return {
            success: false,
            entityId: stationId,
            entityType: 'station',
            operationType: 'DELETE',
            error: 'Station not found',
            errorCode: ErrorCodes.ENTITY_NOT_FOUND,
            serverTimestamp: Date.now()
          };
        }
        
        await deleteDoc(stationDoc);
        
        return {
          success: true,
          entityId: stationId,
          entityType: 'station',
          operationType: 'DELETE',
          serverTimestamp: Date.now()
        };
      } else {
        return this.deleteEntityFromPartition('stations', stationId);
      }
    });
  }

  // ============================================================================
  // Single Entity Operations - Lines
  // ============================================================================

  /**
   * Creates a new line
   * @param {import('./types/granular-crud.js').Line} line - Line to create
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async createLine(line) {
    return this.executeWithRetry(async () => {
      const structure = await this.getStorageStructure();
      
      if (structure === INDIVIDUAL_STRUCTURE) {
        const lineDoc = doc(this.db, `systems/${this.systemId}/lines/${line.id}`);
        
        const existing = await getDoc(lineDoc);
        if (existing.exists()) {
          return {
            success: false,
            entityId: line.id,
            entityType: 'line',
            operationType: 'CREATE',
            error: 'Line already exists',
            errorCode: ErrorCodes.ENTITY_ALREADY_EXISTS,
            serverTimestamp: Date.now()
          };
        }
        
        await setDoc(lineDoc, line);
        
        return {
          success: true,
          entityId: line.id,
          entityType: 'line',
          operationType: 'CREATE',
          serverTimestamp: Date.now()
        };
      } else {
        return this.createEntityInPartition('lines', line);
      }
    });
  }

  /**
   * Updates an existing line
   * @param {string} lineId - ID of line to update
   * @param {Partial<import('./types/granular-crud.js').Line>} updates - Updates to apply
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async updateLine(lineId, updates) {
    return this.executeWithRetry(async () => {
      const structure = await this.getStorageStructure();
      
      if (structure === INDIVIDUAL_STRUCTURE) {
        const lineDoc = doc(this.db, `systems/${this.systemId}/lines/${lineId}`);
        
        const existing = await getDoc(lineDoc);
        if (!existing.exists()) {
          return {
            success: false,
            entityId: lineId,
            entityType: 'line',
            operationType: 'UPDATE',
            error: 'Line not found',
            errorCode: ErrorCodes.ENTITY_NOT_FOUND,
            serverTimestamp: Date.now()
          };
        }
        
        await updateDoc(lineDoc, updates);
        
        return {
          success: true,
          entityId: lineId,
          entityType: 'line',
          operationType: 'UPDATE',
          serverTimestamp: Date.now()
        };
      } else {
        return this.updateEntityInPartition('lines', lineId, updates);
      }
    });
  }

  /**
   * Deletes a line
   * @param {string} lineId - ID of line to delete
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async deleteLine(lineId) {
    return this.executeWithRetry(async () => {
      const structure = await this.getStorageStructure();
      
      if (structure === INDIVIDUAL_STRUCTURE) {
        const lineDoc = doc(this.db, `systems/${this.systemId}/lines/${lineId}`);
        
        const existing = await getDoc(lineDoc);
        if (!existing.exists()) {
          return {
            success: false,
            entityId: lineId,
            entityType: 'line',
            operationType: 'DELETE',
            error: 'Line not found',
            errorCode: ErrorCodes.ENTITY_NOT_FOUND,
            serverTimestamp: Date.now()
          };
        }
        
        await deleteDoc(lineDoc);
        
        return {
          success: true,
          entityId: lineId,
          entityType: 'line',
          operationType: 'DELETE',
          serverTimestamp: Date.now()
        };
      } else {
        return this.deleteEntityFromPartition('lines', lineId);
      }
    });
  }

  // ============================================================================
  // Single Entity Operations - Interchanges
  // ============================================================================

  /**
   * Creates a new interchange
   * @param {import('./types/granular-crud.js').Interchange} interchange - Interchange to create
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async createInterchange(interchange) {
    return this.executeWithRetry(async () => {
      const structure = await this.getStorageStructure();
      
      if (structure === INDIVIDUAL_STRUCTURE) {
        const interchangeDoc = doc(this.db, `systems/${this.systemId}/interchanges/${interchange.id}`);
        
        const existing = await getDoc(interchangeDoc);
        if (existing.exists()) {
          return {
            success: false,
            entityId: interchange.id,
            entityType: 'interchange',
            operationType: 'CREATE',
            error: 'Interchange already exists',
            errorCode: ErrorCodes.ENTITY_ALREADY_EXISTS,
            serverTimestamp: Date.now()
          };
        }
        
        await setDoc(interchangeDoc, interchange);
        
        return {
          success: true,
          entityId: interchange.id,
          entityType: 'interchange',
          operationType: 'CREATE',
          serverTimestamp: Date.now()
        };
      } else {
        return this.createEntityInPartition('interchanges', interchange);
      }
    });
  }

  /**
   * Updates an existing interchange
   * @param {string} interchangeId - ID of interchange to update
   * @param {Partial<import('./types/granular-crud.js').Interchange>} updates - Updates to apply
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async updateInterchange(interchangeId, updates) {
    return this.executeWithRetry(async () => {
      const structure = await this.getStorageStructure();
      
      if (structure === INDIVIDUAL_STRUCTURE) {
        const interchangeDoc = doc(this.db, `systems/${this.systemId}/interchanges/${interchangeId}`);
        
        const existing = await getDoc(interchangeDoc);
        if (!existing.exists()) {
          return {
            success: false,
            entityId: interchangeId,
            entityType: 'interchange',
            operationType: 'UPDATE',
            error: 'Interchange not found',
            errorCode: ErrorCodes.ENTITY_NOT_FOUND,
            serverTimestamp: Date.now()
          };
        }
        
        await updateDoc(interchangeDoc, updates);
        
        return {
          success: true,
          entityId: interchangeId,
          entityType: 'interchange',
          operationType: 'UPDATE',
          serverTimestamp: Date.now()
        };
      } else {
        return this.updateEntityInPartition('interchanges', interchangeId, updates);
      }
    });
  }

  /**
   * Deletes an interchange
   * @param {string} interchangeId - ID of interchange to delete
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async deleteInterchange(interchangeId) {
    return this.executeWithRetry(async () => {
      const structure = await this.getStorageStructure();
      
      if (structure === INDIVIDUAL_STRUCTURE) {
        const interchangeDoc = doc(this.db, `systems/${this.systemId}/interchanges/${interchangeId}`);
        
        const existing = await getDoc(interchangeDoc);
        if (!existing.exists()) {
          return {
            success: false,
            entityId: interchangeId,
            entityType: 'interchange',
            operationType: 'DELETE',
            error: 'Interchange not found',
            errorCode: ErrorCodes.ENTITY_NOT_FOUND,
            serverTimestamp: Date.now()
          };
        }
        
        await deleteDoc(interchangeDoc);
        
        return {
          success: true,
          entityId: interchangeId,
          entityType: 'interchange',
          operationType: 'DELETE',
          serverTimestamp: Date.now()
        };
      } else {
        return this.deleteEntityFromPartition('interchanges', interchangeId);
      }
    });
  }

  // ============================================================================
  // Single Entity Operations - Line Groups
  // ============================================================================

  /**
   * Creates a new line group
   * @param {import('./types/granular-crud.js').LineGroup} lineGroup - LineGroup to create
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async createLineGroup(lineGroup) {
    return this.executeWithRetry(async () => {
      const structure = await this.getStorageStructure();
      
      if (structure === INDIVIDUAL_STRUCTURE) {
        const lineGroupDoc = doc(this.db, `systems/${this.systemId}/lineGroups/${lineGroup.id}`);
        
        const existing = await getDoc(lineGroupDoc);
        if (existing.exists()) {
          return {
            success: false,
            entityId: lineGroup.id,
            entityType: 'lineGroup',
            operationType: 'CREATE',
            error: 'LineGroup already exists',
            errorCode: ErrorCodes.ENTITY_ALREADY_EXISTS,
            serverTimestamp: Date.now()
          };
        }
        
        await setDoc(lineGroupDoc, lineGroup);
        
        return {
          success: true,
          entityId: lineGroup.id,
          entityType: 'lineGroup',
          operationType: 'CREATE',
          serverTimestamp: Date.now()
        };
      } else {
        return this.createEntityInPartition('lineGroups', lineGroup);
      }
    });
  }

  /**
   * Updates an existing line group
   * @param {string} lineGroupId - ID of lineGroup to update
   * @param {Partial<import('./types/granular-crud.js').LineGroup>} updates - Updates to apply
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async updateLineGroup(lineGroupId, updates) {
    return this.executeWithRetry(async () => {
      const structure = await this.getStorageStructure();
      
      if (structure === INDIVIDUAL_STRUCTURE) {
        const lineGroupDoc = doc(this.db, `systems/${this.systemId}/lineGroups/${lineGroupId}`);
        
        const existing = await getDoc(lineGroupDoc);
        if (!existing.exists()) {
          return {
            success: false,
            entityId: lineGroupId,
            entityType: 'lineGroup',
            operationType: 'UPDATE',
            error: 'LineGroup not found',
            errorCode: ErrorCodes.ENTITY_NOT_FOUND,
            serverTimestamp: Date.now()
          };
        }
        
        await updateDoc(lineGroupDoc, updates);
        
        return {
          success: true,
          entityId: lineGroupId,
          entityType: 'lineGroup',
          operationType: 'UPDATE',
          serverTimestamp: Date.now()
        };
      } else {
        return this.updateEntityInPartition('lineGroups', lineGroupId, updates);
      }
    });
  }

  /**
   * Deletes a line group
   * @param {string} lineGroupId - ID of lineGroup to delete
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async deleteLineGroup(lineGroupId) {
    return this.executeWithRetry(async () => {
      const structure = await this.getStorageStructure();
      
      if (structure === INDIVIDUAL_STRUCTURE) {
        const lineGroupDoc = doc(this.db, `systems/${this.systemId}/lineGroups/${lineGroupId}`);
        
        const existing = await getDoc(lineGroupDoc);
        if (!existing.exists()) {
          return {
            success: false,
            entityId: lineGroupId,
            entityType: 'lineGroup',
            operationType: 'DELETE',
            error: 'LineGroup not found',
            errorCode: ErrorCodes.ENTITY_NOT_FOUND,
            serverTimestamp: Date.now()
          };
        }
        
        await deleteDoc(lineGroupDoc);
        
        return {
          success: true,
          entityId: lineGroupId,
          entityType: 'lineGroup',
          operationType: 'DELETE',
          serverTimestamp: Date.now()
        };
      } else {
        return this.deleteEntityFromPartition('lineGroups', lineGroupId);
      }
    });
  }

  // ============================================================================
  // Partitioned Structure Helpers
  // ============================================================================

  /**
   * Creates an entity in a partitioned structure
   * @param {string} entityType - Type of entity (stations, lines, etc.)
   * @param {Object} entity - Entity to create
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async createEntityInPartition(entityType, entity) {
    const singularType = entityType.replace(/s$/, '');
    
    return runTransaction(this.db, async (transaction) => {
      // Get all partitions
      const partitionsSnap = await getDocs(
        collection(this.db, `systems/${this.systemId}/partitions`)
      );
      
      // Find the entity in existing partitions
      for (const partitionDoc of partitionsSnap.docs) {
        const partitionData = partitionDoc.data();
        if (partitionData[entityType] && partitionData[entityType][entity.id]) {
          return {
            success: false,
            entityId: entity.id,
            entityType: singularType,
            operationType: 'CREATE',
            error: `${singularType} already exists`,
            errorCode: ErrorCodes.ENTITY_ALREADY_EXISTS,
            serverTimestamp: Date.now()
          };
        }
      }
      
      // Add to first partition (or create one if none exist)
      let targetPartitionRef;
      let targetPartitionData;
      
      if (partitionsSnap.empty) {
        targetPartitionRef = doc(this.db, `systems/${this.systemId}/partitions/0`);
        targetPartitionData = { stations: {}, lines: {}, interchanges: {}, lineGroups: {} };
      } else {
        const firstPartition = partitionsSnap.docs[0];
        targetPartitionRef = firstPartition.ref;
        targetPartitionData = firstPartition.data();
      }
      
      // Add entity to partition
      if (!targetPartitionData[entityType]) {
        targetPartitionData[entityType] = {};
      }
      targetPartitionData[entityType][entity.id] = entity;
      
      transaction.set(targetPartitionRef, targetPartitionData);
      
      return {
        success: true,
        entityId: entity.id,
        entityType: singularType,
        operationType: 'CREATE',
        serverTimestamp: Date.now()
      };
    });
  }

  /**
   * Updates an entity in a partitioned structure
   * @param {string} entityType - Type of entity (stations, lines, etc.)
   * @param {string} entityId - ID of entity to update
   * @param {Object} updates - Updates to apply
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async updateEntityInPartition(entityType, entityId, updates) {
    const singularType = entityType.replace(/s$/, '');
    
    return runTransaction(this.db, async (transaction) => {
      const partitionsSnap = await getDocs(
        collection(this.db, `systems/${this.systemId}/partitions`)
      );
      
      // Find the entity in partitions
      for (const partitionDoc of partitionsSnap.docs) {
        const partitionData = partitionDoc.data();
        if (partitionData[entityType] && partitionData[entityType][entityId]) {
          // Update entity
          const updatedEntity = {
            ...partitionData[entityType][entityId],
            ...updates
          };
          partitionData[entityType][entityId] = updatedEntity;
          
          transaction.set(partitionDoc.ref, partitionData);
          
          return {
            success: true,
            entityId: entityId,
            entityType: singularType,
            operationType: 'UPDATE',
            serverTimestamp: Date.now()
          };
        }
      }
      
      return {
        success: false,
        entityId: entityId,
        entityType: singularType,
        operationType: 'UPDATE',
        error: `${singularType} not found`,
        errorCode: ErrorCodes.ENTITY_NOT_FOUND,
        serverTimestamp: Date.now()
      };
    });
  }

  /**
   * Deletes an entity from a partitioned structure
   * @param {string} entityType - Type of entity (stations, lines, etc.)
   * @param {string} entityId - ID of entity to delete
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async deleteEntityFromPartition(entityType, entityId) {
    const singularType = entityType.replace(/s$/, '');
    
    return runTransaction(this.db, async (transaction) => {
      const partitionsSnap = await getDocs(
        collection(this.db, `systems/${this.systemId}/partitions`)
      );
      
      // Find the entity in partitions
      for (const partitionDoc of partitionsSnap.docs) {
        const partitionData = partitionDoc.data();
        if (partitionData[entityType] && partitionData[entityType][entityId]) {
          // Delete entity
          delete partitionData[entityType][entityId];
          
          transaction.set(partitionDoc.ref, partitionData);
          
          return {
            success: true,
            entityId: entityId,
            entityType: singularType,
            operationType: 'DELETE',
            serverTimestamp: Date.now()
          };
        }
      }
      
      return {
        success: false,
        entityId: entityId,
        entityType: singularType,
        operationType: 'DELETE',
        error: `${singularType} not found`,
        errorCode: ErrorCodes.ENTITY_NOT_FOUND,
        serverTimestamp: Date.now()
      };
    });
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Executes a batch of operations
   * @param {import('./types/granular-crud.js').BatchRequest} batchRequest - Batch request
   * @returns {Promise<import('./types/granular-crud.js').BatchResponse>}
   */
  async executeBatch(batchRequest) {
    const { operations, atomic = false, metadata } = batchRequest;
    
    if (!operations || operations.length === 0) {
      return {
        success: true,
        results: [],
        successCount: 0,
        failureCount: 0,
        serverTimestamp: Date.now()
      };
    }
    
    const batches = splitIntoBatches(operations, DEFAULT_BATCH_SIZE);
    
    if (atomic) {
      return this.executeAtomicBatches(batches, metadata);
    } else {
      return this.executeParallelBatches(batches, metadata);
    }
  }

  /**
   * Executes batches atomically (all succeed or all fail)
   * @param {import('./types/granular-crud.js').EntityOperation[][]} batches - Batches to execute
   * @param {import('./types/granular-crud.js').BatchMetadataUpdate} [metadata] - Metadata updates
   * @returns {Promise<import('./types/granular-crud.js').BatchResponse>}
   */
  async executeAtomicBatches(batches, metadata) {
    const allResults = [];
    const structure = await this.getStorageStructure();
    
    try {
      // For atomic execution, we use a transaction
      await runTransaction(this.db, async (transaction) => {
        for (const batch of batches) {
          for (const op of batch) {
            await this.executeOperationInTransaction(transaction, op, structure);
            allResults.push({
              success: true,
              entityId: op.entityId,
              entityType: op.entityType,
              operationType: op.type,
              serverTimestamp: Date.now()
            });
          }
        }
      });
      
      return {
        success: true,
        results: allResults,
        successCount: allResults.length,
        failureCount: 0,
        serverTimestamp: Date.now()
      };
    } catch (error) {
      // All operations failed
      const flatOps = batches.flat();
      return {
        success: false,
        results: flatOps.map(op => ({
          success: false,
          entityId: op.entityId,
          entityType: op.entityType,
          operationType: op.type,
          error: error.message,
          errorCode: this.mapFirebaseErrorCode(error),
          serverTimestamp: Date.now()
        })),
        successCount: 0,
        failureCount: flatOps.length,
        serverTimestamp: Date.now()
      };
    }
  }

  /**
   * Executes batches in parallel (independent results)
   * @param {import('./types/granular-crud.js').EntityOperation[][]} batches - Batches to execute
   * @param {import('./types/granular-crud.js').BatchMetadataUpdate} [metadata] - Metadata updates
   * @returns {Promise<import('./types/granular-crud.js').BatchResponse>}
   */
  async executeParallelBatches(batches, metadata) {
    const structure = await this.getStorageStructure();
    const allResults = [];
    let successCount = 0;
    let failureCount = 0;
    
    // Execute batches in parallel
    const batchPromises = batches.map(async (batch) => {
      if (structure === INDIVIDUAL_STRUCTURE) {
        // Use Firestore batch for individual structure
        const firestoreBatch = writeBatch(this.db);
        const batchResults = [];
        
        for (const op of batch) {
          try {
            this.addOperationToBatch(firestoreBatch, op);
            batchResults.push({
              success: true,
              entityId: op.entityId,
              entityType: op.entityType,
              operationType: op.type,
              serverTimestamp: Date.now()
            });
          } catch (error) {
            batchResults.push({
              success: false,
              entityId: op.entityId,
              entityType: op.entityType,
              operationType: op.type,
              error: error.message,
              errorCode: this.mapFirebaseErrorCode(error),
              serverTimestamp: Date.now()
            });
          }
        }
        
        try {
          await firestoreBatch.commit();
          return batchResults;
        } catch (error) {
          // Mark all as failed if batch commit fails
          return batch.map(op => ({
            success: false,
            entityId: op.entityId,
            entityType: op.entityType,
            operationType: op.type,
            error: error.message,
            errorCode: this.mapFirebaseErrorCode(error),
            serverTimestamp: Date.now()
          }));
        }
      } else {
        // For partitioned structure, execute operations individually
        const batchResults = [];
        for (const op of batch) {
          const result = await this.executeSingleOperation(op);
          batchResults.push(result);
        }
        return batchResults;
      }
    });
    
    const batchResultsArray = await Promise.all(batchPromises);
    
    for (const batchResults of batchResultsArray) {
      for (const result of batchResults) {
        allResults.push(result);
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      }
    }
    
    return {
      success: failureCount === 0,
      results: allResults,
      successCount,
      failureCount,
      serverTimestamp: Date.now()
    };
  }

  /**
   * Adds an operation to a Firestore batch
   * @param {WriteBatch} batch - Firestore batch
   * @param {import('./types/granular-crud.js').EntityOperation} op - Operation to add
   */
  addOperationToBatch(batch, op) {
    const collectionName = this.getCollectionName(op.entityType);
    const docRef = doc(this.db, `systems/${this.systemId}/${collectionName}/${op.entityId}`);
    
    switch (op.type) {
      case 'CREATE':
        batch.set(docRef, op.data);
        break;
      case 'UPDATE':
        batch.update(docRef, op.data);
        break;
      case 'DELETE':
        batch.delete(docRef);
        break;
      default:
        throw new Error(`Unknown operation type: ${op.type}`);
    }
  }

  /**
   * Executes a single operation
   * @param {import('./types/granular-crud.js').EntityOperation} op - Operation to execute
   * @returns {Promise<import('./types/granular-crud.js').OperationResult>}
   */
  async executeSingleOperation(op) {
    switch (op.entityType) {
      case 'station':
        switch (op.type) {
          case 'CREATE':
            return this.createStation(op.data);
          case 'UPDATE':
            return this.updateStation(op.entityId, op.data);
          case 'DELETE':
            return this.deleteStation(op.entityId);
        }
        break;
      case 'line':
        switch (op.type) {
          case 'CREATE':
            return this.createLine(op.data);
          case 'UPDATE':
            return this.updateLine(op.entityId, op.data);
          case 'DELETE':
            return this.deleteLine(op.entityId);
        }
        break;
      case 'interchange':
        switch (op.type) {
          case 'CREATE':
            return this.createInterchange(op.data);
          case 'UPDATE':
            return this.updateInterchange(op.entityId, op.data);
          case 'DELETE':
            return this.deleteInterchange(op.entityId);
        }
        break;
      case 'lineGroup':
        switch (op.type) {
          case 'CREATE':
            return this.createLineGroup(op.data);
          case 'UPDATE':
            return this.updateLineGroup(op.entityId, op.data);
          case 'DELETE':
            return this.deleteLineGroup(op.entityId);
        }
        break;
    }
    
    return {
      success: false,
      entityId: op.entityId,
      entityType: op.entityType,
      operationType: op.type,
      error: `Unknown entity type or operation: ${op.entityType}/${op.type}`,
      errorCode: ErrorCodes.UNKNOWN_ERROR,
      serverTimestamp: Date.now()
    };
  }

  // ============================================================================
  // Transaction Operations
  // ============================================================================

  /**
   * Executes operations atomically with preconditions
   * @param {import('./types/granular-crud.js').TransactionRequest} transactionRequest - Transaction request
   * @returns {Promise<import('./types/granular-crud.js').TransactionResponse>}
   */
  async executeTransaction(transactionRequest) {
    const { operations, preconditions } = transactionRequest;
    const structure = await this.getStorageStructure();
    
    try {
      const results = await runTransaction(this.db, async (transaction) => {
        // Validate preconditions
        if (preconditions) {
          const preconditionResult = await this.validatePreconditions(transaction, preconditions, structure);
          if (!preconditionResult.valid) {
            throw {
              code: 'precondition-failed',
              failedPreconditions: preconditionResult.failedPreconditions,
              message: preconditionResult.message
            };
          }
        }
        
        // Execute all operations
        const opResults = [];
        for (const op of operations) {
          await this.executeOperationInTransaction(transaction, op, structure);
          opResults.push({
            success: true,
            entityId: op.entityId,
            entityType: op.entityType,
            operationType: op.type,
            serverTimestamp: Date.now()
          });
        }
        
        return opResults;
      });
      
      return {
        success: true,
        results,
        serverTimestamp: Date.now()
      };
    } catch (error) {
      if (error.code === 'precondition-failed') {
        return {
          success: false,
          results: operations.map(op => ({
            success: false,
            entityId: op.entityId,
            entityType: op.entityType,
            operationType: op.type,
            error: error.message,
            errorCode: ErrorCodes.PRECONDITION_FAILED,
            serverTimestamp: Date.now()
          })),
          failureReason: error.message,
          failureCode: ErrorCodes.PRECONDITION_FAILED,
          failedPreconditions: error.failedPreconditions,
          serverTimestamp: Date.now()
        };
      }
      
      return {
        success: false,
        results: operations.map(op => ({
          success: false,
          entityId: op.entityId,
          entityType: op.entityType,
          operationType: op.type,
          error: error.message,
          errorCode: this.mapFirebaseErrorCode(error),
          serverTimestamp: Date.now()
        })),
        failureReason: error.message,
        failureCode: this.mapFirebaseErrorCode(error),
        serverTimestamp: Date.now()
      };
    }
  }

  /**
   * Validates preconditions for a transaction
   * @param {Transaction} transaction - Firestore transaction
   * @param {import('./types/granular-crud.js').TransactionPreconditions} preconditions - Preconditions to validate
   * @param {string} structure - Storage structure
   * @returns {Promise<{valid: boolean, failedPreconditions?: string[], message?: string}>}
   */
  async validatePreconditions(transaction, preconditions, structure) {
    const failedPreconditions = [];
    
    if (structure === INDIVIDUAL_STRUCTURE) {
      // Check stationsMustExist
      if (preconditions.stationsMustExist) {
        for (const stationId of preconditions.stationsMustExist) {
          const stationDoc = await transaction.get(
            doc(this.db, `systems/${this.systemId}/stations/${stationId}`)
          );
          if (!stationDoc.exists()) {
            failedPreconditions.push(`station:${stationId}:must_exist`);
          }
        }
      }
      
      // Check linesMustExist
      if (preconditions.linesMustExist) {
        for (const lineId of preconditions.linesMustExist) {
          const lineDoc = await transaction.get(
            doc(this.db, `systems/${this.systemId}/lines/${lineId}`)
          );
          if (!lineDoc.exists()) {
            failedPreconditions.push(`line:${lineId}:must_exist`);
          }
        }
      }
      
      // Check stationsMustNotExist
      if (preconditions.stationsMustNotExist) {
        for (const stationId of preconditions.stationsMustNotExist) {
          const stationDoc = await transaction.get(
            doc(this.db, `systems/${this.systemId}/stations/${stationId}`)
          );
          if (stationDoc.exists()) {
            failedPreconditions.push(`station:${stationId}:must_not_exist`);
          }
        }
      }
      
      // Check linesMustNotExist
      if (preconditions.linesMustNotExist) {
        for (const lineId of preconditions.linesMustNotExist) {
          const lineDoc = await transaction.get(
            doc(this.db, `systems/${this.systemId}/lines/${lineId}`)
          );
          if (lineDoc.exists()) {
            failedPreconditions.push(`line:${lineId}:must_not_exist`);
          }
        }
      }
    } else {
      // For partitioned structure, we need to check across partitions
      // This is more complex and requires reading all partitions
      const partitionsSnap = await getDocs(
        collection(this.db, `systems/${this.systemId}/partitions`)
      );
      
      const allStations = new Set();
      const allLines = new Set();
      
      for (const partitionDoc of partitionsSnap.docs) {
        const data = partitionDoc.data();
        if (data.stations) {
          Object.keys(data.stations).forEach(id => allStations.add(id));
        }
        if (data.lines) {
          Object.keys(data.lines).forEach(id => allLines.add(id));
        }
      }
      
      if (preconditions.stationsMustExist) {
        for (const stationId of preconditions.stationsMustExist) {
          if (!allStations.has(stationId)) {
            failedPreconditions.push(`station:${stationId}:must_exist`);
          }
        }
      }
      
      if (preconditions.linesMustExist) {
        for (const lineId of preconditions.linesMustExist) {
          if (!allLines.has(lineId)) {
            failedPreconditions.push(`line:${lineId}:must_exist`);
          }
        }
      }
      
      if (preconditions.stationsMustNotExist) {
        for (const stationId of preconditions.stationsMustNotExist) {
          if (allStations.has(stationId)) {
            failedPreconditions.push(`station:${stationId}:must_not_exist`);
          }
        }
      }
      
      if (preconditions.linesMustNotExist) {
        for (const lineId of preconditions.linesMustNotExist) {
          if (allLines.has(lineId)) {
            failedPreconditions.push(`line:${lineId}:must_not_exist`);
          }
        }
      }
    }
    
    if (failedPreconditions.length > 0) {
      return {
        valid: false,
        failedPreconditions,
        message: `Preconditions failed: ${failedPreconditions.join(', ')}`
      };
    }
    
    return { valid: true };
  }

  /**
   * Executes a single operation within a transaction
   * @param {Transaction} transaction - Firestore transaction
   * @param {import('./types/granular-crud.js').EntityOperation} op - Operation to execute
   * @param {string} structure - Storage structure
   */
  async executeOperationInTransaction(transaction, op, structure) {
    if (structure === INDIVIDUAL_STRUCTURE) {
      const collectionName = this.getCollectionName(op.entityType);
      const docRef = doc(this.db, `systems/${this.systemId}/${collectionName}/${op.entityId}`);
      
      switch (op.type) {
        case 'CREATE':
          transaction.set(docRef, op.data);
          break;
        case 'UPDATE':
          transaction.update(docRef, op.data);
          break;
        case 'DELETE':
          transaction.delete(docRef);
          break;
        default:
          throw new Error(`Unknown operation type: ${op.type}`);
      }
    } else {
      // For partitioned structure, we need to modify the partition document
      // This is more complex as we need to find and update the right partition
      const partitionsSnap = await getDocs(
        collection(this.db, `systems/${this.systemId}/partitions`)
      );
      
      const entityTypePlural = this.getCollectionName(op.entityType);
      
      if (op.type === 'CREATE') {
        // Add to first partition
        let targetPartitionRef;
        let targetPartitionData;
        
        if (partitionsSnap.empty) {
          targetPartitionRef = doc(this.db, `systems/${this.systemId}/partitions/0`);
          targetPartitionData = { stations: {}, lines: {}, interchanges: {}, lineGroups: {} };
        } else {
          const firstPartition = partitionsSnap.docs[0];
          targetPartitionRef = firstPartition.ref;
          targetPartitionData = firstPartition.data();
        }
        
        if (!targetPartitionData[entityTypePlural]) {
          targetPartitionData[entityTypePlural] = {};
        }
        targetPartitionData[entityTypePlural][op.entityId] = op.data;
        
        transaction.set(targetPartitionRef, targetPartitionData);
      } else {
        // Find and update/delete from existing partition
        for (const partitionDoc of partitionsSnap.docs) {
          const partitionData = partitionDoc.data();
          if (partitionData[entityTypePlural] && partitionData[entityTypePlural][op.entityId]) {
            if (op.type === 'UPDATE') {
              partitionData[entityTypePlural][op.entityId] = {
                ...partitionData[entityTypePlural][op.entityId],
                ...op.data
              };
            } else if (op.type === 'DELETE') {
              delete partitionData[entityTypePlural][op.entityId];
            }
            
            transaction.set(partitionDoc.ref, partitionData);
            return;
          }
        }
        
        // Entity not found
        if (op.type === 'UPDATE' || op.type === 'DELETE') {
          throw new Error(`Entity ${op.entityType}:${op.entityId} not found`);
        }
      }
    }
  }

  // ============================================================================
  // Error Handling and Retry Logic
  // ============================================================================

  /**
   * Executes an operation with retry logic
   * @param {Function} operation - Async operation to execute
   * @param {number} [maxRetries=DEFAULT_MAX_RETRIES] - Maximum retry attempts
   * @returns {Promise<any>}
   */
  async executeWithRetry(operation, maxRetries = DEFAULT_MAX_RETRIES) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const errorCode = this.mapFirebaseErrorCode(error);
        
        if (!isRetryableError(errorCode) || attempt === maxRetries - 1) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * BASE_RETRY_DELAY;
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Maps Firebase error codes to our ErrorCodes
   * @param {Error} error - Firebase error
   * @returns {string} ErrorCode
   */
  mapFirebaseErrorCode(error) {
    const code = error.code || '';
    
    if (code.includes('not-found')) {
      return ErrorCodes.ENTITY_NOT_FOUND;
    }
    if (code.includes('already-exists')) {
      return ErrorCodes.ENTITY_ALREADY_EXISTS;
    }
    if (code.includes('permission-denied')) {
      return ErrorCodes.PERMISSION_DENIED;
    }
    if (code.includes('aborted') || code.includes('failed-precondition')) {
      return ErrorCodes.CONCURRENT_MODIFICATION;
    }
    if (code.includes('resource-exhausted')) {
      return ErrorCodes.QUOTA_EXCEEDED;
    }
    if (code.includes('unavailable') || code.includes('deadline-exceeded')) {
      return ErrorCodes.NETWORK_ERROR;
    }
    
    return ErrorCodes.UNKNOWN_ERROR;
  }

  /**
   * Delays execution for a specified time
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Gets the collection name for an entity type
   * @param {string} entityType - Entity type (station, line, etc.)
   * @returns {string} Collection name
   */
  getCollectionName(entityType) {
    const mapping = {
      station: 'stations',
      line: 'lines',
      interchange: 'interchanges',
      lineGroup: 'lineGroups'
    };
    return mapping[entityType] || entityType;
  }
}

export default CrudClient;
