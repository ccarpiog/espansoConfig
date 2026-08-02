# Phase 2b-2b-3 — decision record

`save_match`, the eighth `#[tauri::command]` and the **second** that can write a user's file. It is
the step that gives every line of 2b-2b-1 and 2b-2b-2 its first caller.

---

## 1. What was built

| Piece | Where |
|---|---|
| `save_match`, the command, and `WorkspaceSession::save_match` / `save_one_match` behind it | `src-tauri/src/commands.rs` |
| `CommandError::DraftRefused { error: DraftError }`, the ninth code | `src-tauri/src/error.rs` |
| `after_a_save` generalized from `(sequence, landing)` to `at: Option<&DocumentPath>` | `src-tauri/src/commands.rs` |
| The `code.draftError.*` namespace — **32 variants × 2 languages**, no placeholders | `src/lib/i18n/{en,es}.json` |
| The deletion of the TEMPORARY `NOT_A_CODE` exclusion for `DraftError`, and its self-disabling tripwire | `src-tauri/src/dictionary_contract.rs` |
| `DraftError::MatchHasNoPath` → `MatchHasNoPath {}`, so every variant crosses as an object | `crates/espansoconfig-core/src/draft/error.rs` |
| `every_draft_error_variant_crosses_as_an_object`, derived from source, not from a sample | `src-tauri/src/wire_contract.rs` |
| The wire types — `MatchDraft`, `DraftField<T>`, `DraftTarget`, `DraftError`, the three field-identifier unions | `src/lib/ipc/types.ts` |
| `saveMatch`, the typed wrapper; the real `DraftError` in the operand table | `src/lib/ipc/{commands,errors}.ts` |
| `describeDraftError` and its reactive `tDraftError` | `src/lib/i18n/{codes,index}.ts` |
| `every_typescript_wire_union_has_a_namespace` reading the shared `NOT_A_CODE` table | `src-tauri/src/dictionary_contract.rs` |
| **The window reading four phases overdue** | §7 below |

`SaveResult::Saved::notes` got its **first producer**. It has been on the wire since 2b-1 with none:
a move copies the item's own bytes verbatim and re-encodes no scalar, and a draft diff does.

---

## 2. The three rulings the phase was built to

Taken from a design consult **before** any of it was written —
`docs/reviews/phase-2b-2b-3-design.md` — because all three change the shape of the surface rather
than the shape of the code, and deciding them afterwards would have meant deciding them twice.

### 2.1 D1 — a `DraftError` crosses in the `Err` channel, not as a `SaveResult`

`Err(CommandError::DraftRefused { error })`, and **not** a new `SaveResult` variant. The two
refusals look alike and are not:

| | `SaveResult::Refused` | `CommandError::DraftRefused` |
|---|---|---|
| When | inside the transaction, under the lock | before it, with no lock held |
| What ran | the semantic gate, on a real candidate | nothing — no batch was derived |
| Overridable | **yes**, by acknowledging the findings | **never** |
| What the caller does | hands the findings back | changes the request |

Filing them under one type would invite a frontend to put an *acknowledge and retry* control in
front of a refusal that retrying cannot move. The analogue already on the enum is
`CommandError::MoveNotWithinOneSequence`, which is the same shape for the same reason.

**The argument against is recorded rather than won.** A draft refusal is an *expected domain
outcome*, not an infrastructure failure, and returning it through `Err` invites generic
command-error handling to render it as a toast where the honest presentation is inline feedback on
the field the user was editing. The answer is that the frontend must treat this code as an
**actionable validation category** — not that the planning/transaction distinction should be
weakened to make a careless renderer look right.

### 2.2 D2 — a success re-mints its identity from the match's **own** path

Not from the sequence-path-plus-index address `move_match` uses. That helper exists because a move
*changes* a sequence position; a scalar save does not relocate anything. So:

- a match the projection cannot address as a sequence item is **still editable**, and
  `MoveNotWithinOneSequence` never appears on this command's path;
- `None` is the defensive last resort, not the routine answer;
- **a successful disk write is never afterwards reported as an `Err`.** The bytes are already
  there, and a failure return invites a caller to retry a write that has already happened.

