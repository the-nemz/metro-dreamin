/**
 * Granular CRUD API Type Definitions for Metro-Dreamin
 * 
 * This file contains JSDoc type definitions for the granular CRUD API
 * that enables efficient partial updates to metro system data.
 * 
 * @fileoverview Type definitions for granular CRUD operations
 * @see docs/granular-crud-api-design.md for full specification
 */

// ============================================================================
// Core Entity Types
// ============================================================================

/**
 * A station in the metro system
 * @typedef {Object} Station
 * @property {string} id - Unique station identifier
 * @property {number} lat - Latitude coordinate
 * @property {number} lng - Longitude coordinate
 * @property {string} [name] - Station name (optional for waypoints)
 * @property {boolean} [isWaypoint] - Whether this is a waypoint (routing-only, no stop)
 * @property {'at'|'above'|'below'} [grade] - Station grade level relative to ground
 * @property {Object} [info] - Additional station info from geospatial API
 * @property {number} [info.population] - Population density around station
 * @property {number} [info.employment] - Employment density around station
 * @property {number} [info.builtVolume] - Built volume around station
 */

/**
 * A transit line in the metro system
 * @typedef {Object} Line
 * @property {string} id - Unique line identifier
 * @property {string} name - Line display name (e.g., "Red Line")
 * @property {string} color - Hex color code (e.g., '#e6194b')
 * @property {string[]} stationIds - Ordered array of station IDs on this line
 * @property {string} [mode] - Transit mode key from LINE_MODES (e.g., 'RAPID', 'BUS', 'HSR')
 * @property {string} [lineGroupId] - Associated line group ID for organization
 * @property {string[]} [waypointOverrides] - Station IDs treated as waypoints on this line only
 * @property {string} [icon] - Icon shape key (e.g., 'circle', 'diamond', 'heart', 'plus', 'star')
 */

/**
 * A walking connection between physically separate stations
 * @typedef {Object} Interchange
 * @property {string} id - Unique interchange identifier
 * @property {string[]} stationIds - Array of connected station IDs (typically 2)
 */

/**
 * A group for organizing lines by mode or custom grouping
 * @typedef {Object} LineGroup
 * @property {string} id - Unique line group identifier
 * @property {string} label - Display label for the group
 */

/**
 * The complete map data structure
 * @typedef {Object} SystemMap
 * @property {Object<string, Station>} stations - Map of station ID to Station
 * @property {Object<string, Line>} lines - Map of line ID to Line
 * @property {Object<string, Interchange>} interchanges - Map of interchange ID to Interchange
 * @property {Object<string, LineGroup>} lineGroups - Map of lineGroup ID to LineGroup
 * @property {string} [title] - System title
 * @property {string} [caption] - System caption/description
 */

// ============================================================================
// Operation Types
// ============================================================================

/**
 * Type of CRUD operation
 * @typedef {'CREATE'|'UPDATE'|'DELETE'} OperationType
 */

/**
 * Type of entity being operated on
 * @typedef {'station'|'line'|'interchange'|'lineGroup'} EntityType
 */

/**
 * A single entity operation
 * @typedef {Object} EntityOperation
 * @property {OperationType} type - The operation type (CREATE, UPDATE, DELETE)
 * @property {EntityType} entityType - The type of entity being operated on
 * @property {string} entityId - The ID of the entity
 * @property {Station|Line|Interchange|LineGroup|Object} [data] - Entity data (required for CREATE, optional partial for UPDATE)
 * @property {number} [timestamp] - Client timestamp for conflict resolution
 * @property {number} [expectedVersion] - Expected version for optimistic locking
 */

/**
 * Result of a single operation
 * @typedef {Object} OperationResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {string} entityId - The ID of the affected entity
 * @property {EntityType} entityType - The type of entity
 * @property {OperationType} operationType - The operation that was performed
 * @property {string} [error] - Error message if operation failed
 * @property {string} [errorCode] - Error code for programmatic handling
 * @property {number} serverTimestamp - Server timestamp of the operation
 * @property {number} [newVersion] - New version number after update
 */

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Request to execute multiple operations
 * @typedef {Object} BatchRequest
 * @property {string} systemId - The system being modified
 * @property {EntityOperation[]} operations - Array of operations to perform
 * @property {boolean} [atomic=false] - Whether all operations must succeed or fail together
 * @property {BatchMetadataUpdate} [metadata] - Optional metadata updates
 */

