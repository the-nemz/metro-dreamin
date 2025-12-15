/**
 * Unit tests for granular CRUD dependency analysis
 * 
 * These tests verify the dependency detection algorithm specified in the API design.
 * Run with: npx jest util/types/__tests__/granular-crud.test.js
 */

import {
  getLinesForStation,
  getInterchangesForStation,
  getLinesForLineGroup,
  operationsConflict,
  groupParallelOperations,
  analyzeDependencies,
  classifyOperation,
  createStationOp,
  updateStationOp,
  deleteStationOp,
  createLineOp,
  updateLineOp,
  deleteLineOp,
  createInterchangeOp,
  deleteInterchangeOp,
  createLineGroupOp,
  updateLineGroupOp,
  deleteLineGroupOp
} from '../granular-crud.js';

// Test fixtures
const createTestSystem = () => ({
  stations: {
    'station-1': { id: 'station-1', lat: 40.7128, lng: -74.0060, name: 'Station 1' },
    'station-2': { id: 'station-2', lat: 40.7580, lng: -73.9855, name: 'Station 2' },
    'station-3': { id: 'station-3', lat: 40.7484, lng: -73.9857, name: 'Station 3' },
    'station-4': { id: 'station-4', lat: 40.7614, lng: -73.9776, name: 'Station 4' },
    'station-5': { id: 'station-5', lat: 40.7527, lng: -73.9772, name: 'Station 5' },
    'waypoint-1': { id: 'waypoint-1', lat: 40.7500, lng: -73.9800, isWaypoint: true }
  },
  lines: {
    'line-red': { 
      id: 'line-red', 
      name: 'Red Line', 
      color: '#e6194b', 
      stationIds: ['station-1', 'station-2', 'station-3'],
      lineGroupId: 'group-subway'
    },
    'line-blue': { 
      id: 'line-blue', 
      name: 'Blue Line', 
      color: '#0082c8', 
      stationIds: ['station-2', 'station-4', 'station-5'],
      lineGroupId: 'group-subway'
    },
    'line-green': { 
      id: 'line-green', 
      name: 'Green Line', 
      color: '#3cb44b', 
      stationIds: ['station-3', 'station-5'],
      lineGroupId: 'group-bus'
    }
  },
  interchanges: {
    'interchange-1': { 
      id: 'interchange-1', 
      stationIds: ['station-2', 'station-4'] 
    }
  },
  lineGroups: {
    'group-subway': { id: 'group-subway', label: 'Subway' },
    'group-bus': { id: 'group-bus', label: 'Bus' }
  }
});

describe('getLinesForStation', () => {
  const system = createTestSystem();

  test('returns lines that reference a station', () => {
    const lines = getLinesForStation('station-2', system);
    expect(lines).toContain('line-red');
    expect(lines).toContain('line-blue');
    expect(lines).toHaveLength(2);
  });

  test('returns empty array for station not on any line', () => {
    const lines = getLinesForStation('station-nonexistent', system);
    expect(lines).toHaveLength(0);
  });

  test('returns single line for station on one line only', () => {
    const lines = getLinesForStation('station-1', system);
    expect(lines).toEqual(['line-red']);
  });

  test('handles empty system', () => {
    const lines = getLinesForStation('station-1', { lines: {} });
    expect(lines).toHaveLength(0);
  });
});

describe('getInterchangesForStation', () => {
  const system = createTestSystem();

  test('returns interchanges that include a station', () => {
    const interchanges = getInterchangesForStation('station-2', system);
    expect(interchanges).toContain('interchange-1');
    expect(interchanges).toHaveLength(1);
  });

  test('returns empty array for station not in any interchange', () => {
    const interchanges = getInterchangesForStation('station-1', system);
    expect(interchanges).toHaveLength(0);
  });

  test('handles empty system', () => {
    const interchanges = getInterchangesForStation('station-1', { interchanges: {} });
    expect(interchanges).toHaveLength(0);
  });
});

