# Phase 4-7 — Placeholder, reference and dependency analysis

**Status:** implementation record for step 4-7 of [`4-split-notes.md`](4-split-notes.md) §2, under
rulings 9, 11–16 of §3 and the consult's Q3, Q4 and Q8 ([`phase-4-design.md`](../reviews/phase-4-design.md)).
Core-first: **no production UI caller** reads the analysis (4-8 puts candidate analysis on the wire).
The two new findings are live in the save transaction for every caller that saves a variable
operation. The step was **not cut**. No window reading was performed or claimed.

---

## 1. What changed and why

### 1.1 New core module `crates/espansoconfig-core/src/analysis/`

- **`placeholder.rs`** — the named supported placeholder subset: `[[identifier]]`, identifier
  `[A-Za-z_][A-Za-z0-9_]*`, nothing else inside the brackets. `PlaceholderLayout::parse` answers
  segments (`Text` / `Placeholder` / `Malformed`) whose spans tile the input exactly, so every character
  is kept; `groups()` gives repeated-name groups in first-occurrence order; `is_fully_supported()` is
  false whenever a malformed region exists. Malformed reasons: `Empty` (`[[]]`), `InvalidIdentifier`
  (whitespace, dot, hyphen, leading digit, non-ASCII, line break, third bracket), `Unterminated` (a `[[`
  with no `]]` before the next `[[` — only the two opener bytes, and the scan resumes). The module and
  the type say it is **not** espanso-compatible (ruling 16).
- **`reference.rs`** — `scan_references`, the one `{{reference}}` scanner. It uses
  `validate::reference_pattern()`, i.e. `REFERENCE_PATTERN` exactly (the constant stays in
  `validate/mod.rs`). **Rule 5's `report_unresolved` now calls it**, so the validator and the analysis
  cannot disagree about what a reference is.
- **`dependency.rs`** — `analyze_document` / `analyze_match` answer a `ScopeAnalysis` per variable
  sequence (`global_vars`, and each match's `vars`): declarations in authored order with `Injection`
  and `Usage` (`body`, `parameters`, `depends_on`, `unverified_layout`), `DependencyEdge`s tagged
  `Explicit` (`depends_on`) or `Inferred` (a reference in a parameter **value** of a consumer whose
  injection is certainly enabled — `validate::injection_is_certainly_enabled`, reused), `cycles`
  (iterative Tarjan, no recursion), `missing_dependencies` (explicit names only, closed scope only),
  `order_advisories` (consumer authored before a dependency, ruling 11), `form_advisories`
  (`{{f.field}}` whose field is not in the supported layout), and `incomplete` reasons. A match
  analysis also carries its captures, its shorthand layout analysis and the shorthand layout's
  **unverified** `{{…}}` references.
- **`findings.rs`** — `batch_operates_on_variables` and `variable_operation_findings` (§1.3).

### 1.2 Validator (`validate/mod.rs`)

- Two new `FindingCode` variants, both `SuspiciousButPermitted`:
  `VariableDependencyCycle { revision, name, size }` and `DependencyHasNoDeclaration { revision, name }`.
  `ALL_NAMES` 13 → 15; `name()`, `class()`, `Display` and the module/enum docs updated.
- `closed_name_scope` now asks the analysis's `scope_openers` (imports, unreadable `global_vars`,
  unreadable `vars`, unknown captures), so the two can never disagree about a closed scope.
- `regex_capture_names` factored out of `check_regex` and shared with the analysis.
- `reference_pattern`, `rendered_content`, `params_are_readable` and `injection_is_certainly_enabled`
  are `pub(crate)` so the analysis reuses them rather than re-spelling them. **`rendered_content` is
  unchanged: shorthand `form:` stays out of it.**
- The dead `unknown_key` helper moved into `dependency.rs` with `scope_openers`.

### 1.3 Save transaction (`persist/save.rs`)

