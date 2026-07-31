# Phase 1c-2b-1 review — the typed judgements

Independent review of the Phase 1c-2b-1 diff (hazards, diagnostics and the load-failure conflation
fix) against the project's standing rules. The reviewer read the staged diff, the sub-phase's
decision record `docs/decisions/1c-2b-1-notes.md`, `CLAUDE.md` and `src/lib/`.

The disposition of each finding is recorded in `PROGRESS.md`, section
"Phase 1c-2b-1 review disposition".

---

## High

- `src/lib/i18n/en.json:132`, `src/lib/i18n/es.json:132` — `AdditionalDocumentNotProjected` now
  falsely says the additional document "is shown."

  Input: a multi-document YAML stream. The projection records later documents only by span, while the
  raw YAML viewer and `document_text` command are explicitly deferred. The middle pane therefore says
  document 1 "is shown but not interpreted," although none of its content appears anywhere. This
  recreates the exact "shown as written" over-claim the project rules prohibit.

  Fix: say only that espanso reads the first document and the later document was not interpreted,
  e.g. "Document {n} was not interpreted because espanso reads only the first document."

## Medium

- `src/lib/browser/findings.ts:142`, `src/lib/browser/findings.test.ts:192` — diagnostic identity
  ignores fields that distinguish separate findings.

  Input: two different match nodes both produce `MatchHasNoTrigger`, or twenty different keys produce
  `KeyNotAccountedFor`. Because identity is only `JSON.stringify(code)`, all occurrences collapse to
  one sentence. The result says "This snippet…" or "one key…" while silently hiding that multiple
  distinct snippets/keys are affected. `span`, `node`, and `path` are precisely the distinguishing
  fields excluded from the comparison.

  Fix: retain each diagnostic using an identity over the complete diagnostic record. If repeated prose
  is undesirable, aggregate explicitly and show an occurrence count through `plural.ts`, or add enough
  location/context to distinguish lines.

  The "renders each owed sentence once" test is not a valid oracle for the broader "a diagnostic is
  never dropped" claim: its hand-written `OWED` list deliberately omits the second input diagnostic.
  It can detect accidental divergence from the chosen dedup policy, but cannot disagree with whether
  that policy improperly drops a real finding.

- `src/lib/browser/workspace.svelte.ts:455` — findings remain completely unreachable for config
  profiles.

  Input: `config/default.yml` contains invalid YAML or any other diagnostic. `holdsMatches()` rejects
  the profile before `getDocument()`, selecting its sidebar row yields `scopedDocument === null`, and
  no diagnostic or parse status appears anywhere. Thus the middle-pane placement solves unreachable
  parse failures only for match files and packages, not all files.

  Fix: project profiles as well, while continuing to exclude them from snippet counts and
  `scopedMatches`; alternatively add a separate lazy profile projection when its row is selected.

- `src/lib/i18n/en.json:131`, `src/lib/i18n/en.json:132` — zero-based wire indices are exposed as
  human document numbers. Spanish has the same issue at lines 131–132.

  Input: an empty first YAML document produces `document_index: 0` and displays "Document 0"; the
  second document in a stream carries index `1` and is called "document 1."

  Fix: convert the operand to a one-based display number in the typed diagnostic accessor/model,
  leaving the wire code unchanged, and test indices `0` and `1`.

## Low

- `src/lib/i18n/en.json:36`, `src/lib/browser/detail.ts:657` — the unnamed refusal invents a
  file-level cause that the fields do not establish.

  Input: `safely_editable: false`, `blocking_hazard: null`. The only supported fact is that the
  verdict refuses editing; the UI says an unspecified "part of the file blocks it." A future
  non-hazard policy refusal — or merely contradictory wire data — would make that explanation false.

  Fix: use neutral wording such as "This app will not edit this snippet; no reason was provided." The
  named refusal arm is supported by the available fields.

- `src/lib/browser/findings.ts:129`, `src/lib/browser/findings.test.ts:97` — the union does not
  deduplicate its first input.

  Input: `view.hazards = ['MergeKey', 'MergeKey']`. Both survive, and `SnippetList.svelte` receives
  duplicate keyed rows. Current Rust promises a distinct list, so this is defensive rather than a
  current core-generated failure, but the implementation and test claim "each distinct kind once"
  while testing only an already-distinct summary.

  Fix: seed a `Set<HazardKind>` from `view.hazards`, append diagnostic kinds to it, and convert it
  back to an array while preserving first-seen order. Add a duplicated-summary fixture.

