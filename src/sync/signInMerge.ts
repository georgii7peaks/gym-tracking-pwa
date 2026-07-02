// One-time guest -> Account merge (Phase 4, ADR-0001 "smart union"). A plain
// sync round already unions by UUID with LWW on overlaps by construction (an
// id absent on one side is just a fresh insert on the other) — the only thing
// that can silently collide is the Routine Day `order` field, a contiguous
// 0..n-1 sequence (§3.3) that a guest device picked with no knowledge of
// whatever another device already pushed to this account. This re-bases only
// the genuinely guest-original days (absent from the cloud) to append after
// the cloud's current max order, then defers to the normal sync round for
// everything else.
import { collection, getDocs } from 'firebase/firestore'
import { db as localDb } from '@/data/db'
import { now } from '@/domain/ids'
import type { RoutineDay } from '@/domain/types'
import { runSync } from './syncEngine'

async function rebaseGuestRoutineDayOrder(uid: string): Promise<void> {
  const { db: firestore } = await import('@/lib/firebase')
  const cloudDays = await getDocs(collection(firestore, 'users', uid, 'routineDays'))
  if (cloudDays.empty) return // first device ever to sync this account — nothing to collide with.

  const cloudIds = new Set(cloudDays.docs.map((d) => d.id))
  const maxCloudOrder = cloudDays.docs.reduce(
    (max, d) => Math.max(max, (d.data() as RoutineDay).order),
    -1
  )

  const localDays = await localDb.routineDays.toArray()
  const guestOnly = localDays.filter((d) => !cloudIds.has(d.id)).sort((a, b) => a.order - b.order)
  if (guestOnly.length === 0) return

  const ts = now()
  const rebased = guestOnly.map((day, index) => ({
    ...day,
    order: maxCloudOrder + 1 + index,
    updatedAt: ts,
  }))
  await localDb.routineDays.bulkPut(rebased)
}

/**
 * Run once, right after a successful sign-in on a device that has never
 * synced before (`lastSyncedAt === 0`). Callers should use this instead of
 * `runSync` exactly for that one round — see syncTriggers.ts.
 */
export async function mergeOnFirstSignIn(uid: string): Promise<void> {
  await rebaseGuestRoutineDayOrder(uid)
  await runSync(uid)
}
