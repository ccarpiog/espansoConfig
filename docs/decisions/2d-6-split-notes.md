# Phase 2d-6 — the design consult, and the eleven-step split it rules

**Status:** the record of a design decision, taken before any line of 2d-6 exists. It changes no
source file. `docs/reviews/phase-2d-6-design.md` is the consult itself and is the authority for
*what* 2d-6 builds; this file is this project's own restatement of it, plus the citation audit the
house rule owes, plus the corrections it forces on earlier documents. Its shape is
[`2d-5-split-notes.md`](2d-5-split-notes.md)'s.

---

## 1. What the consult was, and what it does not cover

- **Provider and effort:** Codex (GPT-5 family), **high** effort, dispatched **2026-09-21** by
  `/autoclaude-opus` in driven mode through the companion CLI (job `task-mub3r0qh-b6gfi9`, about
  nineteen minutes wall-clock), per `docs/decisions/codex-dispatch-procedure.md`.
- **The brief** is [`2d-6-design-brief.md`](2d-6-design-brief.md) — 278 lines, eleven questions
  Q1-Q11, with its own coverage bounds named to the consultant in its §7. It takes no position on any
  question it asks (§7 item 5).
- **The reply** is [`phase-2d-6-design.md`](../reviews/phase-2d-6-design.md), captured verbatim from
  its `---` at line 23. It wrote no verdict heading: its first two paragraphs (lines 25 and 27) are
  the verdict, then Q1-Q11 under `###` headings (lines 29-326), each opening with a **Ruling** line
  and closing with an **Evidence** line, and the Q11 split at lines 332-387.
- **It is the second provider on this material throughout** (brief §7 item 4): every 2d-5 review and
  the 2d-5 consult ran on Codex, so the shared prior is Codex's. The brief asked it to look hardest
  where a reviewer who had approved every step would nod; §5.1 and §5.2 below are where it did.

**No gate was run for this consult and none is claimed.** The brief forbade Cargo and npm; Codex ran
neither and said so itself, immediately under its verdict
(`docs/reviews/phase-2d-6-design.md:27`). Every figure it quotes is **read from a file, not
measured**. This record ran no gate either, and every count in §4 and §7 was derived with `rg`.

Three further bounds, stated because each is assumable:

1. **A design consult is not a review round.** Nothing here is a finding or has a severity, and this
   record changes no source file. The review policy is `CLAUDE.md` §7's: one adversarial review per
   phase, blockers fixed, verification re-run, the phase closes; a fix is not owed a review. The 2d-5
   record's §8 cites a §7.1/§7.2 rule removed on 2026-09-20; it is not reproduced here.
2. **No claim here is about what a window does.** The consult ran no window, and neither did this
   record. Where §2 assigns a window reading, that is an obligation, never evidence.
3. **The consult reasoned from `main` at `f46f52a`**, with the four uncommitted instrument paths and
   `PROGRESS.json` in the tree and excluded on purpose. A citation that resolves today can drift
   under the first commit of 2d-6-1; §4 is a snapshot with a date on it.

---

## 2. The eleven-step split, restated

Codex's Q11 cuts 2d-6 into eleven dependency-ordered steps (`phase-2d-6-design.md:332-385`),
restated here with the observable acceptance each must show and the §3 entries that bind it. Every
step owes the machine-checkable gate set. Steps 1-5 touch no `.svelte` file; steps 6-10 each owe
bilingual mounted evidence **and** a narrow window regression reading (§5.3); step 11 consolidates.
Two gaps and two overlaps in the split are recorded in §6, not repaired here.

### 2d-6-1 — delivery, retained-state and uncertainty protocol

**Delivers** the delivery envelope (narrowed observation plus verdict) and the narrow
`ReconciliationWorkspace` arbitration/delivery member; settlement verdicts published through it; the
person-requested retry at the original arrival generation; the coordinator state-change notification
feeding a `BrowserState` revision signal; the guarded workspace and file reload request methods; the
uncertainty acknowledgement; automatic-reload guards that hold per file, not per mounted panel; the
shared conflict-description and evidence primitives; the origin-correct message values and narrowed
EN/ES sentences. **Acceptance:** a settlement verdict is delivered, not discarded; one retry press
makes at most one attempt and re-entrancy leaves the observation askable again; the acknowledgement
refuses in flight, after supersession and at a moved generation, and spends once; the command spy
stays at zero through every arbitration, retry and acknowledgement; `describeExternalConflict` no
longer emits `changedElsewhere`. **Components: none.** **Bound by** entries 2, 4, 5, 11, 14-19,
24, 28, 29, 32, 40. **Depends on** nothing in 2d-6.

#### The orchestrator's cut of 2d-6-1, taken 2026-09-21 (§6 item 16)

Nine deliverables against a one-worker bound is too many for one coherent phase, so 2d-6-1 runs as
three sub-phases in dependency order, each owing the gate set and its own review. **The union is
2d-6-1 exactly**: nothing is added, and the acceptance above is checked in full when 2d-6-1c closes.