/**
 * Metadata updates to include with a batch
 * @typedef {Object} BatchMetadataUpdate
 * @property {string} [title] - New system title
 * @property {string} [caption] - New system caption
 * @property {boolean} [recalculateGeo=false] - Force recalculation of geo metadata
 * @property {boolean} [recalculateKeywords=false] - Force recalculation of keywords
 */

/**
 * Response from a batch operation
 * @typedef {Object} BatchResponse
 * @property {boolean} success - Whether the batch succeeded (all ops if atomic, any if not)
 * @property {OperationResult[]} results - Results for each operation in order
 * @property {number} successCount - Number of successful operations
 * @property {number} failureCount - Number of failed operations
 * @property {number} serverTimestamp - Server timestamp of the batch completion
 * @property {SystemMetadata} [updatedMetadata] - Updated system metadata if recalculated
 */

/**
 * System metadata returned after updates
 * @typedef {Object} SystemMetadata
 * @property {number} lastUpdated - Timestamp of last update
 * @property {number} numStations - Number of non-waypoint stations
 * @property {number} numWaypoints - Number of waypoints
 * @property {number} numLines - Number of lines
 * @property {number} numInterchanges - Number of interchanges
 * @property {number} numLineGroups - Number of line groups
 * @property {number} numModes - Number of distinct transit modes
 * @property {number} [trackLength] - Total track length in miles
 * @property {string} [level] - System level (LOCAL, REGIONAL, LONG, XLONG)
 * @property {Object} [centroid] - Geographic centroid
 * @property {number} centroid.lat - Centroid latitude
 * @property {number} centroid.lng - Centroid longitude
 * @property {string} [geohash] - GeoFire geohash for location queries
 */

// ============================================================================
// Transaction Operations
// ============================================================================

/**
 * Request to execute operations atomically with preconditions
 * @typedef {Object} TransactionRequest
 * @property {string} systemId - The system being modified
 * @property {EntityOperation[]} operations - Operations to perform atomically
 * @property {TransactionPreconditions} [preconditions] - Conditions that must be true
 */

/**
 * Preconditions for a transaction
 * @typedef {Object} TransactionPreconditions
 * @property {string[]} [stationsMustExist] - Station IDs that must exist
 * @property {string[]} [linesMustExist] - Line IDs that must exist
 * @property {string[]} [stationsMustNotExist] - Station IDs that must not exist
 * @property {string[]} [linesMustNotExist] - Line IDs that must not exist
 * @property {Object<string, number>} [entityVersions] - Expected versions for optimistic locking
 */

/**
 * Response from a transaction
 * @typedef {Object} TransactionResponse
 * @property {boolean} success - Whether the transaction succeeded
 * @property {OperationResult[]} results - Results for each operation
 * @property {string} [failureReason] - Human-readable reason for failure
 * @property {string} [failureCode] - Machine-readable failure code
 * @property {string[]} [conflictingEntities] - Entity IDs that caused conflicts
 * @property {string[]} [failedPreconditions] - Which preconditions failed
 * @property {number} serverTimestamp - Server timestamp of the transaction
 */

// ============================================================================
// Change Tracking
// ============================================================================

/**
 * Tracks which entities have changed since last save
 * @typedef {Object} ChangeSet
 * @property {Set<string>} stationIds - IDs of changed stations
 * @property {Set<string>} lineKeys - IDs of changed lines
 * @property {Set<string>} interchangeIds - IDs of changed interchanges
 * @property {Set<string>} lineGroupIds - IDs of changed line groups
 * @property {boolean} metadataChanged - Whether title/caption changed
 * @property {number} lastChangeTimestamp - Timestamp of most recent change
 */

