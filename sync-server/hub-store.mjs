import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DOMAIN_PATTERN,
  MAX_ATTACHMENT_BYTES,
  MAX_RECORD_BYTES,
  RECORD_ENVELOPE_KEYS,
  decrypt,
  decryptBytes,
  genericRecordID,
  hash,
  now,
  sameRecordPayload,
  safeEqual,
  storeKey,
  token,
  validMeasurementID,
  encrypt,
  encryptBytes,
} from './hub-primitives.mjs';
import { createEmptyHubState, migrateHubState } from './hub-state.mjs';

export class HubError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export class HubStore {
  constructor(root, { encryptionKey = process.env.MHD_HUB_STORE_KEY, requireEncryption = process.env.MHD_HUB_REQUIRE_ENCRYPTION === '1' } = {}) {
    this.root = root; this.file = path.join(root, 'hub-state.json'); this.attachmentsRoot = path.join(root, 'attachments'); this.state = undefined; this.writeChain = Promise.resolve(); this.encryptionKey = storeKey(encryptionKey);
    this.batchDepth = 0; this.batchDirty = false;
    if (requireEncryption && !this.encryptionKey) throw new Error('MHD_HUB_STORE_KEY is required when Hub encryption is enabled');
  }

  async open() {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    await fs.mkdir(this.attachmentsRoot, { recursive: true, mode: 0o700 });
    try { this.state = decrypt(await fs.readFile(this.file, 'utf8'), this.encryptionKey); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.state = createEmptyHubState();
      await this.persist();
    }
    if (migrateHubState(this.state)) await this.persist();
    return this;
  }

  /** Coalesces persistence across a multi-record batch. */
  beginBatch() { this.batchDepth += 1; }
  async endBatch() {
    this.batchDepth = Math.max(0, this.batchDepth - 1);
    if (this.batchDepth === 0 && this.batchDirty) await this.persist();
  }

  async persist() {
    if (this.batchDepth > 0) { this.batchDirty = true; return this.writeChain; }
    this.batchDirty = false;
    this.writeChain = this.writeChain.then(async () => {
      const temporary = `${this.file}.${process.pid}.${crypto.randomUUID()}.tmp`;
      const serialized = JSON.stringify(this.state);
      await fs.writeFile(temporary, this.encryptionKey ? encrypt(serialized, this.encryptionKey) : serialized, { mode: 0o600 });
      await fs.rename(temporary, this.file);
    });
    return this.writeChain;
  }

  status() { return { hubId: this.state.hubId, protocolVersion: '1', schemaVersion: this.state.schemaVersion, deviceCount: Object.keys(this.state.devices).length }; }
  audit(actor, action, recordId, success = true) { this.state.audit.push({ at: now(), actor, action, recordId, success }); this.state.audit = this.state.audit.slice(-1000); }

  attachmentPath(id) {
    if (!genericRecordID(id)) throw new HubError(400, 'invalid_attachment_id');
    return path.join(this.attachmentsRoot, `${id}.bin`);
  }

  async putAttachment(id, data, metadata = {}, actor = 'web') {
    const destination = this.attachmentPath(id);
    if (!Buffer.isBuffer(data) || data.length === 0 || data.length > MAX_ATTACHMENT_BYTES) throw new HubError(413, 'attachment_too_large');
    const actualHash = hash(data);
    if (metadata.sha256 && metadata.sha256 !== actualHash) throw new HubError(400, 'attachment_hash_mismatch');
    const temporary = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
    const storedData = this.encryptionKey ? Buffer.from(encryptBytes(data, this.encryptionKey), 'utf8') : data;
    await fs.writeFile(temporary, storedData, { mode: 0o600 });
    await fs.rename(temporary, destination);
    this.state.attachments[id] = { id, size: data.length, sha256: actualHash, encrypted: Boolean(this.encryptionKey), type: typeof metadata.type === 'string' ? metadata.type.slice(0, 160) : 'application/octet-stream', name: typeof metadata.name === 'string' ? metadata.name.slice(0, 240) : id, updatedAt: now(), originDeviceId: actor };
    this.audit(actor, 'attachment.upsert', id);
    await this.persist();
    return this.state.attachments[id];
  }

