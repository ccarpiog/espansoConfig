# Phase 2d-6 — components, i18n and mounted evidence, design consult

**Reviewer: Codex (GPT-5 family), high effort, dispatched 2026-09-21 by `/autoclaude-opus` in driven
mode via the companion CLI** (job `task-mub3r0qh-b6gfi9`, ~19 minutes wall-clock), per
`docs/decisions/codex-dispatch-procedure.md`. The brief is `docs/decisions/2d-6-design-brief.md`,
written for this consult and reproduced there in full. Codex ran read-only and wrote no file; its final
message is reproduced below verbatim, with only the edits that procedure permits — none of its headings
needed demoting, because it answered with `###` as the brief asked, and the `Resume in Codex` trailer is
dropped with the session ID kept. **It wrote no verdict heading of its own**: its first two paragraphs
are the verdict, and no heading has been added above them.

**This consult binds Phase 2d-6.** Where it rules against `docs/reviews/phase-2d-design.md` item 6,
against `docs/decisions/2d-5-split-notes.md`, against `PROGRESS.md`'s statement of the phase, or against
a habit of this project, the ruling wins unless a later record says why not. The places where it does
rule against an earlier document are called out in `docs/decisions/2d-6-split-notes.md`; read that
file's correction section before treating `phase-2d-design.md` item 6 as the spec.

**No gate was run for this consult and none is claimed.** Codex was forbidden Cargo and npm by the
brief, ran neither, and says so itself in its second paragraph, immediately under the verdict. Every
figure it quotes is read from a file, not measured; every `file:line` it cites is re-derived in the
record's citation audit before it is relied on.

---

Proceed with 2d-6, but do not treat it as seven callbacks plus translated markup. It needs a complete observation-to-session protocol, including delivery after write settlement, model-owned submission blocking, and origin-correct messages. Two corrections to the inherited design are necessary: recovery is another live write surface, and removing the last document must not unmount retained sessions. Keep native backend-status exposure outside this phase; include the DOM foreground source, bilingual mounted evidence, and narrow window regression readings.

I ran no Cargo/npm gates and made no window observation; these are design rulings derived from repository inspection.

### Q1 — Delivering observations into child-owned sessions

**Ruling:** Choose **(b), child-reported handlers**, with registration ownership and exhaustive assembly remaining in `DetailPane`. Arbitrate once in `BrowserState` before delivery, then deliver the same decision to every affected session.

Put the receiver, instance token and registry lease together in the parent’s binding record. Require a narrow callback prop through which each child supplies its receiver; do not give children `browser`. Receiver cleanup must be instance-bound so an old child cannot detach its replacement. A missing receiver must retain delivery and block submission, not silently drop the observation.

Reject (a) as the primary route: an observation prop consumed only by an effect leaves delivery pending until that effect runs. Reject (c): moving registry construction into children loses the one-file exhaustiveness check. A required reporter prop and exhaustive record force the declared wiring shape; **they cannot force the child to report, invoke its model transition, or clean up correctly**. Mounted tests must establish those actions.

There are two reasons to arbitrate before dispatch rather than independently inside each registered callback:

- **Settlement needs delivery too.** `beginWrite.close()` currently calls `arbitrateHere(...)` and discards its verdict. Merely wiring the initial transition leaves that later result undelivered.
- **Recovery defeats the exclusive-seven assumption.** `RecoveryPanel` owns a session, chooses its own destination, and invokes `BrowserState.createMatch`; it can remain open beside its originating editor. An editor over A therefore does not protect a recovery destination B.

Add **`recovery` as an eighth kind**, still assembled in `DetailPane`, with target/receiver reporting passed through `MatchEditor` and `MatchCreator`. This explicitly overrides the seven-kind completeness claim, not the one-file construction rule. Extend the browser predicate to return **all** targeting surfaces for delivery; a single matching surface remains sufficient to prohibit automatic reload. Parent and recovery sessions over the same file must receive one arbitration result, not independently produce `raised` followed by `coalesced`.

Use a narrow `ReconciliationWorkspace` arbitration/delivery member, and a delivery envelope containing the narrowed observation and verdict. The child’s browser-model transition combines that envelope with its own draft and capabilities. Write settlement publishes through the same delivery mechanism, without readmitting an already accepted sequence.

For the hypothetical exclusive-seven implementation, putting arbitration in the parent callback would require no new `ReconciliationWorkspace` member. **For the corrected design, add it deliberately:** shared arbitration, multiple recipients and settlement delivery justify it.

Delivery while a child awaits its write must be held until the child applies that write’s result. Then consume the latest valid delivery. Otherwise its `await save(...)` continuation can overwrite the newly delivered conflict. Preserve committed-success facts throughout.

