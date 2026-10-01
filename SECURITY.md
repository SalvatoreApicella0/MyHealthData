# Security policy

MyHealthData is pre-release software that handles sensitive personal health data. Security fixes currently target `main`.

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/SalvatoreApicella0/MyHealthData/security/advisories/new) to contact the maintainer privately. Do not publish exploit details in an issue before coordinated disclosure.

Never attach real health records, exported vaults, medical documents, access tokens or screenshots containing personal information. Use synthetic examples and describe the affected version, reproduction steps and impact.

## Scope

Local vault encryption, key handling, HealthKit imports, export/import validation, Hub pairing and synchronization, and dependencies are security-sensitive areas.

The Hub currently belongs on a trusted private network. See [release acceptance](docs/hub/RELEASE_ACCEPTANCE.md) and [Hub security](docs/hub/SECURITY.md) for the current limitations.
