# Phase 2a-2a — the semantic gate: structural validation

**What this sub-phase is.** Step **5** of `IMPLEMENTATION_PLAN.md` §6.6 and nothing else: the six
espanso-semantic rules, run over the already-projected model. It builds no save transaction — steps
3, 4 and 12 are 2a-2b's and were deliberately not started — writes no file, crosses no IPC boundary
and renders no screen. `crates/espansoconfig-core/src/validate/mod.rs` was a 14-line placeholder
before this change and is now the whole of the rule set.

**The one sentence that defines it:**

> **`validate()` is a pure function from a `DocumentView` to classified findings. It reports; it
> never refuses.**

That sentence is the resolution of a real tension the placeholder recorded. The placeholder's doc
comment said the espanso-semantic layer produces *"warnings to the user, not reasons to refuse a
write"*; plan §6.6 calls step 5 a **semantic gate**. Both are right, about different things: the
**classification** is what a later caller gates on, and the classifier is not the gate. Blocking
policy lives at the transaction (2a-2b), where the lock is held and the rename happens.

---

## 1. What was built

**`crates/espansoconfig-core/src/validate/mod.rs`** — the whole rule set. Public surface:

| Item | What it is |
|---|---|
| `validate(&DocumentView) -> Vec<Finding>` | the six rules, grouped by match in document order. Pure: no I/O, no interior mutability, no filesystem |
| `Finding` | a code, a `ByteSpan`, a `NodeId` and a `DocumentPath` — shaped like `model::Diagnostic` so a caller that renders one renders the other |
| `Finding::class()` | the classification, **derived** from the code rather than stored, so the two cannot disagree |
| `FindingCode` (10 variants) · `FindingCode::name()` · `FindingCode::ALL_NAMES` · `FindingCode::class()` | the codes, a stable identifier per code, the reachability table, and the one place classification is decided |
| `FindingClass` (2 variants) · `FindingClass::ALL` · `FindingClass::name()` | the two of plan §6.6's four classes this module can produce (§3) |
| `required_param(VariableKind)` | the rule-3 table, with each entry's provenance in its doc comment (§4) |

**`crates/espansoconfig-core/tests/validate_semantics.rs`** — 70 tests. Every fixture is a
hand-authored neutral `const` **declared at the top level of the file and listed in
`every_fixture()`**; `every_fixture_is_listed_in_every_fixture` reads the file's own source and
fails when a constant is declared and not listed. **8 more unit tests** live beside the code
because they reach private items (the reference pattern, the code-name table, the
required-parameter table and the injection predicate).

> The first version of this row said *"every fixture an inline hand-authored neutral `const`"*,
> which was false in the way that mattered: many fixtures were local `let source` strings inside a
> test, so the reachability and purity sweeps covered a **subset** of the file while their names
> said otherwise. §12, finding 7.

**`Cargo.toml` (workspace) and `crates/espansoconfig-core/Cargo.toml`** — the `regex` dependency,
with the reason it keeps default features written where the version is pinned (§5).

**`crates/espansoconfig-core/src/lib.rs`** — the phase table gained a **2a-2a** row and the sentence
calling `validate` a stub was replaced.

Nothing under `tests/corpus/` was added, moved or reformatted. Fixtures are `const`s in the test file
on purpose: `model_projection.rs` pins a complete row per synthetic fixture **and asserts the table
covers the corpus exactly**, so a new file under `tests/corpus/synthetic/` would silently change a
different binary's meaning.

---

## 2. Decision — a report, not a gate, and where the boundary is drawn

`validate` takes a `&DocumentView` and returns `Vec<Finding>`. It does not take a path, a revision,
a lock or a byte. Three consequences were wanted:

1. **it is trivially testable** — a fixture is a string, and there is no temp directory anywhere in
   this sub-phase's tests;
2. **it cannot half-refuse.** A validator that could return `Err` would tempt a caller into treating
   its `Err` as the save decision, which is the transaction's decision;
3. **the classification is the interface.** 2a-2b will choose a policy per `FindingClass`; if that
   policy turns out to be wrong, it changes in one place and no rule moves.

**A document that did not parse yields no findings here**, because a failed parse projects to no
matches. That silence is exactly why plan §6.6 has a separate step 4, and
`a_document_that_does_not_parse_yields_no_findings_here` asserts `!view.parsed` **first**, so it
cannot pass by projecting a healthy document.

---

## 3. Decision — which of plan §6.6's four diagnostic classes this module emits

Plan §6.6 names four: **YAML syntax error** · **editor model error** · **suspicious but permitted** ·
**cannot be preserved visually**. `FindingClass` has exactly **two** variants, and the two omissions
are decisions rather than gaps:

- **YAML syntax error** is step 4's answer, asked of *bytes* rather than of a projection, and it is
  already modelled — `model::DiagnosticCode::ParseFailed` carries the line, the column and the byte
  offset. Restating it here would mean two places could disagree about whether a candidate parsed;
- **cannot be preserved visually** is the Phase 0b hazard gate: `syntax::HazardKind`,
  `MatchView::blocking_hazard` and `MatchView::safely_editable`. It already has one owner, and a
  second copy of a refusal is how two refusals drift apart.

**A class nothing emits is a claim nothing backs**, so `every_finding_class_is_reachable` sweeps
every fixture in the file and asserts the set of classes observed **equals** `FindingClass::ALL`.
`every_finding_code_is_reachable` does the same for all ten codes against `FindingCode::ALL_NAMES`,
whose companion `name()` is an exhaustive `match` — so adding a variant is a compile error there and
a reachability failure here, in that order.

### The line between the two classes, stated once

`FindingCode::class()` is the only place classification happens, and it answers one question:

> **Does the claim rest on a vocabulary espanso can extend without telling us?**

- **No → `EditorModelError`.** "Exactly one of these five fields" is a *shape*, not a list of names
  espanso grows. A missing required parameter is here too, but only because it is reported solely
  for a type this crate **recognised**, and every row of the table is an observed failure path in
  espanso 2.3.0's own source (§4). A regex that does not compile is here for the reason §5 gives.
