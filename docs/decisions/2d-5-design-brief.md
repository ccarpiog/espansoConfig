# Design consult brief — Phase 2d-5, the browser coordinator and the open-write-surface registry

_Written 2026-08-31, before any line of 2d-5 exists, so the rulings can be read against what was asked. The shape is
`docs/decisions/2d-4a-H-round-13-brief.md`'s: bounds named to the consultant rather than hidden._

## 1. Operating conditions — read these first

- **Do NOT use web search and do NOT fetch URLs.** Everything you need is in this repository. **Root:**
  `/Users/ccarpio/Developer/espansoConfig`. **Branch:** `main`, clean when this was written — a Rust workspace
  (`crates/`, `src-tauri/`) plus a Svelte 5 / Tauri v2 frontend (`src/`).
- **Read freely. The workspace may be mounted read-only and you may be unable to write any file. That is expected and it
  must not affect your verdict** — **your final message IS the deliverable**, captured verbatim by the caller into
  `docs/reviews/phase-2d-5-design.md`. Do not try to write it, and do not tell the caller to run anything to get it.
- **Do not run `cargo` or `npm`** — the suite takes minutes and one gate false-fails with a second Cargo process on the
  machine. A sandbox limit or an unrunnable gate is not a finding and not a reason to hedge: say in one line what you could
  not verify, and rule anyway. This is an adversarial **design consult**, not a review: be decisive.

## 2. The rules that dominate every design here

Read `CLAUDE.md` at the root — all of it — before ruling. **(1)** A decision record claiming a guarantee the code does not
give is this project's worst defect class: where TypeScript cannot force something, say so in the same sentence that says
what it does force. **(2)** A rule written into one renderer is carried by that renderer's mounted suite alone, and a
second renderer can omit it while consuming the model faithfully — which is why decisions live in `src/lib/browser/` and
`src/lib/ipc/` as values. **(3)** §7 is the review-tail rule: a round is commissioned by one thing, a fix round that
changed at least one **source** file, and "the record" is a closed list (`PROGRESS.md`, `CLAUDE.md`,
`IMPLEMENTATION_PLAN.md`, any `README*`, everything under `docs/`); every other file is source.

Also read `docs/reviews/phase-2d-design.md` (**step 5 of its Q7 is this phase's definition**; Q3 the wire, Q4 the no-draft
path, Q5 the draft path, **Q8 names an incomplete open-write-surface registry as this phase's sharpest green-suite
failure**); `docs/decisions/2d-4-split-notes.md` §4; `2d-4b-notes.md` §9.5 and §14.8; and `PROGRESS.md`'s *Next action*,
*Standing rules* and *Open risks* (R27, R36, R37, R39).

## 3. What exists today, verified by reading the files for this brief

Every range below was opened and read while writing this, and where a cited range in an existing document no longer
resolves that is said here rather than left for you to trip over.

