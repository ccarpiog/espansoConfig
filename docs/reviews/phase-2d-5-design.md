# Phase 2d-5 — the browser coordinator and the open-write-surface registry, design consult

**Reviewer: Codex (GPT-5 family), high effort, dispatched 2026-08-31 by `/autoclaude-opus` in driven
mode via the companion CLI**, per `docs/decisions/codex-dispatch-procedure.md`. The brief is
`docs/decisions/2d-5-design-brief.md`, written for this consult and reproduced there in full. Codex
ran read-only and wrote no file; its final message is reproduced below verbatim, with only the two
edits that procedure permits — its own `## VERDICT` demoted to `###` so this file keeps one `##` per
round, and the `Resume in Codex` trailer dropped with the session ID kept.

**It is the second provider to look at this material since 2d-4a began.** `PROGRESS.md` records
**fifteen** consecutive review rounds run on Opus with no second provider, the last outside look
being 2d-4b's own design consult on 2026-08-30. That figure is quoted from the checkpoint, not
re-derived here. That coverage bound is what this consult discharges, and it discharges it for
the *design* only — no review round of 2d-5's code has run on a second provider.

**This consult binds Phase 2d-5.** Where it rules against `docs/reviews/phase-2d-design.md`, against
`PROGRESS.md`'s statement of the phase, or against a habit of this project, the ruling wins unless a
later record says why not. Two places where it does rule against an earlier document are called out
in `docs/decisions/2d-5-split-notes.md`; read that file's correction section before treating
`phase-2d-design.md` step 5 as the spec.

**No gate was run for this consult and none is claimed.** Codex was forbidden Cargo and npm by the
brief, ran neither, and said so itself, immediately under its verdict
(`docs/reviews/phase-2d-5-design.md:33`). Every figure it quotes is read from a
file, not measured.

---

### VERDICT

Phase 2d-5 should add one coordinator-owned live-surface registry, made complete for the seven known kinds by an exact typed assembly in `DetailPane`, with the creator represented in that same registry by a discriminated unknown/known target. Reconciliation should use a session `{ epoch, watermark, discarded }` plus per-document accepted sequences, a single-flight drain pump, guarded use of the existing reread installation path, and one discriminated conflict source. Loss requires a whole-workspace reload when no write surface is open and a preserved, user-resolved blocked state when one is. `adoptDiskVersion` remains the only confirmed-install door and `conflictChoicesFor` the only choice-list producer.

Per instruction, I ran no Cargo/npm gate and no window; the rulings below are from repository inspection.

### Q1 — The exhaustive `OpenWriteSurface` registry

**Ruling:** The coordinator owns the live registry, while one exact, `OpenWriteSurfaceKind`-keyed assembly in `DetailPane` makes omission of any currently declared kind a compile error. Registration alone is insufficient; the required binding/prop shape is the construction check.

Use a keyed registry of live surface instances, not a caller-supplied array:

```ts
registerWriteSurface(surface, transition): UnregisterWriteSurface
```

A key or lease is necessary so reopening one kind cannot unregister a newer instance. `DetailPane` should construct an exact binding object using `satisfies Record<OpenWriteSurfaceKind, ...>` and pass required reporting props where state lives inside a child. This accepts option (b) as the exhaustiveness mechanism and uses option (a) only for ownership and lifetime.

That forces all seven members currently in `OpenWriteSurfaceKind` to appear in the composition file. It cannot force a future component author to classify a new component as a write surface, nor can it force a child to invoke its required reporter correctly; mounted tests must establish those facts. The present producer demonstrates why merely asking it again is not a solution: it emits six entries, omits the creator, and expressly admits that completeness is unchecked, while `busy` independently enumerates seven surfaces (`src/lib/components/DetailPane.svelte:453-494`, `src/lib/components/DetailPane.svelte:649-672`). The underlying type already contains seven kinds, including `matchCreator` (`src/lib/browser/restore.ts:329-352`).

Widen `OpenWriteSurface` into one discriminated union, not two registries:

```ts
type OpenWriteSurface =
  | {
      kind: 'matchCreator';
      target:
        | { kind: 'unknown' }
        | { kind: 'document'; document: DocumentId };
    }
  | {
      kind: Exclude<OpenWriteSurfaceKind, 'matchCreator'>;
      target: { kind: 'document'; document: DocumentId };
    };
```

