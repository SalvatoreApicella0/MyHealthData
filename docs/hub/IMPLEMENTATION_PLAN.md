# Hub implementation plan

1. Replace the JSON prototype storage with encrypted-at-rest SQLite migrations and attachment storage.
2. Implement trusted-Hub iOS mode, Bonjour discovery, QR one-time pairing and a durable client outbox.
3. Generalize canonical records, initial migration, deduplication and conflict queue.
4. Add Tauri 2 shell/tray, packaging and local backup.
5. Add scoped API credentials, OpenAPI and authenticated MCP transport.