| Fact | Where |
|---|---|
| `createBrowserState(commands = REAL_COMMANDS, report, backup)` — the coordinator, 3 588 lines. `AppShell.svelte` builds it with **no arguments**, calls `open(null)` in `onMount`, and **never disposes it** | `src/lib/browser/workspace.svelte.ts:1506-1510`; `src/lib/components/AppShell.svelte:24-31` |
| `BrowserCommands`; `drainExternalChanges` is its thirteenth member and **nothing in the file calls it**. The two counters — global `selectGeneration`, per-document `projectionGenerations` — with the staleness test reading both | `:138`, `:311`, `:328`; `:1547`, `:1560`, `:1620-1622`, `:1631-1633`, `:1722` |
| `conflictOrigins` is a `WeakMap<ConflictResult, { document, generation }>` — **keyed on the save wire value**; `rememberTheConflict` writes it and installs nothing. `replaceSelection` is the only writer of `selected` that bumps its counter in the same block, and `installView` invalidates that document's projection generation and forgets the paired text | `:1594-1597`, `:1646-1651`; `:1699-1702`, `:1825-1835` |
| `adoptDiskVersion` — the one confirmed-install door; `installed \| alreadyThere \| refused`; reserve-in-the-same-breath, origin check, `alreadyThere` arm, generation refusal. `rereadDocument` takes three captures before the await, then `forgetFileText` → `installView` → `repairAfter` → `readFileText`, and `repairAfter` keeps or clears the selection | `:2076-2172`, arms at `:2142-2149`, `:2150-2159`; `:2382-2434`, `:3571-3587` |
| `reconciliationEventSource(raw)` / `REAL_RECONCILIATION_EVENTS` — injectable, **imported by no production module**. `drainExternalChanges(afterSequence)` — required argument, **owns no watermark, compares no epoch, retains nothing** | `src/lib/ipc/events.ts:95-97`, `:129-137`, `:171-181`, `:192-193`; `src/lib/ipc/commands.ts:918-922`, `:245` |
| `ReconciliationWake { workspace_epoch, newest_sequence }` — a hint, not a `CommandResult`; `ObservedDocument` has three arms and **no identity accessor, deliberately**; `ExternalObservation` = `Changed \| Added \| Removed \| Unreadable`, every arm carrying `sequence`; `ReconciliationBatch { epoch, newest_sequence, observations, discarded }`, `epoch: 0` meaning no lifecycle, `discarded` **cumulative within the epoch and monotonic** | `src/lib/ipc/types.ts:2750-2765`, `:2769`, `:2807`, `:3010-3067`, `:3077-3111` |
| `conflictChoicesFor(capabilities, step)` — **the only producer of a choice list**; `ConflictCapabilities` at `:405`; `ConflictModel<T>.source` is typed **`ConflictResult`**, singular. `OpenWriteSurfaceKind` has **seven** members including `matchCreator`; `CompetingWriteSurfaceKind` excludes `restore` by `Exclude<>`; `OpenWriteSurface` requires a **non-optional `DocumentId`** | `src/lib/browser/saveOutcome.ts:517-534`, `:708`, `:767`; `src/lib/browser/restore.ts:338-352`, `:361`, `:378-383`, `:404-414` |
| `openWriteSurfaces()` — the only producer, listing **six**, expressly omitting the creator, saying nothing can check it is complete; `busy` beside it covers **seven** including `creating`. The creator learns its destination once chosen and never reports it upward; `documentHasUnsavedDraft` measures **any open editor, dirty or not** (R36) | `src/lib/components/DetailPane.svelte:473-494`, `:664-672`; `src/lib/components/MatchCreator.svelte:334-336`; `src/lib/browser/matchDuplication.ts:334-339` |
| `"permissions": []`, with the file's own demand that each phase enumerate the narrowest set it needs. `RECONCILIATION_READY`, `wake_emitter` — **a failed emit is dropped on purpose** | `src-tauri/capabilities/default.json:6`; `src-tauri/src/events.rs:40`, `:64` |
| `QUEUE_CAPACITY = 256`; `enqueue` drops a stale epoch **silently** and a sequence at/below the watermark **counted in `discarded`**; overflow evicts and counts. `drain` coalesces **at drain** over the pending set, and `newest_sequence` never falls below `acknowledged`. The command answers `NoWorkspaceOpen` and nothing else, under the session mutex; its dispatcher test pins `epoch: 1`, empty observations and a crossing watermark, and that module's doc says **"The seventeen commands"** | `src-tauri/src/reconciliation.rs:255`, `:1088-1106`, `:1184-1218`; `src-tauri/src/commands.rs:1353-1360`, `:3491-3496`; `src-tauri/src/dispatch_check.rs:1`, `:1966-2013` |
| The drain guard — `let drains = 0`, the increment, the `afterEach` asserting it — and the `invoked` spy, asserted **once** at `DetailPane.test.ts:534` and **five** times in `RestorePane.test.ts` (`:808`, `:911`, `:941`, `:968`, `:1084`), in **neither** `afterEach` (`:341`, `:759`). `CODE_NAMESPACE_KEY_BUILDERS` is the general key-without-accessor check | `src/lib/browser/workspace.test.ts:319`, `:471-478`, `:502-513`; as cited; `src/lib/i18n/codes.ts:1721` |

