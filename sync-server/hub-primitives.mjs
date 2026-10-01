import crypto from 'node:crypto';

export const now = () => new Date().toISOString();
export const token = () => crypto.randomBytes(32).toString('base64url');
export const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const validMeasurementID = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
export const encryptedEnvelopeVersion = 'aes-256-gcm-v1';

// Canonical record replication constraints shared by every Hub surface.
export const DOMAIN_PATTERN = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/;
export const genericRecordID = (value) => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,200}$/.test(value);
export const RECORD_ENVELOPE_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'originDeviceId', 'provenance', 'revision', 'deleted', 'baseRevision']);
export const MAX_RECORD_BYTES = 65_536;
export const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;

/** Remove server-owned fields before comparing two client payloads. */
const stripEnvelope = (record) => {
  const payload = {};
  for (const [key, value] of Object.entries(record)) if (!RECORD_ENVELOPE_KEYS.has(key)) payload[key] = value;
  return payload;
};

/** Canonical JSON used for order-independent idempotency comparisons. */
const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
};

export const sameRecordPayload = (left, right) => stableStringify(stripEnvelope(left)) === stableStringify(stripEnvelope(right));

export function storeKey(value) {
  if (!value) return undefined;
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('MHD_HUB_STORE_KEY must be a base64-encoded 256-bit key');
  return key;
}

export function encrypt(value, key) {
  return encryptBytes(Buffer.from(value, 'utf8'), key);
}

export function encryptBytes(value, key) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  return JSON.stringify({
    envelopeVersion: encryptedEnvelopeVersion,
    nonceBase64: nonce.toString('base64'),
    ciphertextBase64: ciphertext.toString('base64'),
    authTagBase64: cipher.getAuthTag().toString('base64'),
  });
}

function decryptEnvelope(value, key) {
  const envelope = JSON.parse(value);
  if (envelope.envelopeVersion !== encryptedEnvelopeVersion || typeof envelope.nonceBase64 !== 'string' || typeof envelope.ciphertextBase64 !== 'string' || typeof envelope.authTagBase64 !== 'string') return envelope;
  if (!key) throw new Error('Hub data is encrypted; set MHD_HUB_STORE_KEY to unlock it');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.nonceBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(envelope.authTagBase64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertextBase64, 'base64')), decipher.final()]);
  } catch { throw new Error('Hub data could not be decrypted with MHD_HUB_STORE_KEY'); }
}

export function decrypt(value, key) {
  const parsed = JSON.parse(value);
  if (parsed.envelopeVersion !== encryptedEnvelopeVersion) return parsed;
  return JSON.parse(decryptEnvelope(value, key).toString('utf8'));
}

export function decryptBytes(value, key) {
  return decryptEnvelope(value, key);
}

export function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
