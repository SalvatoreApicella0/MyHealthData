import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHubServer } from './hub.mjs';
import { HubStore } from './hub-store.mjs';

let server; let base; let dataDirectory;
const request = async (pathname, options = {}) => {
  const response = await fetch(`${base}${pathname}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  return { status: response.status, body: await response.json() };
};
const deviceIdentity = () => {
  const keys = crypto.generateKeyPairSync('ed25519');
  return { privateKey: keys.privateKey, publicKey: keys.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64') };
};
const signedHeaders = (client, privateKey, method, pathname, idempotency = '', body = '') => {
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyHash = crypto.createHash('sha256').update(body).digest('base64'); const payload = `${method}\n${pathname}\n${timestamp}\n${idempotency}\n${bodyHash}`;
  return { 'x-mhd-device-id': client.deviceId, 'x-mhd-device-token': client.deviceToken, 'x-mhd-timestamp': String(timestamp), 'x-mhd-body-sha256': bodyHash, 'x-mhd-signature': crypto.sign(null, Buffer.from(payload), privateKey).toString('base64'), ...(idempotency ? { 'idempotency-key': idempotency } : {}) };
};
before(async () => { dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'mhd-hub-')); server = await createHubServer({ dataDirectory, webDirectory: dataDirectory }); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise((resolve) => server.close(resolve)); await rm(dataDirectory, { recursive: true, force: true }); });

test('measurement API persists, detects conflicts, and tombstones', async () => {
  const created = await request('/api/v1/measurements', { method: 'POST', body: JSON.stringify({ type: 'weight', value: 82.3, unit: 'kg', measuredAt: '2026-09-07T10:00:00.000Z' }) });
  assert.equal(created.status, 201); assert.equal(created.body.revision, 1);
  const listed = await request('/api/v1/measurements'); assert.equal(listed.body.measurements.length, 1);
  const conflict = await request(`/api/v1/measurements/${created.body.id}?baseRevision=0`, { method: 'DELETE' }); assert.equal(conflict.status, 409);
  const removed = await request(`/api/v1/measurements/${created.body.id}?baseRevision=1`, { method: 'DELETE' }); assert.equal(removed.status, 200);
  assert.equal((await request('/api/v1/measurements')).body.measurements.length, 0);
});

test('build diagnostics expose only the public Web identity', async () => {
  const response = await request('/api/v1/build');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { service: 'myhealthdata-web', version: '0.1.0' });
});

test('legacy iOS encrypted envelope protocol is idempotent and revocable', async () => {
  const vault = await request('/v1/vaults', { method: 'POST' }); const deviceId = crypto.randomUUID();
  const device = await request(`/v1/vaults/${vault.body.vaultId}/devices`, { method: 'POST', body: JSON.stringify({ deviceId, bootstrapToken: vault.body.bootstrapToken }) });
  const headers = { 'x-mhd-device-id': deviceId, 'x-mhd-device-token': device.body.deviceToken, 'idempotency-key': crypto.randomUUID() };
  const envelope = { recordId: crypto.randomUUID(), revision: 1, operation: 'upsert', envelopeVersion: 'aes-gcm-256-v1', nonceBase64: 'a', ciphertextBase64: 'b', authTagBase64: 'c' };
  const first = await request(`/v1/vaults/${vault.body.vaultId}/envelopes`, { method: 'POST', headers, body: JSON.stringify(envelope) });
  const retry = await request(`/v1/vaults/${vault.body.vaultId}/envelopes`, { method: 'POST', headers, body: JSON.stringify(envelope) });
  assert.equal(first.status, 201); assert.equal(retry.body.idempotent, true);
  const changed = await request(`/v1/vaults/${vault.body.vaultId}/changes?cursor=0`, { headers }); assert.equal(changed.body.changes.length, 1);
  await request(`/api/v1/devices/${deviceId}/revoke`, { method: 'POST' });
  assert.equal((await request(`/v1/vaults/${vault.body.vaultId}/changes?cursor=0`, { headers })).status, 401);
});

test('Hub pairing is one-time and revocable', async () => {
  const pairing = await request('/api/v1/pairings', { method: 'POST' }); assert.equal(pairing.status, 201);
  const claimed = await request(`/api/v1/pairings/${pairing.body.pairingId}/claim`, { method: 'POST', body: JSON.stringify({ pairingToken: pairing.body.pairingToken, name: 'Synthetic iPhone', publicKey: 'a'.repeat(32) }) });
  assert.equal(claimed.status, 201);
  assert.equal((await request(`/api/v1/pairings/${pairing.body.pairingId}/claim`, { method: 'POST', body: JSON.stringify({ pairingToken: pairing.body.pairingToken, name: 'Duplicate', publicKey: 'a'.repeat(32) }) })).status, 401);
  assert.equal((await request(`/api/v1/devices/${claimed.body.deviceId}/revoke`, { method: 'POST' })).body.state, 'revoked');
});

test('paired client sync is incremental, idempotent, and includes tombstones', async () => {
  const pairing = await request('/api/v1/pairings', { method: 'POST' });
  const identity = deviceIdentity();
  const client = await request(`/api/v1/pairings/${pairing.body.pairingId}/claim`, { method: 'POST', body: JSON.stringify({ pairingToken: pairing.body.pairingToken, name: 'Synthetic iPhone', publicKey: identity.publicKey }) });
  const input = { id: `measurement_${crypto.randomUUID()}`, type: 'weight', value: 81.2, unit: 'kg', measuredAt: '2026-09-07T12:00:00.000Z' };
  const inputBody = JSON.stringify(input); const headers = signedHeaders(client.body, identity.privateKey, 'POST', '/api/v1/sync/measurements', crypto.randomUUID(), inputBody);
  const pushed = await request('/api/v1/sync/measurements', { method: 'POST', headers, body: inputBody });
  assert.equal(pushed.status, 201); const initialPath = '/api/v1/sync/measurements'; const initial = await request(initialPath, { headers: signedHeaders(client.body, identity.privateKey, 'GET', initialPath) }); assert.ok(initial.body.changes.some((change) => change.record.id === pushed.body.record.id));
  assert.equal((await request('/api/v1/sync/measurements', { method: 'POST', headers, body: JSON.stringify(input) })).body.idempotent, true);
  const updatedBody = JSON.stringify({ ...input, value: 80.9, baseRevision: 1 }); const updateHeaders = signedHeaders(client.body, identity.privateKey, 'POST', '/api/v1/sync/measurements', crypto.randomUUID(), updatedBody);
  const updated = await request('/api/v1/sync/measurements', { method: 'POST', headers: updateHeaders, body: updatedBody });
  assert.equal(updated.body.record.revision, 2);
  const staleBody = JSON.stringify({ ...input, value: 80.8, baseRevision: 1 }); const staleHeaders = signedHeaders(client.body, identity.privateKey, 'POST', '/api/v1/sync/measurements', crypto.randomUUID(), staleBody);
  assert.equal((await request('/api/v1/sync/measurements', { method: 'POST', headers: staleHeaders, body: staleBody })).status, 409);
  assert.equal((await request('/api/v1/sync/measurements', { method: 'POST', headers, body: JSON.stringify({ ...input, value: 1 }) })).status, 401);
  const cursor = initial.body.nextCursor;
  const deletePath = `/api/v1/sync/measurements/${input.id}?baseRevision=2`; const deleteHeaders = signedHeaders(client.body, identity.privateKey, 'DELETE', deletePath, crypto.randomUUID());
  assert.equal((await request(deletePath, { method: 'DELETE', headers: deleteHeaders })).status, 200);
  const afterPath = `/api/v1/sync/measurements?since=${cursor}`; const after = await request(afterPath, { headers: signedHeaders(client.body, identity.privateKey, 'GET', afterPath) }); assert.ok(after.body.changes.some((change) => change.record.deleted));
  assert.equal((await request('/api/v1/sync/measurements', { headers: { 'x-mhd-device-id': client.body.deviceId, 'x-mhd-device-token': client.body.deviceToken } })).status, 401);
});

test('signed attachment upload is hash-checked and downloadable by Web and device', async () => {
  const pairing = await request('/api/v1/pairings', { method: 'POST' });
  const identity = deviceIdentity();
  const client = await request(`/api/v1/pairings/${pairing.body.pairingId}/claim`, { method: 'POST', body: JSON.stringify({ pairingToken: pairing.body.pairingToken, name: 'Attachment iPhone', publicKey: identity.publicKey }) });
  const bytes = Buffer.from('%PDF-test-bytes', 'utf8');
  const pathName = '/api/v1/sync/attachments/attachment-test';
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const uploadHeaders = { ...signedHeaders(client.body, identity.privateKey, 'POST', pathName, crypto.randomUUID(), bytes), 'content-type': 'application/pdf', 'x-mhd-attachment-name': 'referto.pdf', 'x-mhd-attachment-sha256': hash };
  const uploaded = await fetch(`${base}${pathName}`, { method: 'POST', headers: uploadHeaders, body: bytes });
  assert.equal(uploaded.status, 201);
  assert.equal((await uploaded.json()).sha256, hash);

  const web = await fetch(`${base}/api/v1/attachments/attachment-test`);
  assert.equal(web.status, 200);
  assert.deepEqual(Buffer.from(await web.arrayBuffer()), bytes);

  const device = await fetch(`${base}${pathName}`, { headers: signedHeaders(client.body, identity.privateKey, 'GET', pathName) });
  assert.equal(device.status, 200);
  assert.deepEqual(Buffer.from(await device.arrayBuffer()), bytes);
});

test('browser attachment upload is downloadable and preserves metadata', async () => {
  const bytes = Buffer.from('%PDF-web-created', 'utf8');
  const attachmentId = 'attachment-web-created';
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const uploaded = await fetch(`${base}/api/v1/attachments/${attachmentId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/pdf',
      'x-mhd-attachment-name': 'referto-web.pdf',
      'x-mhd-attachment-sha256': hash,
    },
    body: bytes,
  });
  assert.equal(uploaded.status, 201);
  const metadata = await uploaded.json();
  assert.deepEqual({ id: metadata.id, name: metadata.name, type: metadata.type, sha256: metadata.sha256 }, {
    id: attachmentId,
    name: 'referto-web.pdf',
    type: 'application/pdf',
    sha256: hash,
  });
  const downloaded = await fetch(`${base}/api/v1/attachments/${attachmentId}`);
  assert.equal(downloaded.status, 200);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
});

