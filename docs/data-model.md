# Data Model

MyHealthData uses an MHD-native data model as the local source of truth. The model is designed for local storage, clear export, and future FHIR mapping, but it is not a FHIR database in v0.1.

The implemented v0.1 schema is intentionally smaller than the long-term model below. The current persisted entities are `LocalProfile`, `HealthEvent`, `Measurement`, and `HealthDocument`, with document attachments stored as metadata only. The broader observation/condition/medication/body-site model is the planned direction for later schema versions.

## Design Principles

- Use stable local IDs generated with `crypto.randomUUID()`.
- Store timestamps as ISO 8601 UTC strings unless a user-entered clinical date intentionally has lower precision.
- Preserve provenance for imported records and manually entered records.
- Keep display labels alongside optional standard codes so the app remains useful without terminology services.
- Store user-entered values as entered when clinically meaningful, plus normalized fields when available.
- Validate all persisted records with Zod.
- Keep attachments separate from document metadata so metadata can be listed without loading large blobs.
- Make export shape explicit and versioned.

## Common Types

```ts
type MhdId = string
type IsoDateTime = string
type IsoDate = string

type MhdCode = {
  system?: string
  code?: string
  display: string
}

type MhdQuantity = {
  value: number
  unit: string
  system?: 'http://unitsofmeasure.org'
  code?: string
}

type MhdPeriod = {
  start?: IsoDate | IsoDateTime
  end?: IsoDate | IsoDateTime
}

type MhdSourceRef = {
  sourceId?: MhdId
  importBatchId?: MhdId
  sourceRecordId?: string
  enteredBy?: 'user' | 'import'
}

type MhdRecordBase = {
  id: MhdId
  profileId: MhdId
  schemaVersion: 1
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  source?: MhdSourceRef
  tags?: string[]
  notes?: string
}
```

IDs are app-local identifiers, not proof of identity. Imported external identifiers should be stored in entity-specific `externalIds` arrays with source metadata rather than replacing MHD IDs.

## Core Entities

### Profile

Represents the local subject of records.

```ts
type MhdProfile = {
  id: MhdId
  schemaVersion: 1
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  displayName?: string
  legalName?: {
    given?: string[]
    family?: string
  }
  birthDate?: IsoDate
  administrativeGender?: 'female' | 'male' | 'other' | 'unknown'
  contact?: {
    email?: string
    phone?: string
  }
  address?: {
    text?: string
    country?: string
    region?: string
    city?: string
    postalCode?: string
  }
}
```

v0.1 should support one active profile. The schema allows multiple profiles later for caregivers or test fixtures, but the UI should not imply multi-person access controls until those exist.

### Observation

Represents measurements, labs, vitals, symptoms, scores, and other observed health facts.

```ts
type MhdObservation = MhdRecordBase & {
  kind: 'vital' | 'lab' | 'symptom' | 'measurement' | 'score' | 'note'
  code: MhdCode
  effectiveAt: IsoDate | IsoDateTime
  value?:
    | { type: 'quantity'; quantity: MhdQuantity }
    | { type: 'coded'; code: MhdCode }
    | { type: 'text'; text: string }
    | { type: 'boolean'; value: boolean }
  interpretation?: MhdCode[]
  referenceRange?: Array<{
    low?: MhdQuantity
    high?: MhdQuantity
    text?: string
  }>
  bodySiteIds?: MhdId[]
  relatedDocumentIds?: MhdId[]
}
```

Examples include blood pressure, cholesterol, glucose, weight, pain score, menstrual cycle notes, sleep duration, and symptom severity.

### Condition

Represents a health condition, diagnosis, problem, allergy-like problem category if modeled later, or user-tracked concern.

```ts
type MhdCondition = MhdRecordBase & {
  name: string
  code?: MhdCode
  clinicalStatus: 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved' | 'unknown'
  verificationStatus?: 'unconfirmed' | 'provisional' | 'differential' | 'confirmed' | 'refuted' | 'entered-in-error'
  severity?: MhdCode
  onset?: IsoDate | IsoDateTime
  abatement?: IsoDate | IsoDateTime
  bodySiteIds?: MhdId[]
  relatedDocumentIds?: MhdId[]
}
```

