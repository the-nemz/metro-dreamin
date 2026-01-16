# Granular CRUD API Design for Metro-Dreamin

## Overview

This document specifies the design for a granular CRUD (Create, Read, Update, Delete) API to replace the current full-system save approach in Metro-Dreamin. The current implementation sends the entire geodata JSON to the server on every save operation, which becomes inefficient for large metro maps with thousands of stations and lines.

### Problem Statement

For large metro maps, the current save approach transfers megabytes of data even when only a single station was moved. This results in:
- Unnecessary network bandwidth consumption
- Slower save operations
- Higher Firestore write costs
- Poor user experience during saves

### Goals

1. Enable granular updates to individual entities (stations, lines, interchanges, lineGroups)
2. Support batch operations for efficiency
3. Maintain atomicity for operations that require it
4. Preserve backward compatibility with existing storage structures
5. Integrate seamlessly with existing local storage caching

## Entity Data Structures

### Station

```javascript
/**
 * @typedef {Object} Station
 * @property {string} id - Unique station identifier
 * @property {number} lat - Latitude coordinate
 * @property {number} lng - Longitude coordinate
 * @property {string} [name] - Station name (optional for waypoints)
 * @property {boolean} [isWaypoint] - Whether this is a waypoint (routing-only)
 * @property {'at'|'above'|'below'} [grade] - Station grade level
 * @property {Object} [info] - Additional station info from geospatial API
 */
```

### Line

```javascript
/**
 * @typedef {Object} Line
 * @property {string} id - Unique line identifier
 * @property {string} name - Line display name
 * @property {string} color - Hex color code (e.g., '#e6194b')
 * @property {string[]} stationIds - Ordered array of station IDs on this line
 * @property {string} [mode] - Transit mode key (e.g., 'RAPID', 'BUS', 'HSR')
 * @property {string} [lineGroupId] - Associated line group ID
 * @property {string[]} [waypointOverrides] - Station IDs treated as waypoints on this line
 * @property {string} [icon] - Icon shape key (e.g., 'circle', 'diamond')
 */
```

### Interchange

```javascript
/**
 * @typedef {Object} Interchange
 * @property {string} id - Unique interchange identifier
 * @property {string[]} stationIds - Array of connected station IDs
 */
```

### LineGroup

```javascript
/**
 * @typedef {Object} LineGroup
 * @property {string} id - Unique line group identifier
 * @property {string} label - Display label for the group
 */
```

## API Interface Definitions

### Operation Types

```javascript
/**
 * @typedef {'CREATE'|'UPDATE'|'DELETE'} OperationType
 */

/**
 * @typedef {'station'|'line'|'interchange'|'lineGroup'} EntityType
 */
```

### Single Entity Operations

```javascript
/**
 * @typedef {Object} EntityOperation
 * @property {OperationType} type - The operation type
 * @property {EntityType} entityType - The type of entity being operated on
 * @property {string} entityId - The ID of the entity
 * @property {Object} [data] - The entity data (required for CREATE/UPDATE)
 * @property {number} [timestamp] - Client timestamp for conflict resolution
 */

/**
 * @typedef {Object} OperationResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {string} entityId - The ID of the affected entity
 * @property {EntityType} entityType - The type of entity
 * @property {OperationType} operationType - The operation that was performed
 * @property {string} [error] - Error message if operation failed
 * @property {number} serverTimestamp - Server timestamp of the operation
 */
```

### Batch Operations

```javascript
/**
 * @typedef {Object} BatchRequest
 * @property {string} systemId - The system being modified
 * @property {EntityOperation[]} operations - Array of operations to perform
 * @property {boolean} [atomic] - Whether all operations must succeed or fail together
 * @property {Object} [metadata] - Optional metadata updates (title, caption, etc.)
 */

/**
 * @typedef {Object} BatchResponse
 * @property {boolean} success - Whether the batch succeeded
 * @property {OperationResult[]} results - Results for each operation
 * @property {number} serverTimestamp - Server timestamp of the batch
 * @property {Object} [updatedMetadata] - Updated system metadata if recalculated
 */
```

### Transaction Wrapper

```javascript
/**
 * @typedef {Object} TransactionRequest
 * @property {string} systemId - The system being modified
 * @property {EntityOperation[]} operations - Operations to perform atomically
 * @property {Object} [preconditions] - Conditions that must be true for transaction to proceed
 * @property {string[]} [preconditions.stationsMustExist] - Station IDs that must exist
 * @property {string[]} [preconditions.linesMustExist] - Line IDs that must exist
 * @property {Object} [preconditions.entityVersions] - Expected versions for optimistic locking
 */

/**
 * @typedef {Object} TransactionResponse
 * @property {boolean} success - Whether the transaction succeeded
 * @property {OperationResult[]} results - Results for each operation
 * @property {string} [failureReason] - Reason for failure if unsuccessful
 * @property {string[]} [conflictingEntities] - Entity IDs that caused conflicts
 * @property {number} serverTimestamp - Server timestamp of the transaction
 */
```