  async getAttachment(id) {
    const metadata = this.state.attachments[id];
    if (!metadata) throw new HubError(404, 'attachment_not_found');
    try {
      const storedData = await fs.readFile(this.attachmentPath(id));
      const data = metadata.encrypted ? decryptBytes(storedData.toString('utf8'), this.encryptionKey) : storedData;
      return { metadata, data };
    }
    catch (error) { if (error.code === 'ENOENT') throw new HubError(404, 'attachment_not_found'); throw error; }
  }

  async deleteAttachment(id, actor = 'web') {
    const metadata = this.state.attachments[id];
    if (!metadata) throw new HubError(404, 'attachment_not_found');
    await fs.rm(this.attachmentPath(id), { force: true });
    delete this.state.attachments[id];
    this.audit(actor, 'attachment.delete', id);
    await this.persist();
    return metadata;
  }

  async createVault() {
    const vaultId = crypto.randomUUID(); const bootstrapToken = token();
    this.state.vaults[vaultId] = { bootstrapTokenHash: hash(bootstrapToken), createdAt: now(), envelopes: [], devices: {} };
    this.audit('hub', 'vault.create', vaultId); await this.persist(); return { vaultId, bootstrapToken };
  }
  vault(vaultId) { const vault = this.state.vaults[vaultId]; if (!vault) throw new HubError(404, 'vault_not_found'); return vault; }
  async enroll(vaultId, deviceId, bootstrapToken) {
    if (!crypto.randomUUID || !/^[0-9a-f-]{36}$/i.test(deviceId || '')) throw new HubError(400, 'invalid_device');
    const vault = this.vault(vaultId);
    if (!safeEqual(hash(bootstrapToken || ''), vault.bootstrapTokenHash)) throw new HubError(401, 'invalid_bootstrap_token');
    const deviceToken = token(); vault.devices[deviceId] = { tokenHash: hash(deviceToken), createdAt: now(), revokedAt: null };
    this.state.devices[deviceId] = { id: deviceId, name: 'iPhone/iPad', type: 'ios', pairedAt: now(), lastAccessAt: now(), protocolVersion: '0.1.0', state: 'active', vaultId };
    this.audit(deviceId, 'device.enroll', deviceId); await this.persist(); return { deviceId, deviceToken };
  }
  requireDevice(vaultId, deviceId, deviceToken) {
    const vault = this.vault(vaultId); const device = vault.devices[deviceId];
    if (!device || device.revokedAt || !safeEqual(hash(deviceToken || ''), device.tokenHash)) throw new HubError(401, 'unauthorized_device');
    this.state.devices[deviceId].lastAccessAt = now(); return vault;
  }
  async uploadEnvelope(vaultId, deviceId, deviceToken, key, envelope) {
    const vault = this.requireDevice(vaultId, deviceId, deviceToken);
    if (!key || !/^[0-9a-f-]{36}$/i.test(key) || !/^[0-9a-f-]{36}$/i.test(envelope.recordId || '') || !Number.isInteger(envelope.revision) || envelope.revision < 1 || !['upsert', 'tombstone'].includes(envelope.operation) || !envelope.envelopeVersion || !envelope.nonceBase64 || !envelope.ciphertextBase64 || !envelope.authTagBase64 || envelope.ciphertextBase64.length > 8_388_608) throw new HubError(400, 'invalid_envelope');
    const idempotencyId = `${vaultId}:${deviceId}:${key}`; if (this.state.idempotency[idempotencyId]) return { cursor: this.state.idempotency[idempotencyId], idempotent: true };
    if (vault.envelopes.some((entry) => entry.recordId === envelope.recordId && entry.revision === envelope.revision)) throw new HubError(409, 'record_revision_exists');
    const cursor = ++this.state.sequence; vault.envelopes.push({ cursor, ...envelope }); this.state.idempotency[idempotencyId] = cursor;
    this.audit(deviceId, `sync.${envelope.operation}`, envelope.recordId); await this.persist(); return { cursor, idempotent: false };
  }
  changes(vaultId, deviceId, deviceToken, cursor, limit) {
    const vault = this.requireDevice(vaultId, deviceId, deviceToken);
    if (!Number.isInteger(cursor) || cursor < 0) throw new HubError(400, 'invalid_cursor');
    const changes = vault.envelopes.filter((entry) => entry.cursor > cursor).slice(0, Math.max(1, Math.min(limit || 250, 500)));
    return { nextCursor: changes.at(-1)?.cursor ?? cursor, changes };
  }
  assertDomain(domain) { if (typeof domain !== 'string' || !DOMAIN_PATTERN.test(domain)) throw new HubError(400, 'invalid_domain'); }
  assertRecordID(id, domain) { if (domain === 'measurements' ? !validMeasurementID(id) : !genericRecordID(id)) throw new HubError(400, domain === 'measurements' ? 'invalid_measurement' : 'invalid_record_id'); }
  notFoundCode(domain) { return domain === 'measurements' ? 'measurement_not_found' : 'record_not_found'; }

