# Phase 2d-4b — the TypeScript half of the reconciliation wire

The record of 2d-4b. `docs/decisions/2d-4-split-notes.md` §2 is the spec; the **binding** document is
[`../reviews/phase-2d-4b-design.md`](../reviews/phase-2d-4b-design.md), the design consult, and where
it rules against the split notes or against a habit of this project the ruling wins.

## 1. The design consult (2026-08-30)

Taken before any line of 2d-4b was written, per the standing rule since 2b-2c. Dispatched to **Codex
at high effort** through the companion CLI exactly as
[`codex-dispatch-procedure.md`](codex-dispatch-procedure.md) prescribes — background job, then a
bounded foreground wait polling `.job.status` with the **log file's mtime** as the stall signal,
because `~/.claude/scripts/codex-wait.sh` false-stalls on healthy jobs. Two chained 540 s waits: the
first returned `DEADLINE status=running` (my window closing, not the job's verdict), the second
`TERMINAL=completed after 342s`. Total ≈ 15 minutes, inside the 141 s-to-13 min band that procedure
records, slightly past its top.

**It is the second provider to look at this phase's work since 2d-4a began.** `2d-4a-notes.md` §22.4
carried "seven consecutive Opus rounds with no second provider" forward as *recorded only*, and the
tail's closure expressly did **not** discharge it. This consult does not discharge it either — it is a
consult, not a review round, and it looked at a design rather than at 2d-4a's source. What it does is
stop the streak lengthening through 2d-4b's design.

Codex ran **read-only** and wrote no file; its final message is the deliverable and is reproduced in
the review file verbatim, with only the two edits the procedure permits — the `Resume in Codex`
trailer dropped, the session ID kept. Session `01a051d2-0c24-7f13-bbe3-81f98850b605`.

### 1.1 What the consult changed about the plan

Three things it settled that the split notes left open or would have had the implementer decide:

- **The key-without-accessor hole is closed generally, not per-namespace.** §3 of the split notes had
  recorded the hole as a fact about the present suites; the consult turns it into a registry of typed
  key-builder **function references** compared both ways against the dictionary's `code.*` namespaces,
  with three named exceptions. That is more than 2d-4b's own four namespaces needed.
- **One bounded correction falls out of it.** `duplicateSeam` has EN/ES keys and a TypeScript wire
  type and no key builder — a pre-existing instance of exactly the hole. The consult rules it fixed
  rather than exempted, and names it as found by the required invariant rather than as an unrelated
  localization expansion.
- **The four "when does a drain fire" obligations are 2d-5's, all of them.** The split notes forbid
  2d-4b from deciding whether a surface is open but say nothing about *when* a drain fires; the
  consult assigns registration, post-`open()`, foreground/resume and current-epoch-wake drains to the
  2d-5 coordinator, and leaves 2d-4b supplying transport only.

### 1.2 Two limits the consult states rather than implies

Recorded here because this project's worst defect class is a record claiming a guarantee the code does
not give, and both of these are places where a reader could assume one:

- **The extended `wire_contract.rs` will catch Rust field and variant drift and will still not check
  TypeScript property *type text*** — the contract already admits `byte_len: string` could pass a
  name-only interface check.
- **`u64` epochs and sequences cross as JavaScript `number`s** and are exact only within the
  safe-integer range. There is no mathematically exact `u64` mirror on this wire.

And a third, from Q5: the union forces narrowing and an exhaustive `never` terminus breaks
participating consumers when a fourth arm appears, but **TypeScript does not force `Addressable` and
`Named` to be treated differently after narrowing**. Only 2d-5's model logic and its tests enforce
that.

## 2. The brief the consult answered

Reproduced verbatim so the rulings can be read against what was asked, and so a later round can see
which questions were never put.

````text
# Design consult — Phase 2d-4b, the TypeScript half of the external-change reconciliation wire

You are being asked for an adversarial **design consult**, not a code review and not an
implementation. Nothing of this phase has been written yet. Your ruling shapes what gets written.

## Operating conditions (read these first)

- **Do NOT use web search and do NOT fetch URLs.** Everything you need is in this repository.
- **Read the repository freely.** The workspace may be mounted read-only and you may be unable to
  write any file. That is expected and it **must not affect your verdict**: **your final message IS
  the deliverable**, and the caller captures it verbatim into
  `docs/reviews/phase-2d-4b-design.md`. Do not try to write that file; do not tell the caller to run
  anything to obtain your answer.
- A sandbox limitation, a denied write, or an inability to run `cargo`/`npm` is not a finding and is
  not a reason to hedge a ruling. Say what you could not verify, in one line, and rule anyway.
- **Use `###` for your internal headings**, never `##`. Begin with a single `## VERDICT`-style
  section header of your own if you like, but every subsection under it must be `###`.
- Repository root: `/Users/ccarpio/Developer/espansoConfig`.

## What this project is, and the two rules that dominate every design here

A macOS Tauri v2 + Svelte 5 app for editing espanso YAML config **without ever reformatting the
parts of the file the user did not edit**. Read `CLAUDE.md` at the root — all of it — before ruling.
Two of its rules bear on almost every question below:

1. **A decision record that claims a guarantee the code does not give is this project's worst defect
   class.** Where TypeScript cannot force something, the design must say so in the same sentence
   that says what it does force.
2. **A rule written into one renderer is carried by that renderer's mounted suite alone**, and a
   second renderer can omit it while consuming the model faithfully. This is why decisions live in
   `src/lib/browser/` and `src/lib/ipc/` as values rather than in components.

Also read, because they are the specification and the constraints of this phase:

- `docs/decisions/2d-4-split-notes.md` — **§2 is 2d-4b's whole spec**; §3 says why the EN/ES JSON
  landed in 2d-4a and the accessors in 2d-4b; §4 says what neither step does; §5 says what evidence
  2d-4 owes.
- `docs/reviews/phase-2d-design.md` — the Phase 2d design consult that cut 2d into eight steps.
  **Q3 is the wire** and is the seam 2d-4 is cut on; Q7 item 4 is the deliverable list; Q8 names the
  phase's sharpest green-suite failure mode.
- `src-tauri/src/reconciliation.rs` — everything 2d-4a shipped on the Rust side, heavily documented.
- `PROGRESS.md` — the authoritative project state. Its "Standing rules" and "Open risks" sections.

## What already exists (2d-4a, closed 2026-08-30 after a thirteen-round review tail)

The Rust half of the wire is done and closed:

- the typed reconciliation queue behind the open workspace session;
- `ReconciliationWake { workspace_epoch, newest_sequence }`, emitted on
  `workspace://reconciliation-ready` (see `src-tauri/src/events.rs`);
- the `drain_external_changes` command, **registered and dispatched** — and callable by nothing,
  because no frontend code declares it;
- the wire types `ExternalObservation`, `ObservedDocument`, `ReconciliationBatch`, `AddedContent`,
  `ChangedContent` with their serde representations;
- `wire_contract.rs`, `dispatch_check.rs` and `dictionary_contract.rs` updates;
- the **EN/ES JSON entries** for every new code, in `src/lib/i18n/{en,es}.json` — **keys only, with
  no accessor**, so today they are keys nothing can render.

## What 2d-4b must build (the spec, verbatim from the split notes §2)

> **2d-4b — the TypeScript half of the wire.** The mirrored types, the `BrowserCommands` wrapper for
> the drain, the **injectable** event-listener wrapper, the `describe*` builders in
> `src/lib/i18n/codes.ts` and their reactive `t*` wrappers in `index.ts`, the frontend tests, and the
> re-measured `npm run check` / `npm test` / `npm run build` baselines.

## Four constraints 2d-4b inherits, stated so you do not have to rediscover them

- **`AWAITING_FRONTEND_DECLARATION` in `src-tauri/src/wire_contract.rs` must be deleted by 2d-4b.**
  It is the one-entry gap the split opened, checked in **both** directions — declaring the command
  name on the frontend without deleting the entry fails the Rust build.
- **`src/lib/i18n/codes.test.ts:379` holds variant counts** that the new EN/ES keys do not yet
  appear in, because no accessor exists. Adding the accessors moves those counts.
- **A key with no accessor is a key nothing can render.** 2d-4a's frontend gate is green with the
  keys present and unreachable; that is a fact about the present suites, not a licence.
- **`ObservedDocument` has three arms and no accessor over them, deliberately.** 2d-4b must match on
  the arm rather than reach for the identity where there is one — `Addressable` and `Named` differ in
  whether the **open** workspace will accept the number, and collapsing them with a `?` reintroduces
  round 4's M1 in TypeScript with every Rust gate green.

## What 2d-4b must NOT do

Both halves of 2d-4 inherit Q7 item 4's prohibition verbatim: **this step must not draw anything and
must not decide whether a surface is open.** Deciding whether a write surface is open is 2d-5's
open-surface registry, and Q8 names an incomplete registry as the phase's sharpest failure mode;
drawing is 2d-6. Neither may anticipate either. 2d-4 draws nothing, so it owes **no** mounted and
**no** window evidence.

---

# The questions

Answer every one with a **ruling**, then the reasoning, then the file/line evidence you derived
yourself. Where you are uncertain, say which observation would settle it. Prefer being decisive:
this consult's job is to remove choices from the implementer, not to enumerate them.

### Q1 — Where the mirrored types live, and what keeps them in step with Rust

`src/lib/ipc/types.ts` holds the existing wire mirror and `src/lib/ipc/types.test.ts` guards it.
Should the reconciliation types join that file, or get their own module? What exactly is the
TypeScript shape of an externally tagged serde enum here (`ObservedDocument`, `ExternalObservation`),
given `docs/decisions/2b-2b-3-notes.md` D5's uniform-object rule, and what does the existing mirror
do for the enums it already carries? **Name the mechanism, if any, that would fail if Rust changed a
wire type and TypeScript did not follow** — and if there is no such mechanism, say so plainly and
say whether 2d-4b should build one or deliberately not.

### Q2 — The drain wrapper, and who owns the `afterSequence` watermark

`drain_external_changes(afterSequence)` returns `CommandResult<ReconciliationBatch>` on the
TypeScript side. Rule on: where the wrapper goes (`src/lib/ipc/commands.ts` `BrowserCommands`, or
`src/lib/browser/workspace.svelte.ts`, or both with a split); whether the watermark is state the
wrapper owns, state `workspace.svelte.ts` owns, or a value the caller passes with 2d-4b owning
nothing; and what the epoch check is at this layer. **The hard sub-question: does holding a
watermark or a drained batch anywhere in 2d-4b cross into 2d-5's territory?** If it does, say what
2d-4b's answer to a drain looks like instead. If it does not, say precisely what makes it safe.

### Q3 — The injectable event-listener wrapper

`workspace://reconciliation-ready` must be subscribable in a way frontend tests can drive without
Tauri. Rule on the injection shape (a module-level default with a setter, a factory parameter, a
constructor argument on some existing object — look at how `src/lib/ipc/` already injects `invoke`
and at `src/lib/ipc/menu.ts`, which already listens to something). Rule on unlisten and lifetime:
who unsubscribes, and what happens to a listener across a workspace replacement. Then rule on the
**ordering obligations** the Phase 2d consult's Q3 names — drain after listener registration, after
`open()` completes, and on foreground/resume — and say for **each** whether it is 2d-4b's or a later
step's, because the split notes forbid 2d-4b from deciding whether a surface is open but say nothing
about when a drain fires.

### Q4 — The i18n accessors

`src/lib/i18n/codes.ts` gives twelve typed `describe*` builders over sixteen enum namespaces, wrapped
reactively as `t*` in `index.ts`. Identify **every** code namespace 2d-4a added keys for (derive this
from the Rust enums and `src/lib/i18n/en.json`, not from prose), and rule on: which need a new
builder versus an extension of an existing one; how the "a missing key is a compile error **in that
file**" property is preserved for each; and what `codes.test.ts` must assert so that a namespace
added later cannot land keys with no accessor again. **The last one is the interesting one** — §3 of
the split notes says no present suite asserts that a key has an accessor, and calls that a fact about
the suites rather than a licence. Should 2d-4b close that hole generally, or only for its own
namespaces? Rule, and justify against this project's cost of over-building versus its cost of a
silent gap.

### Q5 — Forcing the three arms of `ObservedDocument` apart in TypeScript

The fourth inherited constraint says collapsing `Addressable` and `Named` with a `?` reintroduces a
High in TypeScript with every Rust gate green. Rule on what, if anything, in the TypeScript design
**makes that collapse fail to compile** rather than merely documenting that it must not happen. If
nothing can, say so in the same sentence as what the design does force — that is this project's
stated worst defect class, and a ruling that quietly implies a guarantee is worse than one that
names the gap. Consider whether the mirror should expose an accessor at all, or deliberately expose
no accessor and force a `switch` at every consumer.

### Q6 — The `AWAITING_FRONTEND_DECLARATION` deletion, and the ordering it implies

Derive how `wire_contract.rs` computes the set of frontend-`declared` command names (what file does
it read, and how). Then rule on the ordering: is the entry deleted in the same commit as the wrapper,
and is there any intermediate state in which either the Rust or the TypeScript gate is red? Say what
a worker should do if the two gates cannot both be green in one step.

### Q7 — Should 2d-4b be cut into steps, and what is its evidence?

2d-4 owes no mounted and no window evidence. It owes model tests and the machine-checkable gate set,
plus three re-measured frontend baselines (`npm run check` files, `npm test` count,
`npm run build` modules — currently `431 / 2125 / 184`, and `CLAUDE.md` §4 explains why the module
number alone decides nothing and gives the discriminating bundle oracle). Rule on whether 2d-4b is
one worker's coherent unit or should be cut, and if cut, where the seam is and why.

### Q8 — The sharpest green-suite failure of THIS step

The Phase 2d consult's Q8 named an incomplete open-surface registry silently auto-reloading over a
live draft. That is 2d-5's. **Name 2d-4b's own**: the defect this step could ship with every gate
green — `cargo test`, `npm run check`, `npm test`, `npm run build` all passing — and say what
observation would catch it. One answer, chosen and defended, not a list of five.

---

Keep the whole reply focused and decisive. Rulings first in each section, evidence after. Do not
restate the brief back at me.
````

---

## 3. What 2d-4b built

One worker, one coherent change, exactly as the consult's Q7 ruled. Two new files —
`src/lib/ipc/events.ts` and its suite — and seventeen modified.

- **Q1.** The seven reconciliation wire types plus `CorrespondenceEntry` / `CorrespondenceTable` and
  five `…Name` unions in `src/lib/ipc/types.ts`, every arm a one-key object. Six new checks in
  `src-tauri/src/wire_contract.rs`: samples, both-direction union / struct / tagged-payload
  comparisons, a source-derived completeness check reading `reconciliation.rs`, an
  empty-payload/no-unit-variant check, and a placeholder check that **asserts** `ObservedDocument`
  owns no `code.` key rather than skipping it.
- **Q2.** `drainExternalChanges(afterSequence)` in `src/lib/ipc/commands.ts` and a required
  `BrowserCommands` member forwarded from `REAL_COMMANDS`. No watermark, no retained batch, no epoch
  comparison, no new `BrowserState` state.
- **Q3.** `events.ts`: `RECONCILIATION_EVENT_NAMES`, `ReconciliationEventSource`, a factory over the
  raw `listen`, `REAL_RECONCILIATION_EVENTS`, and a Rust test comparing the frontend name with
  `RECONCILIATION_READY`.
- **Q4.** Four builders, four `describe*`, four `t*`; counts `4 / 6 / 2 / 2`; the general
  function-reference registry `CODE_NAMESPACE_KEY_BUILDERS` with exactly the three named exceptions;
  and `duplicateSeam` fixed rather than exempted.
- **Q5.** No identity accessor and no brand. The narrowing limit is stated in the JSDoc and exercised
  by a `never`-terminated walk.
- **Q6.** `drain_external_changes` in `COMMAND_NAMES` and `AWAITING_FRONTEND_DECLARATION` **deleted
  outright**, so registered == declared with no exception set at all.

Two knock-on Rust edits the consult did not name and the tree forced: `dictionary_contract.rs`'s
`exempted` assertion now lists `ObservedDocumentName` (its base is already in `NOT_A_CODE` with a
reason) and its union floor moves 44 → 49. The orchestrator re-derived that floor: exactly five new
`…Name` twins, the five value unions skipped as structural.

**One implementation decision the consult did not anticipate.** `strip_comments` in
`wire_contract.rs` has no notion of a string literal and would have eaten
`'workspace://reconciliation-ready'`, so `declared_event_names()` reads `events.ts` **whole**. The
reason is recorded at both ends, and `events.ts` carries a "no comment inside these brackets" rule —
which is a **prose** rule, not an enforced one, and the review checked exactly that.

## 4. The review — one round, `ship-with-fixes`

A fresh `autoclaude-reviewer` on `model: "opus"`, 20-minute budget, report at
[`../reviews/phase-2d-4b.md`](../reviews/phase-2d-4b.md). **Verdict `ship-with-fixes`: 0 blockers,
4 should-fix.** The brief named this round's coverage bounds rather than hiding them — that it was
the **eighth** consecutive Opus review round on this phase's work, and that the consult it was
judging against had itself been reviewed by nobody.

**All four findings were re-derived by the orchestrator before being accepted**, and the third was
derived from `en.json` independently: 719 three-part, 190 four-part and 2 five-part keys overall,
against 400 keys and 52 namespaces under `code.` — 49 builders plus 3 exceptions.

1. **`codes.test.ts` claimed an assertion it did not make.** The comment said every registry value
   *"is asserted to be a function that really produces this namespace's keys"*; the only assertion was
   `typeof builder === 'function'`. `satisfies Readonly<Record<string, (value: never) => TranslationKey>>`
   cannot close it either — `never` accepts every builder — so `addedContent: changedContentKey`
   passed every gate while making `code.addedContent.*` unreachable. **A narrower instance of the
   exact hole Q4 commissioned the registry to close, sitting inside the fix for it.**
2. **`events.ts` named half of what its own lifetime contract needs.** It called
   `core:event:allow-listen` *"the narrowest entry that grants it"*, true of registration and false of
   disposal: the unlisten function `listen` returns invokes `plugin:event|unlisten`, gated by the
   separate `core:event:allow-unlisten`. Both identifiers confirmed in
   `src-tauri/gen/schemas/desktop-schema.json`, and the `_unlisten` body confirmed in
   `node_modules/@tauri-apps/api/event.js`. A phase widening the capability by following that
   sentence alone would get a listener it cannot dispose.
3. **"The complete set of `code.*` namespaces" was a filtered set.** `dictionaryCodeNamespaces()`
   selected on `parts.length === 3`, so a future four-part `code.` key would register no namespace and
   be silently exempt from the reachability invariant — and four-part keys are already an established
   shape in this dictionary, 190 of them.
4. **The evidence was not yet recorded** in this file or in `PROGRESS.md`, which Q7 requires. That
   one is the orchestrator's and is discharged by §6 below and by the checkpoint.

## 5. The fix round, and the four narrower instances it found

Findings 1-3 were fixed by **making the claim true**, never by weakening the sentence:

- `CODE_NAMESPACE_SAMPLES` gives one argument per namespace, its shape derived from the registry via
  `Parameters<>` so a missing or mistyped sample is an `npm run check` error, plus a runtime probe
  calling all 49 builders and asserting the key starts with `code.<its own registry key>.` and exists
  in `en.json`; a runtime key-set case guards the table, because a stale extra entry is otherwise
  invisible. **Mutation-verified**: `addedContent: changedContentKey` now fails with
  *"addedContent produced code.changedContent.projected"*.
- `events.ts` now names **both** permissions and which half of the lifetime each one buys.
- A new case asserts every `code.` key has exactly three parts, **mutation-verified** with a
  temporary four-part key.

The fix worker was told to sweep for the **shape** — *a comment claiming an assertion that is not
made, or a set called complete that is filtered* — rather than for the words, and it returned **four
narrower instances**:

- `events.test.ts`'s *"is not widened to string"* checked nothing, since assigning the correct literal
  compiles against `string` too. Replaced by a type-level
  `ExpectNever<string extends ReconciliationEventName ? 'widened' : never>`.
- `events.test.ts`'s *"keeps no copy of it"* is unobservable from outside the module; the case is
  retitled and the residue stated.
- *"a refusal keeps an unexpected call visible"* in `workspace.test.ts`, `DetailPane.test.ts` and
  `RestorePane.test.ts` observed nothing. Each file now counts drains and asserts zero in
  `afterEach` — verified by temporarily adding a fire-and-forget `drainExternalChanges` to `open()`
  **through the injected `commands` surface**, which produced **254** failures where the suites had
  been silent, then reverted byte-identically. *(Corrected at 2d-4b-B, finding L2: the route matters
  and this sentence did not name it. The same probe written against the module-level import binding
  instead produces **0** failures, which is 2d-4b-B's M1 — see §8.)*
- `wire_contract.rs:3724` claimed the samples carry the *"fullest"* shape while `Changed` uses an
  `Unreadable` content arm and `Removed` uses `previous_revision: None`. The **doc** was corrected
  rather than the samples widened, because widening *permits* placeholders and would loosen the check.

## 6. The gates

Every command run by the orchestrator alone, unpiped, after the fix round, with orphaned bin targets
killed first.

| Gate | Exit | Figure | Anchor |
|---|---|---|---|
| `cargo test --workspace` | 0 | **1320** | 1313 |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean | — |
| `cargo fmt --check` | 0 | clean | — |
| `cargo tree -p espansoconfig-core \| rg tauri` | — | no match | — |
| `npm run check` | 0 | **434** files, 0 errors, 0 warnings | 431 |
| `npm test` | 0 | **2175** over 57 files | 2125 |
| `npm run build` | 0 | **184** modules | 184 |
| server-only bundle oracle | — | **absent** | must be absent |
| client-only bundle oracle | — | **2** | must be present |

**The module count did not move, and that is the correct result rather than a suspicious one.**
`events.ts` is not reachable from the application entry — the orchestrator confirmed independently
that no non-test file under `src/` imports it — and every other change is inside an already-reachable
module. `CLAUDE.md` §4's ladder costs one module per **reachable** new source module, so 184 is what
it predicts. The `npm run check` file count moved by **three** for two new files, the third being
`@tauri-apps/api/event.d.ts` newly entering the program; the review re-derived that
`src/lib/ipc/events.ts` is its only importer.

## 7. Where this phase is thin

Marked per `CLAUDE.md` §7.3. **No item here is a blocker**, and that is a condition of the phase's
state rather than an afterthought to it.

1. **The capability is not widened, and the phase that first registers a listener must widen it —
   *actionable*, and not a correctness defect in source today.** `src-tauri/capabilities/default.json`
   is `"permissions": []`, and Tauri's `listen`/unlisten are *plugin* commands. Nothing in 2d-4b
   registers a listener — no production module imports `events.ts` — so nothing is broken now. The
   widening phase needs **both** `core:event:allow-listen` and `core:event:allow-unlisten`, and must
   re-run `src-tauri/src/dispatch_check.rs` over the widened file.
2. **The `events.ts` "no comment inside these brackets" rule is prose, not an enforced rule —
   *recorded only*.** `declared_event_names()` reads the file whole because `strip_comments` has no
   notion of a string literal. A comment placed inside those brackets would be parsed as an event
   name; nothing fails first.
3. **Q8's named failure is undischarged by construction — *recorded only*.** A production Tauri
   listener adapter that never delivers a real wake, while its injected fake works, passes all four
   gates. The consult assigns that probe to **2d-7**, and no test in this repository can establish it.
4. **Eight consecutive Opus review rounds with no second provider — *recorded only*.**
   `2d-4a-notes.md` §22.4 carried seven; this phase's review makes eight. The design consult was
   Codex, which stops the streak lengthening through the *design* and not through the *review*.
5. **The consult itself was reviewed by nobody — *recorded only*.** Its rulings are the acceptance
   standard this phase was judged against. The review brief said so explicitly and invited a finding
   against a ruling on its face; none was returned.
6. **`u64` epochs and sequences cross as JavaScript `number`s — *recorded only*.** Exact only within
   the safe-integer range, as §1.2 states. Nothing in this phase can widen that, and 2d-5's watermark
   arithmetic inherits it.

---

## 8. Phase 2d-4b-B — the review of the fix round (2026-08-31)

**Why it exists.** §5's fix round changed eight source files, so `CLAUDE.md` §7.1 commissioned a round
scoped to it. Under `/autoclaude`'s one-review-per-phase cap that round is a corrective phase — the
same shape as 2d-4a's D → E → F → G → H chain, and the case §7.4 describes in as many words. **2d-4b
is superseded by 2d-4b-B, never recorded as complete.**

**The round.** A fresh `autoclaude-reviewer` on `model: "opus"`, 25-minute budget, report at
[`../reviews/phase-2d-4b-B.md`](../reviews/phase-2d-4b-B.md). Verdict **`ship-with-fixes`: 0 High,
1 Medium, 2 Low.** The scope could not be a `git diff` — the fix round was folded into `be8d424`
alongside the implementation it fixed, so there is no pre-fix tree — and the brief therefore named the
eight files by the **construct** the fix put in each. It also named the six residues of §7 as
already-recorded and out of scope, and stated this round's own coverage bound: the **ninth**
consecutive Opus round on this phase's work, judged against a consult nobody reviewed.

The reviewer mutated three files to measure claims and reverted all three with `git checkout --`; the
orchestrator confirmed the tree independently afterwards.

### 8.1 What the round re-derived rather than accepted

The brief demanded three claims be re-derived, because each is a claim that *a test proves something*.
All three held:

- **49 builders, 3 exceptions, 52 namespaces.** The runtime probe calls every entry, the emitted key
  starts with `code.<its own registry key>.`, and `Object.hasOwn(en, produced)` holds. The mis-wiring
  mutation `addedContent: changedContentKey` fails with the message §5 reports, and a **missing**
  sample is `TS2741` at `npm run check` — so the `Parameters<>` mapped type really is the compile-time
  half. The `as (value: unknown) => TranslationKey` cast at `codes.test.ts:1071` reopens nothing: it
  narrows the call, not the table.
- **`wire_contract.rs:3724` is true of the samples as they stand.** `ContentRevision` serialises as a
  string, `Changed`'s content arm is `Unreadable`, `Removed` carries `previous_revision: None`, and
  the sentence's account of which placeholders are permitted matches what
  `every_reconciliation_placeholder_names_an_operand_serde_writes` computes. The samples were not
  widened, deliberately.
- **`ExpectNever` fails on widening**, and both `core:event:allow-listen` and
  `core:event:allow-unlisten` exist with the lifetime halves `events.ts` now attributes to them.

The one claim that did **not** hold whole is the drain guard's, and that is M1.

### 8.2 M1 (Medium, source) — an assertion's sentence claiming more than the assertion measures

`workspace.test.ts` said *"nothing in `BrowserState` drains"* and that the count *"is what makes an
unexpected call visible"*. The count makes visible a call routed through the **injected**
`BrowserCommands` surface, and nothing else. `workspace.svelte.ts:44-60` imports all thirteen command
wrappers at module level to build `REAL_COMMANDS`, so every one of those bindings —
`drainExternalChanges` among them — is in scope inside every closure `createBrowserState` returns, and
a call made through the binding rather than through the injected `commands` parameter increments
nothing. **Measured, not argued**: a fire-and-forget drain inserted at the head of `open()` against the
module binding leaves the suite at **186 passed, 0 failed** — the exact silence the fix round was
commissioned to end, through a route the file already had open. The probe §5 actually ran went through
the injected surface and produced 254 failures; the two routes give 254 and 0, and §5 named neither.

**This is `CLAUDE.md`'s standing rule about refusals, applied to an assertion.** *A refusal's sentence
must be true of its predicate, not of its name* — `documentHasUnsavedDraft` is the precedent. The fix
bounds the sentences to the injected surface and states the escaping route **where the count is
incremented** rather than in a distant paragraph.

> **Corrected at 2d-4b-C.** This paragraph said the fix bounded *"all six sentences (two in each
> file)"*. The diff bounded **eight** comment blocks — two in `workspace.test.ts`, three in
> `DetailPane.test.ts`, three in `RestorePane.test.ts` — and the miscount is not cosmetic: **the
> seventh block, `workspace.test.ts`'s own `drains` doc comment, was never bounded at all**, and
> counting to six is what hid it. 2d-4b-C found it as its M1, in the one file whose subject module is
> the escaping route. Two further sentences of this paragraph were also wrong and are corrected in
> §9: the route is uniform across **sixteen** wrappers and **two** injected surfaces rather than
> across thirteen members of one, and *"the two component suites have no such route today"* was false —
> both mount a real `BrowserState`, so both execute the module that holds the binding.

**Two stronger closures were considered and declined, and the reasons are here so a later phase can
overrule them deliberately:**

1. **`vi.mock('$lib/ipc/commands')` with `vi.hoisted`**, so the module binding *is* the counted fake.
   This would make the unbounded sentence true rather than bounding it, which is normally this
   project's preferred direction. Declined here because it introduces module mocking into a 186-case
   suite that uses none today, to close a route no production code takes, inside a fix round scoped to
   one Medium about a comment.
2. **A source-text check** asserting `drainExternalChanges(` occurs in `workspace.svelte.ts` only
   inside the `REAL_COMMANDS` literal. Declined because it is the *"a set called complete that is
   filtered"* shape this phase has already been bitten by twice, and because §7 item 2 already records
   that this repository's one file-text rule (`declared_event_names()`) has no notion of a string
   literal.

Either is 2d-5's to adopt: 2d-5 is the phase that starts draining, and it owns the guard that must
then catch a drain it did not intend.

### 8.3 L1 (Low, source) — an ordering sentence that inverted its own code

*"The count is cleared before it is read"* is the inverse of `const drained = drains; drains = 0;
expect(drained).toBe(0);` — read, then cleared, then asserted. The isolation property the sentence
argues for is real, because the reset precedes the throw; the sentence describing it was not. All
three suites now say *read, then cleared, then asserted*.

### 8.4 L2 (Low, record) — a verification figure that did not name its route

§5's *"254 failures … then reverted byte-identically"* did not say which route the probe used, and the
two routes give 254 and 0. §5 now names the injected surface and points here, so the figure cannot be
read as evidence that any drain in `open()` is caught.

### 8.5 The gates, re-run after the fix

Every command run by the orchestrator alone, unpiped, with orphaned bin targets killed first.

| Gate | Exit | Figure | Anchor |
|---|---|---|---|
| `cargo test --workspace` | 0 | **1320** | 1320 |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean | — |
| `cargo fmt --check` | 0 | clean | — |
| `cargo tree -p espansoconfig-core \| rg tauri` | — | no match | — |
| `npm run check` | 0 | **434** files, 0 errors, 0 warnings | 434 |
| `npm test` | 0 | **2175** over 57 files | 2175 |
| `npm run build` | 0 | **184** modules | 184 |
| server-only bundle oracle | — | **absent** | must be absent |
| client-only bundle oracle | — | **2** | must be present |

**No figure moved, and that is the prediction rather than a suspicious result**: this phase changed
comment text in three test files and one record file, and no test case, no production module and no
Rust line. The two bundle oracles were still read, because the module count alone decides nothing.

### 8.6 What happens next, by rule

The fix changed **three source files** — `src/lib/browser/workspace.test.ts`,
`src/lib/components/DetailPane.test.ts` and `src/lib/components/RestorePane.test.ts`. Under §7.1 the
unit is the file and a comment-only change counts, so a round is commissioned, scoped to that fix; the
cap makes it corrective phase **2d-4b-C**. `docs/decisions/2d-4b-notes.md` and this section are on
§7's closed list and commission nothing.

### 8.7 Where this phase is thin

Marked per `CLAUDE.md` §7.3.

1. **The escaping route is now *stated* rather than *closed* — *actionable*, and not a correctness
   defect in source.** After the fix the comments are true of what the counter measures, so nothing in
   source is wrong; what remains is a coverage gap a later phase may close by §8.2's option 1 or
   option 2. 2d-5 is the natural owner. The step closes without it.
2. **The bypass was measured only for `workspace.svelte.ts` — *recorded only*.** The review did not
   enumerate every module that could acquire a direct import of a command wrapper later. The two
   component suites are clean today by inspection, not by a check.
3. **The review ran no Rust gate and no `svelte-check` — *recorded only*.** Its `wire_contract.rs`
   derivation is by reading `ContentRevision`'s serialisation and the operand filter, and its
   compile-time claims were checked with `npx tsc` rather than `npm run check`. The orchestrator ran
   every gate afterwards; the figures are §8.5.
4. **Ninth consecutive Opus review round with no second provider — *recorded only*.** §7 item 4
   carried eight. The 2d-4b design consult was Codex, which stops the streak lengthening through the
   design and not through the review.
5. **`CODE_NAMESPACE_SAMPLES` proves one member per namespace, not per-variant coverage — *recorded
   only*.** The suite says so; `dictionary_contract.rs` owns the per-variant half on the Rust side,
   and nothing here re-derives it.

---

## 9. Phase 2d-4b-C — the review of 2d-4b-B's fix (2026-08-31)

**Why it exists.** §8's fix changed three source files — six comment blocks, no executable line — so
`CLAUDE.md` §7.1 commissioned a round scoped to it, and the one-review-per-phase cap made that round a
corrective phase. **2d-4b-B is superseded by 2d-4b-C, never recorded as complete.**

**The round.** A fresh `autoclaude-reviewer` on `model: "opus"`, 25-minute budget, report at
[`../reviews/phase-2d-4b-C.md`](../reviews/phase-2d-4b-C.md). Verdict **`ship-with-fixes`: 0 High,
2 Medium, 2 Low.** Unlike 2d-4b-B's, this scope **was** a real diff — `git show 1c34579 -- src/` — and
the brief said so. The reviewer mutated nothing; the orchestrator confirmed the tree independently.

It confirmed four things by checking rather than by reading: the thirteen-member uniformity claim, the
*186 passed, 0 failed* figure (a live single-file run gives 186) together with its attribution to
2d-4b-B, that no `.svelte` component imports the wrapper, and that both `afterEach` indirections
resolve to the doc comments they point at.

### 9.1 M1 (Medium, source) — the narrower instance the previous fix left standing

`workspace.test.ts:313-314`, the `drains` doc comment, still read **"no case in it may drain,
whichever surface it built and however many"** — the unbounded claim 2d-4b-B was commissioned to
remove, **surviving in the one file whose subject module is the escaping route**. The fix bounded that
file's stub comment and its `afterEach`, and bounded the *equivalent doc comment in both component
suites*, and skipped this one.

**This is the third consecutive round on this phase to close a finding and leave a narrower instance
of it standing**, and `CLAUDE.md` says the mechanism in as many words: *sweep for what the type now
says, not for the words the old type used*. Here the mechanism was arithmetic — §8.2 counted "all six
sentences, two in each file", the diff actually touched eight blocks in a 2/3/3 split, and **counting
to six is what hid the seventh**. The miscount was 2d-4b-C's L2 and the survivor was its M1; they are
one defect seen twice. §8.2 now carries a correction block saying so.

### 9.2 M2 (Medium, source) — a route named absent while it was live

Both component doc comments said the other route was *"a module-level import of
`drainExternalChanges`, which no component has today"*. True of components and false of what those
files execute: `DetailPane.test.ts:285` and `RestorePane.test.ts:544` both build a **real**
`BrowserState` through `createBrowserState`, so both run `workspace.svelte.ts`, which holds exactly
that binding. The clause named the wrong subject — *component* where *the module under the component*
was meant — and so reported a live route as absent.

Both comments now say the route is live, keep *no component imports the wrapper* as the narrower true
statement it is, and name the **partial trap those two files do have and the count is not**: the
`vi.hoisted` `invoke` mock at the head of each file rejects, so a drain taking the module route would
record on `invoked` — but `invoked` is asserted case by case (`DetailPane.test.ts:534`,
`RestorePane.test.ts:808`, `:911`, `:941`, `:968`, `:1084`) and never in the `afterEach`, so it
catches nothing file-wide. `workspace.test.ts` mocks `@tauri-apps/api/core` not at all, which is why
that file is the exposed one; its comment now says that too.

> **Corrected at 2d-4b-D.** Every line citation in this section was written against the file as it
> stood **before** this section's own fix, and so was stale by exactly **+6** — the fix's net delta in
> each component suite (+9/−3). The eight numbers above are the corrected ones, re-derived on the
> committed tree; the originals were 279, 538, 528, 802, 905, 935, 962 and 1078, of which
> `RestorePane.test.ts:802` had come to point at a fixture string. **A line citation written during a
> fix measures the file the fix replaced**, which is the same shape as the header-size defect
> `PROGRESS.md` has had to correct twice, and it is why §10 re-derives its own citations after the
> edit rather than before it.

### 9.3 L1 (Low, source) — "every command wrapper, to build `REAL_COMMANDS`"

`workspace.svelte.ts:44-60` imports **sixteen** wrappers, and three of them
(`listBackupBatches`, `listBackupEntries`, `readBackupText`) build `REAL_BACKUP_COMMANDS` at `:387-391`
rather than `REAL_COMMANDS`. So the route is uniform across **sixteen** bindings and **two** injected
surfaces — `BrowserCommands` and `BackupCommands` — and the comment said thirteen members of one.
Corrected where the count is incremented.

### 9.4 L2 (Low, record) — the miscount that hid M1

Covered by §9.1 and by the correction block now standing in §8.2.

### 9.5 The closure that was *not* taken, and what 2d-5 inherits

§8.2 declined two closures and assigned them to 2d-5. 2d-4b-C's M2 sharpens that inheritance rather
than changing it, and the asymmetry is the point:

- In **`DetailPane.test.ts` and `RestorePane.test.ts`** the closure is nearly free — one
  `expect(invoked).not.toHaveBeenCalled()` in each `afterEach` would make the trap file-wide, since
  `invoked` is only ever asserted *not* called in either file.
- In **`workspace.test.ts`** it is not free at all: that suite has no `@tauri-apps/api/core` mock, so
  closing the route there means §8.2's option 1 (`vi.mock` on `$lib/ipc/commands` with `vi.hoisted`)
  inside a 186-case suite that uses no module mocking today.

Taking only the cheap half would leave the exposed file exposed while making the other two look
guarded, which is worse than a uniformly stated bound — so neither half was taken here, and both are
recorded for 2d-5 to decide together. 2d-5 is the phase that starts draining and therefore the phase
that needs the guard to catch a drain it did not intend.

### 9.6 The gates, re-run after the fix

| Gate | Exit | Figure | Anchor |
|---|---|---|---|
| `cargo test --workspace` | 0 | **1320** | 1320 |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean | — |
| `cargo fmt --check` | 0 | clean | — |
| `cargo tree -p espansoconfig-core \| rg tauri` | — | no match | — |
| `npm run check` | 0 | **434** files, 0 errors, 0 warnings | 434 |
| `npm test` | 0 | **2175** over 57 files | 2175 |
| `npm run build` | 0 | **184** modules | 184 |
| server-only bundle oracle | — | **absent** | must be absent |
| client-only bundle oracle | — | **2** | must be present |

No figure moved. This phase, like 2d-4b-B, changed comment text and nothing executable.

### 9.7 What happens next, by rule

The fix changed **three source files** — the same three. §7.1 commissions a round scoped to it, and
the cap makes it corrective phase **2d-4b-D**. This section and §8.2's correction block are on §7's
closed list and commission nothing on their own.

### 9.8 Where this phase is thin

Marked per `CLAUDE.md` §7.3.

1. **The escaping route is stated, not closed, and now in a second form — *actionable*, not a
   correctness defect in source.** §9.5 is the inheritance. The comments are true as they stand; what
   remains is coverage a later phase may add. The step closes without it.
2. **`invoked` is described as a per-case trap by inspection of six call sites — *recorded only*.**
   Nothing checks that a seventh assertion site does not appear, or that a future case does not
   legitimately invoke and make a file-wide assertion wrong.
3. **Three consecutive rounds have each left a narrower instance of their own finding standing —
   *recorded only*, and the sharpest thing this phase has produced.** §9.1 names the mechanism for
   this one (an arithmetic miscount in the record hiding a block in the diff). What is *not* recorded
   anywhere is a check that a fix's own claimed extent matches its diff; that is a shape, not a
   defect in a file, so it is recorded rather than actionable.
4. **Tenth consecutive Opus review round with no second provider — *recorded only*.** §8.7 item 4
   carried nine.
5. **The two `afterEach` indirections were confirmed to resolve, at their current wording —
   *recorded only*.** *"bounded as the count's own doc comment states"* is a pointer, and a pointer is
   only as true as its target; nothing fails if a later edit changes the target and not the pointer.

---

## 10. Phase 2d-4b-D — the review of 2d-4b-C's fix (2026-08-31)

**Why it exists.** §9's fix changed three source files — four comment blocks, no executable line — so
`CLAUDE.md` §7.1 commissioned a round scoped to it. **2d-4b-C is superseded by 2d-4b-D.**

**The round.** A fresh `autoclaude-reviewer` on `model: "opus"`, 25-minute budget, report at
[`../reviews/phase-2d-4b-D.md`](../reviews/phase-2d-4b-D.md). Verdict **`ship-with-fixes`: 0 High,
1 Medium, 2 Low.** The brief told it in as many words that `ready` was a legitimate verdict and that a
tail is not prolonged by manufacturing a finding; it returned three anyway, and all three were
re-derived by the orchestrator before being accepted.

**It verified the diff's extent before reading any sentence about it**, which is what §9.8 item 3
asked the next round to do: `git show e510819 -- src/ | grep -c '^@@'` gives **4**, every changed line
a comment. It also confirmed the sixteen/thirteen/three/two split, the partial trap, and — the thing
three rounds running had failed at — that **no unbounded sentence survives** anywhere in the three
files.

### 10.1 M1 (Medium, source) — a discriminator that does not discriminate

The route paragraph ended *"This file mocks no `@tauri-apps/api/core`, so nothing else in it notices
such a call either — **unlike the two component suites, which reject at `invoke`**"*. The contrast is
false. `workspace.test.ts` carries no `@vitest-environment` docblock, so it runs in **node**, where the
real `invoke` (`node_modules/@tauri-apps/api/core.js:201-203`) dereferences
`window.__TAURI_INTERNALS__` and throws; `call()` (`src/lib/ipc/commands.ts:249-254`) catches that in
exactly the way it catches the component suites' rejecting mock. **A fire-and-forget drain is swallowed
in all three files**, so rejection is not the asymmetry.

The real asymmetry is **recording**: the component suites' `vi.hoisted` `invoked` spy records the call
on its way to rejecting, and this file has no spy at all. The comment now says that, and says the
mechanism rather than asserting the conclusion.

**This is a comment that was true of the conclusion and false about the reason** — the third distinct
shape this chain has produced, after *a claim wider than its predicate* (§8.2) and *a subject named
wrongly* (§9.2).

### 10.2 L1 (Low, source) — two figures, two phases, one attribution

The paragraph attributed both measurements to Phase 2d-4b-B. **254 is 2d-4b's**, from the probe §5
records through the injected surface; **186 is 2d-4b-B's**, from the probe through the binding. §8.2
already said so, so the comment contradicted the record it was derived from. Both figures now name
their own phase and their own route.

### 10.3 L2 (Low, record) — eight line citations stale by exactly the fix's own delta

Every line number in §9.2 was written against the file as it stood **before §9.2's own fix**, and so
was stale by **+6**, the net delta of `+9/−3` in each component suite. `RestorePane.test.ts:802` had
come to point at a fixture string. The correction block in §9.2 carries the corrected eight and the
originals.

**A line citation written during a fix measures the file the fix replaced.** That is the same shape as
the `PROGRESS.md` header-size defect this project has corrected twice, and the same shape as §9.1's
miscount — a figure taken from the wrong version of the thing it describes. This section's own
citations were re-derived **after** its edits landed, not before.

### 10.4 What the round could not verify

Stated because it stated it. The *"254 failures across the three suites that count"* breakdown was
**not** re-verified: re-running that probe means mutating source, which the brief forbade, and the
record has never broken 254 down per file. The workspace-wide gates were reserved to the orchestrator
and are §10.5.

### 10.5 The gates, re-run after the fix

| Gate | Exit | Figure | Anchor |
|---|---|---|---|
| `cargo test --workspace` | 0 | **1320** | 1320 |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean | — |
| `cargo fmt --check` | 0 | clean | — |
| `cargo tree -p espansoconfig-core \| rg tauri` | — | no match | — |
| `npm run check` | 0 | **434** files, 0 errors, 0 warnings | 434 |
| `npm test` | 0 | **2175** over 57 files | 2175 |
| `npm run build` | 0 | **184** modules | 184 |
| server-only bundle oracle | — | **absent** | must be absent |
| client-only bundle oracle | — | **2** | must be present |

### 10.6 What happens next, by rule

The fix changed **one** source file — `src/lib/browser/workspace.test.ts`, one comment block — so
§7.1 commissions a round, and the cap makes it corrective phase **2d-4b-E**. The other two files were
untouched this round, and the tail has narrowed from three files to one.

### 10.7 Where this phase is thin

Marked per `CLAUDE.md` §7.3.

1. **The escaping route is still stated, not closed — *actionable*, not a correctness defect in
   source.** §9.5 is the unchanged inheritance, and 10.1 sharpens what it costs: no suite records such
   a call except through a spy two of the three files happen to have. 2d-5 owns it. The step closes
   without it.
2. **The 254 figure has never been broken down per file — *recorded only*.** Three rounds have now
   cited it and none has re-derived it; re-deriving it means mutating source and re-running the suites.
3. **Four consecutive rounds, four distinct defect shapes in the same paragraph — *recorded only*, and
   the sharpest thing this chain has produced.** A claim wider than its predicate, a subject named
   wrongly, a reason that was false while the conclusion held, and a figure taken from the wrong
   version. Nothing checks any of these; they are found by reading, once per round, and each round has
   found the previous round's.
4. **Eleventh consecutive Opus review round with no second provider — *recorded only*.** §9.8 item 4
   carried ten.
5. **`workspace.test.ts` runs in node by omission, not by declaration — *recorded only*.** 10.1's
   derivation depends on it, and nothing in the file says so; a later `@vitest-environment jsdom`
   docblock would make that paragraph's reasoning stale without failing anything.

## 11. Phase 2d-4b-E — the review of 2d-4b-D's fix (2026-08-31)

**Why it exists.** §10's fix changed one source file — `src/lib/browser/workspace.test.ts`, one
comment block, no executable line — so `CLAUDE.md` §7.1 commissioned a round scoped to it.
**2d-4b-D is superseded by 2d-4b-E.**

**The round.** A fresh `autoclaude-reviewer` on `model: "opus"`, 25-minute budget, report at
[`../reviews/phase-2d-4b-E.md`](../reviews/phase-2d-4b-E.md). Verdict **`ship-with-fixes`: 0 High,
1 Medium, 1 Low** — both in source, both in the same paragraph, both fixed. The brief said in as many
words that `ship` was legitimate and named the four residues it was not to re-file; it returned two
findings and re-filed none of them.

**It verified the diff's extent before reading any sentence about it**, as §9.8 item 3 asked and as
every round since has done: `git show 6dba9f7 -- src/ | grep -c '^@@'` gives **1**, every changed line
a comment. The orchestrator re-derived that count independently.

### 11.1 M1 (Medium, source) — an asymmetry named without its limit

§10.1 replaced *rejecting* with *recording* as the real asymmetry between this suite and the two
component suites, and that replacement was correct. What it did not carry is the limit **both component
suites state in their own comments**: the `invoked` spy is *"a partial trap … asserted case by case and
never in the `afterEach`, so it catches nothing file-wide"* (`DetailPane.test.ts:164-168`,
`RestorePane.test.ts:439-443`).