**Drift.** Every `workspace.svelte.ts` range quoted in `docs/reviews/phase-2d-design.md` has moved and now lands in
unrelated comment prose — `2045-2135`, `2351-2403`, `1786-1804`, `1637-1671`, `1552-1566` / `1604-1620`, `3540-3556` and
`120-148` / `284-298` — so the table above is the re-derived set; that document's `DetailPane.svelte`, `saveOutcome.ts`
and `commands.ts` ranges still resolve. `CLAUDE.md` §4's figures are dated anchors — **`PROGRESS.md` is authoritative**.

## 4. What Phase 2d-5 is

`docs/reviews/phase-2d-design.md` Q7 item 5, verbatim:

> **2d-5 — browser coordinator and pure surface transitions.** Add listener/drain orchestration, per-document accepted
> sequence, the exhaustive open-surface registry including wildcard creator, guarded automatic reload, watcher-origin
> conflict source, origin-specific messages, same-revision save/watcher coalescing, and newest-observation arbitration.
> Generalize `rememberTheConflict`/`adoptDiskVersion` without adding a second door, and keep `conflictChoicesFor` the
> only producer. […] **No component changes means no mounted or window evidence yet.**

`PROGRESS.md` adds five obligations 2d-4b refused — the watermark and the epoch comparison, `discarded` handling, all four
drain-firing orders, disposal racing registration, and the capability widening (**both** `core:event:allow-listen` and
`core:event:allow-unlisten`) with a re-run of `dispatch_check.rs` — plus **one piece of inherited work**, Q10's route.

## 5. Constraints you may not trade away

Settled; a ruling that contradicts one is wrong, not brave. **`save_document` is the only entry point that may write a
user's file**, there is no `force` flag, and 2d-5 introduces no writer. **`adoptDiskVersion` is the only confirmed-install
door** and `alreadyThere` is success — do not propose `adoptExternalVersion` or any second door. **`conflictChoicesFor` is
the only producer of a `ConflictChoice` list.** **A component renders a code by calling an accessor in
`src/lib/i18n/codes.ts`, never by building a key**, and every user-facing string is EN **and** ES.
**`crates/espansoconfig-core` must never depend on `tauri`.** **D2r** — a move is same-sequence only; **R25** — a move is
alone in its batch; **D2u** — source text, never an inferred type.

---

# The questions

Answer each with a **Ruling:** line, then the reasoning, then `file:line` evidence you derived; where uncertain, say which
observation would settle it.

### Q1 — The exhaustive `OpenWriteSurface` registry

Rule on **who owns the registry** and **what makes it exhaustive by construction rather than by inspection**. (a) A keyed
map in the coordinator with a register/unregister contract centralizes it but cannot force a component to register; (b) a
required prop per surface with an `Exclude<>`-derived completeness type makes an omission a compile error in one file, at
the price of multiplying props; (c) asking the existing producer changes nothing. Then rule on **the creator's unknown
target**: `OpenWriteSurface.document` is a required `DocumentId`, so `{ kind: 'matchCreator', target: 'unknown' }` does not
type-check; widening it touches `competingSurfaceFor`, a wildcard list splits the registry in two. Say which, and what the
restore refusal must then do so widening cannot silently change 2c-5's behaviour.

### Q2 — The watermark, the epoch comparison, and the per-document accepted sequence

Rule on where the **session watermark** lives and how it relates to the **per-document accepted sequence**:
`newest_sequence` is what a caller stores to avoid re-reading, while *which observation this document acted on* is the
arbitration key. (a) One watermark plus a per-document map is two states that can disagree; (b) a per-document map alone
forces `afterSequence: 0` on every drain and re-reads the whole queue; (c) one watermark alone loses per-document
arbitration. Rule also on the epoch comparison — where the coordinator learns the epoch it shows, given `open_workspace`
returns none, and what a batch with `epoch: 0` (no lifecycle, watched by nothing) means.

### Q3 — `discarded`