The creator reports `unknown` until `onDestination` chooses its document, then replaces that registry entry synchronously; today the choice remains internal to `MatchCreator` (`src/lib/components/MatchCreator.svelte:329-336`). Keeping `document` required cannot represent this state (`src/lib/browser/restore.ts:373-383`).

Use two exhaustive predicates over the same union:

- Watcher policy treats an unknown creator as targeting every creator-eligible match document.
- Restore competition treats an unknown creator as competing with no document; after a destination is known, it competes only with that document.

That second rule preserves 2c-5’s shipped behavior. `competingSurfaceFor` must explicitly switch over the target discriminant, with a `never` terminus, rather than relying on `surface.document === document`; otherwise widening the type could silently turn an unknown creator into either a universal restore refusal or an accidental non-case. The existing contract deliberately says a creator without a chosen destination competes with no restore (`src/lib/browser/restore.ts:363-376`), and the current comparison assumes every entry has a document (`src/lib/browser/restore.ts:404-414`).

### Q2 — Watermark, epoch, and accepted sequences

**Ruling:** Keep both states, with distinct names and invariants: one session cursor `{ epoch, watermark, lastDiscarded }`, plus `acceptedSequenceByDocument`. They may contain different numbers because they answer different questions; treating that as disagreement would be a design error.

The session watermark is the `afterSequence` for the next drain. After accepting a batch for the shown epoch, store its `newest_sequence`, including for an empty batch. That is the queue acknowledgement that prevents re-reading. The per-document map records the highest observation whose transition that document has accepted; it makes older observations inert even when the session watermark has advanced beyond them. The batch contract explicitly distinguishes the non-falling per-epoch watermark from observation sequences (`src/lib/ipc/types.ts:3068-3110`), and the wrapper requires the caller’s watermark rather than owning one (`src/lib/ipc/commands.ts:903-922`).

The coordinator learns the shown epoch from the first successful drain associated with the successful `open()` generation. `open_workspace` cannot supply it: `WorkspaceSummary` contains only the root and counts (`src/lib/ipc/types.ts:642-656`), and the wrapper returns that summary (`src/lib/ipc/commands.ts:257-270`). Therefore:

1. At `open()` entry, clear the coordinator’s expected epoch, watermark, accepted-sequence map, and handled-discard count.
2. After that `open()` reaches `ready`, request a drain with watermark `0`.
3. If the drain’s captured `openGeneration` is still current, adopt its epoch as the shown epoch.
4. Thereafter, reject an epoch-mismatched wake without draining and reject an epoch-mismatched batch without changing either sequence state.

Before the first post-open batch establishes the epoch, wakes are only reasons to request a drain; their payload must not establish authority. A wake contains no observation and is expressly only a hint (`src/lib/ipc/types.ts:2741-2765`).

An epoch-zero batch is not stale by definition. When returned after a successful current open, it means that workspace has no watcher lifecycle and the batch is necessarily empty; retain epoch `0`, watermark `0`, and expose a typed “not watched” coordinator state for 2d-6 to render. The wire contract says epoch zero means exhaustion prevented a worker from starting (`src/lib/ipc/types.ts:3077-3085`). It must not be presented as ordinary reconciliation coverage.

### Q3 — `discarded`

**Ruling:** A newly increased `discarded` count makes the entire shown workspace untrustworthy. Reload the whole workspace automatically only when no write surface is open; otherwise preserve every surface and draft, suspend observation application, and expose a workspace-reload-required state for the person to resolve.

Handle `discarded` before processing any observations in the batch. Per-document rereads are not an adequate recovery: the queue may have lost the only observation for an addition or removal, and Rust explicitly binds a discarded entry to a whole-workspace reload (`src-tauri/src/reconciliation.rs:241-248`, `src-tauri/src/reconciliation.rs:1160-1169`).

When the registry is empty, re-run `open()` with the original request retained by the coordinator, not `summary.root`. The latter is a lossy `WirePath` rendering and is not a safe round trip into a command argument (`src/lib/ipc/types.ts:643-645`). A true open clears documents, projections, selection, viewer state, and per-document projection generations, which is exactly the identity reset required after lost membership history (`src/lib/browser/workspace.svelte.ts:2174-2207`).