Re-derived by the orchestrator rather than accepted: `expect(invoked).not.toHaveBeenCalled()` appears
**once** in `DetailPane.test.ts` (line 534) and **five** times in `RestorePane.test.ts` (808, 911, 941,
968, 1084) — six in total — and **neither `afterEach` reads it**. Both read `drains`, the *injected*
count, and assert it is zero (`DetailPane.test.ts:341-350`, `RestorePane.test.ts:759-768`).

**The wrong conclusion it invited is a Phase 2d-5 one.** A reader of this paragraph alone concludes the
binding route is already trapped file-wide in the other two suites and that only `workspace.test.ts`
needs a closure. It is not, and 2d-5 owes a closure to **all three**. §9.5 and §10.7 item 1 say the
route is open; this comment was the one place that implied it was two-thirds closed.

**This is the fourth distinct shape and the first repeat: a claim wider than its predicate**, which is
§8.2's shape exactly, one generation later and about a different subject. The fix names the limit, cites
where both suites state it, gives the 1/5 split and says what the `afterEach` reads instead.

### 11.2 L1 (Low, source) — a mechanism borrowed from the environment the sentence excludes

The paragraph said the real `invoke` *"dereferences `window.__TAURI_INTERNALS__` and throws"*. Under
node there is no dereference: `window` is undeclared, so evaluating the **identifier** throws
`ReferenceError: window is not defined` before any property access. The mechanism described — a present
`window` whose property is missing, giving a `TypeError` — is **jsdom's**, and jsdom is what the
sentence's own premise (*"it runs in node"*) excludes.