- `src/lib/browser/findings.test.ts:236`, `src/lib/browser/detail.test.ts:683` — the
  accessor/reachability test names are stronger than their bodies and are explicitly unfalsifiable as
  screen claims.

  Input: render `{hazard}` directly, but leave `tHazard(...)` in dead script code or a comment. The
  tests still find the substring and pass while raw Rust identifiers reach the screen. Similarly, the
  editability-arm scan can pass when the predicates occur only in dead/commented text.

  Fix: render components in a test, or use a Svelte-aware AST assertion tied to the actual
  interpolation and conditional nodes. Until then, rename these tests to claim only source
  occurrence, not that code "reaches the screen as words."

## What the review found sound

The `DocumentId` load-failure keying is sound for the current load lifecycle, all production read
sites are updated, and refused match-bearing documents are excluded from `pending`. The named
editability arm also follows the verdict/reason split correctly.

## On the decision record

The decision record does not state five holes: §11 lists thirteen. It honestly discloses the profile,
All-scope, component-rendering, attribution, and parse-status gaps, but it does not recognize the
false "is shown" sentence, zero-based document numbering, or loss of distinct same-code diagnostics
as defects.

---

# Second pass — verification of the fix round

A narrow second pass, asked only whether the seven findings are closed and whether the fixes
introduced anything new. The full first-round disposition is above.

## Are the seven closed?

| Finding | Verdict | What settles it |
|---|---|---|
| High 1 | ✅ closed | "is shown" gone from `en.json:134` / `es.json:134`. The *second* false claim the fix round found on its own — `notEditable` saying the snippet rather than the file contains the hazard — is now supported: `disqualifying_hazard` ranges over node-less, same-node, ancestor **and** descendant hazards of that document (`crates/espansoconfig-core/src/syntax/trivia.rs:601`) |
| Medium 1 | ✅ closed | Sentence identity and complete-record occurrence identity separated at `findings.ts:145` / `findings.ts:159`; `occurrences` and `repeated` both derived from the same set size at `findings.ts:198` |
| Medium 2 | ⚠️ **closed but with a new problem** | Every document is projected at `workspace.svelte.ts:479`, but match-shaped profiles can now leak into `scopedMatches` — see below |
| Medium 3 | ✅ closed | `document_index` → one-based `document` at `codes.ts:325`; indices 0 and 1 covered at `codes.test.ts:470` |
| Low 1 | ✅ closed | `en.json:42` claims only that no reason was given |
| Low 2 | ✅ closed | Union seeded from `new Set(view.hazards)` at `findings.ts:179`, duplicated-summary fixture at `findings.test.ts:133` |
| Low 3 | ✅ closed | Tests claim only source occurrence at `findings.test.ts:319` and `detail.test.ts:698` |

## New findings introduced by the fix round

### Medium — profile matches can leak into both the "All" scope and the selected profile

A `ConfigProfile` whose content contains match-file keys is **deliberately** projected as
`DocumentShape::MatchFile`, so `view.matches` is populated
(`crates/espansoconfig-core/src/model/document.rs:517`). `scopedMatches()` then flat-maps every
projected view — or returns the selected view's matches — **without consulting `holdsMatches`**
(`src/lib/browser/workspace.svelte.ts:274`). Its sidebar count remains excluded
(`workspace.svelte.ts:371`), so the snippet list shows rows that the total does not count.

This is the Medium 2 fix's own regression: before it, such a profile was never projected at all.

Fix: apply `holdsMatches(view)` in **both** branches of `scopedMatches()`.

### Low — a future differently-named index operand silently stays zero-based

The conversion is keyed only by the operand *spelling* `document_index`; every unlisted number passes
through unchanged (`src/lib/i18n/codes.ts:324`). A future zero-based `match_index` with a matching
dictionary placeholder would render `0` successfully — no placeholder, no test failure.

Fix: make the display conversion exhaustive per `DiagnosticCode` variant, or encode display operands
in a typed variant-to-operand mapping that is checked when the union grows.

## What the second pass found sound

No aggregation inconsistency: distinct non-hazard records are inserted into their sentence group, and
`repeated` is exactly `occurrences > 1`. The new plural pair selects correctly at 0, 1 and 2 because
it delegates to `count === 1` (`src/lib/i18n/plural.ts:36`). A stale `{document_index}` placeholder
genuinely does remain visible through `src/lib/i18n/dictionaries.ts:84`, so the "visible placeholder
rather than a wrong number" claim holds.

## On the decision record, second pass

§10.1 now explicitly records all three previously-missed defects (`1c-2b-1-notes.md:660`), and §11
distinguishes the profile defect from a mere coverage hole (`1c-2b-1-notes.md:764`).

But the record **overstates profile isolation**: it says profiles contribute "no snippet-list row"
(`1c-2b-1-notes.md:71`) and "stay out of `scopedMatches`" (`1c-2b-1-notes.md:840`), and the
match-shaped-profile scenario above contradicts both. Fix the code, then those statements become true
and can stand.
