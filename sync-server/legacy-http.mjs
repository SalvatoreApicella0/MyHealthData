import crypto from 'node:crypto';

export const LEGACY_MAX_BODY_BYTES = 10 * 1024 * 1024;

export function isAuthorized(request, token) {
  const received = Buffer.from(typeof request.headers.authorization === 'string' ? request.headers.authorization : '');
  const expected = Buffer.from(`Bearer ${token}`);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function sendJSON(response, status, value) {
  if (response.headersSent) return;
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  response.end(body);
}

export function sendBytes(response, status, data) {
  if (response.headersSent) return;
  response.writeHead(status, {
    'content-type': 'application/octet-stream',
    'cache-control': 'no-store',
  });
  response.end(data);
}

export async function readJSON(request, maxBytes = LEGACY_MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > maxBytes) {
      const error = new Error('request too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(bytes);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}
