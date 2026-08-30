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
