# Hub security posture

- Default bind is loopback; Docker publishes loopback only. WAN, UPnP and port forwarding are not implemented.
- Container images bind the Hub to the container interface (`0.0.0.0`) so the service is reachable through Docker networking; deployments must keep the host-side publish address restricted, as the provided Compose file does with `127.0.0.1`.
- Device enrollment uses a 256-bit random bootstrap token stored only as SHA-256 server-side. Device tokens are random and stored hashed.
- Each iOS Hub client generates an Ed25519-compatible signing identity; its private key is stored in the device Keychain and its public key is retained with the paired device record. Every device-sync request carries a short-lived timestamp and an Ed25519 signature over method, path and idempotency key. A captured device token alone cannot authorize a request.
- Device requests require device ID and token; revocation takes effect immediately.
- Request bodies are size-limited; JSON, UUIDs, envelope shape and envelope size are validated. Static files are path-confined.
- Audit entries contain actor, action, record ID and result—not health values. API errors never include stack traces.
- Hub state is encrypted with AES-256-GCM when `MHD_HUB_STORE_KEY` is configured. The desktop shell generates a random 256-bit key and keeps it encrypted with the operating system keychain; Docker images require the operator to provide the key and refuse to start without encryption. Losing that key makes the encrypted Hub data unrecoverable.
- Bonjour advertisements disclose only the service name, service type and protocol version; they contain no health data, pairing secret or device token.

The desktop app starts two deliberately separate listeners: the Web UI and its administrative API stay on `127.0.0.1:8472`; the LAN listener on port `8473` accepts only pairing claims and token-authenticated measurement sync. It does not serve the Web UI, browser measurements or device administration.

Current limitation: the LAN listener uses HTTP so that a self-hosted desktop Hub works without certificate provisioning. Pair only on a trusted private network; a network attacker can observe a pairing token in transit. Do not expose the listener through WAN, UPnP, port forwarding or a public reverse proxy. HTTPS/mutual device proof are required before treating remote-network use as supported.
