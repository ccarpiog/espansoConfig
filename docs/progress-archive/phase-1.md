# Phase 1 — verification and review dispositions

_Archived verbatim from `PROGRESS.md` on 2026-08-29, when the checkpoint was split. The text below is unedited; see `PROGRESS.md` for the live state._

---

## Phase 1c-2b-2b-2 review disposition

The review is
[`docs/reviews/phase-1c-2b-2b-2-whole-document.md`](docs/reviews/phase-1c-2b-2b-2-whole-document.md):
**eight findings — two blocking, five follow-up and one confirmation.** **Seven are closed** before the
commit, so no commit holds a demonstrated defect; the eighth is a statement about **Phase 2** and is
recorded with an owner rather than fixed. The reviewer found **no** architecture, privacy, i18n-hardcoding,
corpus-fixture or D2u regression, and confirmed the generation check, the identity-guarded getter and
the settled `loading` arm as otherwise sound.

**Five of the eight are one defect.** A sentence claiming more than the thing beneath it establishes —
once on a **screen**, four times in a **test name**. This project has now caught that pattern in eight
consecutive sub-phases, and the corollary is unchanged: read the name, then the body, and ask whether
the body could fail if the name's claim were false.

| # | Kind | Finding | Disposition |
|---|---|---|---|
| 1 | **Blocking** | `browser.detail.fileTextAsWritten` says a document is shown "as the file writes them", which is **false for line endings**: `sourceText.ts` folds a CRLF into one `break` carrying `ending: 'crlf'` and `SourceText.svelte` never reads that field, so CRLF and LF draw as identical unlabelled `<br>` elements — while a **lone** CR is named as a marker. The phase's own measurement (`c-crlf.yml`, `markers=0`, no `0d`) proves it | **Real, and the string changed rather than the renderer.** The "announced on the same screen by the thing that performs it" defence holds for the **prose markers** and does not reach line endings, which nothing on the screen announces at all. Both languages now say: shown from the file's first character to its last, **characters that draw nothing are named**, and **every line ending is drawn as one line break**. Notes §4.2 is the argument, §4's row and §5's rows agree with it, hole 5 says what changed and what did not, and `no longer claims the file's own line endings reach the screen` holds both withdrawn phrases and asserts them gone. **Read on a screen in both languages** (notes §6.5) over a file with two CRLF endings among four LF ones and one soft hyphen: `br=6 markers=1` |
| 2–5 | Follow-up | Ten test names claim more than their bodies establish: two about `rawTarget`/`documentTextState`, two about dictionary strings, four source scans promising that something **"draws"** when they read substrings of `DetailPane.svelte`, and three in `workspace.test.ts` establishing **state** while naming a screen | **All ten renamed to what the body checks, and three bodies strengthened so a name could stay.** No test in this project may promise rendering — nothing here renders a Svelte component (hole 1) — so the four scans now say they check source wiring and placement. `carries the failure whole…` now supplies **all four** refusal codes; `tells a file of no characters apart from one it could not read` now supplies **both** an empty file and an unreadable one, so it can no longer pass if the two were conflated; `reports a refusal to the developer…` now asserts the state as well as the console. Experiments A and Q each fire one more test as a result, and both counts are corrected in the notes' §7 |
| 6 | **Blocking** | `clearSelection()` and the `cleared`/`unresolved` arms of `applyRepair()` can move an "All"-scope target to `null` **without invalidating the held file-text read**, so a later selection of that same file matches the held identity, returns early and **redraws the old snapshot** — and an answer in flight when the target went still lands and populates the cache | **Real, and fixed with one helper rather than three patched call sites.** `forgetFileText()` bumps the generation and nulls the answer and the identity; `readFileText()` calls it whenever the target is `null`, which makes the invalidation **total** instead of a list of remembered places. `clearSelection()` and `select()` (after `applyRepair`) now call `readFileText()`, as `show()` already did; `open()` and `showFileText(false)` use the helper. Notes §2.3. Two new tests cover the re-read and the race, and **experiment T** fires exactly those two. **The sticky `fileTextShown` is deliberately unchanged** — notes §2.2 decided it, the review raises it as an observation, and the defect was the staleness |
| 7 | Confirmation | Apart from the path above, the generation check and the identity-guarded getter prevent a stale answer appearing beneath another file's name, and typed failures settle the `loading` arm | **No action, and nothing weakened.** The getter keeps the comment experiment C earned, which says in the code that no call site can reach the guard. Closing finding 6 removed a way for a stale answer to be reused rather than adding one |
| 8 | Follow-up | **Phase 2 cannot refresh the displayed file after a write**: identity dedup suppresses a re-read and the deliberately-removed `force` path leaves close/re-open as the only refresh. Separately, `RawDocumentText.text` **carries no revision** and must not be treated as sufficient authority for a write | **Recorded, not fixed — deliberately, and with an owner.** Writing an invalidation for a write that does not exist could not be tested. It is **hole 14** of the notes' §9, it is in the notes' §11 inheritance list, and it is in "What Phase 2 inherits" below, so the next phase meets it in the file it will read |

**What the round changed:** two dictionary strings, one module (`workspace.svelte.ts`) and three test
files. **No Rust, no wire change, no new dependency, no dictionary key added or removed**, and the
corpus untouched.

**One thing the round found and deliberately did not fix.** `browser.detail.valueAsWritten` — *"shown
here as the file writes it"*, 1c-2b-2b-1's caption over a **slice** — goes through the same primitive
and inherits the same line-ending overclaim finding 1 is about. It is another sub-phase's string, and
rewording it after this round's window reading would mean re-taking that reading for a surface the
round did not otherwise touch. Named in notes §4.1 so it is not rediscovered; the natural companion to
closing hole 5.

## Phase 1c-2b-2b-1 review disposition

The review is
[`docs/reviews/phase-1c-2b-2b-1-source-text.md`](docs/reviews/phase-1c-2b-2b-1-source-text.md):
**four findings — three Major, one Minor, no Blocking**, and three of the four are the same defect this
project keeps catching, in the one sub-phase whose entire subject was not committing it. All four were
closed before the commit, so no commit holds a demonstrated defect. The reviewer found **no**
architecture, privacy, i18n-hardcoding, corpus-fixture, D2u or HTML-injection regression, and confirmed
the round trip, the astral and lone-surrogate handling, the CRLF counting and the Svelte 5 reactivity.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | **Major** | `browser.detail.unknownValue` says the value is "shown here as the file writes it" above **all three** `SourceSlice` arms, so an unreadable non-empty span makes the pane say the bytes are shown *and*, on the next line, that it could not read them | **Real.** Trigger: `value_text: ""` with a non-empty `value_span`. The claim was attached to the wrong scope — a caption over three branches, true of one. `unknownValue` is now *holds {kind}* / *contiene {kind}* and nothing more; the as-written claim moved into the `text` arm alone as the new `browser.detail.valueAsWritten`. The two-halves guard in `detail.test.ts` gained the newly withdrawn sentence **and a position check on the claim**, so moving it back up fails (experiment N) |
| 2 | **Major** | The scope sentence assumes every match has a block-sequence `-` and indentation before it. `MatchView::project` projects **every** item, so a flow item (`matches: [{trigger: x}]`) has neither, a bare empty item (`matches:\n  -`) has a **zero-width span** with no first or last character, and a terminal empty value stops the span before the final colon | **Real, and it is the rule broken nine times before this: a sentence written from the shape the author had in mind.** All three shapes were **measured** with a throwaway probe and the measurement then *committed* as `every_shape_a_matches_sequence_can_hold_is_projected_with_its_own_span` in `model_projection.rs`, so the next person changes the sentence against a test rather than against a memory. The new sentence names **no syntax at all**, in both languages: *"The part of the file this app reads as the snippet itself…"* |
| 3 | **Major** | The headline claim — a character with no visible shape is *named rather than drawn as nothing* — is wider than the classifier, which covered only NUL, C0/C1, the two separators, a lone CR and U+FEFF. `a\u{200b}b` renders identically to `ab`, which is precisely what the claim denies. Notes hole 7 admitted it while the headline denied it | **Real, and both halves were fixed rather than one.** The classifier widened to the soft hyphen, the zero-width set (U+180E, U+200B, U+2060–U+2064, non-initial U+FEFF) and the bidi controls (U+061C, U+200E–U+200F, U+202A–U+202E, U+2066–U+2069) under three new names. **Joiners, variation selectors, tag characters and combining marks are deliberately excluded** — they modify a neighbour rather than draw nothing, so naming them separately would misdescribe them — and that judgement is recorded as hole 7 rather than left implicit. Round-trip, ordering, exclusion and combining-mark-after-a-marker tests added; the module header, the notes' headline and `browser.source.invisibleDetail` all narrowed to what the classifier does |
| 4 | Minor | Notes §9 hole 1 and the §5 table claim a lone CR and "the other C0/C1 controls" cannot reach the detail pane because a source holding one does not parse — but **only NUL was measured** | **Real, and measuring it inverted the claim.** BEL, ESC, DEL, U+009F and U+0085 **do** parse and land inside a match's span, and so does a lone CR when the next line is indented. **Only NUL is unreachable** — a quoted one fails the parse, a plain one stops it. Pinned by `which_control_characters_can_reach_a_projected_slice`; the §5 rows, hole 1, `PARSEABLE_HAZARDS` and one over-generalised doc comment in `dispatch_check.rs` were all corrected to match. The original note was not merely unproven; it was **wrong** |

