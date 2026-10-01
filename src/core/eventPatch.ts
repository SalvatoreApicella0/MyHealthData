import { createId } from './id'
import type { AttachmentMetadata, BodyPoint, BodyRegionId, EventType, HealthEvent } from './types'

export interface EventFormValues {
  type: EventType
  bodyRegionId?: BodyRegionId
  occurredAt: string
  intensity?: number
  durationMinutes?: number
  description: string
  suspectedTrigger?: string
  helpedBy?: string
  tags: string[]
  attachments: AttachmentMetadata[]
}

export function applyEventValues(
  event: HealthEvent | undefined,
  values: EventFormValues,
  bodyPoint: BodyPoint | undefined,
  now: string,
): HealthEvent {
  return {
    ...(event ?? {}),
    id: event?.id ?? createId('event'),
    type: values.type,
    bodyRegionId: values.bodyRegionId,
    bodyPoint: bodyPoint ?? event?.bodyPoint,
    occurredAt: values.occurredAt,
    intensity: values.intensity,
    durationMinutes: values.durationMinutes,
    description: values.description,
    suspectedTrigger: values.suspectedTrigger,
    helpedBy: values.helpedBy,
    tags: values.tags,
    attachments: values.attachments,
    createdAt: event?.createdAt ?? now,
    updatedAt: now,
  }
}
