# Phase 1b-2a — the read-only IPC surface and the typed frontend boundary

Phase 1b-2a is the first commit in which the frontend and the core can speak. It builds three
things and deliberately stops there:

1. **`src-tauri/src/commands.rs`** — plan §6.4's five **read-only** commands, each a one-line
   wrapper over a `WorkspaceSession` method, each of those one call into `crate::workspace`.
2. **`src-tauri/src/error.rs`** — `CommandError`, the wire error: a stable machine code plus
   structured operands, with **no `Display` impl at all**.
3. **`src/lib/ipc/`** — the hand-written TypeScript mirror of what `serde` writes, a typed `invoke`
   wrapper that returns a result rather than throwing, and the classification that keeps
   `identityStaleRevision` distinct from every other failure (R27).

**Out of scope, deliberately not started:** every mutating command (`save_match`, `create_match`,
`delete_match`, `move_match`, `save_raw_document`, `validate_match` — Phase 2, and the save
transaction they need does not exist); the Rust-code→string dictionaries and the localized macOS
menu (Phase **1b-2b**); events and watching; the router, the three-pane layout and the browser
(Phase 1c).

Acceptance is `cargo test --workspace` at **514 tests** and `npm test` at **104**, `npm run check` at
0 errors and 0 warnings over 336 files, `cargo clippy --workspace --all-targets -- -D warnings`
clean, `cargo fmt --check` clean, and `cargo tree -p espansoconfig-core | rg tauri` finding nothing.

> **The phase was reviewed and held open.** `docs/reviews/phase-1b-2a-ipc-surface.md` raised ten
> findings, two of them High, and several were instances of the project's own standing rules. The
> fix round is §15 below, and it changed code as well as prose: the counts above are the ones after
> it (from 500 Rust and 97 frontend), and **every section of this document that the review found
> false has been corrected in place rather than annotated**. Where a sentence used to say something
> untrue, the correction says so explicitly, because a decision record that quietly rewrites itself
> is worth less than one that shows what it got wrong.

**There is no user interface in this commit.** Not one component changed, and nothing in the running
application calls `invoke` yet. That is why §5's capability claim is settled by a test through the
real dispatcher rather than by a screenshot: `PROGRESS.md` R32 says a process that stays up is not a
screen that renders, and this phase has nothing rendered to show.

---

## 1. What crosses the boundary, and what deliberately does not

`DocumentView` crosses; `SourceDocument` does not, and Phase 1a made that choice on purpose — the
frontend has no use for a `SyntaxIndex` arena and a `TriviaIndex`. So the five commands hand over
exactly what plan §6.4 lists:

| Command | Wraps | Returns |
|---|---|---|
| `open_workspace(root)` | `Workspace::discover` | `WorkspaceSummary` |
| `list_documents()` | `Workspace::list_documents` | `Vec<DocumentSummary>` |
| `get_document(id)` | `Workspace::document_view` | `DocumentView` |
| `get_match(id)` | `Workspace::get_match` | `MatchView` |
| `reload_document(id)` | `Workspace::refresh` | `DocumentView` |

Two absences are decisions rather than omissions:

- **No `get_document_text`.** `Workspace::document_text` exists and the raw YAML pane will need it,
  but the raw pane is 1c and a command with no caller is a command with no test. 1c adds it.
- **No mutating command of any kind.** The module documentation names all six by name so that a
  later reader sees the omission as deliberate. A command that writes a file must not appear before
  the save transaction does.

`open_workspace` **replaces** the session's workspace only on success. A failure leaves whatever was
open in place, so a mistyped directory does not empty the window.

## 2. Five synchronous commands, and the mutex that made the choice

`Workspace` takes `&mut self` where it populates the cache, so the Tauri layer holds it behind a
`std::sync::Mutex` — which Phase 1a's notes predicted it would need regardless.

The commands are **synchronous**, and that is the whole of the reason. Tauri runs a command written
without `async` on the main thread and an `async` one on its own runtime; an `async` command here
would have to hold the `MutexGuard` across an `.await` to keep the borrow of the cached
`DocumentView` alive, which is precisely the shape a `std::sync` guard must not take. The
alternatives were an async-aware mutex (a dependency and a lifetime problem this phase does not
have) or cloning out under the guard and awaiting after (which is what the synchronous version does,
minus the await). The cost is that a command blocks the main thread while it runs: one parse of one
file, on the first look at it. **When Phase 2 edits on a debounce that trade should be re-examined
rather than inherited**, and the module documentation says so where someone changing it will read it.

**A poisoned lock is absorbed, not reported.** `PoisonError::into_inner`, as `crate::workspace`
already does for its own identity table. What sits behind the lock is a cache over the disk, every
mutation of it is a single infallible assignment, and the recovery for anything genuinely wrong is
`reload_document`. Refusing every later command because an earlier one panicked would turn one
failed read into a dead window. There is deliberately no `statePoisoned` code — an error variant
nothing can usefully act on is a dictionary entry nobody can write.

## 3. The error representation: codes and operands, with one spelling

Plan §9 says Rust returns codes and structured data, never prose. `CommandError` is that rule as a
type: nine variants, each serializing as `{ "code": …, … operands }` where every operand is a path,
a number or another code.

**Three decisions, each of which could have gone the other way.**

1. **The wire error is defined in the Tauri layer, not forwarded from the core.** `WorkspaceError`,
   `DiscoveryError` and `IdentityError` already serialize as codes and operands, and forwarding them
   would have been less code. Two things made it wrong. The shell has a failure the core has no
   vocabulary for — `noWorkspaceOpen` is a fact about the session, not about a file. And the core
   nests: an identity refusal arrives as `{ code: "identity", identity: { "StaleRevision": … } }`,
   which puts the one code the frontend most needs to branch on two levels down and in a different
   spelling convention from its neighbours. Flattening the nine reachable conditions into nine
   top-level codes is what lets the frontend `switch (error.code)` exhaustively, and R27 is entirely
   about that switch having the right arms. **The switch was not actually exhaustive when this was
   written**: `identityRecovery` ended in a `default`, so flattening enabled an exhaustive switch
   nobody had written, and a new code would have been absorbed silently. The review found it; the
   `default` is gone and the function ends in `const unhandled: never = error`, so a code with no arm
   now fails `svelte-check`.