**What the review did not close, and it is named rather than papered over.** `SourceSlice`'s
`unavailable` arm is reachable only through a defect, and **nothing in this project renders a Svelte
component in an automated test**, so its string has still never been read in place. It stays hole 8.
The worker was explicitly told not to fake this, and did not.

## Phase 1c-2b-2a review disposition

The review is
[`docs/reviews/phase-1c-2b-2a-raw-text-boundary.md`](docs/reviews/phase-1c-2b-2a-raw-text-boundary.md):
six findings, no Critical, and **every one of them the same defect** — a doc comment, a test name or a
manifest asserting something its body cannot check. All six were closed before the commit, so no commit
holds a demonstrated defect. The reviewer found **no** architecture, privacy, i18n, corpus-fixture or
D2u regression.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | **High** | `document_text` is documented as returning "raw file bytes" / the file "exactly as it is on disk", but its wire type is `String` and the core rejects invalid UTF-8 first | **Real, and the wording was the defect — the behaviour is right.** A file containing `0x80` becomes a typed `{code: "notUtf8", path, offset}`; it does not panic and is not decoded lossily, but it cannot be shown. Every such claim in `commands.rs`, `dispatch_check.rs`, `workspace/mod.rs`, `commands.ts` and the notes is narrowed to **exact preservation of valid UTF-8, typed refusal otherwise**. Notes §3.1 records the `CommandResult<string>` decision, its user cost, and the fact that widening it later is a **wire-format change Phases 2–5 inherit** — the sub-phase's most consequential inheritance, now written down rather than discovered in Phase 3 |
| 2 | **High** | `value_text` has never crossed the Tauri IPC dispatcher in any fidelity test | **Real, and it is the sub-phase's own headline claim not holding for half its subject.** `an_unmodelled_entrys_value_crosses_as_its_own_bytes` projected in-process and called `serde_json::to_value`; the dispatcher sweep invoked only `document_text`. A regression dropping `value_text` in `DocumentView` serialisation alone would have left every test green. New `dispatch_check::an_unmodelled_entrys_value_text_crosses_the_dispatcher_byte_for_byte`: `get_document` over the real dispatcher, entries found **by shape**, each `value_text` compared against `std::fs::read` sliced by the `value_span` that arrived beside it — a different source, so the oracle can disagree |
| 3 | Medium | The tests stop before WKWebView while the public comments claim what the webview receives; NUL and U+2028 / U+2029 are untested | Real on both halves. The three hazards are asserted at command, dispatcher and wrapper level (new `document_text_carries_a_nul_and_the_two_unicode_line_separators`), and the webview claims are removed — `mock_builder()` swaps the platform webview out, so nothing here says anything about `postMessage` or a lone surrogate. **Measured rather than assumed: U+2028/9 *can* reach a `value_text`, a NUL cannot** — a source holding one does not parse. Recorded as hole 9, an **R20 deviation**: all three are pinned by hand-written sources, not corpus fixtures |
| 4 | Medium | The "spans are provably disjoint" argument does not make an uncapped payload safe | Real, and the distinction is exact: disjointness bounds **duplication** at roughly one extra document, not **size**. §3 rewritten — the pathological input is spelled out with its three main-thread copies, and the corpus's 342-byte maximum is labelled a fact about this corpus rather than a bound. **The uncapped decision is kept** — right for a bounded read-only phase — but the saving it does not demonstrate is no longer claimed. Cost recorded as hole 10 |
| 5 | Medium | `a_remote_origin_is_refused` claims all seven commands and attempts three | Real, and a **security** claim with a false body: remote access accidentally permitted for `get_document` left the test green. Extended to all seven with well-formed arguments, and the attempt table is now asserted equal **in both directions** to the names parsed from `generate_handler!` — so a command added without an entry fails the test instead of sliding past it |
| 6 | Low | `every_command_refuses_before_a_workspace_is_open` never calls `text` | Real, and the **seventh** occurrence of "read the test's name, then its body, and ask whether the body could fail if the name's claim were false". `session.text(id)` added, with the test's scope written down |

One change outside the six, found while closing them: `src-tauri/capabilities/default.json` asserted the
harness "drives all six commands", which this sub-phase falsified the moment it registered a seventh.

## Phase 1c-2b-1 review disposition

The review is
[`docs/reviews/phase-1c-2b-1-typed-judgements.md`](docs/reviews/phase-1c-2b-1-typed-judgements.md),
and it was taken in **two passes**: seven findings, then a narrow verification pass over the fix round
that confirmed all seven closed and found **two more the fix round had introduced**. All nine were
closed before the commit, so no commit holds a demonstrated defect.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | **High** | `AdditionalDocumentNotProjected` says the additional document "is shown" | **Real, and it is this sub-phase's own stated failure mode landing inside the sub-phase built to avoid it.** The projection records later documents by span only; the viewer that would show one is deferred to 1c-2b-2. Reworded in both languages to claim only that espanso reads the first document and the later one was not interpreted. The fix forced a sweep of the other five new strings against their data, and **that sweep found a second false claim** — see finding 8 |
| 2 | Medium | Diagnostic identity is the code alone, so distinct occurrences collapse | Real. Twenty `KeyNotAccountedFor` diagnostics rendered as one sentence saying "one key". `occurrenceIdentity()` (code + span + node + path) now sits beside `diagnosticIdentity()` (code only); lines aggregate and carry `occurrences` / `repeated`, rendered "in N places" through a third `plural.ts` pair. **The test was the other half of the finding**: a hand-written `OWED` list that omitted the second input could not disagree with a policy that drops a real finding — R24's corollary again. It is a conservation count derived from the input now |
| 3 | Medium | Findings are unreachable for config profiles | Real, and **completed rather than deferred**. `holdsMatches` refused a profile before `getDocument()`, so a profile with broken YAML was silent in every pane of the application. `open()` projects every listed document now and `holdsMatches` governs counting only. Phase 1's exit is "the owner can browse their **entire** real config". **This fix introduced finding 8** |
| 4 | Medium | Zero-based wire indices displayed as human document numbers | Real — an empty first document displayed as "Document 0". Converted at the display boundary under a *display* operand name, so a stale dictionary leaves a visible placeholder rather than a wrong number. Indices 0 and 1 tested. **Strengthened by finding 9** |
| 5 | Low | The unnamed refusal invents a file-level cause | Real. `safely_editable: false` with `blocking_hazard: null` establishes only that the verdict refuses; "part of the file blocks it" was not in evidence. Now "and no reason was given" |
| 6 | Low | The union does not deduplicate its first input | Real but defensive — the core currently promises a distinct list. Seeded from a `Set` and given a duplicated-summary fixture, because the implementation and its test both claimed "each distinct kind once" while testing only an already-distinct input |
| 7 | Low | Two test names claim more than their bodies can check | Real, and the **sixth** occurrence of "read the test's name, then its body, and ask whether the body could fail if the name's claim were false". Renamed to claim only source occurrence. **Deliberately not closed by adopting a component-rendering library** — that is a decision with its own costs, recorded as one below, not a side effect of a fix round. Experiment Y demonstrates the gap rather than asserting it: `tHazard(` in a comment while the markup renders the raw identifier passes every test |
| 8 | Medium | Match-shaped profiles leak into `scopedMatches` | **Real, and finding 3's own regression** — before that fix such a profile was never projected. A `ConfigProfile` whose content holds match-file keys is deliberately projected as `DocumentShape::MatchFile`, so `view.matches` is populated, while the sidebar count still excluded it: the list showed rows the total did not count. Both branches of `scopedMatches()` consult `holdsMatches` now, **on `kind` rather than `shape`** — where the file lives, not what its content looks like. Experiment Z shows the disagreement (`[90, 91, 10, 11, 20]` against a sidebar total of 3). It also falsified **two sentences the notes already asserted**, which is why it is filed as the third occurrence of *a written claim ahead of its data* rather than as a bug |
| 9 | Low | A future differently-named index operand would silently stay zero-based | Real. The conversion was keyed on the operand spelling `document_index`, so a later `match_index` would render `0` with no placeholder and no failing test. Now `DIAGNOSTIC_DISPLAY_INDICES`, **a mapped type over `DiagnosticCodeName`**: experiment AA deletes the `EmptyDocument` row and `npm run check` fails naming the variant, before any test runs. Placed beside `ENUM_OPERAND_NAMESPACES` and nowhere near the key builders, so `codes.ts`'s existing guarantees are untouched |