## Operation Classification Schema

Operations are classified into three categories based on their atomicity requirements and parallelization potential.

### Transactional Operations (Must Be Atomic)

These operations affect multiple entities or require validation against current state:

| Operation | Reason | Affected Entities |
|-----------|--------|-------------------|
| Delete station referenced by lines | Must remove from all line.stationIds | Station, Lines |
| Delete station in interchange | Must update/delete interchange | Station, Interchange |
| Create interchange | Must validate all stations exist | Interchange, Stations (read) |
| Add station to line at specific position | May affect interlineSegments | Line, Station (read) |
| Delete line | May affect lineGroup membership counts | Line, LineGroup (read) |
| Merge stations | Must update all references | Stations, Lines, Interchanges |

### Non-Transactional Operations (Can Execute Independently)

These operations affect only a single entity and don't require validation:

| Operation | Entity | Notes |
|-----------|--------|-------|
| Update station position | Station | Client handles interlineSegment recalc |
| Update station name | Station | No dependencies |
| Update station grade | Station | No dependencies |
| Update line color | Line | Metadata only |
| Update line name | Line | Metadata only |
| Update line mode | Line | May trigger ridership recalc on client |
| Update line icon | Line | Metadata only |
| Update lineGroup label | LineGroup | No dependencies |
| Create new station (orphan) | Station | Not yet on any line |
| Create new line (empty) | Line | No stations yet |
| Create new lineGroup | LineGroup | No dependencies |

### Parallelizable Operations (Sequence-Independent)

These operations can be executed in any order without affecting correctness:

| Operation Set | Condition |
|---------------|-----------|
| Multiple station position updates | Stations not on same line segment |
| Multiple line metadata updates | Different lines |
| Multiple lineGroup updates | Different lineGroups |
| Station creates + Line creates | No references between them |

## Dependency Graph Specification

### Entity Relationship Model

```
┌─────────────┐     references      ┌─────────────┐
│   Station   │◄────────────────────│    Line     │
│             │     (stationIds)    │             │
└─────────────┘                     └──────┬──────┘
       ▲                                   │
       │ references                        │ references
       │ (stationIds)                      │ (lineGroupId)
       │                                   ▼
┌──────┴──────┐                     ┌─────────────┐
│ Interchange │                     │  LineGroup  │
│             │                     │             │
└─────────────┘                     └─────────────┘
```

### Dependency Detection Algorithm

```javascript
/**
 * Analyzes operations to detect dependencies and conflicts
 * @param {EntityOperation[]} operations - Operations to analyze
 * @param {Object} currentSystem - Current system state
 * @returns {DependencyAnalysis}
 */
function analyzeDependencies(operations, currentSystem) {
  const analysis = {
    independentOps: [],      // Can execute in parallel
    dependentChains: [],     // Must execute in sequence
    transactionalGroups: [], // Must execute atomically
    conflicts: []            // Cannot be resolved automatically
  };
  
  // Build affected entity sets
  const affectedStations = new Set();
  const affectedLines = new Set();
  const affectedInterchanges = new Set();
  const affectedLineGroups = new Set();
  
  for (const op of operations) {
    switch (op.entityType) {
      case 'station':
        affectedStations.add(op.entityId);
        // Check if station is referenced by lines
        for (const [lineId, line] of Object.entries(currentSystem.lines || {})) {
          if (line.stationIds.includes(op.entityId)) {
            affectedLines.add(lineId);
          }
        }
        // Check if station is in interchange
        for (const [icId, ic] of Object.entries(currentSystem.interchanges || {})) {
          if (ic.stationIds.includes(op.entityId)) {
            affectedInterchanges.add(icId);
          }
        }
        break;
      case 'line':
        affectedLines.add(op.entityId);
        if (op.data?.stationIds) {
          op.data.stationIds.forEach(sId => affectedStations.add(sId));
        }
        if (op.data?.lineGroupId) {
          affectedLineGroups.add(op.data.lineGroupId);
        }
        break;
      case 'interchange':
        affectedInterchanges.add(op.entityId);
        if (op.data?.stationIds) {
          op.data.stationIds.forEach(sId => affectedStations.add(sId));
        }
        break;
      case 'lineGroup':
        affectedLineGroups.add(op.entityId);
        break;
    }
  }
  
  // Classify operations based on dependencies
  // ... (implementation details in util/types/granular-crud.js)
  
  return analysis;
}
```

### Conflict Detection Rules