- **Yes → `SuspiciousButPermitted`.** An unrecognised `type` is the exact case where espanso adding
  a tenth variable type makes this crate wrong, and **flagging a working configuration as broken is
  the worse failure**. An unresolved `{{reference}}` is here because whether the name was really out
  of scope depends on this crate's model of espanso's *scoping* rules — imports, form synthesis,
  regex capture groups — which is a model, not a measurement (§6).

**Phrasing.** Every variant name, doc comment and test name in the module says *this looks wrong*,
never *espanso will reject this*: `ReferenceHasNoDeclaration`, not `ReferenceWillFail`;
`RegexDoesNotCompile` (past tense, about our compiler), not `RegexIsInvalid`;
`VariableTypeNotRecognised` (about our table), not `VariableTypeIsWrong`.

---

## 4. Decision — the required-parameter table comes from espanso's source, not its documentation

Rule 3's second half needs a table of "the parameter this type has nothing to evaluate without".
Every row was taken from espanso **v2.3.0**'s own extension sources, by reading the error each
extension returns when the parameter is absent:

| Type | Parameter | Espanso's own message |
|---|---|---|
| `choice` | `values` | *missing values parameter* |
| `random` | `choices` | *missing 'choices' parameter* |
| `echo` | `echo` | *missing 'echo' parameter* |
| `shell` | `cmd` | *missing 'cmd' parameter* |
| `script` | `args` | *missing 'args' parameter* |
| `form` | `layout` | *missing layout parameter* |
| `match` | `trigger` | `RendererError::MissingSubMatch` |

Two of those strings — `missing 'echo' parameter` and `missing 'choices' parameter` — are also
observable in the **shipped binary** at `/Applications/Espanso.app`, which is a second, independent
confirmation that they are live error paths in the version installed on this machine.

**The `match` row was added by the review round (§12, finding 3), and it took different evidence.**
`match` really is not one of espanso 2.3.0's eight registered render extensions (`choice`,
`clipboard`, `date`, `echo`, `form`, `random`, `script`, `shell`) — the first note was right about
that and it is why no *extension* failure path exists. It is resolved **earlier**, in the renderer
itself: `espanso-render/src/renderer/mod.rs` at `v2.3.0` branches on `var_type == "match"` before
the extension lookup and calls `get_matching_template`, whose first statement is

```rust
let id = variable.params.get("trigger")?;
```

With no `params.trigger` that returns `None`, and the renderer answers `None` with
`error!("unable to find sub-match: {}", variable.name)` followed by
`RenderResult::Error(RendererError::MissingSubMatch.into())`. That is the same shape of evidence as
every other row — an observed failure path in espanso's own source — so the parameter is required
rather than reported as merely suspicious. Plan §3.4 named it; the source is what turned naming it
into measuring it.

**A variable is evaluated whether or not anything references it.** `generate_nodes` in
`espanso-render/src/renderer/resolve.rs` makes the body node depend on *every* local variable
(`local_vars_nodes.iter().map(|node| node.name)`), so a missing required parameter fails the whole
render, not only the templates that mention the variable. That is what makes the whole table worth
having.

**Two types are deliberately absent, and one of them is the reason this decision exists.**

- **`date` requires nothing.** Espanso's published extension documentation lists `format` as
  *required*; **its source does not** — with no `format` the extension returns RFC 2822. A table
  copied from the documentation would have fired on any `date` variable written without a format,
  which is a rule firing on a working configuration. `a_date_variable_without_a_format_is_not_reported`
  is the fixture that pins the source's answer, and it is the sharpest single argument for reading
  code rather than docs.
- **`clipboard`** takes no parameters at all.

### Two guards, because a parameter nobody read must not be reported absent

`params_are_readable()` suppresses the whole check when either holds:

- **`params` is an alias** — `params: *defaults` names a node defined elsewhere, which may well be
  a mapping holding the key. The projection records such a value whole as an `UnknownEntry` without
  descending into it, so nothing read it. Any other shape the projection could record is treated
  the same way, conservatively;
- **the mapping holds the YAML merge key `<<`** — `<<: *defaults` takes entries from an anchor
  defined elsewhere in the document, so the visible keys are not all the keys.

**A scalar or a sequence `params` is not one of them, and the review round changed that (§12,
finding 2).** The first version suppressed the check for *any* non-mapping `params`, which
conflated "nobody read it" with "there is nothing to read": a scalar holds no mapping entry under
any key, so the required parameter really is absent. The `UnknownEntry` already carries
`value_kind`, so this was knowable rather than unknowable. Espanso agrees about the shape —
`YAMLVariable::params` is a `Mapping` in `espanso-config/.../yaml/parse.rs`, so a file writing a
scalar there does not deserialize at all.

Four fixtures now, one per shape: merge key and alias on the silent side, scalar and sequence on
the reported side. Experiments **E9** and **E13** confirm both sides fire.

---

## 5. Decision — `regex` as a production dependency, and exactly what a compile proves

`regex = "1.13"`, **with default features**, is this crate's first production dependency since Phase
0a. Plan §6.6 names the crate explicitly ("Regex compiles under the Rust `regex` crate"), so the
decision was *how*, not *whether*.

**Default features are the decision.** Dropping `unicode` would make `\p{Greek}` and friends fail to
compile *here* while espanso accepts them — a rule firing on a working configuration, which is the
one outcome §4 exists to avoid. The comment saying so lives in `Cargo.toml`, beside the pin.

### What was established about espanso's own compilation, and how

Not guessed. Four independent observations, three of them from espanso's `v2.3.0` sources and one
from the binary installed on this machine:

1. **espanso 2.3.0 pins `regex = "1.5.5"`**, with no feature customisation, in its workspace
   `Cargo.toml`; its `Cargo.lock` resolves that to exactly `1.5.5`. The **shipped binary** contains
   `…/regex-1.5.5/…` source paths, so the installed daemon really is running that version;