`after_a_save` therefore takes `at: Option<&DocumentPath>` and each caller computes it its own way.
It mints an identity only when the commit happened **and** the fresh read agrees with the revision
the transaction established; when it does not, another writer reached the file in between and the
address is no longer known to hold what was written there.

### 2.3 D3 — an empty batch is still handed to the transaction

A draft that changes nothing plans to an empty batch, and the tempting answer — answer `committed:
false` from the cached view — is the wrong one. Short-circuiting would skip the
optimistic-concurrency check `save_document` takes **under the per-path lock**, and so would report
success for a file some other writer changed after the projection was read. One wasted read buys a
single authoritative save-result path.

There is no lock-ordering hazard in the sequence: planning holds no lock at all, `save_document`
alone takes one, and a concurrent modification between the two becomes a `SaveResult::Conflict`
rather than a wrong write.

---

## 3. D4 — the guards are not re-run at this layer

`plan_match_edits` runs `check_closed_surface` and `check_batch_independence` itself, as steps 7 and
8 of its own documented contract. `save_one_match` deliberately does **not** call them again:

- the closed-surface half would be an identical second call;
- the independence half needs the original key lists — the match mapping's keys **and** every nested
  open mapping's whole key list — and only the planner holds them. A copy assembled at this layer
  would be a *weaker* second statement wearing the same name, which is worse than no second
  statement at all.

---

## 4. D5 — every `DraftError` variant crosses as an object

`MatchHasNoPath` was the **single unit variant of thirty-two**, so `serde` wrote it as a bare JSON
string while the other thirty-one arrived as one-key objects. The frontend's `COMMAND_ERROR_OPERANDS`
declares one shape per operand, and `wire_contract.rs` pins that shape against a **sampled** variant —
so only one of the two shapes could ever be declared. A refusal carrying `MatchHasNoPath` would have
failed `hasShape`, fallen out of `isCommandError`, and been classified an **unexpected failure**:
the typed code lost, and the `code.draftError.matchHasNoPath` sentence this very phase wrote in two
languages rendered as a generic fallback instead.

Written as the empty struct variant `MatchHasNoPath {}` it writes `{"MatchHasNoPath": {}}`, and *a
`DraftError` is always an object* becomes true by construction rather than true of thirty-one cases
out of thirty-two. `every_draft_error_variant_crosses_as_an_object` derives the variant list from
`crates/espansoconfig-core/src/draft/error.rs` **by parsing it**, so a future unit variant fails the
build rather than silently demoting a refusal.

**This was found by review, not by a test**, and the reason no test caught it is worth keeping: both
halves of the contract were individually correct. The dictionary had the string, the exhaustiveness
check passed, the shape table matched its sample. Nothing anywhere asked whether the sample was
representative.

---

## 5. D6 — one exemption table, read from both directions

`every_typescript_wire_union_has_a_namespace` demanded that **every** string-literal union in
`src/lib/ipc/types.ts` own a `CODE_ENUMS` namespace. Its Rust-side twin,
`every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code`, has always allowed the second
answer: an enum may instead be named in `NOT_A_CODE` **with a reason**.

That made the exemption mechanism half a mechanism. `MatchField`, `SequenceField` and
`VariableField` are already reasoned entries there — each names an espanso key, spelled the same in
every language, serialized as that key and pinned variant-by-variant — and the moment the frontend
mirrored them, the TypeScript half demanded namespaces they must not have.

The fix was to make the two directions read **one table**, not to add a second, hand-maintained
exclusion list beside it. An exempted union is still **counted** as examined, and the exempted set
is asserted by name, so adding one stays a deliberate act.

The non-vacuity floor moved from 12 to **43**. It had stood at twelve against thirty-nine unions —
a floor that had stopped biting. Forty-three rather than forty-four because `DraftError` is *not*
among them: D5 left it with no single-quoted member at all, so it now reads as a structural type and
is skipped. Nothing is lost — its variant names live in `DraftErrorName`, which **is** examined, and
whose `Name` suffix is stripped to find the `draftError` namespace.

---

## 6. Holes this phase leaves open

1. **Nothing calls `save_match` from a screen.** There is a command, a wrapper and a typed
   accessor, and no component invokes any of them. The `code.draftError.*` strings have key parity,
   placeholder parity and a compile-checked accessor, and **have never been drawn** — the same debt
   this phase just discharged for four other strings, now opened for thirty-two more.