2. **There is no `Display` impl. Not even a developer-facing one.** The core has them and documents
   them as log renderings; here, where the value is one `?` away from being serialized into a
   webview, the safest rendering is none at all. `Debug` covers logging. This is the mistake
   `an_io_errors_message_is_not_on_the_wire_but_its_kind_is` exists to catch, and disabling
   experiment G shows it catching it.
3. **`Serialize` is hand-written, and every arm writes `CommandError::code()`.** A
   `#[serde(tag = "code", rename = …)]` derive produces the same JSON and spells every code
   **twice** — once in an attribute, once in any accessor Rust branches on. The hand-written impl
   costs forty lines and leaves exactly one spelling of each code in the crate. There is
   correspondingly **no `COMMAND_ERROR_CODES` constant in Rust**: the frontend needs a runtime list
   because `isCommandError` has to recognise untyped JSON, Rust does not, and a second list nothing
   reads would be one more thing to keep in step.

**The mapping is complete by construction, not by audit.** Each `From` impl matches its source enum
exhaustively, so a variant added to `WorkspaceError`, `DiscoveryError` or `IdentityError` fails this
crate's build. `every_core_error_condition_maps_to_one_command_code` then checks the *direction the
compiler cannot*: it writes out the core's failure modes and asserts which code each becomes, rather
than iterating what the mapper produced — which is the vacuous-audit corollary (D2w) applied to an
error table.

**`CommandError`'s own enumeration is now mechanically exhaustive too, and was not.** The review's
finding 6: the compiler forces a maintainer adding a variant to extend `code()`, `serialize()` and
`operand_count()`, but nothing forced them to extend `every_command_error()` — and since
`COMMAND_ERROR_CODES` in `errors.ts` is compared against *that list*, a variant omitted from both
passed every check. `every_declared_variant_has_an_instance_in_the_enumeration` closes it by reading
`error.rs`'s own `pub enum CommandError` block and comparing the variant names it declares against
the `Debug` names of the instances the list produces. The expectation comes from the **declaration**,
not from what the enumeration emitted, which is D2w again. Disabling experiment J ran it.

**4. A fourth decision, added by the review: every path operand is a `WirePath`.** `serde`'s own
`PathBuf` serializer *fails* on a path that is not valid UTF-8, and a `CommandError` that cannot
serialize is the one failure a typed error boundary cannot absorb — the value that was supposed to
carry the refusal is the value that failed, so the webview gets `serde`'s English prose. `WirePath`
renders lossily and therefore always succeeds. See §16.

## 4. R27 at the boundary: the two identity refusals stay apart

A held `MatchId` is scoped to the parse it came from. A `get_match` that crosses a `reload_document`
must come back as `identityStaleRevision` — *the document moved on, resolve this again* — and never
as `identityNoSuchMatch`, which means *this projection has no such node at all*.

> **Correction (review finding 1).** This section used to gloss `identityStaleRevision` as
> *"re-resolve and keep the selection"*, and `errors.ts` and `types.ts` said the same in stronger
> words: that the identity was stale but *the thing still exists*, and that `DocumentPath` is "the
> identity designed to survive a reparse". **All three were false.** `DocumentPath` is a list of
> `PathSegment`s and a sequence step is `PathSegment::Index(usize)` — a **position**. An external
> edit that deletes the first match leaves `matches[1]` resolving perfectly well, to what used to be
> `matches[2]`, so "re-resolve and keep the selection" would move the user's selection to a different
> snippet without saying so. A stale revision means the bytes changed and **nothing about whether the
> match survived them**.
>
> Three things carry the correction. `identityRecovery` returns
> `{ action: 'reresolve', mayFind: ['sameMatch', 'differentMatch', 'gone'] }` rather than the bare
> string `'refetch'`, so whatever wires it to selection state in Phase 1c has to decide what to do
> when re-resolution finds a *different* match before it can compile. `types.ts` now documents
> `DocumentPath` as positional, in the words above. And
> `a_document_path_is_positional_so_a_deletion_repoints_it` in `src-tauri/src/commands.rs` is the
> counterexample as a test: it holds `matches[1]`'s path, deletes `matches[0]` on disk, reloads, and
> asserts that the *same* path now names a match with a different trigger. Reinstating the old claim
> means deleting that test.
>
> `PROGRESS.md` repeats the false version in two places. §13 is the correction it is owed.

Four things carry that distinction, at four different levels:

- `From<IdentityError>` maps the three refusals to three codes, never to one;
- `an_identity_held_across_a_reload_crosses_as_a_stale_revision` rewrites the file so the two
  matches **swap places** — the case where resolving a stale identity would return *the other
  match* — and asserts the code, the `found` revision and the `expected` revision;
- `a_stale_identity_reaches_the_webview_as_its_own_code` does the same through the real IPC
  dispatcher, because the string the frontend switches on has to survive serialization;
- `identityRecovery()` in `src/lib/ipc/errors.ts` maps `identityStaleRevision` to `reresolve` and the
  other two to `clearSelection`, with a test whose whole content is `expect(a).not.toBe(b)`, and a
  second test asserting that the `reresolve` arm still admits `gone` and `differentMatch`.

**The re-selection policy is classified, not performed.** There is no selection state in the
application yet, so `identityRecovery` returns what should happen and a documented **TODO (Phase
1c)** says where it gets wired. What it must not become is `if (stale) forget()`; the function
exists so that the distinction is written down before there is a caller who could collapse it.

## 5. The capability set stays empty — argued, then executed

`src-tauri/capabilities/default.json` is still `"permissions": []`. Phase 1b-1's review narrowed it
there from `core:default`, whose image defaults would let a compromised renderer read the pixels of
any local file, and this phase does not widen it by one entry.

**The argument.** A capability grants access to *plugin* commands — everything spelled `plugin:…`,
`core:…` included. `tauri::webview`'s dispatcher access-checks a request when
`plugin_command.is_some() || has_app_acl_manifest || !is_local`. None of the five is a plugin
command, this crate publishes no application ACL manifest, and the webview's origin is local.

