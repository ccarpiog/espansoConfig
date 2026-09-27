# Phase 4-19-1 — Preview model and coordination

**Status:** implementation record for the first piece of step 4-19 of [`4-split-notes.md`](4-split-notes.md)
§2 (the dated 2026-09-27 addendum under `### 4-19` records the cut into 4-19-1 and 4-19-2). It builds
the browser model and coordination of the illustrative preview and closes 4-17's open item 1 (a draft
could not be previewed) with a read-only candidate route. **No component draws anything this piece adds**
and no user-facing string was added; the components, their EN/ES keys and the mounted acceptance are
4-19-2's. No window reading was performed or claimed.

---

## 1. What changed and why

### 1.1 Core: `authoring::preview_candidate` (`crates/espansoconfig-core/src/authoring.rs`)

- **`preview_candidate(context, source, found, edits, samples) -> Result<CandidatePreview, SaveError>`**:
  the batch is patched by `persist::preflight_candidate` — the one body a save's preflight and
  `analyze_candidate` run, so a preview cannot patch a batch differently from the save that would
  follow — projected with `project_source`, and the match at `found`'s path previewed by
  `preview::preview_match`, exactly as a saved match is. The gate's findings and verdict are computed
  by that body and dropped: a preview consents to nothing, so it passes `Acknowledgement::none()` and
  answers no verdict. No lock, read, write, backup or clock.
- **`CandidatePreview { candidate, preview: Option<MatchPreview>, analysis: Option<AnalysisSummary> }`**
  (`Serialize` only). `analysis` is the candidate's own, so a caller has the positions its samples
  must address (§3.2) from the same answer as the preview, with no second request to skew against.
- `candidate_entry`, a private helper, is now the one lookup of "the match at `found`'s path in a
  candidate" shared by `analyze_candidate` and `preview_candidate` (behaviour of the former unchanged).
- `lib.rs`: a 4-19-1 line in the phase list. The core stays tauri-free (§5).

### 1.2 Tauri: one more reader (`src-tauri/src/commands.rs`, `main.rs`)

`preview_match_candidate(id, operation: CandidateOperation, base_revision, samples)` —
`WorkspaceSession::preview_match_candidate` → `preview_one_candidate`: `document_at` (a stale base
revision is `identityStaleRevision`, D2v) → `match_by_id` → `CandidateOperation::plan` (the writer's own
planner, `draftRefused` on refusal) → `preview_candidate` (`candidateRefused` on refusal). It runs under
`with_workspace`, never `with_open`; it names no lock, write primitive or save tail; it takes **no
acknowledgement and no force flag**. The twenty-seventh workspace command, twenty-eight in all; nine
writers, unchanged. Registered in `main.rs`; the module headers of `commands.rs`, `main.rs` and
`dispatch_check.rs` restate the counts.

### 1.3 Wire mirror and contracts

