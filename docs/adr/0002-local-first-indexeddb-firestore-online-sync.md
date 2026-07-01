# 2. Local-first IndexedDB as sole store; Firestore as online-only sync target

- **Status:** Accepted
- **Date:** 2026-06-30
- **Related:** [0001](0001-guest-first-optional-google-identity.md)

## Context

A hard product requirement: the app must be **100% functional offline immediately after first load**,
on a local database, with **zero dependency on the network or Firestore** to launch, read, or write.
At the same time, Account Mode (ADR 0001) needs cross-device sync via a cloud backend, and Google
sign-in points naturally at Firebase.

Firestore offers its own offline persistence, but relying on it would make Firestore the local engine
and couple every read/write to its SDK and rules — at odds with "runs with no Firestore at all."

## Decision

- **IndexedDB (via Dexie) is the single working store and source of truth** on every device, in both
  Guest and Account modes. The entire app — all reads, writes, and launch — runs through it with no
  network. The domain layer depends only on a repository port backed by Dexie.
- **Firebase** is the cloud backend: **Auth** (Google provider), **Firestore** (per-user data tree),
  **Hosting** (HTTPS for the PWA + OAuth redirect).
- **Firestore is an online-only, explicit push/pull sync target.** Its offline persistence is
  **disabled**; it is never on the app's critical path. Sync runs only when the device is online **and**
  in Account Mode.
- **Conflict resolution: last-write-wins (LWW) per document.** Data is modelled as small per-entity
  documents (one per Routine Day / Routine Exercise / Workout Session / Exercise Log / Set), each
  carrying `updatedAt` and a soft-delete tombstone so deletes propagate. Sync is a delta exchange:
  push locally-changed docs, pull remotely-changed docs, resolve collisions by newer `updatedAt`.
- **Sign-in merge** (ADR 0001) is a special first-run sync: union by UUID, LWW on any id present both
  sides, guest Routine Days re-based to append after the max existing cloud `order`.

## Consequences

- The cloud SDK never blocks the UI; offline behaviour is identical in both modes. Meets the hard
  requirement.
- The domain is decoupled from Firebase (a sync adapter sits behind the repository), reducing vendor
  lock-in and keeping Guest Mode free of any network code.
- LWW can lose a concurrent field edit across devices; acceptable for a single-user-multi-device app
  with low concurrency. Append-only Workout history makes the common case conflict-free.
- **Clock skew risk:** LWW compares client `updatedAt`. Skewed device clocks can mis-order writes.
  Accepted for the POC; a later hardening could anchor `updatedAt` to a server timestamp on push.
- Requires a small bespoke sync engine (delta + tombstones + merge) instead of leaning on Firestore's
  built-in realtime cache — more code, but it is the cost of the offline guarantee.

## Alternatives considered

- **Firestore offline persistence as the local store.** Less code, but makes Firestore mandatory to
  run and couples the whole app to it — fails the "no Firestore dependency offline" requirement.
- **Supabase / custom backend.** Viable for sync, but no built-in offline and more setup; Firebase
  wins for Google login + minimal backend in a POC. (We still keep our own local store regardless.)
- **CRDT / dedicated local-first sync engine (Yjs, RxDB, PowerSync).** Strong automatic merge, but
  significant added complexity unjustified for this low-concurrency, mostly-append-only domain.