**Measured, not reasoned, and measured one step further than the round could.** The reviewer is
read-only and recorded under NOT-VERIFIED that it had inferred node's `window` from `vite.config.ts:65`
(`environment: 'node'`, and there are **no** `setupFiles` or `globalSetup` in that config) plus
bare-node behaviour. The orchestrator wrote a throwaway probe under `src/lib/browser/`, ran it through
`npx vitest run`, and read the values back through a forced assertion:
`typeof globalThis.window === 'undefined'`, and the expression throws
`ReferenceError: window is not defined`. The probe was deleted and `git status --short` confirmed it
left nothing behind. **So this is measured inside vitest, not in bare node**, and §10.7 item 5 —
*runs in node by omission* — is now what the comment itself says out loud.

The conclusion was never wrong: it throws, `call()` (`../ipc/commands.ts:249-254`) catches it exactly
as it catches the component suites' rejecting mock, and a fire-and-forget drain is swallowed in all
three files. **A reason false while its conclusion holds** is §10.1's shape, so this chain has now
repeated both of its two previous shapes rather than producing a fifth.

`core.js:202` was re-derived after the edit (`rg -n 'window.__TAURI_INTERNALS__.invoke\(cmd'`), as were
all four citations the new paragraph carries — §10.3's rule, applied to this section too.