test('device listener exposes pairing claim and sync, not browser administration', async () => {
  const pairing = await request('/api/v1/pairings', { method: 'POST' });
  const deviceServer = await createHubServer({ dataDirectory, webDirectory: dataDirectory, surface: 'device' });
  await new Promise((resolve) => deviceServer.listen(0, '127.0.0.1', resolve));
  const deviceBase = `http://127.0.0.1:${deviceServer.address().port}`;
  const deviceRequest = async (pathname, options = {}) => {
    const response = await fetch(`${deviceBase}${pathname}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await deviceRequest('/api/v1/devices')).status, 404);
    assert.equal((await deviceRequest('/api/v1/measurements')).status, 404);
    const identity = deviceIdentity();
    const client = await deviceRequest(`/api/v1/pairings/${pairing.body.pairingId}/claim`, { method: 'POST', body: JSON.stringify({ pairingToken: pairing.body.pairingToken, name: 'LAN iPhone', publicKey: identity.publicKey }) });
    assert.equal(client.status, 201);
    const body = JSON.stringify({ id: `measurement_${crypto.randomUUID()}`, type: 'weight', value: 80, unit: 'kg', measuredAt: '2026-09-07T13:00:00.000Z' }); const headers = signedHeaders(client.body, identity.privateKey, 'POST', '/api/v1/sync/measurements', crypto.randomUUID(), body);
    assert.equal((await deviceRequest('/api/v1/sync/measurements', { method: 'POST', headers, body })).status, 201);
  } finally { await new Promise((resolve) => deviceServer.close(resolve)); }
});

test('encrypted Hub storage never persists health values in plaintext', async () => {
  const encryptedDirectory = await mkdtemp(path.join(os.tmpdir(), 'mhd-hub-encrypted-'));
  const encryptionKey = crypto.randomBytes(32).toString('base64');
  try {
    const store = await new HubStore(encryptedDirectory, { encryptionKey, requireEncryption: true }).open();
    await store.putMeasurement({ id: 'measurement_encrypted', type: 'weight', value: 67.4, unit: 'kg', measuredAt: '2026-09-07T14:00:00.000Z', note: 'private-health-note' });
    const onDisk = await readFile(path.join(encryptedDirectory, 'hub-state.json'), 'utf8');
    assert.ok(onDisk.includes('aes-256-gcm-v1'));
    assert.ok(!onDisk.includes('private-health-note'));
    assert.ok(!onDisk.includes('67.4'));
    assert.equal((await new HubStore(encryptedDirectory, { encryptionKey, requireEncryption: true }).open()).listMeasurements()[0].value, 67.4);
    const attachmentBytes = Buffer.from('%PDF-private-attachment', 'utf8');
    const attachment = await store.putAttachment('attachment_encrypted', attachmentBytes, { name: 'referto.pdf', type: 'application/pdf' });
    const attachmentOnDisk = await readFile(path.join(encryptedDirectory, 'attachments', 'attachment_encrypted.bin'), 'utf8');
    assert.equal(attachment.encrypted, true);
    assert.ok(attachmentOnDisk.includes('aes-256-gcm-v1'));
    assert.ok(!attachmentOnDisk.includes('%PDF-private-attachment'));
    const restoredAttachment = await (await new HubStore(encryptedDirectory, { encryptionKey, requireEncryption: true }).open()).getAttachment('attachment_encrypted');
    assert.deepEqual(restoredAttachment.data, attachmentBytes);
  } finally { await rm(encryptedDirectory, { recursive: true, force: true }); }
});

test('static file handler never escapes the web root and always answers', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'mhd-web-'));
  const webRoot = path.join(workspace, 'dist');
  const secret = path.join(workspace, 'secret.txt');
  await mkdir(webRoot, { recursive: true });
  await writeFile(path.join(webRoot, 'index.html'), '<!doctype html><title>shell</title>', 'utf8');
  await writeFile(secret, 'do-not-serve-this', 'utf8');

  const webServer = await createHubServer({ dataDirectory: path.join(workspace, 'data'), webDirectory: webRoot });
  await new Promise((resolve) => webServer.listen(0, '127.0.0.1', resolve));
  const webBase = `http://127.0.0.1:${webServer.address().port}`;

  try {
    const shell = await fetch(`${webBase}/modules/cycle`, { signal: AbortSignal.timeout(5000) });
    assert.equal(shell.status, 200);
    assert.ok((await shell.text()).includes('shell'), 'unknown routes fall back to the SPA shell');

    const policy = shell.headers.get('content-security-policy') ?? '';
    assert.ok(policy.includes("script-src 'self'"));
    assert.ok(!policy.includes("'unsafe-eval'"));
    assert.equal(shell.headers.get('x-frame-options'), 'DENY');
    assert.equal(shell.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(shell.headers.get('cross-origin-resource-policy'), 'same-origin');
    assert.equal(shell.headers.get('x-content-type-options'), 'nosniff');

    for (const pathname of ['/../secret.txt', '/%2e%2e%2fsecret.txt', '/.%2e/secret.txt', '/%00/index.html']) {
      const response = await fetch(`${webBase}${pathname}`, { signal: AbortSignal.timeout(5000) });
      const body = await response.text();
      assert.ok(!body.includes('do-not-serve-this'), `${pathname} must not leak files outside the web root`);
    }
  } finally {
    await new Promise((resolve) => webServer.close(resolve));
    await rm(workspace, { recursive: true, force: true });
  }
});

test('a deployment without a built Web bundle answers 404 instead of hanging', async () => {
  const empty = await mkdtemp(path.join(os.tmpdir(), 'mhd-empty-'));
  const emptyServer = await createHubServer({ dataDirectory: path.join(empty, 'data'), webDirectory: path.join(empty, 'missing-dist') });
  await new Promise((resolve) => emptyServer.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${emptyServer.address().port}/`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'web_bundle_not_found');
  } finally {
    await new Promise((resolve) => emptyServer.close(resolve));
    await rm(empty, { recursive: true, force: true });
  }
});

test('canonical domain sync replicates revisions, conflicts and tombstones', async () => {
  const pairing = await request('/api/v1/pairings', { method: 'POST' });
  const identity = deviceIdentity();
  const client = await request(`/api/v1/pairings/${pairing.body.pairingId}/claim`, { method: 'POST', body: JSON.stringify({ pairingToken: pairing.body.pairingToken, name: 'Synthetic iPhone', publicKey: identity.publicKey }) });
  const path = '/api/v1/sync/records/appointments';
  const input = { id: `appointment_${crypto.randomUUID()}`, title: 'Visita oculistica', scheduledAt: '2026-10-02T08:30:00.000Z', status: 'planned' };
  const body = JSON.stringify(input);
  const headers = signedHeaders(client.body, identity.privateKey, 'POST', path, crypto.randomUUID(), body);
  const pushed = await request(path, { method: 'POST', headers, body });
  assert.equal(pushed.status, 201);
  assert.equal(pushed.body.record.revision, 1);
  assert.equal(pushed.body.record.title, 'Visita oculistica');
  assert.equal(pushed.body.record.originDeviceId, client.body.deviceId);
  assert.equal((await request(path, { method: 'POST', headers, body })).body.idempotent, true);

  const updateBody = JSON.stringify({ ...input, status: 'confirmed', baseRevision: 1 });
  const updated = await request(path, { method: 'POST', headers: signedHeaders(client.body, identity.privateKey, 'POST', path, crypto.randomUUID(), updateBody), body: updateBody });
  assert.equal(updated.body.record.revision, 2);

  const staleBody = JSON.stringify({ ...input, status: 'cancelled', baseRevision: 1 });
  assert.equal((await request(path, { method: 'POST', headers: signedHeaders(client.body, identity.privateKey, 'POST', path, crypto.randomUUID(), staleBody), body: staleBody })).status, 409);

  const changesPath = `${path}?since=0`;
  const changes = await request(changesPath, { headers: signedHeaders(client.body, identity.privateKey, 'GET', changesPath) });
  assert.ok(changes.body.changes.some((change) => change.record.id === input.id && change.record.status === 'confirmed'));

  const deletePath = `${path}/${input.id}?baseRevision=2`;
  const deleted = await request(deletePath, { method: 'DELETE', headers: signedHeaders(client.body, identity.privateKey, 'DELETE', deletePath, crypto.randomUUID()) });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.record.deleted, true);

  const afterPath = `${path}?since=${changes.body.nextCursor}`;
  const after = await request(afterPath, { headers: signedHeaders(client.body, identity.privateKey, 'GET', afterPath) });
  assert.ok(after.body.changes.some((change) => change.record.id === input.id && change.record.deleted));
});

test('browser record API replicates any canonical domain with validation', async () => {
  const created = await request('/api/v1/records/labResults', { method: 'POST', body: JSON.stringify({ id: 'lab_admin_1', analyte: 'Emoglobina', value: 13.7, unit: 'g/dL', collectedAt: '2026-09-01T07:00:00.000Z' }) });
  assert.equal(created.status, 201);
  assert.equal(created.body.revision, 1);
  const listed = await request('/api/v1/records/labResults');
  assert.ok(listed.body.records.some((record) => record.id === 'lab_admin_1'));
  assert.equal((await request('/api/v1/records/1bad', { method: 'POST', body: JSON.stringify({ id: 'x' }) })).status, 400);
  assert.equal((await request('/api/v1/records/labResults', { method: 'POST', body: JSON.stringify({ id: 'has space' }) })).status, 400);
  const removed = await request('/api/v1/records/labResults/lab_admin_1?baseRevision=1', { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.ok(!(await request('/api/v1/records/labResults')).body.records.some((record) => record.id === 'lab_admin_1'));
});

test('schema v1 stores migrate measurements into the generic record graph', async () => {
  const legacy = await mkdtemp(path.join(os.tmpdir(), 'mhd-legacy-'));
  try {
    const record = { id: 'measurement_legacy', type: 'weight', value: 70.1, unit: 'kg', measuredAt: '2026-09-01T08:00:00.000Z', createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z', originDeviceId: 'web', provenance: 'web', revision: 1, deleted: false };
    await writeFile(path.join(legacy, 'hub-state.json'), JSON.stringify({ schemaVersion: 1, hubId: 'legacy-hub', sequence: 1, vaults: {}, measurements: { [record.id]: record }, measurementChanges: [{ cursor: 1, record }], devices: {}, pairings: {}, idempotency: {}, audit: [] }), 'utf8');
    const store = await new HubStore(legacy).open();
    assert.equal(store.listMeasurements()[0].value, 70.1);
    assert.equal(store.changesForDomain('measurements', 0).changes.length, 1);
    const onDisk = JSON.parse(await readFile(path.join(legacy, 'hub-state.json'), 'utf8'));
    assert.equal(onDisk.schemaVersion, 2);
    assert.equal(onDisk.measurements, undefined);
    assert.equal(onDisk.records.measurements.measurement_legacy.value, 70.1);
  } finally { await rm(legacy, { recursive: true, force: true }); }
});

// Keep this last: it intentionally exhausts the pairing-creation token bucket.
test('signed request body survives multibyte characters split across TCP chunks', async () => {
  const pairing = await request('/api/v1/pairings', { method: 'POST' });
  const identity = deviceIdentity();
  const client = await request(`/api/v1/pairings/${pairing.body.pairingId}/claim`, { method: 'POST', body: JSON.stringify({ pairingToken: pairing.body.pairingToken, name: 'Chunked iPhone', publicKey: identity.publicKey }) });
  const bodyBuffer = Buffer.from(JSON.stringify({ id: 'appointment_chunked', title: 'Attività perché è così', scheduledAt: '2026-10-02T08:30:00.000Z' }), 'utf8');
  const split = bodyBuffer.indexOf(Buffer.from('à')) + 1;
  const method = 'POST'; const pathname = '/api/v1/sync/records/appointments'; const idempotency = crypto.randomUUID(); const timestamp = Math.floor(Date.now() / 1000);
  const bodyHash = crypto.createHash('sha256').update(bodyBuffer).digest('base64');
  const payload = `${method}\n${pathname}\n${timestamp}\n${idempotency}\n${bodyHash}`;
  const signature = crypto.sign(null, Buffer.from(payload), identity.privateKey).toString('base64');
  const head = [
    `POST ${pathname} HTTP/1.1`, `Host: ${new URL(base).host}`, 'content-type: application/json', 'transfer-encoding: chunked',
    `x-mhd-device-id: ${client.body.deviceId}`, `x-mhd-device-token: ${client.body.deviceToken}`, `x-mhd-timestamp: ${timestamp}`,
    `x-mhd-body-sha256: ${bodyHash}`, `x-mhd-signature: ${signature}`, `idempotency-key: ${idempotency}`, 'connection: close', '', ''
  ].join('\r\n');
  const response = await new Promise((resolve, reject) => {
    const socket = net.connect(Number(new URL(base).port), '127.0.0.1', () => {
      socket.write(head);
      socket.write(`${split.toString(16)}\r\n`); socket.write(bodyBuffer.subarray(0, split)); socket.write('\r\n');
      socket.write(`${(bodyBuffer.length - split).toString(16)}\r\n`); socket.write(bodyBuffer.subarray(split)); socket.write('\r\n');
      socket.write('0\r\n\r\n');
    });
    let data = ''; socket.setEncoding('utf8'); socket.on('data', (chunk) => { data += chunk; }); socket.on('end', () => resolve(data)); socket.on('error', reject);
  });
  assert.match(response, /HTTP\/1\.1 201/);
  assert.ok(!response.includes('invalid_request_body'));
});


test('a re-paired device re-uploading identical records is accepted, diverging content is rejected', async () => {
  const pairingA = await request('/api/v1/pairings', { method: 'POST' });
  const identityA = deviceIdentity();
  const clientA = await request(`/api/v1/pairings/${pairingA.body.pairingId}/claim`, { method: 'POST', body: JSON.stringify({ pairingToken: pairingA.body.pairingToken, name: 'iPhone A', publicKey: identityA.publicKey }) });
  const record = { id: 'appointment_reowned', title: 'Controllo', scheduledAt: '2026-10-02T08:30:00.000Z', status: 'planned' };
  const path = '/api/v1/sync/records/appointments';
  const bodyA = JSON.stringify(record);
  const first = await request(path, { method: 'POST', headers: signedHeaders(clientA.body, identityA.privateKey, 'POST', path, crypto.randomUUID(), bodyA), body: bodyA });
  assert.equal(first.status, 201);

  const pairingB = await request('/api/v1/pairings', { method: 'POST' });
  const identityB = deviceIdentity();
  const clientB = await request(`/api/v1/pairings/${pairingB.body.pairingId}/claim`, { method: 'POST', body: JSON.stringify({ pairingToken: pairingB.body.pairingToken, name: 'iPhone B', publicKey: identityB.publicKey }) });
  const same = await request(path, { method: 'POST', headers: signedHeaders(clientB.body, identityB.privateKey, 'POST', path, crypto.randomUUID(), bodyA), body: bodyA });
  assert.equal(same.status, 201); assert.equal(same.body.idempotent, true);

  const diverging = JSON.stringify({ ...record, status: 'completed' });
  const rejected = await request(path, { method: 'POST', headers: signedHeaders(clientB.body, identityB.privateKey, 'POST', path, crypto.randomUUID(), diverging), body: diverging });
  assert.equal(rejected.status, 403); assert.equal(rejected.body.error, 'record_not_owned');
});


test('measurement batch endpoint pushes a page and reports revisions', async () => {
  const pairing = await request('/api/v1/pairings', { method: 'POST' });
  const identity = deviceIdentity();
  const client = await request(`/api/v1/pairings/${pairing.body.pairingId}/claim`, { method: 'POST', body: JSON.stringify({ pairingToken: pairing.body.pairingToken, name: 'Batch iPhone', publicKey: identity.publicKey }) });
  const path = '/api/v1/sync/measurements/batch';
  const body = JSON.stringify({ records: [ { id: 'batch_1', type: 'weight', value: 70, unit: 'kg', measuredAt: '2026-09-14T06:00:00.000Z' }, { id: 'batch_2', type: 'step_count', value: 1200, unit: 'count', measuredAt: '2026-09-14T06:00:00.000Z' } ] });
  const response = await request(path, { method: 'POST', headers: signedHeaders(client.body, identity.privateKey, 'POST', path, crypto.randomUUID(), body), body });
  assert.equal(response.status, 201); assert.equal(response.body.records.length, 2); assert.ok(response.body.records.every((entry) => entry.revision >= 1));
  const listed = await request('/api/v1/measurements'); assert.ok(listed.body.measurements.some((measurement) => measurement.id === 'batch_1'));
});


test('index pull returns identity and revision without payloads', async () => {
  const pairing = await request('/api/v1/pairings', { method: 'POST' });
  const identity = deviceIdentity();
  const client = await request(`/api/v1/pairings/${pairing.body.pairingId}/claim`, { method: 'POST', body: JSON.stringify({ pairingToken: pairing.body.pairingToken, name: 'Index iPhone', publicKey: identity.publicKey }) });
  const pushPath = '/api/v1/sync/measurements';
  const body = JSON.stringify({ id: 'index_measurement_1', type: 'weight', value: 69.5, unit: 'kg', measuredAt: '2026-09-14T06:00:00.000Z' });
  await request(pushPath, { method: 'POST', headers: signedHeaders(client.body, identity.privateKey, 'POST', pushPath, crypto.randomUUID(), body), body });
  const path = '/api/v1/sync/measurements?since=0&limit=10&index=1';
  const index = await request(path, { headers: signedHeaders(client.body, identity.privateKey, 'GET', path) });
  assert.equal(index.status, 200);
  assert.equal(index.body.changes.at(-1).record.id, 'index_measurement_1');
  assert.ok(index.body.changes.at(-1).record.revision >= 1);
  assert.equal(index.body.changes.at(-1).record.type, undefined);
});

test('pairing endpoints are rate limited', async () => {
  let limited = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await request('/api/v1/pairings', { method: 'POST' });
    if (response.status === 429) {
      limited = true;
      break;
    }
  }
  assert.equal(limited, true, 'pairing creation must eventually return 429');
});
