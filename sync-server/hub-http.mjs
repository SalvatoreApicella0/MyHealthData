import crypto from 'node:crypto';
import { HubError } from './hub-store.mjs';

export const json = (response, status, value) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  response.end(JSON.stringify(value));
};

export const readRawBytes = async (request, maxBytes = 1_048_576) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new HubError(413, 'request_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export const readRawBody = async (request, maxBytes = 1_048_576) => (await readRawBytes(request, maxBytes)).toString('utf8');
export const parseBody = (content) => {
  try {
    return content ? JSON.parse(content) : {};
  } catch {
    throw new HubError(400, 'malformed_json');
  }
};
export const readBody = async (request) => parseBody(await readRawBody(request));
export const pathMatch = (pathname, expression) => pathname.match(expression)?.slice(1);
export const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HubError(400, 'invalid_identifier_encoding');
  }
};

/**
 * Security headers for the single-page app served by the Hub itself. The
 * nginx deployment sets the same policy; without this the Hub-served build
 * would ship without a CSP.
 */
export const webSecurityHeaders = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src 'self' blob:; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
};

/**
 * Small in-memory token bucket.
 *
 * Unauthenticated endpoints (pairing creation on the loopback UI, pairing claim
 * on the LAN listener) must not be usable as an unbounded work amplifier.
 */
const rateBuckets = new Map();
export const allowRequest = (key, limit, windowMs) => {
  const current = Date.now();
  const bucket = rateBuckets.get(key);
  if (rateBuckets.size > 4096) rateBuckets.clear();
  if (!bucket || current - bucket.startedAt >= windowMs) {
    rateBuckets.set(key, { startedAt: current, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
};
export const clientKey = (request) => request.socket?.remoteAddress || 'unknown';

export const signedRequest = (store, request, body = '') => {
  const deviceId = request.headers['x-mhd-device-id'];
  const deviceToken = request.headers['x-mhd-device-token'];
  const timestamp = Number(request.headers['x-mhd-timestamp']);
  const signature = request.headers['x-mhd-signature'];
  const idempotency = request.headers['idempotency-key'] || '';
  if (!Number.isInteger(timestamp) || Math.abs(Date.now() - timestamp * 1000) > 120_000) {
    console.error(`SIGNED ${request.method} ${request.url} invalid_request_timestamp timestamp=${request.headers['x-mhd-timestamp']}`);
    throw new HubError(401, 'invalid_request_timestamp');
  }

  const bodyHash = request.headers['x-mhd-body-sha256'];
  const actualHash = crypto.createHash('sha256').update(body).digest('base64');
  if (bodyHash !== actualHash) {
    let id = 'unparsed';
    let reencodesToDeclared = 'none';
    let structure = 'unparsed';
    try {
      const parsed = JSON.parse(body);
      id = typeof parsed?.id === 'string' ? parsed.id : 'no-id';
      structure = Object.entries(parsed).map(([key, value]) => `${key}:${Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value}${typeof value === 'string' ? `(${value.length})` : ''}`).join(' ');
      const plain = JSON.stringify(parsed);
      if (crypto.createHash('sha256').update(plain).digest('base64') === bodyHash) reencodesToDeclared = 'plain';
    } catch {
      // Body is not JSON: keep unparsed.
    }
    console.error(`SIGNED ${request.method} ${request.url} invalid_request_body received=${Buffer.byteLength(body)} declaredHash=${String(bodyHash).slice(0, 16)} actualHash=${actualHash.slice(0, 16)} contentLength=${request.headers['content-length'] ?? 'chunked'} socket=${request.socket.remotePort} id=${id} reencodesToDeclared=${reencodesToDeclared} structure=[${structure}]`);
    throw new HubError(401, 'invalid_request_body');
  }

  const payload = `${request.method}\n${request.url}\n${timestamp}\n${idempotency}\n${bodyHash}`;
  try {
    store.requireHubDevice(deviceId, deviceToken, signature, payload);
  } catch (error) {
    console.error(`SIGNED ${request.method} ${request.url} ${error instanceof HubError ? error.code : 'auth_error'} device=${typeof deviceId === 'string' ? deviceId.slice(0, 8) : 'missing'}`);
    throw error;
  }
  return { deviceId, deviceToken, signature, payload };
};
