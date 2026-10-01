# Privacy and Security

MyHealthData handles sensitive personal health data. v0.1 is designed as a local-first app with no backend, no account system, and no telemetry. This reduces exposure but does not make the app immune to local device compromise, browser compromise, unsafe exports, or incorrect sharing.

## Privacy Posture

- Health records remain in the user's browser profile by default.
- The app does not need a server to store, process, or view records.
- v0.1 should not send health data to analytics, logging, crash reporting, AI services, remote asset services, or third-party APIs.
- User-initiated export is the primary way data leaves the app.
- Encrypted export protects exported files, not the live in-browser database.

## Sensitive Data Classes

Treat all application data as sensitive, including metadata.

| Data | Examples | Risk |
| --- | --- | --- |
| Identity | Name, date of birth, contact details | Direct identification |
| Health observations | Lab values, symptoms, vitals, body measurements | Clinical inference |
| Conditions | Diagnoses, status, onset dates | Stigma, insurance, employment risk |
| Medications | Prescriptions, supplements, dosage | Condition inference and safety risk |
| Documents | PDFs, images, discharge notes, referrals | High-density personal data |
| Body sites | Anatomical locations, images, 3D anchors | Condition and injury inference |
| Provenance | Source names, file names, import timestamps | Care history inference |
| Export metadata | App version, export time, schema version | Correlation risk |

## Threat Model

### Assets

- IndexedDB health records and document blobs.
- MHD export files.
- Encrypted export passphrases during active use.
- Generated FHIR bundles.
- Application code and dependencies.
- User trust in what has or has not left the device.

### Trust Boundaries

- Browser origin boundary around the app.
- IndexedDB storage boundary inside the browser profile.
- File import boundary for user-selected files.
- File export boundary for downloaded or saved files.
- Dependency boundary for all npm packages.
- Future FHIR boundary for generated interoperability payloads.

### Attacker Capabilities Considered

- Malicious imported MHD or FHIR-like files.
- Cross-site scripting introduced by app code or dependencies.
- Compromised npm dependency or build-time supply chain.
- Browser extension with broad page or storage access.
- Another person using the same unlocked OS account.
- Malware or forensic access on the local device.
- Accidental disclosure through backups, screenshots, screen sharing, or exported files.

### Out of Scope for v0.1 Controls

- Fully compromised operating system.
- Compromised browser binary.
- Malicious browser extensions with permission to inspect pages or storage.
- Physical access to an unlocked user session.
- Legal compulsion or cloud backup provider access outside app control.
- Clinical correctness of user-entered records.

## Threats and Controls

| Threat | Impact | v0.1 control |
| --- | --- | --- |
| Silent network exfiltration | Health data leaves device unexpectedly | No backend, no telemetry, avoid remote assets, review network use |
| XSS | Read or modify all local health data | Escape rendered content, avoid unsafe HTML, strict CSP, validate imports |
| Malicious import | Corrupt data or trigger parser bugs | File size limits, Zod validation, safe parsers, transaction rollback |
| Export mishandling | User shares plaintext health file | Clear export labeling, optional encrypted export, no automatic upload |
| Weak export password | Offline brute force of encrypted export | PBKDF2 with random salt and high iteration count, password warnings |
| IndexedDB exposure | Local user or extension reads records | Disclose browser-profile risk, no secrets in localStorage |
| Dependency compromise | Runtime access to health data | Narrow dependency set, lockfile review, update discipline |
| Data corruption | Record loss or unsafe merge | Versioned migrations, import previews, attachment hash checks |
| FHIR overclaiming | Recipients trust invalid clinical data | Do not claim conformance until validator-backed |
| Re-identification | De-identified exports remain linkable | Avoid de-identification claims in v0.1 |

## Privacy Limits

Local-first is not the same as anonymous or encrypted-at-rest.

- IndexedDB data is usually stored unencrypted by the browser. Device disk encryption and OS account controls matter.
- Browser sync, Time Machine, cloud backup, endpoint management, or profile backup tools may copy IndexedDB data.
- Browser extensions may read page content or storage depending on permissions.
- Anyone with access to the unlocked OS account may open the app.
- Exported plaintext JSON and generated FHIR bundles are sensitive files.
- File names, document titles, and timestamps can reveal health information even without document contents.
- Screenshots, screen sharing, and browser history can reveal app content.
- Deleting records through the app removes app-managed IndexedDB entries, but the browser or filesystem may retain remnants outside app control.
- The app does not provide medical advice, diagnosis, treatment recommendations, or emergency support.