`findings_of` takes the original `source` too. After the existing operation-specific findings, when
`batch_operates_on_variables(edits)`, it projects the original and appends
`variable_operation_findings(original, candidate, edits, revision)`. Both `save_document` and
`preflight_edits` go through it, so a preflight and a save judge one candidate identically. A batch
with no variable operation never pays for the second projection.

**What a variable operation is:** an edit whose address lies under `matches[i].vars` (scalar, list
item, inserted or removed variable, reorder, `depends_on` item), a field insertion or removal whose key
is the match's `vars`, or a `ReplaceItemText` of the whole match item. Everything else — label,
trigger, content, options, creation, whole-match duplicate, whole-document raw save — is not.
`addresses_of` matches `DocumentEdit` exhaustively, so a new edit kind is a compile error there.

**Introduces or worsens:** for each operated match the analysis runs on the original and on the
candidate (the candidate position comes from the engine's own `item_positions`; a removed match or an
underivable position says nothing):

- a candidate cycle whose member names are not all members of one original cycle is reported, once,
  on its first member in authored order (`name`, `size`); a cycle left alone, shrunk or broken is not;
- a missing explicit name whose occurrence count grew is reported on the last `gained` occurrences
  (path `…vars[i].depends_on[k]`); under an open scope nothing is reported, before or after.

Every finding carries the candidate's `ContentRevision`, so an acknowledgement is bound to one text.

### 1.4 Wire, contracts, i18n

- `src/lib/ipc/types.ts`: both variants in `FindingCodeName` and `FindingCode`, with operand docs.
- `src/lib/i18n/{en,es}.json`: `code.findingCode.variableDependencyCycle` and
  `code.findingCode.dependencyHasNoDeclaration` — **two keys per language**. Rendered through the
  existing `describeFindingCode`; wording claims a cycle "as espansoConfig reads" the graph and a name
  "nothing this app can see declares", never an espanso failure.
- `src-tauri/src/wire_contract.rs`: two samples; pinned counts 227 → 229 (variants and placeholder
  checks) and checked struct variants 144 → 146, with the messages extended.
