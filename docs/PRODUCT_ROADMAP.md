# MyHealthData product roadmap

## Product direction

MyHealthData should become a local-first health data hub: one app where a person can track symptoms, body points, measurements, documents, sleep, menstrual cycle, recurring visits, medications, condition timelines, and lab results without losing ownership of the data.

The app must organize data and make it portable. It must not diagnose, prescribe, triage, or imply medical advice. When something looks unusual, the product language can suggest consulting a clinician, but it cannot interpret the clinical meaning on its own.

## Core principles

- Local-first by default: data works without an account or server.
- User-owned export: every module must be exportable in a documented format.
- Selective sharing: the user chooses exactly which data enters a package.
- Open-source friendly: no Firebase or closed backend dependency for core features.
- Medical neutrality: display facts, trends, changes, and provenance; avoid diagnosis.
- Progressive disclosure: keep Home clean, open module-specific screens only when needed.

## Home and module model

Home becomes a configurable feature hub. Each feature is a tile with a compact status and a dedicated one-tab-like screen.

Initial feature tiles:

- Body: 3D point symptoms, region history, linked documents.
- Cycle: menstruation, flow, symptoms, fertile-window tracking.
- Sleep: HealthKit import, sleep duration, schedule, notes.
- Visits: recurring medical checks, due dates, completed visits, linked reports.
- Medications: recurring medications, dose text, schedule, user notes.
- Condition timeline: disease, injury, surgery, therapy, or recovery tracking.
- Bloodwork: blood-test values, repeated comparisons, lab-provided ranges.
- Trends: weight, glucose, vitals, symptoms, body measurements over time.
- Backup: ZIP export, private drive backup, self-hosted sync.
- Share for care: selective package for a doctor or external MHD connector.

The first implementation should keep all tiles visible. A later pass should allow users to pin, hide, and reorder tiles.

## Module roadmap

### Phase 1: Foundation

- Feature hub on Home with module tiles.
- Body module remains the strongest current flow: precise 3D point selection and event logging.
- Document vault stores real attachments locally and encrypted.
- Export compliance metadata in the app bundle.
- Product docs for sync, backup, and sharing.
- Dataset fixtures with synthetic data for screenshots and GitHub issues.

### Phase 2: High-value personal tracking

- Cycle module:
  - Period start/end, flow, symptoms, notes.
  - Average cycle length settings.
  - Visual cycle ring and upcoming period estimate.
  - Fertile-window labels as tracking aids, not medical guarantees.
- Sleep module:
  - Import sleep samples from Apple Health.
  - Manual perceived quality.
  - 7/30/90 day charts.
- Visits module:
  - Recurring visit templates.
  - Due date reminders.
  - Completed visit notes and linked documents.
- Medications module:
  - Medication name, text dose, schedule, period, reason.
  - Reminders and adherence notes.
  - No dose recommendations.

### Phase 3: Clinical-history organization

- Condition timeline:
  - Create a named condition/treatment episode.
  - Link events, body points, visits, documents, images, scans, and measurements.
  - Timeline view for before/after surgery or therapy.
- Bloodwork:
  - Structured lab values.
  - Compare values over time.
  - Store lab reference ranges as reported by the document.
  - Highlight changed values without diagnosing.
- Reports:
  - Generate readable HTML/PDF/Markdown summaries.
  - Include provenance, dates, attachments, selected charts, and omissions.

### Phase 4: Portability and ecosystem

- Backup ZIP with data, manifest, CSV exports, JSON, and encrypted attachments.
- Optional private-drive backup via system document picker or WebDAV-compatible destinations.
- Self-hosted sync server with Docker.
- MHD connector protocol for external services.
- Selective care package export:
  - Choose condition timeline, documents, vitals, measurements, and date ranges.
  - Preview before export.
  - Save as ZIP, share by mail, or send to an external connector.

### Phase 5: External interpretation, later

External medical opinions or AI analysis should not be built into core MHD at first. MHD should provide a secure export/connector layer. Third parties can build tools that consume selected packages only after explicit user consent.

## Data model direction

The vault should evolve toward stable entities that can be shared by every module:

- `Observation`: weight, glucose, vitals, symptoms, body measurements, sleep-derived values.
- `BodySite`: normalized anatomical point or region, including 3D coordinates when present.
- `Document` and `DocumentBlob`: metadata, encrypted attachment, OCR text, thumbnails, linked records.
- `Source` and `ImportBatch`: manual entry, OCR, HealthKit, CSV, FHIR, connector, or imported backup.
- `Appointment` and `Reminder`: planned visit, recurrence, local notification, completion notes.
- `MedicationStatement`: medication name, dose text, schedule, period, reason, adherence log.
- `CycleEntry`: cycle day, period start/end, flow, symptoms, notes, user settings.
- `SleepSession`: start/end, stages if imported, subjective quality, device/manual source.
- `ConditionEpisode`: condition, surgery, therapy, recovery path, linked body points and documents.
- `LabPanel` and `LabResult`: reported analyte, value, unit, lab-provided range, report document.
- `SharePackage`, `ShareGrant`, and `AccessLog`: selected export scope, recipient, format, local audit trail.

The MHD vault remains canonical. FHIR, CSV, PDF, Markdown, and selective ZIP packages are export views. Every schema migration needs fixtures, import tests for old versions, and a readable fallback path.

## Module manifest model

Each first-party or future community module should declare:

- `moduleId`, display name, icon, and safety copy.
- Data scopes it can read and write.
- Home tile variants and supported quick actions.
- Routes/screens it owns.
- Export and import mappers.
- Required permissions, such as HealthKit, camera, files, or notifications.
- Privacy notes and medical-safety notes.

This keeps the app open-source friendly without letting modules silently add network access or read unrelated health data.

## Medical-device risk controls

- Avoid words like diagnosis, treatment recommendation, urgent, safe, unsafe, abnormal unless quoting a source document.
- Prefer "changed", "higher than previous", "outside lab-provided range", or "recorded together".
- Never infer causality from co-occurrence.
- Keep clinician-review prompts neutral.
- Store source/provenance for imported values.
- Show the user exactly what data will be shared.

## Open-source readiness

- Keep real health data out of the repository.
- Provide synthetic fixtures.
- Document third-party assets and licenses.
- Add security disclosure policy and issue templates warning users not to upload PHI.
- Keep server optional and self-hostable.

Contribution checklist:

- No real health data in issues, tests, screenshots, or fixtures.
- Privacy boundary described for every new module.
- Medical-safety copy reviewed before merging.
- Schema migration and round-trip export/import tests added.
- Accessibility pass for controls, charts, and color-only status.
- Any network call documented and disabled unless explicitly enabled by the user.
