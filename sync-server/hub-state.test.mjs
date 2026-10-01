import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmptyHubState, migrateHubState } from './hub-state.mjs';

test('empty Hub state has every current collection initialized', () => {
  const state = createEmptyHubState('hub-test');
  assert.equal(state.hubId, 'hub-test');
  assert.equal(state.schemaVersion, 2);
  assert.deepEqual(state.records, {});
  assert.deepEqual(state.recordChanges, []);
  assert.deepEqual(state.attachments, {});
  assert.deepEqual(state.devices, {});
  assert.deepEqual(state.pairings, {});
  assert.deepEqual(state.idempotency, {});
  assert.deepEqual(state.audit, []);
});

test('schema v1 migration preserves records and cursor order', () => {
  const record = { id: 'measurement_legacy', value: 70.1 };
  const state = {
    schemaVersion: 1,
    sequence: 8,
    measurements: { [record.id]: record },
    measurementChanges: [{ cursor: 8, record }],
  };

  assert.equal(migrateHubState(state), true);
  assert.equal(state.schemaVersion, 2);
  assert.deepEqual(state.records.measurements[record.id], record);
  assert.deepEqual(state.recordChanges, [{ cursor: 8, domain: 'measurements', record }]);
  assert.equal(state.measurements, undefined);
  assert.equal(state.measurementChanges, undefined);
});

test('partial current state is normalized once and then remains stable', () => {
  const state = { schemaVersion: 2, records: {}, recordChanges: [] };
  assert.equal(migrateHubState(state), true);
  assert.equal(migrateHubState(state), false);
  assert.deepEqual(Object.keys(state).sort(), [
    'attachments',
    'audit',
    'devices',
    'idempotency',
    'pairings',
    'recordChanges',
    'records',
    'schemaVersion',
  ]);
});