### 11.3 What the round could not verify

Stated because it stated it, and none of it is new:

- **The 254 figure**, taken on trust from §5. Re-deriving it means mutating source and re-running three
  suites; §10.7 item 2 already carries it.
- **That `window` is absent under vitest's node environment** — reasoned by the round, and **closed by
  the orchestrator's measurement** in §11.2 above.
- **Whether 2d-4b-B's binding-route probe failed anything in the two component suites.** Recorded
  nowhere and not measured; §8.2's *"186 passed, 0 failed"* is stated of `workspace.test.ts` alone.
  M1 does not depend on it. **This is new, and it is the sharpest thing the round noticed about the
  record** — the binding probe's blast radius outside this one file has never been written down.
- The workspace-wide gates, reserved to the orchestrator and run in full below.

Re-derived by the round rather than trusted: the hunk count, a live 186-passed run of this suite, the
sixteen/thirteen/three/two split, the docblock's absence, the absence of any `vi.mock(` in the file, the
`core.js:201-203` and `commands.ts:249-254` citations, and that `classifyFailure` never rethrows.

### 11.4 One correction the fix made that the round did not ask for

The first draft of the M1 fix said *"all three files are open on the binding route"*, which is **wider
than its predicate** — the very defect being fixed. The other two are open *file-wide*, but the six
cases that assert `invoked` do catch a binding-route drain. The shipped sentence is
*"no file closes the binding route file-wide: the other two catch it in the six cases that assert
`invoked` and nowhere else"*. Recorded because the shape reappeared inside its own repair.

