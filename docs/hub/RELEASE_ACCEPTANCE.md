# Hub release acceptance

Implemented and verified in this public pre-release:

- Electron desktop shell, tray lifecycle, keychain-protected Hub store key and macOS DMG/ZIP packaging.
- A loopback-only Web UI and a separate LAN listener that exposes one-time pairing claims, token-authenticated canonical record sync, legacy measurement aliases and the bounded attachment channel.
- Bonjour/mDNS discovery, QR generation in the Web UI, QR scanning/manual fallback on iPhone, immediate device revocation, and automatic sync at launch/foreground.
- Idempotent create/update/delete replication for canonical records, with cursors and tombstones; legacy measurement endpoints remain compatible aliases.
- Full canonical record replication for the iOS client, with a separate integrity-checked attachment transfer path.
- Static serving, Docker configuration, a documented OpenAPI surface, CI, protocol tests and Catalyst builds.

Release blockers still deliberately prevent describing the project as a production health-data service: TLS for transport confidentiality on the LAN, authenticated browser sessions/CSRF for any non-loopback UI, conflict UX, and notarized desktop binaries. The MCP adapter is capability-gated and scope-limited but remains intentionally local stdio only. Do not expose the current LAN listener beyond a trusted private network.