2. **espanso does not wrap the pattern.** `espanso-match/src/regex/mod.rs` calls
   `Regex::new(&m.regex)` on the user's string directly, and builds a `RegexSet::new(&good_regexes)`
   from the same unmodified strings. No `^`, no `$`, no `(?s)`, no surrounding parentheses. This was
   the question the brief asked to establish rather than assume, and it is **established**;
3. an uncompilable pattern is not fatal to espanso's *load*: the binary carries
   `unable to compile regex: '{}', error: {}` and `unable to build regex set`, so the failure is
   reported and that match is dropped;
4. `regex 1.13.1`'s own manifest confirms `default = ["std", "perf", "unicode", …]`, which is what
   this crate now takes.

### So the claim, stated exactly

**A successful compile here does not prove a successful compile there.** The versions differ by eight
minor releases and a complete engine rewrite, and syntax added to `regex` after 1.5.5 compiles under
ours and would not compile under espanso's. The converse direction is not proven either: nothing here
shows that everything 1.5.5 accepts, 1.13 also accepts.

`FindingCode::RegexDoesNotCompile` is therefore evidence in **one direction only** — *this pattern
did not compile under our version* — and its documentation says so. It is classed as an
`EditorModelError` because a pattern that fails a strictly newer, strictly more permissive-about-old-
syntax parser is overwhelmingly likely to be malformed rather than merely modern; the residual risk
is hole 4 in §8. **Nothing anywhere claims espanso will accept or reject a pattern.**

The `detail` field carries the `regex` crate's own English diagnostic verbatim. It is named and
documented as **developer-facing**: it is a third party's prose in one language, and a localized
message must be built from the variant and the pattern, never from that string (plan §9).

---

## 6. Decision — rule 5 reports only when the name set is *closed*

Plan §6.6's fifth rule is qualified: *"Valid `{{references}}` where statically knowable."* The
qualifier is the whole rule, and it is implemented as `closed_name_scope()`, which returns `None` —
and silences the rule entirely for that match — whenever **any** of these holds:

| Opener | Why it opens the scope |
|---|---|
| the document has `imports` | another file's `global_vars` come into scope, and this crate did not read that file |
| `global_vars`, `imports` or the match's `vars` is an `UnknownEntry` | it was recorded whole rather than projected, so its members were never read |
| the match's `regex` did not compile | its capture groups — which espanso turns into references — could not be read |

Each of those three has its own fixture and its own sabotage (§7, E8a, E8c, E8e).

### Five openers this table used to have, and the source that removed them

**The first version of this table had seven rows, and five openers among them were guesses about
espanso's scoping that espanso's own source answers directly** — `type: form` and `type: match`
shared a row. Each suppressed rule 5 for a *whole match*
while introducing no name at all, so each was a silence bought with nothing. The review round
removed them (§12, finding 4), and the direction of that change is the false-positive direction —
which is why the real-corpus run was re-taken afterwards (§8).

| Removed opener | What the source says |
|---|---|
| a variable sets `inject_vars` | the field decides whether that variable's own **parameters** get substitution — `if variable.inject_vars { inject_variables_into_params(…) } else { Cow::Borrowed(&variable.params) }`. It puts nothing into the template's scope, and `inject_vars: false` is the branch that switches substitution *off* |
| a variable is `type: match` | the renderer's recursive branch inserts exactly one entry, `scope.insert(&variable.name, ExtensionOutput::Single(output))`. The sub-match is rendered by a separate `render` call with a separate scope, so its variables are invisible to the outer template |
| a variable is `type: form` | the form extension's output is an `ExtensionOutput::Multiple` stored under the variable's own name. `{{f.who}}` resolves because `f` is declared — the reference pattern's `name` capture stops at the dot — which this crate already saw without any opener |
| a variable has no `name` | it cannot declare one. Espanso is stricter still: `YAMLVariable::name` has no serde default, so a variable without a name makes the whole file fail to load |
| the match has a shorthand `form:` **beside** a content field | espanso's loader takes the first of `replace`/`markdown`/`html` and only falls through to `form` when none is present, so in that shape no `form1` variable is synthesised at all. A `form:` **alone** is not scanned by rule 5 either way, so the clause was either irrelevant or wrong |

The `form:`-beside-`replace` row is the sharpest example of what the sabotage sweep could not see.
E8b showed that clause was the *only* thing keeping
`a_reference_beside_a_form_field_is_not_reported_either` green — the sabotage fired, the clause did
work, and the work it did was wrong. **A sabotage shows a clause has an effect; it says nothing
about whether the effect models espanso.** That sentence is the lesson of this section.

Every removal has a fixture on **both** sides — the reference the declaration really does explain,
and the bare one it does not — and its own sabotage (§7, E16a–E16d, E17).

### What counts as a reference at all

`REFERENCE_PATTERN` is a **transcription of espanso's own `VAR_REGEX`** from
`espanso-render/src/renderer/mod.rs` at `v2.3.0`:

```
\{\{\s*((?P<name>\w+)(\.(?P<subname>(\w+)))?)\s*\}\}
```

This matters more than it looks. A name is `\w+`, so `{{ not-a-name }}` — with a hyphen — is **not a
reference to espanso**, and a snippet that expands to a mustache or Handlebars template must not be
reported. `a_brace_pair_espanso_does_not_recognise_is_not_reported` is that fixture.

**Two unit tests cover the pattern, and neither of them is a parity check** (§12, finding 6). The
first version claimed one was: `the_reference_pattern_reads_a_name_exactly_where_espanso_does`
checked six hand-picked strings against expectations written by hand beside the code they check —
espanso is never invoked and no independent oracle is consulted, so a mistranscription that agrees
on those six and differs on a seventh passes. It is now named
`the_reference_pattern_reads_the_names_this_crate_transcribed_it_for`, and its doc comment says
plainly what it does not establish. Beside it sits
`the_reference_pattern_agrees_with_espansos_own_unit_tests`, whose inputs and expected name sets are
transcribed from the tests espanso ships next to `VAR_REGEX` (`get_body_variable_names_no_vars` and
`get_body_variable_names_multiple_vars` in `espanso-render/src/renderer/util.rs`). Those
expectations were written by espanso's authors, which makes it a genuinely independent oracle — and
a **narrow** one: two cases, neither of them a dotted name, a Unicode name or an unusual brace
arrangement. It bounds the transcription risk rather than closing it (hole 11).