## Phase 1c-2a review disposition

The review is [`docs/reviews/phase-1c-2a-detail-pane.md`](docs/reviews/phase-1c-2a-detail-pane.md).
**No High findings.** Two Medium and two Low, all four closed before the commit, so no commit holds a
demonstrated defect.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | Medium | The pane says an unmodelled entry "is shown as written" and shows only its key | **Real, and the sharpest of the four** — it is a claim the project has not earned, the same class as D2u and R16. Verified against the wire first: `UnknownEntry` carries `key`, `key_node`, `key_span`, `value_span`, `value_kind`, `path` and `reason` — **no value text**, so the pane never could have shown it. Six strings reworded in both languages to claim only what is true (*recorded and left untouched*, *kept exactly as the file writes it* — about the file, not the screen), and a new `browser.detail.unknownValue` renders `value_kind` through `tValueKind`: "holds a set of keys, which this pane does not show". **Deliberately not fixed by reconstructing the value in TypeScript from `value_span`** — JS string indices are UTF-16 units, not bytes, and that confusion is exactly what the core's `CharToByte` adapter exists to prevent. Carrying an exact Rust-sliced source span is hole 13 and inherited work |
| 2 | Medium | A sequence item's boundary is invisible | Real. `detail.ts` modelled the item label and the component rendered nothing for that arm, with `list-style: none` removing the native bullet too. Two `search_terms` whose first item held a two-line literal block rendered as three unmarked lines. A `•` in markup — **not a CSS `content:` rule**, so `innerText` can see it and a window reading can check it — plus a stylesheet rule and a text-scan guard |
| 3 | Low | The field-coverage test audits what the implementation emitted | Real, and **D2w recurring**. Closed at the root rather than by rewording the comment: `EVERY_DETAIL_FIELD` is pinned to `DetailFieldName` in both directions by two `assertNever<Exclude<…>>()` calls, and the assertion is now set **equality** rather than a count. Experiment Q adds an unemitted 25th member: the new test fails, and the test it replaced passed |
| 4 | Low | The notes' dictionary counts are wrong and disagree with each other | Real, and verified independently against `0507f6f` — 169 keys at the base. Corrected throughout; the figure is now **50 added, one removed, 218 each**, the extra over the review's arithmetic being `unknownValue`, which finding 1 added after the review was written |

## Phase 1c-1 review disposition

The review is
[`docs/reviews/phase-1c-1-shell-and-data-path.md`](docs/reviews/phase-1c-1-shell-and-data-path.md).
**Eleven items — two High, five Medium, three Low, plus one defect found outside the review — and every
one is closed. Nothing was rejected.** The phase was held open until the fix round finished, so the
commit contains no intermediate state holding a demonstrated defect. The full disposition, with what
each fix cost, is `docs/decisions/1c-1-notes.md` §13.

- **High 1 — the fingerprint could silently confirm a different match.** Real, and the most serious
  finding in the phase. `matchFingerprint` compared `search_text`, the badges and two shape codes, which
  between them carry **no** `word`, `propagate_case`, variable, form field, unmodelled entry or
  non-primary content field. The reviewer's counterexample is two matches differing only in
  `word: true` / `word: false`: identical fingerprints, so `reresolve()` answered `sameMatch` and the
  browser selected the wrong snippet. The notes had admitted only the *identical-twins* limit, which is
  far narrower. Closed by route (a) — a new read-only `MatchView.source_text`, the bytes the match's
  span names, compared alone. Bytes out of the file are a fact about how the file is written, never a
  resolved value, so D2u is untouched. Hole 3 of the notes is rewritten to the true statement: two
  **byte-identical** matches remain indistinguishable, and nothing in the file distinguishes them either.
- **High 2 — recovery installed a fresh identity over a stale document.** Real. `applyRepair()` stored
  the re-resolved id but never replaced the old `DocumentView` in `views`, so `selectedMatch` resolved
  the old node behind the new id, the list kept old rows and the counts stayed stale; deleted snippets
  also stayed visible after `differentMatch` and `gone`. Closed: `repairSelection` returns the projection
  it read and `installView` replaces the document **before** the selection outcome is applied, on both
  the kept and the cleared paths.
- **Medium 1 — an overlapping selection could overwrite a newer choice.** Real. Closed with a generation
  token checked after every `await`. Its experiment is the one that **did not fire** until the test also
  asserted that a superseded selection issues no reload; recorded in the notes rather than tidied away.
- **Medium 2 — reopening kept an invalid file filter and query.** Real. `open()` now resets selection,
  query, documents, summary, views and failures, under an open-generation token.
- **Medium 3 — search omitted secondary content forms.** Real, and it was a **core** defect rather than a
  frontend one: `build_search_text()` took `ContentSpec::primary()`, so `replace: alpha` + `html: needle`
  could not be found by `needle`. Closed by `ContentSpec::collect_scalars`. The notes' claim that
  `fixtures.ts` re-transcribes the core's join faithfully was false — it added both forms where the core
  added one — and both the fixture and the sentence are corrected.
- **Medium 4 — an unreadable file gave a misleading total with no visible failure.** Real, and it
  contradicted the notes' own justification for computing `pending`, which was then never rendered. The
  browser reached `ready` showing "All 2" while a 100-match file had failed to the console alone. Closed
  with `BrowserState.loadFailures` and a localized partial-total block, and **read out of a running
  window** in both languages.
- **Medium 5 — a notice code was turned into a key rather than going through an accessor.** Real, and it
  is the rule CLAUDE.md §2 and this checkpoint both state. Closed with a `tSelectionNotice` accessor —
  and with a **new lint**, `scripts/lint/built-translation-keys.ts`, which refuses any `t(` whose key is
  not written literally. It immediately found a **second, older** instance in `LanguagePicker.svelte`
  that had survived two phases; that is now `tLocaleName`.
- **Low 1** — `buildSidebar()` added a `ConfigProfile`'s count to the total although `holdsMatches` is
  false for one. Closed by guarding the addition.
- **Low 2 — eight test names promised more than their bodies established.** All eight strengthened, one
  narrowed. **This is R24's corollary and its fifth occurrence**, and the sharpest instance is the
  reviewer's own: `does not wait for a profile, which holds no matches` never supplied a profile count,
  so it passed while `buildSidebar()` counted one — the same test the notes had cited as the reason
  experiment E was unnecessary. That claim is corrected too.
- **Low 3** — the "stub" detail pane already rendered `trigger` and `label` through list-oriented helpers
  that collapse several trigger forms, which 1c-2 would have had to undo. Reduced to notice, file and
  placeholder; its two field keys are gone.
- **The plural defect, found outside the review.** `browser.sidebar.snippetCount` was `"{count} snippets"`
  / `"{count} fragmentos"` with no singular, so a one-match file's tooltip read **"1 snippets"** and
  **"1 fragmentos"** — and the phase's own R32 evidence shows one-match files, so it was on screen.
  Closed with a `.one` / `.other` key pair selected on `count === 1`, which is correct for both languages
  and adds no dependency. Confirmed from a running window: `"1 snippet"` and `"1 fragmento"`.

**One defect was found by the re-run readings and deliberately left for 1c-2**: a file that could not be
read shows the same `–` / "Not read yet" marker as a profile nobody has projected, which conflates
*could not* with *have not*. Recorded in `1c-1-notes.md` §10.4.

## Phase 1b-2b review disposition