**Evidence:** the exact assembly and no-op registration are at `src/lib/components/DetailPane.svelte:571`, `:669`, `:714`; child-owned state is at `src/lib/components/MatchEditor.svelte:317`; current delivery chooses one kind at `src/lib/browser/observationTransitions.ts:1339`; settlement discards the arbitration answer at `src/lib/browser/workspace.svelte.ts:3140`. Recovery owns its session, changes destination and sends creates at `src/lib/components/RecoveryPanel.svelte:178`, `:281`, `:363`; it is mounted beside the host outcome at `src/lib/components/MatchEditor.svelte:898`. The current seven-kind union is at `src/lib/browser/restore.ts:341`.

### Q2 — Session storage and the submission prohibition

**Ruling:** Choose **(a), an external-conflict field inside each immutable session**. Keep `SaveOutcomeModel` save-only. Do not put authoritative conflict state in a component-local slot.

Add `externalConflict: ExternalConflictModel<T> | null`, alongside explicit reconciliation restrictions where needed. Widen each session’s conflict accessor to `ConflictModel<T> | null`. Its transition must ensure that only one conflict is active: when an external observation supersedes a save conflict, retire that save-conflict outcome. A previous committed success may remain as history, but must not masquerade as the current conflict.

This preserves the truthful provenance of `outcome`. Widening it would turn “how a save ended” into “anything that happened while a surface was open.” A separate renderer-owned slot would also leave model entry points unaware of the conflict.

Every submission boundary must consult the same model restriction as its view:

- Editor/raw: `canSave` and `beginSave`.
- Creator/recovery: creation refusal and begin/send transitions.
- Delete: request **and** confirmation.
- Move/duplicate: refusal and begin transitions.
- Restore: preparation, confirmation and final permit validation.

External conflict, unresolved retained delivery, removed target and unresolved uncertainty must not be bypassed by calling a model function directly. Tests must invoke those functions despite a disabled button and prove no submission is produced.

Do not let the existing unconditional outcome-dismissal operation erase an external submission block. For an external conflict, `keepEditing` must at least cancel the reload warning without authorizing a stale submission. Any mode that permits further drafting must retain the unresolved-conflict restriction until an explicit resolution succeeds.

Where live projections participate, handlers must take **one current projection snapshot**, derive eligibility, target and submission operands from it, and complete the decision synchronously. The model forces refusal for the inputs supplied; **TypeScript cannot force those inputs to be current or consistently captured**.

Keep the eight specialized panels. Extract shared browser-model description helpers, not a large generic conflict component in this phase. Move conflict rendering outside the save-outcome-only branch and render `view.conflict`.

For revision lines, use one shared typed description:

- Save origin: expected revision, locked-found revision, observed disk revision.
- External origin: observed disk revision only.
- Never relabel `previousRevision` as “expected” or manufacture “found.”

Switch on `source.kind` and read save-only fields from `source.conflict`, or use one tested model type guard. Do not assume that checking the nested discriminant narrows its parent.

**Evidence:** save-only outcome provenance is encoded at `src/lib/browser/saveOutcome.ts:810`, `:863`, `:901`; the present editor accessor and submission gate are at `src/lib/browser/matchEditor.ts:1079`, `:1105`, `:1417`. Equivalent gates include `src/lib/browser/rawEditor.ts:607`, `src/lib/browser/matchCreation.ts:1061`, `src/lib/browser/matchDeletion.ts:580`, `src/lib/browser/matchMove.ts:1149`, and `src/lib/browser/restore.ts:1972`, `:2551`. The unconditional editor dismissal is at `src/lib/browser/matchEditor.ts:1630`; its panel currently takes the conflict from `outcome` at `src/lib/components/MatchEditor.svelte:980`. The nested-discriminant limitation is recorded at `docs/decisions/2d-5-5a-notes.md:353`.

### Q3 — Verdicts, confirmation withdrawal and uncertain writes

**Ruling:** Treat every verdict explicitly; distinguish retaining an observation from accepting it as conflict evidence. Add an explicit, non-installing acknowledgement of an uncertain write.

| Verdict | Required session action |
|---|---|
| `raised` | Build the external model from the delivered observation, current retained draft and declared surface capabilities. |
| `raisedWithoutReload` | Build or supersede the external model, but derive effective capabilities with ordinary reload withheld until uncertainty is explicitly acknowledged. Also prohibit reapply from obtaining adoption indirectly. |
| `supersedes` | Use `supersedeConflict`, retaining the existing conflict’s draft and replacing its disk side and source. |
| `coalesced` | Preserve the existing model, source identity and confirmation state. |
| `notLater` | Change nothing. |
| `retained` | Preserve the current outcome and draft; record a pending-reconciliation restriction, not a new disk comparison or conflict origin. |