The app should distinguish user-tracked concerns from clinician-confirmed diagnoses through `verificationStatus` and provenance.

### Medication

Represents a medication statement: what the user reports taking or having taken.

```ts
type MhdMedication = MhdRecordBase & {
  name: string
  code?: MhdCode
  status: 'active' | 'completed' | 'entered-in-error' | 'intended' | 'stopped' | 'on-hold' | 'unknown' | 'not-taken'
  effectivePeriod?: MhdPeriod
  dosageText?: string
  dose?: MhdQuantity
  route?: MhdCode
  frequencyText?: string
  reasonConditionIds?: MhdId[]
  relatedDocumentIds?: MhdId[]
}
```

This is a statement, not a prescription order. A future prescription model should be separate.

### Document

Represents metadata for imported documents, images, PDFs, lab reports, discharge letters, or screenshots. The binary content is stored separately.

```ts
type MhdDocument = MhdRecordBase & {
  title: string
  category?: MhdCode
  type?: MhdCode
  authoredAt?: IsoDate | IsoDateTime
  contentType: string
  fileName?: string
  sizeBytes: number
  sha256: string
  blobId: MhdId
  relatedObservationIds?: MhdId[]
  relatedConditionIds?: MhdId[]
  relatedMedicationIds?: MhdId[]
}

type MhdDocumentBlob = {
  id: MhdId
  profileId: MhdId
  documentId: MhdId
  contentType: string
  bytes: Blob
  sha256: string
  createdAt: IsoDateTime
}
```

The metadata record should load quickly. The blob should load only when the user previews or exports the document.

### Body Site

Represents a semantic body location, optionally with visualization metadata.

```ts
type MhdBodySite = MhdRecordBase & {
  label: string
  code?: MhdCode
  laterality?: 'left' | 'right' | 'bilateral' | 'midline' | 'unknown'
  qualifier?: MhdCode[]
  morphology?: MhdCode
  visualization?: {
    model?: 'default-human-body'
    anchor?: {
      x: number
      y: number
      z: number
    }
    cameraHint?: {
      x: number
      y: number
      z: number
    }
  }
}
```

Visualization anchors are approximate UI hints. The semantic `label`, `code`, `laterality`, and `qualifier` fields are the portable data.

### Source

Represents the origin of records.

```ts
type MhdSource = {
  id: MhdId
  profileId: MhdId
  schemaVersion: 1
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  kind: 'manual-entry' | 'mhd-import' | 'document-import' | 'future-fhir-import'
  label: string
  organization?: string
  uri?: string
}
```

### Import Batch

Represents one import operation and its validation result.

```ts
type MhdImportBatch = {
  id: MhdId
  profileId: MhdId
  schemaVersion: 1
  createdAt: IsoDateTime
  sourceId?: MhdId
  format: 'mhd-json' | 'mhd-encrypted-json' | 'future-fhir'
  fileName?: string
  fileSha256?: string
  acceptedRecordCount: number
  rejectedRecordCount: number
  warnings?: string[]
}
```

## Relationships

| From | To | Relationship |
| --- | --- | --- |
| Observation | Profile | Every observation belongs to one profile |
| Observation | BodySite | Optional body location links |
| Observation | Document | Optional supporting documents |
| Condition | BodySite | Optional affected locations |
| Condition | Document | Optional supporting documents |
| Medication | Condition | Optional reasons or indications |
| Medication | Document | Optional medication list or prescription evidence |
| Document | Observation/Condition/Medication | Optional extracted or related facts |
| Any record | Source | Optional provenance |
| Any imported record | ImportBatch | Optional import operation provenance |

Relationship fields should be checked during writes. Missing related records should not crash reads; they should surface as broken references that can be repaired.

## Dexie Store Sketch

Dexie schema strings should be finalized with implementation tests, but the planned indexes are:

```ts
db.version(1).stores({
  profiles: '&id, updatedAt',
  observations: '&id, profileId, kind, effectiveAt, updatedAt, [profileId+effectiveAt], [profileId+kind]',
  conditions: '&id, profileId, clinicalStatus, onset, updatedAt, [profileId+clinicalStatus]',
  medications: '&id, profileId, status, updatedAt, [profileId+status]',
  documents: '&id, profileId, authoredAt, contentType, sha256, updatedAt, [profileId+authoredAt]',
  documentBlobs: '&id, profileId, documentId, sha256',
  bodySites: '&id, profileId, updatedAt, [profileId+label]',
  sources: '&id, profileId, kind, updatedAt',
  importBatches: '&id, profileId, createdAt, format'
})
```

Do not index large note fields, document text, blobs, or arbitrary imported payloads.

## MHD Export Shape

Plaintext MHD export is UTF-8 JSON:

```json
{
  "mhdExportVersion": "0.1.0",
  "schemaVersion": 1,
  "createdAt": "2026-07-05T12:00:00.000Z",
  "app": {
    "name": "MyHealthData",
    "version": "0.1.0"
  },
  "profile": {
    "id": "profile-uuid",
    "schemaVersion": 1,
    "createdAt": "2026-07-05T12:00:00.000Z",
    "updatedAt": "2026-07-05T12:00:00.000Z",
    "displayName": "Local Profile"
  },
  "records": {
    "bodySites": [],
    "observations": [],
    "conditions": [],
    "medications": [],
    "documents": [],
    "sources": [],
    "importBatches": []
  },
  "attachments": [
    {
      "blobId": "blob-uuid",
      "documentId": "document-uuid",
      "contentType": "application/pdf",
      "fileName": "report.pdf",
      "sizeBytes": 12345,
      "sha256": "base64url-or-hex-sha256",
      "data": "base64url-encoded-bytes"
    }
  ]
}
```

Rules:

- `mhdExportVersion` versions the export envelope.
- `schemaVersion` versions the record schemas.
- Attachments are optional and may be omitted by user choice.
- Attachment `sha256` must hash the decoded bytes.
- Export must not include transient UI state, Dexie indexes, browser metadata, or secrets.
- Export may include provenance metadata because it helps users understand source and trust.

## Encrypted MHD Export Wrapper

Future encrypted export wraps the plaintext JSON payload:

```json
{
  "mhdEncryptedExportVersion": "0.1.0",
  "contentType": "application/vnd.myhealthdata.export+json",
  "createdAt": "2026-07-05T12:00:00.000Z",
  "kdf": {
    "name": "PBKDF2",
    "hash": "SHA-256",
    "iterations": 600000,
    "salt": "base64url-random-salt"
  },
  "cipher": {
    "name": "AES-GCM",
    "iv": "base64url-random-96-bit-iv",
    "tagLength": 128
  },
  "ciphertext": "base64url-webcrypto-ciphertext-with-tag"
}
```

The decrypted bytes must be exactly the plaintext MHD export JSON. Web Crypto AES-GCM appends the authentication tag to the ciphertext bytes.

## Import Rules

- Reject unsupported major export versions.
- Validate the envelope before reading records.
- Validate every record with its Zod schema.
- Verify attachment hashes before committing attachment blobs.
- Detect duplicate IDs and present a merge plan.
- Preserve original IDs when safe; remap IDs on conflict.
- Preserve provenance for imports.
- Commit accepted imports in a Dexie transaction.
- Report rejected records with reasons.

## Coding and Units

Standard codes are optional in v0.1 but should be preserved when available.

| Domain | Preferred future system | Notes |
| --- | --- | --- |
| Lab and vital observation codes | LOINC | Store display text even when no code is known |
| Clinical conditions | SNOMED CT or ICD where imported | Licensing and jurisdiction rules apply |
| Medications | RxNorm or local drug dictionaries | Preserve user-entered display |
| Units | UCUM | Store original display unit and normalized UCUM code when possible |
| Body sites | SNOMED CT body structure codes | Visualization anchors are not terminology codes |

Do not auto-code user-entered health facts unless the app clearly explains the source and confidence of the code.

## Migration Policy

- Database migrations move from one schema version to the next without skipping validation.
- Record `schemaVersion` values allow per-record migration when needed.
- Exporters should write the newest supported schema version.
- Importers may support older versions through explicit migrations.
- Unknown newer versions should fail with a clear message rather than silently dropping fields.