When any write surface is open:

- Do not call `open()`.
- Do not manufacture per-surface watcher conflicts: the lost entry means there may be no trustworthy disk snapshot or correspondence evidence.
- Preserve the draft, operation, or restore candidate.
- Mark reconciliation as blocked by lost history and stop applying subsequent per-document observations.
- Permit the whole reload only after the surfaces are closed or their retained values have been explicitly dealt with.

That is option (c) while a surface is open and option (a) once it is safe. Unknown-target creator counts as open and therefore blocks the reload.

Remember `lastHandledDiscarded` within the epoch. A repeated batch with the same cumulative non-zero value must not prompt or reopen twice; a strictly larger value updates the existing loss state. Advance the session watermark while in that state so the same retained queue is not repeatedly fetched, but do not resume incremental reconciliation until a successful whole open establishes a new epoch. `discarded` is cumulative and monotonic, not “lost since last drain” (`src/lib/ipc/types.ts:3101-3110`).

### Q4 — Drain ordering and disposal

**Ruling:** All four triggers call one idempotent `requestDrain`; a single-flight pump serializes actual command calls, coalesces duplicate triggers, and performs at most one follow-up drain when triggers arrive during an in-flight call.

The four triggers are mandatory:

- Start event registration first. When `subscribe` resolves, retain its unlisten function and request a drain.
- Every successful current `open()` requests a drain after loading completes.
- Window foreground and document-visible/resume signals request a drain.
- A wake requests a drain only when its epoch is current; before the first batch establishes an epoch, it may request a drain but remains non-authoritative.

Registration and open may complete in either order. Each records a pending reason; the pump executes them in arrival order, or one physical drain may satisfy both when neither has started. This closes both delivery gaps without assuming a wake corresponds one-to-one with a queue entry. The deferred obligations are explicitly listed in the event adapter (`src/lib/ipc/events.ts:21-35`), and Rust deliberately drops failed wakes because those fallback drains exist (`src-tauri/src/events.rs:47-59`).

Use a boolean “drain requested” plus one in-flight promise:

1. Set `requested = true`.
2. If a pump is already running, return.
3. Clear `requested`, drain with the current watermark, and apply or reject the answer.
4. Repeat once more if any trigger set `requested` during the await.

Thus ten duplicate wakes before a drain produce one call; ten during it produce at most one follow-up. A wake is only a hint and does not promise queue growth (`src/lib/ipc/types.ts:2759-2765`).

Choose single-flight serialization over concurrent drains. It prevents a later invocation’s answer from being installed before an earlier invocation’s answer and removes the need to reproduce a generation check around every observation transition. Its cost is head-of-line latency and sometimes one redundant follow-up drain. Still capture `openGeneration`, expected epoch, and disposal state before the await: single-flight prevents drain-versus-drain reordering, not an `open()` or disposal making the only drain stale. The existing reread path demonstrates the required three-capture discipline for asynchronous installation (`src/lib/browser/workspace.svelte.ts:2382-2424`).

The coordinator owns the registration race:

- `dispose()` marks the coordinator disposed and calls an already-held unlisten exactly once.
- If `subscribe()` resolves later, its continuation sees `disposed` and immediately calls the received unlisten instead of storing it.
- Foreground listeners are removed synchronously.
- Pending or returned drains perform no transition after disposal.

Expose `start()` and `dispose()` on `BrowserState`; `start()` must be idempotent. `AppShell` should call `start()`, call `open(null)`, and return `browser.dispose` from `onMount`. Today it creates the state and opens it but returns no cleanup (`src/lib/components/AppShell.svelte:24-31`). The event wrapper correctly leaves lifetime ownership to its caller (`src/lib/ipc/events.ts:129-180`).

### Q5 — Automatic reload versus conflict

**Ruling:** Add `applyExternalObservation`, but make its clean-path installation delegate to the existing reread machinery. Refactor that machinery to accept an extra coordinator guard checked immediately before `installView`; do not install the batch projection directly.

The transition should:

1. Arbitrate the observation’s epoch and per-document sequence.
2. Re-read the live registry.
3. If a surface may target the document, send the observation to that surface’s external-conflict transition and install no projection.
4. Otherwise run the guarded reread path.

