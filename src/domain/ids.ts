// UUID + timestamp helpers, isolated so tests can stub them if needed.

/** Generate a new UUID (v4) for entity ids. */
export function newId(): string {
  return crypto.randomUUID()
}

/** Current wall-clock time in ms — used for `updatedAt` / `createdAt`. */
export function now(): number {
  return Date.now()
}
