# Phase 1b-2b — the code dictionaries, the exhaustiveness check and the `detail` guard

> **Read section 12 first.** An adversarial review of this phase found seven defects, two of them
> High, and the fixes changed things sections 1–11 describe. Every claim below that the review
> falsified has been **rewritten in place**, so no corrected sentence stands next to its original;
> section 12 is the finding-by-finding record of what changed and why. Where a number in sections
> 1–11 differs from the one the phase originally measured, it is because the fix moved it.

Phase 1b-2a built a boundary that speaks in **codes**: nine `CommandError` codes, twenty-three
`DiagnosticCode` variants, ten badges, and no prose anywhere. This phase gives every one of those
codes a sentence in both languages, and — more importantly — makes "every one" a thing a machine
checks rather than a thing a maintainer remembers.

It builds three things:

1. **111 dictionary keys plus one generic**, in `src/lib/i18n/{en,es}.json`, covering sixteen Rust
   enumerations. (75 plus one at the first draft, over ten enumerations; the review's first finding
   added six enumerations and 33 keys, and its third added two command-error codes.)
2. **`src-tauri/src/dictionary_contract.rs`** — the exhaustiveness check, bidirectional, **parsing**
   the enum declarations out of the core's own source.
3. **`scripts/lint/ipc-detail.ts`** — the guard on the accessor that reads `classifyFailure`'s
   developer string, plus the runtime twins in `src/lib/ipc/errors.test.ts` and
   `src/lib/i18n/codes.test.ts`.

Plus **`src/lib/i18n/codes.ts`**, the typed accessor layer, whose key builders turn out to be a
*second* exhaustiveness check — a compile-time one — for the twelve enumerations the wire types
mirror, and **`src-tauri/src/rust_source.rs`**, one Rust parser shared by every contract check in
the shell.

Acceptance, after the review fix round, is `cargo test --workspace` at **544 tests** (from 514 at
1b-2a; 519 at this phase's first half, 531 with the menu) and `npm test` at **214** (from 104; 171,
then 197), `npm run check` at 0 errors and 0 warnings over 344 files, `cargo clippy --workspace
--all-targets -- -D warnings` clean, `cargo fmt --check` clean, `npm run build` clean, and
`cargo tree -p espansoconfig-core | rg tauri` finding nothing.

> **Sections 1–10 cover the first half of 1b-2b only**, and every number in them is that half's.
> The macOS menu localization — 1b-1 hole 1, which 1b-2a passed to this phase — is **section 11**,
> written by the worker who took it, and it moves both totals: 531 Rust tests and 197 frontend
> tests. Nothing in sections 1–10 is evidence about section 11's subject, or the reverse.

**There is still no user interface** *for these strings*. Nothing in the running application renders
any of them; `vite build` tree-shakes `codes.ts` out of `dist` exactly as it tree-shook the IPC layer
at 1b-2a. R32's first half is still owed and is still 1c's. What this half has is dictionaries,
checks, and the accessors 1c will call — not a screenshot. (Section 11's half *is* in `dist`, and it
was seen running; that is stated there and does not transfer here.)

---

## 1. The key-naming scheme, and why it is mechanical

**`code.<enum>.<variant>`**, where each name has its first letter lowercased and is otherwise
unchanged.

| Rust | Key |
|---|---|
| `DiagnosticCode::ParseFailed` | `code.diagnosticCode.parseFailed` |
| `CommandError::NotUtf8` | `code.commandError.notUtf8` |
| `HazardKind::MergeKey` | `code.hazardKind.mergeKey` |
| `DiscoveryError::Io` | `code.discoveryError.io` |

Three alternatives were considered and rejected.

- **A flat namespace** (`parseFailed`, `mergeKey`) collides: `RepeatedKey` and `NonScalarKey` are
  variants of **both** `DiagnosticCode` and `UnknownReason`, and they need different sentences —
  a diagnostic reports a problem, an unknown reason explains why an entry was left untouched.
  `notADirectory` is a variant of both `DiscoveryError` and `CommandError`.
- **The wire spelling as the key** (`code.identity.StaleRevision`) would put a PascalCase Rust
  identifier in a JSON key and make the key set depend on serde's tagging convention, which
  `1b-2a-notes.md` section 3 deliberately flattened away for `CommandError` and did not for the
  others. Two conventions in one namespace is one too many.
- **A hand-written map from variant to key**, which is the thing every check in this repository
  exists to avoid. `1b-2a-notes.md` section 9, hole 4 is precisely a hand-written list left in
  place; adding a second one to close it would have been comic.

The scheme is mechanical **because the check has to compute it**. `dictionary_contract.rs` derives
the expected key from the declared variant name, and `codes.ts` derives it from the TypeScript
variant name; if the formula needed a lookup table, both would need the same table and the table
would be the thing to keep in step.

### The sixteen namespaces, and why each is there

| Namespace | Variants | Why it owes strings |
|---|---:|---|
| `diagnosticCode` | 23 | `DocumentView.diagnostics` — the list 1c shows per file |
| `unknownReason` | 4 | `UnknownEntry.reason` — why an entry is shown but not modelled |
| `hazardKind` | 10 | `MatchView.blocking_hazard`, **and** the `kind` operand of `DiagnosticCode::Hazard` |
| `valueKind` | 5 | the `found` operand of five diagnostics and of `UnknownReason::UnexpectedShape` |
| `documentShape` | 3 | the `shape` operand of `ShapeDisagreesWithLocation` |
| `matchBadge` | 10 | the chips on a snippet row (plan section 8.1) |
| `commandError` | 12 | every way a command can reject |
| `workspaceError` | 5 | the core's own error, named in the brief |
| `discoveryError` | 3 | the operand of `WorkspaceError::Discovery` |
| `identityError` | 3 | the operand of `WorkspaceError::Identity` |
| `scalarStyle` | 5 | `ScalarView.style` — how a scalar is written |
| `lineEnding` | 2 | `DocumentView.line_ending` |
| `fileKind` | 3 | `DocumentView.kind` and `DocumentSummary.kind` |
| `triggerKind` | 5 | `TriggerSpec.kind` |
| `contentKind` | 7 | `ContentSpec.kind` |
| `variableKind` | 11 | `VariableView.kind` |

**Four of those were not in the brief, and each is there for the same reason.** `hazardKind`,
`valueKind`, `documentShape` and `discoveryError` are **operands of codes that were**. A message for
`DiagnosticCode::Hazard` that interpolated its `kind` operand raw would put the string `MergeKey`
into a Spanish sentence — a hardcoded English string arriving through the back door, and exactly
what CLAUDE.md section 2 forbids. Giving a code a string and not giving its operands one is giving
it half a string. `describeDiagnostic` in `codes.ts` translates the three enum-valued operand names
(`found`, `shape`, `kind`) through their own namespaces, and the test that proves it can fire is
experiment F below.

**`identityWrongDocument` has strings in both languages** (`code.commandError.identityWrongDocument`
and `code.identityError.wrongDocument`), even though `1b-2a-notes.md` section 9, hole 3 records that
no command can produce it. A code with no string is worse than a code with no caller.

**`WorkspaceError`, `DiscoveryError` and `IdentityError` never cross the Tauri boundary in their own
shape** — `CommandError` flattens all nine of their reachable conditions. Their strings exist so
that a later phase which forwards one is not the phase that discovers it has no message. That is a
deliberate cost of eleven keys, recorded rather than argued away.

### The last six, and the argument that was wrong about them

`ScalarStyle`, `LineEnding`, `FileKind`, `TriggerKind`, `ContentKind` and `VariableKind` were
originally left out, on the grounds that none of them is an operand of anything in the first ten and
that every one is a *display field of the read model* whose presentation is a decision 1c makes when
it has a layout to make it in. They were hole 3 in section 9, with 1c named.

**The review's first finding, and it is right.** That reasoning tested the wrong thing. Being an
operand is not what makes a variant owe a string; being reachable by a user is, and all six already
cross the wire as fields of the projection. A Phase 1c component meeting `trigger.kind = "Single"`
with no key has exactly three options — render the raw Rust identifier, invent a mapping no check
can see, or show nothing — and the first two are hardcoded English arriving by the back door
(CLAUDE.md section 2). *A code with no string is worse than a code with no caller* was already this
file's own rule, applied two paragraphs above to `identityWrongDocument`; the deferral was that rule
being suspended for six enumerations without noticing.

All six are now namespaces, with 33 keys, six key builders, six `describe` functions and six
reactive `t…` wrappers. Hole 3 is closed. **`describeScalarStyle` is a claim about spelling, not
about meaning** — "Written between single quotes" is a syntactic fact and D2u is untouched.

---

## 2. The dictionaries: what a message may and may not say

138 keys in each file: the ten from 1b-1, `ipc.unexpectedFailure`, the sixteen menu labels of
section 11, and the 111 code keys. (86 at the first draft, before the menu and before the review.)

**Placeholder names are the operand names the wire actually carries**, checked against
`src-tauri/src/error.rs`'s hand-written `Serialize` and `src/lib/ipc/types.ts`. So
`{document_index}` keeps its underscore, `{byte_index}` would if it were used, and the existing
placeholder-parity test in `dictionaries.test.ts` covers all of them for free.

**Not every operand is interpolated, and the omissions are the point.** Three operands are English
identifiers or opaque digests with no dictionary of their own:

| Operand | What it is | Why it is not in the sentence |
|---|---|---|
| `CommandError::Io.kind` | a `std::io::ErrorKind` variant name | `ErrorKind` is `#[non_exhaustive]` with ~40 variants; a dictionary for it would be a second, larger translation project, and it would be stale the next Rust release |
| `IdentityStaleRevision.expected`/`.found` | 64 hex characters | a digest is not information a person can act on |
| `ConfigDirNotFound.candidates` | a list of paths | rendering a list inside a sentence needs a list-formatting decision 1c owns |
| `InvalidMenuLabels.missing`/`.unexpected` | lists of wire field names | added by the review's third finding: they are the identifiers `MenuLabels`, `MENU_LABEL_FIELDS` and the `menu.` namespace share, and a user can act on none of them — a version skew is a build problem, not a configuration problem |

Each value is still in the wire object the caller holds, so nothing is lost — it is a console
concern, not a message concern. `codes.test.ts` asserts that `PermissionDenied` and a revision
digest do **not** appear in the rendered output, so this is a checked omission rather than an
untested intention. It is also hole 4.

**A path *is* interpolated.** `1b-2a-notes.md` section 7 already settled that a path is not a
translatable string — it is the operating system's name for a file, identical in both languages —
so `{path}` carries the `WirePath` rendering unchanged.

### The Spanish, and the five new exceptions

Every Spanish value is real Spanish, written for this phase. Five badge labels are nonetheless
byte-identical to their English, and each is now on the audited exception list in
`dictionaries.test.ts` with a reason:

| Key | Reason |
|---|---|
| `code.matchBadge.html` | the name of a markup format, an acronym in both languages |
| `code.matchBadge.markdown` | the name of a markup format, a proper noun in both languages |
| `code.matchBadge.variables` | the same word, spelled the same way, in both languages |
| `code.matchBadge.shell` | espanso's own term for the variable type, kept untranslated in Spanish technical usage |
| `code.matchBadge.script` | the ordinary Spanish word for this is the same loanword |