It is cumulative within the epoch and monotonic, so non-zero does not mean the loss happened since the last drain, and
Rust's stated answer is a **whole-workspace reload**. Rule on what that means here. (a) Re-running `open()` is a true
reload but re-mints every identity and strands every open surface's target; (b) `rereadDocument` per projected file is
cheaper but is blind to additions and removals; (c) refusing to act shows a state the person resolves. Say what happens to
open write surfaces and their drafts, and whether the last `discarded` must be remembered so one loss is not answered
twice.

### Q4 — The four drain-firing orders, duplicate wakes, out-of-order drains, disposal racing registration

`events.ts` defers four obligations: a drain **after listener registration**, **after `open()` completes**, **on
foreground or resume**, and **on a current-epoch wake**. Rule on each — whether it fires, in what order, what serializes
them. **Duplicate wakes:** a wake is no promise the queue grew — coalesce into one in-flight drain, queue them, or drain
per wake? **Out-of-order drains:** two drains in flight can return batches whose `newest_sequence` goes backwards; say
what makes the older answer inert — a generation capture in `rereadDocument`'s shape, or single-flight serialization — and
what each costs. **Disposal racing registration:** `subscribe` resolves asynchronously and a coordinator disposed first
must still call the unlisten it receives; rule on where that lives, given `AppShell.svelte:24` never disposes at all.

### Q5 — Guarded automatic reload versus the conflict path

The phase consult's Q4 rules that automatic reload is **not** adoption and that a **pristine** surface still takes the
conflict path, because R36 means this application cannot tell a pristine editor from an edited one. Rule on the transition
— a new `applyExternalObservation`, or driving the shipped `rereadDocument` — and on its guard. (a) Reusing
`rereadDocument` whole keeps three generation captures and the `installView` → `repairAfter` → `readFileText` order, at the
price of re-reading bytes the batch carries; (b) installing the batch's projection directly saves the read but bypasses
that discipline. State why over-refusal is the right side to err on, **in a sentence that does not claim the application
knows a draft is dirty**, and rule on the raw viewer versus the raw editor.

### Q6 — Watcher-origin conflict, without a second door and without a second choice-list producer

`ConflictModel<T>.source` is typed `ConflictResult` and `conflictOrigins` is keyed on that exact type. A watcher conflict
has no attempted save, no locked `found`, and cannot honestly say *this attempt wrote nothing*. Rule on the
generalization: a discriminated `ConflictSource = { kind: 'save', … } | { kind: 'externalChange', … }` changes the
`WeakMap` key type and every `rememberTheConflict` caller (six today — `:2546`, `:2638`, `:2715`, `:2775`, `:2898`,
`:2980`), while a structural widening keeps the callers but loses the discriminant the messages need. Rule then on what the
origin may change — messages and evidence provenance — and what it may not: who installs, and who produces controls.

### Q7 — Same-revision save/watcher coalescing, and newest-observation arbitration

A save-origin conflict and a watcher observation can name the same document and the same `disk_revision`. Rule on which
wins, and on what happens when a strictly **later** observation with a **different** revision arrives while a conflict is
showing. Revisions are hashes and carry **no order**, so "later" can only mean the coordinator's observation sequence;
`adoptDiskVersion` already answers `alreadyThere` when the window holds the requested revision and refuses an older
snapshot on a generation mismatch. Say whether superseding a conflict's disk side invalidates its reapply evidence, and
rule on a save already **in flight** when an observation arrives.

### Q8 — Which arms the coordinator acts on, and the three arms of `ObservedDocument`

`ExternalObservation` has four arms; `ObservedDocument` has three, with **no identity accessor, deliberately** — only
`Addressable`'s number is an address an open-workspace command accepts. Rule on each combination: an `Added` file (sidebar
and `documents` state, `loaded: false`), a `Removed` file currently **selected** (R27 — `repairAfter` cannot repair a
projection that is gone), and `Unreadable`. Say what forces `Addressable`-only routing at the call sites — an exhaustive
`switch` with a `never` terminus, a narrowing helper, or nothing but tests — and if nothing does, say so in the same
sentence as what the design does force.

### Q9 — The capability widening and the `dispatch_check.rs` re-run