/**
 * Serializable version of ChangeSet for localStorage
 * @typedef {Object} SerializedChangeSet
 * @property {string[]} stationIds - IDs of changed stations
 * @property {string[]} lineKeys - IDs of changed lines
 * @property {string[]} interchangeIds - IDs of changed interchanges
 * @property {string[]} lineGroupIds - IDs of changed line groups
 * @property {boolean} metadataChanged - Whether title/caption changed
 * @property {number} lastChangeTimestamp - Timestamp of most recent change
 */

/**
 * Creates an empty change set
 * @returns {ChangeSet}
 */
export function createEmptyChangeSet() {
  return {
    stationIds: new Set(),
    lineKeys: new Set(),
    interchangeIds: new Set(),
    lineGroupIds: new Set(),
    metadataChanged: false,
    lastChangeTimestamp: 0
  };
}

/**
 * Serializes a ChangeSet for localStorage storage
 * @param {ChangeSet} changeSet
 * @returns {SerializedChangeSet}
 */
export function serializeChangeSet(changeSet) {
  return {
    stationIds: Array.from(changeSet.stationIds),
    lineKeys: Array.from(changeSet.lineKeys),
    interchangeIds: Array.from(changeSet.interchangeIds),
    lineGroupIds: Array.from(changeSet.lineGroupIds),
    metadataChanged: changeSet.metadataChanged,
    lastChangeTimestamp: changeSet.lastChangeTimestamp
  };
}

/**
 * Deserializes a ChangeSet from localStorage
 * @param {SerializedChangeSet} serialized
 * @returns {ChangeSet}
 */
export function deserializeChangeSet(serialized) {
  return {
    stationIds: new Set(serialized.stationIds || []),
    lineKeys: new Set(serialized.lineKeys || []),
    interchangeIds: new Set(serialized.interchangeIds || []),
    lineGroupIds: new Set(serialized.lineGroupIds || []),
    metadataChanged: serialized.metadataChanged || false,
    lastChangeTimestamp: serialized.lastChangeTimestamp || 0
  };
}

/**
 * Merges two change sets
 * @param {ChangeSet} a
 * @param {ChangeSet} b
 * @returns {ChangeSet}
 */
export function mergeChangeSets(a, b) {
  return {
    stationIds: new Set([...a.stationIds, ...b.stationIds]),
    lineKeys: new Set([...a.lineKeys, ...b.lineKeys]),
    interchangeIds: new Set([...a.interchangeIds, ...b.interchangeIds]),
    lineGroupIds: new Set([...a.lineGroupIds, ...b.lineGroupIds]),
    metadataChanged: a.metadataChanged || b.metadataChanged,
    lastChangeTimestamp: Math.max(a.lastChangeTimestamp, b.lastChangeTimestamp)
  };
}

/**
 * Checks if a change set has any changes
 * @param {ChangeSet} changeSet
 * @returns {boolean}
 */
export function hasChanges(changeSet) {
  return changeSet.stationIds.size > 0 ||
         changeSet.lineKeys.size > 0 ||
         changeSet.interchangeIds.size > 0 ||
         changeSet.lineGroupIds.size > 0 ||
         changeSet.metadataChanged;
}

// ============================================================================
// Dependency Analysis
// ============================================================================

/**
 * Result of analyzing operation dependencies
 * @typedef {Object} DependencyAnalysis
 * @property {EntityOperation[]} independentOps - Operations that can execute in parallel
 * @property {EntityOperation[][]} dependentChains - Operations that must execute in sequence
 * @property {EntityOperation[][]} transactionalGroups - Operations that must execute atomically
 * @property {DependencyConflict[]} conflicts - Conflicts that cannot be auto-resolved
 */

/**
 * A conflict between operations
 * @typedef {Object} DependencyConflict
 * @property {string} type - Type of conflict
 * @property {string} description - Human-readable description
 * @property {EntityOperation[]} operations - The conflicting operations
 * @property {string[]} affectedEntityIds - IDs of entities involved
 */

/**
 * Operation classification for scheduling
 * @typedef {'transactional'|'non-transactional'|'parallelizable'} OperationClass
 */

/**
 * Classifies an operation based on its atomicity requirements
 * @param {EntityOperation} operation
 * @param {SystemMap} currentSystem
 * @returns {OperationClass}
 */
