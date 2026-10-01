# Sync and backup architecture

## Goal

MyHealthData needs two portability paths:

1. Manual or automatic backup as a user-controlled file package.
2. Optional sync across devices through open-source, self-hostable infrastructure.

The app must keep working with no account and no server.

## Recommended strategy

Build backup first, then sync.

Backup is simpler, safer, and already fits the local-first product. Sync requires identity, conflict handling, device trust, revocation, and a threat model. The sync design should reuse the same package and record model created for backup.

## Backup package

Current iOS implementation:

- `MHDExportService` still exports a single `.json` document so the existing share/export flow does not change.
- The JSON envelope now carries a package manifest with `packageId`, `formatVersion`, app version/build when available, export source, and export timestamp.
- `metadata.recordCounts` covers profile, symptoms/events, measurements, documents, cycle entries, sleep sessions, appointments, medications, condition episodes, lab results, attachments, precise body points, and total record count.
- `integrity` contains SHA-256 hashes for the canonical record payload and the record-count block. Import validates counts for every export and validates hashes when present.
- Older JSON exports without the newer manifest/checksum fields remain importable through decoder defaults.

The native app also exports/imports `.mhdzip` packages with CSV members, checksums and encrypted attachment rehydration.

Package format:

`.mhdzip` is implemented as a ZIP package with:

- `manifest.json`: schema version, app version, export time, package id.
- `records.json`: canonical structured records.
- `csv/`: optional user-readable CSV for measurements, events, documents, medications, visits.
- `attachments/`: encrypted attachment blobs.
- `previews/`: optional generated thumbnails, never required for import.
- `checksums.json`: SHA-256 for every package member.

Export modes:

- Full backup: every record and attachment.
- Selective package: chosen modules/date ranges/documents for sharing.
- Redacted package: excludes identity fields, free-text notes, or attachments.

Import behavior:

- Validate manifest and checksums.
- Show counts before import.
- Detect duplicates by stable record id and source id.
- Report accepted, skipped, duplicate, and failed records.

## Private drive backup

First implementation should use iOS document picker/export destinations. This avoids binding MHD to a vendor.

Later targets:

- WebDAV destination.
- Nextcloud-compatible WebDAV.
- Local network folder via Files provider.
- User-selected folder with periodic reminders.

Useful open-source references:

- Syncthing: peer-to-peer file synchronization, MPL-2.0.
- Nextcloud: self-hosted file platform with WebDAV.
- WebDAV: common open protocol supported by many self-hosted servers and backup tools.

## Self-hosted sync server

A minimal reference server is available in `sync-server/` and is included as the optional `sync` service in `docker-compose.yml`. It stores opaque ciphertext only, requires `MHD_SYNC_TOKEN`, supports device registration/approval, packet cursors, encrypted blobs, encrypted backups and account deletion. The native client integration remains a later compatibility layer over this protocol.

The legacy JSON/blob implementation is deliberately single-process: `legacy-store.mjs` serializes every collection mutation and replaces files atomically, so concurrent HTTP batches cannot lose records. Run one relay process per data directory; horizontal replication requires a shared transactional store and is outside this compatibility layer.

The server should be optional and Docker-first.

Initial server responsibilities:

- Device registration.
- Store encrypted record envelopes.
- Store encrypted attachment blobs.
- Track per-device sync cursors.
- Return changes since cursor.
- Never decrypt health data.

The server should not provide medical logic. It is a mailbox/object store for encrypted MHD data.

Suggested first API:

- `GET /healthz`: deployment and version check.
- `POST /v1/devices`: register a device public key and pairing request.
- `POST /v1/devices/{id}/approve`: approve a pending device from an already trusted device.
- `POST /v1/packets/batch`: upload encrypted record envelopes.
- `GET /v1/packets?after={cursor}`: download encrypted changes since cursor.
- `POST /v1/blobs`: upload encrypted attachment blobs by content hash.
- `GET /v1/blobs/{hash}`: download encrypted attachment blob.
- `POST /v1/backups`: upload a full encrypted backup package.
- `GET /v1/backups`: list encrypted backup snapshots.
- `DELETE /v1/account`: delete server account, devices, packets, backups, and blobs.

Suggested tables:

- `accounts`: server identity only, never clinical profile fields.
- `devices`: public key, display name, approval state, revocation time.
- `packets`: encrypted payload, record id hash, version, source device, server receive time.
- `blobs`: encrypted attachment hash, size, storage pointer.
- `backups`: encrypted package metadata, size, checksum, creation time.
- `key_wraps`: encrypted vault-key material per trusted device.
- `audit_events`: local/server security events with no health content.

## Identity

Avoid Firebase or closed identity providers.

Possible modes:

- No-login local backup: default.
- Pairing code between devices: good for local-first sync without global identity.
- Self-hosted account: username/password or passkey on the user's server.
- Optional OIDC adapter: support Keycloak, Authelia, Dex, or other open-source providers for advanced users.

Recommended first sync identity:

1. User enters server URL.
2. Server shows or generates pairing code.
3. Device creates a local keypair.
4. Server stores public device identity.
5. Existing device approves new device.

## Encryption model

Client-side encryption should be mandatory for sync.

Records:

- Each record is encoded as canonical JSON.
- The client encrypts record envelopes with a vault key.
- Server stores ciphertext, type hints only if necessary, timestamps, and version ids.

Attachments:

- Already encrypted locally.
- Upload as encrypted blobs with content hashes.

Key management:

- Device key in Keychain.
- User recovery/export key later.
- Adding a device requires explicit approval or recovery key.
- Revoked devices stop receiving new keys.

## Conflict handling

Use conflict-safe records instead of overwriting whole snapshots.

Each record should have:

- stable id;
- type;
- `createdAt`;
- `updatedAt`;
- `deletedAt` tombstone;
- source device id;
- version counter or hybrid logical clock.

Conflict policy:

- Append-only events: merge by id.
- Measurements: merge by id/source id.
- Documents: merge metadata by id; attachment blobs by hash.
- Profile/settings: last-writer wins initially, later field-level merge.

## Connector protocol for care sharing

The connector layer should be separate from sync.

Flow:

1. User selects data in app.
2. App builds a selective `.mhdzip`.
3. User previews the manifest and record counts.
4. User chooses a destination:
   - save file;
   - email/share sheet;
   - external MHD connector;
   - future community service directory.

External services receive only the selected package. They do not get ongoing sync unless explicitly authorized.

## Server stack options

Minimal custom server:

- API: HTTP JSON + object upload.
- Database: SQLite first, Postgres later.
- Object storage: local filesystem first, S3-compatible later.
- Deployment: Docker Compose.
- Auth: local pairing first, OIDC adapter later.

Avoid adding Redis until there is a measured queue/session need. If Redis is introduced, it should be optional and version-pinned.

## Dependency monitoring

For open-source dependencies:

- Keep lockfiles committed.
- Use Dependabot or Renovate for GitHub.
- Track Docker base image updates.
- Add a monthly dependency review issue.
- Separate "security update" from "feature update".
- Maintain `THIRD_PARTY_NOTICES.md` for licenses.

## Decision

Phase 1 should implement `.mhdzip` backup/export and selective package manifests.

Phase 2 should add WebDAV/private-drive backup.

Phase 3 should add self-hosted sync as a separate Docker service with encrypted envelopes and explicit device pairing.