### Two surfaces are scanned, not one

`replace`, `markdown` and `html` — the three fields espanso runs through its renderer — **and the
parameter values of the match's own variables**. The second was added by the review round (§12,
finding 1); the first version scanned only the content fields and called the gap a coverage hole,
which understated it: a `{{missing}}` in a shell variable's `cmd` is statically knowable and
espanso fails on it.

Espanso's own path is `inject_variables_into_params` in `espanso-render/src/renderer/util.rs`,
which recurses into arrays and objects and calls the same `render_variables` the body uses; and
`generate_nodes` in `resolve.rs`, which adds every parameter reference to the variable's
dependencies, so an unresolvable one is a `RendererError::MissingVariable` before substitution even
starts. Three details of that walk are copied exactly:

- **values only, never keys** — espanso walks `params.values()` and, inside an object,
  `fields.values()`. `a_brace_pair_in_a_parameter_key_is_not_reported` is the fixture;
- **arrays and objects are descended into**, so a reference inside a `script`'s `args` list is
  scanned;
- **only when injection is on.** `inject_vars` defaults to `true`
  (`yaml_var.inject_vars.unwrap_or(true)`), so an absent field means scan; a written one is read as
  *source text* (D2u) and only the spellings this crate recognises as true count. Anything else,
  `false` included, means do not scan — the direction that stays silent. With `inject_vars: false`
  espanso passes the parameter through untouched and the braces are literal text.

An alias or an elided value inside the parameters is not walked. That is a false negative and never
a false positive: names are declared by `vars`, not by parameters, so text this crate did not read
cannot turn a reference it *did* read into a resolved one.

`image_path` is scanned by neither surface: it names a file rather than a template, and
`a_brace_pair_in_an_image_path_is_not_reported` is the fixture; experiment **E10** confirms that
adding `image_path` to the scanned set breaks it.

Espanso's renderer **fails** on an undeclared reference rather than passing it through literally —
its own `missing_variable()` test asserts a `RenderResult::Error`. That is why the rule exists at
all. It is still classed as suspicious rather than as an error, because the closure analysis above
is this crate's model of espanso's scoping, and a model is not a measurement.

---

## 7. The disabling experiments

Each sabotage was applied to production code, `tests/validate_semantics.rs` was run, and the change
was reverted; the file was then diffed against a pre-experiment copy to prove it came back byte
for byte. **An experiment that fires nothing is a test that measures nothing** — and one of these
fired nothing on the first attempt, which is recorded rather than quietly fixed.

Counts below are failing **tests**, measured against the final test file, and every one of them
includes `every_finding_code_is_reachable` where a whole rule was switched off — that sweep is what
turns "no fixture noticed" into a failure by itself.

**E1–E11 are the first round, and they name tests and fixtures as they stood then.** Several were
renamed or replaced by the review round; where a name below no longer exists, §12 says what happened
to it. The counts were not re-measured against the current file.

| # | Sabotage | Result |
|---|---|---|
| E1 | `check_content_side` never reports (rule 1 off) | **fires (7)** — no-content-field, two-content-fields, the wrong-shape test, the non-mapping test, the `form`-beside-`replace` test, document order, and the reachability sweep |
| E2 | `check_trigger_side` never reports (rule 2 off) | **fires (6)** — no-trigger, `trigger`+`regex`, `trigger`+`triggers`, the non-mapping test, document order, and the sweep |
| E3 | `check_variable_type` never reports (rule 3 off) | **fires (5)** — both shell tests, the no-type test, the unrecognised-type test, and the sweep |
| E4 | `required_param` returns `None` for every type | **fires (3)** — both shell tests and the sweep. Narrower than E3, which is the point: it isolates the table from the type check |
| E5 | the duplicate-name comparison is never made (rule 4 off) | **fires (4)** — the match-local duplicate, the global duplicate, the "names the second declaration" test, and the sweep |
| E6 | `check_references` returns before reporting (rule 5 off) | **fires (5)** — the undeclared reference, the dotted reference, the markdown/html test, the missing-capture-group test, and the sweep. **The first version of this sabotage fired nothing**: it inserted a decoy function beside `check_references` instead of disabling it, so it was a no-op. Recorded because a sabotage that does not sabotage looks exactly like a rule with no coverage |
| E7 | a `regex` that fails to compile is treated as compiling (rule 6 off) | **fires (4)** — the compile test, the "names the pattern scalar" test, the "silences the reference rule" test, and the sweep |
| E8a | the `imports` clause of `closed_name_scope` is removed | **fires (1)** — `a_reference_is_not_reported_when_the_document_has_imports` |
| E8b | the `form:`-content clause is removed | **fires (1)** — `a_reference_beside_a_form_field_is_not_reported_either`, and *only* that one, which is why it was written |
| E8c | the three `UnknownEntry` clauses are removed | **fires (3)** — the unreadable `global_vars`, `vars` and `imports` fixtures |
| E8d | `opens_scope` never opens | **fires (4)** — the no-name, injected-vars, `type: form` and `type: match` fixtures |
| E8d-1 | only the missing-`name` clause of `opens_scope` is removed | **fires (1)** — the no-name fixture alone |
| E8d-2 | only the `inject_vars` clause is removed | **fires (1)** — the injected-vars fixture alone |
| E8d-3 | only the `form`/`match` clause is removed | **fires (2)** — the `type: form` and `type: match` fixtures |
| E8e | a regex that did not compile no longer opens the scope | **fires (1)** — `a_regex_that_does_not_compile_silences_the_reference_rule` |
| E9 | `params_are_readable` always returns `true` | **fires (2)** — the merge-key fixture and the non-mapping-`params` fixture |
| E10 | `image_path` is added to the scanned content fields | **fires (1)** — `a_brace_pair_in_an_image_path_is_not_reported` |
| E11 | regex capture groups are not added to the name set | **fires (1)** — `a_reference_to_a_regex_capture_group_is_not_reported` |