Reuse the existing `rereadDocument` sequence: capture before the await, reject stale answers, then `forgetFileText` → `installView` → `repairAfter` → `readFileText` (`src/lib/browser/workspace.svelte.ts:2382-2434`). Extracting a private guarded helper is acceptable; assigning the observation’s `disk` directly is not.

The new guard must additionally capture the registry generation and accepted sequence for the document. Immediately before installation it rechecks:

- same open generation and epoch;
- this observation remains the newest accepted one;
- projection generation has not moved;
- registry generation has not moved;
- no currently open surface can target the document.

If a surface opens during the read, the answer is not installed; re-run arbitration against the retained observation and put the surface on its conflict path. The check and `installView` must remain one synchronous block.

The extra disk read is the accepted cost. The batch’s projection is snapshot-exact, but direct installation would bypass the established invalidation and selection discipline. `installView` invalidates only the affected projection and drops paired raw text (`src/lib/browser/workspace.svelte.ts:1780-1835`); selection intent remains the separate global counter (`src/lib/browser/workspace.svelte.ts:1690-1723`).

The truthful conservative sentence is: “The coordinator knows that a write surface capable of targeting this document is open; it cannot tell whether that surface has been edited, so it will not reload automatically.” That does not claim a dirty draft. The application’s existing predicate likewise measures an open editor, dirty or pristine (`src/lib/browser/matchDuplication.ts:300-339`).

The raw viewer is read-only and may refresh automatically. The raw editor is a write surface and takes the conflict path even when pristine. The current registry already lists `rawEditor`, while the viewer is ordinary browser state (`src/lib/components/DetailPane.svelte:473-493`, `src/lib/browser/workspace.svelte.ts:669-715`).

### Q6 — Watcher-origin conflicts

**Ruling:** Replace the singular `ConflictResult` source with a discriminated `ConflictSource`; do not structurally widen the save type. Move save-only evidence behind the save arm and generalize every identity-keyed map to the source union.

Use a stable source value:

```ts
type ConflictSource =
  | { readonly kind: 'save'; readonly conflict: ConflictResult }
  | {
      readonly kind: 'externalChange';
      readonly observation: ExternalConflictObservation;
    };
```

`ExternalConflictObservation` should be the already-narrowed `Changed`/`Addressable`/`Projected` snapshot containing its sequence, revision, disk text, disk projection, findings, and correspondence table.

A save source needs a memoized wrapper keyed by the original `ConflictResult`, so repeated descriptions of one wire conflict recover the same `ConflictSource` object. Then:

- `ConflictModel.source` becomes `ConflictSource`.
- `conflictOrigins` becomes `WeakMap<ConflictSource, {document, generation}>`.
- The reapply authorization memo becomes `WeakMap<ConflictSource, ReloadConfirmation>`.
- All six save-conflict callers obtain the memoized save source before calling `rememberTheConflict`.

The six current registration sites are `src/lib/browser/workspace.svelte.ts:2546`, `:2638`, `:2715`, `:2775`, `:2898`, and `:2980`; the present map accepts only `ConflictResult` (`src/lib/browser/workspace.svelte.ts:1583-1597`). The current model also requires save-only `expected`, `found`, and `changedAgain` fields and types `source` as `ConflictResult` (`src/lib/browser/saveOutcome.ts:697-775`). Those values should move under, or be derived only from, the `save` arm; optional top-level fields would permit the two origins to masquerade as one another.

Origin may change:

- The messages.
- Whether expected/found revisions exist.
- The provenance and eligibility of reapply evidence.
- The statement explaining why the conflict exists.

A save conflict may say the attempt wrote nothing. An external conflict may say only that the file changed while the surface was open and that no write was made in response to that observation. Reapply code must switch on the origin: save evidence comes from `ConflictResult.reapply`; external evidence comes from the observation’s correspondence table and is usable only when its base and disk revisions match the retained draft and current disk snapshot.

Origin may not change:

- Installation authority: `adoptDiskVersion` remains the only confirmed-install door.
- Its `installed | alreadyThere | refused` outcomes.
- Control production: `conflictChoicesFor` remains the only producer.
- The surface’s declared capabilities.