**That paragraph is an argument, and 1b-1's review is on file about the difference between an
argument and evidence** — its finding was a smoke launch that proved a window existed and nothing
about what was painted in it. So `src-tauri/src/dispatch_check.rs` builds the application with
`tauri::test::mock_builder()` and drives all five commands through `get_ipc_response`. `mock_builder`
swaps the platform webview for a mock; it does **not** swap the IPC dispatcher, the access-control
resolution or the command macros. The application it builds is the shipped one: `main.rs` now
exposes `register()` and `context()`, and both `main()` and the test call them, so the capability
file under test is the capability file that ships.

That test proves three things a direct call cannot: the commands are **registered** (absence from
`generate_handler!` is a runtime failure, not a compile one), the arguments **deserialize** from JSON
— including `MatchId`'s hand-written `ContentRevision`, which accepts exactly 64 hex characters and
rejects a malformed token at the boundary — and the empty capability set **does not block them**.

It also produced the phase's one security-relevant finding, in §8: a **remote** origin *is* refused,
and `a_remote_origin_is_refused` pins that side of the condition. R20's rule — pin both sides, never
one inside — applied to an access-control check rather than to a fixture.

## 6. Typing the boundary by hand, and the check that narrows the risk

`src/lib/ipc/types.ts` is 650 lines of hand-written types mirroring `serde`'s output. It is
not generated: a generator would be a fourth build step for shapes that change once a phase. The
cost of hand-writing is drift, and **drift in a boundary type is invisible** — TypeScript is happy,
`serde` is happy, and a renamed field simply reads as `undefined` at runtime in a window nobody has
opened yet.

So `src-tauri/src/wire_contract.rs` reads `types.ts`, `errors.ts` and `commands.ts` as text and
compares them against JSON produced by projecting a **synthetic** document — hand-authored, neutral,
never the real configuration (CLAUDE.md §1). It checks:

- **the property names of 19 interfaces**, in both directions, against the keys `serde` writes for a
  real projection: a property Rust writes and TypeScript omits, and a property TypeScript declares
  and Rust never writes, both fail;
- **required versus optional**: a `?:` anywhere in an interface under check fails with its own
  message. `serde` always writes the key, so `x?: T` is a different contract from `x: T | null`;
- **the members of 12 union types** against a Rust-side list of variants, in both directions;
- **the operands of all 14 tagged variants that carry any** — the keys inside
  `{ readonly ParseFailed: { … } }` — against the keys `serde` writes for that variant;
- **`COMMAND_ERROR_CODES`** against the codes `CommandError::code()` produces;
- **the nine error interfaces of `errors.ts`**, name derived from the code rather than listed, against
  the operands each variant serializes;
- **`COMMAND_ERROR_OPERANDS`**, the table `isCommandError` validates against, names **and** JSON
  kinds — the one place a *type* is checked and not only a name;
- **`COMMAND_NAMES`** against a set parsed independently out of `generate_handler!`, in both
  directions, plus the absence of the six forbidden mutating names from both sets.

> **Correction (review findings 4 and 5).** The first four bullets were the whole list, and this
> section used to be titled "the check that makes that safe". The review found four concrete
> divergences that all passed: making `DocumentView.profile` optional (`property_name()` stripped the
> `?`), renaming the nested `ParseFailed.byte_index` (only outer keys were compared), renaming
> `IoError.path` (no frontend *error* interface was checked at all), and — the one that mattered most
> — adding `commands::save_match` to `generate_handler!` (the registered set was built by filtering
> the *frontend's own* names through `main.rs`, so a registration the frontend did not know about was
> invisible). The last five bullets are the fix; experiments H, I, K and L in §11 are them failing on
> purpose. What remains open is hole 2, restated honestly there: **the type text of the read model's
> own properties is still unchecked**, and only that.

**Three conventions the TypeScript follows, and each is a consequence of the `tsconfig`.**

1. **Nullable, never optional.** `serde` writes `null` for a `None`, so the key is always present.
   With `exactOptionalPropertyTypes` on, `x?: T` and `x: T | null` are genuinely different
   contracts, and only the second is true of this wire. There is not one `?:` in the file. This is
   1b-1 hole 7 arriving exactly as predicted: the types are more verbose than the obvious version.
2. **`readonly` throughout**, including `readonly T[]` for every sequence. The model is a read-only
   projection; nothing the frontend does to one of these objects reaches the disk, so nothing should
   look as though it could.
3. **Field names are the Rust ones**, `snake_case` and `ambiguous_yaml_1_1` included. This is the
   wire, not an ergonomic API; renaming would put a translation layer inside a boundary whose value
   is having none.

`getMatch` and its four siblings return a `CommandResult<T>` rather than throwing. A rejection is
easy to forget, and the one this phase exists to preserve is the one a `try`/`catch` most naturally
flattens.

**R28 is untouched.** No `Deserialize` was added anywhere. The three command arguments —
`Option<PathBuf>`, `DocumentId` and `MatchId` — are exactly the types Phase 1a derived it on, which
is what `1a-notes.md` §9 hole 6 said they were for.

## 7. Where the user-facing strings are (nowhere), and why the lint proves nothing here

**No string this phase produces reaches a user.** There is no component, no markup and no rendered
message: `CommandError` carries codes, `types.ts` carries types, and `classifyFailure`'s `detail` is
a developer string for the console that 1b-2b will replace with one generic dictionary key.

`npm test` runs `scripts/lint/hardcoded-strings.ts` and it is clean, and **that is not evidence**.
R31: the scanner sees `.svelte` markup only. It cannot see `<script>` bodies, `{'literal'}`
expressions, `.ts` string constants or component props — which is exactly the class of string a
`.ts` IPC layer produces. The check that this phase introduced no user-facing string is **by hand**,
and it is this: every string literal in `src/lib/ipc/` is a command name, an error code, a variant
name or a JSDoc sentence; every string literal in the three new Rust files is a code, a JSON key, a
panic message inside a test, or an `expect` on an invariant. Nothing is a sentence addressed to a
person. A reviewer should re-derive that rather than take it, because no tool in this repository can.