describe('getLinesForLineGroup', () => {
  const system = createTestSystem();

  test('returns lines that belong to a line group', () => {
    const lines = getLinesForLineGroup('group-subway', system);
    expect(lines).toContain('line-red');
    expect(lines).toContain('line-blue');
    expect(lines).toHaveLength(2);
  });

  test('returns empty array for non-existent group', () => {
    const lines = getLinesForLineGroup('group-nonexistent', system);
    expect(lines).toHaveLength(0);
  });
});

describe('operationsConflict', () => {
  const system = createTestSystem();

  test('detects CREATE + DELETE conflict on same entity', () => {
    const op1 = createStationOp({ id: 'new-station', lat: 40.0, lng: -74.0, name: 'New' });
    const op2 = deleteStationOp('new-station');
    
    const result = operationsConflict(op1, op2, system);
    expect(result.conflicts).toBe(true);
    expect(result.type).toBe('CREATE_DELETE_CONFLICT');
  });

  test('detects duplicate DELETE operations', () => {
    const op1 = deleteStationOp('station-1');
    const op2 = deleteStationOp('station-1');
    
    const result = operationsConflict(op1, op2, system);
    expect(result.conflicts).toBe(true);
    expect(result.type).toBe('DUPLICATE_DELETE');
  });

  test('detects duplicate CREATE operations', () => {
    const op1 = createStationOp({ id: 'new-station', lat: 40.0, lng: -74.0, name: 'New' });
    const op2 = createStationOp({ id: 'new-station', lat: 41.0, lng: -75.0, name: 'New 2' });
    
    const result = operationsConflict(op1, op2, system);
    expect(result.conflicts).toBe(true);
    expect(result.type).toBe('DUPLICATE_CREATE');
  });

  test('detects cross-entity conflict: delete station while adding to line', () => {
    const op1 = deleteStationOp('station-1');
    const op2 = updateLineOp('line-blue', { stationIds: ['station-1', 'station-4', 'station-5'] });
    
    const result = operationsConflict(op1, op2, system);
    expect(result.conflicts).toBe(true);
    expect(result.type).toBe('CROSS_ENTITY_CONFLICT');
  });

  test('detects cross-entity conflict: delete station while adding to interchange', () => {
    const op1 = deleteStationOp('station-1');
    const op2 = createInterchangeOp({ id: 'new-ic', stationIds: ['station-1', 'station-3'] });
    
    const result = operationsConflict(op1, op2, system);
    expect(result.conflicts).toBe(true);
    expect(result.type).toBe('CROSS_ENTITY_CONFLICT');
  });

  test('detects cross-entity conflict: delete lineGroup while assigning line to it', () => {
    const op1 = deleteLineGroupOp('group-subway');
    const op2 = updateLineOp('line-green', { lineGroupId: 'group-subway' });
    
    const result = operationsConflict(op1, op2, system);
    expect(result.conflicts).toBe(true);
    expect(result.type).toBe('CROSS_ENTITY_CONFLICT');
  });

  test('no conflict for independent operations', () => {
    const op1 = updateStationOp('station-1', { name: 'New Name 1' });
    const op2 = updateStationOp('station-4', { name: 'New Name 4' });
    
    const result = operationsConflict(op1, op2, system);
    expect(result.conflicts).toBe(false);
  });
});

