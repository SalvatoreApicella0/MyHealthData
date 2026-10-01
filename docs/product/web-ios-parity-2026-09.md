# Web ↔ iOS parity programme (September 2026)

Status: **in progress, first slice delivered**.
Canonical source: `apps/ios/MyHealthDataiOS/MyHealthDataiOS/`.
Contract: [`docs/hub/IOS_WEB_PARITY.md`](../hub/IOS_WEB_PARITY.md).

## 1. Why this document exists

The Web app had drifted into a parallel, smaller product: a four-item sidebar,
English measurement labels, an ad-hoc module list with six invented tiles, a
`?view=` query router and no shared vocabulary with the native app. The iOS app
is the reference implementation: it owns the module catalog, the visual system
and the canonical data model.

This document records the audit, the requirements derived from it and the state
of each requirement. It is the working specification for the alignment work.

## 2. Audit summary

| Area | iOS (canonical) | Web before | Web now |
| --- | --- | --- | --- |
| Navigation | 4 tabs: Dashboard, Moduli, Calendario, Impostazioni | 4 sidebar entries: Oggi, Moduli, Percorso, Impostazioni | 4 tabs + hash routes, responsive sidebar/bottom bar |
| Module catalog | `HealthFeature`, 24 features, 15 on the dashboard | 6 hand-written cards | `src/core/healthModules.ts`, 1:1 catalog with iOS titles, subtitles, SF Symbol, tint, artwork and dashboard membership |
| Card artwork | `Module*.imageset` in the asset catalog | none | `/public/modules/*.jpg`, generated from the iOS assets at 760 px |
| Card rendering | 146 pt photo tile with bottom gradient, or Liquid Glass tile | plain list button | `ModuleTile` with photography/glass styles, 2 columns compact, drag reorder, per-module full-width |
| Design tokens | `MHDPalette`, `Color.mhdPrimary`, materials | unrelated green/cream palette | `src/index.css` tokens resolving the same palette, glass surfaces, 22/28 pt radii, light + dark |
| Measurement vocabulary | 66 `MeasurementType` raw values, Italian labels | 26 types, English labels | Italian/English dictionaries keyed by the canonical raw values |
| Data model | `MHDDataSnapshot` with 15 domains | profile/events/measurements/documents + passthrough | canonical domains typed, validated and persisted (see §5) |
| Encryption | CryptoKit AES-GCM + Keychain | WebCrypto AES-GCM + PBKDF2 | unchanged, re-audited |
| Offline | native vault | browser required network for first paint | service worker app shell, `/api/` never cached |

## 3. Requirements

### R1 — Single catalog
The Web module catalog must be generated from the iOS catalog, not re-invented.
Every tile shows the iOS title, subtitle, SF Symbol (traceability), tint,
artwork and dashboard membership.
**Status: done** (`src/core/healthModules.ts`).

### R2 — Single vocabulary
Every measurement, event, document, body-region and module label must use the
canonical raw values as keys, with Italian as the default language and English
as the second locale, mirroring `Resources/{it,en}.lproj`.
**Status: done** (`src/i18n/`).

### R3 — Visual parity
The Web must express the iOS visual system: palette, glass materials, 146 pt
card geometry, 22 pt tile radius, 28 pt panel radius, capsule controls, spring
motion, dark mode.
**Status: done** (`src/index.css`, `MHDVisualSystem.swift` mapping).

### R4 — Navigation parity
Dashboard, Moduli, Calendario, Impostazioni must be the four primary
destinations, with module deep links that survive reloads and bookmarking.
**Status: done** (`src/router.ts`, hash routes, legacy `?view=` links mapped).

### R5 — Data-graph parity
An iOS export and a Web export must share the same logical `MHDDataSnapshot`; an
import must never discard unknown domains.
**Status: done for the first slice** — canonical domains are validated, persisted
and round-tripped; the record schemas use passthrough validation so iOS-only
fields (`source`, `sourceRecordId`, `bodyPoint`, `linkedModuleId`, `ocrText`,
attachment `vaultFileName`/`sha256`) survive a Web import/export cycle, and the
Web vault can now create, update and delete records in the canonical domains
(`saveCanonicalRecord` / `deleteCanonicalRecord`). See §5.

### R6 — Honest native boundaries
Apple Health, HealthKit, BLE and camera stay native adapters. The Web shows the
canonical records imported from iOS/Hub and must say so instead of pretending to
have device access.
**Status: done** (canonical module views carry an explicit provenance banner).

