# Next Requirements Plan

## Product direction
MyHealthData should remain a local-first, modular health journal. Every module must answer three questions quickly: what is happening now, what changed over time, and what can I record with one deliberate action.

## Priority 0: stability and consistency
1. Finish the five-pass audit for every module in `module-adversarial-audit.md`.
2. Add a shared loading/error/empty-state contract and ensure imports never block navigation.
3. Add provenance labels to every imported, BLE-derived, OCR-derived and manually corrected value.
4. Add large-dataset regression fixtures for 16,000+ HealthKit measurements and verify date-range queries change counters and aggregates.
5. Add UI tests for title uniqueness, leading headers, two-column iPhone layout and adaptive iPad/Mac grids.

### Historical notes — build 50

The following entries document an older target boundary. Watch and WidgetKit
were later retired; they are kept here only to preserve the implementation
history.

- Fixed rolling-window titles that rendered Swift interpolation source instead of the selected date range.
- Removed bundled gym GIFs/thumbnails and reduced the debug iOS package to about 57 MB.
- Added checksum-verified sync encryption with a key separate from the bearer token.
- Added protected, bounded share-extension staging and cleanup.
- Added a privacy-preserving WidgetKit projection for five high-value summaries.

### Historical notes — build 51

- Replaced the three-hour stale-step window with an immediate foreground refresh.
- Added an hourly HealthKit observer/background-delivery path for step changes.
- Switched step totals from raw-sample addition to HealthKit cumulative statistics so iPhone and Watch overlaps follow the same aggregate used by Apple Health.
- Added pull-to-refresh and a visible last-update time to the in-app Steps widget.
- Added compact Lock Screen/StandBy variants for the system widgets.

## Priority 1: capture and review
1. Body pain: selecting a history row highlights its exact 3D point; editing and deletion are available from the same detail surface.
2. Body measurements: compact value cards, latest-delta indicators, weight goal dashboard, smart-scale capture and measurement instructions per body site.
3. Smart scale: automatically stop and save a stable reading, store raw diagnostic metadata, distinguish measured weight from estimated composition and pin the chosen device.
4. Documents and bloodwork: import from share sheet, classify on arrival, link each file to an optional health module, run bounded OCR, show source spans/confidence and require confirmation before creating lab values.
5. Gym: keep the current plan/day/completion workflow focused on health history. Add editing/deletion of completed sessions, plan templates and clearer muscle recovery summaries before considering real-time set tracking.

## Priority 2: module depth
1. Nutrition: cached food catalog, barcode/search fallback, recipes with gram-level ingredients, meal categories, macro targets and daily/weekly histograms.
2. Water and alcohol: compact quick actions, custom vessels, daily hydration target, alcohol-unit trend and clear educational context without presenting it as medical advice.
3. Sleep: daily navigation, phase totals, target setting, manual entry with minimal controls and source provenance.
4. Heart and respiration: unified metric catalog, translated labels, compact cards, histogram fallback for one-point series and metric explanations.
5. Movement: histogram-based activity summaries, localized HealthKit labels, manual treadmill correction without double-counting overlapping workouts.
6. Medications, visits, allergies, vision, gut health and dental: one-tap capture, full edit/delete, document attachments and clear history.

## Priority 3: platform and trust
1. Add optional LocalAuthentication before export, sync-token management and sensitive-module access.
2. Add encrypted export and explicit plaintext-export confirmation.
3. Add background HealthKit incremental import with bounded batches and visible last-sync state.
4. Add share-sheet import coverage for PDFs/images and cleanup of materialized preview files.
5. Audit App Store privacy manifests, HealthKit declarations, Bluetooth wording, App Store review readiness and accessibility.

## Open release work after build 50
1. Make active HealthKit queries cancellable and bound complete-history imports into resumable batches.
2. Move HealthKit sample conversion and large cache rebuilds away from the main actor.
3. Add synthetic 16,000-record performance fixtures and measured p95 launch/module/chart budgets.
4. Finish Dynamic Type, VoiceOver and Reduce Motion passes for module cards and native iOS surfaces.
5. Add approved optional exercise media download only after licensing and deletion behavior are documented.

## Implementation loop
For each item: write acceptance criteria, implement the smallest vertical slice, run the five adversarial passes, build Catalyst, inspect logs for regressions, then promote only after the relevant module has a clean exit criterion. Release builds go to TestFlight after the local Catalyst verification.