1. **Station Delete Conflict**: Cannot delete a station that is:
   - Referenced by any line's stationIds
   - Part of any interchange's stationIds
   - Unless the operation batch also removes those references

2. **Line Delete Conflict**: Cannot delete a line without considering:
   - Impact on interlineSegments (client-side recalculation)
   - LineGroup membership (may leave empty group)

3. **Interchange Create Conflict**: Cannot create interchange if:
   - Any referenced station doesn't exist
   - Any referenced station is a waypoint

4. **Concurrent Edit Conflict**: Detected when:
   - Two operations modify the same entity
   - Entity version doesn't match expected version (optimistic locking)

## Integration Strategy

### Integration with Existing Saver Class

The new granular API will be implemented as an extension to the existing `Saver` class in `util/saver.js`.

```javascript
// New methods to add to Saver class

class Saver {
  // ... existing methods ...
  
  /**
   * Saves only the changed entities instead of the full system
   * @param {Object} changedEntities - Object with changed entity sets
   * @param {Set<string>} changedEntities.stationIds
   * @param {Set<string>} changedEntities.lineKeys
   * @param {Set<string>} changedEntities.interchangeIds
   * @param {Set<string>} changedEntities.lineGroupIds
   * @returns {Promise<BatchResponse>}
   */
  async saveChangedEntities(changedEntities) {
    // Implementation
  }
  
  /**
   * Executes a batch of operations atomically
   * @param {BatchRequest} batchRequest
   * @returns {Promise<BatchResponse>}
   */
  async executeBatch(batchRequest) {
    // Implementation
  }
  
  /**
   * Executes operations within a transaction
   * @param {TransactionRequest} transactionRequest
   * @returns {Promise<TransactionResponse>}
   */
  async executeTransaction(transactionRequest) {
    // Implementation
  }
}
```

### Integration with Edit Page Save Flow

The edit page (`pages/edit/[systemId].js`) currently tracks changed entities via `system.changing`:

```javascript
// Current tracking (lines 247-252)
updatedSystem.changing = {
  lineKeys: Object.keys(updatedSystem.lines || {}),
  stationIds: Object.keys(updatedSystem.stations || {}),
  interchangeIds: Object.keys(updatedSystem.interchanges || {}),
  segmentKeys: diffSegmentKeys
};
```

The integration will:

1. **Accumulate changes between saves**: Instead of resetting `changing` after each render, accumulate changes until save.

2. **Modify `performSave` function** (lines 492-556):
```javascript
const performSave = async (systemToSave, metaToSave, cb) => {
  // ... existing validation ...
  
  // Check if granular save is possible
  const changedEntities = accumulatedChanges.current;
  const canUseGranularSave = !isNew && 
    changedEntities && 
    Object.values(changedEntities).some(set => set.size > 0);
  
  if (canUseGranularSave) {
    // Use granular save
    const result = await saver.saveChangedEntities(changedEntities);
    if (result.success) {
      // Clear accumulated changes
      accumulatedChanges.current = createEmptyChangeSet();
      // Update metadata if needed
      if (result.updatedMetadata) {
        // Handle metadata updates
      }
    }
  } else {
    // Fall back to full save for new systems or when granular isn't possible
    await saver.save();
  }
  
  // ... rest of existing logic ...
};
```

3. **Add change accumulator ref**:
```javascript
const accumulatedChanges = useRef({
  stationIds: new Set(),
  lineKeys: new Set(),
  interchangeIds: new Set(),
  lineGroupIds: new Set(),
  metadataChanged: false
});
```

### Integration with Local Storage Caching

The `updateLocalEditSystem` function in `util/helpers.js` (lines 1207-1247) will be enhanced to:

1. **Track granular changes locally**:
```javascript
export function updateLocalEditSystem(systemId, system, meta, changedEntities = null) {
  // ... existing logic ...
  
  // Store change tracking for recovery
  if (changedEntities) {
    const changeLog = {
      timestamp: Date.now(),
      changes: {
        stationIds: Array.from(changedEntities.stationIds || []),
        lineKeys: Array.from(changedEntities.lineKeys || []),
        interchangeIds: Array.from(changedEntities.interchangeIds || []),
        lineGroupIds: Array.from(changedEntities.lineGroupIds || [])
      }
    };
    localStorage.setItem(`mdEditChanges-${systemId}`, JSON.stringify(changeLog));
  }
}
```

2. **Support incremental recovery**: On page load, if there are unsaved changes, only the changed entities need to be compared/merged.

### Handling Firestore Batch Limits

While the 500 operation batch limit was removed in March 2023, the implementation will still handle large batches gracefully:

