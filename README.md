<div align="center">

<img src="docs/assets/myhealthdata-icon.png" alt="MyHealthData" width="128">

# MyHealthData

**Your health records. Your devices. Your control.**

A local-first personal health workspace for Web and iPhone, with an optional self-hosted desktop Hub.

[![CI](https://github.com/SalvatoreApicella0/MyHealthData/actions/workflows/ci.yml/badge.svg)](https://github.com/SalvatoreApicella0/MyHealthData/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: pre-release](https://img.shields.io/badge/Status-pre--release-orange.svg)](docs/roadmap.md)

[Getting started](#getting-started) · [Documentation](#documentation) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

</div>

MyHealthData brings measurements, symptoms, medications, activity and health document metadata into one personal workspace. Explore an interactive body atlas, follow changes over time, and export your records in a documented format. The standalone Web and iOS apps remain usable without a Hub or hosted account.

**Early public preview:** this is an actively developed project, not a production health-data service. Interfaces and protocols may evolve. The interface supports Italian and English.

## What you can do

- **Organize your health history:** measurements, symptoms, visits, medications, nutrition, sleep and other health modules.
- **Explore the body atlas:** connect symptoms and events to body regions with an interactive 3D view.
- **Import Apple Health data:** use the native SwiftUI iPhone app with explicit HealthKit permission.
- **Keep records locally:** IndexedDB on Web; an encrypted vault with Keychain-backed keys on iOS.
- **Move your data:** JSON import/export and encrypted Web exports, without a hosted account.
- **Connect your own devices:** run the optional Hub, pair the iPhone by QR code and synchronize records and attachments.

## Choose your setup

| Component | Purpose | Technology |
| --- | --- | --- |
| Web | Standalone browser workspace with an offline app shell | React, TypeScript, Vite, Dexie, Three.js |
| iPhone | Native local vault, HealthKit and sharing | SwiftUI, HealthKit, CryptoKit |
| Hub | Optional local store, device pairing and synchronization | Node.js, Electron |
| Legacy relay | Compatibility service for opaque encrypted vaults | Node.js |

## Getting started

### Web

Requires **Node.js 20.19+** and npm.

```sh
git clone https://github.com/SalvatoreApicella0/MyHealthData.git
cd MyHealthData
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. The standalone Web app stores its records in your browser. Export a backup before clearing browser storage.

### Optional Hub

```sh
npm run build
npm run hub
```

Open <http://127.0.0.1:8472>. Use the Devices tab to generate a pairing QR code, then scan it in the iPhone app under **Sync personale → MyHealthData Hub**. For the desktop shell, run `npm run hub:desktop`.

The Hub Web/admin interface defaults to loopback. Its separate pairing/sync listener is intended for a trusted LAN. Transport TLS, conflict UX and notarized desktop distribution remain release blockers; read [Hub release acceptance](docs/hub/RELEASE_ACCEPTANCE.md) before using it with sensitive records. Do not expose it through WAN, port forwarding or a public reverse proxy.

For Docker, generate and securely retain the Hub encryption key before starting:

```sh
export MHD_HUB_STORE_KEY="$(openssl rand -base64 32)"
docker compose up --build
```

Keep this key in a protected secret store: it is required to reopen the encrypted data volume.

### iPhone / Mac Catalyst

Requires macOS, Xcode with the iOS 18 SDK or newer, and [XcodeGen](https://github.com/yonaskolb/XcodeGen).

```sh
npm run ios:generate
open apps/ios/MyHealthDataiOS/MyHealthDataiOS.xcodeproj
```

Select the `MyHealthDataiOS` scheme and a supported destination. For a physical iPhone, select your own Apple Developer signing team in Xcode; this repository does not contain the maintainer's signing configuration. See [iOS development](docs/mobile/ios.md) for details.

## Development

```sh
npm run verify
```

This runs repository hygiene, TypeScript checks, Web tests, Hub/MCP/legacy relay tests and the production Web build. For native validation, use `npm run ios:build:catalyst` or the appropriate Xcode test destination.

| Path | Contents |
| --- | --- |
| `src/` | Web app and local persistence |
| `apps/ios/MyHealthDataiOS/` | iPhone app, Share Extension and native tests |
| `apps/hub-desktop/` | Electron desktop shell |
| `sync-server/` | Hub, local MCP adapter and legacy relay |
| `docs/hub/`, `docs/adr/` | Hub contracts and architecture decisions |

## Privacy and safety

Health records belong to the person they describe. Use synthetic data in issues, tests and screenshots; never submit real medical documents, vault exports or credentials. See the [security policy](SECURITY.md) for private vulnerability reporting and [privacy architecture](docs/privacy-and-security.md) for technical details.

MyHealthData is not a medical device and does not provide diagnosis, treatment or medical advice. Consult a qualified healthcare professional for medical concerns.

## Documentation

- [Vision](docs/vision.md) and [roadmap](docs/roadmap.md)
- [Architecture](docs/architecture.md) and [data model](docs/data-model.md)
- [Hub architecture](docs/hub/ARCHITECTURE.md) and [sync protocol](docs/hub/SYNC_PROTOCOL.md)
- [iOS app](docs/mobile/ios.md) and [legacy sync](docs/mobile/sync-architecture.md)
- [FHIR mapping](docs/interop/fhir-mapping.md)
- [Third-party notices](docs/THIRD_PARTY_NOTICES.md) and [exercise dataset](docs/gym-dataset.md)

## Contributing

Contributions, bug reports and documentation improvements are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), use synthetic reproduction data and keep changes focused. No downloadable signed releases are provided with this initial source publication.

## License

Project code is available under the [MIT License](LICENSE). Bundled anatomy geometry and third-party datasets retain their own licenses and attribution; see [third-party notices](docs/THIRD_PARTY_NOTICES.md). Exercise media and research downloads are excluded from this repository.
