// A tiny change-notification bus over the repository. Every write goes through
// the operations layer (operations.ts), which calls notifyDataChanged() after
// committing; useLiveData subscribers then re-run their reads. This keeps the UI
// reactive to Dexie writes without leaking Dexie into components or the domain.

type Listener = () => void

const listeners = new Set<Listener>()

/** Subscribe to data changes; returns an unsubscribe function. */
export function subscribeToDataChanges(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Broadcast that persisted data changed. Called by the operations layer. */
export function notifyDataChanged(): void {
  for (const listener of listeners) listener()
}