export function classifyOperation(operation, currentSystem) {
  const { type, entityType, entityId, data } = operation;
  
  // DELETE operations on referenced entities are transactional
  if (type === 'DELETE') {
    if (entityType === 'station') {
      // Check if station is referenced by any line
      for (const line of Object.values(currentSystem.lines || {})) {
        if (line.stationIds.includes(entityId)) {
          return 'transactional';
        }
      }
      // Check if station is in any interchange
      for (const interchange of Object.values(currentSystem.interchanges || {})) {
        if (interchange.stationIds.includes(entityId)) {
          return 'transactional';
        }
      }
    }
    if (entityType === 'line') {
      // Line deletion may affect lineGroup membership
      const line = currentSystem.lines?.[entityId];
      if (line?.lineGroupId) {
        return 'transactional';
      }
    }
  }
  
  // CREATE interchange requires validation
  if (type === 'CREATE' && entityType === 'interchange') {
    return 'transactional';
  }
  
  // UPDATE line stationIds may affect interlineSegments
  if (type === 'UPDATE' && entityType === 'line' && data?.stationIds) {
    return 'transactional';
  }
  
  // Most other operations are non-transactional
  // Metadata-only updates are parallelizable
  if (type === 'UPDATE') {
    if (entityType === 'station' && data && !('lat' in data) && !('lng' in data)) {
      return 'parallelizable'; // Name/grade only
    }
    if (entityType === 'line' && data && !data.stationIds) {
      return 'parallelizable'; // Color/name/mode only
    }
    if (entityType === 'lineGroup') {
      return 'parallelizable'; // Label only
    }
  }
  
  return 'non-transactional';
}

/**
 * Analyzes a set of operations for dependencies
 * @param {EntityOperation[]} operations
 * @param {SystemMap} currentSystem
 * @returns {DependencyAnalysis}
 */
export function analyzeDependencies(operations, currentSystem) {
  const analysis = {
    independentOps: [],
    dependentChains: [],
    transactionalGroups: [],
    conflicts: []
  };
  
  // Track affected entities
  const stationOps = new Map(); // stationId -> operations
  const lineOps = new Map();    // lineId -> operations
  const interchangeOps = new Map();
  const lineGroupOps = new Map();
  
  // Group operations by entity
  for (const op of operations) {
    const map = {
      station: stationOps,
      line: lineOps,
      interchange: interchangeOps,
      lineGroup: lineGroupOps
    }[op.entityType];
    
    if (!map.has(op.entityId)) {
      map.set(op.entityId, []);
    }
    map.get(op.entityId).push(op);
  }
  
  // Detect conflicts: multiple ops on same entity
  for (const [entityId, ops] of stationOps) {
    if (ops.length > 1) {
      // Check for conflicting operations
      const hasCreate = ops.some(o => o.type === 'CREATE');
      const hasDelete = ops.some(o => o.type === 'DELETE');
      if (hasCreate && hasDelete) {
        analysis.conflicts.push({
          type: 'CREATE_DELETE_CONFLICT',
          description: `Cannot both create and delete station ${entityId}`,
          operations: ops,
          affectedEntityIds: [entityId]
        });
      }
    }
  }
  
  // Similar conflict detection for other entity types...
  
  // Classify remaining operations
  const transactionalOps = [];
  const nonTransactionalOps = [];
  const parallelizableOps = [];
  
  for (const op of operations) {
    // Skip operations involved in conflicts
    const isInConflict = analysis.conflicts.some(c => 
      c.operations.includes(op)
    );
    if (isInConflict) continue;
    
    const classification = classifyOperation(op, currentSystem);
    switch (classification) {
      case 'transactional':
        transactionalOps.push(op);
        break;
      case 'parallelizable':
        parallelizableOps.push(op);
        break;
      default:
        nonTransactionalOps.push(op);
    }
  }
  
  // Group transactional ops that share entities
  if (transactionalOps.length > 0) {
    analysis.transactionalGroups.push(transactionalOps);
  }
  
  // Parallelizable ops are independent
  analysis.independentOps = parallelizableOps;
  
  // Non-transactional ops form dependent chains if they share entities
  // For simplicity, treat them as a single chain
  if (nonTransactionalOps.length > 0) {
    analysis.dependentChains.push(nonTransactionalOps);
  }
  
  return analysis;
}