The existing door already validates the remembered origin, document, installed revision, and projection generation (`src/lib/browser/workspace.svelte.ts:2076-2172`). The sole choice producer is `conflictChoicesFor` (`src/lib/browser/saveOutcome.ts:475-534`). Origin-specific visible messages require English and Spanish keys and typed accessors; components must not build keys (`PROGRESS.md:103-116`, `src/lib/i18n/codes.ts:1699-1721`).

### Q7 — Coalescing and newest-observation arbitration

**Ruling:** For the same document and `disk_revision`, a save-origin conflict wins over the watcher duplicate. A strictly higher observation sequence with a different revision supersedes the conflict’s disk side and invalidates all old reapply evidence.

The save conflict wins because it carries the stronger fact: a locked write attempt was refused, plus operation-specific evidence. The watcher observation is still accepted for sequence/watermark accounting but must not replace the model, its messages, or its source identity. Revision equality establishes identical bytes, not event origin or chronology.

For a higher per-document observation sequence with a different revision:

- Preserve the retained `Draft<T>`.
- Replace the disk text, projection, disk revision, findings, and origin with the external source.
- Do not render the save conflict’s `found` as the current disk revision.
- Withdraw any pending reload confirmation tied to the prior model.
- Invalidate the previous conflict’s reapply evidence.

Fresh external correspondence may re-enable reapply only if its `base_revision` equals the retained draft’s base and its `disk_revision` equals the new conflict disk revision. The wire itself warns that correspondence is snapshot-bound and TypeScript does not express the pairing (`src/lib/ipc/types.ts:2891-2911`). Hashes carry no order; only observation sequence defines “later,” as the current adoption code already states (`src/lib/browser/workspace.svelte.ts:2150-2158`).

An in-flight write creates a per-document arbitration barrier. Observations for that document are retained/coalesced but not applied until the write promise settles:

- If the save commits, complete its existing projection invalidation/adoption first. Coalesce matching watcher revisions; then process a different later observation.
- If it returns a save conflict, let that conflict win over a same-revision watcher observation.
- If it fails without possible writing, process the retained newest observation normally.
- If it may have written, preserve the uncertainty and forbid automatic reload; a later watcher snapshot can establish what is on disk, but not who wrote it or whether the uncertain operation committed.

The existing wrappers already distinguish `mayHaveWritten` and avoid treating uncertain disk state as an ordinary failed save (`src/lib/browser/workspace.svelte.ts:2745-2754`, `src/lib/browser/workspace.svelte.ts:2931-2944`). No save command may be initiated by watcher arbitration.

### Q8 — Observation and document arms

**Ruling:** Only an explicitly narrowed `Addressable` arm may reach an open-workspace document command. `Named` and `Unnamed` produce state-only transitions, notices, or a deferred whole-workspace refresh.

| Observation | `Addressable` | `Named` | `Unnamed` |
|---|---|---|---|
| `Changed` | Projected content follows Q5: guarded reread or external conflict. Unreadable content preserves the old projection and surfaces, marks it unavailable/stale, and invokes no reload command. | Never pass its identity to a command. Mark an already-known pending row stale if one exists and request a safe membership reload. | Keep a path-level notice and request a safe membership reload; never invent an identity. |
| `Removed` | Remove the summary, view, load failure, and raw snapshot; invalidate that projection. If selected, clear selection synchronously and raise the external-gone notice. Preserve any write surface in a removed-target/manual-recovery state. | Remove a locally pending row by its identity if present; otherwise no-op. No command. | Do not match by lossy path. Record membership drift and request a safe whole reload. |
| `Unreadable` | Preserve the last projection and any surface, but mark it stale/unavailable and show the typed reason. No command and no automatic install. | Attach the reason to a pending known identity where possible. No command. | Show a workspace/path-level unreadable notice. No command. |

`Added` has no `ObservedDocument` arm. Insert or replace its `DocumentSummary` by identity in `documents` and the sidebar, retaining `loaded: false`; do not put the supplied projection into `views` and do not call `getDocument`. The wire explicitly says an addition’s identity is not an address accepted by the open workspace and its summary is truthfully unloaded (`src/lib/ipc/types.ts:3030-3045`).

A removed selected document cannot use `repairAfter`, because no replacement projection exists. Add a distinct synchronous `removeDocument` transition that invalidates the projection, removes it, clears `selected` through `replaceSelection`, and drops the raw snapshot. `repairAfter` only repairs against a supplied `DocumentView` (`src/lib/browser/workspace.svelte.ts:3571-3587`).

