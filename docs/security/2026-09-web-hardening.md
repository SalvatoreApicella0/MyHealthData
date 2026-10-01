# Web + Hub hardening review — September 2026

Scope: the standalone Web vault (`src/`), the static deployment (`nginx.conf`,
`Dockerfile`, `docker-compose.yml`), the local Hub (`sync-server/hub.mjs`,
`hub-store.mjs`), the legacy relay (`sync-server/server.mjs`) and the MCP
adapter (`sync-server/mcp.mjs`).

Method: source review against `docs/hub/SECURITY.md`,
`docs/hub/SYNC_PROTOCOL.md`, `docs/hub/RELEASE_ACCEPTANCE.md`,
`docs/privacy-and-security.md` and `SECURITY.md`; targeted regression tests;
proof-of-behaviour checks against a running Hub.

## 1. Findings and fixes

| # | Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| 1 | High | A failed static read could crash the request handler after headers were sent, hanging the connection forever. Any client could pin connections open by requesting an asset that falls back to a missing shell. | `sync-server/hub.mjs` (`serveWeb` wrote `200` before `fs.readFile`, outer `catch` called `json()` again) | Static files are now read before headers are written; missing bundles return a JSON `404`; the outer handler never writes after `headersSent`. Regression test: *static file handler never escapes the web root and always answers*, *deployment without a built Web bundle answers 404 instead of hanging*. |
| 2 | High | The Hub-served Web build shipped without any Content-Security-Policy or framing protection (only the nginx deployment had headers). | `sync-server/hub.mjs` `serveWeb` response headers | The Hub now serves the same strict policy as nginx (CSP, `X-Frame-Options: DENY`, `Permissions-Policy`, COOP/CORP, `nosniff`, `no-referrer`). |
| 3 | Medium | Static path containment used a raw string prefix test: `/app/dist` also matched `/app/dist-backup`. | `sync-server/hub.mjs` `resolved.startsWith(path.resolve(webDirectory))` | Separator-aware containment (`resolved === root \|\| resolved.startsWith(root + path.sep)`) plus an explicit NUL-byte rejection. Regression test included. |
| 4 | Medium | The unauthenticated pairing endpoints had no rate limiting. On the LAN device listener, `/api/v1/pairings/:id/claim` performs SHA-256 and JSON parsing per request, so it could be used as a work amplifier. | `sync-server/hub.mjs` claim route | Per-client token bucket: 20 claims/min and 30 pairing creations/min, with a bounded bucket map. Regression test: *pairing endpoints are rate limited*. |
| 5 | Medium | The legacy relay bound `0.0.0.0` by default, contradicting the safety invariant that a Hub must not be WAN-reachable by default. | `sync-server/server.mjs` `server.listen(port, "0.0.0.0")` | Default host is now `127.0.0.1`; a non-loopback bind requires an explicit `MHD_SYNC_HOST` and prints a warning. Same warning added to the Hub device listener. |
| 6 | Medium | The Web app surfaced a raw parser error on every load when no Hub was present: the SPA shell (HTML) was parsed as JSON and reported to the user. | `src/storage/hubRepository.ts`, observed in the running app | Hub detection is fail-safe: JSON content type required, 1.5 s abort, every failure resolves to `false`, and no HTML/404/timeout reaches the UI. |
| 7 | Medium | Import hardening was absent: an imported file could declare unbounded arrays, unbounded strings or deeply nested objects. | `src/core/schema.ts` | Exported `IMPORT_LIMITS` (32 MiB file, 200 000 records/domain, 20 000 characters/string, depth 12) enforced on every `parseMhdExportFile` / `parseHealthDataSnapshot`, plus a pre-read size check in the import UI. Tests: `src/core/importLimits.test.ts`. |
| 8 | Low | Encrypted export ignored the iteration count in the file and used a fixed 210 000 PBKDF2 rounds; decryption did not validate salt/IV/ciphertext shape, and large payloads were base64-encoded one byte at a time. | `src/crypto/mhdCrypto.ts` | New exports use 600 000 rounds (OWASP guidance); decryption honours the file value inside a 100 000–2 000 000 bound, requires a 16-byte salt and 12-byte IV, rejects oversized ciphertext/plaintext, and encodes base64 in 32 KiB chunks. Tests: `src/crypto/mhdCrypto.test.ts`. |
| 9 | Low | The generated doctor report had no policy of its own and was embedded in a same-origin iframe. | `src/reports/htmlReport.ts`, `SettingsPage` preview | All interpolated values are escaped (including numeric fields), the document carries its own restrictive CSP (`default-src 'none'`), and the preview iframe is sandboxed. |
| 10 | Low | Static assets were cached for 7 days as `public, max-age=604800` including the service worker. | `nginx.conf` | `/sw.js` is served `no-cache, no-store, must-revalidate`; the shell is `no-cache`; hashed assets are `immutable`. |
| 11 | Low | Internal error text (JSON parser output, file paths) was echoed to legacy relay clients. | `sync-server/server.mjs` catch block | Generic `invalid_request` responses. |
| 12 | Medium | The legacy relay performed concurrent read-modify-write operations for packet batches, so overlapping uploads could overwrite each other. | `sync-server/server.mjs` collection append path | Storage is now isolated in `sync-server/legacy-store.mjs`: mutations are serialized per process, batch appends are single writes and file replacements are atomic. Regression: *serializes concurrent packet batches without losing opaque records*. |

