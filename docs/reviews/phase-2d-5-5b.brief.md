# Review brief — Phase 2d-5-5b

**Repository:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core +
Svelte 5 / TypeScript frontend). Review the **uncommitted** working tree.

**Write your report to:** `docs/reviews/phase-2d-5-5b.md` (overwrite it).

---

## The phase and its goal

Phase **2d-5-5b** is the second half of step 5 of the 2d-5 design consult: **save arbitration —
same-revision coalescing, different-revision supersession, and the per-document in-flight-write
barrier.** Its binding rulings are `docs/decisions/2d-5-split-notes.md` §3 entries **25, 26 and 27**,
and the spec is **Q7** of `docs/reviews/phase-2d-5-design.md`. Restated so nothing is reviewed from
memory:

- **25 — at the same document and the same `disk_revision`, the save conflict wins.** It carries the
  stronger fact (a locked write attempt was refused) plus operation-specific evidence. The watcher
  observation is **still accepted for sequence and watermark accounting** and must not replace the
  model, its messages or its source identity. Revision equality proves identical bytes, never origin
  or chronology.
- **26 — a strictly higher observation sequence with a different revision supersedes the conflict's
  disk side.** Draft preserved; disk text, projection, revision, findings and origin replaced; the
  save conflict's `found` never rendered as the current disk revision; any pending reload
  confirmation withdrawn; old reapply evidence invalidated. **Hashes carry no order** — only the
  observation sequence defines "later".
- **27 — an in-flight write is a per-document arbitration barrier.** Observations for that document
  are retained and coalesced, not applied, until the write promise settles; a `mayHaveWritten`
  outcome forbids automatic reload, because a later watcher snapshot can establish what is on disk
  but never who wrote it. **No save command may ever be initiated by watcher arbitration.**

**Components: none** — drawing the new origin is phase 2d-6's, so surfaces deliberately have no
production caller for the new doors yet.

## The changed files

```
 M src/lib/browser/conflictSource.ts        +384
 M src/lib/browser/workspace.svelte.ts      +461
 M src/lib/browser/reapply.ts                +57
 M src/lib/browser/saveOutcome.ts            +54
 M src/lib/i18n/en.json, es.json, index.ts   +34
 M src/lib/browser/{conflictSource,saveOutcome,reapply,workspace}.test.ts  +734
?? docs/decisions/2d-5-5b-notes.md           (the phase record)
```

No `.svelte` file changed and no Rust source changed. **1698 insertions, 37 deletions.**

**Four paths in the tree are NOT this phase's and must not be reviewed or reported on:**
`src-tauri/src/probe.rs`, `src/probe.ts`, and the hook lines in `src-tauri/src/main.rs` and
`src/main.ts`. They are a temporary window-reading instrument, never committed. Their pin is
`5 insertions(+), 1 deletion(-)` and it still holds.

## What the phase claims to have built

Read `docs/decisions/2d-5-5b-notes.md` — it is the phase's own account and is **itself under
review**. Its §2 says how each ruling is discharged, §6 is its *where it is thin* list, §7 its
verification. In outline:

- `conflictSource.ts` gained the arbitration as pure values: `standingConflictOf`,
  `arbitrateObservation`, `releaseBarrier`, `newestObservationOf`, and the
  `ObservationVerdict` / `ArbitrationOutcome = Exclude<…, 'retained'>` pair.
- `workspace.svelte.ts` gained the state those values are asked about: a standing-conflict map, a
  per-file in-flight count with a one-shot lease opened by all six writing wrappers, one retained
  observation per file, a preserved `mayHaveWritten` uncertainty, `observeExternalChange` as the
  door that applies all three rulings, and `supersedeConflict`.
- **`adoptDiskVersion` gained an ordered step 4** refusing an origin that no longer stands, because
  a supersession moves no projection generation and the existing check was therefore blind to it.
- `reapplyEvidenceFor` gained a `standing` operand and a `superseded` arm, with one new EN/ES code
  and a typed accessor.

## Where to be adversarial

1. **`adoptDiskVersion` is the only confirmed-install door in this application, and this phase
   changed it.** A new ordered refusal step there is the single highest-risk edit in the phase. Does
   the new step 4 refuse anything it should install, or install anything it should refuse? The
   record admits one behaviour change beyond the watcher case — *a second save conflict for one file
   now makes the first refuse adoption* — with no inherited test covering it. Is that the whole
   consequence, or is there another caller shape it silently changes?