That takes the list from three entries to eight, which is a real weakening of the untranslated-value
heuristic and should be read as one. The three assertions that keep it honest are unchanged and
still apply to the new entries: a listed key whose values have **diverged** fails, and a listed key
that is not a real key fails (`1b-1-notes.md` section 3).

**Nothing here establishes that a Spanish value is Spanish.** `1b-1-notes.md` section 9, hole 9 is
untouched and now covers 75 more values than it did. Adding 75 hand-written translations to a
project with no bilingual review step widens that hole considerably, and section 9 says so.

---

## 3. The typed accessor: `src/lib/i18n/codes.ts`

A component must never build a `code.` key inline. A key assembled from a template literal in
markup is a string neither the type system nor the hardcoded-string scanner can see, which is two
checks defeated at once.

So `codes.ts` exports thirteen **key builders** and twelve **describe functions**, and `index.ts`
wraps the second twelve in reactive `tDiagnostic`, `tUnknownReason`, `tMatchBadge`, `tHazard`,
`tCommandError`, `tIpcFailure`, `tScalarStyle`, `tLineEnding`, `tFileKind`, `tTriggerKind`,
`tContentKind` and `tVariableKind` — the same two-layer shape `dictionaries.ts`/`index.ts` already
had, so nothing new reads `locale.current` outside `index.ts`. (Seven and six before the review's
first finding added the six read-model display fields.)

**The key builders are a compile-time exhaustiveness check, and this was not the plan.** The
signature is

```ts
export function matchBadgeKey(badge: MatchBadge): TranslationKey {
  return `code.matchBadge.${uncapitalize(badge)}`;
}
```

`uncapitalize` is typed `<S extends string>(value: S) => Uncapitalize<S>`, so the template literal's
*type* is `code.matchBadge.${Uncapitalize<MatchBadge>}` — a union of ten literals. `TranslationKey`
is `keyof typeof en`. If one of those ten is missing from `en.json`, the return type is not
assignable and `svelte-check` fails **in this file**, naming the key. Experiment B is that failure,
verbatim, and experiment 12F is the same failure for one of the six the review added. It covers the
twelve enumerations `types.ts` mirrors; the four it does not are covered by the Rust side only.

**One deliberate cast, and one deliberate fallback.** `uncapitalize` casts, because there is no way
to write it without one. And `memberKey()` — the untyped twin used for operands, which arrive as
JSON strings with no literal type — applies the same formula and then *checks the result against the
dictionary*, falling back to the raw value when there is no such key. An enum member this build does
not know therefore renders as its own name rather than as `undefined`. That is a fallback, not a
guarantee, and it is hole 5.

---

## 4. The exhaustiveness check: what it reads, and what it cannot see

`src-tauri/src/dictionary_contract.rs`, compiled only for tests, eight tests.

**It parses Rust.** For each of the sixteen enums it takes a file path and the enum's *name* — the
namespace is derived from that name rather than written beside it, so there is no second spelling to
disagree with the first — and `crate::rust_source` hands back the variants `syn` read out of the
declaration. That is the pattern `1b-2a-notes.md` section 12 named:
`every_declared_variant_has_an_instance_in_the_enumeration` in `error.rs` already did it for
`CommandError`, and hole 4 asked for it to be done for the rest.

**It used to scan lines, and the review's second finding is why it does not.** The first version
found the declaration header, walked lines at brace depth one and took the leading identifier of
each. Two valid ways of writing a variant defeated that — `#[cfg(feature = "x")] Variant,` with the
attribute and the variant on one line, which the scanner skipped because the line began with `#`,
and `Regex, Second,` with two variants on one line, of which it saw the first. Both leave
`VARIANT_COUNTS` unchanged, so the whole check passed with a variant that had no string. Neither is
a bug in that scanner: both are properties of deciding what a declaration is from the shape of a
line, so the line scanning went rather than being patched twice. Experiments 12A and 12B are the two
counterexamples, planted and observed firing.

**The reader is one function, in one module.** `crate::rust_source` is the only thing in the shell
that reads Rust; `error.rs`'s `declared_variants()` and `menu_contract`'s `declared_fields()` both go
through it. Two copies could disagree about what a declaration looks like, and only one of the two
would be wrong in a way anybody noticed.

**`syn` and `proc-macro2` are dev-dependencies of `src-tauri` alone.** CLAUDE.md section 3 is
untouched: `crates/espansoconfig-core/Cargo.toml` names neither, and `cargo tree -p
espansoconfig-core | rg tauri` finds nothing. `rg syn` over that tree is **not** a check and saying
so would be an over-claim that fails on its own terms — `serde_derive` is a proc-macro crate built
on `syn`, so `syn` has been in the core's graph since Phase 0.

**Reading the source rather than linking is a choice, not a workaround.** This crate depends on the
core, so it *could* have imported the enums and enumerated them with a `match`. It does not, for the
reason D2w gives: half of these enums are already matched by a hand-written sample list in
`wire_contract.rs`, and a check built from a sample list is a check against the samples. The
expectation has to come from the **declaration**.

**It is bidirectional, in three comparisons.**

1. Per namespace, against `en.json`: a declared variant with no key fails, and a key in that
   namespace naming no variant fails.
2. Over the whole `code.` key set: a key in a namespace **no enum owns** fails — which the
   per-namespace loop structurally cannot see, because it only looks at keys carrying a known
   prefix. Experiment D is that case.
3. `es.json` against `en.json`. `ExactDictionary` already makes this a TypeScript error and
   `dictionaries.test.ts` already asserts it from the files; it is here as well because a
   Rust-side change runs `cargo test`, and a maintainer who adds a variant and its English string
   should be told about the Spanish one then rather than two commands later.

Plus `no_two_variants_share_a_dictionary_key` (the formula lowercases only a first letter, so `Io`
and `IO` would collapse onto one key — one message for two failures),
`no_two_enums_share_a_namespace` (the namespace is derived from the enum's own name, so two
`MatchBadge` declarations would merge two enums' keys into one namespace and make the per-namespace
comparison meaningless), and `the_command_error_namespace_is_spelled_with_the_wire_codes`, which
pins the coincidence `commandErrorKey()` relies on: `CommandError::code()` returns
`noWorkspaceOpen`, and uncapitalising `NoWorkspaceOpen` gives the same string. A rename that broke
that would otherwise be silent.

### The third question: is every enum registered at all?

The comparisons above all take the registry as given. **The review's second finding is that this
made the module vacuous for a brand-new enum**: add one, serialize it, declare its TypeScript union,
and simply do not add it to `CODE_ENUMS` — the expected key set is unchanged and every test passes
with no keys for it. An AST parser alone does not close that, and the review says so.

Two checks now ask the question from **derived** sets rather than from a list:

- `every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code` walks
  `crates/espansoconfig-core/src` and `src-tauri/src`, collects every enum `serde` can write — a
  `Serialize` **derive** *or* a hand-written `impl Serialize`, because `CommandError` is the second
  and an audit that read derives alone would have missed the enum this boundary is built around —
  and demands that each is either a namespace or on `NOT_A_CODE` with a named reason. Four are
  excluded today (`ValueView`, `PathSegment`, `NodeKind`, `Chomping`), each with a sentence, and the
  exclusion list is checked in the other direction too so it cannot rot into a suppression list.
- `every_typescript_wire_union_has_a_namespace` reads every `export type … =` in
  `src/lib/ipc/types.ts` that has a single-quoted member and demands a namespace for it. A new wire
  enum has to be declared there for the frontend to have a type at all — `wire_contract.rs` fails if
  it is not — so this catches one by the route it actually arrives on. The mapping is the naming
  formula plus one rule, that a trailing `Name` is dropped (`DiagnosticCodeName` is the name set of
  `DiagnosticCode` and shares its namespace); that rule is the one place a genuinely new enum called
  something-`Name` could hide.

**What still escapes, with a worked example, because the review is right that this is not fully
closable by parsing.** An enum a **macro** expands to. Planting

```rust
macro_rules! wire_enum { () => { #[derive(Serialize)] pub enum DisplayMode { Compact, Roomy } }; }
wire_enum!();
```

in `crates/espansoconfig-core/src/model/document.rs` leaves **all eight** `dictionary_contract`
tests green, because `syn` sees a macro invocation and not the enum it becomes. So does an enum that
reaches a user without `serde` and without a TypeScript union. Closing the first means running the
expansion; nothing in this repository does. **That escape is not closed**, experiment 12E is the
observation, and its recorded result is "8 passed; 0 failed".

### What it cannot see, stated as limits rather than caveats

- **An item a macro produces**, as above; and an item declared inside a function body, because
  `crate::rust_source` descends into `mod` blocks and nothing else. `VARIANT_COUNTS` is still the
  non-vacuity guard: a reader that silently stopped recognising declarations fails there first, with
  a number, rather than downstream with a list of keys that merely *look* surplus.
- **A `cfg`-gated variant is now visible and counted**, which is a change of behaviour rather than a
  limit: the parser reads the declaration, not the build, so a variant compiled out on macOS would
  still be required to have a string. That is the safe direction, and there are none today.
- **Whether the sentence is right.** It checks that a key exists. It says nothing about what the
  key says, nothing about the language it is in, and nothing about whether anything renders it.
- **Whether a key is reachable.** A namespace whose describe function nobody calls passes
  everything. Today that is `workspaceError`, `discoveryError` and `identityError`, by design.
- **Anything outside the `code.` namespace.** `ipc.unexpectedFailure` and every interface string are
  the frontend's business and are typed there.

### And what a clean `npm test` still does not mean

**R31, restated because this phase is exactly the case it warns about.**
`scripts/lint/hardcoded-strings.ts` sees `.svelte` **markup** only. It cannot see `<script>` bodies,
`{'literal'}` expressions, `.ts` string constants or component props. Every string this phase wrote
outside the two JSON files lives in a `.ts` file, and **the scanner is blind to all of it**. Its
clean run is not evidence about this phase's work.

The check that this phase introduced no hardcoded user-facing string is by hand, and it is this:
every string literal in `codes.ts` is a dictionary key, a key prefix, an operand name or a namespace
name; every literal in `dictionary_contract.rs` is a file path, an enum header, a namespace or an
assertion message; every literal in `ipc-detail.ts` is a property name or a message-format fragment;
every literal in the two new test files is a Rust variant name, a synthetic path, or an assertion
message. Nothing is a sentence addressed to a person. A reviewer should re-derive that rather than
take it, because no tool in this repository can.

---

## 5. The developer-string guard

`classifyFailure()` used to return `{ kind: 'unexpected', detail }`, and its documentation has said
"developer-only, never to be rendered" since 1b-2a. Nothing enforced it. That is the project's own
standing rule — *a property asserted in a doc comment needs a test that could fail if it were false*
— violated in the file that was documenting the rule's own subject matter.

**The first fix was a name scanner, and the review's fourth finding is that a name scanner cannot
enforce this property.** `JSON.stringify(classifyFailure(x))` in a component names no guarded
identifier, so `scripts/lint/ipc-detail.ts` passed it, and it rendered the string anyway. The
counterexample is not a gap in the scanner; it is what "never rendered" means being a whole-program
property, and the scanner claiming it was the over-claim. So the guard moved into the **type**.