- `src/lib/ipc/types.ts`: `CandidatePreview`. `src/lib/ipc/commands.ts`: `previewMatchCandidate`
  (JSDoc'd), `COMMAND_NAMES` 26 → 27; `previewMatch`'s JSDoc no longer says a date is previewed by "a
  later step" (4-18 did it).
- `wire_contract.rs`: registry 26 → 27 workspace / 27 → 28 total with `preview_match_candidate`
  asserted a reader; the Phase 4-8 lock/tail scan now also covers `preview_match_candidate` and
  `preview_one_candidate` (no `SECOND_LOCK_IDENTIFIERS`, no `run_one_save`/`with_open`/`BackupSession`);
  the async-attribute count 26 → 27; the preview shape test now also compares `CandidatePreview` with a
  real candidate preview.
- `dispatch_check.rs`: remote-origin sweep 27 → 28, and
  `the_candidate_preview_reader_is_reachable_and_writes_nothing` (camel-case `baseRevision` and the
  samples deserialize; the draft's text is previewed; the file is byte-identical and alone in its
  directory; a wrong base revision is `identityStaleRevision`).
- `commands/preview_check.rs`: `a_candidate_preview_shows_the_draft_and_writes_nothing` (answers while
  another holder has the path lock; the draft's text, not the saved one; the authored shell/script not
  run; the file byte-identical, nothing beside it; the session's revision unchanged) and
  `a_candidate_preview_refuses_a_stale_base_and_an_unplannable_draft`.
- `dictionary_contract.rs`: **unchanged** — `CandidatePreview` is a struct, not a code, and no enum was
  added; the candidate route's refusals are the existing `draftRefused`, `candidateRefused` and identity
  codes.

### 1.4 Browser model: `src/lib/browser/preview.ts` (new)

Plain TypeScript (no runes), following `reconciliationCoordinator.ts`: values and pure functions, plus one
coordinator that notifies an `onChange` listener.

- **Clock and zone.** `SampleClock { now, zoneName, offsetMinutesAt }` is injected everywhere;
  `SYSTEM_SAMPLE_CLOCK` (`Date.now()`, `Intl.DateTimeFormat().resolvedOptions().timeZone`,
  `getTimezoneOffset`) is the one place the real clock and zone are read. `readSampleInstant(clock)`
  answers the whole second (floored) and `Named { name }`, or `Fixed { offset_seconds }` when no zone
  name is read; a reading the wire cannot carry (non-finite time, offset not strictly inside a day) is
  `null` — Rust then answers `DateInstantMissing` — never a guess. `zoneOf` gives a tagged value for
  drawing.
- **Sample inputs.** `PreviewInputs { selections, formValues, captures, pinnedInstant }`, frozen;
  `withSelection` (refuses a negative or non-integer position as `null`), `withoutSelection`,
  `withFormValue`, `withCapture`, `withPinnedInstant` keep one sample per address, the latest
  (`samePreviewSource` compares addresses). `sampleSlotsOf(analysis)` lists the slots a match's example
  can take: a selection per local `choice`/`random`, a field per distinct layout placeholder of a local
  form and of the shorthand `form:`, a capture per named group.
- **Request.** `PreviewTarget` = `saved { id }` | `draft { id, baseRevision, draft: MatchDraft }`.
  `previewRequestOf(target, inputs, clock)` reads the clock once (not at all when an instant is pinned)
  and copies a draft as it crosses the wire (JSON round trip), deep-frozen.
- **State.** `idle` | `pending { request, last }` (the last answer kept for drawing) | `shown { preview,
  limitations, candidate, analysis }` | `noMatchInCandidate { candidate }` | `failed { failure }`; every
  non-idle state carries its `request`, so `instantOf(state)` is the instant and zone that request showed
  dates at — what 4-19-2 draws beside the result. `limitationsOf(preview)` lists the distinct
  `PreviewUnresolved` reasons (nested `Choice` segments included), the unresolved count, the distinct
  `PreviewPlaceholderName`s and the `limit` — typed codes for `describePreviewUnresolved`,
  `describePreviewPlaceholder` and `describePreviewLimit` in `src/lib/i18n/codes.ts`. The segments stay
  the truth; an `Unresolved` segment keeps its text as written.
- **Coordination.** `createPreviewCoordinator(commands: PreviewCommands, clock, onChange)`:
  `request(target, inputs)`, `clear()`, `current()`. `PreviewCommands` has exactly two members, the two
  readers (`REAL_PREVIEW_COMMANDS` = `previewMatch`, `previewMatchCandidate`); it is a separate injectable
  surface rather than two more `BrowserCommands` members, so the model can be handed nothing that
  writes, and so the five component-test literals implementing `BrowserCommands` did not change. A
  rejection from an injected command is classified (`classifyFailure`) into `failed`, so a request always
  settles.

### 1.5 Lint

`scripts/lint/no-execution.test.ts` now asserts that `src/lib/browser/preview.ts` and
`src/lib/ipc/commands.ts` are among the frontend sources it scans, and that neither holds a forbidden
spelling.

## 2. How each clause is met

Model: `src/lib/browser/preview.test.ts` (22). IPC: one case in `commands.test.ts`. Core:
`crates/espansoconfig-core/tests/candidate_preview.rs` (3). Command level: `preview_check.rs` (2),
`dispatch_check.rs` (1), `wire_contract.rs` (widened, no new test).

| Clause | Evidence |
|---|---|
| The frontend reads the instant and zone, through an injectable source; no test reads the real clock | `readSampleInstant` cases (name, fixed fallback, pre-epoch floor, `null` for uncarriable readings); a pinned instant is sent and the clock not read; a fresh reading per request, each exposed by `instantOf`; `SYSTEM_SAMPLE_CLOCK` measured with `Date.now` and `Intl.DateTimeFormat` replaced. **Every case** runs with `Date.now` and `Intl.DateTimeFormat` spied on and an `afterEach` asserting neither was called |
| Instant and zone exposed for drawing | `instantOf` on pending and answered states; `zoneOf` |
| Superseded responses cannot overwrite current ones | out-of-order resolution (later first, then earlier: the earlier is dropped and its promise answers the current state; `onChange` saw no stale install); an earlier rejection dropped; an in-order pair replaced by the later; `clear()` drops what is in flight |
| No draft change, no file, no writer | a deep-frozen draft passes through untouched (any write would throw) and is equal before and after; the request holds a frozen copy, and a caller editing its own object later does not change it; a `Proxy` over the commands sees only `previewMatch` and `previewMatchCandidate` touched; the import list of `preview.ts` is exactly `../ipc/{types,errors,commands}` with only the two readers imported as values, and no writer or draft-mutator name appears in it. Rust: §1.3's byte-identity, lock and scan tests |
| Candidate route, read-only | core: a draft is previewed as its candidate (equal to `preview_match` over the preflight's own text), sample positions are the candidate's, a read-only document is refused as the save preflight refuses it; command and dispatcher tests of §1.3; the model sends a draft target as `{ Draft: { draft } }` with its base revision, and answers `preview: null` as `noMatchInCandidate` and a refusal as `failed` |
| Unresolved values identifiable, codes typed | `limitationsOf` over every segment kind with a nested unresolved choice; the shown state carries the untouched segments, `<script>` text included |
| No execution or clipboard-read control | the module's exports hold no run/exec/spawn/shell/script/clipboard/paste name; its source no clipboard read, `child_process` or shell plugin; `no-execution.test.ts` scans it |

## 3. Decisions and deviations

1. **The candidate route is a second reader, `preview_match_candidate`, over the planned candidate** —
   the route 4-17 §5 item 1 sketched, built through the preflight body a save runs rather than a copy of
   it. It takes a `CandidateOperation` (so a variable reorder can be previewed too), not buffers: the
   frontend already derives a `MatchDraft` with `matchDraftOf` in `matchEditor.ts`, and Rust re-plans it
   with the writer's planner, so a preview and a save cannot plan one draft differently.
2. **Sample positions belong to the candidate for a draft target.** The candidate answer carries its own
   `analysis` for exactly this reason; `sampleSlotsOf` takes whichever analysis the caller hands it.
   Nothing in Rust or TypeScript checks that samples were built for the target's revision (§5 item 2).
3. **No acknowledgement on the candidate route.** A preview commits nothing, so the verdict the preflight
   computes is dropped rather than answered; a draft the gate would refuse still previews. A read-only
   document (a package) is refused, because the shared preflight refuses it — a draft of one cannot be
   opened anyway.
4. **A sample value is used exactly as given, `\r` included** (`CLAUDE.md` §6 asks every new textual
   input to decide): it never reaches a file, so the drafting refusal does not apply. A `<textarea>` in
   4-19-2 will still have normalized line breaks before the model sees them.
5. **The preview's commands are their own injectable surface** (`PreviewCommands`), as
   `BackupCommands` is, rather than members of `BrowserCommands`, and failures are **not** routed through
   `BrowserState`'s `report`: a preview failure is the preview's own state. 4-19-2 decides whether a
   stale identity also re-reads the file.
6. **A clock reading the wire cannot carry is `null`**, never replaced by UTC or zero.

## 4. What is and is not guaranteed

- **Guaranteed and pinned:** the model reaches only the two readers (a `Proxy` test and an import scan —
  the scan is a text check, so a writer reached through another module this file does not import is not
  seen; the file imports none); the caller's draft is never written (a frozen-draft test); supersession
  (out-of-order tests); the Rust reader names no lock, write primitive or save tail (a fixed-vocabulary
  lexical scan, plus behavioural byte-identity and lock tests).
- **Not forced by TypeScript:** that a component draws segment text as text (escaping is 4-19-2's
  mounted acceptance); that a caller builds samples for the right revision; that `SYSTEM_SAMPLE_CLOCK` is
  the only clock a caller passes in production.
- **Not guaranteed:** that the browser's IANA zone name is in the core's tzdb 2025b (an unknown one is
  answered `ZoneUnsupported` by Rust); anything about how espanso itself expands a snippet (R16, R30).

## 5. Open items for 4-19-2 and later

1. **4-19-2 wires it**: create a coordinator per preview surface over `REAL_PREVIEW_COMMANDS` and
   `SYSTEM_SAMPLE_CLOCK`, derive a draft target with `matchDraftOf` and the editor's base revision, mirror
   the state into `$state` through `onChange`, and draw `instantOf`/`zoneOf`, `limitations` and the
   segments (escaped). New strings owed there: the `noMatchInCandidate` state, the instant/zone caption,
   any "illustration, not espanso" sentence, sample-input labels. `preview.ts` joins the bundle only
   then (one Vite module).
2. **Sample positions versus target revision** stay unchecked (§3.2); a stale-position sample is silently
   ignored by Rust (4-17 §5 item 4).
3. **Global `choice`/`random` variables** have no slot: `AnalysisSummary` carries local declarations only.
   Their entry counts (for a selection control's range) are not in the analysis either; 4-19-2 reads
   them from the projection or the variable editor.
4. **Debouncing** of requests while typing is not in the model; supersession makes it safe, not cheap.
5. The candidate route runs the save gate's findings pass and drops it — wasted work on each preview,
   bounded by the file size; a findings-free patch entry point in `persist` would avoid it but would be a
   second patch path, which this piece did not want.
6. `cargo doc -p espansoconfig-core` was not built (not a gate; 4-18 §5 records a pre-existing failure).

## 6. Failing-first evidence, by mutation

The tests were written against the new code, so failing-first is shown by mutation (git was not used):
nine mutations, each applied, run and restored byte for byte (sha-256 checked) by
`/private/tmp/4-19-1/mutate.py`; outputs `/private/tmp/4-19-1/mutation-M*.txt`, summary
`mutation-summary.txt`. Every one built and failed tests:

| # | Mutation | Failed |
|---|---|---|
| M1 | supersession check removed from `request` | the three supersession cases |
| M2 | the draft sent by reference, not copied | the no-draft-change case |
| M3 | the model writes the draft it sends | 4 cases (a frozen draft throws) |
| M4 | `Date.now()` instead of the injected clock | every case that reads a clock through the model (14) |
| M5 | the real zone instead of the injected one | the same 14 |
| M6 | a draft target previewed as the saved text | 5 cases — 4 of them by the 5 s timeout, the candidate reader's answer never being awaited |
| M7 | the Rust candidate reader names `save_document` | `the_variable_reorder_writer_reaches_the_one_tail_and_no_lock` |
| M8 | the Rust candidate reader writes the file | `a_candidate_preview_shows_the_draft_and_writes_nothing`, `the_candidate_preview_reader_is_reachable_and_writes_nothing` |
| M9 | the core previews the saved text, not the candidate | `a_draft_is_previewed_as_its_candidate_would_be`, `sample_positions_belong_to_the_candidate` |

M4 and M5 were re-run after the test's `afterEach` was made to restore its spies in a `finally` (the
first run cascaded into unrelated cases); the files hold the second run.

## 7. Verification

All exit 0, run serially, outputs under `/private/tmp/4-19-1/`: `cargo test --workspace --
--test-threads=1` (`cargo-test.txt`, **1789 passed**, 0 failed, result lines summed); `cargo clippy
--workspace --all-targets -- -D warnings` (`clippy.txt`); `cargo fmt --check` (`fmt-check.txt`); `npm run
check` (`npm-check-final.txt`: **510 files**, 0 errors, 0 warnings); `npm test` (`npm-test-final.txt`:
**4496 passed**); `npm run build` (`npm-build.txt`: **227 modules**); bundle oracle — server-only pattern
absent (`oracle-server.txt` empty), client-only present (`oracle-client.txt`: 2); `cargo tree -p
espansoconfig-core` (`cargo-tree.txt`, 94 lines) holds no `tauri`.

Rung **`1789 / 510 / 4496 / 227`** (was `1783 / 508 / 4470 / 227`):

- **+6 Rust tests**: 3 in `tests/candidate_preview.rs`, 2 in `preview_check.rs`, 1 in `dispatch_check.rs`
  (the wire-contract changes widened existing tests).
- **+2 `svelte-check` files**: `preview.ts` and `preview.test.ts`.
- **+26 vitest tests**: 22 in `preview.test.ts`, 1 in `commands.test.ts`, 1 in `no-execution.test.ts`, and
  2 from `ipc-detail.test.ts`'s per-file sweep over the two new sources.
- **+0 Vite modules**: nothing in the bundle imports `preview.ts` yet (§5 item 1); the wrapper and the type
  were added to existing modules.

## 8. Review

`autoclaude-review.sh` exited 0 — **Codex**, no fallback ([`docs/reviews/4-19-1.md`](../reviews/4-19-1.md),
brief [`4-19-1.brief.md`](../reviews/4-19-1.brief.md)): **`ship-with-fixes`, 0 BLOCKERS + 1 SHOULD-FIX, fixed by
the orchestrator.** The generation was taken before `previewRequestOf` read the caller's inputs and called
the injected clock, so a `clear()` re-entered from a getter or the clock was undone by the pending state
installed afterwards, and the preview stayed pending for good. `request()` in `src/lib/browser/preview.ts` now
compares the generation again after the request is built and, when superseded, installs nothing and sends
nothing. Two regression tests in `preview.test.ts` (a clock that clears, a `Proxy` input whose getter clears)
fail on the unfixed code — both time out pending, `/private/tmp/4-19-1/review-failfirst.txt` — and pass on
the fixed code. After the fix: `npm run check` 510 files 0/0, `npm test` **4498**, `npm run build` 227 modules,
bundle oracle correct, all exit 0; no Rust source changed. Rung **`1789 / 510 / 4498 / 227`**.