2. **`SaveResult::Saved::notes` has a producer and no reader.** A `PresentationNote` is proved to
   reach the wire by a test; no screen shows one.
3. **`AmbiguousVariableKey` and the other unreachable refusals are still unreachable.** The hazard
   gate refuses the whole match first. Their sentences exist because a code with no sentence is
   worse than a code with no caller — not because anything can produce them.
4. **32 Spanish values were added and are checked only by heuristic.** Nothing establishes that any
   is idiomatic. Hole 9 of `1b-1-notes.md`, thirty-two entries larger.
5. **The real configuration exercises none of this.** All 65 real matches plan to an **empty**
   batch, which is the property 2b-2b-1 and 2b-2b-2 wanted and is also the reason the real corpus
   says nothing about a batch that is not empty.

---

## 7. The window reading

Taken by the technique of `1c-1-notes.md` §10 with the instrument correction of
`1c-2b-2b-2-notes.md` §6.1. **`npm run build` followed by
`cargo build -p espansoconfig --features custom-protocol` preceded every launch**, per the rule
1c-2b-1 added, and each of the two plans went into its **own fresh bundle path** with its own
`HOME` and `XDG_CONFIG_HOME`.

**The owner's real configuration was never opened.** `XDG_CONFIG_HOME` is the first candidate
`resolve_config_dir()` in `crates/espansoconfig-core/src/discovery.rs` probes and `HOME` was
overridden on both runs, so neither could resolve to it. Nothing below quotes real configuration
content; every sentence in the transcripts is either this application's own string or a synthetic
fixture's own key name.

### 1. The debt this discharges

At 2b-1 (commit `0229b14`) four **pre-existing** diagnostic strings were corrected in both
languages, because each made an absolute claim about **espanso's** behaviour that this project
cannot support — espansoConfig's parser is `saphyr-parser` and its model is its own, and neither is
espanso's:

| Key | Before (English) | After (English) |
|---|---|---|
| `parseFailed` | "**This file is not valid YAML.** Reading stopped at line {line}, column {column}." | "**espansoConfig's YAML parser could not read this file.** Reading stopped at line {line}, column {column}." |
| `fieldHasUnexpectedShape` | "The key “{key}” holds {found}, which is not the shape **espanso expects** there." | "The key “{key}” holds {found}, which is not the shape **espansoConfig's model allows** there." |
| `matchHasSeveralTriggerForms` | "This snippet declares {count} trigger forms, and **espanso expects** exactly one." | "This snippet declares {count} trigger forms, and **espansoConfig's model allows** exactly one." |
| `matchHasSeveralContentForms` | "This snippet declares {count} content fields, and **espanso expects** exactly one." | "This snippet declares {count} content fields, and **espansoConfig's model allows** exactly one." |

Eight values changed; each kept its operands and its shape and changed only the claim. **What that
did not buy was a reading.** Key parity and placeholder parity are claims about the *dictionary*;
this project's own rule is that nothing here renders a Svelte component in an automated test, so a
claim about a *screen* needs a reading of a screen. The claim went unread through 2b-2a, 2b-2b-1
and 2b-2b-2, none of which opened a window. This is that reading.

### 2. The fixture, and how each code was provoked

**Synthetic and hand-authored for this run**, in a scratch directory outside the repository, three
files under `<scratch>/xdg/espanso`. The shapes were derived from the diagnostics' **construction
sites**, not from their names:

- `match/shapes.yml` — three snippets, each malformed in exactly one way:
  - `trigger` **and** `regex` → `report_shape()` in `crates/espansoconfig-core/src/model/match_view.rs`
    raises `MatchHasSeveralTriggerForms { count: 2 }`. The rule counts **modelled** fields, so both
    have to be well-formed scalars for the conflict to be a conflict;
  - `replace` **and** `html` → the same function raises `MatchHasSeveralContentForms { count: 2 }`;
  - `vars:` holding a plain scalar → `sequence_items()` returns `None`, so `skip_shape()` in
    `crates/espansoconfig-core/src/model/project.rs` raises
    `FieldHasUnexpectedShape { key: "vars", found: Scalar }`. `vars` was chosen over
    `search_terms` because it names a *whole field* rather than one item of a list;
