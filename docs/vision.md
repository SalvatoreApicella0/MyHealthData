# Vision

MyHealthData exists to help people keep a private, understandable record of their health over time. Personal health information is often scattered across portals, PDFs, device apps, notes, spreadsheets, and memory. That fragmentation makes it harder to prepare for appointments, notice patterns, explain symptoms, or preserve context when changing clinicians.

The project aims to provide a local-first web app where users can collect and review their own health observations without creating an account or sending data to a hosted service.

## Product Direction

The v0.1 product is a browser-only health journal and record keeper. It should let a user add structured entries, view them on a timeline, attach notes, and connect observations to body areas through an interactive body model.

The expected technical foundation is:

- React + TypeScript + Vite for the application.
- IndexedDB for local browser storage.
- Three.js and React Three Fiber for the interactive body model.
- No backend service required for the first release.

Future versions may add optional encrypted backup, controlled sharing, and richer imports. Those features must preserve user agency and avoid turning the project into a hosted health data platform by default.

## Design Principles

Local-first: The app must be useful on one device with no account, network connection, or hosted database.

Privacy-first: The app must minimize data exposure, avoid analytics by default, and make export or sharing explicit user actions.

Interoperable: User data should not be trapped. The project should move toward documented exports and compatibility with health data standards such as FHIR where practical.

Understandable: Health records should be readable by regular people. Clinical terminology can be supported, but the main workflows should not require clinical training.

Accessible: The app should support keyboard navigation, screen readers, sufficient contrast, readable typography, and reduced-motion preferences.

Honest about limits: The app should not diagnose, triage, prescribe, or imply clinical certainty where it does not exist.

## Intended Users

- People tracking symptoms, conditions, medications, measurements, appointments, or test results for themselves.
- Caregivers helping a family member organize health information.
- Patients preparing concise timelines or exports for clinical visits.
- Open-source contributors working on private-by-default personal data tools.

## Non-Goals for v0.1

- No hosted backend, user accounts, or cloud database.
- No clinician portal.
- No emergency workflow.
- No diagnosis, treatment recommendation, or medication advice.
- No automatic ingestion from device clouds or patient portals.
- No sale, brokerage, or monetization of health data.

## Privacy Boundary

For v0.1, the trust boundary is the user's browser profile and device. Data in IndexedDB is only as protected as the user's device, browser profile, backups, and operating system account. The project should document this clearly and avoid overstating local storage security.

Optional sync, backup, sharing, or AI features must be treated as major changes because they alter the privacy boundary.

## Medical Disclaimer

MyHealthData is for personal organization only. It is not a medical device, diagnostic system, electronic health record, or substitute for professional medical advice. Users should consult qualified health professionals for diagnosis, treatment, medication decisions, and interpretation of clinical results. The app must not be used for emergencies.