- `src-tauri/src/dictionary_contract.rs`: `findingCode` 13 → 15.
- `tests/validate_semantics.rs`: the reachability exemptions 3 → 5 (both codes are the save
  transaction's; `tests/dependency_analysis.rs` proves them reachable).

## 2. How each acceptance clause is met (`tests/dependency_analysis.rs` unless noted)

| Clause | Test |
|---|---|
| repeated and malformed placeholders | `repeated_and_malformed_placeholders_in_a_projected_layout`; unit tests in `placeholder.rs` (round-trip tiling, groups, every malformed reason, reopened region, identifier spelling) |
| `{{f.field}}` sub-references | `form_sub_references_are_checked_against_the_supported_layout`, `the_synthesised_form_answers_sub_references_against_the_shorthand_layout`, `the_synthetic_forms_have_no_advisory` |
| explicit and inferred cycles | `explicit_and_inferred_cycles_are_distinguishable` (explicit pair, inferred pair, self-loop); unit tests for the SCC walk incl. a 50 000-member ring |
| regex captures | `regex_captures_take_part_in_resolution` (resolution without a vertex; uncompilable regex opens the scope) |
| duplicate names | `duplicate_names_make_the_answer_incomplete` |
| `inject_vars` spellings | `inject_vars_spellings_decide_inferred_edges` (absent, true/Yes/ON, false/no/Off, `maybe`) |
| imports keep the scope open | `imports_keep_the_scope_open` (analysis and save: no missing-name finding; a local cycle still reported) |
| an unrelated save acquires no new acknowledgement | `an_unrelated_save_acquires_no_new_acknowledgement` (label save over an imperfect graph proceeds; unrelated variable edit and cycle-breaking edit acquire nothing) |
| introduces / worsens | `a_variable_operation_that_introduces_a_condition_is_told`, `a_variable_operation_that_worsens_a_condition_is_told` |
| consent for one candidate cannot be spent on changed text | `consent_for_one_candidate_cannot_be_spent_on_changed_text` (equal span/node/path, different candidate; `save_document` on a temp file refuses, leaves the file untouched, then commits with its own consent) |
| shorthand `form:` stays out of `rendered_content` | `shorthand_form_references_are_unverified_and_not_rendered_content` (`validate` silent on `{{missing}}` in a shorthand layout) |

**Failing-first evidence, by mutation** (git was not available to the worker, and the tests were
written against the new module): eight mutations of the new checks, each applied, run, and reverted by
`/private/tmp/4-7/mutate.py`; outputs `/private/tmp/4-7/mutation-*.txt`. Each fails at least one test:
M1 no before/after comparison (2 fail), M2 no variable-operation gate (2), M3 constant revision (2), M4
missing names under an open scope (2), M5 injection ignored (1), M6 shorthand `form` in
`rendered_content` (2), M7 placeholder parser trims spaces (1), M8 duplicates resolve to the first (1).

## 3. Decisions and deviations

1. **`ReplaceItemText` of a whole match counts as a variable operation.** It rewrites the item's
   `vars` as much as a typed edit does; because only introduced or worsened conditions are reported, a
   raw edit that leaves the graph alone acquires nothing. The split notes say "a variable operation";
   this is this record's reading of it.
2. **Worsening is judged by member names.** Renaming a member of an existing cycle is therefore
   reported as a new cycle. Identity by position across revisions was rejected (ruling 22 forbids
   variable identity by index across revisions for reapply, and positions shift on insertion).
3. **Resolution order is locals, then regex captures, then globals, then the synthesised `form1`.**
   This is this crate's analysis rule, not a reading of espanso's resolver. A `depends_on` naming a
   capture or a global is treated as resolved (no claim), never as missing.
4. **Duplicated names resolve to nothing**: no edge is invented and a `DuplicateDeclaration` reason is
   recorded. (A duplicate is already `DuplicateVariableName`, an editor-model error, at save.)
5. **Undecoded names are compared by their text**, as rule 5 does, and a `NameUnreadable` reason is
   recorded.
6. **Sub-references are checked only from verified sites** (body and injected parameters). The
   shorthand layout's own `{{…}}` are counted as `unverified_layout` usage and make no claim.
7. **Additions beyond the step's deliverable list**, both small and both named by rulings:
   `order_advisories` (ruling 11) and `definitions_without_occurrence` (ruling 15's advisory).
8. **Global scope:** `global_vars` is analysed (declarations, graph, cycles, usage counted across the
   document) but produces **no finding** — ruling 9 keeps it display-only and no writer addresses it.
9. The analysis types derive no `Serialize`; the wire shape is 4-8's.

## 4. Gate and rung

All exit 0, outputs under `/private/tmp/4-7/`: `cargo test --workspace -- --test-threads=1`
(`cargo-test.txt`), `cargo clippy --workspace --all-targets -- -D warnings` (`clippy.txt`),
`cargo fmt --check` (`fmt-check.txt`), `npm run check` (`npm-check.txt`), `npm test`
(`npm-test.txt`), `npm run build` (`npm-build.txt`); `cargo tree -p espansoconfig-core | rg tauri`
finds nothing (`cargo-tree.txt`); the bundle oracle: server-only pattern absent, client-only present.

Rung **`1697 / 487 / 4086 / 214`** (was `1670 / 487 / 4086 / 214`): +27 Rust tests (19 in
`tests/dependency_analysis.rs`, 5 in `placeholder.rs`, 1 in `reference.rs`, 2 in `dependency.rs`). No
new `.ts` module or component, so the Vite module count is unchanged.

## 5. Open items noticed, not fixed

1. **Rule 5 does not know the synthesised `form1`.** In a match whose content is a shorthand `form:`,
   a `{{form1.x}}` inside a variable's injected parameter is reported by `validate` as
   `ReferenceHasNoDeclaration`, while the analysis resolves it to the shorthand layout. Whether espanso's
   loader exposes `form1` to other variables is not established here; the two rules disagree and one
   should be settled with evidence.
2. **The dependency findings cost a second projection of the original inside the save lock** when a
   batch is a variable operation (the candidate is already projected twice). Not measured.
3. **Order advisories are computed but nothing presents them**; ruling 11's "advisory naming both
   declarations" is a UI obligation (4-11).
4. **Whether espanso resolves `depends_on` against regex captures or globals** is not established;
   the analysis stays silent in both cases (decision 3).
5. **The placeholder subset has no owner-supplied or upstream grammar** (the consult's Q4 gap stays
   open); `LayoutUnsupported` reasons will be common for any layout using other syntax.

## 6. Review fixes

The adversarial review ([`docs/reviews/4-7.md`](../reviews/4-7.md)) returned `ship-with-fixes` with
four SHOULD-FIX findings. Each fix has a regression in `tests/dependency_analysis.rs`, and all four
regressions failed on the pre-fix tree (`/private/tmp/4-7/fix/failing-first.txt`) and pass after
(`/private/tmp/4-7/fix/after-fix.txt`).

1. **Unreadable `inject_vars` was read as enabled** (`analysis/dependency.rs`, `injection_of`). A
   written but unprojected value (`inject_vars: *flag`, `inject_vars: {}`) is projected as `None` plus
   an unknown entry, and the validator's predicate reads `None` as the absent default. `injection_of`
   now checks the unknown entry first and answers `Uncertain`: no inferred edge, and the
   `InjectionUncertain` reason. Regression: `an_unreadable_inject_vars_is_uncertain_not_enabled`.
   The validator's own predicate is unchanged (rule 5 treats "not certainly enabled" as silent, which
   was already the silent direction for rule 5 but not for edge inference).
2. **An unreadable declaration name left the scope closed** (`analysis/dependency.rs`,
   `scope_openers`). A declaration whose `name` is written but not read (an alias, a collection, an
   undecodable scalar) may carry any name, so it now opens its scope: new reasons
   `LocalNameUnreadable` and `GlobalNameUnreadable`. A declaration with no `name` key declares nothing
   and does not open the scope. **Because `scope_openers` is shared with rule 5's `closed_name_scope`,
   rule 5 now also stays silent in those scopes** — the two keep agreeing, which was the point of
   sharing it; no existing test changed. Regression: `an_unreadable_declaration_name_opens_the_scope`
   (local and global, analysis and save).
3. **Global-to-global usage was overwritten** (`analysis/dependency.rs`, `analyze_document`). The
   match-only usage vector is now added to the counts the globals pass made, not assigned over them.
   Regression: `global_to_global_usage_is_accumulated` (with and without a match reference).
4. **Repeated unterminated `[[` was quadratic** (`analysis/placeholder.rs`). Each opener searched the
   whole remaining text for `]]`. The next `]]` and `[[` are now cached across forward-moving queries
   (`NextDelimiter`), so each byte is searched a bounded number of times. Regression:
   `many_unterminated_openers_parse_quickly` (100 000 openers; 14.8 s before, well under the 1.5 s
   bound after, in a debug build).

Gate after the fixes, all exit 0 (outputs in `/private/tmp/4-7/fix/`):
`cargo test --workspace -- --test-threads=1` (**1701** passed), `cargo clippy --workspace
--all-targets -- -D warnings`, `cargo fmt --check`. No frontend file changed, so the other three rung
figures stand: **`1701 / 487 / 4086 / 214`**.

## 7. Anything else noticed

- The TypeScript `FindingCode` union and the i18n keys are the only frontend change; no browser model
  yet produces or consumes the two codes. A variable editor that saves (4-9 onward) must present them
  through the existing acknowledgement round trip.
