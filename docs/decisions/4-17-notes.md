# Phase 4-17 — Pure illustrative preview core

**Status:** implementation record for step 4-17 of [`4-split-notes.md`](4-split-notes.md) §2, under
ruling 26 of §3 and the consult's Q6 ([`phase-4-design.md`](../reviews/phase-4-design.md), the type
table at Q6). Core-first: **no Svelte component calls anything this step adds** (a typed IPC wrapper and
accessors only; the controls are 4-19's). Date preview is 4-18's. The step was **not cut**. No window
reading was performed or claimed.

---

## 1. What changed and why

### 1.1 Core: `crates/espansoconfig-core/src/preview.rs` (new module)

- **`preview_match(view, entry, samples)`** and **`preview_match_with_limits(…, limits)`**: a pure
  function of one projected match and one request. No I/O, no clock, no process, no clipboard, no
  random-number generator, no environment read — so identical requests give identical output.
- **Inbound, `deny_unknown_fields`:** `PreviewSamples { selections, form_values, captures }` —
  `SelectionSample { variable, index }` (which `choice`/`random` entry; a random "example" is the index
  named, never a draw), `FormValueSample { form, field, value }`, `CaptureSample { name, value }`.
  Addresses are **`PreviewSource`**: `Local { index }`, `Global { index }`, `ShorthandForm {}`,
  `Capture { name }` — positions in the revision the request's `MatchId` carries, never a span (R28).
  The first sample for an address wins; a sample addressing nothing is ignored.
- **Outbound:** `MatchPreview { bodies, limit }`; `PreviewBody { field: ContentKind, segments }` for
  `replace`, `markdown`, `html` (in `rendered_content`'s order) or, when the shorthand `form:` is the
  content, `Form`. **`PreviewSegment`**: `Literal { text }` (the field's own text),
  `Sample { text, source }` (a value produced for the example), `Choice { source, label, segments }`
  (a selected `{label, id}` record's whole value — everything its id produced, substituted segments
  included — enclosed with its displayed label; since §8),
  `Placeholder { source, placeholder }` and `Unresolved { text, source, reason }` (the token, `[[field]]`
  or field **as written**, so an unresolved value stays identifiable).
- **`PreviewPlaceholder`** (`Clipboard {}`, `Shell { command }`, `Script { args }`,
  `Match { trigger }`): the authored text only; nothing is run, read or rendered.
- **`PreviewUnresolved`** (17): `UnknownName`, `AmbiguousName`, `Cycle`, `DepthLimit`, `WorkLimit`,
  `MissingSample`, `SampleOutOfRange`, `FormIsNotAScalar`, `FieldNotInLayout`, `SubnameUnsupported`,
  `InjectionUncertain`, `ValueUnreadable`, `AmbiguousScalar`, `DateNotPreviewed`, `KindNotPreviewed`,
  `UnverifiedLayoutReference`, `UnsupportedLayoutSyntax`. **`PreviewLimit`** (3): `OutputBytes`,
  `Segments`, `Work`.
- **Shared, not copied:** references are found by `analysis::scan_references` (the one scanner over
  `REFERENCE_PATTERN`); names are resolved by the analysis's own `Names::resolve`, now built by one
  function each for the match scope and the global scope (`match_scope_names`, `global_scope_names` in
  `analysis/dependency.rs`, which `analyze_match_into` and `analyze_document` now call too); injection
  states, layouts and cycles are read from `analyze_match` and the new `analyze_global_scope` (factored
  out of `analyze_document` as `global_scope`, behaviour unchanged).
- **Bounded topological evaluation.** The evaluation graph is exactly what a kind renders — references
  in an `echo` text, a `choice` entry's id, a `random` entry — when injection is certainly enabled. Cycle
  members are the analysis's (explicit and inferred); a Kahn pass computes every other variable's height
  without recursion, and anything it cannot order is a cycle too. A height above `depth` is
  `DepthLimit`, which is also what bounds the evaluator's own recursion. Values are memoised.
- **Limits** (`PreviewLimits::DEFAULT`): output 64 KiB and 4096 segments for the whole answer (and any
  one value), depth 16, work 1 MiB (bytes plus one per segment across every value built), and at most
  256 script arguments (`MAX_PREVIEW_ARGUMENTS`). Every element of a nested list — a script argument, a
  segment enclosed in a `Choice` — is charged one besides its bytes, and a placeholder's authored payload
  is measured before it is built (§8). A limit stops the output where it is, cut on a character
  boundary, and names itself in `limit`.
- **D2u:** a plain scalar flagged `ambiguous_yaml_1_1` is `AmbiguousScalar`, never coerced; an
  `inject_vars` spelling that is neither recognised true nor false is `InjectionUncertain` when the text
  holds a reference; a certainly-false one keeps the reference as the variable's own text.
- **Hostile text is data:** every text is returned unchanged; the module and the TypeScript types say
  escaping is the renderer's (4-19).
- `lib.rs`: `pub mod preview;` and a 4-17 line in the phase list.

### 1.2 Tauri: one reader

`preview_match(id, samples)` — `WorkspaceSession::preview_match`: `with_workspace` → `get_document` →
`match_by_id` (a stale identity is `identityStaleRevision`, propagated by `?`, never unwrapped) →
`preview::preview_match`. No lock beyond the session's, no write, no `run_one_save`, no
`BackupSession`. The twenty-sixth workspace command; registered in `main.rs`. Module headers of
`commands.rs`, `main.rs` and `dispatch_check.rs` restate the counts (twenty-six workspace commands,
twenty-seven in all, nine writers).

### 1.3 Wire mirror, contracts, i18n

- `src/lib/ipc/types.ts`: `PreviewSource`, `SelectionSample`, `FormValueSample`, `CaptureSample`,
  `PreviewSamples`, `PreviewPlaceholder(Name)`, `PreviewUnresolved`, `PreviewLimit`, `PreviewSegment`,
  `PreviewBody`, `MatchPreview`. `src/lib/ipc/commands.ts`: `previewMatch` (JSDoc'd), `COMMAND_NAMES`
  25 → 26.
- `wire_contract.rs`: registry 25 → 26 workspace / 26 → 27 total with `preview_match` asserted a reader;
  the Phase 4-8 lock/tail scan now covers `preview_match`; the async-attribute scan 25 → 26; new
  **`the_preview_shapes_declare_exactly_what_rust_writes_and_reads`** (six structs from a real preview,
  every variant of three tagged unions, two string unions and the name union, the samples read back).
- `dictionary_contract.rs`: three new namespaces (`previewUnresolved` 17, `previewPlaceholder` 4,
  `previewLimit` 3); `PreviewSegment` and `PreviewSource` on `NOT_A_CODE` with reasons.
- `dispatch_check.rs`: the remote-origin sweep 26 → 27 and
  `the_preview_reader_is_reachable_and_refuses_a_stale_identity`.
- **i18n: 24 keys per language** under the three namespaces. `codes.ts`: `previewUnresolvedKey`/
  `describePreviewUnresolved`, `previewPlaceholderKey`/`describePreviewPlaceholder`, `previewLimitKey`/
  `describePreviewLimit`, registered in `CODE_NAMESPACE_KEY_BUILDERS` (samples added in `codes.test.ts`);
  reactive `tPreviewUnresolved`, `tPreviewPlaceholder`, `tPreviewLimit` in `index.ts`. No sentence
  interpolates an operand; the placeholder sentences say espanso *may* run a command and this
  application does not, and that the clipboard is never read.

## 2. How each acceptance clause is met

Core: `crates/espansoconfig-core/tests/preview.rs` (14, and 4 more from §8). Command level:
`src-tauri/src/commands/preview_check.rs` (2), `dispatch_check.rs` (1), `wire_contract.rs` (1). i18n:
`src/lib/i18n/previewCodes.test.ts` (3); IPC: one case in `commands.test.ts`.

| Clause | Evidence |
|---|---|
| Identical requests give identical output | `identical_requests_give_identical_output` (structural and byte-identical JSON; a changed sample changes the answer, so the equality is not vacuous); command twin in `a_preview_answers_the_cached_parse_and_refuses_a_stale_identity` |
| Cycles and missing samples terminate with codes | `cycles_terminate_with_codes` (inferred pair, self-loop, explicit `depends_on` pair; a consumer of a member evaluates around it), `missing_and_out_of_range_samples_terminate_with_codes` (choice, random, form field, capture; out of range; first sample wins) |
| Reference-token cases agree with 4-7 | `reference_tokens_agree_with_the_analysis`: literals equal the text outside `scan_references`' tokens (declined spellings `{{ not-a-name }}`, `{{}}` stay literal), one segment per token, and per declaration as many body references as the analysis's `usage.body` |
| Output and depth limits hold (at the boundary) | `the_depth_limit_holds_at_the_boundary` (16 resolves, 17 is `DepthLimit`), `the_output_limit_holds_at_the_boundary` (64 KiB exact / +1 / a two-byte character straddling / a capped variable value), `the_segment_limit_holds_at_the_boundary` (4096 / 4097), `the_work_limit_holds_at_the_boundary` (7 / 6); since §8 `script_arguments_are_charged_per_element_at_the_boundary` (12 / 11), `the_argument_count_cap_holds_at_the_boundary` (256 / 257), `the_reviewers_empty_argument_script_stays_inside_the_budget` |
| Command and clipboard examples cause no I/O | `placeholders_stand_for_what_is_never_run_or_read` and both `preview_check` tests (a `shell` `touch` and a `script` `/usr/bin/touch` on a marker path; the marker never appears; the file is byte-identical; nothing appears beside it); `a_preview_takes_no_path_lock_and_writes_nothing` (returns while another holder has the path lock); `scripts/lint/no-execution.test.ts` still green; the wire-contract scan (no lock or write primitive, no save tail) |
| Hostile HTML comes back as data | `hostile_html_comes_back_as_data` (`<script>`, `<img onerror>`, `<b onclick>`, `&amp;` and a hostile form sample, all unchanged); `dispatch_check`'s `<b>` literal over IPC |
| Read-only command, stale identity refused | `a_preview_answers_the_cached_parse_and_refuses_a_stale_identity` (after a committed reorder), `the_preview_reader_is_reachable_and_refuses_a_stale_identity` (after an external rewrite and reload, through the dispatcher; an unknown sample field is refused while arguments are read) |
| Other type-table rows | `every_supported_kind_previews_its_example` (echo with a global chain, choice label versus id, random, verbose form, capture), `a_choice_label_encloses_what_its_id_substitutes` (§8); `forms_answer_samples_and_say_what_is_missing`; `uncertain_inputs_are_not_coerced` (injection true/false/uncertain, ambiguous scalar, date, unknown type, duplicate name) |

## 3. Decisions and deviations

1. **The command previews the cached revision only** (`MatchId` + samples), per 4-8's snapshot
   convention. Previewing an unsaved draft is not offered (§5 item 1).
2. **Accessor names** are `describePreviewUnresolved`/`describePreviewPlaceholder`/
   `describePreviewLimit`, one per namespace, rather than the consult's example family name
   `describePreviewOutcome` ("such as" in the consult; ruling 31 lists it as an example family). One
   namespace per Rust enum is what `dictionary_contract.rs` derives.
3. **Date is a code, not a placeholder**: `DateNotPreviewed` in `PreviewUnresolved`, which 4-18 replaces
   with a value; no `chrono` was added.
4. **Ambiguous plain scalars are refused wherever the preview would print them** — a body, an `echo`,
   a choice or random entry — as `AmbiguousScalar`. Conservative (`y`, `yes`, `on`, `0o17`… do not
   preview) and deliberate: the dispatcher test first used a `y` entry and was answered `AmbiguousScalar`.
5. **A form sample always wins**; with none, `FieldNotInLayout` is claimed only when the layout is
   fully inside the supported subset, otherwise `MissingSample`.
6. **A `{label, id}` record's value is one enclosing `Choice` segment** holding everything its id
   produced (§8 replaced the first version, which put the label on the record's own literal pieces only
   and lost it on substituted segments).
7. **Evaluation edges are a subset of the analysis's edges** (only the texts a kind renders); cycle
   membership is the analysis's, and the Kahn pass treats anything unorderable as a cycle, so a
   disagreement degrades to `Cycle`, never to a recursion.
8. **Inserted values are not re-scanned** for references: a sample, or text a variable produced, is
   data. `$|$` in a body stays literal text.

## 4. What is and is not guaranteed

- **Guaranteed by construction and pinned by tests:** no I/O, clock, process or clipboard read in the
  module (text scan in `no-execution.test.ts`, behavioural marker tests); the reader names no lock, write
  primitive or save tail (the wire-contract scan — a fixed vocabulary, so a primitive reached under
  another name is not seen); limits at their boundaries.
- **Not guaranteed:** anything about how espanso expands a snippet — injection order, whether espanso
  re-renders a choice id, how a shorthand layout's `{{…}}` is rewritten, what a YAML-1.1 scalar becomes
  (R16, R30 stay open). The preview is an illustration for one example.
- **TypeScript does not force** a caller to escape segment text; the types' doc comments say it must,
  and 4-19's mounted tests own that acceptance.

## 5. Open items for later steps

1. **Draft preview (4-19).** Popover samples before insertion need a preview of an unsaved candidate:
   likely `CandidateOperation` → `preflight_candidate` → reparse → `preview_match` on the candidate's
   match, answered beside the candidate revision. Not built here.
2. **A verbose form's own layout filled from samples** is not returned (only `{{form.field}}` values and
   the shorthand layout body). 4-19 may want it for form samples.
3. **Scalar `values`** (a choice written as one multiline string, ruling 18's kept representation)
   answers `ValueUnreadable`; how espanso splits it is not established here.
4. **A sample addressing nothing is silently ignored**; a UI with stale positions cannot tell. The
   `MatchId` revision check covers a reparse, not a caller's own bookkeeping.
5. **24 new keys per language** (the consult planned 10–18 for 4-17) join the Phase 4 translation
   inventory (4-24). No sentence has been read on a window.
6. `rustdoc` intra-doc links in `preview.rs` were not built (not a gate).

## 6. Failing-first evidence, by mutation

The tests were written against the new module, so failing-first is shown by mutation (git was not
used): twelve mutations of the new checks, each applied, run and restored byte for byte by
`/private/tmp/4-17/mutate.py`; outputs `/private/tmp/4-17/mutation-*.txt`, summary
`mutation-summary.txt`. Every one built and failed at least one test:

| # | Mutation | Failed |
|---|---|---|
| M1 | selections ignored (always index 0) | 3 |
| M2 | analysis cycle members not marked | `cycles_terminate_with_codes` (the explicit `depends_on` pair; the Kahn fallback still catches inferred ones) |
| M3 | depth limit off by one | depth boundary |
| M4 | output byte budget off by one | output boundary |
| M5 | segment budget off by one | segment boundary |
| M6 | uncertain injection rendered | `uncertain_inputs_are_not_coerced` |
| M7 | ambiguous scalar coerced | `uncertain_inputs_are_not_coerced` |
| M8 | cut not on a character boundary | output boundary (panic) |
| M9 | body HTML escaped | `hostile_html_comes_back_as_data` |
| M10 | a second reference grammar (whitespace tokens dropped) | `reference_tokens_agree_with_the_analysis` |
| M11 | a form sample loses to its layout | 2 |
| M12 | the command ignores the identity's revision | `preview_check` and `dispatch_check` stale-identity tests |

## 7. Verification

All exit 0, run serially, outputs under `/private/tmp/4-17/`: `cargo build --workspace`
(`cargo-build.txt`), `cargo test --workspace -- --test-threads=1` (`cargo-test.txt`), `cargo clippy
--workspace --all-targets -- -D warnings` (`clippy.txt`), `cargo fmt --check` (`fmt-check.txt`), `npm run
check` (`npm-check.txt`: 508 files, 0 errors, 0 warnings), `npm test` (`npm-test.txt`), `npm run build`
(`npm-build.txt`); `cargo tree -p espansoconfig-core | rg tauri` finds nothing (`cargo-tree.txt`, 85
lines); bundle oracle — server-only pattern absent, client-only present.

Rung before the review fixes **`1756 / 508 / 4470 / 227`** (was `1738 / 507 / 4465 / 227`): +18 Rust tests (14 core, 2
`preview_check`, 1 wire contract, 1 dispatcher); +1 `svelte-check` file (`previewCodes.test.ts`); +5
vitest tests (3 in `previewCodes.test.ts`, 1 in `commands.test.ts`, 1 from the parameterised namespace
suite widened by the three new namespaces, not traced further); Vite modules unchanged — no new module
enters the bundle (types, a wrapper and accessors were added to existing modules).

## 8. Review fixes (`docs/reviews/4-17.md`, ship-with-fixes)

Only the two findings, in `preview.rs`, plus their tests, the wire mirrors the second one's shape change
forces, and this record.

1. **Blocker — script arguments bypassed the budget** (`preview.rs`, `placeholder_bytes`). Arguments
   were charged by length only, so empty ones were free, and a placeholder was cloned before the buffer
   checked it. Now: every argument is charged one besides its bytes; `decoded_list` measures the list
   before copying anything and refuses more than `MAX_PREVIEW_ARGUMENTS` (256) items or a charge above
   the output budget as `ValueUnreadable`; `decoded_scalar` (a `shell` `cmd`, a `match` `trigger`)
   likewise refuses a text longer than the budget before copying it; and `Buffer::extend` now calls
   `push_copy`, which asks `admits` first and clones a segment only once it fits (a cut segment is built
   from a prefix, never from a clone of the whole).
2. **Should-fix — a choice record's label was lost on substituted segments** (`preview.rs`, the
   choice arm of `compute`). `Sample` no longer carries `label`; a selected `{label, id}` record's whole
   value is enclosed in the new `PreviewSegment::Choice { source, label, segments }`, charged as its
   label plus one per enclosed segment besides each one's bytes, kept whole or not at all. A plain
   string entry stays plain `Sample`s. Consequent mirror edits: `types.ts` (`Sample` loses `label`, new
   `Choice` arm), `wire_contract.rs` (the shape test's fixture gains an echo so a top-level `Sample` is
   still sampled; 4 → 5 segment variants), `dictionary_contract.rs` (the `PreviewSegment` reason lists
   `Choice`), `dispatch_check.rs` and `preview_check.rs` (no `label` on a `Sample`).

**Failing-first:** the three regression tests were run against the unfixed module first
(`/private/tmp/4-17/review-failfirst.txt`, pre-fix copy `preview.rs.before-review`): all three failed —
the substituted `X` had `label: null`; an 11-byte budget still built the three-argument placeholder;
the reviewer's script (`/bin/echo` and 9 999 empty arguments, referenced 4 096 times) answered
40 996 864 charged units against 65 536. The tests read the JSON wire form so they compile against both
versions. A fourth test pins the argument cap at 256 / 257.

**Open items noticed, not fixed:** (a) an over-budget or over-count argument list answers
`ValueUnreadable`, whose sentence says the text cannot be read "as the file writes it"; a dedicated
limit code would be clearer (4-19 may want one). (b) A `Choice` too large for the remaining budget is
dropped whole with `OutputBytes`, never cut; a long record id near the end of a long body disappears
rather than truncating. (c) The test helper `charged` approximates the Rust charge from JSON and skips
`reason` code names; it is a bound check, not the same function.

**Verification:** all exit 0 unless noted, outputs `/private/tmp/4-17/review-*.txt`: `cargo build
--workspace`, `cargo test --workspace -- --test-threads=1` (first run failed one test — the wire shape
test's fixture no longer produced a top-level `Sample`; fixed as above and re-run green), `cargo clippy
--workspace --all-targets -- -D warnings`, `cargo fmt --check`, `cargo tree -p espansoconfig-core | rg
tauri` (nothing), `npm run check` (508 files, 0 errors, 0 warnings), `npm test`, `npm run build`, bundle
oracle (server-only absent, client-only present).

Rung **`1760 / 508 / 4470 / 227`** (+4 core tests; no TypeScript test or module changed count).