### 11.5 The gates, re-run after the fix

| Gate | Exit | Figure | Anchor |
|---|---|---|---|
| `cargo test --workspace` | 0 | **1320** over 26 binaries, 0 failed | 1320 |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean | — |
| `cargo fmt --check` | 0 | clean | — |
| `cargo tree -p espansoconfig-core \| rg tauri` | — | no match | — |
| `npm run check` | 0 | **434** files, 0 errors, 0 warnings | 434 |
| `npm test` | 0 | **2175** over 57 files | 2175 |
| `npm run build` | 0 | **184** modules | 184 |
| server-only bundle oracle | — | **absent** | must be absent |
| client-only bundle oracle | — | **2** | must be present |

No figure moved, which is the prediction: the phase changed comment text in one test file and nothing
else. Each command was run unpiped and its exit status read from the tool, not from a pipeline.

### 11.6 What happens next, by rule

The fix changed **one** source file — `src/lib/browser/workspace.test.ts`, the same comment block — so
§7.1 commissions a round, and the cap makes it corrective phase **2d-4b-F**. The tail has not narrowed
further this round: it was one file and one block before, and it is one file and one block now. What
did change is the **shape** of what is being found — rounds 2, 3 and 4 each produced a new defect shape,
and round 5 produced two **repeats** of shapes already on file (§8.2's and §10.1's). §7.2 is explicit
that a tail finding real defects is a tail doing its job and that nothing licenses forcing its end; both
findings here were re-derived before being accepted, and one was measured further than the round could
reach.

