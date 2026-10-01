# Roadmap

This roadmap is directional. It should guide sequencing without locking contributors into implementation details before discovery and review.

## v0.1: Local-First MVP

Goal: A useful browser-only personal health record with no backend requirement.

Implemented baseline:

- React + TypeScript + Vite application foundation.
- Dexie / IndexedDB persistence layer with schema versioning.
- Create, read, update, and delete flows for events; create and delete flows for measurements and document metadata.
- Timeline view with filtering by type and body region.
- Interactive body-region logging with Three.js / React Three Fiber.
- Accessible fallback body-region selector.
- JSON export and import for complete local data.
- Client-side encrypted export/import using Web Crypto PBKDF2 + AES-GCM.
- Basic human-readable HTML report for appointments or summaries.
- In-app explanation of local storage and data deletion.
- Typecheck, unit tests, production build checks, and Docker Compose runtime.

## v0.1 Mobile Companion

Implemented baseline:

- Native SwiftUI iOS project under `apps/ios/MyHealthDataiOS`.
- Local encrypted vault using CryptoKit AES-GCM and Keychain.
- Manual event and measurement logging.
- Semantic body region linking.
- Apple Health import for selected measurements.
- MHD JSON export/import compatible with the web schema.
- TestFlight preparation notes.

Release gate:

- A user can run the app locally, create records, refresh the page, recover the records, export them, clear local data, and import the export again.

## v0.2: Data Quality and Portability

Goal: Make local records easier to trust, migrate, and review.

Potential work:

- Stronger validation for record types and units.
- Import conflict handling.
- Schema migration tests.
- CSV and Markdown exports for selected date ranges.
- First pass at FHIR-aligned internal concepts and export mapping.
- Better empty states, error states, and recovery guidance.

## v0.3: Insight Without Diagnosis

Goal: Help users notice patterns without making clinical claims.

Potential work:

- Charts for measurements and symptom severity over time.
- Tag and body-region trend views.
- Appointment preparation summaries.
- Printable or shareable local export bundles.
- Clear language separating personal observations from medical interpretation.

## v0.4: Optional Backup and Sharing Design

Goal: Explore user-controlled portability beyond one browser profile.

Potential work:

- Encrypted local backup package.
- User-managed restore flow.
- Optional file-based sync research.
- Caregiver or clinician sharing threat model.
- Consent and revocation model for any future sharing feature.

No hosted sync or sharing should be implemented until the privacy model, failure modes, and user controls are documented and reviewed.

## Later Possibilities

- Device-generated file imports where the user supplies the file manually.
- FHIR import/export improvements.
- Local-only reminders.
- Internationalization.
- Offline packaging and installability.
- Browser storage health checks and backup reminders.

## Ongoing Project Work

- Maintain privacy and security documentation as architecture changes.
- Keep requirements tied to user stories and testable acceptance criteria.
- Review accessibility before adding visually complex interactions.
- Keep the data model versioned and migration-friendly.
- Preserve a no-backend path even if optional sync features are added later.