// ============================================================================
// Operation Builders
// ============================================================================

/**
 * Creates a station create operation
 * @param {Station} station
 * @returns {EntityOperation}
 */
export function createStationOp(station) {
  return {
    type: 'CREATE',
    entityType: 'station',
    entityId: station.id,
    data: station,
    timestamp: Date.now()
  };
}

/**
 * Creates a station update operation
 * @param {string} stationId
 * @param {Partial<Station>} updates
 * @returns {EntityOperation}
 */
export function updateStationOp(stationId, updates) {
  return {
    type: 'UPDATE',
    entityType: 'station',
    entityId: stationId,
    data: updates,
    timestamp: Date.now()
  };
}

/**
 * Creates a station delete operation
 * @param {string} stationId
 * @returns {EntityOperation}
 */
export function deleteStationOp(stationId) {
  return {
    type: 'DELETE',
    entityType: 'station',
    entityId: stationId,
    timestamp: Date.now()
  };
}

/**
 * Creates a line create operation
 * @param {Line} line
 * @returns {EntityOperation}
 */
export function createLineOp(line) {
  return {
    type: 'CREATE',
    entityType: 'line',
    entityId: line.id,
    data: line,
    timestamp: Date.now()
  };
}

/**
 * Creates a line update operation
 * @param {string} lineId
 * @param {Partial<Line>} updates
 * @returns {EntityOperation}
 */
export function updateLineOp(lineId, updates) {
  return {
    type: 'UPDATE',
    entityType: 'line',
    entityId: lineId,
    data: updates,
    timestamp: Date.now()
  };
}

/**
 * Creates a line delete operation
 * @param {string} lineId
 * @returns {EntityOperation}
 */
export function deleteLineOp(lineId) {
  return {
    type: 'DELETE',
    entityType: 'line',
    entityId: lineId,
    timestamp: Date.now()
  };
}

/**
 * Creates an interchange create operation
 * @param {Interchange} interchange
 * @returns {EntityOperation}
 */
export function createInterchangeOp(interchange) {
  return {
    type: 'CREATE',
    entityType: 'interchange',
    entityId: interchange.id,
    data: interchange,
    timestamp: Date.now()
  };
}

/**
 * Creates an interchange update operation
 * @param {string} interchangeId
 * @param {Partial<Interchange>} updates
 * @returns {EntityOperation}
 */
export function updateInterchangeOp(interchangeId, updates) {
  return {
    type: 'UPDATE',
    entityType: 'interchange',
    entityId: interchangeId,
    data: updates,
    timestamp: Date.now()
  };
}

/**
 * Creates an interchange delete operation
 * @param {string} interchangeId
 * @returns {EntityOperation}
 */
export function deleteInterchangeOp(interchangeId) {
  return {
    type: 'DELETE',
    entityType: 'interchange',
    entityId: interchangeId,
    timestamp: Date.now()
  };
}

/**
 * Creates a lineGroup create operation
 * @param {LineGroup} lineGroup
 * @returns {EntityOperation}
 */
export function createLineGroupOp(lineGroup) {
  return {
    type: 'CREATE',
    entityType: 'lineGroup',
    entityId: lineGroup.id,
    data: lineGroup,
    timestamp: Date.now()
  };
}

/**
 * Creates a lineGroup update operation
 * @param {string} lineGroupId
 * @param {Partial<LineGroup>} updates
 * @returns {EntityOperation}
 */
export function updateLineGroupOp(lineGroupId, updates) {
  return {
    type: 'UPDATE',
    entityType: 'lineGroup',
    entityId: lineGroupId,
    data: updates,
    timestamp: Date.now()
  };
}

/**
 * Creates a lineGroup delete operation
 * @param {string} lineGroupId
 * @returns {EntityOperation}
 */