For either replacing verdict, the **surface model transition** resets `reload` to its initial state, clears pending operation/restore confirmations and invalidates displayed reapply results tied to the old source. BrowserState’s adoption refusal is necessary but does not reset the surface’s warning. Clear component-local copy/report feedback if it would now describe the wrong panel.

An honest retained sentence is: **“An observed change is waiting to be checked against this window’s state.”** Do not say “waiting for your save” unless a separate live write-barrier reading establishes that. Do not promise automatic eventual processing.

The uncertainty panel should say, in both languages:

> “The earlier write’s outcome is unknown. Reviewing this disk snapshot cannot establish whether that write completed.”

Give it a separate acknowledgement action, such as **“I have reviewed this snapshot.”** Introduce a narrow BrowserState member—`acknowledgeWriteUncertainty`, for example—that:

1. Accepts a one-shot acknowledgement bound to the current open generation, document, uncertainty generation and standing observed source.
2. Reads caller-controlled operands before its final checks.
3. Refuses during an in-flight write, after supersession, or when the evidence’s projection generation is no longer valid.
4. Atomically spends the acknowledgement and ends the **active reconciliation hold**.
5. Installs nothing, issues no command and preserves the historical fact that the write outcome was unknown.

After success, rebuild the conflict’s effective availability; a subsequent reload still needs its own two-step confirmation and `adoptDiskVersion`. Do not re-observe the same observation merely to manufacture another `raised` verdict.

This explicitly extends the two existing uncertainty-clearing routes recorded by 5b. It does not establish what happened to the earlier write. It is neither another installation door nor a force operation: it acknowledges a risk state, while file writes remain revision-checked and confirmed installation remains unique.

The hold must also block automatic rereading after its originating surface closes. A per-file uncertainty cannot depend on whether there happens to be a mounted panel.

**Evidence:** the six verdicts are declared at `src/lib/browser/conflictSource.ts:393`; uncertainty arbitration is at `:510`. `supersedeConflict` preserves the draft but withdraws no confirmation at `src/lib/browser/saveOutcome.ts:1137`, `:1162`, `:1178`. The current uncertainty-clearing writes are at `src/lib/browser/workspace.svelte.ts:3107`; adoption checks standing identity before `alreadyThere` at `:4040`. Existing uncertainty limits are recorded at `docs/decisions/2d-5-5b-notes.md:218`, `:281`.

### Q4 — Bounded re-arbitration

**Ruling:** Add a **person-requested retry**, plus delivery of the existing write-settlement arbitration. Do not trigger retries from surface closure or a reactive effect.

Expose a narrow `retryRetainedObservation(document)` operation. One press makes at most one arbitration attempt against the latest retained observation for that document. A write in flight makes the action unavailable; repeated re-entrancy leaves the observation retained and the action askable again. There is no self-scheduling loop.

Use the retained record’s **original arrival generation**. Calling public `observeExternalChange` afresh would capture today’s generation and could renew evidence that arrived before a projection replacement.

Consume or retain the record according to the result, checking its identity/generation before modifying it. Publish any resulting verdict through Q1’s delivery path. Do not change the drain watermark or readmit its accepted sequence.

Neither retry nor its delivery may call a command, install a projection or mint reload consent. Automatic reread is a separate guarded transition; confirmed installation remains `adoptDiskVersion`, which independently refuses a superseded or outlived origin. Those are implementation boundaries established by tests and code structure; **a function signature alone cannot prove absence of hidden command calls**.

Closing a surface only changes eligibility. It does not silently spend a retry or turn held evidence into permission to install.

**Evidence:** retained records carry their arrival generation at `src/lib/browser/workspace.svelte.ts:3032`; initial observation captures it at `:4119`; settlement deliberately reuses it at `:3123`, `:3142`. Public observation reaches arbitration without commands at `:4109`. The stranded-reentrancy case is recorded at `docs/decisions/2d-5-5b-notes.md:291`.

### Q5 — External origin and the five offers

**Ruling:** Build external correspondence lookup for the five match surfaces. Do not ship “supported” reapply that always falls back merely because this phase declined to consume valid evidence.

Generalize the reapply entry protocol to consume `reapplyEvidenceFor` for **both origins**, with a live standing-origin guard supplied through a narrow function prop. Its answers must remain distinct: save evidence, external correspondence, specific refusal, superseded evidence. Do not cast the correspondence table to `ReapplyEvidence`.

Convert external correspondence into operation-specific evidence using full base identities:

- Editor: its base subject’s `editor` resolution.
- Delete/duplicate/move: the subject’s `exact` resolution.
- Anchored creation/move: the anchor’s `exact` resolution from the same table.
- Creation: targetless subject; no invented subject `MatchId`.
- Non-anchored placement: the appropriate non-anchored value.

Require matching document, base revision and disk revision. Missing or duplicate matching rows must refuse conservatively; never use array index or arena-node equality as cross-revision identity. Reuse existing collision, eligibility, same-sequence and adoption rules after evidence extraction.