**Structurally, in `src/lib/ipc/errors.ts`: the string is not a property of the value.**
`IpcFailure`'s unexpected arm is `{ kind: 'unexpected' }` and nothing else. The developer string is
attached with `Object.defineProperty` under a **module-private symbol**, `enumerable: false`, and is
read only by the exported `developerDetail(failure)`. Symbol keys and non-enumerable properties are
each independently invisible to `JSON.stringify`, `Object.keys`, `Object.values`,
`Object.entries`, a spread and a `for…in` — either alone would do, and both are set because the fix
is meant to survive somebody changing one of them.

`errors.test.ts` is what makes that falsifiable rather than asserted:
`JSON.stringify(classifyFailure(…))` is pinned to the exact string `{"kind":"unexpected"}`,
`Object.keys` to `['kind']`, and every own symbol is asserted non-enumerable. **The claim the test
pins is enumerability, not the current key**, so putting the string back on the object under any
name fails. Experiment 12G is that failure: making it enumerable again broke six tests.

It also closes, in passing, hole 6's positional read — `Object.values(failure)[1]` is `undefined`
now, because there is no index 1.

**Structurally, still: `scripts/lint/ipc-detail.ts`, doing a smaller job honestly.** It masks
comments and `<style>` blocks, then reports every occurrence of the identifier `developerDetail` in
every `.ts` and `.svelte` file under `src/`. Two files are allow-listed — `src/lib/ipc/errors.ts`,
which declares it, and `src/lib/ipc/errors.test.ts`, which tests it — and the list is asserted in
four directions so it cannot become a suppression list: every entry must exist, every entry must
**actually contain** the identifier (a stale entry means a rename happened and the scanner is now
guarding a dead name), no entry may be a `.svelte` file, and every entry must carry a reason.

The rule it enforces is a claim about **imports**, which a scanner can decide: no module outside
those two may name the one accessor that can read the string. That is worth having and it is not
what keeps the string off a screen; the type is.

**The guarded name changed from `detail` to `developerDetail`, and that is hole 7 happening rather
than being predicted.** The old property no longer exists, so guarding its name would have been
guarding a dead name — and `detail` is an ordinary word again (`CustomEvent.detail` is the obvious
next user). The allow-list's honesty assertion is what would have caught it: it fails the moment a
listed file stops containing the identifier.

**Behaviourally: `codes.test.ts`.** `describeIpcFailure` is handed the two rejections a real webview
produces — Tauri's own English sentence and a thrown `Error` — and the output is asserted to contain
neither, in both locales, and to equal `translate(locale, 'ipc.unexpectedFailure')` exactly.

**And the string has a destination now, which is what makes the rule a design and not a
prohibition.** `reportIpcFailure(failure)` in `errors.ts` writes a failed command to the developer
console: a typed error as its code and operands, an unexpected one as the string
`developerDetail` holds. `src/lib/menu.ts` calls it, so the one caller that had nowhere to put a
failure now has somewhere.

**The generic key is `ipc.unexpectedFailure`**, in both languages: *"Something went wrong that this
app does not recognise. The technical details are in the developer console."* Deliberately outside
the `code.` namespace, because it names no Rust variant and the exhaustiveness check would
correctly reject it if it were inside.

Experiments C and E are the two halves failing on purpose. **Experiment C is the one to remember**:
with `{classifyFailure('boom').detail}` sitting in `AppShell.svelte`'s markup,
`hardcoded-strings.test.ts` passed all 16 of its tests. That is R31's blind spot demonstrated rather
than described, and it is the argument for `ipc-detail.ts` existing at all. (Both experiments were
run against the property-named version. Their mutations no longer apply verbatim — there is no
`.detail` to write — and 12G is the replacement, run against the code as it now stands.)

---

## 6. The disabling experiments

An oracle that cannot disagree is not an oracle. Every check this phase added was broken
deliberately, the failure recorded verbatim, and the break reverted; the suite returned to 519 Rust
and 171 frontend tests.

**All seven were executed against the code as it stood when this section was written.** Each
mutation is one edit, described precisely enough to repeat by hand, and repeating it by hand is the
intended reproduction. No mutation harness was built, for the reason 1b-2a gave.

**Two of them no longer reproduce, and saying so is the point of recording them this way.** C and E
write `failure.detail`, and there is no such property since the review's fourth finding moved the
value off the object; the line numbers in B and E are also stale. Section 12.3 carries the
replacements, run against the code as it now stands. The rows are kept because what they
*demonstrated* — R31's blind spot, and the two halves of the guard — is still true.

| # | For | What was broken | What fired |
|---|---|---|---|
| A | §4 | `"code.matchBadge.script"` deleted from `en.json` | `the_code_dictionary_is_exactly_the_declared_variants` — *"en.json, the matchBadge namespace: missing [\"code.matchBadge.script\"], and declares [] that any Rust variant does not"*, plus `the_spanish_dictionary_declares_the_same_code_keys` reporting the same key as surplus in `es.json` |
| B | §3 | the same deletion, seen by TypeScript | `npm run check` reported **3 errors**, the load-bearing one in `codes.ts` 131:3 — *"Type '…\| \"code.matchBadge.script\"' is not assignable to type '\"app.name\" \| … \| \"code.identityError.noSuchMatch\"'. Did you mean '\"code.matchBadge.form\"'?"* — which is the key builder's return type refusing to be a `TranslationKey`. The other two are `ExactDictionary` and the exception list. This is the experiment that shows the compile-time half of §3 is real |
| C | §5 | `<p>{classifyFailure('boom').detail}</p>` added to `AppShell.svelte`'s markup | `ipc-detail.test.ts` — *"src/lib/components/AppShell.svelte:22:33 names \"detail\" — `<p>{classifyFailure('boom').detail}</p>`"*. **`hardcoded-strings.test.ts` passed, 16/16**, against the same mutation. R31 demonstrated |
| D | §4 | `"code.matchBadge.renamedLastWeek"` and `"code.bogusEnum.thing"` added to `en.json` | `the_code_dictionary_is_exactly_the_declared_variants` — *"en.json, the matchBadge namespace: missing [], and declares [\"code.matchBadge.renamedLastWeek\"] that any Rust variant does not"*, and with the first removed, *"en.json, the whole code. namespace: missing [], and declares [\"code.bogusEnum.thing\"] that any Rust variant does not"*. The second is the whole-namespace comparison; the per-namespace loop cannot see it |
| E | §5 | `describeIpcFailure`'s unexpected arm changed to append `failure.detail` | **five** tests: `ipc-detail.test.ts` naming `src/lib/i18n/codes.ts:317:67`, and four in `codes.test.ts` — *"expected 'Something went wrong…' not to contain 'ACL'"* and its Spanish twin, plus both `renders the one generic key` cases. Structural and behavioural halves both |
| F | §1 | `found: 'valueKind'` removed from `ENUM_OPERAND_NAMESPACES` in `codes.ts` | **four** tests in `codes.test.ts` — *"expected 'The key “trigger” holds Sequence, whi…' not to contain 'Sequence'"* and its Spanish twin, plus the same for `describeUnknownReason`. The Rust variant name reaching a Spanish sentence, caught |
| G | §4 | a real variant, `MatchBadge::AddedWithNoString`, added to `crates/espansoconfig-core/src/model/match_view.rs` | **two** tests: `every_declaration_yields_the_variant_count_this_phase_measured` — *"left: {… \"matchBadge\": 11 …} right: {… \"matchBadge\": 10 …}"* — and `the_code_dictionary_is_exactly_the_declared_variants` — *"missing [\"code.matchBadge.addedWithNoString\"]"*. **Every test in `wire_contract` passed, 10/10**, which is `1b-2a-notes.md` hole 4 demonstrated rather than described |

**G is the one that matters**, and it is the phase's whole justification in one row: the mutation is
the real failure mode — someone adds a variant to the core — and the 1b-2a checks were blind to it
because `MatchBadge`'s Rust-side list in `wire_contract.rs` is hand-written and was simply not
updated either. Adding the variant to the core and to nothing else passed every check that existed
before this module.

---

## 7. What this phase got wrong on the way

1. **The first `assert_same_keys` said "that no Rust variant names" for a comparison that had
   nothing to do with Rust.** The `es.json`-versus-`en.json` check reused the helper, so experiment
   A produced *"es.json … declares [\"code.matchBadge.script\"] that no Rust variant names"* — which
   sends a reader to `match_view.rs` when the file to open is `en.json`. The helper now takes the
   name of the authoritative side and prints it. A failure message that names the wrong file is a
   check that costs more than it saves.
2. **The first draft of `codes.test.ts` contained two assertions that could not fail**: a loop over
   the locales asserting `typeof key === 'string'` (of a value that had just been used as a key),
   and `expect(rendered).toContain(x === rendered ? '' : '')`, which asserts that a string contains
   the empty string. Both were written while reaching for a shape and both survived a first read.
   R24's corollary applied to one's own work in progress: read the *body* and ask whether it could
   fail. They are replaced by `expectRenderable`, which checks the key is present **and** that both
   locales render something non-blank.
3. **`ipc.unexpectedFailure` was nearly put in the `code.` namespace**, where the exhaustiveness
   check would have rejected it — correctly, since it names no Rust variant. The near-miss is worth
   recording because it is the check working as intended on its author.
4. **`WorkspaceError` has five variants, not the four the brief estimated**, and `DiagnosticCode`
   has 23, not 22. Both numbers were counted from the source rather than taken; the brief said to,
   and the brief was right to.

---

## 8. Standing rules, and where this phase stands against them

- **A property asserted in a doc comment needs a test that could fail if it were false.** This
  phase's subject matter *is* an instance of that rule going unenforced since 1b-2a, and section 5
  is the fix. The new doc comments were written after their tests, not before. **The review found
  the phase committing the same offence twice more** — section 5's guard and section 11.2's posted
  closure both claimed more than any test could check — and section 12 records both corrections.
- **An audit that iterates what the implementation emitted is vacuous (D2w).** The expectation comes
  from the **declaration** in both directions: `dictionary_contract.rs` parses `enum` declarations,
  and `codes.test.ts`'s sample tables are written by hand rather than derived from `en.json` — a
  list read out of the dictionary would agree with the dictionary by construction. Those hand-written
  tables are now *checked for completeness against the wire unions at compile time*, because a
  hand-written table can also be short, which is what the review's seventh finding was.
- **An oracle must be able to disagree.** Seven experiments in section 6, nine in section 11.7, and
  eight more in section 12 — all executed, all reverted. Experiment G breaks the *engine* — a real
  enum in the core — rather than a check, and so do 12A, 12B and 12C.
- **R28 is untouched.** No `Deserialize` derive was added to any core model type; `MenuLabels` in
  the shell is a command argument, which is the one category R28 exists to admit, and after the
  review's third finding the command's *argument* is a `serde_json::Value` that the command
  deserializes itself.
