# FHIR Mapping

MyHealthData v0.1 keeps MHD JSON as the canonical local and export model. FHIR support is a future interoperability layer that maps validated MHD records to HL7 FHIR resources.

As of 2026-07-05, this document targets FHIR R4 v4.0.1 and the current published International Patient Summary Implementation Guide v2.0.1, which is based on FHIR R4.

Reference pages:

- [FHIR R4 Patient](https://hl7.org/fhir/R4/patient.html)
- [FHIR R4 Observation](https://hl7.org/fhir/R4/observation.html)
- [FHIR R4 Condition](https://hl7.org/fhir/R4/condition.html)
- [FHIR R4 MedicationStatement](https://hl7.org/fhir/R4/medicationstatement.html)
- [FHIR R4 DocumentReference](https://hl7.org/fhir/R4/documentreference.html)
- [FHIR R4 BodyStructure](https://hl7.org/fhir/R4/bodystructure.html)
- [FHIR R4 Bundle](https://hl7.org/fhir/R4/bundle.html)
- [International Patient Summary IG](https://hl7.org/fhir/uv/ips/)

## Mapping Principles

- Do not store FHIR as the internal source of truth in v0.1.
- Generate FHIR from validated MHD records at export time.
- Do not claim FHIR or IPS conformance until generated bundles pass validator checks.
- Preserve MHD IDs in deterministic FHIR IDs or identifiers where possible.
- Prefer standard code systems when known, but keep user-entered display text.
- Use FHIR extensions only for data that cannot be represented safely in core R4 fields.
- Keep lossy mappings explicit in export warnings.
- Do not include records the user did not select for export.

## Resource Coverage

| MHD entity | FHIR R4 target | Status |
| --- | --- | --- |
| Profile | Patient | Future export |
| Observation | Observation | Future export |
| Condition | Condition | Future export |
| Medication | MedicationStatement | Future export |
| Document | DocumentReference | Future export |
| BodySite | BodyStructure plus coded bodySite fields | Future export |
| MHD export set | Bundle | Future export |
| MHD summary export | IPS document Bundle | Future export |

IPS export will also require a generated FHIR Composition resource even though Composition is not a stored MHD entity.

## Identifiers

FHIR resource IDs have stricter formatting than arbitrary app IDs. The exporter should:

- Generate stable FHIR-safe IDs from MHD IDs.
- Use `Bundle.entry.fullUrl` values with `urn:uuid:` where practical.
- Preserve external identifiers imported from source systems in `identifier`.
- Avoid inventing globally authoritative identifiers for user-entered data.

Proposed local identifier system until the project has a canonical domain policy:

```text
urn:myhealthdata:local
```

For example, an MHD observation ID can map to:

```json
{
  "identifier": [
    {
      "system": "urn:myhealthdata:local",
      "value": "observation-local-id"
    }
  ]
}
```

## Patient

MHD `Profile` maps to FHIR `Patient`.

| MHD field | FHIR field | Notes |
| --- | --- | --- |
| `id` | `Patient.id`, `Patient.identifier` | FHIR-safe generated ID plus local identifier |
| `legalName` | `Patient.name` | Use `official` when known |
| `displayName` | `Patient.name.text` | Use when structured name is absent |
| `birthDate` | `Patient.birthDate` | Preserve date precision |
| `administrativeGender` | `Patient.gender` | Values align with FHIR administrative gender set |
| `contact.email`, `contact.phone` | `Patient.telecom` | Include only by user choice |
| `address` | `Patient.address` | Include only by user choice |

Default privacy behavior should let the user export a minimally identified patient or omit optional identifying fields.

## Observation

MHD `Observation` maps to FHIR `Observation`.

| MHD field | FHIR field | Notes |
| --- | --- | --- |
| `id` | `Observation.id`, `identifier` | Preserve local ID |
| `profileId` | `Observation.subject` | Reference generated Patient |
| `kind` | `Observation.category` | Map vital, lab, symptom, measurement, score |
| `code` | `Observation.code` | Use LOINC or other known coding when present |
| `effectiveAt` | `Observation.effectiveDateTime` or `effectivePeriod` | Preserve date precision |
| quantity value | `Observation.valueQuantity` | Prefer UCUM units |
| coded value | `Observation.valueCodeableConcept` | Use coding if known |
| text value | `Observation.valueString` | Use for narrative measurements |
| boolean value | `Observation.valueBoolean` | Use for true or false findings |
| `interpretation` | `Observation.interpretation` | High, low, abnormal, etc. |
| `referenceRange` | `Observation.referenceRange` | Preserve text when ranges are not computable |
| `bodySiteIds` | `Observation.bodySite` plus extension | R4 `bodySite` is a CodeableConcept, not a BodyStructure reference |
| `relatedDocumentIds` | `Observation.derivedFrom` | Reference DocumentReference when source report exists |

For body locations, prefer mapping the semantic body-site code to `Observation.bodySite`. If a separate MHD BodySite carries visualization anchors or richer location detail, export it as BodyStructure and use an MHD-defined extension to link the Observation to that BodyStructure.

## Condition

MHD `Condition` maps to FHIR `Condition`.

| MHD field | FHIR field | Notes |
| --- | --- | --- |
| `id` | `Condition.id`, `identifier` | Preserve local ID |
| `profileId` | `Condition.subject` | Reference Patient |
| `name`, `code` | `Condition.code` | Use SNOMED CT, ICD, or display text when available |
| `clinicalStatus` | `Condition.clinicalStatus` | Map to FHIR condition clinical status coding |
| `verificationStatus` | `Condition.verificationStatus` | Important for user-entered vs confirmed records |
| `severity` | `Condition.severity` | Optional |
| `onset` | `Condition.onsetDateTime` or `onsetPeriod` | Preserve date precision |
| `abatement` | `Condition.abatementDateTime` or `abatementPeriod` | For resolved or inactive conditions |
| `bodySiteIds` | `Condition.bodySite` | Use semantic codes and display text |
| `relatedDocumentIds` | `Condition.evidence.detail` | Reference supporting DocumentReference |

If the user records a concern without clinical confirmation, export `verificationStatus` as unconfirmed or provisional rather than implying a confirmed diagnosis.

## MedicationStatement

MHD `Medication` maps to FHIR `MedicationStatement`.

| MHD field | FHIR field | Notes |
| --- | --- | --- |
| `id` | `MedicationStatement.id`, `identifier` | Preserve local ID |
| `profileId` | `MedicationStatement.subject` | Reference Patient |
| `name`, `code` | `medicationCodeableConcept` | Use RxNorm or source coding when available |
| `status` | `MedicationStatement.status` | Map to FHIR status values |
| `effectivePeriod` | `MedicationStatement.effectivePeriod` | Start and stop dates |
| `dosageText` | `MedicationStatement.dosage.text` | Preserve user-entered instructions |
| `dose` | `MedicationStatement.dosage.doseAndRate.doseQuantity` | When a structured dose exists |
| `route` | `MedicationStatement.dosage.route` | Optional route coding |
| `frequencyText` | `MedicationStatement.dosage.timing.code.text` | Use text until structured timing exists |
| `reasonConditionIds` | `MedicationStatement.reasonReference` | Reference Condition |
| `relatedDocumentIds` | `MedicationStatement.derivedFrom` | Reference medication list or source document |

MedicationStatement records what the user says was taken. It is not a MedicationRequest prescription order.

## DocumentReference

MHD `Document` maps to FHIR `DocumentReference`.

| MHD field | FHIR field | Notes |
| --- | --- | --- |
| `id` | `DocumentReference.id`, `identifier` | Preserve local ID |
| `profileId` | `DocumentReference.subject` | Reference Patient |
| `title` | `DocumentReference.description` and `content.attachment.title` | Keep user-visible title |
| `category` | `DocumentReference.category` | Lab report, imaging, note, etc. |
| `type` | `DocumentReference.type` | More specific document type |
| `authoredAt` | `DocumentReference.date` or `context.period` | Use source-authored date where known |
| `contentType` | `content.attachment.contentType` | MIME type |
| `fileName` | `content.attachment.title` | Avoid leaking path information |
| `sizeBytes` | `content.attachment.size` | Optional |
| `sha256` | `content.attachment.hash` | FHIR hash is base64Binary |
| attachment bytes | `content.attachment.data` | Only for user-selected bundled export |

For large files, a future FHIR package may use Binary resources and `attachment.url`. In v0.1 planning, MHD Export remains the preferred way to carry attachments because it can package metadata, hashes, and bytes directly.

## BodyStructure

MHD `BodySite` maps to FHIR `BodyStructure` when the body location needs to stand alone.

| MHD field | FHIR field | Notes |
| --- | --- | --- |
| `id` | `BodyStructure.id`, `identifier` | Preserve local ID |
| `profileId` | `BodyStructure.patient` | R4 uses `patient` |
| `label`, `code` | `BodyStructure.location` | Semantic body location |
| `laterality`, `qualifier` | `BodyStructure.locationQualifier` | Left, right, bilateral, etc. |
| `morphology` | `BodyStructure.morphology` | Optional abnormality or lesion type |
| visualization anchor | extension | Not a standard R4 field |

FHIR BodyStructure is useful for richer anatomy references, but many Observation and Condition mappings can use their native `bodySite` CodeableConcept without creating a BodyStructure.

## Bundle

FHIR export should use Bundle differently depending on purpose.

| Export purpose | Bundle type | Notes |
| --- | --- | --- |
| General selected records | `collection` | Simple package of resources |
| IPS document | `document` | First entry must be Composition |
| Future server upload | `transaction` | Not v0.1; requires server semantics |

Every bundled resource should have a stable `fullUrl`. Internal references should use those full URLs or generated resource IDs consistently.

## IPS Future Mapping

An IPS export is a summarized clinical document, not a raw database dump. For a future IPS export:

- Generate a FHIR `Bundle` with `type: "document"`.
- Generate a `Composition` as the first entry.
- Include one `Patient`.
- Include selected `Condition` records in the problem list section.
- Include selected `MedicationStatement` records in the medications section.
- Include selected `Observation` records in results, vital signs, or other appropriate sections.
- Include selected `DocumentReference` records only when they support the summary and the user chooses to include them.
- Include `BodyStructure` only when needed to preserve body location detail.
- Validate against the IPS Implementation Guide before claiming IPS conformance.

MHD should not automatically include every local record in an IPS export. The user should be able to review summary scope because IPS is intended to communicate essential health information.

## Code Systems

| Data | Preferred coding | Fallback |
| --- | --- | --- |
| Observations | LOINC | Text display |
| Units | UCUM | Original unit text |
| Conditions | SNOMED CT or ICD from source | Text display |
| Medications | RxNorm or source medication coding | Text display |
| Body sites | SNOMED CT body structure codes | Text display plus laterality |
| Documents | LOINC document type codes where known | Text display |

Terminology licensing varies by jurisdiction and code system. The app should preserve imported codes but avoid bundling restricted terminology datasets without review.

## Validation Plan

Before enabling FHIR export in the UI:

1. Add mapper unit tests for each resource type.
2. Add fixture exports for common user scenarios.
3. Validate generated JSON against FHIR R4 resource schemas.
4. Validate IPS bundles with an HL7 FHIR validator configured for the IPS package.
5. Document known lossy fields in the export UI.
6. Keep MHD export available as the full-fidelity format.

## Known Gaps

- No FHIR import behavior is specified yet.
- No canonical project URL exists for globally meaningful identifiers.
- Observation body structure references require an extension in R4 when a direct BodyStructure relationship must be preserved.
- IPS requires generated Composition sections not currently represented in the MHD model.
- Attachment strategy must balance bundle size, privacy, and recipient compatibility.
- Terminology normalization requires code-system-specific review.