- `match/broken.yml` — a **byte-for-byte copy of the committed corpus fixture**
  `crates/espansoconfig-core/tests/corpus/synthetic/invalid/unclosed-quote.yml`, whose unclosed
  single-quoted scalar makes `SyntaxIndex::parse` fail, so `DocumentView::failed` raises
  `ParseFailed { line: 5, column: 13 }`;
- `config/default.yml` — a two-line neutral profile, present only so the workspace is not a
  single-file one.

**`ParseFailed` needs its own file**: a document that does not parse is never projected, so the
other three cannot coexist with it. That is why the reading walks two files rather than one.

### 3. Reading F — the four corrected diagnostics, English

One plan, one launch, `PROBE-END` printed. `heading` is the pane's own caption; each `[n]` is one
`<li>` of the diagnostics list, read as `innerText`.

```
PROBE-PLAN en
sidebar rows=4
--- en match/shapes.yml row=found
en match/shapes.yml heading=What this app noticed in this file:
en match/shapes.yml lines=3
en match/shapes.yml [0] This snippet declares 2 trigger forms, and espansoConfig’s model allows exactly one.
en match/shapes.yml [1] This snippet declares 2 content fields, and espansoConfig’s model allows exactly one.
en match/shapes.yml [2] The key “vars” holds a single value, which is not the shape espansoConfig’s model allows there.
--- en match/broken.yml row=found
en match/broken.yml heading=What this app noticed in this file:
en match/broken.yml lines=1
en match/broken.yml [0] espansoConfig’s YAML parser could not read this file. Reading stopped at line 5, column 13.
PROBE-END
```

**All four operands are interpolated and visible in the drawn text**: `count=2` twice, `key="vars"`
with `found` rendered through the `code.valueKind.*` namespace as *a single value* rather than as
the raw Rust identifier `Scalar`, and `line=5, column=13`.

### 4. Reading G — the same four in Spanish

The language was switched through the application's own picker (`#language-picker-select`) with a
**bubbling** `change` event — Svelte 5 delegates that event, and a non-bubbling one silently does
nothing, which is 1c-2b-2b-2 §6.3's lesson reused rather than relearnt. Its own launch, its own
bundle path, its own `HOME`, `PROBE-END` printed.

```
PROBE-PLAN es
sidebar rows=4
language set to es
--- es match/shapes.yml row=found
es match/shapes.yml heading=Lo que esta aplicación ha detectado en este archivo:
es match/shapes.yml lines=3
es match/shapes.yml [0] Este fragmento declara 2 formas de disparador, y el modelo de espansoConfig solo admite una.
es match/shapes.yml [1] Este fragmento declara 2 campos de contenido, y el modelo de espansoConfig solo admite uno.
es match/shapes.yml [2] La clave «vars» contiene un valor suelto, que no es la forma que admite ahí el modelo de espansoConfig.
--- es match/broken.yml row=found
es match/broken.yml heading=Lo que esta aplicación ha detectado en este archivo:
es match/broken.yml lines=1
es match/broken.yml [0] El analizador de YAML de espansoConfig no pudo leer este archivo. La lectura se detuvo en la línea 5, columna 13.
PROBE-END
```

The same four operands, the same two counts, the same line and column — and `found` localized to
*un valor suelto*, so the enum operand crosses the namespace in both languages rather than only in
English.

### 5. The judgement, string by string

The point of the exercise is not that four strings appeared. It is whether what they now say is
defensible when a user reads it. **None of the four still makes an absolute claim about espanso's
behaviour**, and each was checked against what the code behind it actually knows:

- **`parseFailed`** — *"espansoConfig's YAML parser could not read this file."* The subject is this
  application's parser, and the sentence stops there. It no longer says the file is invalid YAML,
  which was a claim about the document that espansoConfig is not entitled to make: it runs
  `saphyr-parser` 0.0.11 and espanso does not, so "our parser stopped here" and "this file is
  malformed" are different propositions. The line and column are still reported, and they are
  honest — they are where **our** reading stopped. **Defensible.** Spanish reads naturally; *"El
  analizador de YAML de espansoConfig"* stacks two `de`, but it is unambiguous and idiomatic.