- **2d-6-1a — values, shared primitives and messages.** The delivery envelope as a value (narrowed
  observation plus verdict, entry 4) with no `BrowserState` member yet; the shared conflict-description
  and evidence primitives (entry 10 — one typed revision description over both origins, never relabelling
  `previousRevision` as "expected" nor manufacturing "found"); the pure per-file automatic-reload
  guard decision (entries 15 and 32, the predicate only — its state is 1b's); the origin-correct message
  values with EN/ES sentences under the entry 39 namespaces, pinned to the entry 40 bounds — the
  retained sentence (entry 13), the uncertainty sentences (entry 14), the three corrections of entry 24,
  and `describeExternalConflict` no longer emitting `changedElsewhere`; the entry 41 corrections in the
  files it touches. **Components: none; no new `workspace.svelte.ts` member.** Bound by entries 4, 10,
  11 (the values each verdict's action consumes), 13, 14 (sentences), 15 (predicate), 24, 39, 40, 41.
- **2d-6-1b — the observation-protocol members.** The narrow `ReconciliationWorkspace`
  arbitration/delivery member with settlement verdicts published through it (entries 2, 4, 5); the
  person-requested retry at the original arrival generation (entries 16, 17, 18); the uncertainty
  acknowledgement (entries 14, 15); the per-file automatic-reload guard state (entry 15). **Components:
  none.** The command spy stays at zero through every arbitration, retry and acknowledgement.
- **2d-6-1c — the coordinator and workspace members.** The coordinator state-change notification
  feeding one `BrowserState` revision signal, and the `watchState()` and sanitized registration-state
  exposure §6 item 11 says no step claimed — **1c claims it** (entry 28); the two guarded reload request
  methods (entry 29); the guarded file reread request delegating to `rereadUnderGuard` (entry 32).
  **Components: none.**

### 2d-6-2 — match-editor external session and reapply

**Delivers** the editor's `externalConflict` field, the restriction at `canSave` and `beginSave`, the
confirmation reset on a replacing verdict, and the full-identity `editor` correspondence lookup;
save history and field intent survive. **Acceptance:** model tests over pristine and edited drafts,
collisions, all four evidence arms and all three adoption outcomes; `beginSave` called directly under
an external conflict answers `null`. **Components: none.** **Bound by** entries 6-9, 11, 12, 19, 20, 22.
**Depends on** 2d-6-1.

### 2d-6-3 — creation and recovery external sessions

**Delivers** creator and recovery conflict storage and gates, destination and anchor evidence, the
unknown-target behaviour, `RecoveryOrigin.conflict` kept distinct from the destination's conflict,
and the target and receiver values a recovery form reports upward. **Acceptance:** model tests for an
unknown destination, cross-file recovery, targetless creation, anchor refusal and uncertainty; a
destination-less creator refuses to choose one. **Components: none.** **Bound by** entries 6-9, 11,
12, 19-22, 25. **Depends on** 2d-6-1.

### 2d-6-4 — operation-session external conflicts

**Delivers** the delete, move and duplicate transitions, the `exact` subject and anchor lookup,
pending-confirmation withdrawal and model-owned restrictions; D2r and R25 unchanged. **Acceptance:**
model tests over stale full identities, ambiguous correspondence, same-sequence checks, and direct
calls to `confirmDelete`, `refusalGiven` and the duplicate boundary under an external conflict.
**Components: none.** **Bound by** entries 6-9, 11, 12, 19, 20, 22. **Depends on** 2d-6-1.

### 2d-6-5 — raw and restore external sessions

**Delivers** raw and restore conflict handling, the declared unsupported reapply, the raw reseed and
`\r` refusal, restore's candidate-preserving retargeting. **Acceptance:** model tests for CR handling,
consent withdrawal, candidate retention, all three adoption outcomes. **Components: none.** **Bound
by** entries 6-9, 11, 12, 22, 23. **Depends on** 2d-6-1.

### 2d-6-6 — authored-surface delivery and complete registration

**Delivers** receiver reporting and delivery for editor, creator and recovery; recovery as the eighth
centrally assembled kind; delivery to every affected session; the shell kept mounted while a retained
surface exists over an empty list; origin, evidence, comparison, copy and recovery rendering on the
three authored panels. **The first live component path for `observeExternalChange` and
`supersedeConflict`.** **Acceptance:** bilingual mounted tests through the real registry and
coordinator boundary — a pristine editor conflicts; an unknown-target creator blocks every eligible
target; recovery over B protects B while its host stays over A; host and recovery over one file get
one decision; a reopened editor cannot receive an old instance's delivery; a settlement lands in
order — plus a narrow window reading. **Components:** `DetailPane.svelte`, `AppShell.svelte`,
`MatchEditor.svelte`, `MatchCreator.svelte`, `RecoveryPanel.svelte`. **Bound by** entries 1-5, 10,
23, 25, 31, 34-36, 38. **Depends on** 2d-6-1, 2d-6-2, 2d-6-3.

#### The orchestrator's cut of 2d-6-6, taken 2026-09-22

Five components, the registration wiring, bilingual mounted tests, a window reading and three
model-side obligations the closed steps handed on (`PROGRESS.md`, *What 2d-6-6 owes the closed
steps*, items (1)-(3)) are too much for one coherent phase, so 2d-6-6 runs as three sub-phases in
dependency order, each owing the gate set and its own review. **The union is 2d-6-6 exactly**,
plus the three hand-on obligations; the acceptance above is checked in full when 2d-6-6c closes.

- **2d-6-6a — the model-side obligations, before any wiring.** The `current` reader
  (`ReadTheInstalledSession` / `ReadTheInstalledForm`) made **required** on every door and settling
  transition of all eight sessions, and every caller passing one — `BrowserState.restoreDocument`
  gaining the parameter; the three operation doors (`confirmDelete`, `beginMove`,
  `beginDuplicate`) reading every caller-controlled value before their one reader call (2d-6-5
  §4 item 11, in 2d-6-5 §7 finding 1's shape); the editor's, the creator's and the recovery
  form's reapplies asking both blocks before `enterReapply` and the installed session once
  immediately before adoption (2d-6-4 §4 item 4, pattern (c) and finding 4). Each pinned by a
  case shown failing first. **Components only touched mechanically at call sites.** Record:
  [`2d-6-6a-notes.md`](2d-6-6a-notes.md).
- **2d-6-6b — registration and delivery wiring.** `DetailPane.svelte` / `AppShell.svelte`
  registration and delivery for the editor, the creator and recovery; recovery as the eighth
  centrally assembled `OpenWriteSurface` kind; the shell kept mounted while a retained surface
  exists over an empty list; mounted delivery tests through the real registry and
  coordinator boundary. (The cut also listed `src-tauri/capabilities/default.json` gaining
  `core:event:allow-listen` and `core:event:allow-unlisten`; both have been granted since
  2d-5-7a, and 6b registers no Tauri listener — its receivers are in-process — so the file
  is unchanged: [`2d-6-6b-notes.md`](2d-6-6b-notes.md) §2 ruling 7.) Record:
  [`2d-6-6b-notes.md`](2d-6-6b-notes.md).
- **2d-6-6c — the three authored panels' rendering.** Origin, evidence, comparison, copy and
  recovery rendering on `MatchEditor.svelte`, `MatchCreator.svelte` and `RecoveryPanel.svelte`;
  the bilingual mounted tests of the acceptance above; the narrow window reading. **Cut again on
  2026-09-22 into two halves**, because the window reading needs its own fresh bundle paths and
  launch plans and is a coherent unit of its own: **2d-6-6c-1** — the rendering on the three
  panels, 6b's carried items (`2d-6-6b-notes.md` §4 items 1, 2, 4, 5, 7), the declared-gap
  decision (§2 ruling 3) and the bilingual mounted tests; **2d-6-6c-2** — the narrow window
  reading and 2d-6-6's whole acceptance checked in one place. Records:
  [`2d-6-6c-1-notes.md`](2d-6-6c-1-notes.md), `2d-6-6c-2-notes.md`.

### 2d-6-7 — operation-surface rendering

**Delivers** the delete, move and duplicate receivers with origin, comparison, reapply or manual
resolution and reload rendering. **Acceptance:** bilingual mounted interactions for every offered
control, direct submission refusal, supersession withdrawing the warning, a narrow window reading.
**Components:** `DetailPane.svelte`, `MatchDeleter.svelte`, `MatchMover.svelte`,
`MatchDuplicator.svelte`. **Bound by** entries 1, 10, 23, 34-36, 38. **Depends on** 2d-6-4, 2d-6-6.

#### The orchestrator's cut of 2d-6-7, taken 2026-09-23

Four components, the registration wiring, bilingual mounted tests of every offered control, a
window reading and two model-side obligations the closed steps handed on (`PROGRESS.md`, *Next
action*, items 1-2: `2d-6-6c-2-notes.md` §5 items 2 and 7, `2d-6-6b-notes.md` §7 item 2) are too
much for one coherent phase, so 2d-6-7 runs as three sub-phases in dependency order, following
2d-6-6's precedent, each owing the gate set and its own review. **The union is 2d-6-7 exactly**,
plus the two hand-on obligations; the acceptance above is checked in full when 2d-6-7c closes.

- **2d-6-7a — the owed model-side obligations, then registration and delivery wiring.** The
  `deleteMatch`, `moveMatch` and `duplicateMatch` wrappers in `workspace.svelte.ts` audited for
  the post-commit shape fixed in `saveMatch` (a committed write answered as an error when the
  adoption or the re-read throws), with the guarded classification of the thrown value, and
  `createMatch` given that guard; the three operation reapplies (`matchDeletion.ts`,
  `matchMove.ts`, `matchDuplication.ts`) audited for reads after their pre-adoption look. Each
  defect pinned by a case shown failing first. Then the delete, move and duplicate receivers
  reported by their components and registered from `DetailPane.svelte` through
  `surfaceReceivers.ts`, with mounted delivery tests through the real registry and coordinator
  boundary. **No new rendering.** Raw's wrapper stays 2d-6-8's. Record:
  [`2d-6-7a-notes.md`](2d-6-7a-notes.md).
- **2d-6-7b — the three operation panels' rendering.** Origin, comparison, reapply or manual
  resolution and reload rendering on `MatchDeleter.svelte`, `MatchMover.svelte` and
  `MatchDuplicator.svelte`; the bilingual mounted tests of the acceptance above — every offered
  control, direct submission refusal, supersession withdrawing the warning. Record:
  [`2d-6-7b-notes.md`](2d-6-7b-notes.md).
- **2d-6-7c — the narrow window reading, and 2d-6-7's whole acceptance checked in one place**,
  starting from the harness and launch recipe of
  [`2d-6-6c-2-window-reading.md`](2d-6-6c-2-window-reading.md) §2-§3. Record: `2d-6-7c-notes.md`.

The open item *the eight sessions' doors and settling transitions not re-audited for reads after
their last `current()`* (`2d-6-6b-notes.md` §7 item 3) is **not** part of this cut: it spans all
eight sessions, not the three this step wires, and stays where `PROGRESS.md` carries it.

### 2d-6-8 — raw and restore rendering

**Delivers** both receivers and the two external panels with their distinct reload effects (reseed,
retarget). **Acceptance:** bilingual mounted interactions; the viewer refreshes through the guarded
path while the editor conflicts; the restore candidate survives; CR disclosure; a narrow window
reading. **Components:** `DetailPane.svelte`, `RawEditor.svelte`, `RestorePane.svelte`. **Bound by**
entries 1, 10, 23, 32, 34-36, 38. **Depends on** 2d-6-5, 2d-6-6.

#### The orchestrator's cut of 2d-6-8, taken 2026-09-23

Three components, the registration wiring, two distinct reload effects, bilingual mounted tests, a
window reading and the model-side obligations the closed steps handed on (`PROGRESS.md`, *Next
action*: `2d-6-6b-notes.md` §7 item 1, `2d-6-5-notes.md` §4 item 4, and raw's post-commit wrapper
from `2d-6-7a-notes.md` §4 item 5) are too much for one coherent phase, so 2d-6-8 runs as three
sub-phases in dependency order, following 2d-6-7's precedent, each owing the gate set and its own
review. **The union is 2d-6-8 exactly**, plus the hand-on obligations; the acceptance above is
checked in full when 2d-6-8c closes.

- **2d-6-8a — the owed model-side obligations, then registration and delivery wiring.** Raw's
  `loadDiskVersion` (`rawEditor.ts`) and restore's `reloadTheDiskVersion` (`restore.ts`) given the
  `confirmationOf` / `settledAnswer` shape 2d-6-6b's review gave the editor's reload; whether
  `BrowserState.restoreDocument` still passes no reader re-derived; the `saveRawDocument` and
  `restoreDocument` wrappers in `workspace.svelte.ts` audited for the post-commit shape fixed in
  `saveMatch` (a committed write answered as an error when the adoption or the re-read throws).
  Each defect pinned by a case shown failing first. Then the raw and restore receivers reported
  by their components and registered from `DetailPane.svelte` through `surfaceReceivers.ts`,
  `ReceivingSurfaceKind` extended to all eight kinds, with mounted delivery tests through the real
  registry and coordinator boundary. **No new rendering.** Record:
  [`2d-6-8a-notes.md`](2d-6-8a-notes.md).
- **2d-6-8b — the two panels' rendering.** On `RawEditor.svelte` and `RestorePane.svelte`: the
  origin, the comparison, the distinct reload effects — reseed (raw) and retarget (restore) — the
  viewer refreshing through the guarded path while the editor conflicts, the restore candidate
  surviving, the CR disclosure, and the bilingual mounted tests of the acceptance above. Record:
  `2d-6-8b-notes.md`.
- **2d-6-8c — the narrow window reading with one hard fixture (ruling 38), and 2d-6-8's whole
  acceptance checked in one place**, starting from the harness and launch recipe of
  [`2d-6-7c-window-reading.md`](2d-6-7c-window-reading.md). Record: `2d-6-8c-notes.md`.

The open item *the eight sessions' doors and settling transitions not re-audited for reads after
their last `current()`* (`2d-6-6b-notes.md` §7 item 3) is **not** part of this cut beyond the two
reloads it names separately, for the reason the 2d-6-7 cut gives.

### 2d-6-9 — reconciliation status and explicit exits

**Delivers** the drawn states — stale, unavailable, removed, path drift, not watched, failed
registration, lost history, membership reload wanted, held observation, uncertain write — and the
controls: membership reload, lost-history exit, stale-file reread, retry, uncertainty
acknowledgement. **The first step naming a coordinator state to a person; it owns the EN/ES keys and
typed accessors** (2d-5 record §6 item 6 discharged here). **Acceptance:** model tests for the
presentation decisions; bilingual mounted state changes and controls, including a locale switch on a
mounted status panel with no unrelated mutation; empty-workspace retention; a narrow window reading.
The sidebar/status suite is a new jsdom file and declares its invoke guard (entry 37).
**Components:** `AppShell.svelte`, `Sidebar.svelte`, `DetailPane.svelte`, and the eight write
renderers only for typed status and acknowledgement presentation. **Bound by** entries 13-18, 26-32,
34-36, 38-40. **Depends on** 2d-6-1, 2d-6-6, 2d-6-7, 2d-6-8.

#### The orchestrator's cut of 2d-6-9, taken 2026-09-23

Ten drawn states, five controls, a new dictionary namespace with its accessors, at least three
components plus the eight write renderers, a new jsdom suite and a window reading are too much for
one coherent phase, so 2d-6-9 runs as three sub-phases in dependency order, following the 2d-6-7 and
2d-6-8 precedent, each owing the gate set and its own review. **The union is 2d-6-9 exactly**, plus
the items handed on to it by name; the acceptance above is checked in full when 2d-6-9c closes.

- **2d-6-9a — the presentation decisions as values, and their words.** A `src/lib/browser/` module
  deciding, from coordinator and workspace state, which of the ten states is drawn for the workspace
  and for each file, and which of the five controls is offered and whether it is enabled — decisions
  as values, no component. The EN/ES keys and the typed `describe*` accessors (with their reactive
  wrappers) for every state and control, discharging 2d-5 record §6 item 6. Model tests for every
  decision, including empty-workspace retention. Also decided and recorded, by name: orchestrator
  rulings (2) and (3) standing since 2d-6-1b (the acknowledgement operand stays `ConflictSource`; the
  `projectionReplaced` refusal at an outlived arrival generation), and `2d-6-8c-notes.md` §4 item 4
  (a save refused under the lock after another writer changed the file, with no drain delivering the
  watcher's reading) — diagnosed from the code, ruled deliberate or a defect, and a defect pinned by
  a case shown failing first. **No component changes.** Record: `2d-6-9a-notes.md`.
- **2d-6-9b — the rendering and the controls.** `AppShell.svelte`, `Sidebar.svelte` and
  `DetailPane.svelte` draw the 9a decisions and wire the five controls; the eight write renderers
  gain only typed status and acknowledgement presentation, including `acknowledgeSnapshot` /
  `acknowledgeRestoreSnapshot`, drawn by nothing so far (`2d-6-8b-notes.md` §4 item 6). The new
  sidebar/status jsdom suite declares its invoke guard (entry 37); bilingual mounted state changes
  and controls, a locale switch on a mounted status panel with no unrelated mutation, and
  empty-workspace retention mounted. If measurement shows this is too big for one worker, it is cut
  again here before any code is written. Record: `2d-6-9b-notes.md`.
  **Cut again by the orchestrator on 2026-09-23**, into two sub-phases in dependency order, each
  owing the gate set and its own review; the union is 2d-6-9b exactly, and the two records replace
  `2d-6-9b-notes.md`:
  - **2d-6-9b-1** — the shell, sidebar and detail pane draw the 9a decisions and wire the five
    controls; the orchestrator's ruling on `stale` implemented (the window holds a disk snapshot of
    the file newer than its installed projection, from an observation or from a save refused as a
    conflict); the reader for held files no row or surface names (`2d-6-9a-notes.md` §5 item 3) if
    the route needs it; the new sidebar/status jsdom suite declaring its invoke guard (entry 37);
    bilingual mounted state changes and controls; a locale switch on a mounted status panel with no
    unrelated mutation; empty-workspace retention mounted. Record: `2d-6-9b-1-notes.md`.
  - **2d-6-9b-2** — the eight write renderers gain only typed status and acknowledgement
    presentation, including `acknowledgeSnapshot` / `acknowledgeRestoreSnapshot`
    (`2d-6-8b-notes.md` §4 item 6), bilingual mounted. Record: `2d-6-9b-2-notes.md`.
  - **2d-6-9b-3** — the orchestrator's ruling on entry 15 (`2d-6-9b-1-notes.md` §6 item 1),
    recorded 2026-09-23 at 9b-2: **entry 15 is to be enforced on the coordinator's automatic
    path.** While a file is under an uncertainty hold, an automatic reread is refused, and the
    refused observation is registered as an acknowledgeable origin, so the resulting `stale`
    file keeps an exit (acknowledge, then reread). This is model work in a bounded corrective
    sub-phase, scheduled after 9b-2 and before 9c so that the window reading reads the enforced
    behaviour. Its own acceptance: a model case shown failing first for the refused reread and
    for the registered origin; the route and acknowledgement drawn for it, EN and ES; and no
    change to the manual `requestFileReread` path. Record: `2d-6-9b-3-notes.md`. **Implemented**
    in the coordinator host's `rereadUnderGuard` member in `workspace.svelte.ts`: the hold refuses
    the read at the request and again at the installation, and the refused observation goes
    through the window's own arbitration (`takeInObservation`). One race is not covered and is
    that record's §6 item 1.
- **2d-6-9c — the narrow window reading with one hard fixture (ruling 38), and 2d-6-9's whole
  acceptance checked in one place**, starting from the harness and launch recipe of
  [`2d-6-8c-window-reading.md`](2d-6-8c-window-reading.md). Record: `2d-6-9c-notes.md`.

### 2d-6-10 — foreground fallback

**Delivers** the synchronous DOM `ForegroundSource` replacing `INERT_FOREGROUND_EVENTS` in
`AppShell`; the coordinator's asynchronous-Tauri comment corrected; no permission or instrument hook
changed. **Acceptance:** adapter tests; mounted shell cases where a `visibilitychange` to `visible`
and a `focus` each request a drain, a hidden visibility does not, triggers coalesce, unmount removes
both listeners; a narrow foreground reading with the wake and resume limits stated. **Components:**
`AppShell.svelte`. **Bound by** entries 33, 38. **Depends on** 2d-6-6.

### 2d-6-11 — complete composition evidence and baseline accounting

**Delivers** the cross-surface matrix completed, finite drain scripts where `DetailPane` cases start
reconciliation, the import and guard inventory check, the reviewed bilingual fixtures, the factual
production-comment sweep, and all four baselines re-measured in both instrument-present and
normalized form; the earlier narrow readings consolidated without being called the 2d-7 matrix.
**Acceptance:** the integration, mounted and architectural checks plus the full gate set; the
architectural check fails on an unguarded synthetic fixture; no new window claim. **Components: none
planned** — a defect found here is fixed in its owning step. **Bound by** entries 36, 37, 41, 42.
**Depends on** every earlier step.

**The orchestrator's cut of 2d-6-11 (2026-09-23), in two halves.** The step is too broad for one
phase, so it runs as two; neither changes a ruling above, and the acceptance is the block's, divided.

- **2d-6-11a — the matrix, the drain scripts and the inventory check.** The Q8 cross-surface mounted
  matrix (entry 34) completed row by row; `DetailPane`'s reconciliation-starting cases held to finite
  drain scripts with exact counts and arguments (entry 36; `invoked` stays exact zero,
  `AppShell.test.ts`'s per-case list untouched); the scoped import and guard inventory check (entry
  37), pinned to fail on an unguarded synthetic fixture. Production comments that diff falsifies are
  corrected in it (entry 41); the broad sweep is not. Record: `2d-6-11a-notes.md`.
- **2d-6-11b — fixtures, the sweep and the baselines.** The reviewed bilingual EN/ES fixtures
  (entries 35, 40), the factual production-comment sweep over entry 41's eight classes, and all four
  baselines re-measured with the instrument and normalized (entry 42), compared against the
  pre-instrument `1320 / 438 / 2254 / 186`; the earlier narrow readings consolidated without being
  called the 2d-7 matrix. It closes 2d-6-11.

---

## 3. The binding rulings

One entry per ruling that constrains later work. Each says what it forces **and, in the same sentence,
what it does not** — a record claiming a guarantee the code does not give is this project's worst
defect class. The question each answers is in brackets.

1. **Route (b): the child reports its receiver through a required callback prop; the registry stays
   one exhaustive assembly in `DetailPane`; cleanup is instance-bound; a missing receiver retains
   delivery and blocks submission** [Q1]. Rejected: (a) a delivered-observation prop, which leaves
   delivery pending until an effect runs; (c) child-side registration, which loses the one-file
   check. A required reporter prop and an exhaustive record force the wiring shape; **they cannot
   force the child to report, to invoke its transition, or to clean up, nor stop a parent storing a
   receiver without its instance token** — mounted tests establish all four.

2. **Arbitrate once in `BrowserState` before delivery, and deliver one decision to every affected
   session** [Q1]. Two sessions over one file must not produce `raised` then `coalesced`
   independently. Settlement publishes through the same path — the `arbitrateHere` answer at
   `workspace.svelte.ts:3147` is no longer discarded — without readmitting an accepted sequence.

3. **Recovery is an eighth registered kind, assembled in `DetailPane`, its target and receiver
   reported up through `MatchEditor` and `MatchCreator`** [Q1]. This overrides the seven-kind
   completeness claim, not the one-file construction rule (§5.1). The targeting predicate returns
   **all** surfaces over a file for delivery; a single match stays sufficient to prohibit reload.

4. **A narrow `ReconciliationWorkspace` arbitration/delivery member exists, deliberately** [Q1]. The
   exclusive-seven design could have arbitrated in the parent callback; shared arbitration, several
   recipients and settlement delivery justify the member. The envelope carries the narrowed
   observation and verdict; the child's model transition combines it with its draft and capabilities.

5. **Delivery during a child's own awaited write is held until the child applies its result, then the
   latest valid delivery is consumed** [Q1], or the `await save(...)` continuation overwrites the
   delivered conflict; committed-success facts survive. **Nothing in TypeScript orders a continuation
   against a delivery**; the ordering is a mounted-test fact.

6. **Option (a): `externalConflict: ExternalConflictModel<T> | null` on each immutable session;
   `SaveOutcomeModel` stays save-only; accessors widen to `ConflictModel<T> | null`** [Q2]. Rejected:
   (b) widening `outcome`, which turns "how a save ended" into "anything that happened"; (c) a
   component-local slot, invisible to model entry points.

7. **Only one conflict is active** [Q2]: an external observation superseding a save conflict retires
   that outcome; a committed success stays as history and never masquerades as the current conflict.
   The type admits both fields populated; the transition is what keeps them exclusive.

8. **"Cannot submit" is a model rule at every boundary** [Q2]: editor and raw `canSave`/`beginSave`;
   creator and recovery refusal and begin/send; delete request **and** confirmation; move and
   duplicate refusal and begin; restore preparation, confirmation and final permit. External conflict,
   unresolved retained delivery, removed target and unresolved uncertainty each block, and tests call
   the model function directly past a disabled button. The model forces refusal for the inputs
   supplied; **it cannot force those inputs to be current** (R37) — one projection snapshot, one
   synchronous decision.

9. **The unconditional dismissal must not erase an external block** [Q2]. `keepEditing`
   (`matchEditor.ts:1630` sets `outcome: null`) may at most cancel the reload warning; any mode that
   permits further drafting keeps the restriction until an explicit resolution succeeds.

10. **Keep the eight panels; extract shared description helpers, not a generic conflict component;
    render `view.conflict` outside the save-outcome branch** [Q2]. One shared typed revision
    description: save origin shows expected, locked-found and observed; external shows the observed
    disk revision only; never relabel `previousRevision` as "expected" or manufacture "found".
    Renderers switch on `source.kind` and read save fields from `source.conflict`, or use one tested
    type guard — **the nested discriminant does not narrow the parent** (2d-5-5a §8 item 1).

11. **Every verdict has a named session action** [Q3]: `raised` builds the external model from the
    delivered observation, retained draft and declared capabilities; `raisedWithoutReload` builds or
    supersedes with ordinary reload withheld until uncertainty is acknowledged, and reapply may not
    obtain adoption indirectly; `supersedes` uses `supersedeConflict`; `coalesced` preserves model,
    source identity and confirmation state; `notLater` changes nothing; `retained` keeps outcome and
    draft and records a pending-reconciliation restriction — never a disk comparison or a new origin.

12. **A replacing verdict resets the surface's `reload`, clears pending operation or restore
    confirmations and invalidates displayed reapply results, in the surface model transition** [Q3].
    `adoptDiskVersion`'s refusal of an outlived origin is necessary and does not reset the warning
    (§5.7). Component-local copy and report feedback is cleared where it would describe the wrong
    panel.

13. **The honest retained sentence is "An observed change is waiting to be checked against this
    window's state."** [Q3] — not "waiting for your save" without a live write-barrier reading, and
    no promise of automatic eventual processing.

14. **An uncertain write is ended by an explicit, non-installing acknowledgement** [Q3]: "The earlier
    write's outcome is unknown. Reviewing this disk snapshot cannot establish whether that write
    completed." with an action such as "I have reviewed this snapshot." The `BrowserState` member
    (`acknowledgeWriteUncertainty` is a suggested name) takes a one-shot acknowledgement bound to
    open generation, document, uncertainty generation and standing source; reads caller-controlled
    operands before its final checks; refuses in flight, after supersession or at an outlived
    generation; atomically spends and ends the hold; installs nothing and issues no command. A third
    exit beside 5b's two (§5.5); not a second door and not a `force`, because writes stay
    revision-checked and installation stays `adoptDiskVersion`'s.

15. **After acknowledgement the conflict's availability is rebuilt; a reload still needs its two-step
    confirmation and `adoptDiskVersion`; the observation is not re-observed to manufacture a fresh
    `raised`** [Q3]. The hold blocks automatic rereading after its surface closes — per file, never
    dependent on a mounted panel.

16. **Re-arbitration is person-requested, one attempt per press, never triggered by closure or an
    effect** [Q4]. `retryRetainedObservation(document)` (suggested name) is unavailable during a
    write in flight; re-entrancy leaves the observation retained and askable again; no loop.

17. **A retry uses the record's original arrival generation, never a fresh `observeExternalChange`**
    [Q4], which would renew evidence that arrived before a projection replacement. Identity and
    generation are checked before the record is modified; the verdict goes through entry 2's path;
    watermark and accepted sequence are untouched.

18. **Neither retry nor delivery calls a command, installs a projection or mints reload consent**
    [Q4]. **A signature cannot prove the absence of a hidden command call**; negative spy tests and
    structure do. Closing a surface changes eligibility only.

19. **Build the external correspondence lookup for the five match surfaces; do not ship a `supported`
    reapply that always falls back** [Q5]. Reapply entry consumes `reapplyEvidenceFor` for both
    origins with a live standing-origin guard through a narrow function prop; the four answers stay
    distinct; the table is never cast to `ReapplyEvidence`.

20. **Correspondence converts by full base identity** [Q5]: editor by its base subject's `editor`
    resolution; delete, duplicate and move by the subject's `exact`; an anchored creation or move by
    the anchor's `exact` from the same table; creation targetless with no invented `MatchId`. Document,
    base revision and disk revision must all match; a missing or duplicate row refuses; **array index
    and arena-node equality are never cross-revision identity**.

21. **A destination-less creator keeps its fields and wildcard protection, shows the affected file's
    state and requires an explicit destination** [Q5]; it never adopts the observed file or retargets
    its draft silently.

22. **Refusals resolve to manual resolution with the typed sentence** [Q5]: `tExternalEvidenceRefusal`
    for missing or mismatched evidence, `tSupersededEvidence` for superseded; raw and restore keep
    `unavailable`; under unresolved uncertainty reapply may not obtain adoption internally.

23. **The external panel keeps everything the save panel has** [Q5]: whole-file comparison through
    `SourceText … documentStart`; retained fields, operation or candidate; copy only where declared,
    through `copyReferenceText`; the two-step reload with each surface's real close, reseed or
    retarget; recovery only after eligible manual resolution. `conflictChoicesFor` stays the only
    producer; comparison is evidence.

24. **Correct the wording before drawing it** [Q5]. `describeExternalConflict` emits `changedElsewhere`
    (`saveOutcome.ts:1124`), whose translation says a save was refused (`en.json:161`) — false for the
    external origin, and an added origin line does not cancel it. "No save was attempted" becomes "No
    save was initiated in response to this observation"; "Nothing was written" on a reapply refusal
    becomes "This reapply attempt wrote nothing"; supersession says accepted evidence changed, not
    that the disk is newer. Never *merged*, *saved*, *newer*, *deleted*, *exact duplicate* or
    *identity correspondence* without the predicate.

25. **`RecoveryOrigin.conflict` retains the exact originating source object** [Q5], never replaced by
    the destination's conflict nor spent to adopt it; the recovery form has its own external-conflict
    session and registration independent of that reference.

26. **"Watcher degradation" means what the frontend can observe** [Q6]: no lifecycle adopted, a failed
    subscription, lost history, observations the window cannot safely apply. **No eighteenth
    command**; 2d-6 records that it cannot display polling status; `WatchStatusView` is deferred to
    an unnamed observability phase.

27. **Nine states, each with a place** [Q6]: `stale` and `unavailable` in the sidebar row and the
    affected header (the latter keeping the last projection and showing the typed reason); `removed`
    in the retained surface header plus the selection notice, with no invented row; path drift,
    `notWatched`, a failed registration, lost history and a wanted membership reload as workspace
    banners; a retained observation or uncertain write on the affected surface, with a workspace-level
    route once its surface has closed.

28. **`watchState` and a sanitized registration state are exposed through `BrowserState`, and one
    coordinator state-change notification feeds a `BrowserState` revision signal** [Q6] rather than
    copied booleans. It must cover asynchronous subscription rejection and every transition, and **a
    typed callback cannot force every mutation site to call it** — tests do, without touching
    selection.

29. **Two reload controls, separate intents, both narrow `BrowserState` request methods** [Q6]:
    membership refresh and lost-history recovery each delegate to the coordinator's retained original
    request and ultimately the existing `open()`; neither accepts a displayed path; both recheck
    registry, outstanding writes, lifecycle and disposal at execution; an open surface refuses with an
    explanation; closing the final surface permits without triggering.

30. **Removal keeps the narrowed changed-observation protocol and passes typed target status
    separately** [Q6]; the surface transition invalidates submissions and pending confirmations while
    retaining draft, request or candidate; no disk text is fabricated.

31. **The last row disappearing must not destroy `DetailPane`** [Q6]: the composition stays mounted
    while any retained surface exists, even over an empty document list (§5.2).

32. **A `stale` file whose surface has closed is reread on explicit ask through a new guarded request
    delegating to `rereadUnderGuard`** [Q6], never through `rereadDocument`'s `ALWAYS_PERMITTED`
    (`workspace.svelte.ts:4500`); every guard is rechecked immediately before installation. A fresh
    accepted observation may still take the automatic clean path when every guard permits.

33. **The foreground source is 2d-6's, as one sub-step, and it is DOM `visibilitychange` plus window
    `focus`** [Q7]: synchronous subscribe and removal, nothing at construction, no timer (the pump
    coalesces). DOM listeners need no Tauri permission; `onFocusChanged` is `async` and registers
    focus and blur separately (`window.js:1724`), so it cannot meet the synchronous contract and the
    coordinator comment saying otherwise is corrected. One module budgeted then measured; no
    permission widens; it is a **foreground fallback**. A mounted case proves dispatched events request
    drains and unmount removes listeners; **it cannot prove WKWebView emits them on real foregrounding
    or that an occluded wake is recovered**. No window-close mechanism here.

34. **The mounted matrix is nine concrete obligations over named suites** [Q8]: three in
    `DetailPane.test.ts` (each kind opened through real controls and delivered through the real
    boundary; unknown creator, cross-file and same-file recovery; raw refresh, raw editor conflict,
    close/reopen isolation); each surface's suite (cannot submit, every choice invokes its transition,
    supersession withdraws the warning, three adoption effects); `RestorePane.test.ts`;
    `RecoveryPanel.test.ts`; workspace/coordinator plus mounted integration; `AppShell.test.ts`
    (banners, both reloads, foreground, last-document removal); a sidebar/status suite. A composition
    test must not merely pass a conflict prop.

35. **"In English and Spanish" means interaction cases parameterized over both locales asserting
    labels and sentences in each, plus a locale switch on a mounted panel that preserves its
    session** [Q8]. Safety-critical sentences are pinned with reviewed literal EN/ES expectations;
    **the fixtures protect approved wording and do not prove translation quality** (R35).

36. **`invoked` stays exact zero in injected suites; `AppShell.test.ts` keeps its exact per-case list;
    `DetailPane` cases that start reconciliation replace the blanket zero-drain with finite scripts and
    exact counts** [Q8], never a relaxed allowance.

37. **A scoped architectural check closes the new-file residue** [Q8]: no direct command import from a
    surface component, the composition root allowed, every discovered mounted suite declaring its
    guard, the check pinned to fail on an unguarded synthetic fixture. **A static import check is not
    proof against dynamic execution**, and the record says so.

38. **Component-changing steps owe a narrow actual-window regression reading** [Q8] — the 2d-5
    record's §5.2 qualifies item 6 (§5.3). Reuse the harness and `lifecycle-delivery`, touch none of
    the four instrument paths, inspect a **visible** window in EN and ES, read the changed panels and
    enabled controls, include one hard fixture. A reading claims only what was seen — never wake or
    resume delivery, the native matrix or R38's window half — and names an unreachable state as unread.

39. **New frontend-state `describe*` accessors go in `codes.ts` with `t*` wrappers in `index.ts`;
    existing browser-model accessors stay** [Q9]. Namespaces: `browser.reconciliation.*`,
    `browser.externalDocument.*`, `browser.externalConflict.*`, the existing `browser.conflictOrigin.*`
    and `browser.reapply.*`, `code.unreadableReason.*` for wire reasons. No frontend state under
    `code.*`; key selection exhaustive over typed values; no concatenated key. Operands are the
    exception — a display path, a count, typed unreadable operands — a path is never a command
    argument, and raw errors, exception text and digests never appear beside a refusal.

40. **Seven semantic bounds, pinned in reviewed EN/ES strings** [Q9]: stale needs reconciliation and
    says nothing about what or who; not watched implies no coverage; a failed registration says
    subscribing failed, not that native observation stopped; removed is "no longer present in the
    observed workspace", not "deleted"; uncertainty is an unknown outcome; origin and reapply say no
    write *in response to this observation or action*; supersession says accepted evidence changed.
    Beyond parity: exhaustive accessor tests, placeholder checks, literal expected translations, no
    leakage, mounted locale rerendering, a bilingual prose review. Stated as unpinned: the markup scan
    sees no `.ts` string, parity does not prove meaning, Rust's contract excludes `browser.*`.

41. **Every production sentence a step falsifies is corrected in the diff that falsifies it; a module
    need not otherwise change for it** [Q10]. Eight classes: no-op transitions and their 2d-5-5
    assignments; "nothing calls `drainExternalChanges`"; "no production caller" and "nothing draws
    this"; retained released only by settlement or `open()`; exactly two uncertainty exits; the
    synchronous-Tauri-focus claim; seven-kind and exclusive-surface claims; "no save was attempted".
    Replacements name the actual path and its limits, never a broader guarantee. Left alone:
    `src-tauri/src/main.rs:214-227` (2d-8's) and the citation-drift class (a checker's). Records stay
    records with focused correction passages.

42. **Eleven steps, each owing the gate set; migrations compile at every boundary; shared facilities
    land additively before callers activate** [Q11]. The rung is `1323 / 444 / 2474 / 191` with the
    instrument, `1323 / 443 / 2473 / 190` normalized — recorded, not measured. A reachable `.ts`
    module costs one Vite module and a styled component two, **measured, not assumed**; test counts
    are re-derived per file; 2d-6-11 reports both comparisons.

43. **The review policy is the current one** [Q10]: one adversarial review per implementation phase,
    blockers fixed, verification rerun, the phase closed; no review-of-fix phase, no letter-appended
    phase.

---
## 4. Citation audit

**The consult makes 68 `file:line` citations that name a file, plus 46 abbreviated `:NNN`
continuations that inherit the preceding filename — 114 distinct line references.** Both figures are
this record's own, derived with `rg -o` over `docs/reviews/phase-2d-6-design.md`; every one sits on
one of the eleven **Evidence** lines or on the one prose line (320) that cites `main.rs`. The task
this record was set with expected sixty to ninety rows; 114 is what the file holds, and the
difference is the abbreviated continuations, which the 2d-5 record also counted as rows.

**Every one of the 114 was checked by opening the cited line on the current tree.** A single-line
citation *resolves* if the named construct is at, or begins at, that line; a range resolves if the
construct is substantially within it. **Result: 105 resolve, 9 resolve with a note, 0 do not
resolve.** The nine notes are all one-to-four-line offsets or a doc comment cited for the construct
below it; none changes what the consult used the citation for. The *Consult line* column was derived
with `rg -n` against the file as it stands and re-verified in one pass before this record was
reported; it is not arithmetic over the header.

| # | Consult line | Citation | Cited for | Verdict |
|---|---|---|---|---|
| 1 | 50 | `src/lib/components/DetailPane.svelte:571` | the exact `openSurfaces` assembly | resolves |
| 2 | 50 | `:669` | `tellNobodyYet`, the one no-op transition | resolves |
| 3 | 50 | `:714` | `registerSurface`, registering every kind with it | resolves — the `registerWriteSurface(surface, tellNobodyYet)` call is at 717 |
| 4 | 50 | `src/lib/components/MatchEditor.svelte:317` | child-owned `$state.raw` session | resolves |
| 5 | 50 | `src/lib/browser/observationTransitions.ts:1339` | `tellTheSurfaceAbout` choosing one kind | resolves — `targetingSurfaceFor` at 1344 answers one kind |
| 6 | 50 | `src/lib/browser/workspace.svelte.ts:3140` | settlement discarding the arbitration answer | resolves with a note — 3140 is `case 'arbitrate':`; the discarding `arbitrateHere(...)` call is at 3147 |
| 7 | 50 | `src/lib/components/RecoveryPanel.svelte:178` | recovery owning its session | resolves |
| 8 | 50 | `:281` | `onDestination` changing destination | resolves |
| 9 | 50 | `:363` | `runCreate` sending through the `create` prop | resolves — `sendRecoveryCreate(consented, create, …)` at 372 |
| 10 | 50 | `src/lib/components/MatchEditor.svelte:898` | recovery mounted beside the host outcome | resolves with a note — 898 is inside the leading comment (897-901); the `<RecoveryPanel` element is at 902 |
| 11 | 50 | `src/lib/browser/restore.ts:341` | the seven-kind `OpenWriteSurfaceKind` | resolves |
| 12 | 84 | `src/lib/browser/saveOutcome.ts:810` | `SaveConflictModel` | resolves |
| 13 | 84 | `:863` | `ExternalConflictModel` | resolves |
| 14 | 84 | `:901` | `SaveOutcomeModel` with the save arm only | resolves |
| 15 | 84 | `src/lib/browser/matchEditor.ts:1079` | `conflictOf` answering `SaveConflictModel` | resolves |
| 16 | 84 | `:1105` | the editor's submission gate | resolves with a note — 1105 is `isEditable`, which reads `conflictOf`; `canSave` itself is at 1348 |
| 17 | 84 | `:1417` | `beginSave` refusing through `canSave` | resolves |
| 18 | 84 | `src/lib/browser/rawEditor.ts:607` | the raw `beginSave` gate | resolves |
| 19 | 84 | `src/lib/browser/matchCreation.ts:1061` | `creationRefusal` | resolves |
| 20 | 84 | `src/lib/browser/matchDeletion.ts:580` | `confirmDelete` | resolves |
| 21 | 84 | `src/lib/browser/matchMove.ts:1149` | `refusalGiven` | resolves |
| 22 | 84 | `src/lib/browser/restore.ts:1972` | `restoreRefusal` | resolves |
| 23 | 84 | `:2551` | `permitHolds`, the final permit validation | resolves |
| 24 | 84 | `src/lib/browser/matchEditor.ts:1630` | `keepEditing` clearing `outcome` unconditionally | resolves |
| 25 | 84 | `src/lib/components/MatchEditor.svelte:980` | the panel taking the conflict from `outcome` | resolves with a note — 980 is the `{:else}`; `{@const conflict = outcome}` is 981 |
| 26 | 84 | `docs/decisions/2d-5-5a-notes.md:353` | the nested discriminant not narrowing the parent | resolves |
| 27 | 121 | `src/lib/browser/conflictSource.ts:393` | the six-arm `ObservationVerdict` | resolves — six `kind` literals read at 407-449 |
| 28 | 121 | `:510` | `arbitrateObservation` with `writeOutcomeUncertain` | resolves |
| 29 | 121 | `src/lib/browser/saveOutcome.ts:1137` | `supersedeConflict`'s contract (doc comment) | resolves |
| 30 | 121 | `:1162` | "It withdraws nothing and invalidates nothing" | resolves |
| 31 | 121 | `:1178` | `supersedeConflict` itself | resolves |
| 32 | 121 | `src/lib/browser/workspace.svelte.ts:3107` | the uncertainty charge and clear on settlement | resolves — `add` at 3108, `delete` at 3110 |
| 33 | 121 | `:4040` | adoption checking the standing origin | resolves |
| 34 | 121 | `docs/decisions/2d-5-5b-notes.md:218` | item 4, "cleared by exactly two things" | resolves |
| 35 | 121 | `:281` | item 13, the exception-safe close | resolves |
| 36 | 137 | `src/lib/browser/workspace.svelte.ts:3032` | `retainObservation` carrying `arrival` | resolves |
| 37 | 137 | `:4119` | `observeExternalChange` capturing the generation | resolves |
| 38 | 137 | `:3123` | settlement reusing the retained generation | resolves |
| 39 | 137 | `:3142` | the comment saying why | resolves |
| 40 | 137 | `:4109` | public observation reaching arbitration with no command | resolves |
| 41 | 137 | `docs/decisions/2d-5-5b-notes.md:291` | item 14, the stranded re-entrancy case | resolves |
| 42 | 181 | `src/lib/browser/reapply.ts:309` | `beginReapply` taking `SaveConflictModel` | resolves |
| 43 | 181 | `:500` | `reapplyEvidenceFor` with the standing guard | resolves |
| 44 | 181 | `:526` | `evidenceOf` switching on the origin | resolves |
| 45 | 181 | `src/lib/ipc/types.ts:2877` | `CorrespondenceEntry` with `base`, `exact`, `editor` | resolves |
| 46 | 181 | `src/lib/browser/matchEditor.ts:2081` | the editor's `reapplyToDiskVersion` | resolves |
| 47 | 181 | `src/lib/browser/matchCreation.ts:1603` | the creator's | resolves |
| 48 | 181 | `src/lib/browser/matchMove.ts:1797` | the mover's | resolves |
| 49 | 181 | `src/lib/browser/matchCreation.ts:643` | unknown creation using an empty base | resolves with a note — `startMatchCreation` begins at 643; the `revisionOf(destinations, chosen)` call is at 669 |
| 50 | 181 | `:685` | the empty-revision helper's contract | resolves |
| 51 | 181 | `src/lib/browser/saveOutcome.ts:1123` | the false `changedElsewhere` producer | resolves — the literal is at 1124 inside the array opened at 1123 |
| 52 | 181 | `src/lib/i18n/en.json:161` | its translation saying the save was refused | resolves |
| 53 | 181 | `:152` | "Nothing was written" on `noCorrespondence` | resolves |
| 54 | 181 | `:155` | the superseded sentence | resolves |
| 55 | 181 | `:199` | "No save was attempted" | resolves |
| 56 | 181 | `src/lib/browser/recovery.ts:832` | `RecoveryOrigin` | resolves |
| 57 | 215 | `src/lib/browser/workspace.svelte.ts:2517` | the `externalStatuses` mirror | resolves |
| 58 | 215 | `:2545` | the `pathDrift` mirror | resolves |
| 59 | 215 | `:5389` | `externalDocumentStatus` reader | resolves |
| 60 | 215 | `:5400` | `reconciliationBlock`, unmirrored | resolves |
| 61 | 215 | `src/lib/browser/reconciliationCoordinator.ts:1821` | `watchState()` | resolves |
| 62 | 215 | `:1831` | `registration()` | resolves |
| 63 | 215 | `:1859` | `block()` | resolves |
| 64 | 215 | `:1595` | the stored failed registration | resolves |
| 65 | 215 | `:941` | lost-history reopening from the retained request | resolves — `host.reopenWorkspace(openRequest)` at 972 |
| 66 | 215 | `src-tauri/src/watch.rs:476` | native status being test-facing | resolves with a note — 476 is a blank doc line; the comment begins at 475, the sentence at 479-481, `WatchStatusView` at 486 |
| 67 | 215 | `src/lib/ipc/types.ts:3077` | the batch fields | resolves |
| 68 | 215 | `src/lib/browser/workspace.svelte.ts:3460` | `removeDocumentFromWindow` | resolves |
| 69 | 215 | `src/lib/components/AppShell.svelte:131` | the shell leaving the panes on an empty list | resolves |
| 70 | 215 | `src/lib/browser/workspace.svelte.ts:3626` | `rereadUnderGuard` | resolves |
| 71 | 215 | `:4500` | `rereadDocument` passing `ALWAYS_PERMITTED` | resolves |
| 72 | 233 | `src/lib/components/AppShell.svelte:51` | the inert production argument | resolves — `INERT_FOREGROUND_EVENTS` at 56 |
| 73 | 233 | `src/lib/browser/reconciliationCoordinator.ts:393` | the synchronous contract and the inaccurate claim | resolves — the claim is 395-397 |
| 74 | 233 | `:1675` | foreground subscription | resolves |
| 75 | 233 | `:1733` | synchronous disposal | resolves |
| 76 | 233 | `node_modules/@tauri-apps/api/window.js:1724` | `async onFocusChanged` | resolves |
| 77 | 233 | `src-tauri/capabilities/default.json:6` | the two permissions | resolves |
| 78 | 233 | `docs/decisions/2d-5-7b-window-reading.md:420` | §5, the unobserved close and wake | resolves |
| 79 | 269 | `docs/reviews/phase-2d-design.md:128` | item 6 | resolves |
| 80 | 269 | `docs/decisions/2d-5-split-notes.md:458` | §5.2, the narrow-window requirement | resolves |
| 81 | 269 | `src/lib/components/DetailPane.test.ts:587` | the exact-zero `afterEach` | resolves |
| 82 | 269 | `src/lib/components/AppShell.test.ts:386` | the exact per-case list | resolves |
| 83 | 269 | `src/lib/components/RestorePane.test.ts:926` | the mounted locale switch | resolves |
| 84 | 269 | `:1542` | the `LOCALES` product | resolves |
| 85 | 269 | `:1570` | `it.each(LOCALES)` | resolves |
| 86 | 269 | `docs/decisions/2d-5-7b-window-reading.md:431` | "says nothing about what a window draws" | resolves |
| 87 | 269 | `:543` | the harness tree | resolves |
| 88 | 269 | `:548` | reusing `lifecycle-delivery` | resolves |
| 89 | 269 | `PROGRESS.md:125` | R32 | resolves |
| 90 | 269 | `:127` | R35 | resolves |
| 91 | 301 | `src/lib/i18n/index.ts:808` | the origin accessor and its contract | resolves with a note — 808 opens the doc comment; `tConflictOriginMessage` is at 826 |
| 92 | 301 | `:1409` | the no-operand contract | resolves |
| 93 | 301 | `:1423` | `describeExternalEvidenceRefusal` | resolves |
| 94 | 301 | `:1458` | `describeSupersededEvidence` | resolves |
| 95 | 301 | `src/lib/i18n/codes.ts:1634` | `describeUnreadableReason` with operands | resolves |
| 96 | 301 | `scripts/lint/hardcoded-strings.ts:19` | the scanner's stated holes | resolves |
| 97 | 301 | `src/lib/i18n/dictionaries.test.ts:11` | the untranslated-value heuristic's limit | resolves |
| 98 | 301 | `src-tauri/src/dictionary_contract.rs:91` | non-`code.` keys excluded | resolves |
| 99 | 320 | `src-tauri/src/main.rs:214-227` | the false `"permissions": []` paragraph | resolves |
| 100 | 324 | `src/lib/browser/workspace.svelte.ts:346` | "Nothing in this file calls it" | resolves |
| 101 | 324 | `:3451` | the removal hand-off to 2d-5-5 | resolves — the hand-off sentence ends at 3456 |
| 102 | 324 | `src/lib/browser/observationTransitions.ts:580` | "every registered transition is a no-op, which 2d-5-5 changes" | resolves |
| 103 | 324 | `src/lib/browser/writeSurfaceRegistry.ts:108` | the same hand-off | resolves |
| 104 | 324 | `src/lib/components/DetailPane.svelte:658` | "2d-5-5's work" | resolves |
| 105 | 324 | `src/lib/browser/saveOutcome.ts:855` | "Nothing in production builds one yet" | resolves |
| 106 | 324 | `src/lib/i18n/index.ts:818` | "Nothing draws this yet" | resolves |
| 107 | 324 | `:1414` | the same, on the refusal accessor | resolves |
| 108 | 324 | `:1451` | the same, on the superseded accessor | resolves |
| 109 | 324 | `PROGRESS.md:266` | open item 7, the instrument-file exception | resolves |
| 110 | 324 | `:237` | open item 1, the citation debt | resolves |
| 111 | 324 | `CLAUDE.md:237` | the current review policy | resolves with a note — 237 is the last line of §6; §7 begins at 239 and the policy sentence is 241-246 |
| 112 | 389 | `PROGRESS.md:311` | the live rung and the instrument's contribution | resolves with a note — the rung is at 311; the contribution (Rust 0, +1, +1, +1) is at 319-320 of the same paragraph |
| 113 | 389 | `PROGRESS.md:303` | per-file scanner-count accounting | resolves — the rule runs 303-305 |
| 114 | 389 | `CLAUDE.md:91` | module cost and the pristine baseline | resolves — the sentence runs 90-92 |

Three notes where this record adds to what the consult wrote rather than disagreeing with it:

- **Rows 1-3.** The seven registry keys were read (`matchEditor`, `matchCreator`, `matchDeleter`,
  `matchMover`, `matchDuplicator`, `rawEditor`, `restore`) and `RecoveryPanel` is among them nowhere:
  it is mounted by `MatchEditor.svelte:902` and `MatchCreator.svelte:883` and registers nothing. That
  is what makes entry 3 a correction rather than a restatement.
- **Row 16.** `isEditable` is a truthful gate — it reads `conflictOf` — but it is the *editing*
  eligibility, not the submission boundary entry 8 names; `canSave` at `matchEditor.ts:1348` and
  `beginSave` at `:1417` are. A test written to row 16 alone would prove the wrong thing.
- **Row 66.** The brief's own `watch.rs:476-503` range and the consult's `:476` agree on the
  construct; both begin one line inside its doc comment. Nothing turns on it.

---


## 5. Corrections — where the consult overrides an earlier document

`docs/reviews/phase-2d-design.md` item 6 and Q8, `2d-5-split-notes.md` and `PROGRESS.md`'s *Next
action* are the earlier statements of this phase. The consult binds where they disagree. Nine
places: the first two named in its verdict paragraph, the rest found by reading the reply against the
three documents.

### 5.1 Eight kinds, not seven — recovery is a live write surface

`phase-2d-design.md:128` says "all seven write surfaces"; `2d-5-split-notes.md` entries 1, 3 and 12
treat the seven kinds as complete; the brief's §3 says `busy` "keeps the seven mutually exclusive".
**The consult rules that `RecoveryPanel` owns a session, chooses its own destination and calls
`BrowserState.createMatch`, and can stay open beside its originating editor** — so an editor over A
does not protect a recovery destination B. **Replaced by** §3 entry 3. The ruling wins because the
seven was a description of the registry, not a proof of completeness — the failure
`phase-2d-design.md` Q8 calls this phase's sharpest — and audit rows 7-10 show the surface it missed.

### 5.2 Removing the last document must not unmount retained sessions

`2d-5-split-notes.md` entry 12 ("the draft/operation/candidate preserved") and `PROGRESS.md`'s
account of 2d-5-4 (a removed file "leaves any surface over it registered and untold") both assume
the surface survives. **`AppShell.svelte:131` switches away from the panes the moment
`browser.documents.length === 0`**, unmounting `DetailPane` and every child session. **Replaced by**
§3 entry 31. The ruling wins because `BrowserState`'s preservation was defeated by its renderer — a
rule inside a component no model test could see, the class `CLAUDE.md` §6 names.

### 5.3 "Not its screen reading" is qualified: component-changing steps owe a window reading

`phase-2d-design.md:128` ends "This is the phase's mounted evidence, not its screen reading";
`2d-5-split-notes.md` §5.2 rules a step touching components owes a narrow window regression reading.
**The consult rules §5.2 qualifies item 6**: mounted evidence stays the principal evidence and
2d-6-6 through 2d-6-10 each owe a visible-window reading too. The ruling wins because item 6 predates
the harness and §5.2 postdates it; both agree the full matrix is 2d-7's (§3 entry 38).

### 5.4 "Watcher degradation" is narrowed to what the frontend can observe

Item 6 says "draw … watcher degradation"; the brief's §3 shows the native polling fallback is not on
the wire. **The consult rules no eighteenth command and that 2d-6 records it cannot display polling
status** (§3 entry 26). The ruling wins because a state the wire does not carry needs Rust,
`wire_contract.rs`, the command table and `dispatch_check.rs` — an observability feature, not a
components phase.

### 5.5 Uncertainty has three exits, not two

`PROGRESS.md` obligation (2) says an uncertain write is one "only a later write can clear", after
`2d-5-5b-notes.md:218` ("cleared by exactly two things") and `:281`. **The consult adds an explicit,
non-installing acknowledgement** (§3 entries 14-15). The ruling wins because the two-exit rule left a
file uncertain for a whole session with no person able to act on evidence they had looked at — 5b's
own recorded cost — and the third exit spends nothing that installs.

### 5.6 A retained observation has a third release: a person's retry

`PROGRESS.md` obligation (3) and `2d-5-5b-notes.md:291` say a retained observation is released only
by a settlement or `open()` and defer re-arbitration to "a deliberate later decision". **The consult
takes it now** (§3 entries 16-18). The ruling wins because 2d-6 must draw the retained state (entry
27) and could offer no way out while the decision stayed deferred.

### 5.7 Ruling 26's withdrawal is not discharged by `adoptDiskVersion`'s refusal alone

The 2d-5 record's entry 26 requires "any pending reload confirmation withdrawn" on supersession, and
`saveOutcome.ts:1162` records 5b's discharge: `supersedeConflict` "withdraws nothing" because
`adoptDiskVersion` refuses an outlived origin. **The consult rules that necessary but not
sufficient**: `awaitingReloadConfirmation` is session state, and the surface transition must reset it
(§3 entry 12). The ruling wins because a refusal at the door leaves a warning on screen saying the
wrong thing until the person presses it.

### 5.8 The foreground source is a 2d-6 sub-step, and its premise was wrong

`PROGRESS.md` open item 8 calls the source "one module and one deliberate phase", and it and the
brief's Q7 offer Tauri's `onFocusChanged` as an equal alternative listening "through the
already-granted event permissions". **The consult rules it 2d-6-10, DOM-only**: DOM listeners need no
Tauri permission, and `onFocusChanged` is `async` (`window.js:1724`), so it cannot meet the
synchronous contract `reconciliationCoordinator.ts:395-397` claims it meets. The ruling wins because
2d-6 is the only phase wiring components before 2d-7, and the coordinator's comment is false on the
installed `node_modules`.

### 5.9 The first sentence of item 6 is already half done

Item 6 opens "Wire the coordinator through the shell/`DetailPane`…". 2d-5-7a activated it and 2d-5-2
made the registry exact. **The consult's scope is the telling half only** — delivery, arbitration,
the surface-side answer ("do not treat it as seven callbacks plus translated markup"). A narrowing
the 2d-5 record already implied (`PROGRESS.md` open item 5), stated so no step re-does the start.

---

## 6. What the consult did not settle

**No item here commissions a review round**; none names a correctness defect in a source file.

**Permissions rather than obligations** — a later step is free either way:

1. **A fresh accepted observation may still take the automatic clean path when every guard permits**
   (Q6, entry 32). What is *not* the step's call: a `stale` file whose surface has closed is reread
   only on an explicit, guarded request — **closure alone triggers no reread**, and neither does a
   reactive effect (consult lines 119, 125, 213). This item once read as if automatic-versus-requested
   were open; the record's own review caught it (§8).
2. **Shared description helpers may be extracted; a generic conflict component may not** (entry 10).
3. **A module need not otherwise change to receive a factual correction** (entry 41) — a permission
   to touch, not an obligation to sweep before 2d-6-11.
4. **Display operands are permitted where meaningful** (entry 39); which states carry one is 2d-6-9's.
5. **`acknowledgeWriteUncertainty` and `retryRetainedObservation` are suggested names** ("for
   example"); the contracts bind, the identifiers do not.

**Deferred out of 2d-6:**

6. **The eighteenth command exposing `WatchStatusView`** — to "a separate observability feature", no
   phase named.
7. **A window-close lifecycle mechanism** — Q7: "Svelte unmount disposal and actual application quit
   remain distinct obligations"; no phase named (open item 10 stays open).
8. **`src-tauri/src/main.rs:214-227`** — to 2d-8, with the instrument.
9. **The citation-drift class** — to "its deliberate checker work", no phase named (open item 1).
10. **The native matrix, real wake and resume delivery, R38's window half** — to 2d-7.

**Gaps and overlaps in the split**, recorded rather than repaired:

11. **No step names the `BrowserState` exposure of `watchState()` and the sanitized registration
    state — *actionable*.** Entry 28 requires it; 2d-6-1 says "reactive coordinator notifications"
    and 2d-6-9 "draw … degradation", and neither claims the two readers. They are model-side and
    precede the drawing, so 2d-6-1 is the natural owner and must claim it explicitly.
12. **No model step names the per-surface `removed`-status transition — *actionable*.** Entry 30
    requires each surface model to invalidate submissions on a typed target status; 2d-6-2 to 2d-6-5
    list external conflicts only, and 2d-6-9 touches the eight renderers "only for typed status
    presentation", which presumes the transition exists. Each model step claims its surface's, or
    2d-6-9 grows model work.
13. **Shell retention is delivered once and evidenced twice — *recorded only*.** 2d-6-6 delivers it;
    2d-6-9's "empty-workspace retention" and the matrix's `AppShell.test.ts` row re-assert it.
    Acceptable as long as 2d-6-9 re-asserts and does not re-implement.
14. **Per-diff corrections and the final sweep overlap by design — *recorded only*.** A 2d-6-11 sweep
    that finds anything is evidence an earlier step missed its own obligation under entry 41.
15. **Three component steps ship a withheld reload before its exit exists — *recorded only*.** A
    `raisedWithoutReload` conflict drawn in 2d-6-6, -7 or -8 has reload withheld (entry 11) and the
    acknowledgement control is 2d-6-9's; until then the panel can say why only by borrowing a key
    2d-6-9 owns. Each step says which it does.
16. **2d-6-1 carries nine deliverables against a "one worker" bound — *recorded only*.** It is the
    longest step and the one every other depends on; cutting it is the orchestrator's call.

**Asked by the brief and not answered:**

17. **Which `BrowserState` readers gain a mirror** (Q6 (b)) is answered by replacing the question with
    one revision signal. Whether the two existing `$state` mirrors migrate to it or stay is not said.
18. **What the eight `revisionExpected`/`revisionFound` lines become** (Q2) is answered as "observed
    disk revision only" for the external arm, while Q9 forbids a digest beside a *refusal*. Consistent
    (a conflict panel is not a refusal), but the consult does not say so; 2d-6-2 should.

---

## 7. The inherited work items, and the counts this record measured

What the consult did with each of `PROGRESS.md`'s three obligations and open items 0-11, derived by
reading the reply against `PROGRESS.md:218-285`:

| Item | What it is | Disposition | Where |
|---|---|---|---|
| obligation (1) | the 5b pair without a caller; the `ReconciliationWorkspace` member; what `retained` does | **Taken** — member added deliberately; `retained` records a restriction and one sentence | 2d-6-1, 2d-6-6 |
| obligation (2) | `mayHaveWritten` uncertainty with no surface to clear it | **Taken and corrected** (§5.5) | 2d-6-1 (member), 2d-6-9 (control) |
| obligation (3) | a retained observation nobody looks at again | **Taken and corrected** (§5.6) | 2d-6-1 (operation), 2d-6-9 (control) |
| 0 | the withdrawn round's review kept as a record | **Untouched** — a record | — |
| 1 | stale cross-file citations in comments; a checker | **Deferred**, no phase named | — |
| 2 | S11's partial-application window | **Untouched** — a half-applied batch is not mentioned | — |
| 3 | the save arm of `reapplyEvidenceFor` by identity | **Untouched** — Q5 generalizes the entry protocol and forbids the cast; the identity hardening is not named | — |
| 4 | `expected?: never` measured and not applied | **Untouched by name** — Q2 chooses a `source.kind` switch or a tested type guard, leaving the field unapplied | 2d-6-2 to -8 by consequence |
| 5 | seven test-only surfaces of the 2d-5-5 pair | **Taken** — the phase's purpose; the pair's live path is 2d-6-6, the accessors drawn in -6 to -8, the sentences narrowed in -1 | 2d-6-1, 2d-6-6 to -8 |
| 6 | route-guard residue; `AppShell.test.ts` not to be "fixed" | **Taken** — scoped check; exact list preserved by ruling | 2d-6-11 (entries 36-37) |
| 7 | `main.rs:214-227` claims `"permissions": []` | **Deferred to 2d-8**, restated | — |
| 8 | the inert `ForegroundSource` | **Taken and corrected** (§5.8) | 2d-6-10 |
| 9 | "Nothing in this file calls it" on `drainExternalChanges` | **Taken** — a named prose debt (entry 41); already false, so the sweep is its floor | 2d-6-1 at the earliest, 2d-6-11 at the latest |
| 10 | no window-close path runs `dispose()` | **Deferred**, no phase named (Q7) | — |
| 11 | the `fetch` recorder is 2d-7's start | **Untouched** — 2d-7's | — |

Of the 2d-5 record's §6 items the brief named: item 2 (the coordinator's home) was settled by the
steps and is not revisited; item 4 (the blocked state's exit) is taken by entry 29; item 6
(`notWatched` keys) by 2d-6-9's ownership; item 7 (no wake claim from a reading) is reaffirmed by
entry 38. `targetingSurfaceFor`'s inert first-wins guard (`restore.ts:615-616`, archived as "a
property a later step could make live") is superseded rather than made live: entry 3 has the
predicate answer every targeting surface.

**Measured for this record with `rg`, not copied forward:**

| Count | Figure | How |
|---|---|---|
| Citations in the consult naming a file | **68** | `rg -o` for a backticked path ending `:NNN` or `:NNN-NNN` |
| Abbreviated `:NNN` continuations | **46** | `rg -o` for a backticked bare `:NNN` |
| Lines carrying a citation | **12** | the eleven per-question **Evidence** lines (50, 84, 121, 137, 181, 215, 233, 269, 301, 324, 389) plus line 320 |
| `**Evidence:**` markers in the reply | **22** | eleven per question, eleven per step; the per-step ones cite nothing |
| Registry kinds at `DetailPane.svelte:571-617` | **7** | the keys read; `recovery` absent |
| Files carrying `@vitest-environment jsdom` | **11** | the brief says ten; the eleventh is `reveal.test.ts`, a DOM-helper suite mounting no component, so "ten mount a component" stands |
| Suites the Q8 matrix names that do not exist | **1** | a sidebar/status suite — no `Sidebar.test.ts` or `SnippetList.test.ts` |
| `ObservationVerdict` arms | **6** | `kind` literals at `conflictSource.ts:407-449` |

**What that table does not establish**, in the same breath: it counts references and files, not
correctness. A citation that resolves proves the consult read the line it named, not that the design
built on it is sound; nothing does until 2d-6-1 puts the first ruling through a compiler. Nothing in
Vitest prevents the new sidebar suite being created without its invoke guard; entry 37's check is what
would notice, and it does not exist yet either.

*Correction (2d-6-11a):* the check now exists — `scripts/lint/composition-guards.test.ts`. The
sidebar/status suite was created as `ReconciliationStatus.test.ts` with its guard, and the jsdom
inventory now counts thirteen files, not eleven.

---

## 8. This phase's own review, and its one disposition

**Verdict: `ship-with-fixes`, 0 blockers by the script's count, 1 SHOULD-FIX that the reviewer itself
labelled a BLOCKER** — Codex, through `autoclaude-review.sh` on the uncommitted tree, 12-minute budget.
The report is [`docs/reviews/phase-2d-6-design-record-review.md`](../reviews/phase-2d-6-design-record-review.md);
its brief is beside it. The orchestrator treated the finding as a blocker whatever the label, re-derived it
before fixing it, and it held.

| # | Finding | Disposition |
|---|---|---|
| 1 | §6 item 1 declared automatic-versus-requested rereading of a closed-surface `stale` file to be the step's call. The consult settles it: closure alone triggers no reread and neither does a reactive effect; a `stale` file whose surface has closed is reread only on an explicit guarded request, and only a *fresh* accepted observation may take the automatic clean path (`phase-2d-6-design.md:119`, `:125`, `:213`) | **Held, and fixed in §6 item 1**, which now states the obligation and keeps only the genuine permission. Ruling 32 in §3 had stated it correctly all along; the two sections had disagreed |

**No fix touched a source file**, and under `CLAUDE.md` §7 a fix is not owed a review: the phase closes
with this edit. The reviewer's own coverage statement, in its words: it compared all 43 rulings and the
eleven steps against the consult, opened 35 of the 114 audit rows including all nine annotated ones,
verified eight consult-line references, spot-checked six facts in the brief, found no real-config
quotation, changed no file and ran no gate. It makes no claim about whether the consult's design rulings
are **sound as design**: nothing was built and no window was opened. 2d-6-1 is the first step that tests
any of them against a compiler.
