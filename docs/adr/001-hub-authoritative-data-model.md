# ADR 001: Hub authority is record-level, not database-copy sync

Use stable record IDs, revisions, tombstones, provenance and a monotonic change cursor. This enables idempotent offline replay and avoids whole-database transfer. Standalone remains local-authoritative until the user explicitly migrates.
