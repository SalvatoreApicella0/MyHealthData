import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HubError, HubStore } from './hub-store.mjs';
import {
  allowRequest,
  clientKey,
  json,
  parseBody,
  pathMatch,
  readBody,
  readRawBody,
  readRawBytes,
  safeDecode,
  signedRequest,
  webSecurityHeaders,
} from './hub-http.mjs';
import { serveWeb } from './hub-static.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const webVersion = '0.1.0';

export async function createHubServer({ dataDirectory = process.env.MHD_HUB_DATA || path.join(directory, '.data'), webDirectory = process.env.MHD_WEB_DIST || path.join(directory, '..', 'dist'), pairingEndpoint = process.env.MHD_HUB_PAIRING_ENDPOINT, surface = 'full', store: existingStore } = {}) {
  if (!['full', 'device'].includes(surface)) throw new Error('invalid Hub surface');
  const store = existingStore || await new HubStore(dataDirectory).open();
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`); const pathname = url.pathname;
      if (request.method === 'GET' && pathname === '/healthz') return json(response, 200, { ok: true, service: 'myhealthdata-hub', ...store.status() });
      if (request.method === 'GET' && pathname === '/api/v1/build') return json(response, 200, { service: 'myhealthdata-web', version: webVersion });
      if (request.method === 'POST' && pathname === '/api/v1/sync/measurements') { const rawBody = await readRawBody(request); const auth = signedRequest(store, request, rawBody); return json(response, 201, await store.pushHubMeasurement(auth.deviceId, auth.deviceToken, auth.signature, auth.payload, request.headers['idempotency-key'], parseBody(rawBody))); }
      if (request.method === 'GET' && pathname === '/api/v1/sync/measurements') { const auth = signedRequest(store, request); return json(response, 200, store.changesForHubDevice(auth.deviceId, auth.deviceToken, auth.signature, auth.payload, Number(url.searchParams.get('since') || 0), Number(url.searchParams.get('limit') || 250), url.searchParams.has('index'))); }
      if (request.method === 'POST' && pathname === '/api/v1/sync/measurements/batch') {
        const rawBody = await readRawBody(request); const auth = signedRequest(store, request, rawBody); const input = parseBody(rawBody);
        const records = Array.isArray(input.records) ? input.records : [];
        if (records.length > 500) throw new HubError(413, 'batch_too_large');
        const results = [];
        store.beginBatch();
        try {
          for (const record of records) {
            try { const pushed = await store.pushHubMeasurement(auth.deviceId, auth.deviceToken, auth.signature, auth.payload, crypto.randomUUID(), record); results.push({ id: record?.id, revision: pushed.record?.revision ?? null, idempotent: pushed.idempotent }); }
            catch (error) { results.push({ id: record?.id, error: error instanceof HubError ? error.code : 'internal_error' }); }
          }
        } finally { await store.endBatch(); }
        return json(response, 201, { records: results });
      }
      const deviceMeasurementDelete = pathMatch(pathname, /^\/api\/v1\/sync\/measurements\/([^/]+)$/);
      if (request.method === 'DELETE' && deviceMeasurementDelete) { const auth = signedRequest(store, request); return json(response, 200, await store.deleteHubMeasurement(auth.deviceId, auth.deviceToken, auth.signature, auth.payload, request.headers['idempotency-key'], safeDecode(deviceMeasurementDelete[0]), url.searchParams.has('baseRevision') ? Number(url.searchParams.get('baseRevision')) : undefined)); }
      // Generic canonical record replication (any snapshot domain, not only measurements).
      const deviceRecord = pathMatch(pathname, /^\/api\/v1\/sync\/records\/([^/]+)$/);
      if (request.method === 'POST' && deviceRecord) { const rawBody = await readRawBody(request); const auth = signedRequest(store, request, rawBody); return json(response, 201, await store.pushHubRecord(safeDecode(deviceRecord[0]), auth.deviceId, auth.deviceToken, auth.signature, auth.payload, request.headers['idempotency-key'], parseBody(rawBody))); }
      if (request.method === 'GET' && deviceRecord) { const auth = signedRequest(store, request); return json(response, 200, store.changesForHubDomain(auth.deviceId, auth.deviceToken, auth.signature, auth.payload, safeDecode(deviceRecord[0]), Number(url.searchParams.get('since') || 0), Number(url.searchParams.get('limit') || 250))); }
      const deviceRecordDelete = pathMatch(pathname, /^\/api\/v1\/sync\/records\/([^/]+)\/([^/]+)$/);
      if (request.method === 'DELETE' && deviceRecordDelete) { const auth = signedRequest(store, request); return json(response, 200, await store.deleteHubRecord(safeDecode(deviceRecordDelete[0]), auth.deviceId, auth.deviceToken, auth.signature, auth.payload, request.headers['idempotency-key'], safeDecode(deviceRecordDelete[1]), url.searchParams.has('baseRevision') ? Number(url.searchParams.get('baseRevision')) : undefined)); }
      const deviceAttachment = pathMatch(pathname, /^\/api\/v1\/sync\/attachments\/([^/]+)$/);
      if (request.method === 'POST' && deviceAttachment) {
        const rawBody = await readRawBytes(request, 16 * 1024 * 1024);
        const auth = signedRequest(store, request, rawBody);
        return json(response, 201, await store.putAttachment(safeDecode(deviceAttachment[0]), rawBody, { name: request.headers['x-mhd-attachment-name'], type: request.headers['content-type'], sha256: request.headers['x-mhd-attachment-sha256'] }, auth.deviceId));
      }
      if (request.method === 'GET' && deviceAttachment) {
        const auth = signedRequest(store, request);
        void auth;
        const attachment = await store.getAttachment(safeDecode(deviceAttachment[0]));
        response.writeHead(200, { 'content-type': attachment.metadata.type, 'content-length': attachment.data.length, 'cache-control': 'no-store', 'content-disposition': `inline; filename="${attachment.metadata.name.replace(/["\\\r\n]/g, '_')}"`, 'x-content-type-options': 'nosniff' });
        return response.end(attachment.data);
      }
      const claimPairing = pathMatch(pathname, /^\/api\/v1\/pairings\/([0-9a-f-]+)\/claim$/);
      if (request.method === 'POST' && claimPairing) {
        if (!allowRequest(`pair-claim:${clientKey(request)}`, 20, 60_000)) return json(response, 429, { error: 'too_many_requests' });
        const input = await readBody(request);
        try { return json(response, 201, await store.claimPairing(claimPairing[0], input.pairingToken, input.name, input.publicKey)); }
        catch (error) { console.error(`PAIRING claim ${claimPairing[0].slice(0, 8)} ${error instanceof HubError ? error.code : 'internal_error'}`); throw error; }
      }      if (surface === 'device') return json(response, 404, { error: 'not_found' });
      if (request.method === 'GET' && pathname === '/api/v1/status') return json(response, 200, { status: 'running', ...store.status() });
      if (request.method === 'GET' && pathname === '/api/v1/measurements') return json(response, 200, { measurements: store.listMeasurements() });
      if (request.method === 'POST' && pathname === '/api/v1/measurements') return json(response, 201, await store.putMeasurement(await readBody(request)));
      const measurementDelete = pathMatch(pathname, /^\/api\/v1\/measurements\/([0-9a-f-]+)$/);
      if (request.method === 'DELETE' && measurementDelete) return json(response, 200, await store.deleteMeasurement(measurementDelete[0], url.searchParams.has('baseRevision') ? Number(url.searchParams.get('baseRevision')) : undefined));
      // Browser administration for any canonical snapshot domain (loopback only).
      const adminRecords = pathMatch(pathname, /^\/api\/v1\/records\/([^/]+)$/);
      if (request.method === 'GET' && adminRecords) {
        const domain = safeDecode(adminRecords[0]);
        // `?since=` returns the revision/tombstone change log; no query returns current state.
        if (url.searchParams.has('since')) return json(response, 200, store.changesForDomain(domain, Number(url.searchParams.get('since') || 0), Number(url.searchParams.get('limit') || 250)));
        return json(response, 200, { records: store.listRecords(domain) });
      }
      if (request.method === 'POST' && adminRecords) return json(response, 201, await store.putRecord(safeDecode(adminRecords[0]), await readBody(request)));
      const adminRecordDelete = pathMatch(pathname, /^\/api\/v1\/records\/([^/]+)\/([^/]+)$/);
      if (request.method === 'DELETE' && adminRecordDelete) return json(response, 200, await store.deleteRecord(safeDecode(adminRecordDelete[0]), safeDecode(adminRecordDelete[1]), url.searchParams.has('baseRevision') ? Number(url.searchParams.get('baseRevision')) : undefined));
      const adminAttachment = pathMatch(pathname, /^\/api\/v1\/attachments\/([^/]+)$/);
      if (request.method === 'POST' && adminAttachment) {
        const rawBody = await readRawBytes(request, 16 * 1024 * 1024);
        return json(response, 201, await store.putAttachment(safeDecode(adminAttachment[0]), rawBody, {
          name: request.headers['x-mhd-attachment-name'],
          type: request.headers['content-type'],
          sha256: request.headers['x-mhd-attachment-sha256'],
        }));
      }
      if (request.method === 'GET' && adminAttachment) {
        const attachment = await store.getAttachment(safeDecode(adminAttachment[0]));
        response.writeHead(200, { 'content-type': attachment.metadata.type, 'content-length': attachment.data.length, 'cache-control': 'no-store', 'content-disposition': `inline; filename="${attachment.metadata.name.replace(/["\\\r\n]/g, '_')}"`, 'x-content-type-options': 'nosniff', ...webSecurityHeaders });
        return response.end(attachment.data);
      }
      if (request.method === 'GET' && pathname === '/api/v1/devices') return json(response, 200, { devices: store.listDevices() });
      if (request.method === 'POST' && pathname === '/api/v1/pairings') {
        if (!allowRequest(`pair-create:${clientKey(request)}`, 30, 60_000)) return json(response, 429, { error: 'too_many_requests' });
        return json(response, 201, await store.createPairing(pairingEndpoint || `${url.protocol}//${url.host}`));
      }
      const revoke = pathMatch(pathname, /^\/api\/v1\/devices\/([0-9a-f-]+)\/revoke$/);
      if (request.method === 'POST' && revoke) return json(response, 200, await store.revokeDevice(revoke[0]));
      if (request.method === 'GET' && pathname === '/v1/version') return json(response, 200, { protocolVersion: '0.1.0', capabilities: ['encrypted_envelopes', 'cursor_sync', 'idempotency', 'tombstones', 'canonical_records'] });
      if (request.method === 'POST' && pathname === '/v1/vaults') return json(response, 201, await store.createVault());
      const enroll = pathMatch(pathname, /^\/v1\/vaults\/([0-9a-f-]+)\/devices$/);
      if (request.method === 'POST' && enroll) { const input = await readBody(request); return json(response, 201, await store.enroll(enroll[0], input.deviceId, input.bootstrapToken)); }
      const envelopes = pathMatch(pathname, /^\/v1\/vaults\/([0-9a-f-]+)\/envelopes$/);
      if (request.method === 'POST' && envelopes) return json(response, 201, await store.uploadEnvelope(envelopes[0], request.headers['x-mhd-device-id'], request.headers['x-mhd-device-token'], request.headers['idempotency-key'], await readBody(request)));
      const changes = pathMatch(pathname, /^\/v1\/vaults\/([0-9a-f-]+)\/changes$/);
      if (request.method === 'GET' && changes) return json(response, 200, store.changes(changes[0], request.headers['x-mhd-device-id'], request.headers['x-mhd-device-token'], Number(url.searchParams.get('cursor') || 0), Number(url.searchParams.get('limit') || 250)));
      if (request.method === 'GET' || request.method === 'HEAD') return await serveWeb(response, webDirectory, pathname);
      return json(response, 404, { error: 'not_found' });
    } catch (error) {
      // Headers may already be sent when a static file read fails: never throw
      // back into the HTTP parser (that would hang the connection).
      if (response.headersSent) { return response.end(); }
      return json(response, error instanceof HubError ? error.status : 500, { error: error instanceof HubError ? error.code : 'internal_error' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8472); const host = process.env.MHD_HUB_HOST || '127.0.0.1';
  const store = await new HubStore(process.env.MHD_HUB_DATA || path.join(directory, '.data')).open();
  const server = await createHubServer({ store });
  server.listen(port, host, () => console.log(`MyHealthData Hub UI listening on http://${host}:${port}`));
  const syncPort = Number(process.env.MHD_HUB_SYNC_PORT || 0);
  if (syncPort) {
    const syncHost = process.env.MHD_HUB_SYNC_HOST || '127.0.0.1';
    const deviceServer = await createHubServer({ store, surface: 'device' });
    deviceServer.listen(syncPort, syncHost, () => {
      console.log(`MyHealthData Hub device sync listening on http://${syncHost}:${syncPort}`);
      if (!['127.0.0.1', 'localhost', '::1'].includes(syncHost)) console.warn('WARNING: the device sync listener is reachable from the local network. Keep it on a trusted LAN and never expose it through WAN, port forwarding or a public reverse proxy (see docs/hub/RELEASE_ACCEPTANCE.md).');
    });
  }
}
