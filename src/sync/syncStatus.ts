// Tiny external store for the current sync round's state (Phase 4). Separate
// from `lastSyncedAt` (a persisted preference, read reactively via
// useLiveData + notifyDataChanged) — this only tracks the in-flight state of
// the sync that's running right now.
import { useSyncExternalStore } from 'react'

export type SyncState = 'idle' | 'syncing' | 'error'

export interface SyncStatus {
  state: SyncState
  error: string | null
}

let status: SyncStatus = { state: 'idle', error: null }
const listeners = new Set<() => void>()

export function setSyncStatus(next: SyncStatus): void {
  status = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, () => status)
}