### The review round's experiments

Same method: the sabotage was applied to the file under test, the affected binary was run, the
change was reverted, and both files were diffed against copies taken beforehand.

| # | Sabotage | Result |
|---|---|---|
| E12 | `required_param` returns `None` for `Match` again | **fires (2)** — `a_match_variable_without_a_trigger_param_is_reported` in the acceptance binary and `the_required_parameter_table_is_the_one_espanso_2_3_0_enforces` in the crate's own tests |
| E13 | `params_are_readable` treats **every** non-mapping `params` as unreadable, as it used to | **fires (2)** — `a_shell_variable_whose_params_are_a_scalar_is_reported` and `…_are_a_sequence_is_reported`. The alias and merge-key fixtures stay green, which is what shows the new predicate splits the cases instead of flipping them |
| E14 | `check_parameter_references` is never called | **fires (4)** — the `cmd`, the nested `args`, the form `layout` and the parameter-path test |
| E15 | `injection_is_certainly_enabled` always answers `true` | **fires (2)** — `a_parameter_reference_is_not_reported_when_injection_is_off` and `injection_is_on_by_default_and_off_when_the_file_says_so` |
| E16a | the `inject_vars` opener is put back | **fires (1)** — `a_body_reference_is_reported_whichever_way_inject_vars_is_written` |
| E16b | the nameless-variable opener is put back | **fires (1)** — `a_reference_beside_a_nameless_variable_is_still_reported` |
| E16c | the `type: form` opener is put back | **fires (2)** — `a_bare_reference_beside_a_form_variable_is_still_reported` and `a_reference_inside_a_form_layout_is_reported` |
| E16d | the `type: match` opener is put back | **fires (1)** — `a_bare_reference_beside_a_nested_match_variable_is_still_reported` |
| E17 | the `form:`-beside-a-content-field opener is put back | **fires (1)** — `a_reference_beside_a_form_field_is_reported_because_espanso_ignores_the_form` |
| E18 | one fixture is deleted from `every_fixture()`'s list | **fires (1)** — `every_fixture_is_listed_in_every_fixture`, which is the whole reason that guard exists |
| E19 | `NameScope::contains` always answers `false` | **fires (1)** — `the_real_configuration_produces_no_finding_of_either_class`, with **117** `ReferenceHasNoDeclaration` findings over the owner's config. **This is the experiment the old assertion would have passed**: all 117 are `SuspiciousButPermitted`, and the test used to assert only `errors == 0`. It is the review's own "concrete weaker implementation", made to fail |
| E20 | the real-corpus test stops consulting the mandatory-corpus switch | **fires (1)** — `the_real_corpus_test_reads_the_switch_that_makes_it_mandatory` |
| E21 | the duplicate set's `insert` result is ignored (rule 4 off) | **fires (5)** — both duplicate fixtures, the "names the second declaration" test, the large-scope test and the reachability sweep |
| E22 | the reference pattern's `.subname` group is made mandatory | **fires (2)** — both pattern unit tests, including the espanso-authored one |

**E20 found a defect rather than confirming one.** The first version of
`the_real_corpus_test_reads_the_switch_that_makes_it_mandatory` split this file's source at the
real-corpus test's opening line and searched **everything after it** — which includes the guard's
own `assert!`, so the guard matched itself and could never fail. The sabotage is what exposed it;
the scan is now bounded by the function's closing comment, and E20 fires. Recorded rather than
quietly fixed, because a guard that matches its own text is exactly the defect this round was
convened to remove.

After both sweeps, `crates/espansoconfig-core/src/validate/mod.rs` and
`crates/espansoconfig-core/tests/validate_semantics.rs` were diffed against copies taken before the
first experiment and are byte-identical.

---

## 8. Verification

Each command run separately.

| Command | Exit |
|---|---|
| `cargo fmt --check` | 0 |
| `cargo build --workspace` | 0 |
| `cargo test --workspace` | 0 — 17 test binaries plus doc-tests, **678 tests**, 0 failed, 0 ignored |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | **1 — nothing found**, which is the required result (CLAUDE.md §3, D2x) |
| `git status --short --untracked-files=all` | no path under `tests/corpus/real/` appears |

The baseline was **600**; this sub-phase adds **78** — 70 in `tests/validate_semantics.rs` and 8 unit
tests in `validate/mod.rs`. (Before the review round it was 58: 52 plus 6.)
`tests/corpus_integrity.rs` passes unchanged: **no file under `tests/corpus/` was written, moved or
reformatted.**

`espansoconfig-core`'s direct dependencies are now `regex`, `saphyr-parser`, `serde`, `sha2`. No
tauri, directly or transitively.

**Privacy.** Every fixture in this sub-phase is a hand-authored neutral `const` in the test file.
The one real-corpus test prints file counts and code names only — never a scalar, a key, a trigger
or a byte of the owner's configuration — and skips cleanly when the gitignored corpus is absent.

### The real configuration — counts only

The cheapest possible check of the **five rules the corpus exercises** is that none of them fires on
a configuration espanso loads every day. Re-taken **after** the rule-5 narrowing and the parameter
scan of §6, over the owner's live config:

| Measurement | Count |
|---|---|
| files walked | 13 |
| matches walked | 65 |
| variables walked (`vars` + `global_vars`) | 38 |
| `regex` triggers walked | **0** |
| findings, class `EditorModelError` | **0** |
| findings, class `SuspiciousButPermitted` | **0** |

**Zero findings of either class, and both are now asserted** (§12, finding 5). The first version
asserted only `errors == 0` and merely *printed* the suspicious count, so every unresolved
reference in the owner's configuration would have gone unnoticed — E19 makes that failure mode
concrete. The counts of what was *walked* are asserted too (`matches > 0 && variables > 0`), because
a projection that produced nothing would otherwise report the same clean zero as a configuration
this module genuinely approves of (R24).