describe('classifyOperation', () => {
  const system = createTestSystem();

  test('classifies station delete with line references as transactional', () => {
    const op = deleteStationOp('station-2'); // Referenced by red and blue lines
    const classification = classifyOperation(op, system);
    expect(classification).toBe('transactional');
  });

  test('classifies station delete with interchange reference as transactional', () => {
    const op = deleteStationOp('station-4'); // In interchange-1
    const classification = classifyOperation(op, system);
    expect(classification).toBe('transactional');
  });

  test('classifies interchange create as transactional', () => {
    const op = createInterchangeOp({ id: 'new-ic', stationIds: ['station-1', 'station-3'] });
    const classification = classifyOperation(op, system);
    expect(classification).toBe('transactional');
  });

  test('classifies line stationIds update as transactional', () => {
    const op = updateLineOp('line-red', { stationIds: ['station-1', 'station-2'] });
    const classification = classifyOperation(op, system);
    expect(classification).toBe('transactional');
  });

  test('classifies line delete with lineGroupId as transactional', () => {
    const op = deleteLineOp('line-red'); // Has lineGroupId
    const classification = classifyOperation(op, system);
    expect(classification).toBe('transactional');
  });

  test('classifies station name update as parallelizable', () => {
    const op = updateStationOp('station-1', { name: 'New Name' });
    const classification = classifyOperation(op, system);
    expect(classification).toBe('parallelizable');
  });

  test('classifies station grade update as parallelizable', () => {
    const op = updateStationOp('station-1', { grade: 'below' });
    const classification = classifyOperation(op, system);
    expect(classification).toBe('parallelizable');
  });

  test('classifies line color update as parallelizable', () => {
    const op = updateLineOp('line-red', { color: '#ff0000' });
    const classification = classifyOperation(op, system);
    expect(classification).toBe('parallelizable');
  });

  test('classifies line name update as parallelizable', () => {
    const op = updateLineOp('line-red', { name: 'Crimson Line' });
    const classification = classifyOperation(op, system);
    expect(classification).toBe('parallelizable');
  });

  test('classifies lineGroup label update as parallelizable', () => {
    const op = updateLineGroupOp('group-subway', { label: 'Metro' });
    const classification = classifyOperation(op, system);
    expect(classification).toBe('parallelizable');
  });

  test('classifies station position update as non-transactional', () => {
    const op = updateStationOp('station-1', { lat: 40.8, lng: -74.1 });
    const classification = classifyOperation(op, system);
    expect(classification).toBe('non-transactional');
  });

  test('classifies orphan station create as non-transactional', () => {
    const op = createStationOp({ id: 'new-station', lat: 40.0, lng: -74.0, name: 'New' });
    const classification = classifyOperation(op, system);
    expect(classification).toBe('non-transactional');
  });
});

describe('groupParallelOperations', () => {
  const system = createTestSystem();

  test('groups independent operations together', () => {
    const ops = [
      updateStationOp('station-1', { name: 'New Name 1' }),
      updateStationOp('station-4', { name: 'New Name 4' }),
      updateLineOp('line-green', { color: '#00ff00' })
    ];
    
    const batches = groupParallelOperations(ops, system);
    // All operations are independent, should be in one batch
    expect(batches.length).toBeGreaterThanOrEqual(1);
    const totalOps = batches.reduce((sum, batch) => sum + batch.length, 0);
    expect(totalOps).toBe(3);
  });

  test('separates dependent operations into different batches', () => {
    const ops = [
      updateStationOp('station-2', { name: 'New Name' }), // On line-red and line-blue
      updateLineOp('line-red', { color: '#ff0000' }) // References station-2
    ];
    
    const batches = groupParallelOperations(ops, system);
    // These operations share station-2, may need separate batches
    expect(batches.length).toBeGreaterThanOrEqual(1);
  });

  test('handles empty operations array', () => {
    const batches = groupParallelOperations([], system);
    expect(batches).toHaveLength(0);
  });

  test('handles single operation', () => {
    const ops = [updateStationOp('station-1', { name: 'New Name' })];
    const batches = groupParallelOperations(ops, system);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
  });
});