## Security Requirements

### Network

- The app must function with network disabled after initial load.
- Do not add analytics, crash reporting, remote logging, heatmaps, session replay, or external health APIs in v0.1.
- Do not fetch remote images, fonts, model files, or scripts from app views that display health data.
- If a dev server is used, it is for local development only and must not be documented as a production data host.

### Rendering

- Do not render imported text with `dangerouslySetInnerHTML`.
- Treat document names, source names, notes, tags, and coded displays as untrusted strings.
- Use normal React text rendering or explicit sanitization for any future rich text.
- Keep 3D labels and overlays escaped the same way as regular UI text.

### Validation

- Validate every write path with Zod.
- Validate database records after read, especially across migrations.
- Reject unknown enum values unless a forward-compatible `unknown` bucket is explicitly modeled.
- Bound free-text lengths and attachment sizes.
- Validate dates as ISO 8601 strings with documented precision rules.

### Storage

- Store health records and document blobs in IndexedDB through Dexie.
- Do not store health records, passphrases, encryption keys, or document contents in `localStorage`, `sessionStorage`, URL query parameters, or logs.
- Keep non-sensitive UI preferences separate from health records.
- Use hard delete for user-requested deletion in v0.1 unless an explicit trash feature is added.

### Export Encryption Plan

Encrypted export uses Web Crypto only:

- Generate a random salt per encrypted export.
- Derive an AES-GCM key from the user passphrase with PBKDF2 and SHA-256.
- Use a random 96-bit AES-GCM IV per encryption.
- Authenticate stable envelope metadata as additional authenticated data where practical.
- Store KDF name, hash, iteration count, salt, IV, tag length, and format version in the wrapper.
- Never store the passphrase or derived key.
- Fail import if authentication fails.

PBKDF2 is not memory-hard. It is selected because it is available in Web Crypto across modern browsers. A future Argon2 option should require a vetted dependency and a separate supply-chain review.

### Integrity

- Include SHA-256 hashes for exported attachments.
- Verify attachment hashes during import before committing records.
- Prefer transactional imports so partial failures do not leave half-imported records.
- Record import batch metadata so users can later see where records came from.

### Dependency Hygiene

- Keep dependency count low.
- Prefer maintained libraries with narrow scopes.
- Avoid packages that execute remote code, bundle telemetry, or parse large untrusted formats unnecessarily.
- Run dependency review before adding health-data-adjacent libraries.

### Content Security Policy

A future production build should use a restrictive CSP. The target policy should start from:

```http
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' blob: data:;
font-src 'self';
connect-src 'self';
worker-src 'self';
object-src 'none';
base-uri 'none';
form-action 'none';
frame-ancestors 'none';
```

Development may require relaxed settings for Vite HMR. Production should not.

## Secure UX Requirements

- Plaintext export labels must be explicit.
- Encrypted export should explain that losing the passphrase means losing access to that export.
- Import should show the source, record count, attachment count, and conflicts before commit.
- Delete flows should distinguish deleting app data from deleting already exported files.
- Any future network feature must be opt-in and explain what data leaves the device.
- FHIR export should warn that generated bundles may contain identifying information even if the user omits profile details.

## Compliance Position

MyHealthData v0.1 should not claim regulatory compliance by default. A local-only open-source app can support privacy-conscious use, but compliance depends on deployment context, user role, jurisdiction, operational controls, notices, contracts, device management, retention policies, auditability, and breach procedures.

The project should avoid language that implies the app is a certified medical device, an EHR, a HIPAA-compliant service, or a substitute for professional medical care.

## Release Checklist

- No intentional network calls from health-data views.
- No telemetry or crash reporting package.
- No imported text rendered as HTML.
- Zod validation covers all persisted entities and export envelopes.
- IndexedDB migration path tested from previous schema version.
- Export and import round trip tested with representative records.
- Attachment hash verification tested.
- Deletion removes records and document blobs from app-managed stores.
- Privacy limits are visible in user-facing documentation.