  /** Strips client-supplied envelope fields so a client cannot forge revisions or ownership. */
  payloadFor(domain, input) {
    if (domain === 'measurements') {
      if (!/^[a-z0-9_]+$/.test(input.type || '') || !Number.isFinite(input.value) || typeof input.unit !== 'string' || !input.unit || Number.isNaN(Date.parse(input.measuredAt || ''))) throw new HubError(400, 'invalid_measurement');
      return { type: input.type, value: input.value, unit: input.unit, measuredAt: input.measuredAt, note: typeof input.note === 'string' ? input.note : undefined };
    }
    const payload = {};
    for (const [key, value] of Object.entries(input)) if (!RECORD_ENVELOPE_KEYS.has(key)) payload[key] = value;
    if (JSON.stringify(payload).length > MAX_RECORD_BYTES) throw new HubError(413, 'record_too_large');
    return payload;
  }

  async putRecord(domain, input, actor = 'web') {
    this.assertDomain(domain);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HubError(400, domain === 'measurements' ? 'invalid_measurement' : 'invalid_record');
    const id = input.id || crypto.randomUUID();
    this.assertRecordID(id, domain);
    const collection = (this.state.records[domain] ??= {});
    const existing = collection[id];
    if (existing && input.baseRevision !== undefined && input.baseRevision !== existing.revision) throw new HubError(409, 'conflict');
    const record = { ...this.payloadFor(domain, input), id, createdAt: existing?.createdAt ?? now(), updatedAt: now(), originDeviceId: input.originDeviceId ?? actor, provenance: input.provenance ?? actor, revision: (existing?.revision ?? 0) + 1, deleted: false };
    collection[id] = record;
    this.state.recordChanges.push({ cursor: ++this.state.sequence, domain, record: { ...record } });
    this.audit(actor, `${domain}.upsert`, id);
    await this.persist();
    return record;
  }
  listRecords(domain) { this.assertDomain(domain); return Object.values(this.state.records[domain] ?? {}).filter((record) => !record.deleted).sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '')); }
  listMeasurements() { return Object.values(this.state.records.measurements ?? {}).filter((record) => !record.deleted).sort((a, b) => (b.measuredAt ?? '').localeCompare(a.measuredAt ?? '')); }
  putMeasurement(input, actor = 'web') { return this.putRecord('measurements', input, actor); }
  async deleteRecord(domain, id, baseRevision, actor = 'web') {
    this.assertDomain(domain);
    this.assertRecordID(id, domain);
    const collection = (this.state.records[domain] ??= {});
    const record = collection[id];
    if (!record) throw new HubError(404, this.notFoundCode(domain));
    if (baseRevision !== undefined && baseRevision !== record.revision) throw new HubError(409, 'conflict');
    record.deleted = true; record.updatedAt = now(); record.revision += 1;
    this.state.recordChanges.push({ cursor: ++this.state.sequence, domain, record: { ...record } });
    this.audit(actor, `${domain}.delete`, id);
    await this.persist();
    return record;
  }
  deleteMeasurement(id, baseRevision, actor = 'web') { return this.deleteRecord('measurements', id, baseRevision, actor); }
  async pushHubRecord(domain, deviceId, deviceToken, signature, payload, mutationId, input) {
    this.assertDomain(domain);
    this.requireHubDevice(deviceId, deviceToken, signature, payload);
    if (!mutationId || !/^[0-9a-f-]{36}$/i.test(mutationId) || typeof input?.id !== 'string') throw new HubError(400, 'invalid_sync_mutation');
    this.assertRecordID(input.id, domain);
    const id = domain === 'measurements' ? `hub:${deviceId}:${mutationId}` : `hub:${domain}:${deviceId}:${mutationId}`;
    if (this.state.idempotency[id]) return { record: this.state.records[domain]?.[this.state.idempotency[id]], idempotent: true };
    const existing = this.state.records[domain]?.[input.id];
    if (existing && existing.originDeviceId !== deviceId) {
      // A re-paired device re-uploads the same content under a new identity:
      // that is not a conflict, just an idempotent echo. Diverging content is.
      if (sameRecordPayload(existing, this.payloadFor(domain, input))) return { record: existing, idempotent: true };
      throw new HubError(403, 'record_not_owned');
    }
    if (existing && input.baseRevision === undefined) throw new HubError(409, 'base_revision_required');
    const record = await this.putRecord(domain, { ...input, originDeviceId: deviceId, provenance: input.provenance ?? 'ios' }, deviceId);
    this.state.idempotency[id] = record.id;
    await this.persist();
    return { record, idempotent: false };
  }
  async deleteHubRecord(domain, deviceId, deviceToken, signature, payload, mutationId, recordId, baseRevision) {
    this.assertDomain(domain);
    this.requireHubDevice(deviceId, deviceToken, signature, payload);
    if (!mutationId || !/^[0-9a-f-]{36}$/i.test(mutationId)) throw new HubError(400, 'invalid_sync_mutation');
    this.assertRecordID(recordId, domain);
    const id = domain === 'measurements' ? `hub-delete:${deviceId}:${mutationId}` : `hub-delete:${domain}:${deviceId}:${mutationId}`;
    if (this.state.idempotency[id]) return { record: this.state.records[domain]?.[this.state.idempotency[id]], idempotent: true };
    const record = this.state.records[domain]?.[recordId];
    if (!record || record.originDeviceId !== deviceId) throw new HubError(404, this.notFoundCode(domain));
    const deleted = await this.deleteRecord(domain, recordId, baseRevision, deviceId);
    this.state.idempotency[id] = recordId;
    await this.persist();
    return { record: deleted, idempotent: false };
  }
  pushHubMeasurement(deviceId, deviceToken, signature, payload, mutationId, input) { return this.pushHubRecord('measurements', deviceId, deviceToken, signature, payload, mutationId, input); }
  deleteHubMeasurement(deviceId, deviceToken, signature, payload, mutationId, measurementId, baseRevision) { return this.deleteHubRecord('measurements', deviceId, deviceToken, signature, payload, mutationId, measurementId, baseRevision); }
  changesForDomain(domain, cursor, limit, idsOnly = false) {
    this.assertDomain(domain);
    if (!Number.isInteger(cursor) || cursor < 0) throw new HubError(400, 'invalid_cursor');
    const changes = this.state.recordChanges.filter((entry) => entry.domain === domain && entry.cursor > cursor).slice(0, Math.max(1, Math.min(limit || 250, 500)));
    // Index mode returns only identity/revision metadata: clients use it to learn
    // what the Hub already has without downloading every payload.
    const payload = idsOnly
      ? changes.map((entry) => ({ cursor: entry.cursor, domain: entry.domain, record: { id: entry.record.id, revision: entry.record.revision, deleted: entry.record.deleted } }))
      : changes;
    return { nextCursor: changes.at(-1)?.cursor ?? cursor, changes: payload };
  }
  changesForHubDomain(deviceId, deviceToken, signature, payload, domain, cursor, limit, idsOnly = false) { this.requireHubDevice(deviceId, deviceToken, signature, payload); return this.changesForDomain(domain, cursor, limit, idsOnly); }
  changesForHubDevice(deviceId, deviceToken, signature, payload, cursor, limit, idsOnly = false) { return this.changesForHubDomain(deviceId, deviceToken, signature, payload, 'measurements', cursor, limit, idsOnly); }
  listDevices() { return Object.values(this.state.devices).sort((a, b) => b.pairedAt.localeCompare(a.pairedAt)); }
  async createPairing(endpoint) {
    const id = crypto.randomUUID(); const pairingToken = token(); const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    this.state.pairings[id] = { tokenHash: hash(pairingToken), endpoint, expiresAt, usedAt: null };
    this.audit('web', 'pairing.create', id); await this.persist();
    return { pairingId: id, pairingToken, expiresAt, hubId: this.state.hubId, protocolVersion: '2', endpoint };
  }
  async claimPairing(id, pairingToken, name, publicKey) {
    const pairing = this.state.pairings[id];
    if (!pairing || pairing.usedAt || Date.parse(pairing.expiresAt) <= Date.now() || !safeEqual(hash(pairingToken || ''), pairing.tokenHash)) throw new HubError(401, 'invalid_or_expired_pairing');
    if (typeof name !== 'string' || !name.trim() || typeof publicKey !== 'string' || publicKey.length < 32 || publicKey.length > 8192) throw new HubError(400, 'invalid_device_identity');
    const idDevice = crypto.randomUUID(); const deviceToken = token(); pairing.usedAt = now();
    this.state.devices[idDevice] = { id: idDevice, name: name.trim().slice(0, 120), type: 'hub-client', pairedAt: now(), lastAccessAt: now(), protocolVersion: '1', state: 'active', publicKey, tokenHash: hash(deviceToken) };
    this.audit(idDevice, 'device.pair', idDevice); await this.persist(); return { deviceId: idDevice, deviceToken, hubId: this.state.hubId, protocolVersion: '1' };
  }
  requireHubDevice(id, deviceToken, signature, payload) {
    const device = this.state.devices[id];
    if (!device || device.state !== 'active' || !device.tokenHash || !safeEqual(hash(deviceToken || ''), device.tokenHash)) throw new HubError(401, 'unauthorized_device');
    try {
      const rawPublicKey = Buffer.from(device.publicKey, 'base64'); const signatureData = Buffer.from(signature || '', 'base64');
      const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawPublicKey]);
      if (rawPublicKey.length !== 32 || !crypto.verify(null, Buffer.from(payload || ''), { key: spki, format: 'der', type: 'spki' }, signatureData)) throw new Error('invalid signature');
    } catch { throw new HubError(401, 'invalid_device_signature'); }
    device.lastAccessAt = now(); return device;
  }
  async revokeDevice(id) { const device = this.state.devices[id]; if (!device) throw new HubError(404, 'device_not_found'); if (device.vaultId) this.vault(device.vaultId).devices[id].revokedAt = now(); device.state = 'revoked'; this.audit('web', 'device.revoke', id); await this.persist(); return device; }
}