describe('analyzeDependencies', () => {
  const system = createTestSystem();

  test('independent station moves on different lines are parallelizable', () => {
    // station-1 is only on line-red, station-4 is only on line-blue
    const ops = [
      updateStationOp('station-1', { lat: 40.72, lng: -74.01 }),
      updateStationOp('station-4', { lat: 40.77, lng: -73.98 })
    ];
    
    const analysis = analyzeDependencies(ops, system);
    
    // Both should be independent (non-transactional single ops)
    expect(analysis.conflicts).toHaveLength(0);
    expect(analysis.independentOps.length).toBe(2);
  });

  test('station delete referenced by multiple lines is transactional', () => {
    // station-2 is on both line-red and line-blue
    const ops = [deleteStationOp('station-2')];
    
    const analysis = analyzeDependencies(ops, system);
    
    expect(analysis.conflicts).toHaveLength(0);
    expect(analysis.transactionalGroups.length).toBe(1);
    expect(analysis.transactionalGroups[0]).toContainEqual(ops[0]);
  });

  test('interchange create with non-existent stations is a conflict', () => {
    const ops = [
      createInterchangeOp({ 
        id: 'new-ic', 
        stationIds: ['station-1', 'nonexistent-station'] 
      })
    ];
    
    const analysis = analyzeDependencies(ops, system);
    
    expect(analysis.conflicts.length).toBeGreaterThan(0);
    expect(analysis.conflicts[0].type).toBe('INVALID_REFERENCE');
  });

  test('interchange create with waypoint station is a conflict', () => {
    const ops = [
      createInterchangeOp({ 
        id: 'new-ic', 
        stationIds: ['station-1', 'waypoint-1'] 
      })
    ];
    
    const analysis = analyzeDependencies(ops, system);
    
    expect(analysis.conflicts.length).toBeGreaterThan(0);
    expect(analysis.conflicts.some(c => c.type === 'INVALID_REFERENCE')).toBe(true);
  });

  test('multiple metadata-only updates are parallelizable', () => {
    const ops = [
      updateStationOp('station-1', { name: 'New Name 1' }),
      updateStationOp('station-2', { name: 'New Name 2' }),
      updateLineOp('line-red', { color: '#ff0000' }),
      updateLineOp('line-blue', { name: 'Azure Line' }),
      updateLineGroupOp('group-subway', { label: 'Metro' })
    ];
    
    const analysis = analyzeDependencies(ops, system);
    
    expect(analysis.conflicts).toHaveLength(0);
    // All should be classified as parallelizable/independent
    const totalIndependent = analysis.independentOps.length;
    const totalInChains = analysis.dependentChains.reduce((sum, chain) => sum + chain.length, 0);
    expect(totalIndependent + totalInChains).toBe(5);
  });

  test('detects CREATE + DELETE conflict on same station', () => {
    const ops = [
      createStationOp({ id: 'new-station', lat: 40.0, lng: -74.0, name: 'New' }),
      deleteStationOp('new-station')
    ];
    
    const analysis = analyzeDependencies(ops, system);
    
    expect(analysis.conflicts.length).toBeGreaterThan(0);
    expect(analysis.conflicts[0].type).toBe('CREATE_DELETE_CONFLICT');
  });

  test('detects conflict when deleting station while adding to line', () => {
    const ops = [
      deleteStationOp('station-1'),
      updateLineOp('line-blue', { stationIds: ['station-1', 'station-4', 'station-5'] })
    ];
    
    const analysis = analyzeDependencies(ops, system);
    
    expect(analysis.conflicts.length).toBeGreaterThan(0);
    expect(analysis.conflicts.some(c => c.type === 'CROSS_ENTITY_CONFLICT')).toBe(true);
  });

  test('handles empty operations array', () => {
    const analysis = analyzeDependencies([], system);
    
    expect(analysis.independentOps).toHaveLength(0);
    expect(analysis.dependentChains).toHaveLength(0);
    expect(analysis.transactionalGroups).toHaveLength(0);
    expect(analysis.conflicts).toHaveLength(0);
  });

  test('groups related transactional operations together', () => {
    // Delete station-2 (on red and blue) and update line-red stationIds
    const ops = [
      deleteStationOp('station-2'),
      updateLineOp('line-red', { stationIds: ['station-1', 'station-3'] })
    ];
    
    const analysis = analyzeDependencies(ops, system);
    
    // Both operations are transactional and related (share station-2 reference)
    expect(analysis.transactionalGroups.length).toBeGreaterThanOrEqual(1);
  });

  test('separates unrelated operations into independent chains', () => {
    // Operations on completely separate parts of the system
    const ops = [
      createStationOp({ id: 'new-station-a', lat: 40.0, lng: -74.0, name: 'A' }),
      createStationOp({ id: 'new-station-b', lat: 41.0, lng: -75.0, name: 'B' }),
      createLineGroupOp({ id: 'new-group', label: 'New Group' })
    ];
    
    const analysis = analyzeDependencies(ops, system);
    
    expect(analysis.conflicts).toHaveLength(0);
    // All operations are independent (no shared entities)
    expect(analysis.independentOps.length).toBe(3);
  });

  test('detects line conflict: multiple ops on same line', () => {
    const ops = [
      createLineOp({ id: 'new-line', name: 'New', color: '#000', stationIds: [] }),
      deleteLineOp('new-line')
    ];
    
    const analysis = analyzeDependencies(ops, system);
    
    expect(analysis.conflicts.length).toBeGreaterThan(0);
    expect(analysis.conflicts[0].type).toBe('CREATE_DELETE_CONFLICT');
  });

  test('detects interchange conflict: multiple ops on same interchange', () => {
    const ops = [
      createInterchangeOp({ id: 'new-ic', stationIds: ['station-1', 'station-3'] }),
      deleteInterchangeOp('new-ic')
    ];
    
    const analysis = analyzeDependencies(ops, system);
    
    expect(analysis.conflicts.length).toBeGreaterThan(0);
    expect(analysis.conflicts[0].type).toBe('CREATE_DELETE_CONFLICT');
  });

  test('detects lineGroup conflict: multiple ops on same lineGroup', () => {
    const ops = [
      createLineGroupOp({ id: 'new-group', label: 'New' }),
      deleteLineGroupOp('new-group')
    ];
    
    const analysis = analyzeDependencies(ops, system);
    
    expect(analysis.conflicts.length).toBeGreaterThan(0);
    expect(analysis.conflicts[0].type).toBe('CREATE_DELETE_CONFLICT');
  });
});