### 11.7 Where this phase is thin

Marked per `CLAUDE.md` §7.3.

1. **The escaping route is still stated, not closed — *actionable*, not a correctness defect in
   source.** Unchanged inheritance from §9.5 and §10.7 item 1, now sharpened again: **no file traps it
   file-wide**, and the two that trap it at all do so in six named cases. 2d-5 owes a closure to three
   files, not one. The step closes without it.
2. **The 254 figure has never been broken down per file — *recorded only*.** Four rounds have cited it
   and none has re-derived it. Unchanged from §10.7 item 2.
3. **2d-4b-B's binding probe was measured on `workspace.test.ts` alone — *recorded only*.** Whether it
   failed anything in the two component suites is written down nowhere, so *"186 passed, 0 failed"*
   bounds one file and the record has never said what the other two did. New this round.
4. **Twelfth consecutive Opus review round with no second provider — *recorded only*.** §10.7 item 4
   carried eleven.
5. **Five rounds, four shapes, and the last round repeated two of them — *recorded only*.** A claim
   wider than its predicate (§8.2, and again in §11.1 and once inside §11.1's own repair), a subject
   named wrongly (§9.2), a reason false while the conclusion held (§10.1, and again in §11.2), and a
   figure from the wrong version of the file (§10.3). **Nothing checks any of them**, and the repeat is
   the evidence that reading once per round does not converge on its own — each round has still found
   the previous round's.
6. **The comment run above the stub is 43 lines and the stub is 8 — *recorded only*, and ANSWERED by
   round F.** At round E: lines 446-488 of `src/lib/browser/workspace.test.ts` were comment and
   **489-496** were `drainExternalChanges`, of which the route paragraph the chain had been repairing
   was 453-488, **36 lines**. That length is what made this paragraph the chain's sole subject for five
   rounds, and this item asked whether it should be shortened, or moved into the record and pointed at
   from the file, instead of repaired in place. **§12.1 is round F's answer: it was moved.** The run is
   now **24** lines (446-469) over an unchanged 8-line stub (470-477), and it cites no line number in
   any file.

   **Two corrections this item has needed, and they are the same shape twice.** The figure first
   written here was *"26 lines above a four-line stub"*, estimated rather than counted and wrong in both
   halves — §11.4's shape, inside the section recording it. Its replacement, labelled *"Measured after
   the fix, not estimated"*, said **9** and named `489-497`, and was **off by one**: `:497` is the `};`
   closing the object literal `scriptedCommands()` returns, not part of the stub. Round F found it.
   §12.2 is the record. Three of the four figures were measured and the fourth was not, which is why
   *"measured"* on a line of figures is a claim about each one and not about the line.

### 11.8 What `workspace.test.ts`'s drain comment defers to this section

**Phase 2d-4b-F moved the detail out of that comment and left a pointer here, so this subsection is
what the pointer must find.** It consolidates the four claims the comment used to carry in full, and the
reason for the move is §12.1. **Each figure below says how far it has been checked, because they have
not been checked equally**: the 186 is re-derived live, the sixteen/thirteen/three has been confirmed
by four consecutive rounds reading the module, and the 254 is carried forward from the phase that
recorded it and has never been broken down per file. An earlier draft of this sentence claimed every
figure was re-derived here, which claim 2 and §11.7 item 2 contradict in this section's own words.

**1. Sixteen wrappers, two injected surfaces.** `src/lib/browser/workspace.svelte.ts` imports **sixteen**
command wrappers at module level — **thirteen** to build `REAL_COMMANDS` and **three** to build
`REAL_BACKUP_COMMANDS`. Every one of those bindings, `drainExternalChanges` among them, is in scope
inside every closure `createBrowserState` returns, so the escaping route is uniform across all sixteen
and both injected surfaces and is **never special to the drain member**. Confirmed at rounds C, D, E
and F.

**2. Two phases probed two routes, and the figures belong to different ones.** Phase 2d-4b probed the
**injected** surface and got **254** failures across the three suites that count. Phase 2d-4b-B probed
the **binding**, with a fire-and-forget drain at the head of `open()`, and `workspace.test.ts` stayed
at **186 passed, 0 failed** — 186 re-derived live at round F by `npx vitest run
src/lib/browser/workspace.test.ts`. **The 254 has never been broken down per file** (§11.7 item 2) and
**the 186 bounds one file only** (§11.7 item 3): what 2d-4b-B's binding probe did to the two component
suites is recorded nowhere.

**3. A drain is swallowed in all three files, and the asymmetry is recording rather than rejecting.**
`workspace.test.ts` mocks no `@tauri-apps/api/core` and carries no `@vitest-environment` docblock, so it
runs under `vite.config.ts`'s `environment: 'node'` — where there are no `setupFiles` and no
`globalSetup`, and `globalThis.window` is `undefined`. The real `invoke`
(`node_modules/@tauri-apps/api/core.js:202`) therefore throws `ReferenceError: window is not defined`
**evaluating the identifier**, not by dereferencing a present `window` — that second mechanism is
jsdom's, and it is what §11.2 corrected. `call()` in `src/lib/ipc/commands.ts` catches it exactly as it
catches the component suites' rejecting mock, and `classifyFailure` never rethrows, so a
fire-and-forget drain is swallowed in **all three** files.

**4. The `invoked` spy is a partial trap, so no suite closes the binding route file-wide.** The two
component suites have a `vi.hoisted` `invoked` spy that *records* a call on its way to rejecting;
`workspace.test.ts` has none. But `expect(invoked).not.toHaveBeenCalled()` is asserted **once** in
`DetailPane.test.ts` and **five** times in `RestorePane.test.ts`, across six distinct `it` blocks, and
**never in either `afterEach`** — both of those read `drains`, the injected count, and assert it is
zero. Both suites state this limit in their own comments. So the other two trap the binding route in
**six named cases and nowhere else**, this one traps it nowhere, and **2d-5 owes a closure to all
three** rather than to the one without a spy.

**Line citations are deliberately absent from this subsection's four claims.** Naming a file and a
symbol survives an edit to that file; naming a line range does not, and §10.3 is this chain's record of
what happens when it does not. The ranges as they stood at round F, for a reader who wants them, are in
§11.1 — and they are the reason the comment no longer carries any.

## 12. Phase 2d-4b-F — the review of 2d-4b-E's fix (2026-08-31)

**Why it exists.** §11's fix changed one source file — the same comment block in
`src/lib/browser/workspace.test.ts` — so `CLAUDE.md` §7.1 commissioned a round scoped to it.
**2d-4b-E is superseded by 2d-4b-F.**

**The round.** A fresh `autoclaude-reviewer` on `model: "opus"`, 25-minute budget, report at
[`../reviews/phase-2d-4b-F.md`](../reviews/phase-2d-4b-F.md). Verdict **`ship-with-fixes`: 0 High,
0 Medium, 2 should-fix** — the first round of this chain to find **no defect in the reviewed
sentences**. It re-derived every clause of the hunk independently and reported all of them correct:
the `core.js:202` citation, the docblock's absence and `vite.config.ts`'s environment with no
`setupFiles` or `globalSetup`, `call()` catching and `classifyFailure` never rethrowing, the 1 + 5
`expect(invoked).not.toHaveBeenCalled()` assertions across six distinct `it` blocks, both `afterEach`
blocks reading `drains` rather than the spy, the two cited limits, the sixteen/thirteen/three/two
split, and a live `npx vitest run src/lib/browser/workspace.test.ts` at **186 passed**. One hunk,
counted before any sentence about it was read.

**Its two findings are of a different kind from the previous four rounds'**: one is a figure in the
record, and one is a proposal about **where the paragraph should live** rather than about what it says.
§12.1 and §12.2 are those two.

### 12.1 Why the comment was restructured rather than repaired a sixth time

**Round F answered §11.7 item 6's open question, which the brief put to it as a legitimate finding and
not as a way of forcing the tail to end.** Its reason is structural rather than aesthetic, and it is the
reason recorded here:

> Four of the paragraph's sentences were cross-file line-range citations, plus one into `node_modules`
> and eleven counts, and **nothing in this repository checks any of them**. `cargo clippy`, `npm run
> check`, `npm test` and the markup scan are all blind to a comment. An edit to either component suite
> silently falsified four line ranges in a third file, and only reading caught it.

**And the asymmetry that makes this worth doing:** identical staleness is a **record** defect when it
sits in `docs/` and a **source** defect when it sits in a comment. Under `CLAUDE.md` §7.1 the first
commissions nothing and the second commissions a whole review round. Six rounds of this chain went to
keeping cross-file citations true in the one place where being wrong is expensive. **Moving them is not
forcing the tail's end** — round F's own fix changed source, so §7.1 commissions round G exactly as
before. It removes the tail's *fuel*, which is a different thing and a slower one.

**What the comment kept** is what a reader at that line needs and what this file can check on its own:
that `BrowserState` does not drain through this surface at 2d-4b, that `drains` makes such a call
visible and the `afterEach` is the assertion, that the subject module holds a route around the injection
which **no suite closes file-wide**, and that the phase which starts draining owns closing it. The
comment run went from **43** lines to **24** (`src/lib/browser/workspace.test.ts:446-469`), and it now
cites no line number in any file.

### 12.2 Round F's other finding, and the fourth instance of §11.7 item 6's own shape

**F's first should-fix is a figure in §11.7 item 6 itself.** That item said *"the stub is 9"* and named
`489-497`. The stub is `src/lib/browser/workspace.test.ts:489-496`, **eight** lines: `:497` is the `};`
that closes the object literal `scriptedCommands()` returns, and `:498` is the function's own brace.

**The item that recorded a wrong estimate got its replacement wrong too.** Its parenthetical says the
first figure was *"estimated rather than counted, and it was wrong in both halves"*; the correction,
labelled *"Measured after the fix, not estimated"*, was measured for three of its four figures and
**off by one on the fourth** — the boundary between the stub and its enclosing literal was read as the
stub's. That is a **fourth** instance of the shape §11.7 item 6 exists to record, and the third to
appear *inside the writing that records it*. It is prose in a file on §7's closed list, so it
commissions nothing; it is corrected in §11.7 below.

### 12.3 The gates, re-run after the fix

| Gate | Exit | Figure | Anchor |
|---|---|---|---|
| `cargo test --workspace` | 0 | **1320** over 26 binaries, 0 failed | 1320 |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean | — |
| `cargo fmt --check` | 0 | clean | — |
| `cargo tree -p espansoconfig-core \| rg tauri` | — | no match | — |
| `npm run check` | 0 | **434** files, 0 errors, 0 warnings | 434 |
| `npm test` | 0 | **2175** over 57 files | 2175 |
| `npm run build` | 0 | **184** modules | 184 |
| server-only bundle oracle | — | **absent** | must be absent |
| client-only bundle oracle | — | **2** | must be present |

Nothing moved, and nothing could: the phase's whole source diff is **+15 / −34** in one test file, every
line of it a comment — `git diff --numstat`, re-derived rather than described, after a first draft of
this sentence said *"deleted 19 and wrote 8"* from the net. **Net −19 is the run shrinking from 43 lines
to 24; it is not the diff**, and stating one as the other is §12.2's shape a fifth time. Each command was
run unpiped and its exit status read from the tool rather than from a pipeline.

### 12.4 What happens next, by rule

The fix changed **one** source file — `src/lib/browser/workspace.test.ts` — so §7.1 commissions a round,
and the cap makes it corrective phase **2d-4b-G**. **This is true although the fix's purpose was to
remove the tail's fuel**, and it is worth saying plainly: §7.1 reads the diff, never the intent, so a
restructure that deletes nineteen unchecked cross-file citations is owed exactly the same round as a
sentence that added one. What it changes is the *next* round's odds, not this one's obligation.

**What round G is scoped to** is small and different in kind from its five predecessors: an 8-line
comment that cites no line number in any file, and a pointer to §11.8. The two things worth checking are
whether that pointer **finds what it claims** — §11.8 must carry all four claims the comment stopped
carrying — and whether the shortened comment now says anything **wider than its predicate**, which is the
shape this chain has produced three times.

### 12.5 Where this phase is thin

Marked per `CLAUDE.md` §7.3.

1. **The escaping route is still stated, not closed — *actionable*, not a correctness defect in
   source.** Unchanged inheritance from §9.5, §10.7 item 1 and §11.7 item 1. 2d-5 owes a closure to
   **three** files. The step closes without it.
2. **The pointer is now load-bearing and nothing checks it — *recorded only*, and it is what the
   restructure bought and cost.** The comment defers to `docs/decisions/2d-4b-notes.md` §11.8. If §11.8
   is renumbered, moved or trimmed, the comment silently points at nothing, and no gate in this
   repository would notice — the same blindness that motivated the move, relocated from four cross-file
   line ranges to one section reference. The trade is deliberate: **one reference that changes when
   somebody edits this file, instead of four that changed when somebody edited two others.**
3. **The 254 figure has never been broken down per file — *recorded only*.** Five rounds have cited it,
   none has re-derived it. Unchanged from §11.7 item 2.
4. **2d-4b-B's binding probe was measured on `workspace.test.ts` alone — *recorded only*.** Unchanged
   from §11.7 item 3, and now recorded in §11.8 claim 2 where the comment used to imply otherwise.
5. **Thirteen consecutive Opus review rounds with no second provider — *recorded only*.** §11.7 item 4
   carried twelve. This chain has never had a second provider on it; the last one was 2d-4b's own design
   consult (Codex, high effort).
6. **Round F is the first round of this chain to find no defect in the reviewed sentences, and that is
   one round, not a trend — *recorded only*.** Rounds 2-5 each found one the previous round had missed,
   and round 5 found two repeats of shapes already on file. What F changed is the paragraph's exposure,
   not the process that kept missing things in it.

## 13. Phase 2d-4b-G — the review of 2d-4b-F's fix (2026-08-31)

**Why it exists.** §12's fix changed one source file — `src/lib/browser/workspace.test.ts`, the same
comment block, no executable line — so `CLAUDE.md` §7.1 commissioned a round scoped to it.
**2d-4b-F is superseded by 2d-4b-G.**

**The round.** A fresh `autoclaude-reviewer` on `model: "opus"`, 15-minute budget, report at
[`../reviews/phase-2d-4b-G.md`](../reviews/phase-2d-4b-G.md). Verdict **`ship-with-fixes`: 0 blockers,
3 should-fix and 1 Low** — all four fixed. It re-derived the diff's extent before reading any sentence
about it (`git show 54ef596 -- src/` → **1** hunk, **0** non-comment changed lines; the orchestrator had
measured both independently before writing the brief) and re-derived §11.8's four claims against the
code, including a live `npx vitest run src/lib/browser/workspace.test.ts` at **186 passed**.

**The round that removed the tail's fuel left the pointer aimed at the wrong section, and that is the
whole story of round G.** §12.5 item 2 had predicted the class — *the pointer is load-bearing and
nothing checks it* — and named the failure it expected: §11.8 renumbered, moved or trimmed. What
actually happened is one step earlier and was not predicted: **the comment never cited §11.8 at all.**

### 13.1 M1 (should-fix, source) — a pointer to the section the restructure existed to avoid

`workspace.test.ts:468` cited `docs/decisions/2d-4b-notes.md` **§11**, while §11.8's own heading
(*"What `workspace.test.ts`'s drain comment defers to this section"*), §12.5 item 2 and `PROGRESS.md`
in two places all say the comment defers to **§11.8**. One of the two texts had to be wrong, and it was
the comment.

**The reference resolved, which is exactly why nothing caught it.** §11 exists; a reader following it
lands at line 786 and reaches §11.1 sixteen lines later — and §11.1 still carries
`DetailPane.test.ts:164-168`, `RestorePane.test.ts:439-443` and eight more line citations. Those are
**the citations the restructure removed from the comment because nothing keeps them true**, deliberately
archived in §11.1 by §11.8's own closing paragraph. So the shortened comment sent its reader 156 lines
short of the section written to be found, into the stale-citation text it was shortened to stop relying
on. A pointer that resolves to the wrong thing is worse than one that dangles: the second is visible.

The fix cites **§11.8** and says why — *"which exists to be what this pointer finds"* — so a future
renumbering breaks a sentence that names its own contract rather than one that merely gives a number.

### 13.2 M2 (should-fix, source) — a docblock promising completeness at a site that now forwards

`workspace.test.ts:316-317` said the escaping route is *"stated **in full** where the count is
incremented."* That was true at `081ea14` and false at `54ef596`: round F's whole purpose was to move
the detail out, and the increment site now says *"They are not repeated here on purpose."* The docblock
survived the change byte-identically — verified by diffing it against `081ea14`, where it is the same
two lines — because the fix was scoped to one hunk and this text is 140 lines above it.

**This is the restructure's own residue, and it is the shape rounds C and E each found once**: a fix
that changes one site and leaves a second site's sentence describing the first. The fix drops *in full*,
which also makes the docblock agree with the `afterEach` at `:503-505` — *"are stated where {@link
drains} is incremented"*, never *in full*. **That sentence was already correct and was deliberately not
touched**; the round said so in its finding, and the bound and the route genuinely are stated at the
increment site. Only completeness was the overclaim.