The review is
[`docs/reviews/phase-1b-2b-dictionaries-and-menu.md`](docs/reviews/phase-1b-2b-dictionaries-and-menu.md).
Seven findings, **two High**, and the phase was held open until every one was dispositioned — so no
commit holds a demonstrated defect. The full disposition, with the disabling experiment for each fix
and the one escape that is **narrowed rather than closed**, is `1b-2b-notes.md` §12.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | High | Six wire-visible enums — `ScalarStyle`, `LineEnding`, `FileKind`, `TriggerKind`, `ContentKind`, `VariableKind` — crossed the boundary with no dictionary entry and no accessor, deferred to 1c as "hole 3". A 1c component meeting `trigger.kind = "Single"` could only render a raw Rust identifier or invent an unchecked mapping | **Fixed, deferral withdrawn.** Six `CODE_ENUMS`/`VARIANT_COUNTS` rows, 33 keys per dictionary, six key builders, six `describe` functions, six reactive wrappers, six sample tables. Sixteen namespaces, 111 code keys. Hole 3 closed |
| 2 | High | The exhaustiveness check failed open three ways: `#[cfg(…)] Variant,` on one line, `A, B,` on one line, and a brand-new enum never added to `CODE_ENUMS` | **Fixed for the first two, narrowed for the third.** `crate::rust_source` parses with `syn` and lexes with `proc-macro2` (dev-dependencies of `src-tauri` only). Two new checks derive the expected enum set from source — every `Serialize`-carrying enum in both trees, every string-literal union in `types.ts`. **An enum a `macro_rules!` expands to still escapes**, demonstrated in notes §12.3 experiment 12E and recorded as hole 2 |
| 3 | Med | A version skew was refused *inside Tauri's command macro* — English prose, no `code` — and `main.ts` discarded the result, so the English default menu stayed up with nothing reported | **Fixed both halves.** The command takes an untyped envelope and validates it itself, answering `invalidMenuLabels` with `missing`/`unexpected` field names; `startMenuLocalization` consumes the result and `main.ts` holds no logic, which is what makes the path testable |
| 4 | Med | The `detail` guard was a name scanner, and `JSON.stringify(classifyFailure(x))` renders the string while naming no guarded identifier | **Fixed in the type, not the scanner.** The developer string left `IpcFailure`: non-enumerable, symbol-keyed, read only by `developerDetail()`, with `reportIpcFailure()` as its destination. `errors.test.ts` pins enumerability, so putting it back under any name fails. Notes §10's "a component that renders it fails `npm test`" was **withdrawn and rewritten** |
| 5 | Med | `{ ok: true }` was returned before `build_menu`/`set_menu` ran, so a failure inside the closure was unobservable | **Fixed.** `menu::on_main_thread` waits on a one-shot channel and answers the new `menuBuildFailed`. Waiting cannot deadlock — `tauri_runtime_wry::send_user_message` runs a main-thread post inline when already on the main thread, quoted in the notes. Hole 3 of §11.8 closed |
| 6 | Med | The menu literal scanner blanked a whole line when a block comment *began* on it, so `*/ let title = "Edit";` slipped a hardcoded English label past every check | **Fixed.** Check 1 lexes instead of masking; the masker survives only for the two checks where over-masking is a loud false positive, with a test pinning that direction |
| 7 | Low | `COMMAND_ERRORS` pinned nine samples against ten variants, so a code could have rendered `""` and "renders every command error" would still pass | **Fixed, and generalised.** All twelve codes are covered and asserted bidirectionally against `COMMAND_ERROR_CODES`; every sample table in `codes.test.ts` is now checked for completeness against its wire union **at compile time** |

The review additionally **confirmed as non-findings**: the capability decision (`"permissions": []`
is correct for an application command from a local origin with no ACL manifest); the architecture
rule; `identityWrongDocument`'s dictionary entries; and the source scanner failing loudly on a
rename.

## Phase 1b-2a review disposition

The review is [`docs/reviews/phase-1b-2a-ipc-surface.md`](docs/reviews/phase-1b-2a-ipc-surface.md).
Ten findings; **all ten closed before the phase was recorded complete**, so no commit holds a
demonstrated defect. The full disposition with the fix for each is `1b-2a-notes.md` §15.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | High | `identityRecovery()` treated every stale revision as recoverable, and the claim that `DocumentPath` "survives a reparse" and keeps the selection was **false** — a sequence step is `PathSegment::Index(usize)`, so deleting an earlier match silently re-points the selection at a different one | **Fixed.** The three answers are returned as data; the false sentences are gone from `errors.ts`, `types.ts`, `error.rs`, `commands.rs`, the notes **and this file**; `a_document_path_is_positional_so_a_deletion_repoints_it` fails if the claim is reinstated |
| 2 | High | A non-UTF-8 path made serde's `PathBuf` serializer reject the response *after* the command returned `Ok`, so the webview got serde's prose instead of `{code, operands}` — falsifying `commands.rs`'s own module claim | **Fixed** in the core: `crate::wire::WirePath` backs all five wire path fields and all four path operands. Four tests, each asserting the premise (bare `PathBuf` **does** fail) before the fix |
| 3 | Med | `isCommandError()` narrowed to full operand types after checking only `code`, so `{code: 'identityStaleRevision'}` yielded guaranteed-`string` fields that were `undefined` | **Fixed.** A `COMMAND_ERROR_OPERANDS` table validates required operands and primitive shapes; surplus allowed for forward compatibility. The test that licensed the unsoundness was rewritten |
| 4 | Med | `wire_contract.rs` silently passed three concrete divergences: required→optional (`?` was stripped), nested operand names and types, and every frontend *error* interface | **Fixed** all three; hole 2 rewritten to the one thing left (the type text of read-model properties), with its owner named |
| 5 | Med | The no-mutating-command oracle was **one-directional** — registering `commands::save_match` and changing nothing else left the test green, though its name claims to check registrations | **Fixed.** `generate_handler!` parsed independently, compared both ways, six forbidden names asserted absent from both sets. The disabling experiment was run: the test failed, then reverted |
| 6 | Med | `CommandError`'s own enumeration was not mechanically exhaustive, and the notes claimed it was; `identityRecovery()`'s `default` absorbed new variants | **Fixed.** The enumeration test reads `error.rs`'s enum block; `default` → `const unhandled: never`; both false sentences corrected |
| 7 | Med | `DocumentId` is `u64` typed as TS `number`, so values above 2⁵³−1 collide | **Fixed** by stating and **asserting** the invariant: `MAX_EXACT_WIRE_INTEGER` checked at `mint()`, with a `#[should_panic]` test and a full numeric-field audit in notes §16 |
| 8 | Low | Three test names overclaimed what their bodies established — the project's own standing rule | **Fixed**: names narrowed, bodies strengthened (the exports set is now read from the module) |
| 9 | Low | The disabling-experiment table presented historical runs as evidence that the committed state cannot reproduce | **Fixed by honest relabelling.** A–G are marked unreproducible; H–M are new and were run against committed code |
| 10 | Low | Vitest callbacks breached the literal reading of CLAUDE.md's JSDoc / closing-comment rule | **Decided both ways** and recorded (notes §14): closing-bracket comments applied, per-callback JSDoc explicitly exempted with reasoning and an escalation path |

Codex additionally **confirmed as non-findings**: the core has no tauri edge; no mutating command
leaked in; `dispatch_check.rs`'s ACL claim is sound for Tauri 2.11.5 because `get_ipc_response` runs
the same `Webview::on_message` branch as production; the session mutex has no re-entrancy path; no
real-corpus content appears anywhere; and no user-facing prose escapes via `Display`.