## 2. Verified as already sound

- **At-rest encryption**: `MHD_HUB_STORE_KEY` (AES-256-GCM, random nonce, auth tag); `MHD_HUB_REQUIRE_ENCRYPTION=1` refuses to start without a key; state files are `0600`; test asserts that health values never appear in plaintext.
- **Device authentication**: Ed25519 signatures over a canonical payload (`method`, `url`, timestamp, idempotency key, body hash), 120 s timestamp window, device tokens stored hashed and compared with `timingSafeEqual`, revocation honoured immediately.
- **Pairing**: 32-byte tokens, hashed at rest, 10-minute expiry, single use, timing-safe comparison, device identity validated.
- **Surface split**: the browser administration API returns `404` on the LAN device listener; the UI listener binds loopback by default; sync limits are clamped (`Math.min(limit, 500)`), cursors validated, mutations idempotent with revisions and tombstones.
- **Request bounds**: Hub JSON bodies capped at 1 MiB, encrypted envelopes at 8 MiB of ciphertext, relay bodies at 10 MiB.
- **MCP**: capability must be injected out-of-band (`MHD_MCP_CAPABILITY`) with explicit scopes; covered by `npm run hub:mcp:test`.

## 3. Verification evidence

```sh
npm run typecheck        # clean
npm run test:run         # 67 files / 271 tests, incl. import limits and crypto tamper tests
npm run hub:test         # 25 tests, incl. traversal, missing-bundle and rate-limit regressions
npm run hub:mcp:test     # 1 test
npm run legacy:test      # 4 tests, incl. concurrent packet persistence and account deletion
npm run build            # production bundle
```

Manual proof: a Hub started with `PORT=8791 node sync-server/hub.mjs` returned
the CSP, `X-Frame-Options: DENY`, `Permissions-Policy`, COOP and CORP headers on
`/`, `/no-such-route`, `/hub.mjs` and traversal-shaped paths, and answered every
request within milliseconds.

## 4. Residual risk

1. **No TLS.** The Hub is designed for loopback and trusted-LAN use. Ciphertext
   is opaque to the transport, but pairing codes and device tokens travel over
   plain HTTP on the LAN. Keep the device listener on a trusted network and
   never port-forward it.
2. **Rate limiting is in-memory.** It resets when the Hub restarts and does not
   coordinate across processes. It is a work-amplifier guard, not an internet
   facing WAF.
3. **The legacy relay store is single-process.** Its write queue protects one
   process and one data directory; do not mount the same relay directory into
   multiple replicas.
4. **The Web vault is only as strong as the browser profile.** IndexedDB is not
   encrypted at rest; encrypted export is the supported way to move sensitive
   data. This matches the documented product model.
5. **Attachment bytes** are not persisted by the Web vault (metadata only), so
   there is no Web-side file-upload attack surface yet. When attachment storage
   arrives it needs its own review (type sniffing, size caps, decompression).
6. **FHIR mapping** remains a draft interoperability layer, not a certified
   clinical export.

## 5. Follow-ups

- Add an integration test that pair-claims and syncs against the real device
  listener with a signed client (currently covered indirectly).
- Consider a persisted, per-device rate-limit ledger once the Hub supports
  multiple processes.
- Add `npm audit --omit=dev` to CI and pin the Electron/Hub dependency surface
  (`docs/hub/RELEASE_ACCEPTANCE.md` already tracks release actions).