**Not a check of all six rules.** The corpus holds **zero** `regex` triggers, so rule 6 is untouched
by it (hole 1), and this is the five other rules' silent side on one configuration and nothing else.

**The skip is now visible.** The test still does nothing when `tests/corpus/real/` is absent — a
fresh clone and CI both have to pass — but setting `ESPANSOCONFIG_REQUIRE_REAL_CORPUS` turns that
silence into a failure. The decision is a two-input function with a test on all four combinations,
and a second test proves the real-corpus test actually consults it; without that second test the
mechanism could be correct and unreachable, which on a machine with no corpus looks exactly like a
machine that has one.

---

## 9. What was deliberately not done

- **No save transaction.** Steps 3, 4 and 12 of §6.6 — apply patches in memory, reparse the whole
  candidate, update the in-memory snapshot — are 2a-2b's, and no part of them was started.
- **No `Serialize`, anywhere.** Copying `model::Diagnostic`'s derive onto `Finding` would have been
  one line and would have been wrong: `src-tauri/src/dictionary_contract.rs`'s
  `every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code` demands that every enum `serde`
  can write owns a `code.` namespace in `en.json` **and** `es.json`, or is excluded by name with a
  reason. The sub-phase that puts validation on the wire adds the derive and the strings in one
  change. This is the 2a-1 precedent and it is the guard working, not a gap.
- **No second opinion about trigger and content counts.** Rules 1 and 2 read `TriggerSpec::kind` and
  `ContentSpec::kind`, which the projection already computed from **modelled** fields. Recounting
  here would have produced a second opinion that could disagree with the one the browser shows —
  and it would have counted a `trigger:` holding a sequence as a trigger form, which the projection
  correctly calls an unknown entry. `a_content_field_of_the_wrong_shape_is_not_counted_as_a_content_field`
  pins that reading.
- **No user-facing strings, no dictionary keys, no i18n.** There is no screen in this sub-phase.

---

## 10. Coverage holes, stated as holes

1. **Rule 6 has no real-corpus coverage at all, permanently for now.** The owner's configuration
   contains **zero** `regex` triggers, so every claim about regex compilation rests on the synthetic
   fixtures in the test file. This is the same shape as the hole
   `docs/decisions/1c-2b-2b-2-notes.md` §8 records for unmodelled entries: the one corpus that is
   real has nothing to say about this rule.
2. **Nothing here has ever been checked against a running espanso.** Every claim about what espanso
   does comes from reading its `v2.3.0` sources and its shipped binary, not from feeding it a file
   and watching. In particular: no test confirms that a document this module reports **is** in fact
   one espanso complains about, and none confirms that a document it stays silent about **is** one
   espanso loads. Closing this needs a daemon under test, which nothing in this repository has.
3. **~~`type: match` is unvalidated beyond its name.~~ CLOSED by the review round.** The failure
   path was found where the first pass did not look — in the renderer rather than among the eight
   registered extensions — and `required_param(Match)` is now `Some("trigger")` with the citation
   in §4. Both sides have a fixture and E12 fires. What remains is narrower and is hole 12: nothing
   checks that the named trigger *exists*, because the sub-match may live in another file.
4. **The regex version asymmetry is stated but not measured in either direction.** No test compiles
   anything under `regex 1.5.5`; the version gap in §5 is established from lockfiles, manifests and
   binary strings, not from a differential run. A pattern accepted by 1.5.5 and rejected by 1.13
   would be reported as an `EditorModelError` on a match espanso runs happily, and nothing here
   would notice.
5. **The reference rule's *closure* analysis is still the weakest thing in the module, and the
   review round changed its shape.** It is now **three** rows rather than seven (§6), because five
   openers among them were shown wrong by espanso's own source. That makes the list shorter and each
   remaining row better evidenced — and it makes rule 5 fire **more**, which is the false-positive
   direction. The re-taken real-corpus run (§8) is the only measurement that says the narrowing did
   not go too far, and it is one configuration with 65 matches. A scoping route nobody thought of
   would now produce a false `ReferenceHasNoDeclaration` where it previously produced silence. This
   is why that code is suspicious rather than an error.
6. **~~Rule 5 does not look inside variable parameters.~~ CLOSED by the review round**, for the
   match's own `vars`. What remains is three narrower gaps:
   - **`global_vars`' parameters are not scanned.** A global variable is resolved in the node map of
     whichever template pulls it in — globals *plus that template's locals* — so a static answer
     would have to be the intersection over every template in the configuration, and this pass is
     per-document. Scanning them against the globals alone would report a global whose parameter
     references a local of the one match that uses it, which is a false positive;
   - **an alias or an elided value inside `params` is not walked**, so a reference hidden behind
     `cmd: *something` is not seen. A false negative by construction;
   - **`inject_vars` is read as source text** (D2u), and only the spellings `true`, `yes` and `on`
     count as on. A file writing some other YAML 1.1 true-ish token would be treated as injection
     off and its parameters would go unscanned — again a false negative.
7. **Uniqueness is per-sequence and nothing checks across sequences.** A match-local variable
   shadowing a global one is deliberately not reported (it is how espanso is used), but neither is a
   name colliding with a regex capture group of the same match, which plausibly *is* a conflict.
   What *is* now established, and is recorded in §12 under finding 9, is what espanso does with a
   repeated name inside one sequence: `generate_nodes` keys its node map by name, so the later
   declaration replaces the earlier and only the later is ever evaluated. Nothing in the module
   presents that fact to a user, and no test asserts it.
8. **Nothing validates a config profile.** `validate` walks `matches` and `global_vars`; a
   `config/*.yml` yields no findings by construction. Plan §3.6's ~35 behaviour options and four
   regex-matched filters — `filter_title`, `filter_exec`, `filter_class`, `filter_os`, all of which
   are patterns rule 6 could compile — are entirely unvalidated. Named as future work.