## Phase 1b-1 review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-1b-1-shell-and-i18n.md`](docs/reviews/phase-1b-1-shell-and-i18n.md). Nine
findings, **two High**, and the phase was held open until every one was dispositioned — so, as with
every phase since `8989c16`, no commit holds a demonstrated defect.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High** — the bundle declares macOS 11.0 but targets `safari16` and calls `Object.hasOwn` (Safari 15.4+), so the first render throws and the window is blank | **Closed, both sides.** The floor is now `13.0`, the release that ships Safari 16, because the *target* is the deliberate value and the plist was the mistake — `vite.config.ts`'s own comment already said the build "may assume a current macOS". `Object.hasOwn` → `Object.prototype.hasOwnProperty.call`, which costs nothing in the one function that runs before anything can report an error. `webview-floor.test.ts` fails if the two ever disagree again. |
| 2 | **High** — `core:default` is not minimal; it grants `image:allow-from-path` and `image:allow-rgba`, so a compromised renderer can read local image pixels, against the phase's claim of "no filesystem permission" | **Closed.** `"permissions": []` — provably sufficient, because the 1b-1 frontend calls no Tauri API. **Verified empirically by launching a production-mode binary**, not by argument. The notes §6 sentence that described `core:default` as minimal is corrected. 1b-2 adds back permissions one at a time, never a `*:default` set. |
| 3 | **Medium** — five hardcoded user-facing strings against CLAUDE.md §2 | **Split, and the split is on file.** *Fixed:* `NSHumanReadableCopyright` was the English sentence "MIT licensed. See LICENSE.", which Finder shows under a Spanish locale — it is now `© 2026 ccarpiog · MIT`, and it was never on the §8 exception list, so no argument had ever been made for it. `index.html`'s hardcoded `lang="en"` is now set from the detected locale by `bootstrap()` **before** mount, with an ordering test. *Upheld:* the two developer-facing messages (a missing `#app`, a webview that cannot be created) — both fire only where no interface exists to render a message **in**, and neither is user-triggerable. *Open:* the macOS menu — see the disagreement below. |
| 4 | **Medium** — the production CSP allows `'unsafe-inline'` styles, so injected markup can hide the interface and paint its own | **Closed.** Production `style-src 'self'`; the relaxed policy moved to `devCsp`, which is where it was ever true. The production bundle emits an **external** CSS asset, so it renders fully styled without it — checked, not assumed. |
| 5 | **Medium** — "the runtime tests cover whether a Spanish value is actually Spanish" is false; they establish only non-identity | **Closed as a correction to the claim, not to the code.** Renaming `language.label` to `"Sprache"` passes every check. The suite is renamed to the untranslated-value heuristic it is, and §2, §3 and two module doc comments are corrected with that counterexample written into them. Establishing that a value is *Spanish* needs a bilingual review gate and is recorded as a hole. |
| 6 | **Medium** — "follows the system" stops following: `system` is computed once, so a platform language change is ignored until restart | **Closed.** `createLocaleState` takes a tag *reader* and re-negotiates on `languagechange`; `dispose()` detaches the listener. Two directions are pinned, and the second matters more: a user who **chose** a language is never overridden by their OS. Experiment F breaks exactly that and fires. |
| 7 | **Low** — duplicate JSON keys bypass every compile-time and runtime check; a translator editing the first occurrence is silently discarded | **Closed.** `scripts/lint/duplicate-json-keys.ts` reads the **raw file text**, because a JSON parse cannot see it by construction. Proven on `es.json`: the compiler stayed silent, the other 22 dictionary tests passed, and only the scanner named the line. |
| 8 | **Low** — `the_core_crate_is_linked_and_callable` names a stronger property than it checks; the only core reference is inside `#[cfg(test)]` | **Closed by renaming**, which is the honest fix: `the_core_dependency_is_callable_from_the_test_target`, with a doc comment saying a production build does not yet reference the core. The notes already admitted this at §6; now the **name** admits it too. This is R24 reaching a test's name rather than its body. |
| 9 | **Low** — the required Node runtime is neither pinned nor declared; Vite 8 needs `^20.19.0 \|\| >=22.12.0` | **Closed.** `engines.node` declared, `.nvmrc` pins 26.5.0, and the notes record which runtime the suite was verified on. `engine-strict` deliberately not set — reason in notes §1. |

**One defect the review did not reach, found by the fix round, and it invalidated the phase's own
evidence.** `src-tauri/Cargo.toml` declared no `custom-protocol` feature, and `tauri::is_dev()` is
literally `!cfg!(feature = "custom-protocol")` — so every build loaded the dead `devUrl` and the window
1b-1 reported as "launched and stayed up" was **blank**. `npm run tauri build` could not have succeeded.
Separated from a frontend exception by planting a static `<h1>` in `dist/index.html` and watching that
fail too. **The lesson is R32's:** a process that stays up is not a screen that renders.

**One live disagreement, recorded rather than resolved by silence.** The reviewer's position is that the
phase should not close while the macOS menu is unlocalized, since CLAUDE.md §2 is non-negotiable. The
rebuttal is that Tauri v2 builds the default menu in Rust, so localizing it means either Spanish strings
in Rust — which plan §9 forbids in as many words — or handing labels across IPC, which needs a command,
which is 1b-2 by design. **1b-2 owes it**, it is hole 1 of notes §9, and both halves of the argument are
written there so a later session can overrule this one on the evidence.

---

## Phase 1a review disposition

Review of record: [`docs/reviews/phase-1a-core-read-model.md`](docs/reviews/phase-1a-core-read-model.md).
Its verdict: **"hold the phase open"** — *"match identity is positional in practice, and the strongest
'no unknown key is lost' oracle cannot detect whole omitted mappings. Both violate explicit Phase 1a
gates."* It was right on both counts, and the phase was held open until all five findings were closed.
**No commit holds the demonstrated defect.**

| # | Finding | Disposition |
|---|---|---|
| 1 | **Match identity is positional after a reparse, and its test never performs a reorder.** `NodeId` is the parser arena index and `DocumentId` was the sorted-enumeration position, so exchanging two equally shaped matches hands `:a`'s identity to `:b`; separately, adding an alphabetically earlier file re-points a retained `DocumentId` at another file | **Adopted in full — this is D2v.** `MatchId` carries the parse's `ContentRevision` and `match_by_id` returns `Result<_, IdentityError>`; `DocumentId` comes from a monotonic session counter keyed by path. Both reviewer counterexamples are **retained tests**, and the mis-named test was renamed to what it actually does. Disabling experiments A and B reproduce the reviewer's two sequences verbatim with the guards removed. |
| 2 | **Keys nested under an unknown entry are neither modelled nor recorded, and the coverage oracle passes vacuously** — records exist only for mappings the schema walk chose to scan, so omitting one entirely is invisible to `all()` over emitted records | **Adopted in full — this is D2w.** The unknown entry's whole value span is recorded, the claim is restated as *named or inside a recorded undescended span*, the **library** checks it (`unaccounted_keys` → `KeyNotAccountedFor`, per R24), and the test oracle now derives its expectation from the **document tree**. Experiment C1 suppresses a record's *creation* and fails both corpus sweeps — which the old audit could not see. |
| 3 | **`load_from_source()` lets an unsaved draft replace Rust's disk snapshot**, contradicting plan §6.4's ownership split; and the API is not yet one-to-one wrappable (`WorkspaceError` unserializable, no `get_match`) | **Adopted in full.** The method is **deleted**, not hidden — its one test now compares `project_source` against the disk path. `WorkspaceError` and `DiscoveryError` gained hand-written code-plus-operand `Serialize`; `Workspace::get_match` added. `SourceDocument` stays unserializable **by design**: `DocumentView` is what crosses the boundary. |
| 4 | **The D2u oracle has a false-negative branch** — text is compared only when `scalar.decoded` is true, so `text = "true"` with `decoded = false` over source `on` escapes | **Adopted.** Text is compared whenever `decode()` succeeds, plus a clause refusing a decodable scalar labelled undecoded. Experiment D constructs the reviewer's exact pair. No production violation was demonstrated; the oracle's *claim* was broader than its enforcement, which is the same defect class in a smaller box. |
| 5 | **Non-scalar items inside a scalar sequence are diagnosed but dropped**, contradicting the doc comment and shifting the positions of the remaining elements | **Adopted, by fixing the implementation rather than the documentation.** `triggers`, `search_terms`, `depends_on` and `imports` are `Vec<ValueView>` and elide such an item **in place**, so positions never shift. Losing positional correspondence in a read model is the kind of thing a later phase silently builds on. |

**Pinned counts moved: none.** All 33 `SYNTHETIC_PROJECTIONS` rows are byte-identical after the fix
round — an elided item contributes no scalar, and neither did a dropped one — which is the desired
outcome for a fix that changes structure rather than content. The new diagnostics are pinned at 0.

**The lesson, and it is the third occurrence.** R24's failure mode — a property whose only home is a
test file, or a test whose name claims more than its body checks — was found here by a *reviewer* rather
than by the phase. Two of the five findings are instances of it: a test called
`…survives_a_reordering` that never reordered, and a coverage audit that could only see what the
implementation had already chosen to tell it. **Both were closed by moving the check into the library
and re-deriving the test's expectation from the document tree**, which is the same shape as every prior
closure of R24.

---

## Verification — Phase 1c-2b-2b-2