**Re-derived after the review fix round**, because it added literals to exactly the file the scanner
cannot see. The new ones are: `'reresolve'`, `'clearSelection'`, `'none'`, `'sameMatch'`,
`'differentMatch'` and `'gone'` (the `SelectionRecovery` and `ReselectionOutcome` unions — names a
`switch` branches on, never rendered); `'string'`, `'number'` and `'stringArray'` (`OperandShape`,
the same); and the operand names in `COMMAND_ERROR_OPERANDS`, which are JSON keys. On the Rust side
the fix round added no literal that is not a code, a JSON key, a source-scanner token such as
`"pub enum CommandError {"`, or an assertion message inside `#[cfg(test)]`. `WirePath`'s lossy
rendering deserves one sentence of its own: **it is not a translatable string.** A path is the
operating system's name for a file, identical in both languages, and `U+FFFD` is the character that
exists to stand for bytes no encoding can name.

## 8. What this phase got wrong on the way

*Four things it found itself, below. Ten more the review found are in §15, and two of those — the
stale-revision claim and the one-directional command oracle — are the kind this list exists for: a
claim written confidently in three files at once, and a test whose name promised what its body could
not check.*

1. **`identityWrongDocument` is unreachable through `get_match`, and a test claimed otherwise.** The
   test `an_identity_from_another_document_is_its_own_code` was written expecting it and failed:
   `Workspace::get_match` projects the document the *identity* names and then resolves against that
   projection, so document and projection can never disagree by the time `match_by_id` looks. The
   reachable refusal is the next one, the revision. The test is renamed to what it checks
   (`get_match_routes_by_the_identitys_own_document`), the code is kept because `From<IdentityError>`
   is exhaustive and mapping a real core refusal to something else would be a lie, and the
   unreachability is hole 3 rather than a deleted variant.
2. **The dispatcher test first measured the remote path while claiming to measure the local one.**
   The origin was `http://tauri.localhost` — the Windows and Android form of the custom protocol —
   and on macOS `Webview::is_local_url` does not recognise it, so every command came back
   *"not allowed. Plugin not found"*. Had the assertion been the weaker "the command fails", the
   test would have passed and the capability question would have been answered backwards. The fix
   was `tauri://localhost`, and the accident became `a_remote_origin_is_refused` — the other side of
   the condition, which is worth more than the mistake cost.
3. **`generate_context!` may be expanded once per crate.** It defines `_EMBED_INFO_PLIST`, so a
   second expansion in a test is a linker error. Hoisting it into `main.rs`'s `context()` is not
   merely a workaround: it is what makes the dispatcher test exercise the shipped configuration
   instead of a fixture that could disagree with it.
4. **The 1b-1 test `the_core_dependency_is_callable_from_the_test_target` carried a claim this phase
   falsified.** Its doc comment said *"a production build of this shell contains no reference to the
   core at all"*, which stopped being true the moment `commands.rs` existed. The test is kept — it
   still checks that discovery refuses two nonexistent probe paths rather than inventing a directory
   — under the name `the_pure_resolver_refuses_two_nonexistent_probe_paths`, with the false sentence
   removed rather than annotated.

## 9. Coverage holes, stated as holes

1. **Nothing in the running application calls `invoke`.** The IPC layer is complete, typed and
   tested, and `vite build` tree-shakes all of it out of `dist` because no component imports it. So
   the boundary is proven by tests and by the mock dispatcher, and **not** by a launched window.
   R32's first half is still owed, and it is 1c's — the phase that has something to render.
2. **The wire check does not compare the *type text* of the read model's properties.**
   `readonly byte_len: string` in `types.ts` would still pass
   `every_interface_declares_exactly_the_properties_serde_writes`. Closing it would mean resolving
   `ScalarView | null`, `readonly ValueView[]` and `DocumentPath | null` against `serde_json::Value`
   kinds, which is enough of TypeScript's type syntax to be a second parser rather than a check.

   **This hole used to be stated much more broadly than it is, and the broader version was wrong to
   leave open.** The review's finding 4 listed four things it covered that were closeable cheaply —
   required-vs-optional, nested tagged-variant operand names, the frontend error interfaces, and the
   operand table's shapes — and all four are now checked (§6). What is left is the type text of the
   read model's own properties, and nothing else. Its owner is whichever phase first has a reason to
   generate the wire types instead of writing them; **1b-2b is not that phase** and should not be
   made into one, because a code generator introduced for a type check is a fourth build step bought
   with the rarest of the failure modes.
3. **`identityWrongDocument` is unreachable through the five commands** (§8, finding 1). It is
   mapped, it is serialized, its shape is tested — and no command produces it. 1b-2b still owes it
   a string in both languages, because a code with no string is worse than a code with no caller.
4. **The Rust-side variant lists in `wire_contract.rs` are hand-written.** A variant added to
   `DiagnosticCode` or `HazardKind` breaks the `tripwire()` matches at compile time, which is a
   deliberate prompt; the other ten enumerations have **no tripwire**, so a variant added to
   `MatchBadge` and listed in neither the Rust array nor `types.ts` is not caught. This is exactly
   the exhaustiveness check `PROGRESS.md`'s next-action §3 assigns to **1b-2b**, and it should be
   built there against the dictionary key set rather than duplicated here.
5. ~~**The same gap exists for `CommandError` itself.**~~ **Closed by the review's finding 6.** It
   used to read: *"`every_command_error()` is a hand-written list; a variant added to the enum and to
   `code()` but to neither that list nor `errors.ts` passes everything. The doc comment on `code()`
   is the only guard, and it is a process guard."* That was true and should not have been left as a
   hole — the same page then claimed in §12 that the code sets were "mechanically checked".
   `every_declared_variant_has_an_instance_in_the_enumeration` now reads `error.rs`'s own enum block
   and compares the declared variant names against the instances, so the process guard is a test.
   Disabling experiment J is it failing. Hole 4 above — the *core's* enumerations, `MatchBadge` and
   its neighbours — is untouched and is still 1b-2b's.
6. **A new interface in `types.ts` is not checked until someone adds it to `samples()`.** The check
   iterates the sample table, so an interface nobody sampled is unverified. `samples()` covers all
   19 that exist; nothing forces the twentieth to be added.
7. **The TypeScript comment stripper has no notion of a string literal.** A future `types.ts`
   containing a literal with `//` or `/*` in it would be mis-parsed. It would fail loudly rather
   than quietly, which is why this is a note and not a defect, but it is a real limit.
8. **`npm run tauri build` has still never been run** — 1b-1 hole 3, unchanged. The dispatcher test
   uses `MockRuntime`, which is not the bundler and not `wry`.