A creator with no destination has no meaningful destination base. Preserve its fields and wildcard protection, show affected-file state, and require explicit destination resolution. Do not silently choose the observed file or retarget its draft to that revision.

Specific missing/mismatched evidence legitimately reaches manual resolution with `tExternalEvidenceRefusal`; superseded evidence uses `tSupersededEvidence`. Raw and restore keep their declared unsupported reapply behavior. During unresolved write uncertainty, reapply must not bypass Q3’s acknowledgement by obtaining adoption internally.

The panels must retain:

- Exact observed whole-file comparison through `SourceText … documentStart`.
- The appropriate retained fields, operation or candidate.
- Copy only where declared, using `copyReferenceText`.
- The two-step reload with each surface’s actual close/reseed/retarget behavior.
- Recovery only after eligible authored-field manual resolution.

All choices still come from `conflictChoicesFor`. Comparison is evidence, not a new choice-list producer.

**Correct the existing wording before drawing it.** `describeExternalConflict` currently emits `changedElsewhere`, whose translation says a save was refused. Adding an origin line does not cancel that false sentence. Give the external model origin-correct message values.

Also narrow these claims:

- “No save was attempted” → **“No save was initiated in response to this observation.”** An observation can be released after an attempted, possibly uncertain write.
- “Nothing was written” on a reapply refusal → **“This reapply attempt wrote nothing.”**
- Supersession → **“This panel’s evidence has been superseded by another accepted reading.”** Accepted sequence order does not establish disk chronology relative to a locked save read.

Never claim merged, saved, newer, deleted, an exact duplicate, or successful identity correspondence without the relevant predicate. Copying labelled fields is not producing YAML. Recovery preserves supported logical fields, not comments, spelling or the original snippet.

`RecoveryOrigin.conflict` should retain the exact source object of the originating conflict. It must not be replaced with the recovery destination’s later conflict, nor spent to adopt that destination. The recovery form needs its **own** external-conflict/session handling and registration, independently of that origin reference.

**Evidence:** `beginReapply` currently reads save evidence directly at `src/lib/browser/reapply.ts:309`; the guarded union and revision checks are at `:500`, `:526`. Correspondence rows carry full base identities and separate exact/editor resolutions at `src/lib/ipc/types.ts:2877`. Existing surface consumers are at `src/lib/browser/matchEditor.ts:2081`, `src/lib/browser/matchCreation.ts:1603`, and `src/lib/browser/matchMove.ts:1797`. Unknown creation uses an empty base at `src/lib/browser/matchCreation.ts:643`, `:685`. The false external message producer is at `src/lib/browser/saveOutcome.ts:1123`, with its translation at `src/lib/i18n/en.json:161`; the other overbroad sentences are at `:152`, `:155`, `:199` and the corresponding Spanish keys. Recovery origin identity is defined at `src/lib/browser/recovery.ts:832`.

### Q6 — Degradation, removal and unreadable states

**Ruling:** Draw every frontend-observable restriction. Do not add an eighteenth command or claim knowledge of native polling mode.

**Scope of degradation.** Here it means no watcher lifecycle observed for the workspace, failed frontend event subscription, lost reconciliation history, and observations the window cannot safely apply. Native backend fallback is a separate observability feature. Defer its Rust/wire/dispatcher work; record explicitly that 2d-6 cannot display polling status.

**Placement and reactivity:**

| State | Required presentation |
|---|---|
| `stale` | Sidebar row and affected detail/surface header: the displayed reading has not been reconciled. |
| `unavailable` | Same locations, preserving the last projection and showing the typed unreadable reason. |
| `removed` | Retained surface header plus selection notice; do not invent a surviving sidebar row. |
| Path drift | Workspace banner with display-only path and typed observation detail. |
| `notWatched` | Workspace banner saying automatic watching is unavailable for this workspace. |
| Failed registration | Workspace banner saying change notifications could not be subscribed to; never “the watcher is dead.” |
| Lost history | Prominent workspace banner explaining incremental reconciliation is suspended. |
| Membership reload wanted | Workspace banner with the explicit reload request. |
| Retained observation / uncertain write | Affected surface or detail state, with a workspace-level route when its surface has closed. |

Expose `watchState` and sanitized registration state through BrowserState. Add reactive invalidation for block, membership request, registration, watch state, held observations and uncertainty. A single coordinator state-change notification feeding a BrowserState revision signal is preferable to unrelated copied booleans. Readers should depend on that signal and return authoritative state.

The notification must cover asynchronous subscription rejection and every relevant transition; **a typed callback cannot force all mutation sites to call it**. Test those updates without changing selection or another incidental reactive value.