export function deleteLineGroupOp(lineGroupId) {
  return {
    type: 'DELETE',
    entityType: 'lineGroup',
    entityId: lineGroupId,
    timestamp: Date.now()
  };
}

// ============================================================================
// Batch Helpers
// ============================================================================

/**
 * Splits operations into optimal batch sizes
 * @param {EntityOperation[]} operations
 * @param {number} [maxBatchSize=450] - Conservative limit for safety
 * @returns {EntityOperation[][]}
 */
export function splitIntoBatches(operations, maxBatchSize = 450) {
  const batches = [];
  for (let i = 0; i < operations.length; i += maxBatchSize) {
    batches.push(operations.slice(i, i + maxBatchSize));
  }
  return batches;
}

/**
 * Coalesces multiple operations on the same entity into a single operation
 * @param {EntityOperation[]} operations
 * @returns {EntityOperation[]}
 */
export function coalesceOperations(operations) {
  const entityMap = new Map(); // "entityType:entityId" -> final operation
  
  for (const op of operations) {
    const key = `${op.entityType}:${op.entityId}`;
    const existing = entityMap.get(key);
    
    if (!existing) {
      entityMap.set(key, { ...op });
      continue;
    }
    
    // Coalesce based on operation types
    if (op.type === 'DELETE') {
      // DELETE always wins
      entityMap.set(key, { ...op });
    } else if (existing.type === 'DELETE') {
      // Keep DELETE
    } else if (op.type === 'CREATE' && existing.type === 'UPDATE') {
      // CREATE + UPDATE = CREATE with merged data
      entityMap.set(key, {
        ...existing,
        type: 'CREATE',
        data: { ...existing.data, ...op.data },
        timestamp: Math.max(existing.timestamp || 0, op.timestamp || 0)
      });
    } else if (op.type === 'UPDATE' && existing.type === 'CREATE') {
      // UPDATE after CREATE = CREATE with merged data
      entityMap.set(key, {
        ...existing,
        data: { ...existing.data, ...op.data },
        timestamp: Math.max(existing.timestamp || 0, op.timestamp || 0)
      });
    } else if (op.type === 'UPDATE' && existing.type === 'UPDATE') {
      // Multiple UPDATEs = merged UPDATE
      entityMap.set(key, {
        ...existing,
        data: { ...existing.data, ...op.data },
        timestamp: Math.max(existing.timestamp || 0, op.timestamp || 0)
      });
    }
  }
  
  return Array.from(entityMap.values());
}

/**
 * Determines if metadata recalculation is needed based on operations
 * @param {EntityOperation[]} operations
 * @returns {boolean}
 */
export function needsMetadataRecalc(operations) {
  return operations.some(op => {
    // CREATE or DELETE always affects counts
    if (op.type === 'CREATE' || op.type === 'DELETE') {
      return true;
    }
    
    // Station position changes affect centroid/geohash
    if (op.entityType === 'station' && op.data) {
      return 'lat' in op.data || 'lng' in op.data;
    }
    
    // Line stationIds changes affect trackLength
    if (op.entityType === 'line' && op.data?.stationIds) {
      return true;
    }
    
    // Line mode changes affect numModes
    if (op.entityType === 'line' && op.data?.mode) {
      return true;
    }
    
    return false;
  });
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for granular CRUD operations
 * @enum {string}
 */
export const ErrorCodes = {
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  ENTITY_ALREADY_EXISTS: 'ENTITY_ALREADY_EXISTS',
  INVALID_REFERENCE: 'INVALID_REFERENCE',
  PRECONDITION_FAILED: 'PRECONDITION_FAILED',
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
  BATCH_PARTIAL_FAILURE: 'BATCH_PARTIAL_FAILURE',
  TRANSACTION_CONFLICT: 'TRANSACTION_CONFLICT',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Determines if an error is retryable
 * @param {string} errorCode
 * @returns {boolean}
 */
export function isRetryableError(errorCode) {
  return [
    ErrorCodes.CONCURRENT_MODIFICATION,
    ErrorCodes.TRANSACTION_CONFLICT,
    ErrorCodes.NETWORK_ERROR
  ].includes(errorCode);
}
