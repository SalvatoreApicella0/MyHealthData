import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAuthorized, readJSON, sendBytes, sendJSON } from './legacy-http.mjs';
import { LegacyStore } from './legacy-store.mjs';

const DEFAULT_PORT = 8090;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_ROOT = '/data';
const SERVICE_VERSION = '0.1';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function packetIsValid(packet) {
  return Boolean(packet)
    && typeof packet === 'object'
    && isNonEmptyString(packet.id)
    && isNonEmptyString(packet.ciphertext);
}

function validHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function packetCursor(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function blobHashFromPath(pathname) {
  const raw = pathname.slice('/v1/blobs/'.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return '';
  }
}

function isMissingFile(error) {
  return error && typeof error === 'object' && error.code === 'ENOENT';
}

/**
 * Creates the legacy bearer-token relay without starting a listener.
 * Keeping construction separate makes the protocol testable and keeps the
 * executable entrypoint small.
 */
export function createLegacyRelayServer({
  dataDirectory = process.env.MHD_SYNC_DATA || DEFAULT_ROOT,
  token = process.env.MHD_SYNC_TOKEN,
} = {}) {
  if (!token) throw new Error('MHD_SYNC_TOKEN is required');

  const store = new LegacyStore(dataDirectory);
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/healthz') {
        return sendJSON(response, 200, { ok: true, service: 'myhealthdata-sync', version: SERVICE_VERSION });
      }
      if (!isAuthorized(request, token)) return sendJSON(response, 401, { error: 'unauthorized' });

      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

      if (request.method === 'POST' && url.pathname === '/v1/devices') {
        const input = await readJSON(request);
        if (!isNonEmptyString(input.publicKey)) return sendJSON(response, 400, { error: 'publicKey is required' });
        const device = {
          id: crypto.randomUUID(),
          publicKey: input.publicKey,
          name: isNonEmptyString(input.name) ? input.name : 'Unnamed device',
          state: 'pending',
          createdAt: new Date().toISOString(),
        };
        return sendJSON(response, 201, (await store.appendMany('devices', [device]))[0]);
      }

      const approveMatch = url.pathname.match(/^\/v1\/devices\/([^/]+)\/approve$/);
      if (request.method === 'POST' && approveMatch) {
        const id = approveMatch[1];
        const devices = await store.updateCollection('devices', (values) => {
          const device = values.find((item) => item.id === id);
          if (!device) return values;
          device.state = 'approved';
          device.approvedAt = new Date().toISOString();
          return values;
        });
        const device = devices.find((item) => item.id === id);
        return device
          ? sendJSON(response, 200, device)
          : sendJSON(response, 404, { error: 'device not found' });
      }

      if (request.method === 'POST' && url.pathname === '/v1/packets/batch') {
        const input = await readJSON(request);
        const packets = Array.isArray(input.packets) ? input.packets : [];
        if (packets.some((packet) => !packetIsValid(packet))) {
          return sendJSON(response, 400, { error: 'packets require id and ciphertext' });
        }
        const receivedAt = new Date().toISOString();
        const accepted = await store.appendMany(
          'packets',
          packets.map((packet) => ({ ...packet, receivedAt })),
        );
        return sendJSON(response, 201, { accepted: accepted.length });
      }

      if (request.method === 'GET' && url.pathname === '/v1/packets') {
        const packets = await store.collection('packets');
        const after = packetCursor(url.searchParams.get('after'));
        return sendJSON(response, 200, { cursor: packets.length, packets: packets.slice(after) });
      }

      if (request.method === 'POST' && url.pathname === '/v1/blobs') {
        const input = await readJSON(request);
        if (!validHash(input.hash) || !isNonEmptyString(input.ciphertext)) {
          return sendJSON(response, 400, { error: 'valid SHA-256 hash and ciphertext are required' });
        }
        await store.putBlob(input.hash, Buffer.from(input.ciphertext, 'base64'));
        return sendJSON(response, 201, { hash: input.hash });
      }

      if (request.method === 'GET' && url.pathname.startsWith('/v1/blobs/')) {
        const hash = blobHashFromPath(url.pathname);
        if (!validHash(hash)) return sendJSON(response, 400, { error: 'invalid hash' });
        try {
          return sendBytes(response, 200, await store.getBlob(hash));
        } catch (error) {
          if (isMissingFile(error)) return sendJSON(response, 404, { error: 'blob not found' });
          throw error;
        }
      }

      if (request.method === 'POST' && url.pathname === '/v1/backups') {
        const input = await readJSON(request);
        if (!isNonEmptyString(input.ciphertext) || !isNonEmptyString(input.checksum)) {
          return sendJSON(response, 400, { error: 'ciphertext and checksum are required' });
        }
        const backup = {
          id: crypto.randomUUID(),
          checksum: input.checksum,
          ciphertext: input.ciphertext,
          createdAt: new Date().toISOString(),
        };
        return sendJSON(response, 201, (await store.appendMany('backups', [backup]))[0]);
      }

      if (request.method === 'GET' && url.pathname === '/v1/backups') {
        return sendJSON(response, 200, await store.collection('backups'));
      }

      if (request.method === 'DELETE' && url.pathname === '/v1/account') {
        await store.reset();
        return sendJSON(response, 200, { deleted: true });
      }

      return sendJSON(response, 404, { error: 'not found' });
    } catch (error) {
      // Never echo parser errors or filesystem paths to callers. A body that
      // exceeds the bounded protocol limit gets the standard HTTP status.
      const status = error?.statusCode === 413 ? 413 : 400;
      const message = status === 413 ? 'payload_too_large' : 'invalid_request';
      return sendJSON(response, status, { error: message });
    }
  });

  server.store = store;
  return server;
}

export async function startLegacyRelayServer({
  port = Number(process.env.PORT || DEFAULT_PORT),
  host = process.env.MHD_SYNC_HOST || DEFAULT_HOST,
  ...options
} = {}) {
  const server = createLegacyRelayServer(options);
  await server.store.open();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  console.log(`MyHealthData sync server listening on http://${host}:${port}`);
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    console.warn('WARNING: the legacy relay is bound beyond loopback. Keep it on a trusted LAN and never expose it through WAN or port forwarding.');
  }
  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  startLegacyRelayServer().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Unable to start the legacy relay');
    process.exitCode = 1;
  });
}