**The two reload controls:** provide separate intents for membership refresh and lost-history recovery, both calling narrow BrowserState request methods. Both delegate to the coordinator’s retained original request and ultimately the existing `open()`. Neither accepts a displayed root path. Both recheck the live registry, outstanding writes, lifecycle and disposal at execution; an open surface refuses the request with an explanation. Closing the final surface permits the action without triggering it.

**Removal delivery:** retain the narrowed changed-observation protocol. Pass typed target status separately and make its browser-model transition invalidate submissions and pending confirmations while retaining draft/request/candidate. A removal is not a conflict snapshot; do not fabricate disk text.

There is a necessary shell correction: **the last row disappearing must not destroy `DetailPane`.** Keep the workspace composition mounted while any retained surface exists, even when the document list becomes empty. Otherwise BrowserState’s preservation is defeated by its renderer.

**Stale after close:** reread on explicit ask, using a new guarded BrowserState request that delegates to `rereadUnderGuard`. Do not expose the present unrestricted `rereadDocument` call as that control. Recheck addressability, targeting surfaces, block, uncertainty and observation/status generations immediately before installation. A fresh accepted observation may still take the existing automatic clean path when every guard permits it.

**Evidence:** status/path mirrors and unmirrored readers are at `src/lib/browser/workspace.svelte.ts:2517`, `:2545`, `:5389`, `:5400`; coordinator readers are at `src/lib/browser/reconciliationCoordinator.ts:1821`, `:1831`, `:1859`. Subscription failure is stored at `:1595`; lost-history reopening uses the retained request at `:941`. Native status is test-facing at `src-tauri/src/watch.rs:476`; the batch fields are at `src/lib/ipc/types.ts:3077`. Removal preserves no row or projection at `src/lib/browser/workspace.svelte.ts:3460`, while `AppShell` switches away from all panes when the list is empty at `src/lib/components/AppShell.svelte:131`. Guarded installation is at `src/lib/browser/workspace.svelte.ts:3626`; public reread currently supplies `ALWAYS_PERMITTED` at `:4500`.

### Q7 — The production foreground source

**Ruling:** Include it in 2d-6 as one dedicated sub-step. Use DOM `visibilitychange` plus window `focus`.

Subscribe synchronously, invoke the handler when visibility becomes `visible` and on window focus, and return synchronous removal of both listeners. Construction must perform no subscription. Let the existing drain pump coalesce triggers; do not add another timer or debounce policy.

Correct the premise about permissions: **DOM listeners need no Tauri event permission.** The installed Tauri window implementation uses event listeners covered by the existing event permissions, but `onFocusChanged` is asynchronous and registers focus and blur separately. It does not directly satisfy the current synchronous `ForegroundSource` contract. Do not disguise its promise as a synchronous unsubscribe.

Correct the coordinator comment claiming every potential implementation, including Tauri focus, registers synchronously.

Budget one reachable TypeScript module for the DOM adapter, then measure the actual build. Do not widen capability permissions.

A mounted shell case can prove that dispatched DOM events request drains, hidden visibility does not, triggers coalesce, and unmount removes listeners. It cannot prove that WKWebView emits those events on actual foregrounding, that an occluded wake was recovered, or that every machine resume produces either event. Call this a **foreground fallback**, not a guaranteed resume notification.

Do not add a window-close lifecycle mechanism here. Svelte unmount disposal and actual application quit remain distinct obligations.

**Evidence:** the inert production argument is at `src/lib/components/AppShell.svelte:51`; the synchronous contract and inaccurate implementation claim are at `src/lib/browser/reconciliationCoordinator.ts:393`. Foreground subscription and disposal are at `:1675`, `:1733`. The installed asynchronous implementation is at `node_modules/@tauri-apps/api/window.js:1724`; permissions are at `src-tauri/capabilities/default.json:6`. The unobserved close and wake boundaries remain recorded at `docs/decisions/2d-5-7b-window-reading.md:420`.

### Q8 — Mounted evidence and the window obligation

**Ruling:** Require behavioral cases in both languages for every changed renderer, retain the appropriate IPC assertion per suite, and require narrow window regression readings in component-changing steps.

The mounted matrix must include:

| Suite | Concrete obligation |
|---|---|
| `DetailPane.test.ts` | Open each registered kind through real controls; deliver through the real registry/coordinator boundary; prove pristine surfaces conflict, sentinels survive, and automatic reload is absent. |
| `DetailPane.test.ts` | Unknown creator blocks all eligible targets without choosing one; recovery over B protects B while its host remains over A; same-file host/recovery both receive the decision. |
| `DetailPane.test.ts` | Read-only raw view refreshes through the guarded path; raw editor conflicts; close/reopen cannot receive an old instance’s delivery. |
| Each surface’s mounted suite | External conflict cannot submit; every offered choice invokes its intended transition; supersession withdraws the warning; `installed`, `alreadyThere` and `refused` have the correct surface effects. |
| `RestorePane.test.ts` | Candidate survives arrival, supersession and successful reload; restore consent is withdrawn; refusal closes nothing. |
| `RecoveryPanel.test.ts` | Source-origin identity remains distinct from destination conflict; destination changes are reported; authored fields survive; external conflict blocks creation. |
| Workspace/coordinator plus mounted integration | Observation during a deferred write; same-revision coalescing; different-revision settlement delivery; rejected write uncertainty; retry boundedness; no save from arbitration. |
| `AppShell.test.ts` | Reactive banners, both workspace reload requests, foreground events, and removal of the last document while a retained surface stays mounted. |
| Sidebar/status renderer suite | Stale/unavailable wording and live updates, including locale changes without an unrelated state mutation. |

Do not limit composition tests to manually passing a conflict prop: that would miss the production wiring gap this phase exists to close.

“In English and Spanish” means parameterize the new interaction cases over both locales and assert the relevant accessible labels and state sentences in each. Also switch locale on an already-mounted external-conflict/status panel and assert it rerenders while preserving its session. Merely importing `LOCALES`, testing dictionary functions or comparing against another call to the same accessor does not establish that behavior.

Use reviewed literal EN/ES expectations for the new safety-critical sentences. Such tests pin those approved strings; **they do not independently prove translation quality**.

Keep exact-zero core `invoke` assertions in injected suites. Preserve `AppShell.test.ts`’s exact per-case command list because it mounts production composition. When `DetailPane` cases begin starting reconciliation, replace its blanket injected-drain zero with finite answer scripts and exact counts/arguments—not a relaxed allowance.

Close the new-file residue with a scoped architectural check covering production components and the mounted-test inventory. Disallow direct command imports from surface components; explicitly allow the composition root. Require every newly discovered mounted suite to declare the applicable invoke guard. Pin that the check fails on an unguarded synthetic fixture. State its limits: a static import check is not proof against arbitrary dynamic execution.

**Window reconciliation:** §5.2 qualifies item 6. Mounted evidence remains 2d-6’s principal behavioral evidence, but component-changing steps also owe a narrow actual-window regression reading. This is an explicit clarification of item 6’s “not its screen reading” wording, supported by the later split correction.

Reuse the existing harness and `lifecycle-delivery` trigger without modifying the four instrument paths. Actually inspect the visible window in EN and ES; querying elements in an occluded window is insufficient. Read changed panels, their warnings and enabled controls. Include one hard fixture in the regression reading.

These observations may claim only what was seen on those launches. They must not claim general wake delivery, resume delivery, the full native matrix, or closure of R38’s broader window half. If the unchanged harness cannot reach a particular state, name that state as unread; do not credit a mounted assertion as its screen evidence.

**Evidence:** the inherited matrix is at `docs/reviews/phase-2d-design.md:128`; the later narrow-window requirement is at `docs/decisions/2d-5-split-notes.md:458`. Existing exact-zero behavior is at `src/lib/components/DetailPane.test.ts:587`; shell exact-list enforcement is at `src/lib/components/AppShell.test.ts:386`. Bilingual mounted precedent is at `src/lib/components/RestorePane.test.ts:926`, `:1542`, `:1570`. Harness reuse and its evidence limits are at `docs/decisions/2d-5-7b-window-reading.md:431`, `:543`, `:548`. R32/R35 are recorded at `PROGRESS.md:125`, `:127`.

### Q9 — i18n placement, operands and evidence

**Ruling:** Put new frontend-state `describe*` accessors in `codes.ts`, with reactive `t*` wrappers in `index.ts`. Keep existing public browser-model accessors compatible; do not make relocation a prerequisite for wiring them.

Use:

- `browser.reconciliation.*` for watch coverage, registration, lost history, membership requests and their controls.
- `browser.externalDocument.*` for stale/unavailable/removed/path-state descriptions.
- `browser.externalConflict.*` for retained delivery and uncertain-write acknowledgement.
- Existing `browser.conflictOrigin.*` and `browser.reapply.*` for origin/evidence sentences.
- Existing `code.unreadableReason.*` and other wire-code accessors for wire reasons.

Do not put frontend-only states under `code.*` merely to get Rust dictionary coverage. Keep key selection exhaustive over typed values; components never concatenate keys.

Most messages need no operands. Permit only meaningful display operands: a display path, a count where useful, and typed unreadable operands such as the non-UTF-8 offset. Never turn a display path into a command argument. Never render raw subscription errors, exception text or digests beside refusals.

Pin the following semantic bounds with reviewed EN/ES strings:

- Stale: the displayed state needs reconciliation; no claim about what changed or who changed it.
- Not watched: automatic watching is unavailable; no implied coverage.
- Registration failure: subscribing failed; no claim that native observation stopped.
- Removed: the file is no longer present in the observed workspace; no attribution or “deleted.”
- Uncertainty: the earlier operation’s outcome remains unknown.
- External origin/reapply: no write **in response to this observation/action**, not an unbounded historical claim.
- Supersession: accepted evidence changed, not proof of chronological disk freshness.

Beyond parity, require exhaustive accessor tests, placeholder checks, literal expected translations for the new bounded claims, absence of raw error/digest leakage, and mounted locale rerendering. The step’s bilingual prose review must inspect those expected translations.

State what remains unpinned: markup scanning does not prove string provenance in scripts or TypeScript; dictionary parity and non-identity do not prove meaning; literal fixtures protect reviewed wording only; Rust’s dictionary contract does not cover the new `browser.*` namespace.

**Evidence:** existing browser accessors and their no-operand contract are at `src/lib/i18n/index.ts:808`, `:1409`, `:1423`, `:1458`; wire unreadable rendering is at `src/lib/i18n/codes.ts:1634`. The scanner’s blind spots are explicit at `scripts/lint/hardcoded-strings.ts:19`; the Spanish heuristic’s limit is at `src/lib/i18n/dictionaries.test.ts:11`; Rust excludes non-`code.` keys at `src-tauri/src/dictionary_contract.rs:91`.

### Q10 — Prose debts

**Ruling:** Correct every production sentence this phase falsifies in the same implementation diff that falsifies it. A module need not otherwise change to receive a scoped factual correction.

That includes:

- No-op transitions and stale assignments of their wiring to 2d-5-5.
- The claim that nothing calls `drainExternalChanges`.
- “No production caller” and “nothing draws this” claims for external models/accessors.
- Statements that retained arbitration is released only by settlement/open, once Q4 lands.
- Statements that uncertainty has exactly two exits, once Q3 lands.
- The synchronous-Tauri-focus claim.
- Seven-kind/exclusive-surface claims after recovery registration.
- External-conflict prose claiming no save was attempted, rather than no save was initiated by the observation.

Do not replace them with broader guarantees. Name the actual path and its limits, including delivery ordering and reporter obligations that TypeScript cannot enforce.

Leave `src-tauri/src/main.rs:214-227` to 2d-8 because the file carries the instrument. Leave the cross-file line-citation drift class to its deliberate checker work; do not hand-renumber unrelated historical citations. Historical records remain records, with focused correction passages where this consult overrides their design.

Apply the current review policy: one adversarial review per implementation phase, blockers fixed, verification rerun, phase closed. No review-of-fix phase and no letter-appended phase.

**Evidence:** stale production handoffs are at `src/lib/browser/workspace.svelte.ts:346`, `:3451`, `src/lib/browser/observationTransitions.ts:580`, `src/lib/browser/writeSurfaceRegistry.ts:108`, and `src/lib/components/DetailPane.svelte:658`. External-model/accessor claims are at `src/lib/browser/saveOutcome.ts:855` and `src/lib/i18n/index.ts:818`, `:1414`, `:1451`. The instrument-file exception and citation debt are recorded at `PROGRESS.md:266`, `:237`. Current review policy is at `CLAUDE.md:237`.

### Q11 — Proposed dependency-ordered sub-step split

**Ruling:** Use the following eleven sub-steps. Each has one worker-sized objective; component-changing steps include their own mounted and narrow window evidence rather than forwarding all screen obligations to a final catch-all.

Every implementation step also owes the applicable machine-checkable gate set. Required prop/type migrations must remain compiling at each boundary; introduce shared facilities additively before activating callers.

1. **2d-6-1 — delivery, retained-state and uncertainty protocol.**  
   Deliver shared delivery vocabulary, publication of settlement verdicts, retained retry with original-generation preservation, reactive coordinator notifications, guarded workspace/file reload requests, uncertainty acknowledgement, and automatic-reload guards independent of mounted surfaces. Add shared conflict-description/evidence primitives and correct origin semantics.  
   **Evidence:** model/workspace/coordinator tests, including re-entrancy, supersession, no-command arbitration and deferred settlement.  
   **`.svelte` files:** none.

2. **2d-6-2 — match-editor external session and reapply.**  
   Deliver the editor’s external-conflict field, submission restriction, confirmation reset and full-identity editor correspondence lookup. Preserve successful-save history and draft intent.  
   **Evidence:** model tests covering pristine/edited drafts, collisions, all evidence arms and all adoption outcomes.  
   **`.svelte` files:** none.

3. **2d-6-3 — creation and recovery external sessions.**  
   Deliver creator/recovery conflict storage and submission gates, destination/anchor evidence, unknown-target behavior, recovery-origin separation and retained destination reporting values.  
   **Evidence:** model tests for unknown destination, cross-file recovery, targetless creation, anchor refusal and uncertainty.  
   **`.svelte` files:** none.

