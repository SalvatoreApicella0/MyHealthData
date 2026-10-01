const SAFE_HEALTH_DATA_ERRORS = new Set([
  'attachment_hash_mismatch',
  'attachment_missing_locally',
  'attachment_size_mismatch',
  'conflict',
  'hub_request_failed',
  'hub_partial_sync_failed',
  'hub_unavailable',
  'record_not_found',
  'record_not_owned',
])

/** Keep UI errors low-cardinality and free of filenames, URLs and PHI. */
export function healthDataErrorCode(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : ''
  return SAFE_HEALTH_DATA_ERRORS.has(message) ? message : 'operation_failed'
}