| Command | Result |
|---|---|
| `cargo test --workspace` | ✅ **561 tests**, 0 failed — unchanged, because this sub-phase adds no Rust |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo fmt --check` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `npm test` | ✅ **662 tests across 27 files**, 0 failed (**+77**: 19 in a new `rawDocument.test.ts`, 16 in `workspace.test.ts`, 42 in `sourceText.test.ts`) |
| `npm run check` | ✅ 374 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm run build` | ✅ built; `dist/assets/index-CgRncva7.js` 113.30 kB |
| dictionary keys | ✅ **248 and 248** (240 before — **+8**, one of the eight reworded at the review; no pre-existing key touched) |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1) |

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| A whole document is on a screen, through the **existing** primitive | ✅ | `documentText()` has a caller at last; `<SourceText text={view.text} documentStart />` is the one call entitled to that flag, and no second renderer for file text exists |
| The `notUtf8` refusal has a screen and does not look like an empty file | ✅ | 1c-2b-2a hole 8, closed. Read in both languages: *This app cannot show this file's text.* above the typed sentence naming byte offset 49. An empty file says something else again |
| The five open fidelity rows are filled by a **window reading** | ✅ | A real BOM, a NUL, five other C0/C1 controls, a lone CR and a file with no final newline, each seen in WKWebView. Notes §5 and §6 |
| Hole 9 — what a large document costs — is measured | ✅ | `2n` segments for *n* lines, asserted to 968 000 bytes; **45 ms and 4 409 DOM nodes** for the largest real file (631 lines, 17 840 bytes) in a window. Nothing is capped, and the reason is written down |
| **Phase 1's exit, checked over the real corpus** | ✅ | 13 files, 0 load failures, 0 findings, every file's whole text rendered, **all 65 snippets clicked and rendered** with 3–6 sections and exactly one source box each. Notes §8, counts only |
| No user-facing string is hardcoded | ✅ | 8 new keys in both languages through typed accessors; R31's blind spots enumerated by name in notes §10.1 |
| Every experiment fires, or the code changes | ✅ | **20** experiments (A–T); **three did not fire**, and two of them changed the code — a dead `force` flag deleted, a too-weak markup scan strengthened until it fired, and an unreachable guard kept with its status written on it. T is the review round's, and thirteen of the twenty were re-run there |
| Every sentence on a screen is true of every case under it | ✅ **after the review** | The as-written caption was **false for line endings** — a CRLF and an LF draw as identical unlabelled breaks — and was reworded in both languages. Notes §4.2, read on a screen in §6.5 |
| No path removes the viewer's target while keeping its snapshot | ✅ **after the review** | `forgetFileText()`, called from `readFileText()` whenever the target is `null`, so every clearing path is covered by one call. Notes §2.3, experiment T |
| The Spanish strings are Spanish | ➖ **unchanged gap** | 8 new Spanish strings read on screen by their author. A bilingual reviewer remains the only instrument that closes this |
| Holes 5, 16 and 2 from earlier sub-phases | ❌ **left open, named, with reasons** | Notes §9 items 2, 4 and 3. Hole 2 is now **seen** rather than argued: a parse-failed file and an empty one show the same `0` on adjacent sidebar rows |

## Verification — Phase 1c-2b-2b-1

Every command below was run by the orchestrator **after** the review fix round, not taken on the
worker's report.

| Command | Result |
|---|---|
| `cargo test --workspace` | ✅ **561 tests**, 0 failed (559 at 1c-2b-2a's close; the two new ones are the measurements findings 2 and 4 demanded) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo fmt --check` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `npm test` | ✅ **583 tests across 26 files**, 0 failed (480 at 1c-2b-2a's close — **+103**) |
| `npm run check` | ✅ 372 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm run build` | ✅ built; `dist/assets/index-*.js` 109.11 kB |
| `rg -c '^\s*"' src/lib/i18n/{en,es}.json` | ✅ **240 and 240** (226 before — **+14**, one of them replacing a reworded key's claim) |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1) |

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| A match's own bytes are on a screen | ✅ | A *Source text* section renders `MatchView.source_text` through the primitive. Read in a window in both languages |
| The sentence describing them is true of **every** shape the projection produces | ✅ **after the review** | It was false for a flow item, a zero-width item and a terminal empty value. Now shape-neutral, and the three shapes are pinned by `every_shape_a_matches_sequence_can_hold_is_projected_with_its_own_span` |
| An unmodelled entry's value is on a screen | ✅ | `UnknownRow.value: SourceSlice`, rendered by the same primitive |
| The string saying it is **not** shown travelled in the same change | ✅ | `browser.detail.unknownValue` reworded in the same commit; `detail.test.ts` holds a suite asserting both withdrawn sentences are gone, and experiments F and G each fire it |
| Each of the three `SourceSlice` arms says something true of that arm | ✅ **after the review** | Review finding 1. The as-written claim now sits in the `text` arm only, with a position check that fails if it moves back up |
| Rendering is byte-faithful, and it is **measured** | ✅ | `sourceCharacters()` round trip is the oracle; the window reading holds `65 301` uncomposed beside `e9`, `1f600` whole, two trailing spaces as `20 20`, **no `0d` in the DOM**, `white-space` computed `pre`, and `scrollWidth > clientWidth` (it scrolls, it does not wrap) |
| A character with no glyph is named, and the claim matches the classifier | ✅ **after the review** | Review finding 3. Widened to the zero-width, soft-hyphen and bidi sets; joiners and variation selectors excluded **with a stated reason**; every prose claim narrowed to the enumeration |
| No user-facing string is hardcoded | ✅ | 14 new keys in both languages, all through typed accessors; `built-translation-keys.ts` covers the new component. R31's blind spots enumerated by name in notes §8.1 rather than assumed clean |
| Source text cannot become markup | ✅ | No `{@html}` anywhere; file text reaches the DOM as text-node content only. Confirmed by the reviewer |
| **WKWebView is covered** | ✅ **first evidence in this project** | 1c-2b-2a §4.3's named limitation. The reading is the first measurement past Tauri's encoder — narrow, and stated narrowly in notes §5.1 |
| The `unavailable` arm has been seen | ❌ **no, and said so** | Reachable only through a defect, and nothing here instantiates a Svelte component. Hole 8 |
| The Spanish strings are Spanish | ➖ **unchanged gap** | 14 new Spanish strings read on screen by their author. A bilingual reviewer remains the only instrument that closes this |

## Verification — Phase 1c-2b-2a

Every command below was run by the orchestrator **after** the review fix round, not taken on the
worker's report.

| Command | Result |
|---|---|
| `cargo test --workspace` | ✅ **559 tests across 16 binaries**, 0 failed (547 at 1c-2b-1's close; `src-tauri` 73 → 75) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo fmt --check` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `npm test` | ✅ **480 tests across 25 files**, 0 failed |
| `npm run check` | ✅ 369 files, **0 errors, 0 warnings** (run with `--fail-on-warnings`) |
| `npm run build` | ✅ built; `dist/assets/index-*.js` 103.17 kB |
| `rg -c '^\s*"' src/lib/i18n/{en,es}.json` | ✅ **226 and 226** — unchanged, re-derived not quoted; the sub-phase adds no string |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1) |

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| `document_text` is a registered, reachable command | ✅ | Seventh in `generate_handler!`; `dispatch_check.rs` **invokes** all seven with `"permissions": []` rather than arguing from the handler list. `wire_contract.rs` still asserts the six forbidden Phase 2 names absent from both sets |
| The unmodelled entry's value text is on the wire, sliced in Rust | ✅ | `UnknownEntry.value_text`, mirrored in `src/lib/ipc/types.ts`. Experiment J — slicing by `chars()` instead of bytes — fails four tests |
| Every byte hazard survives the crossing | ✅ **for valid UTF-8** | 33 fixtures / 37 406 bytes byte-identical through the **real dispatcher**, plus NUL and U+2028/9 asserted at three levels. The qualification is the point: see the next row |
| The contract is stated no wider than it holds | ✅ **after the review** | Narrowed to *exact preservation of valid UTF-8, typed refusal otherwise*. Invalid UTF-8 is `NotUtf8 { path, offset }` — verified independently in `crates/espansoconfig-core/src/workspace/mod.rs:634`, `String::from_utf8`, never `from_utf8_lossy` |
| Both new values are proven **through the dispatcher** | ✅ **after the review** | This was false at first submission for `value_text` and is review finding 2 |
| No user-facing string is hardcoded | ✅ **and cheaply** | The sub-phase adds **no** user-facing string — 226 keys before and after. R31's blind spots still hold in general and are enumerated by name in the notes |
| No screen changed | ✅ | `detail.ts` and `DetailPane.svelte` are comment-only edits; `value_text` is deliberately unread, so the existing "value not shown" strings stay true |
| WKWebView is covered | ❌ **not established, and said so** | `mock_builder()` swaps it out. Named as a limitation in notes §4.3; closing it needs a window reading, which is 1c-2b-2b's |
| The Spanish strings are Spanish | ➖ **not applicable** | No new Spanish prose this sub-phase. The standing gap is unchanged |

## Verification — Phase 1c-2b-1