`capabilities/default.json` is `"permissions": []`. Registration needs `core:event:allow-listen`; disposal needs the
separate `core:event:allow-unlisten`, and widening by the first alone yields a listener that **cannot be disposed** rather
than a failure at registration. Rule on whether both go in together and what evidence justifies each, given the file's own
demand for the narrowest set; on what `dispatch_check.rs` must assert now that the list is non-empty, since its
remote-origin sweep and its seventeen-command table both read that file; and on whether the widening lands with the first
`subscribe()` — one sub-step changing both the security surface and the coordinator — or ahead of it, unused.

### Q10 — Closing the drain-guard escaping route file-wide, across all three test files

**Inherited work, not a risk to re-record** (`2d-4b-notes.md` §14.8 item 1). `workspace.svelte.ts` imports its command
wrappers at module level, so a call through one of those bindings rather than through the injected `BrowserCommands`
increments the `drains` counter in nothing. The route is caught in **six named cases and nowhere else**, in **neither**
component `afterEach`, and `workspace.test.ts` has no `@tauri-apps/api/core` mock at all; §9.5 records that taking only the
cheap component half leaves the exposed file exposed while making the other two look guarded. Rule on the closure for
**all three files together** — `vi.mock('$lib/ipc/commands')` with `vi.hoisted` inside a 186-case suite that uses no module
mocking today, versus mocking `@tauri-apps/api/core` as the component suites do, versus a third shape, with each one's
cost — then say what the assertion becomes once an *intended* drain is normal and a blanket `toBe(0)` stops holding.

### Q11 — How 2d-5 is cut into sub-steps

Q7 item 5 says *no component changes means no mounted or window evidence yet*, and the consult assigns components to 2d-6
and the window reading to 2d-7 — but Q1's registry may not be expressible without touching a component, and Q9 changes a
security file. Rule on the split: name the sub-steps (`2d-5-1`, `2d-5-2`, …), **dependency-ordered**, each small enough for
one worker, and for each say (a) what it delivers, (b) what evidence it owes — model tests, mounted evidence, a window
reading, or the machine-checkable gate set alone — and (c) whether it may touch `src/lib/components/` at all. Say which
sub-step, if any, breaks the *no component changes* rule and what justifies it, and which one re-measures the four
baselines: **`events.ts` first becoming reachable from the entry moves `npm run build` by exactly one module**.


## 6. Your output contract

- **Your final message is the deliverable.** Write no file. **Use `###` for your own internal headings, never `##`** —
  one `## VERDICT`-style header of your own at the top is fine, and everything under it is `###`.
- **Open with a short ruling paragraph** — the whole verdict in one place — then answer each numbered question under its
  own `### Qn — <title>` heading, each beginning with an explicit **Ruling:** line, and **end with a section proposing
  the sub-step split** as a dependency-ordered list.
- **Cite `file:line` for every claim about existing code**, derived by you. Where you could not verify something, say so
  plainly in one line rather than asserting it.

## 7. What this brief could not establish — its own coverage bounds

1. **No gate was run for this brief**, and these bounds are named rather than hidden because the house rule is that a
   brief states them to the consultant. §3's figures are `PROGRESS.md`'s, re-read but not re-derived.
2. **§3's table is a snapshot of one reading.** Every range was opened, but correct endpoints do not prove the brief
   characterized everything between them, and Q6's count of six `rememberTheConflict` call sites is from a symbol search
   rather than a type-checked build — re-derive it if your ruling turns on it.
3. **No claim here is made about what a window does.** Only seven files in this repository render a Svelte component in an
   automated test, and this brief ran no window — the consult's Q8 says this phase's sharpest failure is invisible to
   every suite.
4. **Fifteen consecutive review rounds on this material ran on Opus with no second provider**, the last being 2d-4b's own
   design consult (Codex). If you are Opus, that shared prior is invisible from inside it — **look hardest exactly where
   an Opus reviewer would nod.**
5. **This brief takes no position on any question it asks.** Where §3 or §5 reads like an answer it is quoting a shipped
   constraint; the eleven questions are genuinely open, and a ruling that overturns the phase consult's Q4 or Q5 **with
   evidence** is a legitimate outcome.