9. **`FindingCode::RegexDoesNotCompile { detail }` is unbounded English prose from a third party.**
   Its length is bounded by the pattern, so it is not a resource risk, but it is the one operand in
   the module whose content this crate does not control, and it is the first thing that will have to
   change when validation crosses the wire.
10. **The reachability sweeps are only as wide as `every_fixture()`** — which, since the review
    round, really is every fixture in the file, enforced by
    `every_fixture_is_listed_in_every_fixture` rather than by discipline. They prove every code and
    every class is reachable by *some* fixture; they do not prove any fixture is representative of a
    real document. Nothing can prove that.
11. **The reference pattern is a transcription, and only two of its cases have an independent
    oracle.** `the_reference_pattern_agrees_with_espansos_own_unit_tests` uses expectations espanso's
    authors wrote, which is genuinely independent — for exactly two inputs, neither of them a dotted
    name, a Unicode name or an unusual brace arrangement. Everything else about the pattern rests on
    expectations this crate wrote beside the code they check. Closing this needs espanso's regex
    engine, or its test suite, under test here.
12. **A `match` variable's `trigger` is checked for presence, never for existence.** Espanso looks
    the value up among the templates it has loaded — across every file — and answers a miss with
    `RendererError::MissingSubMatch`, the same error as a missing parameter. This pass sees one
    document, so it cannot say whether the named sub-match exists. It must also be a
    `Value::String`; a non-string `trigger` fails espanso's lookup and is not reported here either.
13. **Espanso 2.3.0 recognises a tenth variable type this crate's table does not: `global`.** The
    renderer replaces a variable whose `var_type` is `global` with the `global_vars` entry of the
    same name (`espanso-render/src/renderer/mod.rs`, the `local_variables` block). This crate's
    `VariableKind::from_text` knows nine types, so `type: global` projects as `Unrecognised` and
    rule 3 reports `VariableTypeNotRecognised` — a suspicious finding on a construction espanso
    supports. Rule 5 is unaffected: the variable's `name` is what it declares either way. Not fixed
    here because `VariableKind` is a Phase 1 wire type with dictionary entries in `en.json` and
    `es.json`; adding a variant is that sub-phase's change, not this one's. The owner's
    configuration uses none, so §8's zero says nothing about it.
14. **The complexity fix has no timing test.** Duplicate detection and reference lookup are hash
    sets now and the global name set is built once per document rather than copied per match, but
    nothing in the suite measures a time. `a_large_variable_scope_still_reports_exactly_the_one_duplicate`
    checks the *answer* at a thousand variables, not the clock; a future change that reintroduces a
    linear scan would keep every test green.

---

## 11. What 2a-2b inherits, and should not rebuild

- **`validate(&DocumentView) -> Vec<Finding>` is the whole semantic gate (step 5).** Call it on the
  projection of the **candidate**, not of the original — the whole point of step 4 is that a
  candidate is reparsed and reprojected first.
- **The blocking policy is 2a-2b's to invent, and it belongs at the transaction.** Nothing in
  `crate::validate` decides whether a save proceeds, and nothing there should start to.
  `FindingClass` is the axis to gate on. A likely shape — refuse on `EditorModelError`, confirm on
  `SuspiciousButPermitted` — is *not* decided here.
- **Step 4 is not step 5.** Reparsing the candidate is a question about bytes and has to reparse the
  **whole** document; `patch/edit.rs` already does a reparse-verify at the mutation entry point, and
  §6.6's "Three things 2a-2 is most likely to get wrong" in `PROGRESS.md` says to establish what
  that covers before writing a second one.
- **The lock is held across steps 2 to 11** (2a-1 notes §12). `validate` is pure and cheap, so
  running it inside the lock costs nothing; it does no I/O, so it cannot deadlock.
- **`Finding` and both enums owe `code.` namespaces in `en.json` *and* `es.json` the day one of
  them gains `Serialize`.** Ten codes and two classes. The derive and the strings land together, or
  neither lands.
- **Do not add a class to `FindingClass` without a rule that produces it.**
  `every_finding_class_is_reachable` will fail, which is the check working.
- **A rule that fires on the owner's working configuration is a defect** until proven otherwise, and
  `the_real_configuration_produces_no_finding_of_either_class` is where that is enforced. Keep both
  the walked-counts assertion and the **both-classes** assertion when extending it: the first stops
  the zero from being vacuous, and the second is what the review round had to add (§12, finding 5).

---

## 12. Review disposition — the nine findings

`docs/reviews/phase-2a-2a-semantic-gate.md` returned nine findings: four blocking, four should-fix,
one nit. **All nine were accepted and all nine are resolved.** Nothing was argued down.

The round's method is worth stating once, because three of the findings turned on it: where a fact
about espanso **can** be established, it was established from `v2.3.0`'s own sources and cited at
the code; where it cannot, the answer is `SuspiciousButPermitted` and a hole, never silence. Every
fact below was read out of espanso's source in this round, not remembered from the last one.

### 1 — blocking — rule 5 ignored references inside variable parameters. **Fixed.**

`check_references` now scans the parameter values of the match's own variables as well as its
`replace`, `markdown` and `html` (§6, "Two surfaces are scanned"). The walk copies espanso's:
values only, never keys; into arrays and objects; and **only when injection is on**, since
`inject_vars: false` makes espanso pass the parameter through untouched. Six fixtures, both sides,
plus a test that the finding names the parameter's own scalar and path
(`matches[0].vars[0].params.cmd`). E14 and E15 fire.

The projection reaches this text: `params` is a `Vec<FieldView>` of `ValueView`s, so nothing was
structurally in the way — the first pass simply did not look. Three genuine limits remain, and they
are hole 6: `global_vars`' parameters (their scope depends on which template pulls them in), an
alias or elided value inside `params`, and the source-text reading of `inject_vars`.

### 2 — blocking — a non-mapping `params` suppressed a provably missing parameter. **Fixed.**