Every command below was run by the orchestrator after the **second** fix round, not taken on the
worker's report.

| Command | Result |
|---|---|
| `npm test` | ✅ **479 tests across 25 files**, 0 failed (412 at 1c-2a's close) |
| `npm run check` | ✅ 369 files, **0 errors, 0 warnings** (run with `--fail-on-warnings`) |
| `npm run build` | ✅ built; `dist/assets/index-*.js` 103.17 kB |
| `cargo test --workspace` | ✅ 16 binaries, **0 failed** across every suite |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo fmt --check` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `rg render_probe src src-tauri/src scripts` | ✅ **no match** — the temporary R32 probe is fully reverted |
| `rg -c '^\s*"' src/lib/i18n/{en,es}.json` | ✅ **226 and 226** — re-derived, not quoted (218 at 1c-2a's close) |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1) |

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| `HazardKind` reaches a screen | ✅ | `matchEditability()` and `findings.ts`; the window reading shows a refusal on one snippet and its absence on a sibling one click later, in both languages |
| The diagnostics reach a screen | ✅ | `DocumentView.diagnostics` rendered in the middle pane; the reading shows a parse error with line and column for a zero-match file, and `RootIsNotAMapping` for a profile |
| *Could not be read* is distinguishable from *not read yet* | ✅ | `loadFailures` keyed on `DocumentId`; the reading shows "Could not be read" beside a `–` on two sidebar rows. The reviewer independently confirmed every production read site is updated and a refused document is excluded from `pending` |
| No user-facing string is hardcoded | ⚠️ **partially checkable** | The markup scan and `built-translation-keys.ts` pass, but **R31 still holds**: `hardcoded-strings.ts` sees `.svelte` markup only. The four blind spots are enumerated by name in the notes rather than assumed clean, and experiment Y shows a raw identifier reaching the markup while every test passes |
| Every new string is backed by data that exists | ✅ **after three failures** | Findings 1, 8 and the self-found `notEditable` claim were all this defect. The reviewer verified the corrected `notEditable` against `disqualifying_hazard`'s actual range in `crates/espansoconfig-core/src/syntax/trivia.rs:601` |
| A claim about a screen rests on a reading of a screen | ✅ | Two readings, both languages, probe removed and files byte-restored each time. The stale 1c-2a evidence was re-taken too, and `getComputedStyle` proved `.depth-0` / `.depth-1` in the unscoped `src/app.css` are **applied** (0px / 14px), which no earlier evidence established |
| The Spanish strings are Spanish | ❌ **not established** | Unchanged and unchangeable by any check here — the untranslated-value test establishes non-identity, not meaning. Eight new Spanish values this sub-phase, unreviewed prose. Only a bilingual reader closes this |

## Verification — Phase 1c-2a

Every command below was run by the orchestrator after the fix round, not taken on the worker's report.

| Command | Result |
|---|---|
| `npm test` | ✅ **412 tests across 24 files**, 0 failed |
| `npm run check` | ✅ 366 files, **0 errors, 0 warnings** (run with `--fail-on-warnings`) |
| `npm run build` | ✅ built; `dist/assets/index-*.js` 98.33 kB |
| `cargo test --workspace` | ✅ all suites pass, 0 failed |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo fmt --check` | ✅ clean |
| `rg render_probe src src-tauri/src scripts` | ✅ **no match** — the temporary R32 probe is fully reverted |
| `rg -c '^\s*"' src/lib/i18n/{en,es}.json` | ✅ **218 and 218** — the key parity finding 4 was about, re-derived rather than quoted |

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| Every §3.3 field renders when the source has it | ✅ | `describeMatch()` collects all 22; the equality test pins the emitted set against `DetailFieldName` |
| §3.4's nine variable types and §3.5's forms render | ✅ | `describeVariable()`; the window reading shows three variable cards and a form's fields |
| A scalar renders as source text, never an inferred type (D2u) | ✅ | **Seen on a screen**: `word: on` renders as `on`; no checkbox exists in the pane |
| Absent is distinguished from empty | ✅ | Seen side by side on two screens; the one wire-level exception is stated as hole 2 |
| No hardcoded user-facing string | ✅ | Both lints pass, **and** R31's four blind spots are enumerated by name in the notes §8 rather than assumed clean |
| The five uncalled accessors get real callers | ✅ | `tTriggerKind`, `tContentKind`, `tVariableKind`, `tScalarStyle`, `tUnknownReason`, plus the new `tValueKind`, `tDetailField`, `tUnknownCount` |
| A claim about a screen is backed by a reading of a screen (R32) | ✅ | Two readings, both languages, the second **re-taken after the fix round changed the component** |
| No real config content anywhere | ✅ | The readings ran against a hand-written synthetic config with `XDG_CONFIG_HOME` **and** `HOME` overridden |

**What the verification does *not* establish**, carried forward as stated holes: no component is
rendered by any automated test; no pixels, so the indentation and the bullet are known to exist in the
markup and the stylesheet but not known to *paint*; `Alias`, `Elided` and a non-scalar mapping key are
unit-tested and were never on a screen; and nothing establishes that the 50 new Spanish values are
Spanish beyond one bilingual reading.

## Verification — Phase 1c-1

Every command below was run by the **orchestrator** against the working tree, **after** the review fix
round and after the R32 readings were re-taken, not reported by a worker. All exit 0.

| Command | Result |
|---|---|
| `npm run check` | 364 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm test` | **354 passed** across 23 files (from 318 across 21) |
| `npm run build` | ok — `dist/assets/index-*.js` 81.30 kB |
| `cargo test --workspace` | 16 suites, **0 failed** anywhere |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no output** — the architecture rule holds (D2x) |

Two things were checked by the orchestrator **independently of any worker's claim**, because both are
claims a passing test cannot make:

- **The IPC layer really is in the shipped bundle.** `rg -o` over `dist/assets/*.js` finds
  `open_workspace`, `list_documents`, `get_document`, `get_match` and `set_menu_labels`. `document_text`
  is **absent**, which is correct — the raw YAML viewer is 1c-2 and nothing calls it yet. This is R32's
  first half, the oldest debt in the project, discharged by measurement.
- **The core's search haystack really does cover plan §8.1's five fields.** Read out of
  `build_search_text()` directly rather than taken from the phase's summary: trigger, `triggers`, `regex`,
  label, content, comment and `search_terms`.

The R32 window readings are `docs/decisions/1c-1-notes.md` §10, and they were **re-taken after the fix
round** on the orchestrator's instruction, because that round edited `Sidebar.svelte` and
`DetailPane.svelte` and **nothing in this project renders a Svelte component in an automated test**. A
runtime error in either would have produced an empty pane that all 354 tests pass straight through.
`git status --short` after the readings is byte-identical to before them: the temporary probe is gone.

## Verification — Phase 1b-2b

Every command below was run by the **orchestrator** against the working tree, **after** the review
fix round, not reported by the worker. All exit 0.

| Command | Result |
|---|---|
| `cargo test --workspace` | **544 passed, 0 failed** (was 514) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** — the architecture rule holds (D2x's check, not the withdrawn `rg -c tauri Cargo.lock`) |
| `npm run check` | 344 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm test` | **214 passed** (was 104) |
| `npm run build` | ok — 60.79 kB JS, 1.59 kB CSS |

**Six claims were checked by hand rather than taken from a worker's report**, each because it is a
rule a phase can quietly undo:

- `src-tauri/capabilities/default.json` is still **`"permissions": []`**, and its `description` now
  carries the reasoning so the next phase cannot re-open it by accident.
- **Six** `#[tauri::command]` attributes exist — five in `commands.rs`, one in `menu.rs` — and the
  `generate_handler!` list holds exactly those six. None mutates a file.
- `CommandError` still has **no `Display` impl** anywhere in the crate.
- `syn` and `proc-macro2` are **`[dev-dependencies]` of `src-tauri` only**. `cargo tree -p
  espansoconfig-core -e normal,build,dev -i syn` shows the core reaches `syn` **only** through
  `serde_derive` and `thiserror-impl`, which are proc-macros and were already there before this
  phase. The core's own `Cargo.toml` names neither `syn` nor `tauri`.
- The dictionaries hold **138 keys each**, 111 under `code.` and 16 under `menu.`, with **8 values
  identical across the two files** — matching the exception list exactly, no silent growth.
- **Corpus privacy (D1) intact**: no `corpus/real` path appears anywhere in the tree status, and
  `git check-ignore -v` still resolves the real corpus to `.gitignore:107`.

**The Spanish was read, by a reader, and it is Spanish.** Hole 9 correctly says nothing automated
establishes this — the untranslated-value check establishes only non-identity. A sample of the
`menu.*` block and the first `code.diagnosticCode.*` entries was read in full: the register is right,
the quotation marks are Spanish (`«…»`, not `"…"`), the phrasing is idiomatic rather than calqued
(*"No se ha podido indexar este archivo"*, *"así que"*), and the menu labels are **Apple's own**
Spanish strings — `Edición`, `Ocultar los demás`, `Mostrar todo`, `Seleccionar todo` — rather than
literal translations of the English. This is a **sample read by one reader, not a review of all 111
values**, and hole 9 stays open on those terms.

**R32 was discharged for the menu, and re-run after the fix round changed the thing it measured.**
The fix round altered `set_menu_labels`' signature and the main-thread step, which made the first
reading a description of a slightly different program — so it was taken again against the current
binary rather than carried forward:

- **Spanish** (`-AppleLanguages '(es-ES)'`): the real macOS menu bar read out of the accessibility
  tree gives `Apple, espansoconfig, Edición, Ventana`, with `Acerca de espansoConfig` … `Salir de
  espansoConfig` in the app submenu and `Deshacer, Rehacer, Cortar, Copiar, Pegar, Seleccionar todo`
  under `Edición`.
- **English** (`(en-US)`): `Apple, espansoconfig, Edit, Window`, likewise complete.
- **Every answer is byte-identical to the pre-review reading**, which is what makes it a regression
  check rather than a fresh anecdote.
- **The one-shot channel does not deadlock**: the menu is installed, so the closure ran and the
  channel delivered, and `sample <pid>` shows the main thread idle in `__CFRunLoopServiceMachPort`
  rather than parked in `recv`. `Ok(())` now genuinely means *installed*.
- **The untyped envelope parsed** — a refusal would have left Tauri's `File, Edit, View, Window,
  Help` default standing, which is exactly the failure the first reading could not have
  distinguished.

**Two things were not verified at runtime, and both are recorded as holes rather than assumed.** The
**live** locale switch did not reproduce this time: `System Events` reports 0 windows for the process,
so there is no `window 1` to find the picker in, while `CGWindowListCopyWindowInfo` shows the window
on screen at 1063×685. That is not a code fault, and the discriminating test says so — the
**development-mode** binary, which never runs the frontend and never calls `set_menu_labels` at all,
reports the same 0 windows. Closing it needs a bundled `.app`, which is Phase 5. And
`invalidMenuLabels` cannot be reached without a skewed frontend or a webview console; it is covered by
three `dispatch_check` tests through the real dispatcher instead. `1b-2b-notes.md` §12.5 states both.

## Verification — Phase 1b-2a

Every command below was run by the orchestrator **after** the review fix round, not reported by the
worker. All exit 0.

| Command | Result |
|---|---|
| `cargo build --workspace` | ok |
| `cargo test --workspace` | **514 passed, 0 failed** (core 478, was 471; shell 36, was 1) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** — the architecture rule holds (D2x's check, not the withdrawn `rg -c tauri Cargo.lock`) |
| `npm run check` | 336 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm test` | **104 passed** (was 97) |
| `npm run build` | ok — 38.87 kB JS, 1.59 kB CSS |

Three claims were checked by hand rather than taken from the worker's report, because each is a rule
a phase can quietly undo: `src-tauri/capabilities/default.json` is still `"permissions": []`; exactly
five `#[tauri::command]` attributes exist and `rg` finds no forbidden name in `main.rs` or
`commands.rs` outside a comment; and `CommandError` has no `Display` impl anywhere in the crate.

**R31 was honoured explicitly, and a clean lint run is not the evidence.** `scripts/lint/hardcoded-strings.ts`
scans `.svelte` markup only, and this phase's user-facing strings would live in `.ts` — exactly the class
it cannot see. The check was done by hand; `classifyFailure()`'s `detail` field is documented as a
**developer** string that must never be rendered, and giving the unexpected arm its one generic
dictionary key is 1b-2b's job.

## Verification — Phase 1b-1

Every command below was run by the **orchestrator** against the working tree, **after** the review fix
round, not reported by the worker:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **472 passed, 0 failed, 0 ignored**, across 16 binaries |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no output** — the rule holds (D2x) |
| `npm run check` | exit 0 — svelte-check, **0 errors 0 warnings** over 328 files, run with `--fail-on-warnings` |
| `npm run build` | exit 0 — 38.87 kB JS / 1.59 kB CSS, the CSS **external** (which is what makes the production CSP tightenable) |
| `npm test` | exit 0 — **71 passed** across 8 files (45 across 5 before the fix round) |
| `cargo test -p espansoconfig-core --test corpus_integrity` | exit 0 — 17 passed, the fixtures are untouched |

Test count moved 471 → **472**: one Rust test, and it is named for exactly what it can fail on —
`the_core_dependency_is_callable_from_the_test_target`. It is **not** evidence that a production build
references the core, because that reference lives inside `#[cfg(test)]` and no production one exists
yet; the review's finding 8 is that the earlier name (`the_core_crate_is_linked_and_callable`) claimed
otherwise. **No Phase 0 or 1a test was ignored, weakened or deleted**, and the only tracked files the
phase modified are
`Cargo.toml` (one workspace member, two workspace dependencies) and `Cargo.lock`. Nothing under
`crates/espansoconfig-core/src/` or `tests/` changed at all, which is why the 471 carry over unexamined.

**Architecture rule re-verified by the new check** (D2x): `cargo tree -p espansoconfig-core --depth 1`
lists `saphyr-parser`, `serde`, `sha2` and four dev-dependencies. No tauri, direct or transitive.

**Privacy re-verified**: `git status --short --untracked-files=all` shows no path under
`tests/corpus/real/`, and no `node_modules/` or `dist/` path — the pre-existing ignore rules already
covered the frontend.

**Independently spot-checked by the orchestrator**, because the type-level i18n guarantee is the one
claim in this phase that a passing test suite could not establish on its own:
`src/lib/i18n/dictionaries.ts` really does bind `es.json` to `ExactDictionary<typeof es>`, and the
`Record<Exclude<keyof T, TranslationKey>, never>` half really is what rejects a surplus key. The
`identifier` in `src-tauri/tauri.conf.json` is `cc.carpio.espansoConfig`, and `Info.plist` declares
`CFBundleLocalizations`. **The four review fixes were checked in the files rather than taken from the
report**: `"permissions": []`, `minimumSystemVersion: "13.0"`, `'unsafe-inline'` present **only** in
`devCsp`, and `custom-protocol` declared in `src-tauri/Cargo.toml`.

**Seven disabling experiments, each broken, fired and reverted** (A–G in the notes): the macOS floor
dropped to 11.0; a duplicate `app.name` in `es.json`; the document language set after mount rather than
before; `index.html` shipping `lang="es"`; `refreshSystem()` emptied (four tests fired); `refreshSystem()`
also clearing the override; and a no-op `dispose()`. Every new test in this round was shown able to fail.

---

## Verification — Phase 1a

All four run by the orchestrator against the working tree, **after** the review fix round:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **471 passed, 0 failed, 0 ignored**, across 15 binaries |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |

Test count moved 465 (baseline `37cb48d`) → 465 (implementation) → **471** (fix round): +3 projection,
+3 workspace. No test was ignored, weakened or deleted. The suite also passes with
`tests/corpus/real/` absent.

**Architecture rule re-verified**: `rg -c tauri Cargo.lock` finds nothing — `espansoconfig-core` still
has no tauri dependency, direct or transitive, after gaining `serde`.

**Privacy re-verified**: `git status --short --untracked-files=all` shows no path under
`tests/corpus/real/`, and every real-corpus figure is computed rather than hard-coded.

**The load-bearing Phase 0 files were checked by the orchestrator directly**, because a change there is
more dangerous than anything in `model/`: the diffs in `syntax/{mod,node,trivia}.rs`, `patch/path.rs`
and `discovery.rs` are **derive-only** (`Serialize`/`Deserialize`), and `watch/mod.rs` adds one
hand-written `Serialize` emitting the revision as its 64-character hex string rather than as 32
numbers. No Phase 0 behaviour changed, and all 465 Phase 0 tests pass unmodified. The reviewer reached
the same conclusion independently.

**The projection sweep:**

| | Synthetic | Real |
|---|---|---|
| Keys accounted for | 546 | 566 |
| …named (modelled or recorded) | 518 | 566 |
| …inside a recorded undescended span | 28 | 0 |
| Unaccounted keys | 0 | 0 |

---

