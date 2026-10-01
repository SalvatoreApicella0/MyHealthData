# ADR 006: Canonical record replication is domain-generic

The Hub stores every `MHDDataSnapshot` domain in one record graph (`records[domain]`, shared monotonic cursor, integer `revision`, `deleted` tombstone, `originDeviceId`/`provenance`) instead of a measurement-only collection. Domain names are pattern-restricted and record payloads bounded to keep an untrusted client from creating unbounded collections; signed device writes still require `baseRevision` on an existing device-owned record and only the owner can mutate it. The legacy measurement endpoints remain as an alias of the `measurements` domain, so existing clients keep working, and `hub-state.json` migrates in place from schemaVersion 1 to 2. The Web vault applies the change log incrementally with a per-domain cursor persisted in `localStorage` and writes through while a Hub is present. See `docs/hub/SYNC_PROTOCOL.md`.

## Implementation status

As of 2026-09-25, phase 2b is implemented in iOS build 67: `HubSyncClient` replicates the canonical record domains through the generic signed endpoints, while measurements retain their legacy dedicated aliases. Binary document and event attachments continue through the separate signed attachment channel. Ownership restrictions and revision conflicts remain protocol invariants; conflict resolution still requires a later user-facing UX.
