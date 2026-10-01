import { labelForBodyRegion, labelForEventType, labelForMeasurementType } from '../core/format'
import type { HealthDataSnapshot, HealthDocument, HealthEvent, LocalProfile, Measurement } from '../core/types'

export type DraftFhirResource = Record<string, unknown>

export function mapProfileToFhirPatient(profile?: LocalProfile): DraftFhirResource {
  return {
    resourceType: 'Patient',
    id: 'myhealthdata-local-profile',
    meta: {
      source: 'MyHealthData local profile',
      profile: ['draft-mapping-only'],
    },
    name: profile?.alias ? [{ text: profile.alias }] : undefined,
    birthDate: profile?.birthDate,
    gender: profile?.biologicalSex === 'unspecified' ? 'unknown' : profile?.biologicalSex,
  }
}

export function mapMeasurementToFhirObservation(measurement: Measurement): DraftFhirResource {
  return {
    resourceType: 'Observation',
    id: measurement.id,
    status: 'final',
    code: {
      text: labelForMeasurementType(measurement.type),
    },
    effectiveDateTime: measurement.measuredAt,
    valueQuantity: {
      value: measurement.value,
      unit: measurement.unit,
    },
    note: measurement.note ? [{ text: measurement.note }] : undefined,
  }
}

export function mapEventToFhirCondition(event: HealthEvent): DraftFhirResource {
  return {
    resourceType: 'Condition',
    id: event.id,
    clinicalStatus: {
      text: 'user-recorded',
    },
    code: {
      text: labelForEventType(event.type),
    },
    bodySite: event.bodyRegionId
      ? [
          {
            text: labelForBodyRegion(event.bodyRegionId),
          },
        ]
      : undefined,
    onsetDateTime: event.occurredAt,
    note: [
      {
        text: event.description,
      },
    ],
  }
}

export function mapDocumentToFhirDocumentReference(document: HealthDocument): DraftFhirResource {
  return {
    resourceType: 'DocumentReference',
    id: document.id,
    status: 'current',
    type: {
      text: document.documentType,
    },
    date: document.documentDate,
    description: document.description,
    content: document.attachment
      ? [
          {
            attachment: {
              title: document.attachment.name,
              contentType: document.attachment.type,
              size: document.attachment.size,
            },
          },
        ]
      : [],
  }
}

export function createDraftFhirBundle(snapshot: HealthDataSnapshot): DraftFhirResource {
  const resources: DraftFhirResource[] = [
    mapProfileToFhirPatient(snapshot.profile),
    ...snapshot.events.map(mapEventToFhirCondition),
    ...snapshot.measurements.map(mapMeasurementToFhirObservation),
    ...snapshot.documents.map(mapDocumentToFhirDocumentReference),
  ]

  return {
    resourceType: 'Bundle',
    type: 'collection',
    meta: {
      source: 'MyHealthData v0.1 draft FHIR mapping',
    },
    entry: resources.map((resource) => ({ resource })),
  }
}