```javascript
/**
 * Splits operations into optimal batch sizes
 * @param {EntityOperation[]} operations
 * @param {number} [maxBatchSize=450] - Conservative limit for safety
 * @returns {EntityOperation[][]}
 */
function splitIntoBatches(operations, maxBatchSize = 450) {
  const batches = [];
  for (let i = 0; i < operations.length; i += maxBatchSize) {
    batches.push(operations.slice(i, i + maxBatchSize));
  }
  return batches;
}
```

### Metadata Update Strategy

System metadata (keywords, geohash, level, centroid, etc.) is currently recalculated on every save. The granular API will:

1. **Defer metadata recalculation** for minor changes (position tweaks, name changes)
2. **Trigger recalculation** when:
   - Stations are added/deleted (affects centroid, geohash)
   - Lines are added/deleted (affects numLines, numModes, trackLength)
   - Significant position changes occur (affects level, avgSpacing)
3. **Batch metadata updates** to reduce Firestore writes

```javascript
/**
 * Determines if metadata recalculation is needed
 * @param {EntityOperation[]} operations
 * @returns {boolean}
 */
function needsMetadataRecalc(operations) {
  return operations.some(op => 
    op.type === 'CREATE' || 
    op.type === 'DELETE' ||
    (op.entityType === 'station' && op.data && ('lat' in op.data || 'lng' in op.data))
  );
}
```

## Storage Structure Compatibility

### PARTITIONED_STRUCTURE

For systems using partitioned storage, granular updates require:

1. **Identify affected partitions**: Map entity IDs to partition IDs
2. **Load only affected partitions**: Minimize reads
3. **Update partition contents**: Modify entities within partition
4. **Rebalance if needed**: If partition grows too large, split it

```javascript
/**
 * Maps entity to its partition
 * @param {string} entityId
 * @param {EntityType} entityType
 * @param {Object} partitionIndex - Index mapping entities to partitions
 * @returns {string} partitionId
 */
function getPartitionForEntity(entityId, entityType, partitionIndex) {
  return partitionIndex[entityType]?.[entityId] || '0';
}
```

### INDIVIDUAL_STRUCTURE

For systems using individual document storage, granular updates are straightforward:

1. Each entity has its own document
2. Updates target specific documents directly
3. No partition management needed

## Error Handling and Recovery

### Retry Strategy

```javascript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2
};

async function executeWithRetry(operation, config = RETRY_CONFIG) {
  let lastError;
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error)) throw error;
      const delay = Math.min(
        config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelayMs
      );
      await sleep(delay);
    }
  }
  throw lastError;
}
```

### Conflict Resolution

When concurrent edits are detected:

1. **Last-write-wins** (default): Most recent timestamp wins
2. **Merge strategy**: For array fields (stationIds), attempt to merge changes
3. **User resolution**: For complex conflicts, prompt user to choose

```javascript
/**
 * @typedef {Object} ConflictResolution
 * @property {'last-write-wins'|'merge'|'user-resolve'} strategy
 * @property {Object} [mergedData] - Result of merge if applicable
 * @property {Object} [serverData] - Current server state
 * @property {Object} [clientData] - Client's attempted update
 */
```

### Rollback Support

For failed transactions:

```javascript
/**
 * @typedef {Object} RollbackInfo
 * @property {string} transactionId
 * @property {EntityOperation[]} appliedOperations
 * @property {Object} previousState - State before transaction
 * @property {number} timestamp
 */
```

## Performance Considerations

### Optimistic Updates

The client applies changes immediately and syncs in background:

1. Apply change to local state
2. Queue operation for server sync
3. On success: clear from queue
4. On failure: revert local state or retry

### Debouncing

Rapid changes are debounced before sending to server:

```javascript
const DEBOUNCE_MS = 2000; // 2 seconds

// Debounce save operations
const debouncedSave = debounce(async (changedEntities) => {
  await saver.saveChangedEntities(changedEntities);
}, DEBOUNCE_MS);
```

### Change Coalescing

Multiple changes to the same entity are coalesced:

```javascript
// Instead of: UPDATE station A, UPDATE station A, UPDATE station A
// Send: UPDATE station A (with final state)
```

## Migration Path

### Phase 1: Add Granular API (Non-Breaking)

1. Implement new `Saver` methods
2. Add change tracking infrastructure
3. Keep existing full-save as fallback

### Phase 2: Enable Granular Saves

1. Enable granular saves for small changes
2. Monitor for issues
3. Gradually increase scope

### Phase 3: Optimize

1. Remove full-save fallback for most cases
2. Optimize metadata recalculation
3. Add real-time sync capabilities

## References

- [Firestore Transactions and Batched Writes](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Firestore Quotas and Limits](https://cloud.google.com/firestore/quotas)
- Current implementation: `util/saver.js`, `pages/edit/[systemId].js`
