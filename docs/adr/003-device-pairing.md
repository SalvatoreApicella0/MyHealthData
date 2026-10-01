# ADR 003: device credentials replace shared passwords

Pairing starts with a high-entropy, short-lived QR bootstrap token in the planned trusted-Hub protocol. The legacy encrypted relay currently uses a bootstrap token and per-device random token; it is retained only for compatibility while QR expiry and mDNS are added.
