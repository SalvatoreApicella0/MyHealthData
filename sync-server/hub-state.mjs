import crypto from 'node:crypto';

export const CURRENT_HUB_SCHEMA_VERSION = 2;

export function createEmptyHubState(hubId = crypto.randomUUID()) {
  return {
    schemaVersion: CURRENT_HUB_SCHEMA_VERSION,
    hubId,
    sequence: 0,
    vaults: {},
    records: {},
    recordChanges: [],
    attachments: {},
    devices: {},
    pairings: {},
    idempotency: {},
    audit: [],
  };
}

/**
 * Normalizes an on-disk state in place and reports whether it should be
 * persisted. Keeping this migration pure and isolated makes schema evolution
 * testable without starting an HTTP server.
 */
export function migrateHubState(state) {
  let changed = false;
  const ensure = (key, value) => {
    if (state[key] === undefined) {
      state[key] = value;
      changed = true;
    }
  };

  ensure('records', {});
  ensure('recordChanges', []);
  if ((state.schemaVersion ?? 1) < CURRENT_HUB_SCHEMA_VERSION) {
    if (state.measurements) {
      state.records.measurements = { ...(state.records.measurements ?? {}), ...state.measurements };
    }
    const migrated = (state.measurementChanges ?? []).map((entry) => ({
      cursor: entry.cursor,
      domain: 'measurements',
      record: entry.record,
    }));
    state.recordChanges = [...state.recordChanges, ...migrated].sort((left, right) => left.cursor - right.cursor);
    delete state.measurements;
    delete state.measurementChanges;
    state.schemaVersion = CURRENT_HUB_SCHEMA_VERSION;
    changed = true;
  }
  ensure('devices', {});
  ensure('pairings', {});
  ensure('idempotency', {});
  ensure('audit', []);
  ensure('attachments', {});
  return changed;
}
