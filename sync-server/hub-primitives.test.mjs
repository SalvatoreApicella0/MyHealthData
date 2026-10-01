import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decrypt,
  decryptBytes,
  encrypt,
  encryptBytes,
  genericRecordID,
  sameRecordPayload,
  storeKey,
  token,
  validMeasurementID,
} from './hub-primitives.mjs';

test('Hub encryption primitives round-trip JSON and attachment bytes', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const parsed = { domain: 'measurements', value: 82.3, note: 'synthetic' };
  const envelope = encrypt(JSON.stringify(parsed), storeKey(key));

  assert.notEqual(envelope, JSON.stringify(parsed));
  assert.deepEqual(decrypt(envelope, storeKey(key)), parsed);

  const bytes = Buffer.from('%PDF-synthetic', 'utf8');
  const encryptedBytes = encryptBytes(bytes, storeKey(key));
  assert.deepEqual(decryptBytes(encryptedBytes, storeKey(key)), bytes);
});

test('record payload comparison ignores server envelope fields and key order', () => {
  const left = { value: 82.3, type: 'weight', revision: 4, updatedAt: 'server-a' };
  const right = { type: 'weight', value: 82.3, revision: 9, updatedAt: 'server-b' };
  assert.equal(sameRecordPayload(left, right), true);
  assert.equal(sameRecordPayload(left, { ...right, value: 82.4 }), false);
});

test('Hub primitive validators keep identifiers bounded', () => {
  assert.match(token(), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(validMeasurementID('measurement_123'), true);
  assert.equal(validMeasurementID('measurement/123'), false);
  assert.equal(genericRecordID('document:abc-123'), true);
  assert.equal(genericRecordID('document/abc-123'), false);
});
