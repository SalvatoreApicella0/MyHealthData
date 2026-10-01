# Implementation status

This file is the working checklist for the two active delivery goals. A requirement is marked complete only when the user flow exists in the app and has a build or test check behind it.

## Current platform boundary

- The native project currently ships an iOS app, a Share Extension and tests.
- Watch, WidgetKit, WatchConnectivity and their App Group snapshot runtime
  were intentionally retired. Historical delivery logs retain the evidence of
  earlier builds, but those targets are not part of the current release gate.

## Foundations

- [x] Local encrypted vault and asynchronous persistence.
- [x] Manual records for events, measurements, documents, cycle, sleep, visits, medications, conditions, labs, nutrition, allergies, vision, gut health, dental care, sexual health, beverages and body measurements.
- [x] Native Mac Catalyst build path; iOS simulator is not part of the project workflow.
- [x] Apple Health permission flow and selectable 30-day, 1-year and complete-history import.
- [x] HealthKit source UUIDs and source names retained for measurement deduplication and provenance.
- [x] Incremental HealthKit history windows with source-ID merge.
- [x] Anchored HealthKit quantity queries and persisted per-type cursors.
- [x] Background task scheduling for HealthKit refresh with visible stale/partial state.
- [x] Live step totals use HealthKit cumulative statistics, refresh whenever the app becomes active and receive hourly observer/background-delivery notifications.
- [x] HealthKit recent imports observe every supported quantity, category and workout type; foreground refreshes serialize with any active history sync instead of racing it.
- [x] Raw iPhone/Watch step samples are replaced by one HealthKit-deduplicated daily total, including migration during manual and historical imports.
- [x] `.mhdzip` export/import with manifest, records, CSV, encrypted attachments, checksums and attachment rehydration.
- [ ] Round-trip tests for current and legacy export formats.
- [x] Self-hosted encrypted sync server with token auth, device registration/approval, opaque packets/blobs, Docker deployment, native encrypted backup upload/download and record-level merge.
- [x] Dependency update monitoring via Dependabot for npm and Docker images.

## Product flows

## Web client

- [x] Web app rebuilt as the browser translation of the iOS app: canonical module catalog, Italian/English vocabulary, same card artwork and same visual language.
- [x] Four-tab navigation (Dashboard, Moduli, Calendario, Impostazioni) with hash deep links, desktop sidebar and mobile tab bar.
- [x] Light/dark appearance with system default plus explicit override.
- [x] Offline app shell; Hub API traffic is never cached.
- [x] Canonical domain records are displayable and editable on the Web (appointments, cycle, sleep, food log, gym, medications, doses, condition episodes, check-ins, lab results).
- [x] Import hardening (file size, records per domain, string length, depth) and encrypted export with PBKDF2 600k + AES-GCM.
- [x] Parity fixtures: iOS-shaped snapshot round trip, iOS-only field preservation, catalog and localization guards (`npm run test:run`).
- [x] Security headers on both deployment paths (nginx and the Hub-served build), fail-safe Hub detection, service worker excluded from long caching.
- [ ] Hub revision/tombstone replication for canonical domains beyond `Measurement`.
- [ ] Web acceptance run against a real iOS export on device.

- [x] Configurable Home/Salute/Impostazioni navigation and editable Home module arrangements.
- [x] Body map precise points, history filters, selected-marker highlighting and deletion.
- [x] Real 3D body atlas (BodyParts3D via Human Atlas) with pain-point selection, precise `bodyPoint` capture and the redesigned symptom sheet.
- [x] Compact body measurements with inline smart-scale scan, weight goal and detail history.
- [x] Cycle one-tab dashboard, settings and logging flow.
- [x] Heart/respiratory metrics, movement, sleep and HealthKit summaries.
- [x] Medications, recurring visits, condition timelines and linked documents.
- [x] Food diary, recipes, portions, cached food search and barcode path.
- [x] Water/alcohol tracking, vision, allergies, digestive health and sexual health.
- [x] Dental arch, tooth treatment records and brushing quick action.
- [x] Document import, local encrypted attachment storage, share extension and OCR foundation.
- [x] Blood-test OCR review that creates structured analytes, reference ranges and flags only after confirmation.
- [x] Document editor with metadata editing, attachment preview, document classification and optional module context; File remains the cross-module archive.
- [x] Workout correction/manual treadmill session with overlap detection and provenance.
- [x] Unified graph detail flow with aggregation, bounded chart samples, paginated history and record-level deletion for every metric.
- [x] Gym module redesigned around reusable plans, ordered training days, planned exercises and one-tap completion with historical muscle-group summaries.
- [x] The 1,324-exercise metadata catalog remains searchable; the 136 MB third-party thumbnail/GIF library is excluded from the application bundle pending an approved redistribution source.
- [x] Dedicated Gym module artwork; the dashboard no longer reuses the Movement card image.
- [x] Home dashboard module catalog includes Gym, Documents and Bloodwork, with automatic Smart Scale BLE capture.
- [x] Smart Scale capture shows the latest weight and delta from the previous reading.
- [x] Shared `MHDModuleHeader` applied across the main module dashboards for consistent icon, title, subtitle and alignment.
- [x] Main module navigation titles removed where an internal module header is present; headers now have one leading title surface.
- [x] Keychain sync-token update hardened with explicit OSStatus handling and add-or-update semantics.
- [x] Self-hosted sync now separates the bearer credential from the 256-bit end-to-end encryption key and verifies downloaded ciphertext checksums before decryption.
- [x] Shared-document imports are restricted to supported formats, ten files and 50 MB per file; staged plaintext uses complete file protection and is removed after import.
- [x] Repository threat model, five-pass adversarial audit loop and prioritized next-requirements plan written in `docs/`.

## Performance and resilience

- [x] Lazy rendering in the main module and measurement grids.
- [x] Measurement indexes by type and date for large imported histories.
- [x] Debounced asynchronous vault persistence.
- [x] Gym media removed from the target, reducing the uncompressed debug iOS application from roughly 193 MB to 57 MB including both extensions.
- [ ] Release-profile measurements on real Mac Catalyst and iPhone hardware.
- [ ] Narrow observation dependencies in module dashboards.
- [x] Bounded chart samples and adaptive Y domains for continuous series; semantic zero-based activity and consumption charts retain their baseline.
- [ ] Image downsampling and attachment thumbnail cache.
- [ ] Import cancellation, resume and recovery after partial failure.
- [ ] Memory and hang regression checks with synthetic 16,000-record fixtures.
- [ ] Accessibility pass for Dynamic Type, VoiceOver, Reduce Motion and contrast.

## Release gate

- [x] Mac Catalyst debug build and smoke flow.
- [x] Mac Catalyst test build verified; test execution remains blocked by the Xcode `com.apple.linkd.autoShortcut` runner hang documented in the delivery log.
- [x] iOS archive/export and TestFlight upload accepted for build 49.
- [x] TestFlight release notes and migration note for the Gym dataset/media attribution.
- [x] Signed archive, validation and TestFlight upload for build 50; App Store Connect accepted the package and started processing.