- **R27 is respected in the wording.** `code.commandError.identityStaleRevision` reads *"This file
  has changed since that snippet was selected, so the selection has to be resolved again"* — it says
  the document moved on and says nothing about whether the match survived, which is the correction
  `1b-2a-notes.md` section 13 asked this phase not to undo.
- **D2u is untouched.** No message renders a scalar's inferred type; `valueKind` describes a *node
  shape* — "a list", "a set of keys" — which is a syntactic fact, not a resolved value.
- **Corpus privacy (D1).** No real configuration content anywhere. The only paths in this phase are
  `/nowhere/...` literals in test tables.

---

## 9. Coverage holes, stated as holes

1. **Nothing renders any of these strings.** 111 keys, thirteen accessors, and no component calls
   one. The dictionaries are proven complete and proven translatable; they are **not** proven
   readable, laid out, or the right length for a badge chip. **1c owns this**, and it is the same
   hole as R32's first half.
2. **The exhaustiveness check parses Rust, and a parser cannot expand a macro.** Its limits are
   enumerated in section 4 and in the module's own documentation, with a worked example of the enum
   that still escapes. `VARIANT_COUNTS` converts the worst of the rest — a reader that silently sees
   nothing — into a loud failure, but a reader that saw *nine of ten* variants of one enum would
   report a missing key rather than a parser fault, and a reader of the failure would go looking in
   the wrong place. (Before the review this hole read "reads Rust as text", and the two
   valid-syntax false negatives it hid are the review's second finding.)
3. **The set of enums the registry is checked *against* is derived; the registry itself is still a
   list.** `CODE_ENUMS` names sixteen enums and the file each is declared in, and a move that
   renamed a file would panic rather than pass — but the *reason* the list is complete is the two
   derived checks of section 4, not the list. Their residue is hole 2's macro case. (This hole
   replaces the old hole 3, "six enumerations still have no dictionary", which the review's first
   finding closed: all six now have namespaces, keys, builders, `describe` functions and reactive
   wrappers.)
4. **Four operands are deliberately not rendered** (section 2): an `ErrorKind` name, a revision
   digest, a candidate path list, and the two field-name lists of `invalidMenuLabels`. The first is
   the one with a real cost — a user seeing "The file … could not be read" is not told *why*, and
   `PermissionDenied` versus `NotFound` is exactly the distinction that would tell them. Closing it
   means either a partial `ErrorKind` dictionary with a fallback, or a second sentence built from
   the ones espanso configuration can actually produce. **Whichever phase first shows an I/O failure
   to a user owns it**; nothing does yet.
5. **`memberKey()`'s fallback is silent.** An enum member the dictionary does not know renders as
   its raw Rust name rather than as `undefined`. That is the better of the two failure modes and it
   is still a failure mode: an English identifier in a Spanish sentence, with nothing reporting it.
   The compile-time and Rust-side checks make it unreachable for the sixteen enums covered; it is
   reachable for a value that arrives from a build of the core newer than the frontend, which is not
   a configuration this project ships.
6. **The developer-string guard is a type, and the two dataflow blind spots it used to have are
   gone.** An alias and a positional read (`Object.values(failure)[1]`) reached the old `detail`
   property without writing its name; there is nothing at index 1 now and nothing enumerable to
   alias. What is left is narrower and is stated where it lives: `ipc-detail.ts` guards the
   *accessor's* name, and a re-export under another alias would defeat it —
   `ipc-detail.test.ts` pins that as an accepted blind spot, and `src/lib/ipc/index.ts` deliberately
   does not re-export the accessor.
7. **The accessor guard is spelled with a literal identifier.** If a later phase renames
   `developerDetail`, the scanner keeps guarding a dead name and passes forever. The allow-list's
   "really do name the accessor" assertion is the tripwire — it fails the moment a listed file stops
   containing the identifier — but it fires *after* the rename, not before. **This hole was realised
   during the review fix round**: the guarded name was `detail`, the property moved, and the name
   became dead. It was caught by hand rather than by the tripwire, because the same change that
   killed the property also rewrote the test.
8. **Eight keys are now on the untranslated-value exception list, up from three.** The heuristic is
   correspondingly weaker, and five of the eight are badge labels — the shortest, most visible
   strings in the interface. A bilingual reviewer would settle whether `Shell` and `Script` are
   right for a Spanish user; nothing automatable can. **The 33 keys the review added need no new
   exception**, which is why the Spanish for `variableKind.script` is "Salida de un script" rather
   than the bare loanword.
9. **Nothing establishes that any of the 111 Spanish values is Spanish.** `1b-1-notes.md` section 9,
   hole 9, now 11× larger. This phase added more untested translation than every previous phase
   combined.
10. **The comment stripper in `ipc-detail.ts` is naive.** It has no notion of a string literal, so a
    `.ts` file containing `'//'` inside a string could have a region mis-masked. The failure mode is
    a false *negative* within that region. Both `errors.ts` and every file under `src/` are clean of
    it today; the same limitation is recorded for `wire_contract.rs`'s stripper in
    `1b-2a-notes.md` hole 7.
11. **`npm run tauri build` has still never been run** — 1b-1 hole 3, unchanged, and untouched by
    this phase.

---

## 10. What 1c inherits

- **Every code has a sentence, and the accessor to render it.** `tDiagnostic`, `tUnknownReason`,
  `tMatchBadge`, `tHazard`, `tCommandError`, `tIpcFailure`, `tScalarStyle`, `tLineEnding`,
  `tFileKind`, `tTriggerKind`, `tContentKind` and `tVariableKind` are reactive and typed. A component
  should call one of those and never build a key.
- **A key that does not exist is a compile error, in the accessor file rather than at the call
  site.** Adding an enum member without its string fails `npm run check` in `codes.ts`.
- **A Rust variant that does not have a key is a `cargo test` failure**, with the key it wants
  spelled out in the message. So is a **new enum** that was never registered, unless a macro
  produced it (hole 2).
- **The developer string of an unexpected failure cannot be rendered.** It is not a property of
  `IpcFailure`: no spread, serialization, enumeration or index reaches it, and a component would have
  to import `developerDetail` by name — which fails `npm test` with the file, line and column.
  *(This bullet used to read "a component that renders it fails `npm test`", which the review showed
  to be false: `JSON.stringify(classifyFailure(x))` rendered it and every check passed.)*
- **All sixteen enumerations have strings** — the six the first draft deferred were added in the
  review fix round — and adding a seventeenth is a `CodeEnum` row, a `VARIANT_COUNTS` row, the keys,
  and a `describe`/`t` pair if it is to be rendered. Forgetting the first two is itself a test
  failure now.
- **Four operands are deliberately not in their messages** (hole 4). If 1c shows an I/O failure, it
  owns the `ErrorKind` question.
- **A failed command has a console destination**, `reportIpcFailure`, and no screen. If 1c grows a
  place to show a non-blocking failure, `menuUnavailable`, `menuBuildFailed` and `invalidMenuLabels`
  are the three codes waiting for it.
- **`"permissions": []` stands**, untouched by this half. Nothing here needs a capability.
- **The strings are unreviewed prose.** They were written by the phase that wrote the checks, in a
  language one of its readers may not speak. Holes 8 and 9.

---

## 11. The macOS menu localization (1b-2b, second half)

This section closes `1b-1-notes.md` section 9, hole 1 — *the macOS application menu is English for a
Spanish user* — the one hole 1b-1 explicitly owed here, restated in `1b-2a-notes.md` section 12 and
in `PROGRESS.md`'s next action, item 4. The reviewer's objection to shipping 1b-1 with it open is
answered rather than re-argued: the menu is now built from the same two dictionaries as every other
string in the application, and it was seen in both languages in a running window.

It is a different piece of work from sections 1–10 and shares only the dictionaries with them.
Nothing above is evidence about it, and nothing here is evidence about anything above.

### 11.1 The shape: labels cross IPC, and Rust holds none

Tauri v2 builds the macOS menu in **Rust** — `tauri::menu::Menu::default()` is installed at start-up
and its labels are muda's own English. There were exactly two ways to localize it.

- **Write the labels into `src-tauri/src/menu.rs`.** Rejected. Plan section 9 forbids Rust producing
  user-facing prose; a Spanish table in `main.rs` would be a second, unaudited string source that
  `src/lib/i18n/{en,es}.json` cannot see, that `dictionaries.test.ts` cannot compare, and — the part
  that decided it — that **no check in this repository could read**. `scripts/lint/hardcoded-strings.ts`
  sees `.svelte` markup only (R31). 1b-1's review found an English sentence in `Info.plist` that no
  check could ever have seen; a hardcoded label in `menu.rs` is the same shape with a bigger surface.
- **Send them.** Taken. `src/lib/menu.ts` translates sixteen labels and `src/lib/ipc/menu.ts` invokes
  `set_menu_labels`, the sixth and only non-read-only command on the boundary. It is the one command
  that carries strings *into* Rust, and that inversion is deliberate and confined to one file.

**The label set is one struct with no defaults.** `MenuLabels` in `src-tauri/src/menu.rs` declares
sixteen required `String` fields and is `#[serde(deny_unknown_fields)]`. A frontend that forgets one
is refused *before* the builder runs, so there is no path on which an item falls back to muda's
built-in English text — which is the runtime half of "no hardcoded string in Rust", the source half
being section 11.4's first check. Deriving `Deserialize` here does not widen the list R28 pins: that
list is about `espansoconfig-core`'s model types, whose constructors carry invariants a deserializer
would bypass. This struct is in the shell, holds sixteen plain strings, and is a command *argument* —
the one category R28 exists to admit.

**The command's argument is a `serde_json::Value`, and the struct is deserialized inside it.**
*(This paragraph replaces the original claim that the command macro's refusal was a "typed refusal".
The review's third finding is that it was not: with `labels: MenuLabels` in the signature, a
frontend one release behind was refused inside Tauri's macro, which answers with its own English
sentence —* ``invalid args `labels` for command `set_menu_labels`: missing field `quit` `` *— and no
`code` at all. Fail-fast, but prose, which plan section 9 forbids and which `1b-2a-notes.md`
section 3 had already fixed once for `WirePath`.)* `parse_labels` compares the keys that arrived
against the ones the declaration carries and answers `CommandError::InvalidMenuLabels { missing,
unexpected }`. The declared field list comes from `declared_label_fields()`, which serializes a
`MenuLabels` **struct literal** — the compiler forces that literal to be exhaustive, so the list
cannot fall behind the declaration, and a struct literal's field names are identifiers rather than
string literals, which is what lets `menu.rs` keep holding none.

**The key is the field name, unchanged.** `menu.hide_others`, not `menu.hideOthers`. The `code.`
namespace needs a formula because its keys come from Rust *variant* names, which are PascalCase; a
field name is already the spelling the wire uses, so the key is the identity of it. Three
consequences, and the third is why it was chosen: there is no formula to get wrong; the keys match the
rest of the wire, which is snake_case throughout (`relative_path`, `search_terms`, `{document_index}`);
and `menu.rs` needs no `#[serde(rename_all = …)]` attribute and therefore **no string literal at all**,
which is what lets its lint be an absolute rule rather than a rule with an allow-list.