2. **Ruling 25's "still accepted for sequence and watermark accounting".** A coalesced observation
   that wins nothing must still advance the cursor. Verify the code actually does that rather than
   dropping the observation, and that it does **not** replace the model, the messages or the source
   identity while doing it.
3. **Ruling 26 against 2d-5-5a's first-registration-wins rule.** `rememberTheConflict` returns
   without writing when the origin is already in `conflictOrigins` (pinned by
   `workspace.test.ts:6617`). Supersession must therefore register the **newer** observation as its
   own origin, not re-register the old one. Confirm that is what happens and that the old origin
   cannot be resurrected.
4. **Ruling 27's barrier is a counter.** A per-file in-flight count with a one-shot lease opened by
   six wrappers is exactly the shape that leaks: an early return, a throw, or a settle path that
   skips the release leaves a document permanently barriered and its reconciliation silently dead.
   Trace every wrapper's failure path.
5. **Check-and-spend.** This project's standing rule: a check and a spend separated by **any**
   property read are not atomic, because a property read runs arbitrary code through a getter or a
   `Proxy` trap, and `readonly` does not freeze at runtime. `Exclude<…, 'retained'>` is a type-level
   narrowing and forces nothing at runtime. The 2d-5-5a review found exactly this class in
   `reapplyEvidenceFor`; check whether the new `standing` operand reopened it.
6. **Claims that outrun the code.** This project's worst defect class is a comment or a record
   sentence asserting a guarantee the code does not give. `found` is claimed *gone by type*; the
   barrier is claimed to coalesce; `mayHaveWritten` is claimed to forbid automatic reload. Each is a
   claim about a mechanism — check the mechanism, and check the Spanish dictionary entry says what
   the English one says.
7. **The tests are evidence, not proof.** The consult asks for both arrival orders, a later
   different revision, stale evidence, **all three** adoption answers (`installed`, `alreadyThere`,
   `refused`), a committed save, a definite failure and a `mayHaveWritten` one. Are all of them
   really there, and does each test fail against the pre-fix shape, or does it pass vacuously?

## Verification already run, by the orchestrator, each gate on its own

Nothing was run concurrently with `cargo`. You do not need to re-run these; report it if you find
a figure that is wrong.

| Gate | Result |
|---|---|
| `cargo test --workspace -- --test-threads=1` | exit 0, **1320** summed over **26** `test result` lines; no line lacking `0 failed`, none lacking `0 filtered out` |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |
| `npm run check` | **443 files, 0 errors, 0 warnings** |
| `npm test` | **2461 passed, 61 files** (was 2433 — **+28**) |
| `npm run build` | **189 modules**; server-only bundle markers **absent**, client-only **present (2)** |

New rung: **`1320 / 443 / 2461 / 189`**, up from `1320 / 443 / 2433 / 189` at 2d-5-5a.

## Project rules that bind this change

- `CLAUDE.md` at the repo root is authoritative. Especially §2 (**every user-facing string through
  i18n, English and Spanish both, rendered through a typed accessor in `src/lib/i18n/codes.ts` and
  never by a hand-built key**), §5 (JSDoc on every TypeScript function; closing-bracket comments
  over 10 lines; English throughout) and §6's invariants.
- **Corpus privacy: the repository is public and the owner's real config must never be quoted.** File
  names, counts and line numbers are fine; content is not.
- Decisions live in `src/lib/browser/` as values; components draw them.
- `conflictChoicesFor` is the only producer of a conflict choice list;
  `DiskAdoptionOutcome = installed | alreadyThere | refused` and callers stop only on `refused`.
- The selection machinery is two counters — per-document `projectionGenerations` and the global
  `selectGeneration` — and **nothing in TypeScript enforces that every write to `selected` bumps
  one.** This phase's supersession path is exactly where that would be missed.
- A committed write is never afterwards reported as an error.

## Output

The verdict line the workflow reads is one of `ship-with-fixes`, `do-not-ship` or `ready`. Give
each finding a severity, the **file and line** it lives at, and what makes it wrong — an argument a
reader can re-derive without you, not a reference to your own reading. Separate blockers from
SHOULD-FIX explicitly, and say which findings are in **source** and which are in the **record**.

**Time budget: 25 minutes.**
