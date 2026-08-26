# Phase 2d-4 — the split into 2d-4a and 2d-4b

**Status:** the split decision, taken by the orchestrator before 2d-4a was executed.
`docs/reviews/phase-2d-design.md` Q7 item 4 remains the authority for *what* 2d-4 builds;
this note records only *how it is cut*, and it changes nothing the consult ruled.

## 1. Why 2d-4 is cut at all

Q7 item 4 names six deliverables in one step: the typed queue, the
`workspace://reconciliation-ready` event, the `drain_external_changes` command, the
TypeScript types and wrapper, the command registration and dispatch tests plus the
sequence/epoch/coalescing tests, and the EN/ES code namespaces and accessors for every
visible failure. Those cross both crates *and* the frontend, and 2d-4 is the first 2d step
to touch `src/` at all — the three carried frontend baselines (`431 / 2125 / 184`) stop
being carried here and must be re-measured.

A step that spans the Rust wire, the Tauri command surface, the TypeScript wire, the i18n
accessors and four re-measured gates is not one coherent unit of work for one worker. It is
cut on the seam the design itself draws in Q3: **the Rust command surface returns
`Result<T, CommandError>` and the TypeScript wrapper converts it into `CommandResult<T>`;
preserve that split.** The cut follows that sentence.

## 2. The two steps

- **2d-4a — the Rust half of the wire.** The typed queue behind the open workspace session,
  fed by replacing `crate::ledger::discarding_sink`; the `ReconciliationWake` event; the
  `drain_external_changes` command, registered and dispatched; the `ExternalObservation` /
  `ReconciliationBatch` wire types with their serialization; `wire_contract`,
  `dispatch_check` and `dictionary_contract` updates; and the EN/ES **JSON entries** for
  every new code. It may touch `src/lib/i18n/{en,es}.json` and nothing else under `src/`.
- **2d-4b — the TypeScript half of the wire.** The mirrored types, the `BrowserCommands`
  wrapper for the drain, the **injectable** event-listener wrapper, the `describe*` builders
  in `src/lib/i18n/codes.ts` and their reactive `t*` wrappers in `index.ts`, the frontend
  tests, and the re-measured `npm run check` / `npm test` / `npm run build` baselines.

## 3. Why the EN/ES JSON is in 4a and the accessors are in 4b

`src-tauri/src/dictionary_contract.rs` derives `code.<enum>.<variant>` from the Rust enums
and checks **both dictionaries in both directions**, so a new Rust code enum makes
`cargo test` red until both JSON files carry its keys. The JSON is therefore forced into the
step that introduces the enum. The accessors are not: `src/lib/i18n/dictionaries.test.ts`
checks key-set equality, value shape, the untranslated-value heuristic and placeholder
agreement — **no suite asserts that a key has an accessor** — so 4a can land the keys with
the frontend green and 4b adds the typed builders that make a missing key a compile error in
`codes.ts`.

That asymmetry is a fact about the present suites, not a licence: a key with no accessor is
a key nothing can render, and 4b is what discharges it. It is written down here so that
4a's green frontend gate is not mistaken for evidence that the codes are reachable.

## 4. What neither step does

Both inherit Q7 item 4's prohibition verbatim: **this step must not draw anything and must
not decide whether a surface is open.** Deciding whether a write surface is open is 2d-5's
open-surface registry, and Q8 names an incomplete registry as the phase's sharpest failure
mode; drawing is 2d-6. Neither 4a nor 4b may anticipate either.

## 5. Evidence

Q7's closing paragraph binds 2d to model, mounted and window evidence *by risk*. 2d-4 draws
nothing, so it owes **no** mounted and **no** window evidence — Q7 assigns those to 2d-6 and
2d-7 respectively. What 2d-4 owes is the machine-checkable gate set, and 4b additionally owes
the three re-measured frontend numbers, since it is the first 2d step whose
`git diff --name-only 08a3366 -- src/` is non-empty beyond the two JSON files.
