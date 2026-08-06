# Gym Tracking — Web/PWA Domain

A **single-user** app for tracking strength-training workouts, rebuilt as a **PWA / web** app.
The domain is unchanged from the iOS original (see `APP_SPECIFICATION.md`); only the **identity &
sync** model differs: iCloud's implicit device identity is replaced by an **optional Google sign-in**.

Two aggregates that must never be conflated: an editable **Routine** (the program you intend to
follow) and an append-only record of **Workouts** you actually performed. The single bridge is
**Start a Session**.

## Language

Canonical domain terms (carried over verbatim from the iOS build; UI uses friendlier RU/EN strings).

### Routine side (templates, editable)
- **Routine Day** — editable template grouping exercises planned for one training day. _Avoid_: Plan, Program Day, Template.
- **Routine Exercise** — an exercise slot inside a Routine Day; has a name and an Exercise Metric. _Avoid_: Template Exercise.

### Workout side (logged, append-only)
- **Workout Session** — a single performed workout, started from a Routine Day; independent of its source after creation. _Avoid_: Training, Session, bare Workout.
- **Exercise Log** — an exercise inside a Workout Session; holds the performed Sets. _Avoid_: Performed/Logged Exercise.
- **Set** — one performed unit within an Exercise Log: `weight × reps` or `duration`. _Avoid_: Rep, Round.

### Body side (personal measurements)
- **Body Weight Entry** — a dated record of the *user's own* body weight, stored canonically in kg. Belongs to neither the Routine nor the Workout aggregate; every save is a separate entry (no per-day upsert). _Avoid_: Weight (ambiguous with a Set's weight), Weigh-in, Measurement.

### Shared vocabulary
- **Exercise Metric** — `weightReps` or `duration`. Set on both sides; an Exercise Log inherits it at copy time.
- **Start a Session** — instantiates a Workout Session from a Routine Day, copying each Routine Exercise into a new Exercise Log (same order, name, metric). The only cross-aggregate operation. **No link back to the Routine Day is stored.**
- **Previous Set** — most recent Set for a given exercise *name* in a prior Workout Session, used to pre-fill defaults. Matched by denormalised name, not by relationship (rename-safe).
- **Program** (Progress tab) — a group of Workout Sessions sharing a `name`. Since no link back to the Routine Day exists, the Progress tab derives the program from that snapshotted name. Consequences: two Routine Days with the same name **merge** into one program; renaming a day **splits** its history in two, with the old name keeping its data; a deleted day keeps the program it already produced. See `docs/plans/progress-by-program.md`.

> **Key invariant — Workout Sessions are snapshots.** Editing/reordering/deleting a Routine later
> affects only *future* sessions, never recorded ones.

## Identity & Sync (web rebuild — new terms)

The biggest porting decision (`APP_SPECIFICATION.md` §11.2). On the web there is no implicit cloud
identity like iCloud, so identity becomes explicit and **optional**.

- **Guest Mode** — the default. No account, no network. All data lives **locally only** (IndexedDB).
  Mirrors the iOS default of "sync off, data stays on this device, no sign-up."
  _Avoid_: Anonymous (we are deliberately **not** creating a backend anonymous account).
- **Account Mode** — after the user signs in with Google. The user is identified by their Google
  account; their data lives in the cloud and **syncs across devices**. Replaces iCloud's implicit
  identity. Signing in is the web analog of the iOS "turn on iCloud sync" toggle.
- **Sign-in Merge** — the one-time operation when a Guest first signs in with Google: their local
  (guest) data is **merged** into the account's cloud data via a **smart union**, then kept in sync.
  Because every entity carries a UUID and Workout history is append-only, the union is safe: Workout
  Sessions and Sets merge by `id` (no duplicates); guest Routine Days are appended after any existing
  cloud days. Nothing is discarded.
- **Local store is always the source of truth on each device.** The cloud is a sync target reached
  only in Account Mode. This keeps offline behaviour identical in both modes.

> **Hard requirement — fully offline after first load.** The app must be 100% functional offline on
> the local database (IndexedDB), with **zero dependency on Firestore** to run. Every read/write/launch
> goes through the local store and never blocks on the network. Firestore's own offline cache is **not**
> used; cloud sync is an **explicit push/pull** from the local store, performed only when the device is
> online **and** in Account Mode.

## Persistence

- **Local:** IndexedDB (via Dexie) on every device (Guest and Account alike), always the working
  store and source of truth. The app runs entirely on this store with no network.
- **Cloud (Account Mode only, online only):** **Firebase** — Firebase Auth (Google provider) +
  Firestore (per-user data tree) + Firebase Hosting (HTTPS for the PWA and the OAuth redirect).
  Firestore is **only** an explicit push/pull sync target; its offline persistence is disabled and it
  is never on the app's critical path.
- **UI preferences** (weight unit, theme, language) and local flags (e.g. seed-decision) stay local
  and are **not** synced — same as the iOS build.

## Relationships

- A **Routine Day** has many **Routine Exercises**, ordered by an explicit `order`.
- A **Workout Session** has many **Exercise Logs**, ordered.
- An **Exercise Log** has many **Sets**, ordered.
- **Start a Session** is the only operation crossing the Routine/Workout boundary.
- A **Set** denormalises the exercise name so Previous Set works without joins.