9. **The synthetic fixture in `wire_contract.rs` is a Rust constant, not a corpus file.** R20 would
   prefer a fixture; a fixture would have to live in the core's corpus, where it would be swept by
   every Phase 0 test and would change counts those tests pin. This is the same deviation
   `1a-notes.md` holes 4 and 10 record, taken for the same reason and recorded rather than hidden.
10. **Nothing measures how long a command blocks the main thread.** §2's trade is argued from Phase
    0c-3b-2b's parse measurements, not from a measurement of these commands. A browser will not
    notice; a Phase 2 debounce might.
11. **A wire path is lossy, so it cannot be handed back as an argument.** §16's trade. Nothing does
    hand one back today — `open_workspace`'s `root` comes from a directory chooser, not from a
    listing — but a future "reopen the last workspace" that remembered `WorkspaceSummary.root` as a
    string would be remembering a rendering. Whichever phase adds workspace persistence owns it, and
    the fix is to persist the real bytes rather than the wire form. On macOS the branch is
    unreachable anyway (APFS refuses non-UTF-8 names), which is why this is a hole and not a defect.
12. **Nothing checks that a future path field on a wire struct is a `WirePath`.** The compiler checks
    the ones that exist, because the field *type* is the check — but a new `pub path: PathBuf` added
    to a `Serialize`-deriving struct would compile and reintroduce the failure. The mechanical guard
    would be a source scan of the kind `every_declared_variant_has_an_instance_in_the_enumeration`
    already is; it is not written, because the three structs that carry paths are the three the read
    model has and a fourth is not in prospect before Phase 2's save surface. **Phase 2 owns it**, and
    should write it when it adds the first path-carrying command argument.

## 10. Dependencies added

| Crate | Where | Why |
|---|---|---|
| `tempfile` 3 | `src-tauri` **dev**-dependency | The command tests build a synthetic espanso tree on disk and read it back through the real `Workspace`. A boundary tested over an in-memory fake is a boundary over nothing. Already a workspace dependency; no new version enters the lockfile. |
| `tauri` 2, feature `test` | `src-tauri` **dev**-dependency | `MockRuntime` and `get_ipc_response`, which are what turn §5's capability argument into evidence. A dev-dependency feature, so `cargo build` does not enable it. |

No frontend dependency was added: `@tauri-apps/api` has been there since 1b-1. **No dependency of any
kind was added to `espansoconfig-core`**, and `cargo tree -p espansoconfig-core | rg tauri` finds
nothing.

## 11. The disabling experiments

An oracle that cannot disagree is not an oracle. Every new check was broken deliberately, the
failure recorded, and the break reverted; the suite returns to 514 Rust and 104 frontend tests.

> **How to read this table (review finding 9).** Rows **A–G** record executions performed while the
> phase was being written, and **they cannot be reproduced from the committed state** — the mutations
> are not scripted, and nothing in the repository preserves the runs. The reviewer was right to say
> so. They are kept because they are still evidence of the strongest kind available at the time, and
> because the current test bodies do support that each named mutation would trigger each named
> assertion — which is a claim a reader *can* check by reading the body. What a reader cannot check
> from here is that the run happened, or that experiment A produced exactly four failures. Treat
> A–G's *outputs* as recorded observations and their *mechanism* as derivable.
>
> Rows **H–M** were executed during the review fix round, on the code as committed, and their
> messages below are copied verbatim from the run. The same caveat applies to reproducing them
> later: the mutations are described precisely enough to repeat by hand, and repeating them by hand
> is the intended reproduction. A scripted mutation harness was considered and not built — it would
> have to edit source files a phase away from where the checks live, and a harness that rewrites the
> tree is a worse thing to own than a table that is honest about what it is.