- **`fieldHasUnexpectedShape`** — *"…which is not the shape espansoConfig's model allows there."*
  Scoped to the model, which is exactly what the diagnostic is raised by: `skip_shape()` fires when
  **our** projector declines a value, and espanso might well accept it. **Defensible.** Spanish:
  *"que no es la forma que admite ahí el modelo de espansoConfig"* — verb-before-subject order,
  correct and natural in Spanish, and the adverb *ahí* sits where the English *there* does.
- **`matchHasSeveralTriggerForms`** — *"…and espansoConfig's model allows exactly one."* The claim
  is about what this application models, not about what espanso would do with two trigger forms.
  **Defensible.** Spanish: *"solo admite una"*, feminine, agreeing with *formas*. Correct.
- **`matchHasSeveralContentForms`** — same shape, same verdict. **Defensible.** Spanish: *"solo
  admite uno"*, masculine, agreeing with *campos*. Correct.

**No finding.** Three observations that are not defects, recorded so they are not rediscovered:

1. **The count is never 1.** `report_shape()` raises these two only for `> 1`, so *"declares 2
   trigger forms"* can never become *"declares 1 trigger forms"*. The absence of a plural rule on
   `{count}` is safe by construction rather than by luck — but it is safe **because of the Rust
   guard**, so widening the guard would need a plural rule added at the same time.
2. **The two `MatchHasSeveral*` sentences say "This snippet" in a pane that is showing a file.**
   Reading F drew both against a file holding three snippets and neither line says which one it is
   about. That is the diagnostics surface's own shape (a file-level list, `1c-2b-1-notes.md` §2),
   not a fault in these two strings, and it is unchanged by the correction — but it is now
   *observed* rather than assumed, on a file where it actually matters.
3. **The English key says `…ContentForms` while the sentence says "content fields".** The Rust
   `FindingCode` counterpart is spelled `MatchHasSeveralContentFields`. A naming inconsistency
   between code and prose, invisible to a user and to every parity test; not touched here, because
   a reading is not the place to change a string.

### 6. What the reading is evidence of, and what it is not

**Evidence of:** that all four corrected strings have a caller that draws them, in both languages,
in a real WKWebView, with every operand interpolated and every enum operand localized — read as
element counts and as `innerText` off the live DOM. Before this run the corrected values had key
parity and placeholder parity and **no evidence of ever having been drawn at all**; two of the four
had last been seen on a screen in their *pre-correction* wording, in `1c-2b-1-notes.md` §7.3.

**Not evidence of:** pixels. It cannot see a diagnostics list painted the same colour as its
background, a `.notes` block clipped by its parent, or text that overflowed instead of wrapping.
That remains `1c-1-notes.md` hole 6.

**Also not evidence of:** that the sentences are *true of espanso*. They deliberately no longer make
that claim, which is the whole point of the correction — the reading confirms the claim was narrowed
on screen, not that the narrowed claim matches espanso's resolver. It also says nothing about the
**other** twenty-odd `code.diagnosticCode.*` strings, which were not in this phase's debt and were
not read; `fieldHasUnexpectedShape` was exercised with one of five possible `found` values
(`Scalar`), and the other four crossed no screen here.

### 7. The scaffolding, and the proof it is gone

A temporary probe: `probe_plan()` reading `ECFG_PROBE_PLAN` and `probe_say(line)` printing to
stdout, both in `src-tauri/src/main.rs` and both registered in `register()`, plus a driver appended
to `src/main.ts` that selects a sidebar row by its drawn name, reads the `.notes` block one `<li>`
at a time, and ends by printing `PROBE-END` — so a run cut short by WebKit's background-timer stall
is distinguishable from one that finished. Both runs printed it.

Both files were **copied before they were touched and restored from those copies afterwards**;
`diff` reports each identical to its copy, `git status --short --untracked-files=all` is
byte-identical to the listing taken before the run, and
`rg 'probe_plan|probe_say|PROBE-END|ECFG_PROBE' src src-tauri/src scripts crates` finds nothing.
`dist/` was rebuilt from the restored source, and the scratch tree lives outside the repository.

Re-run afterwards, all clean: `cargo test --workspace` (**927 passed, 0 failed, 21 binaries**),
`npm test` (**696 passed, 0 failed**), `npm run check` (376 files, 0 errors, 0 warnings),
`npm run build`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`.
