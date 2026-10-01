# Sync Architecture

The selected direction is local-first first, optional encrypted sync second.

MyHealthData should not require a project-owned server to be useful. The web app and iOS app must both work offline and must both support MHD export/import. Sync can later be added as an optional convenience layer.

## Recommended Model

```text
Web app / iOS app / future Android app
  local encrypted store
  MHD canonical schema
  change log
       |
       | encrypted sync packets
       v
Blind sync server
  account/device registry
  encrypted blobs
  cursors
  deletion markers
```

The server should not store health records in plaintext. It should store opaque encrypted packets and minimal routing metadata.

## Server Responsibilities

- Authenticate users or devices.
- Register devices.
- Accept encrypted change packets.
- Return packets since a cursor.
- Retain encrypted backup blobs if the user enables backup.
- Delete packets when the user deletes an account or backup.

The server must not:

- parse health events;
- index symptoms;
- inspect measurements;
- render reports;
- run analytics on health data;
- train models on health data.

## Packet Shape

Draft plaintext envelope before encryption:

```json
{
  "deviceId": "device_uuid",
  "sequence": 42,
  "schemaVersion": "0.1.0",
  "createdAt": "2026-07-05T12:00:00.000Z",
  "operation": "upsert",
  "entity": "measurement",
  "record": {}
}
```

Server-visible wrapper after encryption:

```json
{
  "accountId": "opaque_account_id",
  "deviceId": "opaque_device_id",
  "sequence": 42,
  "schemaVersion": "0.1.0",
  "createdAt": "2026-07-05T12:00:00.000Z",
  "payloadHash": "sha256",
  "ciphertext": "base64"
}
```

## Account Options

The first sync implementation can support one of these:

- Username/password account plus E2EE recovery key.
- Pairing-code device sync without long-lived server identity.
- Bring-your-own-server URL.
- File-provider sync using iCloud Drive, Syncthing, WebDAV, or another user-controlled storage layer.

The open-source-friendly default should be bring-your-own-server plus a reference server, not a hard dependency on a single hosted service.

## Current Decision

Do not build server sync into the critical path yet. Build the iOS app as local-first, keep MHD export/import compatible, and add sync only after:

- conflict resolution is specified;
- recovery key UX is specified;
- encrypted packet schema is tested;
- server deletion semantics are documented;
- mobile and web can both import/export the same MHD files reliably.