**Three submenus, sixteen labels, and no more.** Application, Edit, Window. That is the smallest set
that keeps macOS's standard keyboard behaviour: the application submenu owns ⌘Q, the Edit submenu is
what makes ⌘X/⌘C/⌘V/⌘A reach a focused field on macOS, and the Window submenu owns ⌘M and ⌘W. A View
submenu (full screen is on the green button) and a Help submenu (there is no help book) would each be
a label group for behaviour this application does not have. **Zoom was dropped** from the Window
submenu for the same reason, and for a second one worth stating: macOS spells it "Zoom" in Spanish
too, so it would have been the ninth entry on `dictionaries.test.ts`'s untranslated-value exception
list — a list section 9, hole 8 already records as weakening. **The menu needs no exception at all:
none of the sixteen is byte-identical across the two languages**, and `menu.test.ts` asserts exactly
that rather than relying on the global heuristic.

**The application submenu's title is the package name, not a label.** macOS renders the first
submenu's title from the bundle, and the product name is a proper noun that is the same in both
languages — it is already on `1b-1-notes.md` section 8's deliberately untranslated list. It comes
from `app.package_info().name`, which is not a literal, so the no-literal rule survives it.

**Three labels interpolate `{app}`** — *About espansoConfig*, *Hide espansoConfig*, *Quit
espansoConfig* — because Spanish moves the name: *Salir de espansoConfig*. Concatenating in Rust would
have baked English word order into the builder. The existing placeholder-parity test in
`dictionaries.test.ts` covers the three for free.

### 11.2 The two decisions that were forced by measurement, not by taste

**The build is posted to the main thread.** `muda::Menu::new` panics — *"`muda::Menu` can only be
created on the main thread"* — anywhere else, because it allocates `NSMenu` objects. Tauri runs a
synchronous command on the main thread today, so building inline would usually work; "usually" is not
a property to rest an AppKit call on. `set_menu_labels` therefore calls `run_on_main_thread`.

