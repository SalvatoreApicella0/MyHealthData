# Hub test plan

Automated now: measurement persistence/conflict/tombstone (including stale device updates); encrypted envelope cursor/idempotency; device revocation; signed device requests; encrypted-at-rest state; MCP capability and scope gating; existing Web schema/repository/FHIR tests.

Before release: run iPhone ↔ Hub pairing/sync, offline/reconnect, restart, duplicate delivery, deletion, browser create/edit, export/import round-trip and an authenticated MCP write/read. Use only synthetic data.