`params_are_readable` now reads the `UnknownEntry`'s `value_kind`. A **scalar** or a **sequence**
`params` provably holds no entry under any key, so the parameter really is absent; an **alias** may
point at a mapping that has it, so silence stays. The negative-side test the review named was wrong
and is gone; `a_variable_whose_params_are_not_a_mapping_is_not_reported` is replaced by four
fixtures, one per shape. E13 fires and leaves the alias and merge-key fixtures green, which is what
shows the predicate splits the cases rather than flipping them.

### 3 — blocking — `type: match` was accepted without `params.trigger`. **Fixed, with the citation.**

The review was right that this is not one of the eight registered render extensions — and that is
precisely why the first pass found no failure path. It is resolved in the renderer instead:
`get_matching_template` starts `let id = variable.params.get("trigger")?;` and the renderer answers
its `None` with `RendererError::MissingSubMatch`. `required_param(Match)` is now `Some("trigger")`,
classed like the rest (§4). E12 fires in both binaries. Hole 3 is closed; hole 12 records the part
that is still not checkable from one document — whether the named sub-match exists.

### 4 — blocking — several rule-5 openers suppressed genuinely unresolved references. **All four narrowed, and a fifth with them.**

Assessed one at a time against `espanso-render/src/renderer/mod.rs`, and every one of them was
wrong (§6, "Five openers this table used to have"):

- **`inject_vars`** decides whether a variable's own *parameters* get substitution. It puts nothing
  into the template's scope, and `inject_vars: false` is the branch that switches substitution off;
- **a nameless variable** declares nothing, and espanso's `YAMLVariable::name` has no serde default,
  so such a file does not load at all;
- **a `form` variable** stores its output under its own name, so `{{f.who}}` already resolved on
  `f` without any opener — the suppression bought nothing and cost every other reference in the
  match;
- **a `match` variable** does `scope.insert(&variable.name, …)` and renders the sub-match with a
  *separate* scope. The review asked for this one to be established before dropping it; it is
  established, and it is not an opener;
- **the `form:` shorthand beside a content field** went too: espanso's loader takes
  `replace`/`markdown`/`html` first and only falls through to `form` when none is present, so no
  `form1` variable is synthesised in that shape. This one was not in the review's list; it was
  removed because the same source that answered the other four answers it, and leaving it would have
  been a clause kept only because nobody asked about it.

Every removal has fixtures on both sides. E16a–E16d and E17 fire, one named test each.

**The real-corpus run was re-taken afterwards** (§8): 13 files, 65 matches, 38 variables, **0
findings of either class**. The narrowing did not start reporting on the owner's working
configuration.

### 5 — should-fix — the real-corpus test could skip and pass, and asserted too little. **Fixed.**

It now asserts `(errors, suspicious) == (0, 0)`, is renamed
`the_real_configuration_produces_no_finding_of_either_class`, and its doc comment says plainly that
the corpus holds **zero** `regex` triggers so rule 6 is untouched by it — the "check of all six
rules" claim is gone from both the test and §8. The skip stays, because a fresh clone and CI must
pass, but it is no longer silent: `ESPANSOCONFIG_REQUIRE_REAL_CORPUS` turns an absent corpus into a
failure, the decision is a two-input function tested on all four combinations, and a second test
proves the real-corpus test actually consults it. E19 makes the review's own weaker-implementation
scenario fail (117 suspicious findings the old assertion would have passed), and E20 fires — after
exposing that the wiring guard originally matched its own text (§7).

### 6 — should-fix — the "exact parity" pattern test had no oracle. **Narrowed, and given a real one.**

Renamed `the_reference_pattern_reads_the_names_this_crate_transcribed_it_for`, with a doc comment
that says it is not a parity check and names what passes it anyway. Beside it,
`the_reference_pattern_agrees_with_espansos_own_unit_tests` runs the inputs and expected name sets
from espanso's own `get_body_variable_names_*` tests — expectations espanso's authors wrote. Two
cases, which is narrow, and hole 11 says so. §6's "pins both halves" claim is gone. E22 fires.

### 7 — should-fix — `every_fixture()` was not every fixture. **Fixed, and made self-enforcing.**

Every inline `let source` in the file is now a top-level `const`, all of them are listed, and
`every_fixture_is_listed_in_every_fixture` reads this file's own source and fails when a constant is
declared and not listed. A constant that genuinely is not a fixture must be named in an exemption
list with its reason; the list is itself checked against the file. `validation_is_a_pure_function_of_the_projection`
is renamed `validating_the_same_projection_twice_gives_the_same_findings`, and its doc comment now
says what it is: a repeatability check that would still pass for a validator that cached a clock
reading. §1's "inline `const`" error is corrected in place, with the reason it mattered. E18 fires.

### 8 — should-fix — validation was quadratic on large scopes. **Fixed.**

Duplicate detection is a `HashSet<&str>`; the document's global names are collected **once** into a
`HashSet<&str>` and *borrowed* by every match instead of cloned into one merged `Vec` per match; a
reference lookup is three set probes rather than a linear scan. `NameScope` is the type that holds
the three sets. `a_large_variable_scope_still_reports_exactly_the_one_duplicate` checks the answer at
a thousand variables and is documented as **not** a timing assertion — hole 14 says a future
regression to a linear scan would keep every test green.

### 9 — nit — the duplicate-location doc comment claimed unchecked precedence. **Fixed, and the precedence established anyway.**

The comment now says only what the body proves: the finding's node and span are the second
declaration's, so an editor puts the caret there. The claim that the second "lost" is gone — and it
was **backwards**. `generate_nodes` in `espanso-render/src/renderer/resolve.rs` builds a
`HashMap<&str, Node>` keyed by variable name and inserts locals in source order, so a repeated name
leaves only the **later** node in the map, and only the later variable is ever evaluated. Espanso is
last-wins; the earlier declaration is the one with no effect. The finding stays on the second because
that is the declaration whose presence makes the name a duplicate, and because pointing at the
earlier one would be pointing at bytes that do nothing. Nothing in the module presents this
precedence to a user, and no test asserts it — hole 7.