**And it waits for the answer.** *(It did not. The original design returned as soon as the post was
accepted, and this paragraph used to say so as a stated cost: "the command answers whether the work
was accepted, not whether the menu was installed", recorded as hole 3. The review's fifth finding is
that this made `{ ok: true }` a claim nothing checked — a failure or a panic inside the closure left
Tauri's English default menu up while the caller was told the rebuild had succeeded.)*

Waiting looks like a deadlock — a task posted to the main thread, awaited by a command that may
itself be running on the main thread — and it is not, for a reason that was **read out of the
runtime rather than assumed**. `tauri_runtime_wry::send_user_message` is

```rust
if current_thread().id() == context.main_thread_id { handle_user_message(…); Ok(()) }
else { context.proxy.send_event(message)… }
```

so `run_on_main_thread` called *from* the main thread runs the closure inline and returns after the
one-shot channel has already been written. Called from anywhere else, the event loop is free to run
it. `MockRuntime` does the same thing while its loop is not running, which is why
`dispatch_check.rs` does not hang either. If the closure is dropped without running, the sender
drops, `recv` fails, and that is `MenuUnavailable` rather than a wait with no end.

Three failures are therefore distinguishable where there was one:
`CommandError::InvalidMenuLabels` (the labels are not this build's label set),
`CommandError::MenuUnavailable` (the post was refused or dropped — the event loop is gone) and
`CommandError::MenuBuildFailed` (the closure ran and AppKit refused). Adding `menuUnavailable` cost
ten mechanical edits across `error.rs`, `errors.ts`, both dictionaries and `VARIANT_COUNTS`, and
adding the other two cost the same again; **every one of them was demanded by a check the first half
had already written**, which is the best evidence available that those checks work.

The waiting step is a separate function, `menu::on_main_thread`, for one reason: nothing in libtest
can build a `muda::Menu`, so no test can observe the *real* closure failing — but a test can drive
this function with a closure of its own and assert that an `Err` becomes `MenuBuildFailed` rather
than `Ok(())`. `the_main_thread_step_reports_what_the_work_answered` in `dispatch_check.rs` is that
test, and experiment 12H is it firing.

**The locale link is a subscription, not an `$effect`.** `App.svelte` uses an `$effect` to keep
`document.documentElement.lang` in step, and the obvious thing was to add a second one. Two reasons
not to.

1. **The menu is not in the component tree.** It belongs to the application, not to a view, and it
   outlives every component. Hanging its language off a component's lifecycle is a category error.
2. **An `$effect` here could not be tested, at all.** `vite.config.ts` runs the suite with
   `environment: 'node'`, so `svelte` resolves through its `default` export condition to
   `index-server.js`, where `$effect` is a **no-op**. This was measured with a scratch module before
   any of the real code was written: a `$effect.root` wrapping a `$effect` over `locale.current` ran
   zero times across a `flushSync()` and a locale change. A menu wired that way would be a locale link
   with no test that could fail — the exact shape this project keeps finding in review.

So `LocaleState` gained `subscribe(listener)`, which notifies **only on a real change** to
`current`, and `startMenuLocalization()` in `src/lib/menu.ts` sends once immediately and again on
every change. `src/main.ts` wires it before the mount, because Tauri's English default is already on
screen by then. The completeness argument for the subscription is small and worth writing down:
`current` is `override ?? system`, `override` is written only by `setOverride`, `system` only by
`refreshSystem`, and both call `announce()`. It is hole 9 that nothing checks that argument.

**`startMenuLocalization` also consumes the result, and `main.ts` now holds no logic at all.**
*(It held a closure that dropped the returned promise — the second half of the review's third
finding: a `menuUnavailable`, or before the untyped envelope a whole version skew, was classified
and thrown away with the English default menu still on screen and nothing reported anywhere.)* The
consumption moved into `menu.ts` for a reason worth stating: `main.ts` is untested wiring by design,
so a failure path that exists only there is a failure path no test can reach. `menu.test.ts` drives
both arms — a failing send reaches the reporter, a succeeding one does not — and `main.ts` is three
references, `startMenuLocalization(locale, setMenuLabels, reportIpcFailure)`.

### 11.3 The capability decision: still `[]`, and now measured for the menu too

**Nothing was added. `"permissions": []` stands.** This was the phase `1b-1-notes.md` and
`PROGRESS.md` both predicted would need the first entry, and the prediction was wrong for a reason
worth keeping:

- A capability grants access to **plugin** commands — everything spelled `plugin:…`, `core:…`
  included. `tauri::webview`'s dispatcher access-checks a request when `plugin_command.is_some() ||
  has_app_acl_manifest || !is_local`.
- `set_menu_labels` is an **application** command. This crate publishes no ACL manifest and the
  webview's origin is local, so it is not access-checked.
- `core:menu`'s permissions — `menu:allow-new`, `menu:allow-set-as-app-menu` and the rest — are what a
  renderer that drove `@tauri-apps/api/menu` **itself** would need. **This frontend does not build
  menus.** It hands sixteen strings to Rust and Rust builds the menu.

**What granting them would have cost, stated so the choice is visible.** With `core:menu` on the
renderer, a compromised or navigated webview could construct arbitrary menus and install them as the
application menu — replacing "Quit" with an item of its own, or attaching handlers to the items a user
reaches by muscle memory. With `permissions: []` it can call one command that takes sixteen strings
and can do nothing else. The narrower grant is also the simpler code, which is not always how this
goes.

**That paragraph is an argument; `dispatch_check.rs` is the evidence**, and the standard 1b-2a set is
kept: `the_menu_command_is_registered_and_reachable_with_an_empty_capability_set` drives the real
dispatcher with the **shipped** `tauri.conf.json` and the **shipped** `capabilities/default.json`, and
`a_remote_origin_is_refused` now covers `set_menu_labels` as well as `open_workspace`, pinning the
other side (R20).

**The one thing that test cannot do, and why the assertion is shaped as it is.** It cannot dispatch a
*complete* label set, because that would build a menu. Two facts were measured rather than assumed:
libtest runs every `#[test]` on a spawned thread **even under `--test-threads=1`**, and `MockRuntime`
runs a task posted with `run_on_main_thread` **inline on the calling thread**. So no test in this
harness can reach the builder, whichever way the command posts the work. The test therefore stops one
step earlier, at label validation — which is precisely the step that separates the refusals the
dispatcher can produce:

| Condition | Answer |
|---|---|
| not registered | the string `Command set_menu_labels not found` |
| refused by the access-control list | the string `set_menu_labels not allowed. Plugin not found` |
| registered, allowed, skewed labels | `{ "code": "invalidMenuLabels", "missing": ["quit"], "unexpected": [] }` |

*(The third row read* ``invalid args `labels` for command `set_menu_labels`: missing field `quit` ``
*until the review's third finding, and the assertion beside it was `error.get("code").is_none()` —
this test pinned serde prose reaching the webview as though it were the design.)* The row is
stronger evidence than it was: an answer that is **one of our codes** could only have come from the
command's own body, so the first two rows are ruled out by construction rather than by telling three
English sentences apart. It still does **not** prove a menu exists; that is hole 1, and section 11.5
is what answers it instead.

### 11.4 The new checks: what they read, and what they cannot see

`src-tauri/src/menu_contract.rs`, compiled only for tests, eleven tests. It exists because **a
hardcoded English label in `src-tauri/src/*.rs` is invisible to every check this project had**: the
markup scan reads `.svelte` markup, `ipc-detail.ts` reads `src/`, and neither has ever opened a `.rs`
file for content.

1. **`menu.rs` contains no string literal at all.** Not "no label" — *no literal*. The file is
   **lexed** by `crate::rust_source`: comments never become tokens, attributes (doc comments
   included, since `///` is `#[doc = "…"]`) are skipped because none of them can become a menu item's
   title, and a string literal anywhere else is a failure reported with its line. An absolute rule
   needs no allow-list, and an allow-list is exactly where a label would eventually be parked. Making
   this rule absolute is the whole reason the dictionary keys are snake_case (section 11.1).

   *(It used to mask comments line by line, and the review's sixth finding is a concrete false
   negative in that: the masker blanked a whole line whenever a block comment **began** on it, even
   when the comment closed mid-line, so `*/ let title = "Edit";` slipped a hardcoded English label
   past the literal check, the field-use check and the predefined-item check at once. Experiment 12D
   is that exact line, planted and caught. The masker still exists for checks 2 and 3, which read
   code shapes rather than tokens, and for them over-masking is a false **positive** that fails
   loudly — `the_masker_is_conservative_about_a_comment_that_closes_mid_line` pins which direction
   the remaining looseness runs in.)*
2. **Every declared label is consumed exactly once** by the builder. A label that crosses the boundary
   and is dropped is a translated string that never reaches a screen, and the item wearing muda's
   English default in its place looks identical to a correct menu. Counting respects identifier
   boundaries; see section 11.6, item 2.
3. **No `PredefinedMenuItem` takes its built-in text.** `PredefinedMenuItem::copy(app, None)` compiles,
   reviews cleanly and ships the word "Copy" in every language. Every call other than `separator` must
   pass `Some(labels.…)` on its line.
4. **The field set is exactly the `menu.` namespace of `en.json`**, in both directions, **exactly the
   `menu.` namespace of `es.json`**, and **exactly `MENU_LABEL_FIELDS` in `src/lib/ipc/menu.ts`**.
   `LABEL_COUNT = 16` is the non-vacuity guard, the same device `dictionary_contract.rs` uses.
5. **What the command validates against is what the declaration says.**
   `the_validated_field_list_is_the_declared_one` compares `menu::declared_label_fields()` — the
   list `CommandError::InvalidMenuLabels` reports against — with the fields parsed out of the source.
   The struct literal behind it cannot fall *behind* the declaration, because the compiler forces it
   to be exhaustive; what it could do is answer something else entirely, if a `#[serde(rename)]` or
   a changed serializer got between them, and then the refusal would name fields the frontend has
   never heard of. This is the comparison that would fail if it did.

On the frontend, `menuLabelKey()` in `src/lib/menu.ts` is the compile-time twin of the `code.` key
builders: its return type is `` `menu.${MenuLabelField}` ``, a union of sixteen literals, and a key
missing from `en.json` makes that union unassignable to `TranslationKey` — `npm run check` then fails
**in `menu.ts`, naming the key**. Experiment D below is that failure.

**What none of it can see, as limits rather than caveats.**

- **Whether the menu is right.** Every label is supplied and used once; *which item got which label* is
  not checked, the order of the submenus is not checked, and what macOS draws is not checked. Only a
  running application answers that.
- **A menu built somewhere other than `menu.rs`.** All five checks read that one file. A second builder
  in another module would be invisible to every one of them.
- **A label assembled dynamically.** Check 2 looks for the text `labels.<field>`; a builder that
  computed field access would defeat it.
- **Checks 2 and 3 are still line-based, and still use the line masker.** Check 3 reads each
  `PredefinedMenuItem::` call as one line; `cargo fmt` keeps them on one line today, and a call long
  enough to wrap would be found not to contain `Some(labels.` on its first line, which fails
  **loudly** rather than silently. The masker's over-masking (check 1's old defect) has the same
  direction for these two: a line blanked because a comment began on it reads as an item with no
  label. The safe direction, but a false positive a maintainer would have to understand.
- **Whether a Spanish label is Spanish.** `1b-1-notes.md` section 9, hole 9, sixteen values larger.

### 11.5 R32: the menu was seen, in both languages, in a running application

**A process that stays up is not a screen that renders**, and 1b-1's blank window is on file. So this
is not a hand launch. A production-mode binary was built with

```sh
npm run build && cargo build -p espansoconfig --features custom-protocol
```

launched twice — once with `-AppleLanguages '(es-ES)'` and once with `(en-US)` — and its **menu bar
was read out of the macOS accessibility tree** with `osascript`/System Events, which reports what
AppKit actually built rather than what the source hoped for.

**This reading was redone after the review round**, against the binary that exists now: the untyped
envelope, the one-shot channel in `on_main_thread`, and `main.ts` reduced to three references. The
first reading was taken before those landed and described a slightly different program; section 12.5
recorded that gap, and this is it closed. Verbatim, from the current binary:

| Query | Answer |
|---|---|
| `name of every menu bar item of menu bar 1` (es) | `Apple, espansoconfig, Edición, Ventana` |
| items of the application submenu (es) | `Acerca de espansoConfig, missing value, Servicios, missing value, Ocultar espansoConfig, Ocultar los demás, Mostrar todo, missing value, Salir de espansoConfig` |
| items of `Edición` | `Deshacer, Rehacer, missing value, Cortar, Copiar, Pegar, Seleccionar todo, missing value, AutoFill, Start Dictation…, Emoji & Symbols` |
| items of `Ventana` | `Minimizar, missing value, Cerrar ventana, Close All` |
| `name of every menu bar item of menu bar 1` (en) | `Apple, espansoconfig, Edit, Window` |
| items of the application submenu (en) | `About espansoConfig, missing value, Services, missing value, Hide espansoConfig, Hide Others, Show All, missing value, Quit espansoConfig` |

(`missing value` is a separator, which has no name.) Every answer is byte-identical to the pre-review
reading, which is the result the review round predicted and did not have.

**What that reading proves about the code the review round wrote**, and not merely about the menu:

- the frontend's envelope **parsed** — `parse_labels` accepted sixteen fields and no others, because a
  refusal would have left Tauri's English default menu (`File, Edit, View, Window, Help`) in place;
- **`on_main_thread` did not deadlock.** This was the fix round's own stated risk: a command that may
  itself be on the main thread, waiting on a closure posted to the main thread. The menu is built, so
  the closure ran and the channel delivered. And the process was sampled while idle —
  `sample <pid> 2` puts `Thread_… DispatchQueue_1: com.apple.main-thread` in
  `__CFRunLoopServiceMachPort`, not in `recv` — so the main thread returned to its run loop rather
  than parking in the wait;
- **`Ok(())` now means a menu was installed.** Under the pre-review code the command answered before
  `build_menu` ran, so a green answer and a built menu were two different claims. The menu on screen
  is the second one.

`set_menu_labels`, `Ocultar los demás` and `Seleccionar todo` are all present in
`dist/assets/index-*.js`, so the bundle that ran is the bundle the build produced — where 1b-2a's IPC
layer was tree-shaken out of `dist` entirely.

**Two items in those answers are not ours.** `AutoFill`, `Start Dictation…`, `Emoji & Symbols` and
`Close All` are injected by AppKit into any menu it recognises as the Edit or Window menu, and it
localizes them from the **system** language rather than from ours — which is why they read English
above while everything we supplied read Spanish. That is hole 4, and it is not fixable from this side.

#### The live switch was **not** re-driven, and why that is not a regression

The pre-review reading also drove the language picker through the accessibility API and watched the
menu bar change from English to Spanish with no restart. **That step did not reproduce**, and the
reason is environmental rather than a fault in the program:

- `System Events` reports **`count of windows` = 0** for the process, and `set frontmost` and
  `NSRunningApplication.activate()` both silently fail — so there is no `window 1` to find the picker
  in. The accessibility tree exposes the app's **menu bar** perfectly well; it is the window it will
  not show.
- **The window is nonetheless there.** `CGWindowListCopyWindowInfo` reports
  `owner=espansoconfig name=espansoConfig layer=0 onscreen=true bounds=1063×685`, so this is the
  accessibility API declining to expose an unbundled binary's window, not a window that failed to
  appear.
- **The discriminating test, which needed no source change:** the *development-mode* binary — built
  without `custom-protocol`, so it loads the dead `devUrl`, never runs the frontend and never calls
  `set_menu_labels` — reports **the same `count of windows` = 0**, while showing Tauri's own default
  menu `Apple, espansoConfig, File, Edit, View, Window, Help`. A binary that never reaches this
  phase's code is equally invisible, so the menu work is not what removed the window.
- `screencapture -l<window id>` answers *"could not create image from window"*, so the screen-recording
  route to the same evidence is closed on this machine too.

The frontend half of the live switch — `state.subscribe(push)` in `startMenuLocalization` — is
**unchanged** by the review round, which touched only what happens to the returned promise, and
`menu.test.ts` drives both arms of it. So nothing observed here contradicts the earlier reading; what
is missing is a fresh observation of it. It is recorded as hole 2, whose owner is unchanged.

**What this does not establish.** It is a hand verification, run on one machine, by a person who can
read both answers. It is not in `npm test` or `cargo test`, nothing will re-run it, and — as this
round demonstrated at its own expense — it goes stale the moment the program changes. The
`invalidMenuLabels` refusal was **not** exercised in the running application either: reaching it needs
either a skewed frontend or a console in the webview, and the webview is exactly what the
accessibility API would not open. `crate::dispatch_check` covers it through the real dispatcher in
three tests instead.

### 11.6 What this half got wrong on the way

1. **`UNREGISTERED` was the bare words "not found", and the ACL refusal ends "Plugin not found".** The
   disabling experiment for the capability test (experiment G) reported *"set_menu_labels is not
   registered: `set_menu_labels not allowed. Plugin not found`"* — a check firing on the right input
   and naming the wrong cause, which sends a reader to `main.rs` when the file to open is
   `capabilities/default.json`. The needle is now the whole phrase `Command <name> not found`, and the
   access-control assertion is tested **first**. This is the second time in one phase that a failure
   message named the wrong file; section 7, item 1 was the first.
2. **`labels.hide` is a prefix of `labels.hide_others`.** The first version of check 2 counted
   substrings, so `hide` would have been reported as used twice and a genuinely unused label could
   have passed. `count_field_uses()` requires an identifier boundary, and
   `the_use_counter_respects_identifier_boundaries` is the test that would fail if it were removed.
3. **The `$effect` route was taken first and abandoned after measurement.** Two scratch files, a
   `.svelte.ts` module with `$effect.root` and a test that changed the locale: the effect ran **zero**
   times, because `environment: 'node'` resolves `svelte` to its server build. The lesson is not about
   effects; it is that "idiomatic" was about to buy an untestable link in the one place the phase's
   acceptance criterion lives.
4. **`run_on_main_thread` was expected to make the dispatcher test reach an `Ok`.** It does not:
   `MockRuntime` runs the posted task inline, so the first version of the menu dispatch test panicked
   inside muda exactly as an inline build would have. The design survived on its own merits — it is
   the right thing in production regardless of the calling thread — but the *test* it was partly
   chosen for had to be rewritten around a refusal instead.
5. **Two assertions said "the field scan is not reading" for a failure whose real cause was a new
   field.** Found by experiment C, whose output said the scanner was broken when a label had simply
   been added. Both messages now name both possibilities and point at the test that distinguishes them.

### 11.7 The disabling experiments

Every check this half added was broken deliberately, the failure recorded verbatim, and the break
reverted. All nine were executed against the code as it stood when this section was written; each
mutation is one edit, described precisely enough to repeat by hand, and repeating it by hand is the
intended reproduction.

**They were run before the review fix round**, so every line number in the table predates it. F and
G still fire with the messages recorded, because the assertions they trip are checked before the
code assertion the review's third finding changed; what that finding replaced is the *third*
assertion of the same test, and section 12.3's 12K is the experiment for it.

| # | For | What was broken | What fired |
|---|---|---|---|
| A | 11.4 checks 1–3 | `Some(labels.quit.as_str())` in `menu.rs` replaced with `Some("Salir de espansoConfig")` — a hardcoded label, in the right language, in the right place | **three** tests. `the_menu_source_contains_no_string_literal` — *"src-tauri/src/menu.rs must hold no string literal — every label comes from the dictionaries:\n src-tauri/src/menu.rs:139: &PredefinedMenuItem::quit(app, Some(\"Salir de espansoConfig\"))?,"*; `no_predefined_item_falls_back_to_its_built_in_text` — *"PredefinedMenuItem::quit is built without a label from the dictionary"*; and `every_label_is_used_exactly_once_by_the_builder` — *"labels.quit is used 0 times in src-tauri/src/menu.rs"* |
| B | 11.4 check 2 | `Some(labels.paste.as_str())` changed to `Some(labels.copy.as_str())` — the copy-paste bug that ships a menu with two "Copy" items and that no compiler can see | `every_label_is_used_exactly_once_by_the_builder` — *"assertion `left == right` failed: labels.copy is used 2 times in src-tauri/src/menu.rs; every label is supplied to exactly one item — left: 2, right: 1"* |
| C | 11.4 check 4 | **the engine, not a check**: `pub zoom: String` added to `MenuLabels` in `menu.rs` and to nothing else | **four** tests. `the_label_declaration_yields_the_field_count_this_phase_built` — *"the MenuLabels declaration and the count this module pins disagree — left: 17, right: 16"*; `the_frontend_declares_exactly_the_label_fields` — *"MENU_LABEL_FIELDS in src/lib/ipc/menu.ts: missing [\"zoom\"], and declares [] that any MenuLabels field does not"*; plus `every_label_is_used_exactly_once_by_the_builder` and `the_menu_namespace_is_exactly_the_declared_label_fields` on the count |
| D | 11.4 check 4, and the compile-time twin | `"menu.select_all"` deleted from `en.json` | `the_menu_namespace_is_exactly_the_declared_label_fields` — *"en.json, the menu namespace: missing [\"menu.select_all\"], and declares [] that any MenuLabels field does not"* — and `the_spanish_dictionary_declares_the_same_menu_keys` reporting it surplus in `es.json`. **And `npm run check` reported 2 errors**, the load-bearing one in `src/lib/menu.ts` 48:3 — *"Type '\"menu.about\" \| … \| \"menu.select_all\"' is not assignable to type '\"app.name\" \| … \| \"code.identityError.noSuchMatch\"'"* — which is `menuLabelKey`'s return type refusing to be a `TranslationKey` |
| E | 11.4 check 4 | `'select_all'` deleted from `MENU_LABEL_FIELDS` in `src/lib/ipc/menu.ts` | `the_frontend_declares_exactly_the_label_fields` — *"MENU_LABEL_FIELDS in src/lib/ipc/menu.ts: missing [\"select_all\"], and declares [] that any MenuLabels field does not"* — and `npm test`, *"expected [ 'about', 'services', 'hide', …(12) ] to have a length of 16 but got 15"* |
| F | 11.3 | `menu::set_menu_labels` removed from `generate_handler!` in `main.rs` | **two** tests. `dispatch_check::the_menu_command_is_registered_and_reachable_with_an_empty_capability_set` — *"set_menu_labels is not registered: \"Command set_menu_labels not found\""* — and `wire_contract::the_registered_commands_are_the_read_only_five_and_the_menu_command` — *"the registered commands: TypeScript is missing [] and declares [\"set_menu_labels\"] that Rust never writes"* |
| G | 11.3, the capability assertion itself | `LOCAL_ORIGIN` in `dispatch_check.rs` pointed at `https://an-unrelated-site.example`, so the access-control list really does refuse | `the_menu_command_is_registered_and_reachable_with_an_empty_capability_set` — *"the empty capability set blocked set_menu_labels, so it needs a permission after all: \"set_menu_labels not allowed. Plugin not found\""*. **This experiment is the one that found defect 1 in section 11.6**: before the fix it fired with *"set_menu_labels is not registered"*, naming the wrong cause |
| H | 11.2, the locale link | `announce()` removed from `setOverride` in `locale.svelte.ts` | **four** tests. `menu.test.ts` — *"expected [ 'Quit espansoConfig' ] to deeply equal [ 'Quit espansoConfig', …(1) ]"*, the missing member being `'Salir de espansoConfig'` — and three in `locale.store.test.ts` |
| I | the untranslated-label claim | `"menu.minimize"` in `es.json` set to `"Minimize"` | **two** tests. `menu.test.ts` — *"expected [ 'minimize' ] to deeply equal []"* — and `dictionaries.test.ts`'s global heuristic — *"expected [ 'menu.minimize' ] to deeply equal []"* |

**C is the one that matters.** It is the real failure mode — somebody adds a label to the Rust struct
— and it breaks the *engine* rather than a check. Four tests name the missing field, in both files
that owe it something.

### 11.8 Coverage holes, stated as holes

1. **No automated test ever builds a menu.** `muda::Menu` needs the process's main thread; libtest
   never provides one. Closing this needs a main-thread harness, and a main-thread harness needs an
   integration-test target, and an integration-test target needs `src-tauri` to have a **library**
   target — it is a binary crate today, and `generate_context!` may be expanded only once per crate.
   That is a real refactor with a real risk to the "the tested application is the shipped
   application" property, and it was not worth taking for one test. **Unowned by design**; whichever
   phase first needs a second Rust-side menu behaviour should reconsider it, and section 11.5 is the
   verification standing in for it today.
2. **Section 11.5's verification is by hand, and it has already gone stale once.** One machine, one
   person, and it is not in `npm test` or `cargo test`. The review round changed the command and
   left the reading describing a program that no longer existed; it was redone, which is the proof
   that this hole costs something rather than being a formality. **Two things now sit inside it.**
   The two-language reading is current. The **live language switch is not**: re-driving the picker
   needs the window's accessibility tree, and `System Events` reports `count of windows` = 0 for this
   unbundled binary while `CGWindowListCopyWindowInfo` shows the window on screen — a *development*-mode
   binary that never calls `set_menu_labels` reports the same 0, so nothing in this phase's code is
   implicated. An AppleScript harness would be automatable and is not written, and it would need a
   bundled `.app` (hole 10) to have a window it could reach. **1c owns it**, because 1c is the phase
   with a screen worth asserting about and will need the same apparatus.
3. **~~A failure inside the posted closure is unreportable.~~ Closed by the review's fifth finding.**
   It read: *"`set_menu_labels` answers whether the work was accepted. If `Menu::with_items` or
   `set_menu` failed on the main thread, the previous menu — Tauri's English default, on the first
   call — stays and nobody is told."* The command now waits on a one-shot channel and answers
   `MenuBuildFailed`, which is a distinct code with its own sentence in both dictionaries;
   `startMenuLocalization` reports it. What is **still** true is the narrower version: nothing in
   `cargo test` can make the real closure fail, because no test can build a menu (hole 1), so what a
   test observes is `menu::on_main_thread`'s contract rather than muda's behaviour.
4. **macOS injects its own items into the Edit and Window menus** and localizes them from the *system*
   language, not ours: `AutoFill`, `Start Dictation…`, `Emoji & Symbols`, `Close All`. A user running
   macOS in English with this app in Spanish sees four English items among sixteen Spanish ones. It is
   not reachable from this side — AppKit adds them after the menu is installed. **Nobody owns it**
   because nobody can; it is recorded so it is not rediscovered as a bug.
5. **There is a window at start-up where the menu is Tauri's English default.** `main.ts` sends the
   labels before mounting the interface, which is the earliest the boundary allows, but "earliest" is
   not "before the menu bar is drawn". A frontend that failed to load would leave the English menu in
   place permanently — and would leave a blank window too, so it is not the failure a user would
   report. Closing it properly means Rust knowing the locale, which means a second negotiation that
   could disagree with the frontend's. **Not owned; recorded as the cost of the chosen shape.**
6. **Nothing establishes that the sixteen Spanish labels are Spanish.** They were written from macOS
   convention by the phase that wrote the checks. `1b-1-notes.md` section 9, hole 9, unchanged and
   larger. A bilingual reviewer is the only thing that closes it.
7. **`menu_contract` reads one file.** Every check is scoped to `src-tauri/src/menu.rs`. A menu built
   in a second module, or a label assembled dynamically, is invisible to all five. The file is small
   and there is one builder today; that is a property of today.
8. **The three menu codes have strings and no *screen*.** `menuUnavailable`, `menuBuildFailed` and
   `invalidMenuLabels` reach `reportIpcFailure`, which writes them to the developer console; nothing
   in the interface shows them. *(This hole read "has a string and no renderer" and described
   `main.ts` firing the command and dropping the result, which was the second half of the review's
   third finding rather than a deliberate choice. The result is consumed now, in
   `startMenuLocalization`, where a test can see it.)* **1c owns the screen half** if it ever grows a
   place to show a non-blocking failure.
9. **`LocaleState` now has two reactivity mechanisms.** Components read `current` through Svelte's
   runes; the menu reads it through `subscribe`. They cannot disagree today, because `current` is
   derived from two fields written in exactly two methods and both call `announce()`. **Nothing checks
   that argument**, and a third writer added later would break the menu link and no test would notice.
   A check that reads `locale.svelte.ts` and asserts every assignment to `system`/`override` is
   followed by `announce()` is the obvious closure, and it was judged more machinery than the risk
   warrants at two call sites.
10. **`npm run tauri build` has still never been run** — 1b-1 hole 3, unchanged. What section 11.5 ran
    is a `cargo build --features custom-protocol` binary, not a bundled `.app`, so the `Info.plist`
    merge and `CFBundleLocalizations` remain untested end to end. **Phase 5 owns it** (plan section 10).

---

## 12. The review disposition

`docs/reviews/phase-1b-2b-dictionaries-and-menu.md` attacked this phase and found seven defects —
two High, four Medium, one Low. **All seven were real and all seven are fixed**; one of them
(finding 2's third escape) is fixed as far as parsing can fix it, with the residue stated and
demonstrated rather than claimed closed. The phase's own standing rule is that no commit holds a
demonstrated defect, and the review found several claims in sections 1–11 that outran their code.
**Those claims were rewritten in place, not softened beside their originals**; this section says what
each one was.

### 12.1 Finding by finding

| # | Severity | Real defect? | What changed | Which test now fails without it |
|---|---|---|---|---|
| 1 | High | **Yes.** `ScalarStyle`, `LineEnding`, `FileKind`, `TriggerKind`, `ContentKind` and `VariableKind` cross the wire as fields of the projection with no strings and no accessors. Deferring them to 1c meant 1c would render a raw Rust identifier or invent an unchecked mapping | Six `CODE_ENUMS` and `VARIANT_COUNTS` rows, 33 keys in each dictionary, six key builders and six `describe` functions in `codes.ts`, six reactive wrappers in `index.ts`, six sample tables in `codes.test.ts`. Section 1's "what was deliberately left out" is rewritten as the argument that was wrong. Hole 3 is closed | `dictionary_contract::the_code_dictionary_is_exactly_the_declared_variants`, `npm run check` in `codes.ts`, and `codes.test.ts`'s two new cases (12F) |
| 2 | High | **Yes, three times.** The variant scanner missed `#[cfg(…)] Variant,` and `A, B,` on one line, and nothing at all asked whether a *new* enum had been registered | `crate::rust_source` parses with `syn` and lexes with `proc-macro2`; `dictionary_contract` gained two derived checks — every `Serialize`-carrying enum in both source trees, and every string-literal union in `types.ts`. `syn`/`proc-macro2` are dev-dependencies of `src-tauri` only | 12A, 12B, 12C. **12E is the escape that remains**, and it is recorded as open |
| 3 | Medium | **Yes.** A 15-field frontend against a 16-field Rust side was refused inside Tauri's command macro, in English, with no `code`; `main.ts` then discarded the result | The command takes a `serde_json::Value` and validates it itself, answering `CommandError::InvalidMenuLabels { missing, unexpected }`. `startMenuLocalization` consumes the result and `main.ts` holds no logic | `dispatch_check`'s three menu tests (12K), `menu.test.ts`'s "reports a rebuild that failed" (12I) |
| 4 | Medium | **Yes.** `JSON.stringify(classifyFailure(x))` names no guarded identifier and rendered the string | The developer string left `IpcFailure` entirely: non-enumerable, symbol-keyed, read only by `developerDetail()`, with `reportIpcFailure()` as its destination. The scanner now guards the accessor's name and claims only what a scanner can decide | `errors.test.ts`'s "the developer string of an unexpected failure" suite (12G) |
| 5 | Medium | **Yes.** The command answered `{ ok: true }` before `build_menu`/`set_menu` ran | `menu::on_main_thread` posts, waits on a one-shot channel and answers `MenuBuildFailed` when the work failed. Waiting cannot deadlock, and the runtime source that says so is quoted in section 11.2 | `dispatch_check::the_main_thread_step_reports_what_the_work_answered` (12H) |
| 6 | Medium | **Yes.** `*/ let title = "Edit";` slipped a hardcoded English label past every menu check | Check 1 lexes instead of masking. The masker survives for checks 2 and 3, where over-masking is a false positive, and a test pins that direction | `menu_contract::the_menu_source_contains_no_string_literal` (12D) |
| 7 | Low | **Yes.** Nine samples pinned against ten variants, so `describeCommandError('menuUnavailable')` could have returned `''` | `COMMAND_ERRORS` covers all twelve codes, is asserted **bidirectionally** against `COMMAND_ERROR_CODES` at run time, and every sample table in the file is now checked for completeness against its wire union **at compile time** | `codes.test.ts`'s "cover exactly the command error codes" and `npm run check` (12J) |

### 12.2 The other hand-written counts, checked for the same shape

Finding 7 is R24's corollary — read a test's *name*, then its *body*, and ask whether the body could
fail if the name's claim were false — so the rest of the suite was read for it.

- **`codes.test.ts`'s six other sample tables** had exactly the same shape: `HAZARD_KINDS` and the
  rest were typed `readonly HazardKind[]`, which admits a *short* list, and the count beside them was
  written by the same hand. They are now `as const satisfies readonly HazardKind[]`, plus a
  `ExpectNever<Missing<Union, typeof TABLE>>` alias per table: a member added to a wire union and not
  to the table is a `npm run check` failure **naming the member**. Twelve tables, twelve aliases.
- **`wire_contract.rs`'s Rust-side variant lists** for the six enums of finding 1 had the same shape
  and no tripwire — `1b-2a-notes.md` hole 4. Finding 1's fix closes it for all six as a side effect:
  a variant added to `VariableKind` and to nothing else now fails
  `every_declaration_yields_the_variant_count_this_phase_measured` with a number, exactly as
  experiment G did for `MatchBadge`.
- **`MENU_LABEL_FIELDS`' `toHaveLength(16)`**, **`LABEL_COUNT`**, **`DICTIONARY_FILES.length`** and
  the `toHaveLength(1)` assertions in the three lint test files are *not* the same shape: the first
  three are anchored bidirectionally against a declaration, and the last are counts of findings in a
  synthetic two-line fixture whose answer is known.

### 12.3 The disabling experiments for this round

Every fix was broken deliberately, the failure recorded verbatim, and the break reverted. All eleven
were executed against the code as it now stands. **12E is the one that did not fire, and it is
recorded because it did not.**

| # | For | What was broken | What fired |
|---|---|---|---|
| 12A | finding 2, escape 1 | `#[cfg(feature = "x")] AddedWithNoString,` added to `MatchBadge` in the core, attribute and variant on **one line** | **two** tests. `every_declaration_yields_the_variant_count_this_phase_measured` — *"assertion `left == right` failed: the enum declarations and the counts this module pins disagree"*, with `"matchBadge": 11` against `"matchBadge": 10` — and `the_code_dictionary_is_exactly_the_declared_variants` — *"en.json, the matchBadge namespace: missing [\"code.matchBadge.addedWithNoString\"], and declares [] that any Rust variant does not"* |
| 12B | finding 2, escape 2 | `Regex, /** … */ AddedWithNoString,` — **two variants on one line** | the same two tests, with the same two messages. (The first attempt, `Regex, AddedWithNoString,` with no doc comment, did not reach them: `#![deny(missing_docs)]` in the core refused to compile it. That is a second line of defence and not the one under test, so the mutation was rewritten to carry an inline doc comment) |
| 12C | finding 2, escape 3, both derived checks | a real `#[derive(Serialize)] pub enum DisplayMode` added to `crates/espansoconfig-core/src/model/document.rs` and to nothing else; then, separately, `export type DisplayMode = 'Compact' \| 'Roomy';` added to `src/lib/ipc/types.ts` and to nothing else | `every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code` — *"these enums are serialized and owe a dictionary namespace, or a named reason in NOT_A_CODE: [\"DisplayMode\"]"* — and, for the second half, `every_typescript_wire_union_has_a_namespace` — *"src/lib/ipc/types.ts declares the wire enum DisplayMode, whose members can reach a screen, and no CODE_ENUMS entry owns the displayMode namespace"* |
| 12D | finding 6 | `/* a comment that runs\n over two lines */ let title = "Edit";` inserted at the top of `build_menu` in `menu.rs` — the review's line, verbatim | `the_menu_source_contains_no_string_literal` — *"src-tauri/src/menu.rs must hold no string literal — every label comes from the dictionaries:\nsrc-tauri/src/menu.rs:215: \"Edit\""* |
| **12E** | finding 2, escape 3, **the residue** | the same `DisplayMode` enum, produced by a `macro_rules!` invocation instead of written out | **nothing.** `test result: ok. 8 passed; 0 failed` — every `dictionary_contract` test green. `syn` sees a macro invocation, not the enum it expands to. **This escape still works**, it is hole 2, and it is the honest limit of a parser |
| 12F | finding 1, both halves | `"code.triggerKind.single"` deleted from `en.json` | `the_code_dictionary_is_exactly_the_declared_variants` — *"en.json, the triggerKind namespace: missing [\"code.triggerKind.single\"], and declares [] that any Rust variant does not"* — `the_spanish_dictionary_declares_the_same_code_keys` reporting it surplus in `es.json`, **and `npm run check` with 2 errors**, the load-bearing one in `codes.ts` 197:3, `triggerKindKey`'s return type refusing to be a `TranslationKey` and suggesting `"code.triggerKind.regex"` |
| 12G | finding 4 | `enumerable: false` changed to `true` on the symbol property, and a second `note` property added beside it — the shape a refactor would have | **six** tests in `errors.test.ts`. *"expected '{\"kind\":\"unexpected\",\"note\":\"Command …' to be '{\"kind\":\"unexpected\"}'"*, *"expected [ 'kind', 'note' ] to deeply equal [ 'kind' ]"*, and four more. The symbol half was caught too, by `toEqual` reporting `Symbol(espansoconfig.ipc.developerDetail)` |
| 12H | finding 5 | `match receiver.recv()` in `menu::on_main_thread` replaced with `let _ = receiver.recv(); Ok(())` — the original behaviour, reported as success | `dispatch_check::the_main_thread_step_reports_what_the_work_answered` — *"assertion `left == right` failed: work that answered Err must not be reported as a menu that was installed — left: Ok(()), right: Err(MenuBuildFailed)"* |
| 12I | finding 3, second half | the `.then(…)` dropped from `startMenuLocalization`, so the send is fired and forgotten | `menu.test.ts` — *"reports a rebuild that failed instead of dropping it: expected [] to deeply equal [ Array(1) ]"* |
| 12J | finding 7 | `{ code: 'menuBuildFailed' }` deleted from `COMMAND_ERRORS` | `npm run check` — *"Type '\"menuBuildFailed\"' does not satisfy the constraint 'never'."* at `codes.test.ts` 322:3 — **and** two `npm test` cases, the count and *"cover exactly the command error codes, in both directions"* |
| 12K | finding 3, first half | the command's signature changed back to `labels: MenuLabels` | **three** `dispatch_check` tests, each reporting the review's defect verbatim: *"a version skew must be one of our codes, never the macro's English prose: \"invalid args `labels` for command `set_menu_labels`: missing field `quit`\""*, and its twins for an unknown field and for a non-object envelope |

**12C and 12E are the pair to remember.** They are the same enum, added the same way, differing only
in whether a macro wrote it — and one is caught while the other is not. That is the exact shape of
what a parser can and cannot decide, and it is why the third escape is recorded as narrowed rather
than closed.

### 12.4 What was left alone, and why

- **The capability decision.** `"permissions": []` stands. The review found it correct for this
  configuration, and nothing in these fixes needs a permission: the menu command is still an
  application command, still not access-checked from a local origin, and `core:default` is still
  gone. `a_remote_origin_is_refused` still pins the other side.
- **The architecture rule.** `syn` and `proc-macro2` are dev-dependencies of `src-tauri` alone.
  `cargo tree -p espansoconfig-core | rg tauri` finds nothing, and
  `crates/espansoconfig-core/Cargo.toml` names neither. `rg syn` over that tree is **not** the check
  and never was — `serde_derive` is a proc-macro crate built on `syn`.
- **D2u, R27, R28, corpus privacy.** Untouched. The 33 new keys describe node shapes, file kinds and
  written styles; none resolves a scalar's value. Every path in the new tests is `/nowhere/…`, and
  the only enum names in them are synthetic (`AddedWithNoString`, `DisplayMode`,
  `renamed_last_week`).

### 12.5 What this round could not verify

- **The menu was not re-launched — closed afterwards, in part.** This round left section 11.5's
  accessibility-tree reading describing the pre-review binary. It has since been **redone against the
  post-review binary**, and section 11.5 is rewritten around that reading: both languages come back
  byte-identical, the untyped envelope parses, and `on_main_thread`'s wait does not deadlock — the
  main thread was sampled idle in `__CFRunLoopServiceMachPort` rather than parked in `recv`. So the
  stale-evidence gap this bullet recorded is closed **for the two-language reading**.

  **It is not closed for the live switch.** Re-driving the language picker needs the window's
  accessibility tree, and `System Events` now reports `count of windows` = 0 for this process while
  `CGWindowListCopyWindowInfo` shows the window present and on screen. That is the accessibility API
  declining to expose an unbundled binary's window, not a window that failed to appear: the
  **development-mode** binary, which never runs the frontend and never calls `set_menu_labels`,
  reports the same 0 windows. So no regression is implicated, and no fresh observation of the live
  switch exists. It stays **hole 2**, owner unchanged (1c), and the honest summary is that this
  project's only route to that evidence is a bundled `.app` plus a screen-recording grant — which is
  hole 10's territory (Phase 5).
- **`invalidMenuLabels` was never produced by a running application.** The three
  `crate::dispatch_check` tests drive it through the real dispatcher, which is the strongest thing
  this harness can do; reaching it in the window would need a skewed frontend or a webview console,
  and the webview is what the accessibility API would not open.
- **`MenuBuildFailed` has never been produced by muda.** It exists so that tomorrow's failure is not
  silent; what a test observes is `on_main_thread`'s contract, not AppKit's behaviour.
- **The Spanish of the 33 new keys is unreviewed**, like the 78 before them. Hole 9.
