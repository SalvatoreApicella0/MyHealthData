# MyHealthData Hub architecture

The Hub is a local, user-operated authority. It serves the existing React build and a versioned API; the desktop shell owns process lifecycle, tray and browser opening. The Web UI is loopback-bound by default (`127.0.0.1:8472`).

The first working slice is body measurements. Browser writes call `/api/v1/measurements`; records are persistent, revisioned, tombstoned and audit-logged without values. The existing iOS encrypted-relay contract remains supported at `/v1/vaults/*`, so no standalone vault behavior is removed. That contract cannot populate the Hub Web UI because its payload is intentionally opaque; trusted-Hub iOS migration is a separate explicit protocol upgrade.

`hub-state.json` is an atomic, private-mode encrypted store. It is deliberately isolated behind `HubStore`, so a SQLite migration can preserve the API and protocol. Canonical records replicate through the generic record API. Binary attachments use a separate bounded, atomic file channel (`/api/v1/sync/attachments/{id}` for paired devices and `/api/v1/attachments/{id}` for the loopback Web UI), so record JSON stays small and responsive.


The desktop Hub owns two listeners: the Web UI and administrative API remain loopback-only; the device listener is advertised with Bonjour as `_myhealthdata._tcp` and accepts only pairing claims plus token-authenticated sync. The iOS app browses that service type to show nearby Hubs, while the expiring QR pairing code remains the trust-establishment step.