4. **2d-6-4 — operation-session external conflicts.**  
   Deliver delete/move/duplicate transitions, exact subject/anchor lookup, pending-confirmation withdrawal and model-owned submission restrictions. Preserve D2r and R25.  
   **Evidence:** model tests, including stale full identities, ambiguous correspondence, same-sequence checks and direct calls to blocked submission boundaries.  
   **`.svelte` files:** none.

5. **2d-6-5 — raw and restore external sessions.**  
   Deliver raw/restore conflict handling, unsupported reapply behavior, raw reseeding/refusal and restore candidate-preserving retargeting.  
   **Evidence:** model tests for CR handling, consent withdrawal, candidate retention and all adoption outcomes.  
   **`.svelte` files:** none.

6. **2d-6-6 — authored-surface delivery and complete registration.**  
   Activate handler reporting and delivery for editor, creator and recovery; add recovery as the eighth centrally assembled kind; deliver to all affected sessions; preserve the shell’s retained composition when the final row disappears. Wire origin, evidence, comparison, copy and recovery rendering.  
   **Evidence:** bilingual mounted tests, including cross-file and same-file recovery, receiver lifecycle, settlement-result ordering and a narrow window regression reading. This is the first step giving `observeExternalChange` and `supersedeConflict` their live component path.  
   **`.svelte` files:** `DetailPane.svelte`, `AppShell.svelte`, `MatchEditor.svelte`, `MatchCreator.svelte`, `RecoveryPanel.svelte`.

7. **2d-6-7 — operation-surface rendering.**  
   Activate delete/move/duplicate receivers and render their origin, comparison, reapply/manual-resolution and reload behavior.  
   **Evidence:** bilingual mounted interactions for every offered control, direct submission refusal, supersession, and a narrow window regression reading.  
   **`.svelte` files:** `DetailPane.svelte`, `MatchDeleter.svelte`, `MatchMover.svelte`, `MatchDuplicator.svelte`.

8. **2d-6-8 — raw and restore rendering.**  
   Activate both receivers and draw external conflicts with their distinct reload effects.  
   **Evidence:** bilingual mounted interactions, raw viewer/editor distinction, retained restore candidate, CR disclosure and a narrow window regression reading.  
   **`.svelte` files:** `DetailPane.svelte`, `RawEditor.svelte`, `RestorePane.svelte`.

9. **2d-6-9 — reconciliation status and explicit exits.**  
   Draw document/workspace degradation, removal, unreadable, path drift, held observations and uncertainty. Wire membership reload, lost-history exit, stale-file reread, retry and uncertainty acknowledgement. This is the first step naming coordinator status to a person and therefore owns its EN/ES keys and typed accessors.  
   **Evidence:** model tests for presentation decisions, bilingual mounted state changes and controls, empty-workspace retention, and a narrow window regression reading.  
   **`.svelte` files:** `AppShell.svelte`, `Sidebar.svelte`, `DetailPane.svelte`, and the eight write renderers only for their typed status/acknowledgement presentation.

10. **2d-6-10 — foreground fallback.**  
    Add the synchronous DOM source and replace the inert shell argument. Correct the asynchronous-Tauri comment; change no permissions or instrument hooks.  
    **Evidence:** adapter tests, mounted shell trigger/disposal cases and a narrow foreground regression reading with the wake/resume limits stated.  
    **`.svelte` files:** `AppShell.svelte`.

11. **2d-6-11 — complete composition evidence and baseline accounting.**  
    Complete the cross-surface mounted matrix, finite drain scripts, import/guard inventory checks, reviewed bilingual sentence fixtures and factual production-comment sweep. Re-measure and explain all four baselines; consolidate the earlier narrow readings without calling them the 2d-7 matrix.  
    **Evidence:** integration/mounted and architectural checks, plus the full machine-checkable gates. No new window claim follows merely from this consolidation.  
    **`.svelte` files:** none planned; any implementation defect is fixed in its owning step, with its relevant verification rerun.

The recorded starting rung is **1323 / 444 / 2474 / 191 with the instrument**, or **1323 / 443 / 2473 / 190 after subtracting its documented contribution**. These are recorded figures and arithmetic, not measurements from this consult. Account for each reachable new `.ts` module at one Vite module and each new styled component at two, then measure rather than assume the final delta. Re-derive test changes per file because the source-scanning suite grows when files are added. The final baseline step must report both instrument-present and normalized comparisons.

**Evidence:** the live rung and instrument contribution are recorded at `PROGRESS.md:311`; per-file scanner-count accounting is required at `PROGRESS.md:303`; module-cost and pristine-baseline discipline are stated at `CLAUDE.md:91`.

Codex session ID: 01a0c382-935d-7700-a6f4-e7ee655cf193