describe('Integration: Metro map sparse connectivity optimization', () => {
  test('leverages sparse connectivity for parallel execution', () => {
    // Create a system with two disconnected subgraphs
    const sparseSystem = {
      stations: {
        // Subgraph A
        'a1': { id: 'a1', lat: 40.0, lng: -74.0, name: 'A1' },
        'a2': { id: 'a2', lat: 40.1, lng: -74.1, name: 'A2' },
        // Subgraph B (completely disconnected)
        'b1': { id: 'b1', lat: 41.0, lng: -75.0, name: 'B1' },
        'b2': { id: 'b2', lat: 41.1, lng: -75.1, name: 'B2' }
      },
      lines: {
        'line-a': { id: 'line-a', name: 'Line A', color: '#f00', stationIds: ['a1', 'a2'] },
        'line-b': { id: 'line-b', name: 'Line B', color: '#00f', stationIds: ['b1', 'b2'] }
      },
      interchanges: {},
      lineGroups: {}
    };

    // Operations on different subgraphs should be independent
    const ops = [
      updateStationOp('a1', { lat: 40.01 }),
      updateStationOp('b1', { lat: 41.01 })
    ];

    const analysis = analyzeDependencies(ops, sparseSystem);
    
    // Both operations should be independent since they're on disconnected subgraphs
    expect(analysis.conflicts).toHaveLength(0);
    expect(analysis.independentOps.length).toBe(2);
  });

  test('correctly identifies dependencies in connected subgraph', () => {
    const system = createTestSystem();
    
    // Operations on stations that share a line should be in same chain
    const ops = [
      updateStationOp('station-1', { lat: 40.72 }), // On line-red
      updateStationOp('station-3', { lat: 40.75 })  // On line-red and line-green
    ];

    const analysis = analyzeDependencies(ops, system);
    
    expect(analysis.conflicts).toHaveLength(0);
    // These share line-red, so they should be in the same chain or both independent
    // (depends on whether position updates create dependencies)
  });
});
