# 1. Guest-first identity with optional Google sign-in

- **Status:** Accepted
- **Date:** 2026-06-30
- **Supersedes:** the iOS implicit-iCloud-identity model (`APP_SPECIFICATION.md` §11.2)

## Context

The iOS app has **no login**: the user is implicitly identified by the device's iCloud account, and
cloud sync is opt-in (off by default, data stays on-device). The spec explicitly flags the
identity/sync model as *the biggest porting decision* for a non-Apple stack, because the web has no
equivalent implicit cloud identity.

The product wants cross-device data ("my data follows me") **without** forcing a sign-up, preserving
the original "works immediately, no account" feel.

## Decision

Adopt a **guest-first** identity model with **optional Google sign-in**:

- **Guest Mode (default):** no account, no network. All data lives locally only. This mirrors the iOS
  default ("sync off, data on device, no sign-up").
- **Account Mode:** the user signs in with **Google** (the only provider). They are then identified by
  their Google account and their data syncs across devices. Signing in is the web analog of the iOS
  "turn on iCloud sync" toggle.
- **Sign-in Merge:** on a guest's first Google sign-in, local data is merged into the account's cloud
  data by **smart union** — entities merge by UUID (Workout history is append-only, so no duplicates);
  guest Routine Days are appended after any existing cloud days. Nothing is discarded.

We deliberately do **not** create a backend anonymous account for guests (rejected the
"anonymous→Google upgrade" model): guest data is purely local with zero backend footprint.

## Consequences

- A sign-in screen / control now exists, which the original lacked — an accepted deviation.
- Data is keyed by user identity in the cloud; guest data is keyed only locally. The merge step is the
  one-time bridge and must be correct (see [0002](0002-local-first-indexeddb-firestore-online-sync.md)).
- The seed-decision flag stays **local per device** (not synced), preserving the iOS prompt-timing
  rules per mode.
- Reversing to "login required" or "no login at all" later would change the data-ownership model and
  the merge flow — hence this ADR.

## Alternatives considered

- **Login required (Google), always-on sync.** Simplest, true cross-device, but adds a hard auth gate
  and drops the "no sign-up" value the original was built around.
- **Anonymous→Google upgrade (Firebase Anonymous Auth).** Frictionless start + cross-device, but every
  guest gets a backend account and the link/upgrade logic is more complex; also contradicts the
  "fully offline, no backend dependency to run" requirement (see 0002).
