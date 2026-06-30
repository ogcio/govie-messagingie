/**
 * The gateway surfaces backend errors as `SagFetchError` instances carrying
 * the HTTP `status`. The tags API returns 409 Conflict when a folder name
 * collides with an existing sibling (Postgres unique violation, see
 * `tag-service.ts handleUniqueViolation`). We duck-type on `status` rather
 * than `instanceof SagFetchError` so the check still holds when the gateway
 * module is mocked in unit tests.
 */
export function isConflictError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { status?: number }).status === 409
  )
}