### 13.3 M3 (should-fix, record) — the pointer's target claiming more than it delivers

§11.8's preamble said *"Every figure is re-derived below rather than copied from the section that first
recorded it."* Its own claim 2 says the **254 has never been broken down per file**, §11.7 item 2 says
*none has re-derived it*, and claim 1's sixteen/thirteen/three rests on *"Confirmed at rounds C, D, E
and F"* — a citation, not a derivation performed here. Only the 186 was re-derived live.

**A record claiming a guarantee it does not give is this project's worst defect class**, and this
instance is the sharpest placement it could have had: the sentence sits in the section a source comment
now points at *for its derivations*, so the overclaim was load-bearing on the credibility the
restructure had just transferred there. The fix states how far each figure has actually been checked,
one clause each, and names the sentence it replaces so the correction is legible rather than silent.

### 13.4 L1 (Low, source) — an enumeration short of what it defers

The comment listed three of §11.8's four claims and omitted the **16/13/3/2 wrapper split** — the claim
that establishes the escaping route is uniform across all sixteen bindings and never special to the
drain member, which is the most direct support for the paragraph above it. It also attributed *"which
phase probed which route and what each cost"* to *that claim*, the file-wide-closure claim, when the
254/186 figures are evidence about the **two routes**. The fix names all four and says *that paragraph*.