At the routing boundary, use an exhaustive narrowing switch with a `never` terminus. Do not add a common identity helper: the type deliberately has none because it would collapse `Addressable` and `Named` (`src/lib/ipc/types.ts:2771-2805`). The switch forces a future fourth arm to be handled, but TypeScript cannot force the already-narrowed `Named` branch not to call a command; negative command-spy tests establish that only `Addressable` is routed.

### Q9 — Capability widening and `dispatch_check.rs`

**Ruling:** Add `core:event:allow-listen` and `core:event:allow-unlisten` together, in the same sub-step that makes the first production `subscribe()` reachable. Do not land either permission unused.

`allow-listen` is justified by registration; `allow-unlisten` is independently justified by normal disposal and the registration/disposal race. The event adapter documents that granting only the first leaves a Rust-side listener that cannot be removed (`src/lib/ipc/events.ts:46-73`). The generated schema confirms the two are separate narrow permissions, while `core:event:default` additionally grants emit and emit-to and is therefore too broad (`src-tauri/gen/schemas/desktop-schema.json:371-399`). The current capability list is empty and demands the narrowest enumerated permissions (`src-tauri/capabilities/default.json:1-6`).

`dispatch_check.rs` must now establish all of these:

- The capability’s permission set is exactly those two entries, with no wildcard/default set and no remote origin.
- A local `main` webview can register through `plugin:event|listen`.
- The returned listener can be removed through `plugin:event|unlisten`.
- A remote origin is refused for both event-plugin commands.
- The application-command table remains exactly seventeen registered commands; plugin commands are not added to `generate_handler!` and therefore must not inflate that count.
- Every existing local application command remains reachable, and every registered application command remains in the remote-origin refusal sweep.

Its present prose and test names repeatedly claim an empty capability set (`src-tauri/src/dispatch_check.rs:1-21`, `:283-365`, `:1942-2013`), so those claims must be updated rather than left green but false. The existing remote table asserts seventeen application commands in both directions (`src-tauri/src/dispatch_check.rs:1907-1939`).

### Q10 — Closing the drain-guard escape

**Ruling:** Use the same hoisted `@tauri-apps/api/core` spy in all three files, assert it file-wide in every `afterEach`, and use exact per-case expectations for intended injected drains. This closes the direct-wrapper route while preserving the actual `commands.ts` module.

Why this choice:

- A partial `vi.mock('$lib/ipc/commands')` is narrower to `drainExternalChanges`, but it makes the 186-case workspace suite test a mocked command-composition module and must preserve or reproduce the other exports. It is workable, but it increases mock coupling.
- Mocking `@tauri-apps/api/core` keeps the real wrapper module and `REAL_COMMANDS` assembly intact. Any module-level wrapper bypass eventually reaches the recorded `invoke`, while intended coordinator drains through the injected `BrowserCommands` do not. The two component suites already have this exact mechanism (`src/lib/components/DetailPane.test.ts:59-73`, `src/lib/components/RestorePane.test.ts:112-125`).
- A third structural shape—moving all real dependency assembly into a separate composition root and making every `createBrowserState` dependency required—is strongest locally, but would mechanically update roughly the whole workspace suite and every backup/event fake. It still cannot prevent a future direct import without an additional architectural check, so that cost is not justified for this closure.

Add `expect(invoked).not.toHaveBeenCalled()` to both component `afterEach` blocks and the workspace suite’s new core spy. Today `invoked` is asserted only once in `DetailPane.test.ts` and five times in `RestorePane.test.ts`, not file-wide (`src/lib/components/DetailPane.test.ts:336-350`, `:516-541`; `src/lib/components/RestorePane.test.ts:754-768`, `:790-808`, `:895-968`, `:1069-1085`).

The old injected-drain assertion changes shape. A blanket `expect(drained).toBe(0)` is no longer valid once coordinator tests deliberately start reconciliation (`src/lib/browser/workspace.test.ts:502-513`). Instead:

- Every reconciliation test supplies a finite scripted drain-answer queue.
- Each intended trigger asserts the exact call count and `afterSequence` argument.
- `afterEach` asserts that the scripted drain budget was consumed exactly and that no late call remains pending.
- The core-level `invoked` assertion remains zero in every test, because even intended drains must use the injected boundary.

