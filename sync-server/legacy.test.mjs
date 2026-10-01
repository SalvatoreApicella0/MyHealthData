import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createLegacyRelayServer } from './server.mjs';

const token = 'legacy-test-token';
let dataDirectory;
let server;
let baseURL;

async function request(pathname, options = {}) {
  return fetch(`${baseURL}${pathname}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

before(async () => {
  dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'mhd-legacy-'));
  server = createLegacyRelayServer({ dataDirectory, token });
  await server.store.open();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dataDirectory, { recursive: true, force: true });
});

describe('legacy opaque-ciphertext relay', () => {
  it('keeps health checks public and protects all data routes', async () => {
    const health = await fetch(`${baseURL}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, service: 'myhealthdata-sync', version: '0.1' });

    const unauthorized = await fetch(`${baseURL}/v1/packets`);
    assert.equal(unauthorized.status, 401);
  });

  it('serializes concurrent packet batches without losing opaque records', async () => {
    const batches = await Promise.all(Array.from({ length: 8 }, (_, batchIndex) => request('/v1/packets/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        packets: Array.from({ length: 4 }, (_, packetIndex) => ({
          id: `packet-${batchIndex}-${packetIndex}`,
          ciphertext: `ciphertext-${batchIndex}-${packetIndex}`,
        })),
      }),
    })));
    assert.ok(batches.every((response) => response.status === 201));

    const response = await request('/v1/packets');
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.cursor, 32);
    assert.equal(payload.packets.length, 32);
  });

  it('stores and serves encrypted blobs without exposing filesystem errors', async () => {
    const hash = 'a'.repeat(64);
    const upload = await request('/v1/blobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hash, ciphertext: Buffer.from('opaque bytes').toString('base64') }),
    });
    assert.equal(upload.status, 201);

    const download = await request(`/v1/blobs/${hash}`);
    assert.equal(download.status, 200);
    assert.equal(await download.text(), 'opaque bytes');

    const missing = await request(`/v1/blobs/${'b'.repeat(64)}`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'blob not found' });
  });

  it('deletes the complete opaque store through the account endpoint', async () => {
    const backup = await request('/v1/backups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checksum: 'checksum', ciphertext: 'backup-ciphertext' }),
    });
    assert.equal(backup.status, 201);
    assert.equal((await (await request('/v1/backups')).json()).length, 1);

    const deleted = await request('/v1/account', { method: 'DELETE' });
    assert.equal(deleted.status, 200);
    assert.deepEqual(await (await request('/v1/backups')).json(), []);
    const blob = await request(`/v1/blobs/${'a'.repeat(64)}`);
    assert.equal(blob.status, 404);
  });
});