### 13.5 The gates, re-run after the fix

Every gate, unpiped, exit status read from the tool and never from a pipeline, orphaned bin targets
killed first:

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1320 passed, 0 failed**, summed across **26** binaries |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |
| `npm run check` | **434** files, 0 errors, 0 warnings |
| `npm test` | **2175 passed**, 57 files |
| `npm run build` | **184** modules |
| server-only bundle oracle | **absent** |
| client-only bundle oracle | **present**, 2 matches |

**`1320 / 434 / 2175 / 184` — no figure has moved since 2d-4b**, which is the prediction rather than a
result worth celebrating: all six corrective phases have changed comment text in test files plus the
record, and no test case, no production module and no Rust line. The source diff is **+9 / −8**, every
line a comment.

### 13.6 What happens next, by rule

The fix changed **one** source file — `src/lib/browser/workspace.test.ts`, two comment blocks — so §7.1
commissions a round, and it is corrective phase **2d-4b-H**. **Two of the four findings were in source
and both fixes are prose inside a comment**, which changes nothing: §7.1 reads the diff and the unit is
the file, not the line.

**What round H is scoped to** is `git show <2d-4b-G's SHA> -- src/` — **two hunks expected**, the
`drains` docblock at `:313` and the deferral sentence at `:461`. Count them before reading any sentence
about how many there are. Three things are worth its budget:

1. **Does `:468` now find §11.8, and does §11.8 still hold all four claims?** Round G fixed the
   reference and narrowed the target's preamble in the same fix round, so the pointer and its target
   have both moved and neither has been read since by anyone but the fixer.
2. **Is the docblock at `:316` now true of the increment site, and is it still true of the
   `afterEach`?** Three sentences in this file describe the same fact and round G changed one of them.
   §13.2 is the record of what happens when one moves and the others do not.
3. **Does §11.8's new preamble overclaim in the other direction?** It now says the 254 *"has never been
   broken down per file"* in the preamble as well as in claim 2 — a repetition, and repetition is where
   two statements of one fact drift apart.

### 13.7 Where this phase is thin

Marked per `CLAUDE.md` §7.3. **The four items the round returned are carried verbatim in kind**, and
none of them is actionable-with-a-source-correctness-defect, so the step closes without them.

1. **"Closes that route" is undefined at the site — *recorded only*.** The comment says no suite
   *closes* the binding route file-wide, and what closing would consist of now lives only in the notes.
2. **"Six review rounds" at `:468` is not derived from the ranges it justifies — *recorded only*.** The
   cross-file line ranges entered at `e510819`, so three rounds carried them, not six; the sentence is
   read as the chain's length rather than as a count of rounds that carried those ranges.
   **The round marked this *recorded only* and the fix round deliberately did not touch it** — applying
   a change the round declined to file would put an unreviewed edit into the same file, which is how
   three of 2c-3a-1's ten findings were created. Round H may take it.
3. **Fourteen consecutive Opus review rounds with no second provider — *recorded only*.** §12.5 item 5
   carried thirteen. The last second provider on this chain was 2d-4b's own design consult (Codex, high
   effort).
4. **Nothing ties a comment to the text it describes, and M1 and M2 are both instances — *recorded
   only*.** This is §12.5 item 2 generalized by what round G actually found: the failure was not the
   target moving but the reference never having been right, and no gate in this repository can see
   either. Unbounded by construction; 2d-5 does not inherit it as work.
5. **The escaping route is still stated, not closed — *actionable*, not a correctness defect in
   source.** Unchanged inheritance from §9.5, §10.7 item 1, §11.7 item 1 and §12.5 item 1. 2d-5 owes a
   closure to **three** files. The step closes without it.
6. **The 254 figure has never been broken down per file — *recorded only*.** Unchanged from §12.5
   item 3, and now said in §11.8's preamble as well as its claim 2.
