# Requirements

This document describes the target requirements for the v0.1 release of MyHealthData. It is intentionally product-focused and should evolve as implementation details become clearer.

## MVP Scope

The v0.1 release provides a local-first personal health record that works entirely in the browser. A user can create, view, edit, delete, filter, import, and export their own health entries without signing in or connecting to a backend.

## User Stories

### Local Personal Record

- As a user, I can create a local health profile so my entries are organized around me.
- As a user, I can add dated entries for symptoms, measurements, medications, appointments, notes, and lab-like observations.
- As a user, I can edit or delete entries when I make a mistake.
- As a user, I can view entries in reverse chronological order and filter by type, tag, date range, or body area.
- As a user, I can filter my local records by type and body area so I can find prior notes quickly.

Acceptance criteria:

- Records persist across page refreshes through IndexedDB.
- The app remains functional without a network connection after assets are loaded.
- Destructive actions require a clear confirmation or undo path.

### Body Model

- As a user, I can select a body region on an interactive model when logging a symptom or observation.
- As a user, I can review entries associated with a selected body region.
- As a keyboard or screen reader user, I can access body-region selection through non-3D controls.

Acceptance criteria:

- The body model is implemented with Three.js / React Three Fiber or an equivalent React-compatible Three.js layer.
- Body-region data is stored as structured identifiers, not just free text.
- A fallback list or form control exists for accessibility and devices where 3D rendering is unavailable.

### Privacy and Control

- As a user, I can use the app without creating an account.
- As a user, I can understand where my data is stored.
- As a user, I can export my data before clearing browser storage or changing devices.
- As a user, I can delete all locally stored app data from inside the app.

Acceptance criteria:

- v0.1 does not require a backend, remote database, telemetry service, or third-party analytics.
- Any future network request must be visible in code review and documented.
- Export and delete actions are explicit and user initiated.

### Import and Export

- As a user, I can export a complete copy of my data as JSON.
- As a user, I can import a previously exported MyHealthData JSON file.
- As a user, I can generate a simple human-readable HTML report for appointments.

Acceptance criteria:

- JSON exports include a schema version.
- Imports validate shape and version before changing local data.
- Import errors explain what failed without exposing private data to a remote service.

### Quality and Accessibility

- As a user, I can navigate the core app with a keyboard.
- As a user, I can use the app at common mobile and desktop widths.
- As a user, I can read the interface with sufficient contrast and without tiny text.
- As a contributor, I can run lint and build checks locally.

Acceptance criteria:

- `npm run lint` completes successfully through TypeScript checks.
- `npm run test:run` completes successfully.
- `npm run build` completes successfully.
- Core forms have labels, validation messages, and sensible focus behavior.

## Data Categories for v0.1

The app should support a small set of structured record types before expanding:

- Health event: date/time, type, body region, intensity, duration, description, trigger, what helped, tags, attachment metadata.
- Measurement: date/time, kind, value, unit, notes.
- Document metadata: title, type, date, description, linked event, body region, attachment metadata.
- Local profile: optional alias, birth date, sex, gender, height, weight, notes, allergies, medications, known conditions.

## Non-Functional Requirements

Privacy: The default build must not send health data to a backend or analytics service.

Portability: User-created data must be exportable in a documented format.

Reliability: IndexedDB read/write failures should produce clear recovery guidance.

Performance: The timeline, forms, and body model should remain responsive with thousands of local entries.

Accessibility: Core workflows must not depend solely on pointer interaction, color, animation, or 3D rendering.

Maintainability: Data access, validation, and UI rendering should be separated enough that schema migrations and import/export can be tested.

## Out of Scope for v0.1

- Cloud sync or hosted accounts.
- Sharing with clinicians or caregivers.
- FHIR server integration.
- Automatic patient portal import.
- Device cloud integrations.
- AI diagnosis, triage, or treatment suggestions.
- Emergency or acute-care workflows.

## Medical Safety Requirements

- The app must include a medical disclaimer in user-facing documentation.
- The app must not claim to diagnose, treat, prevent, or cure disease.
- The app must not recommend medication changes.
- Units, timestamps, and imported values should be displayed carefully to reduce misinterpretation.
- Any clinical code mappings should be presented as data organization aids, not medical interpretation.