### R7 — Local-first and offline
The vault stays usable without a Hub and without a network; the standalone Web
vault must open offline.
**Status: done** (service worker shell; Hub endpoints excluded from the cache).

### R8 — Accessibility
Keyboard navigation, visible focus, `aria-current`/`aria-pressed` state,
reduced-motion support, labelled controls, skip link, semantic landmarks.
**Status: done** for the new surfaces; a full audit remains.

### R9 — Performance
Module views and the 3D body twin must not block first paint.
**Status: done** (route-level `React.lazy` + isolated `three` chunk; first load
is ~66 kB gzip of application JS instead of a single 372 kB gzip bundle).

### R10 — Security posture
Health data never leaves the device implicitly; exports are explicit; XSS and
import-based denial of service are prevented; no PHI in logs.
**Status: in progress** — see `docs/security/2026-09-web-hardening.md`.

## 4. Delivered in this slice

- `src/core/healthModules.ts`: canonical catalog + per-module metric resolver
  mirroring `HealthFeature.metric(in:)`.
- `src/core/metrics.ts`: daily aggregation (sum for cumulative HealthKit
  quantities, mean for physiological point metrics) with bounded adaptive
  chart domains.
- `src/i18n/`: Italian/English dictionaries keyed by canonical raw values.
- `src/components/`: `MetricChart`, `ModuleTile`, `ModuleGrid`,
  `DataTransferPanel`.
- `src/pages/`: Dashboard (quick widgets + trends), Modules (canonical grid with
  reorder/width/style), module detail views (measurement dashboards, body twin,
  documents, event modules, canonical domain readers, trends, backup),
  Calendar, Settings (profile, modules, data, devices, privacy, report, about).
- `src/router.ts`: hash router with legacy link mapping.
- `public/modules/*`: module artwork derived from the iOS asset catalog.
- `public/sw.js`: offline app shell that never caches Hub API traffic.
- Route-level code splitting and a `three`-only chunk.

## 5. Data model status

`docs/hub/IOS_WEB_PARITY.md` requires the Web to read, write, export and sync
the same records as iOS. The Web vault now stores the canonical domains next to
the original four collections, validates them with Zod and preserves unknown
domains on import so a newer iOS build never loses data through a Web round
trip.

What is in place today:

- record schemas use passthrough validation, so iOS-only fields (`source`,
  `sourceRecordId`, `bodyPoint`, `linkedModuleId`, `linkedAppointmentId`,
  `ocrText`, `needsClassification`, attachment `vaultFileName`/`sha256`/`storedAt`)
  survive a Web import/export cycle;
- `src/core/canonicalDomains.ts` describes each canonical domain (snapshot key,
  id prefix, date field, display fields and editable fields) with the same field
  names as the Codable models;
- `saveCanonicalRecord` / `deleteCanonicalRecord` in the repository let the Web
  vault create, update and delete records in `appointments`, `cycleEntries`,
  `sleepSessions`, `foodLogEntries`, `gymWorkouts`, `medications`,
  `medicationDoseEvents`, `conditionEpisodes`, `conditionCheckIns` and
  `labResults`, with the canonical graph stored in the same snapshot blob the
  export and Hub sync use;
- the module views render one generic editor driven by that spec, so every
  module gets consistent entry UI instead of eight bespoke screens;
- `src/storage/canonicalRecords.test.ts` covers create/update/delete,
  iOS-only-field preservation and identifier hardening.

Still missing for full parity: Hub revision/tombstone replication for these
domains (only `Measurement` syncs today) and a shared iOS/Web snapshot fixture.

## 6. Open items

1. Full write paths for canonical domains that are currently read-only on the
   Web (cycle, sleep sessions, food log, gym workouts, appointments,
   medications, condition episodes, lab results). Until then the Web shows the
   imported records and says so.
2. Hub revision/tombstone replication for every record type, not only
   `Measurement` (`docs/adr/004-sync-revisions.md`).
3. Accessibility audit with a screen reader and 200 % zoom.
4. Visual regression fixtures for the module grid in both card styles.
5. Web-side import of the iOS Health export bundle (`.mhd` archive) once the
   archive format is frozen.

## 7. Verification

Run for every Web change:

```sh
npm run typecheck
npm run test:run
npm run build
```

Parity is verified by fixture round trips (iOS-shaped snapshot →
Web vault → export → import) and by comparing the module catalog against
`HealthFeature.allCases` in the iOS source.