| # | For | What was broken | What fired |
|---|---|---|---|
| A | §4 | `From<IdentityError>`'s `StaleRevision` arm maps to `IdentityNoSuchMatch { node: 0 }` — the flattening R27 forbids | **four** tests, led by `an_identity_held_across_a_reload_crosses_as_a_stale_revision`: *"a stale identity must be its own code, not a lookup miss: IdentityNoSuchMatch { node: 0 } — left `identityNoSuchMatch`, right `identityStaleRevision`"*, and including `a_stale_identity_reaches_the_webview_as_its_own_code`, which is the same claim through the real dispatcher |
| B | §6 | `ScalarView.ambiguous_yaml_1_1` renamed to `ambiguousYaml11` in `types.ts` | `every_interface_declares_exactly_the_properties_serde_writes` — *"interface ScalarView: TypeScript is missing [\"ambiguous_yaml_1_1\"] and declares [\"ambiguousYaml11\"] that Rust never writes"*. Both directions in one message |
| C | §6 | `'MergeKey'` deleted from the `HazardKind` union | `every_union_declares_exactly_the_rust_variants` — *"type HazardKind: TypeScript is missing [\"MergeKey\"]"* |
| D | §3 | `'identityStaleRevision'` deleted from `COMMAND_ERROR_CODES` in `errors.ts` | `the_frontend_error_codes_are_exactly_the_rust_codes` — *"COMMAND_ERROR_CODES: TypeScript is missing [\"identityStaleRevision\"]"*. This is the check that makes 1b-2b's dictionary possible: a code with no entry would otherwise reach a screen as nothing at all |
| E | §5 | `commands::reload_document` removed from `generate_handler!` | **three** tests: `the_frontend_command_names_are_the_registered_commands` names the missing registration, and both dispatcher tests fail with *"Command reload\_document not found"* — which is the point of §5, since nothing that calls the function directly would have noticed |
| F | §4 | `identityRecovery` returns `clearSelection` for a stale revision | **two** frontend tests: *"expected 'clearSelection' to be 'refetch'"*, and `distinguishes the two identity refusals rather than treating both as gone` — *"expected 'clearSelection' not to be 'clearSelection'"*. The second is the one to keep: it fails for **any** collapse of the two, not only for this one. (Ran against the pre-review code, where the stale arm was the bare string `'refetch'`; it is now `{ action: 'reresolve', … }` and the same two assertions read `.action`) |
| G | §3 | `io_kind_name` appends the `io::Error`'s `Display` to the kind | `an_io_errors_message_is_not_on_the_wire_but_its_kind_is` — *"the io::Error's Display string reached the wire: {\"code\":\"io\",\"path\":…,\"kind\":\"PermissionDenied: the developer-facing sentence that must not be sent\"}"* |
| H | §6 | `DocumentView.profile` changed from `profile: ConfigProfileView \| null` to `profile?: ConfigProfileView` — the review's finding 4(a) | `every_interface_declares_exactly_the_properties_serde_writes` — *"interface DocumentView declares `profile?:`, but serde always writes the key: a nullable property is `profile: T \| null`, never `profile?: T`"*. Before the fix this passed, because `property_name()` stripped the `?` |
| I | §6 | the nested `ParseFailed.byte_index` renamed to `byteIndex` in `types.ts` — finding 4(b) | `every_tagged_variant_declares_exactly_the_operands_serde_writes` — *"the ParseFailed payload of type DiagnosticCode: TypeScript is missing [\"byte_index\"] and declares [\"byteIndex\"] that Rust never writes"* |
| J | §3 | a tenth `CommandError` variant added, with arms in `code()`, `serialize()` and `operand_count()` but **not** in `every_command_error()` — finding 6 | `every_declared_variant_has_an_instance_in_the_enumeration` — *"every_command_error() and the CommandError declaration disagree — left {…, \"WatcherFailed\"}, right {…}"*. Before the fix this was the exact silent path the notes had recorded as a hole |
| K | §6 | `IoError.path` renamed to `filename` in `errors.ts` — finding 4(c) | `every_error_interface_declares_exactly_the_operands_serde_writes` — *"interface IoError: TypeScript is missing [\"path\"] and declares [\"filename\"] that Rust never writes"*. No frontend error interface was checked at all before |
| L | §5 | **`commands::save_match` added to `generate_handler!`** with a stub command, `COMMAND_NAMES` untouched — finding 5, the experiment the review required | `the_registered_commands_are_exactly_the_five_read_only_names` — *"the registered commands: TypeScript is missing [\"save_match\"] and declares [] that Rust never writes"*. The old test passed this mutation: it built its `registered` set by filtering the frontend's five names through `main.rs`, so a sixth registration was outside what it could see. Reverted immediately, and `rg save_match src-tauri/src/main.rs src-tauri/src/commands.rs` finds only the module documentation that names the six forbidden commands |
| M | §6 | `COMMAND_ERROR_OPERANDS.notUtf8.offset` declared `'string'` instead of `'number'` | `the_frontend_operand_table_is_the_operands_rust_writes` — *"COMMAND_ERROR_OPERANDS[notUtf8] is not what Rust writes — left {\"offset\": \"number\", \"path\": \"string\"}, right {\"offset\": \"string\", \"path\": \"string\"}"*. The one check in this module that compares a **type** rather than a name |

F is the one to remember, for the same reason 1b-1's F was. The obvious experiment for R27 is A, and
A alone would license an implementation that keeps the two codes apart in Rust and then merges them
in the first frontend function that reads them. The distinction has to be tested where it is *used*,
not only where it is produced.

L is the one the review asked for by name, and it is worth stating why: the test that was supposed to
be the scope-creep oracle for "no mutating command ships" could not have detected a mutating command
shipping. It was one-directional, and a one-directional check on a set is a check on the set you
already had.

## 12. What Phase 1b-2b inherits

- **The code sets are fixed, and checked in both directions against a Rust-side list.**
  `COMMAND_ERROR_CODES` (9), `DiagnosticCodeName` (23), `UnknownReasonName` (4), `HazardKind` (10),
  `MatchBadge` (10), `VariableKind` (11), plus `TriggerKind`, `ContentKind`, `ValueKind`,
  `DocumentShape`, `FileKind`, `ScalarStyle` and `LineEnding`. The dictionary can be written against
  them without a second audit of what the names are.

  **What "mechanically checked" does and does not mean here (review finding 6).** This bullet used to
  say "fixed and mechanically checked" full stop, while hole 5 on the same page said the opposite for
  `CommandError` — one of the two had to be wrong, and it was this one. It is now true of
  `CommandError`, whose enumeration is compared against its own declaration. It is **not** yet true
  of the twelve core enumerations: `DiagnosticCode` and `HazardKind` have compile-time tripwires, the
  other ten have nothing, and hole 4 is unchanged. So: for `COMMAND_ERROR_CODES` the set is closed;
  for the rest the *comparison* is mechanical and the Rust *list* is hand-written, which is exactly
  the check 1b-2b owes.
- **The lookup functions exist.** `diagnosticCodeName()` turns an externally tagged code into its
  name — the dictionary key — and `diagnosticCodeOperands()` returns the structured operands to
  interpolate through `t(key, params)`'s existing `{placeholder}` mechanism. `unknownReasonName()`
  does the same for the four unknown reasons. Nothing in the boundary produces text, so 1b-2b is
  adding entries rather than replacing renderings.
- **The exhaustiveness check is 1b-2b's, and hole 4 says what it has to cover** — hole 5 is closed,
  and `every_declared_variant_has_an_instance_in_the_enumeration` in `src-tauri/src/error.rs` is the
  pattern to copy. A Rust-side enumeration of every variant compared against the dictionary's key
  set. The hand-written lists in `wire_contract.rs` are where the enumeration should be centralised,
  not a second place to write it.
- **`classifyFailure`'s `unexpected` arm needs exactly one dictionary entry**, generic and
  non-specific, and its `detail` must **not** be rendered — it is a developer string, sometimes
  Tauri's own English.
- **`identityWrongDocument` needs a string even though nothing produces it** (hole 3).
- **The macOS menu is still not localized** — 1b-1 hole 1, the one that phase explicitly owed here.
  1b-2a does not close it and does not claim to: the labels now *can* come from the frontend across
  IPC, because an IPC surface exists, but the command that would carry them is a menu command and
  this phase shipped only the five read-only ones. It is 1b-2b's, and if 1b-2b declines it too the
  reviewer's objection recorded in `1b-1-notes.md` §9 hole 1 should be re-read rather than
  re-litigated.
- **`"permissions": []` stands, with evidence** (§5). Widening it for a menu, an event or a dialog
  means naming one permission at a time and saying why in the notes. `core:default` stays gone.
- **R27, D2u and R28 all still apply**, and all three now have a checked expression at the boundary:
  the stale-revision code, `a_schema_boolean_crosses_as_text_not_as_a_boolean`, and the absence of
  any new `Deserialize` derive.
- **R27's meaning is narrower than `PROGRESS.md` currently states it** — §13 below is the correction
  the checkpoint is owed, and 1b-2b should not write a dictionary entry for `identityStaleRevision`
  that says "the snippet moved, finding it again" until that correction lands.

---

## 13. The correction `PROGRESS.md` owes

*This section is for the orchestrator to paste; nothing here edits `PROGRESS.md`.*

`PROGRESS.md` states the false half of review finding 1 in two places — its `## Next action` section,
item 5, and the `### What Phase 1b inherits from 1a` bullet on R27 — both of which say or imply that
a stale identity can be recovered by re-resolving through a `DocumentPath` that "survives a reparse".
Its own Phase 0c-2a section already says the opposite and correctly: *"`matches[3]` shifts on
reorder"*. The two halves of the checkpoint contradict each other, and the 0c-2a half is the true one.

**The replacement text, in the checkpoint's own register:**

> **R27, corrected at 1b-2a.** A `MatchId` that crosses a reparse is refused as
> `identityStaleRevision`, and that code means **the document moved on** — not that the match
> survived. Recovery is *re-resolution*, and re-resolution has three possible answers: the same
> match, a **different** match, or nothing. `DocumentPath` is **not** a fallback identity: a sequence
> step is `PathSegment::Index(usize)`, a position, so an external edit that deletes an earlier match
> leaves the path resolving to a different one. Any Phase 1c selection state must handle all three
> answers; `identityRecovery` in `src/lib/ipc/errors.ts` returns them as data so that it cannot be
> skipped, and `a_document_path_is_positional_so_a_deletion_repoints_it` in
> `src-tauri/src/commands.rs` is the counterexample in test form.

**And a line for the standing-rules section**, because this was the fourth occurrence of the pattern
R24's corollary names:

> **An identity that is "designed to survive" something has to be shown surviving it.** 1b-2a wrote
> that `DocumentPath` was the identity designed to survive a reparse, in three files, without a test
> in which anything survived a reparse. The reviewer wrote the counterexample in four lines. Read the
> *name* of the property, then look for the test that could fail if it were false — the same check as
> R24's corollary, applied to a doc comment instead of a test name.

---

## 14. The convention decision the review forced: JSDoc on framework callbacks

CLAUDE.md §5 says **JSDoc on every JavaScript/TypeScript function**, and a closing-bracket comment on
anything over ten lines. The review's finding 10 is that the vitest callbacks in `commands.test.ts`
and `errors.test.ts` are functions and were following neither. Read literally, that is a violation.
The rule had to be applied or an exemption written; leaving it undecided is what the finding actually
objected to. **It is decided, both ways, and this is the reasoning.**

- **The closing-bracket rule is applied.** Every `describe`/`it` callback longer than ten lines now
  ends with `}); // End of the "…" case`. The rule exists so that a reader meeting a `}` knows what
  it closes, and a 30-line `it` body is exactly that problem. It costs one line and it is honest.
- **Per-callback JSDoc is exempted, and the exemption is narrow: a callback passed to `describe`,
  `it`, `beforeEach` or `vi.mock` whose sibling argument is already its description.** `it('refuses a
  rejection whose declared operands are missing', () => …)` *has* a description; a JSDoc sentence
  above it would be a second description, free to disagree with the first, and this project has spent
  three phases on findings about descriptions that disagreed with what they described. One
  description that the test runner prints is better than two that can drift.
  - The exemption does **not** cover the `vi.mock` factory's returned `invoke` stub, which has no
    description argument and keeps its JSDoc; nor any ordinary helper in a test file — `wellFormed()`
    and `valueOfShape()` in `errors.test.ts` carry full JSDoc, as does every module-level constant's
    purpose.
  - Each test file's module doc comment now states the exemption where a reader meets it, rather than
    only here.

If a later phase disagrees, the thing to change is CLAUDE.md §5's wording, not the test files: an
exemption that lives only in one phase's notes is the same shape of problem as a safety property that
lives only in a test suite.

---

## 15. The review disposition

`docs/reviews/phase-1b-2a-ipc-surface.md`, ten findings. **All ten are closed**; none is deferred
without an owner.

| # | Severity | Disposition |
|---|---|---|
| 1 | High | **Fixed.** `identityRecovery` returns `{ action: 'reresolve', mayFind: […] }`, not `'refetch'`; the "the thing still exists" and "designed to survive a reparse" claims are gone from `errors.ts`, `types.ts`, `error.rs`, `commands.rs` and §4 above. New test `a_document_path_is_positional_so_a_deletion_repoints_it` (Rust) fails if the claim is reinstated, plus a frontend test asserting the arm still admits `gone` and `differentMatch`. §13 is the `PROGRESS.md` correction. |
| 2 | High | **Fixed.** `WirePath` in `crates/espansoconfig-core/src/wire.rs`; every path on the wire is one, and `DiscoveryError`/`WorkspaceError`'s hand-written impls use its borrowed form. Four tests, each asserting the premise (a bare `PathBuf` really does fail) before the property. §16 records what the lossy rendering costs and holes 11 and 12 record what is left. **The filesystem half could not be tested as the review hoped**: macOS refuses to create a non-UTF-8 filename (`EILSEQ`, confirmed by trying), so the `Ok` half is driven through the real projection with a hand-built `DocumentContext`, and the error half through the real `WorkspaceSession::open` with a hand-built root. That is stated in the tests' own doc comments, not silently skipped. |
| 3 | Medium | **Fixed.** `isCommandError` validates the operands each code declares in the new `COMMAND_ERROR_OPERANDS` table, names and primitive shapes, surplus keys still allowed. The test that licensed the unsoundness now builds a well-formed sample per code from the table, and four new cases pin missing operands, wrong shapes, surplus operands, and the fact that a malformed rejection lands in `classifyFailure`'s `unexpected` arm. |
| 4 | Medium | **Fixed for (a), (b) and (c); one narrower hole remains, restated.** Optional properties fail with their own message (H); nested tagged-variant operands are compared in both directions (I); the nine error interfaces and the operand table are compared, the latter including JSON kinds (K, M). §6's "makes that safe" is now "narrows the risk", and hole 2 is rewritten to the one thing still open — the type text of the read model's own properties — with its owner named. |
| 5 | Medium | **Fixed.** `registered_commands()` parses `generate_handler!` independently; the comparison is bidirectional; the six forbidden names are asserted absent from both sets, and from the frontend's exports too. **The disabling experiment was executed** — row L, verbatim — and reverted. |
| 6 | Medium | **Fixed.** `every_declared_variant_has_an_instance_in_the_enumeration` reads `error.rs`'s enum block (experiment J); `identityRecovery`'s `default` is replaced by `const unhandled: never = error`. Both false sentences corrected: §12's "fixed and mechanically checked" and §3's claim about the exhaustive frontend switch. |
| 7 | Medium | **Fixed, by the second option the review offered.** `MAX_EXACT_WIRE_INTEGER` is declared in `crates/espansoconfig-core/src/lib.rs` and `mint()` in `crate::workspace` asserts against it, with a `#[should_panic]` test one past the bound and a test at it. `DocumentId` stays a JSON number, because a decimal string would make every identity a parse on both sides to buy a range that is asserted unreachable. The audit of every other numeric wire field is §16. |
| 8 | Low | **Fixed.** *"recognises every code the Rust side can produce"* → *"recognises a well-formed rejection for every code in `COMMAND_ERROR_CODES`"*, with a comment naming the Rust test that owns the other half of the claim. *"call the five wire names and nothing else"* → *"call the five wire names, in order, and export no sixth wrapper"*, and the body now reads the module's exports rather than the five names it already knew. *"the frontend command names are the registered commands"* → *"the registered commands are exactly the five read-only names"*, bidirectional (finding 5). |
| 9 | Low | **Fixed by relabelling, honestly.** §11 now says outright that rows A–G cannot be reproduced from the committed state, distinguishes their recorded outputs from their derivable mechanism, and marks rows H–M as executed against the code as committed with verbatim messages. A mutation harness was considered and rejected, with the reason stated rather than left implied. |
| 10 | Low | **Decided, both ways** — §14. Closing-bracket comments applied to every callback over ten lines; per-callback JSDoc explicitly exempted for framework callbacks whose sibling argument is the description, with the exemption written into each test file's module doc and the escalation path named. |

**What the fix round did not change, deliberately:** the five commands, the empty capability set, the
absence of every mutating command, R28, and the synchronous-command trade of §2. No dependency was
added in either language, and `cargo tree -p espansoconfig-core | rg tauri` still finds nothing.

---

## 16. Wire paths, wire numbers: what a JSON value can and cannot carry

Two of the review's findings are the same question asked about two types — *does the wire form
faithfully carry what Rust holds?* — and the answers went opposite ways.

**Paths: no, and the fix is to stop pretending.** `serde` serializes a `PathBuf` by asking for
`&str`, which does not exist for a path whose bytes are not UTF-8, so serialization **fails**. That
failure lands after a command has returned `Ok`, where there is no error left to send — the webview
receives `serde`'s own English. `WirePath` serializes `to_string_lossy()`, which every path has.

- The wire form is therefore **display data**, and the documentation on all five fields
  (`DocumentView.path` and `.relative_path`, `DocumentSummary`'s two, `WorkspaceSummary.root`) says
  so. The thing to hand back is `DocumentId`, which is opaque and unaffected.
- The wrapper is a **type**, not a `#[serde(serialize_with = …)]` attribute, so the five existing
  fields are correct by construction rather than by review. Hole 12 records that a *sixth* field
  added later is not yet mechanically caught.
- `DiscoveryError` and `WorkspaceError` keep `PathBuf` fields — callers read files with them — and
  wrap each path in `WirePathRef` inside their hand-written `Serialize`. The core's serialization is
  now total with respect to paths.
- **The lossy branch is unreachable on macOS.** APFS and HFS+ reject a non-UTF-8 filename with
  `EILSEQ`; this was confirmed by trying to create one, not assumed. The tests therefore construct
  such a path from bytes via `OsStrExt::from_bytes` and drive it through the real projection and the
  real `open`. Unreachable-on-this-platform is a reason to keep the guarantee cheap, not a reason to
  skip it: the type has to be total for `commands.rs`'s boundary claim to be true as written.

**Numbers: yes, and the invariant is now asserted rather than assumed.** Every numeric wire field is
a Rust `u64` or `usize` arriving as an IEEE-754 double, exact only up to `2^53 - 1`. The audit, field
by field:

| Field(s) | Rust type | Bound |
|---|---|---|
| `DocumentId` | `u64` | A monotonic counter, one increment per distinct path ever opened. **Not bounded by anything physical**, so `mint()` asserts against `MAX_EXACT_WIRE_INTEGER`. This is the only one that needed a check. |
| `NodeId`, `MatchId.node`, `IdentityNoSuchMatch.node`, `UnknownEntry.key_node`, `MappingCoverage.mapping` | `usize` | An index into one parse's node arena. Bounded by the node count of a file held in memory. |
| `ByteSpan.start`/`.end`, `DocumentView.byte_len`, `NotUtf8Error.offset`, `ParseFailed.byte_index` | `usize` | Byte offsets into a file that was read into a `String`. Bounded by that allocation. |
| `ParseFailed.line`/`.column`, `ValueTooDeep.depth`, `MatchHasSeveralTriggerForms.count`, `MatchHasSeveralContentForms.count`, `EmptyDocument.document_index`, `AdditionalDocumentNotProjected.document_index`, `DocumentView.stream_documents`, `DocumentPath.document_index` | `usize` | Counts within one parsed file. Bounded by its byte length. |
| `WorkspaceSummary.documents`/`.match_files`/`.config_profiles`/`.packages`/`.disabled` | `usize` | Files in one directory walk, all held in a `Vec`. |
| `UnknownDocumentError.document`, `IdentityWrongDocumentError.expected`/`.found` | `u64` | `DocumentId`s, covered by the row above. |

Every row but the first is bounded by something the process already holds in RAM, and a machine with
`2^53` bytes of it is not the failure mode to design against. The first is bounded by an assertion,
which is the difference between a bound and a hope.