All created coordinators must be disposed before the case ends so a late registration or follow-up drain cannot leak into the next case.

### Q11 — Proposed dependency-ordered sub-step split

**Ruling:** Cut 2d-5 into seven steps. Two steps necessarily touch components: registry composition and production lifecycle activation. The consult’s “no component changes means no mounted or window evidence yet” condition therefore does not hold for those two steps.

1. **2d-5-1 — surface and conflict vocabulary.**

   Deliver the widened single `OpenWriteSurface` union, unknown/known creator target, watcher-target and restore-competition predicates, `ConflictSource`, stable save-source memo, origin-specific message values, and EN/ES accessors. Preserve `conflictChoicesFor` and the one adoption door.

   Evidence: pure model/type tests, including exhaustive `never` arms and the restore unknown-creator behavior.

   Components: **none**.

2. **2d-5-2 — exhaustive live-registry composition.**

   Add the coordinator-owned keyed registry and the exact `OpenWriteSurfaceKind` binding object in `DetailPane`; report the creator’s target upward from `MatchCreator`; prove registration, target replacement, and unregister for all seven kinds.

   Evidence: mounted evidence for every surface, creator unknown→known transition, and restore’s unchanged unknown-target behavior. Because this changes components, it also owes a narrow window regression reading; that reading cannot claim real watcher delivery. The full native matrix remains 2d-7’s.

   Components: **yes**, limited to registry plumbing, with no new watcher UI.

3. **2d-5-3 — drain lifecycle coordinator.**

   Add `start`, `dispose`, the single-flight pump, all four triggers, session epoch/watermark/discard state, registration-race handling, current-open generation checks, and injected foreground/resume events. Keep the production event source unreachable.

   Evidence: workspace/model tests for all trigger orders, duplicate wakes, a wake during a drain, open during a drain, epoch mismatch, epoch zero, registration failure, disposal before and after registration, and exact unlisten count.

   Components: **none**.

4. **2d-5-4 — observation state transitions.**

   Add per-document accepted sequences, guarded reread, `Added`/`Removed`/`Unreadable` handling, selected-document removal, Addressable-only command routing, and discarded-history recovery using the retained original open request.

   Evidence: model/workspace tests across every observation/document-arm combination, two documents, surface-open races, lost additions/removals, and explicit zero save-command calls.

   Components: **none**.

5. **2d-5-5 — external conflicts and save arbitration.**

   Generalize the six conflict registrations, reapply evidence access, same-revision coalescing, different-revision supersession, and per-document in-flight-write barriers.

   Evidence: model/workspace tests for save-conflict versus watcher arrival in both orders, later different revision, stale evidence, `installed | alreadyThere | refused`, committed save, definite failure, and `mayHaveWritten`.

   Components: **none**; drawing the new origin remains 2d-6.

6. **2d-5-6 — file-wide route-guard closure.**

   Install the uniform hoisted core spy and file-wide assertion in `workspace.test.ts`, `DetailPane.test.ts`, and `RestorePane.test.ts`; replace the zero-drain blanket with exact scripted budgets in intended reconciliation cases.

   Evidence: the targeted frontend tests and the machine-checkable frontend gate set.

   Components: **none**; component test files change, not `.svelte` renderers.

7. **2d-5-7 — production activation, capability, and baseline.**

   Make the real event source reachable, have `AppShell` start and dispose the coordinator, add both exact event permissions, and extend `dispatch_check.rs` with local listen/unlisten plus remote refusal evidence.

   Evidence: mounted lifecycle evidence, a narrow window lifecycle reading, the dispatcher tests, and the complete machine-checkable gate set. Re-measure all four live baselines here: `1320 / 434 / 2175 / 184` are the current anchors (`PROGRESS.md:272-285`). This is the step where `events.ts` first becomes reachable from the application entry, so that fact contributes exactly **+1 production module**; any other new reachable module must be accounted for separately. The repository already records that expected one-module movement (`PROGRESS.md:294-303`).

   Components: **yes**, `AppShell.svelte` only. This is justified by the lifetime contract: without a host cleanup, disposal exists only as an unused method.

Codex session ID: 01a0583e-17c9-7b70-ba45-f92d7e68fdc6
