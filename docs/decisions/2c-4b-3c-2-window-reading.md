# Phase 2c-4b step 3c-2 — the window reading, six write surfaces, *Keep my draft*

The third of the three kinds of evidence `docs/decisions/2c-split-notes.md` §7 requires of every 2c
sub-phase, taken over the reapply path of all six write surfaces — `MatchEditor.svelte`,
`MatchCreator.svelte`, `MatchDeleter.svelte`, `MatchMover.svelte`, `MatchDuplicator.svelte` and
`RawEditor.svelte`. The model tests belong to 2c-4b-2 and the mounted cases to 2c-4b-3a;
**this file is the record of what a screen actually did**, and it is the last deliverable step 3
owes before its fixes.

**This record was rewritten after review round 1**, which returned NOT READY with five High, one
Medium and three Lows (`docs/reviews/phase-2c-4b-3c-2-reading.md`). Two of the Highs were defects in
the *application* that round 1 of this record had graded as sound, one was a miscount that made every
number in the document untrustworthy until re-derived, and one was an inherited limitation this
record had claimed to carry forward and had dropped. **§16 says exactly what changed and what the
recount proved**; every count below is derived from the retained evidence on disk, not carried over.

**The instrument is `docs/decisions/2c-4b-3b-instrument.md` as extended by
`docs/decisions/2c-4b-3c-1-notes.md`, and it was not re-derived.** 3b built the R0→R1 fixture-pair
harness and proved it on eleven cases; 3c-1 added eight cases and the Spanish runnability. **Neither
step judged a screen, and both said so** (3b §8.1, 3c-1 §7.9). This step judges: choice ordering,
focus and scroll reachability, the truth of every new refusal sentence against its predicate, and
the ordinary refusal/acknowledgement round after a successful reapply attempt.

**Seventy-one launches, L40 to L110. Every one printed `--- end`, none printed `--- failed`, every
`probe.err` was zero bytes, and every one satisfied its byte predicate.** `--- end` is a wrapper
signal and not a success signal (§12.2); the four-part conjunction 3b §8.9 defines is still not
mechanised, and a reader supplied it on all seventy-one.

**Every launch ran in a synthetic two-file tree. The owner's real configuration was never opened**,
and nothing quoted below is anything but this run's own hand-authored fixtures and this
application's own strings.

**One High, two Mediums, one Low and five observations.** **No launch ended with a file this
application should not have produced**: 21 launches ended byte-identical to a document authored
before the launch, each with a backup directory; 50 ended byte-identical to R1, each with no backup
directory anywhere in the tree. That is a statement about the **final filesystem state** and about
nothing else — this instrument has no invoke spy and no command counter, so it cannot say when, or
by which command, a file did or did not change (§8, §12.1).

---

## 1. The setup

### 1.1 What was reused, unchanged

`src/probe.ts`, `src-tauri/src/probe.rs`, two hook lines each in `src/main.ts` and
`src-tauri/src/main.rs`, and `<scratch>/launch.sh` with its case table, its fixture tree and its
`launches/` directory. `<scratch>` is
`/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad`,
outside the repository. **`src-tauri/src/probe.rs` did not change at all**, in this step or the last.

The launch recipe is 3b §2 verbatim, and the build order of 3b §6.1 — `npm run build`, then
`touch src-tauri/build.rs`, then `cargo build -p espansoconfig --features custom-protocol` — was
followed after **each** of the four driver edits and before the first launch depending on it.

**3c-1's post-image manifest gave this step the before-image 3c-1 itself lacked, and it was used.**
`shasum -a 256 -c manifest-3c-1-post.sha256` reports **96 files OK and exactly two FAILED**:
`launch.sh` and `src/probe.ts`, the two files this step edited. Every fixture 3c-1 left, both probe
sources' other half, and every retained `probe.log` and `bytes.txt` of L01–L39 are **byte-identical**
to what 3c-1 recorded. That is a verified statement, not the timestamp observation 3c-1 §5.7 had to
settle for. `<scratch>/manifest-3c-2-post.sha256` is this step's own post-image, 243 entries.

### 1.2 What this step added to the instrument, stated as a deviation

**Changing the driver is a deviation and is recorded as one**, because 3c-1 §3 made "the driver had
to change" a recorded fact rather than a silent one. Six additions, all in `src/probe.ts`; nothing
in the application changed.

1. **`reportViewport`** — `window.innerWidth × innerHeight`, `devicePixelRatio`,
   `document.hasFocus()` and `visibilityState`, printed on every launch. **3b §5 could not judge its
   own negative-`y` measurement because the viewport height was in no retained artifact.** It is
   **1180 × 728** on every one of the seventy-one, `hasFocus=false`, `visibility=hidden`.
2. **`reportReach`** — the reading 3b and 3c-1 did not take. Per `role="status"` block: its
   rectangle; the nearest ancestor that *really* scrolls, found by computed `overflow-y` and never
   by "its content is taller than its box" (2c-4a-3c-2 §1.1(4)'s mistake); that scroller's
   `scrollTop`, `scrollHeight` and `clientHeight`; where the block sits against the band the
   viewport and the scroller intersect; and the same after `scrollIntoView`. Per control inside it:
   rectangle, clip, `disabled`, `tabIndex`, and whether `focus({preventScroll:true})` makes it
   `document.activeElement`. Then the pane's focusable elements in document order. **The scroller's
   `scrollTop` is restored afterwards**, so a later measurement in the same plan still sees the
   position the application left.
3. **`reportReadiness`** — a targeted lookup of `browser.reapply.ready` and
   `browser.reapply.readyOperation` inside the outcome panel, by the text the running language gives
   the key. Needed because the match editor's conflict panel draws six fields and the whole file
   before it reaches that sentence, so at 3c-1's 1500-character block limit the editor's transcripts
   held every other surface's copy of it and not the editor's — a gap that looks exactly like the
   sentence not being drawn.
4. **`BLOCK_TEXT_LIMIT` 1500 → 4000**, for the same reason, and 3c-1 §5.6's rule still governs:
   **a quotation is bounded by the artifact, never by what the reader knows the application would
   have drawn.** Every sentence quoted below is quoted from a retained line.
5. **The duplicator's refusal round is reported rather than pressed past.** Q7's closing paragraph
   asks for the refusal/acknowledgement round *after a successful reapply attempt*; 3b and 3c-1
   pressed straight through it.
6. **`repeatIfAsked`, driven by an optional third plan segment `:twice`** — presses the reapply
   control a second time after a refusal. `launch.sh` splits the case off with `${PLAN%%:*}` and
   passes the whole string through, so a third segment needed nothing in the case table.

### 1.3 The one new case, stated as a deviation

**§7.6 is closed: `end` after a reorder is built and run.** 3c-1 handed it to "the next construction
step"; this step built it instead, which is a deviation rather than a silent addition. It cost two
hand-authored fixtures (`reordered-beta-first-r1.yml`, `mover-end-expected.yml`), one row in
`launch.sh`, and a third value for `moverPlan`'s destination parameter — the parameter 3c-1 §3 added
for `mover-after`, now a three-armed `MoverDestination`.

**The R1 had to be new.** Reusing `reordered-r1.yml` — `:gamma`, `:alpha`, `:beta` — would have left
the target already last, so `end` would have written nothing and the case would have measured
`alreadySatisfied` under a placement name. `reordered-beta-first-r1.yml` is `:beta`, `:gamma`,
`:alpha`, each item byte-identical to its R0 lines; the expected file is `:gamma`, `:alpha`,
`:beta`, the target at the end of the **newly parsed** sequence.

**Twenty cases now, and all twenty ran in both languages.** That closes §7.7 for the matrix, the
second deviation: bilingual coverage was eight of nineteen cases when 3c-1 handed over and is
**twenty of twenty** now — counted from the retained ledger, one `en` launch and one `es` launch for
each of the twenty case names.

### 1.4 The four driver revisions, and which launches ran under which

A launch's transcript holds only the lines its driver revision printed. This matters when reading
the ledger and is stated rather than left to be discovered.

| Revision | Launches | What it prints that the one before does not |
|---|---|---|
| A | L40 | `--- viewport`; `reportReach` with `lastControlAfterScroll` |
| B | L41–L80 | `lastControlScrolledTo` — the control scrolled to **in its own right** |
| C | L81–L94 | `reportReadiness`; `BLOCK_TEXT_LIMIT` 4000 |
| D | L95–L106 | `activeElement`, read **before** anything in the probe focuses anything |
| E | L107–L110 | `secondPress` and the `afterSecond` reach |

**L40 is a smoke launch of revision A and nothing else**: it reproduced L02's byte result and its
three revision digests on the current machine, and its `lastControlAfterScroll` line is superseded
by revision B's.

### 1.5 The launch ledger

Seventy-one launches. Every one: `--- end` present, `--- failed` absent, `probe.err` zero bytes,
`bytes=MATCH`. *Ended at* names the file the launch's own `cmp` matched; `= R1` means the fixture
file was byte-identical to what the second writer had installed. Evidence for launch `Lnn` is
`<scratch>/launches/Lnn/` — `probe.log`, `probe.err`, `bytes.txt`, `xdg/`, `xdg-before/`,
`espansoConfig.app`.

| # | Case | Lang | Surface | What it was for | Arm | Ended at |
|---|---|---|---|---|---|---|
| L40 | `editor-exact` | en | editor | smoke, revision A | reapplied | authored, backup present |
| L41 | `editor-exact` | en | editor | Q7-1 exact positive | reapplied | authored, backup present |
| L42 | `editor-exact` | es | editor | Q7-1 exact positive | reapplied | authored, backup present |
| L43 | `editor-fallback` | en | editor | Q7-2 fallback positive | reapplied | authored, backup present |
| L44 | `editor-fallback` | es | editor | Q7-2 fallback positive | reapplied | authored, backup present |
| L45 | `editor-satisfied` | en | editor | Q7-3 `alreadySatisfied` | alreadySatisfied | = R1, backups none |
| L46 | `editor-satisfied` | es | editor | Q7-3 `alreadySatisfied` | alreadySatisfied | = R1, backups none |
| L47 | `editor-collision` | en | editor | Q7-3 field collision | manualResolution | = R1, backups none |
| L48 | `editor-collision` | es | editor | Q7-3 field collision | manualResolution | = R1, backups none |
| L49 | `editor-ambiguous` | en | editor | Q7-5 ambiguous trigger | manualResolution | = R1, backups none |
| L50 | `editor-ambiguous` | es | editor | Q7-5 ambiguous trigger | manualResolution | = R1, backups none |
| L51 | `editor-missing` | en | editor | Q7-4 removed target | manualResolution | = R1, backups none |
| L52 | `editor-missing` | es | editor | Q7-4 removed target | manualResolution | = R1, backups none |
| L53 | `creator-front` | en | creator | Q7-7 targetless positive | reapplied | authored, backup present |
| L54 | `creator-front` | es | creator | Q7-7 targetless positive | reapplied | authored, backup present |
| L55 | `creator-anchor` | en | creator | Q7-7 changed anchor | manualResolution | = R1, backups none |
| L56 | `creator-anchor` | es | creator | Q7-7 changed anchor | manualResolution | = R1, backups none |
| L57 | `creator-anchor-gone` | en | creator | Q7-7 deleted anchor | manualResolution | = R1, backups none |
| L58 | `creator-anchor-gone` | es | creator | Q7-7 deleted anchor | manualResolution | = R1, backups none |
| L59 | `deleter-exact` | en | deleter | Q7-1 exact positive | reapplied | authored, backup present |
| L60 | `deleter-exact` | es | deleter | Q7-1 exact positive | reapplied | authored, backup present |
| L61 | `deleter-changed` | en | deleter | Q7-1 strict refusal | manualResolution | = R1, backups none |
| L62 | `deleter-changed` | es | deleter | Q7-1 strict refusal | manualResolution | = R1, backups none |
| L63 | `duplicator-exact` | en | duplicator | Q7-1 positive **and the acknowledgement round** | reapplied | authored, backup present |
| L64 | `duplicator-exact` | es | duplicator | the same, in Spanish | reapplied | authored, backup present |
| L65 | `duplicator-changed` | en | duplicator | Q7-1 strict refusal | manualResolution | = R1, backups none |
| L66 | `duplicator-changed` | es | duplicator | Q7-1 strict refusal | manualResolution | = R1, backups none |
| L67 | `mover-exact` | en | mover | Q7-1 exact positive | reapplied | authored, backup present |
| L68 | `mover-exact` | es | mover | Q7-1 exact positive | reapplied | authored, backup present |
| L69 | `mover-changed` | en | mover | Q7-1 strict refusal | manualResolution | = R1, backups none |
| L70 | `mover-changed` | es | mover | Q7-1 strict refusal | manualResolution | = R1, backups none |
| L71 | `mover-reordered` | en | mover | Q7-6 `top` after a reorder | reapplied | authored, backup present |
| L72 | `mover-reordered` | es | mover | Q7-6 `top` after a reorder | reapplied | authored, backup present |
| L73 | `mover-reordered-end` | en | mover | **Q7-6 `end` after a reorder — new** | reapplied | authored, backup present |
| L74 | `mover-reordered-end` | es | mover | **Q7-6 `end` after a reorder — new** | reapplied | authored, backup present |
| L75 | `mover-after` | en | mover | Q7-6 resolvable `after` | reapplied | authored, backup present |
| L76 | `mover-after` | es | mover | Q7-6 resolvable `after` | reapplied | authored, backup present |
| L77 | `mover-after-changed` | en | mover | Q7-6 changed anchor | manualResolution | = R1, backups none |
| L78 | `mover-after-changed` | es | mover | Q7-6 changed anchor | manualResolution | = R1, backups none |
| L79 | `raw-negative` | en | raw | Q7-8 negative capability | none — no control | = R1, backups none |
| L80 | `raw-negative` | es | raw | Q7-8 negative capability | none — no control | = R1, backups none |
| L81 | `editor-collision` | en | editor | readiness sentence, revision C | manualResolution | = R1, backups none |
| L82 | `editor-collision` | es | editor | readiness sentence | manualResolution | = R1, backups none |
| L83 | `editor-exact` | en | editor | readiness beside a positive | reapplied | authored, backup present |
| L84 | `editor-exact` | es | editor | readiness beside a positive | reapplied | authored, backup present |
| L85 | `raw-negative` | en | raw | readiness **absent** check | none — no control | = R1, backups none |
| L86 | `raw-negative` | es | raw | readiness **absent** check | none — no control | = R1, backups none |
| L87 | `creator-anchor` | en | creator | readiness branch | manualResolution | = R1, backups none |
| L88 | `creator-anchor` | es | creator | readiness branch | manualResolution | = R1, backups none |
| L89 | `deleter-changed` | en | deleter | readiness branch | manualResolution | = R1, backups none |
| L90 | `deleter-changed` | es | deleter | readiness branch | manualResolution | = R1, backups none |
| L91 | `duplicator-changed` | en | duplicator | readiness branch | manualResolution | = R1, backups none |
| L92 | `duplicator-changed` | es | duplicator | readiness branch | manualResolution | = R1, backups none |
| L93 | `mover-changed` | en | mover | readiness branch | manualResolution | = R1, backups none |
| L94 | `mover-changed` | es | mover | readiness branch | manualResolution | = R1, backups none |
| L95 | `editor-collision` | en | editor | focus, revision D | manualResolution | = R1, backups none |
| L96 | `editor-collision` | es | editor | focus | manualResolution | = R1, backups none |
| L97 | `creator-anchor` | en | creator | focus | manualResolution | = R1, backups none |
| L98 | `creator-anchor` | es | creator | focus | manualResolution | = R1, backups none |
| L99 | `deleter-changed` | en | deleter | focus | manualResolution | = R1, backups none |
| L100 | `deleter-changed` | es | deleter | focus | manualResolution | = R1, backups none |
| L101 | `duplicator-changed` | en | duplicator | focus | manualResolution | = R1, backups none |
| L102 | `duplicator-changed` | es | duplicator | focus | manualResolution | = R1, backups none |
| L103 | `mover-changed` | en | mover | focus | manualResolution | = R1, backups none |
| L104 | `mover-changed` | es | mover | focus | manualResolution | = R1, backups none |
| L105 | `raw-negative` | en | raw | focus | none — no control | = R1, backups none |
| L106 | `raw-negative` | es | raw | focus | none — no control | = R1, backups none |
| L107 | `editor-collision:twice` | en | editor | **the second press**, revision E | manualResolution ×2 | = R1, backups none |
| L108 | `editor-collision:twice` | es | editor | the second press | manualResolution ×2 | = R1, backups none |
| L109 | `mover-changed:twice` | en | mover | the second press | manualResolution ×2 | = R1, backups none |
| L110 | `mover-changed:twice` | es | mover | the second press | manualResolution ×2 | = R1, backups none |

**Balance and totals, all counted from the retained artifacts** (§8 says how):

- **36 English, 35 Spanish.** Twenty distinct cases; every one of the twenty ran in both languages.
- **Arms: 21 `reapplied`, 2 `alreadySatisfied`, 42 `manualResolution`, 6 raw launches with no reapply
  control at all.** 21 + 2 + 42 + 6 = 71, so every launch is accounted for by exactly one arm.
- **Final state: 21 ended at authored bytes with a backup directory, 50 ended at R1 with none.**
  21 + 50 = 71, and the two partitions agree: the 21 `reapplied` launches are exactly the 21 that
  ended at authored bytes.

Every user-facing sentence judged below was judged in both languages.

---

## 2. Item 1 — choice ordering. **PASS on all six surfaces, both languages**

`conflictChoicesFor` (`src/lib/browser/saveOutcome.ts:454`) is the only producer of a choice list,
and Q6 asks for `keepMyDraft` **after** *Keep editing* and the copy and **before** the reload. Read
off a screen, in document order, with each control's own rectangle:

| Surface | English (launch) | Spanish (launch) |
|---|---|---|
| editor | Keep editing · Copy my text · **Keep my draft** · Load the version on disk (L41) | Seguir editando · Copiar mi texto · **Conservar mi borrador** · Cargar la versión del disco (L42) |
| creator | Keep editing · Copy my text · **Keep my draft** · Load the version on disk (L53) | the same four (L54) |
| deleter | Leave this as it is · **Keep what I asked for** · Load the version on disk (L59) | Dejarlo como está · **Conservar lo que he pedido** · Cargar la versión del disco (L60) |
| duplicator | the same three (L63) | the same three (L64) |
| mover | the same three (L67) | the same three (L68) |
| raw | Keep editing · Copy my text · Load the version on disk (L79) | Seguir editando · Copiar mi texto · Cargar la versión del disco (L80) |

Three things this establishes, each read rather than inferred:

- **The order is Q6's on all five surfaces that offer it**, in both languages. The reapply control is
  third of four where a copy is offered and second of three where it is not; the reload is last
  everywhere.
- **`Copy my text` is absent on exactly the three `operationChoice` surfaces**, which is consult Q4
  refusing a copy for a `MovePlacement` or a `MatchId` as a property of the drafted value.
  `keepMyDraft=absent keepMyRequest=present` on those three and the reverse on the other two, printed
  by the driver on every launch.
- **The raw editor offers neither label, in either language** — `keepMyDraft=absent
  keepMyRequest=absent`, across all six raw launches, and §3 shows it draws no readiness sentence
  either. Q7 point 8's negative capability, on a screen.

*Leave this as it is* / *Dejarlo como está* on the three operation-choice surfaces is
2c-4a-3c-2 §10.2's Medium, fixed and still fixed.

---

## 3. Item 2 — the readiness sentence and its branch. **PASS, both languages**

`reapplySentenceKey` picks `browser.reapply.ready` for a surface that drafts authored text and
`browser.reapply.readyOperation` for one that drafts an operation. Asked of the panel by the key's
own text, so *absent* means absent:

| Surface | `ready` | `readyOperation` | Its box, en / es | Launches |
|---|---|---|---|---|
| editor | **present** | absent | 667,921,472×119 / ×154 | L81, L82 |
| creator | **present** | absent | 667,735,472×119 / ×154 | L87, L88 |
| deleter | absent | **present** | 667,612,472×137 / ×154 | L89, L90 |
| duplicator | absent | **present** | 667,612,472×137 / ×154 | L91, L92 |
| mover | absent | **present** | 667,613,472×137 / ×154 | L93, L94 |
| raw | absent | absent | — | L85, L86 |

**The sentence stands directly above the control it is about** on all five: the editor's ends at
y = 1040 and the choices are at 1046; the mover's ends at 750 and the choices are at 754. Q6's
requirement is met by position as well as by content.

**Judged against Q6's list of what it must say**, English:

> espansoConfig will **try** to apply the changes you kept to the version of this file on disk shown
> above, **working from that newly parsed document**. **Nothing is written if** the snippet this
> change is about, or any field you changed, **cannot be matched safely**. If they can be matched
> safely, this may end with the disk version **already holding** the changes you asked for and
> nothing left to send, or with a form for you to send — and **that save can still be refused, or
> meet another change to the file and conflict again**. However it ends, you are told, and nothing
> is written until you send something.

All five of Q6's requirements are present: *try*; the newly parsed document; nothing written when a
match is unsafe; a later refusal or conflict still possible; and — the one Q9 named as the most
likely lie — the `alreadySatisfied` outcome is disclosed **before** it happens rather than folded
into "all changes reapplied". None of Q6's prohibitions is breached: it does not claim the same
snippet has been found, that every draft can be kept, that fields will merge, that nothing else
changed, that the next save will succeed, or that espanso will accept the result.

`readyOperation` is the same sentence with *the action you requested* for *the changes you kept* and
*the position it needs* for *any field you changed*, which is 2c-4a-3b's finding — *typed text*
describes nothing a mover, a deleter or a duplicator ever produced — applied rather than
rediscovered.

**The Spanish carries the same five clauses**, checked against the retained text rather than assumed:
*intentará aplicar* (try), *partiendo de ese documento recién analizado*, *No se escribe nada si … no
se puede emparejar con seguridad*, *ya contenga los cambios que pidió y no quede nada por enviar*, and
*ese guardado todavía puede rechazarse, o encontrarse con otro cambio del archivo y volver a entrar en
conflicto*. Its only defect is the register, §11.2.

**§11.2 is what is wrong with the Spanish of both.**

---

## 4. Item 3 — focus and scroll reachability. **PASS on reachability; two facts, one of them §11.1**

Measured at **1180 × 728**, the viewport WebKit reports, with `section.detail` the only real
scroller on every surface (computed `overflow-y: auto`, `clientHeight` 645, top at y = 44, so the
band a person sees is **[44, 689]**).

### 4.1 Where the conflict panel lands, and where its controls land

| Surface | Panel, en | Panel, es | Choices row, en | Choices row, es | Choices visible? |
|---|---|---|---|---|---|
| editor | 491×1032 at y = 44 | 491×1094 at y = 44 | y = 1046 | y = 1079 **and 1107** | **no** |
| creator | 491×846 at y = 44 | 491×908 at y = 44 | y = 859 | y = 894 **and 921** | **no** |
| deleter | 491×741 at y = 44 | 491×758 at y = 44 | y = 754 | y = 771 | **no** |
| duplicator | 491×741 at y = 44 | 491×758 at y = 44 | y = 754 | y = 771 | **no** |
| mover | 491×741 at y = 44 | 491×758 at y = 44 | y = 754 | y = 771 | **no** |
| raw | 491×493 at y = 196 | 491×493 at y = 196 | y = 658 | y = 658 | **yes** |

The panel's **first line** is at the top of the band on all five match surfaces, which is
`outcomeReveal`'s `conflictPanel` cue doing exactly what 2c-4a-3c-4 built it to do. The panel is
taller than the 645-pixel band on all five, so its controls are below it. On the raw editor the whole
panel fits and everything is visible without scrolling.

**In Spanish the editor's and the creator's four choices no longer fit one row and wrap** — the
reload lands on a second line, 28 pixels lower. Layout, not a defect; recorded because 2c-4a's panels
had three controls and these have four.

### 4.2 Every drawn control is reachable, and every one takes focus

For each control inside a status block the driver printed `disabled`, `tabIndex`, whether
`focus({preventScroll:true})` made it `document.activeElement`, and its clip both before and after
being scrolled to in its own right.

- **`disabled=false` and `tab=0` on every conflict-panel control, on all six surfaces, in both
  languages.** No control was drawn disabled anywhere in this reading.
- **`focusable=true` on every one of them.**
- **Scrolling the last control of a panel into view succeeds on all six surfaces in both
  languages.** `section.detail`'s `scrollHeight` is between 818 and 1925 against a `clientHeight` of
  645, and the scroll needed is always available. Where the transcript says `clip=partial` after that
  scroll — deleter, duplicator and the Spanish mover — the control's bottom is at y = 690 against a
  band bottom of 689: **one pixel, from the scroller's border rounding, not a clipped control.**
- **Document order and `tabIndex` are consistent with the tab order a person would get**, and they
  put the choices immediately after the surface's own controls: on the editor, `… | Undo | Keep
  editing | Copy my text | Keep my draft | Load the version on disk` (L41). Nothing carries a
  positive `tabindex`, so nothing would jump the queue. **No `Tab` key was ever sent, so real
  traversal is untested** — this is DOM order plus `tabIndex`, and it is consistent with the expected
  tab order rather than a measurement of it (§12.5).

**What this is not.** `HTMLElement.click()` is not a mouse click and no plan pressed a key. What is
established is programmatic focusability, `tabIndex` and DOM order — the strongest proxy this
instrument has for keyboard operability and **not** keyboard operability itself.

### 4.3 Nothing moves focus into the panel

Read before the probe focused anything, on all six surfaces in both languages (L95–L106):

```
L95  editor      conflict activeElement=textarea.text
L97  creator     conflict activeElement=textarea.text
L99  deleter     conflict activeElement=body
L101 duplicator  conflict activeElement=body
L103 mover       conflict activeElement=body
L105 raw         conflict activeElement=textarea.text
```

**The application does not move focus to the conflict panel when it appears.** On the three
operation-choice surfaces nothing in the document is focused at all. For a `role="status"` region
that is the defensible behaviour and this reading does not call it a defect; it is recorded because
it is the other half of *nothing takes you there* (§11.1). Where focus actually sits after a **real**
mouse click on *Save this snippet* is not measurable here: a synthetic click does not focus its
target, so the `textarea` readings above are the probe's own last `type()` and not the application's
doing.

---

## 5. Item 4 — every new refusal sentence, judged against its predicate

Q9's first prediction is that *a sentence will claim a guarantee the predicate does not give*, and
the i18n suites check keys and placeholders and never meaning. Each sentence below was read from a
retained transcript and compared with the code that produces it.

**Two rules govern every verdict in this section, and round 1 of this record broke both.**

1. **A verdict is about the whole predicate, not about the arms this reading happened to reach.** An
   arm that no launch produced cannot be validated by its absence. Where a sentence is right for the
   arms drawn and wrong for an arm that was not, the verdict is **overclaims**, and §11 gets a
   finding. §5.2 is that case.
2. **A claim about *when* something happened, or about *which command* ran, is never the probe's.**
   This instrument has no invoke spy and no command counter. Such claims appear below only where they
   are attributed to **static inspection of named source**, and they are never supported by the byte
   check, which sees one final state and no history.

### 5.1 `browser.reapply.manualResolution` — **true**

> espansoConfig applied nothing. Nothing was written, this window was not moved, and what you kept is
> still here exactly as it was. The reason follows.

Drawn in 42 launches across five surfaces and both languages. Three claims, three predicates:

- *this window was not moved* — **established by static inspection, precisely.** In each of the five
  transitions every `manualResolution` return is an early return that precedes the single
  `adoptForReapply` call: `matchEditor.ts:2062-2078` before `:2079`, `matchCreation.ts:1600-1632`
  before `:1634`, `matchDeletion.ts:915-925` before `:929`, `matchMove.ts:1808-1828` before `:1830`,
  `matchDuplication.ts:1194-1208` before `:1212`. No adoption is reached on this arm.
- *what you kept is still here exactly as it was* — `attemptOfReapply`
  (`src/lib/browser/reapply.ts:540-547`) returns the **held** session for every arm but `reapplied`
  and `alreadySatisfied`. On screen: the conflict panel after the refusal is at the same rectangle
  with the same four controls at the same coordinates as before the press (L47: `667,1046` both
  times).
- *Nothing was written* — **two separate supports, and neither is a command observation.** By static
  inspection, the five transitions are pure functions that call no command, and each of the five
  handlers that call them **synchronously calls model and local helpers, assigns component state, and
  invokes no IPC command** — `MatchEditor.svelte:504-508`, `MatchCreator.svelte:460-464`,
  `MatchDeleter.svelte:333-338`, `MatchMover.svelte:539-543`, `MatchDuplicator.svelte:467-471`. That
  is what holds across all five and is the whole of what is claimed: **the five are not one shape**,
  and round 1 of this record said they were. The deleter's has a third assignment
  (`confirmationRefused = false`), and the mover's and the duplicator's each call a further draft
  getter (`unsavedDraftFor()`, `unsavedDraftInDocument()`) before the transition. By measurement, all
  42 launches **ended** with the file byte-identical to R1 and with no `.espansoconfig-backups`
  directory anywhere in the tree. The measurement is a final state and not a history: an identical or
  transient write would leave the same artifacts (§12.1).

**Corroborated on screen by an absence, on the four surfaces where an absence means anything.** An
adoption repairs the selection and raises a notice — but only when a selection is held, and **the
creator's plan holds none**, which is why its two *successful* adoptions (L53, L54) drew no notice
either (§9). So the corroboration is limited to the **34** refusal launches on the editor (12), the
mover (10), the deleter (6) and the duplicator (6), whose plans select `:beta` before they begin:
none of the 34 drew a notice, and an adoption on any of them would have. **The creator's eight
refusals corroborate nothing here**, and round 1 of this record drew all 42 into the claim.

### 5.2 `browser.matchEditor.reapply.fieldCollisions` — **OVERCLAIMS; §11.5**

> The version on disk has changed fields that you had changed too, so espansoConfig will not choose
> between them: Replacement text.

Drawn in eight launches (L47, L48, L81, L82, L95, L96, L107, L108), and **in every one of them it was
true**: `target-changed-r1.yml` changes the same field the draft changed, to a third value.

**It is not true of its predicate.** `fieldReapply` (`src/lib/browser/matchEditor.ts:1835-1854`)
answers `collision` whenever the intent is not `Unchanged`, `sameBaselineState` is false, and the new
state does not already satisfy the intent — and `sameBaselineState` (`:1794-1800`) compares **three**
things: presence, value **and eligibility**. The function's own contract table (`:1805-1814`) spells
the last row out: *`Set`/`Remove` | anything else, **or newly ineligible** | `collision`*. So a field
whose **value on disk did not change at all** produces this sentence when the projection has made it
ineligible, and in the sharpest sub-case the disk holds **exactly the drafted value** while being
ineligible — where *"will not choose between them"* names a choice that does not exist.

Round 1 of this record graded this **true** on the strength of the eight launches. That is the
reasoning §5's rule 1 now forbids, and the finding is §11.5.

### 5.3 `code.reapplyRefusal.ambiguousTrigger` — **true, and carefully hedged**

> The trigger of this change's snippet is spelled the same on more than one snippet — in the file as
> it was, in the file as it is now, or in both — so it identifies nothing.

L49, L50. The three-way disjunction is the sentence declining to say **which** side the duplication
was on, which is exactly what the code knows and no more.

### 5.4 `code.reapplyRefusal.targetMissingOrTriggerChanged` — **true, and the hedge is load-bearing**

> No snippet in that list is written the way this change's was, and none spells its trigger the way
> the file spelled it. The snippet **may** have been removed, or its trigger **may** have been
> rewritten or respelled.

L51, L52 (`editor-missing`, where R1 really did remove the target). The first sentence is a fact
about the search; the second is offered as a possibility and not as a diagnosis. Removing the hedge
would be the defect; it is not removed.

### 5.5 `code.reapplyRefusal.noExactCorrespondence` — **true**

> No snippet in that list carries the exact owned-line correspondence evidence recorded for this
> change. This operation or positional anchor requires exact owned-line correspondence, so nothing
> weaker will do.

L55–L58, L61, L62, L65, L66, L69, L70, L77, L78 and their revision-C/D twins — the deleter, the
duplicator, the mover and both of the creator's anchor cases, in both languages. It states the
negative result and the policy, and attributes nothing.

### 5.6 The two shared obstacle lines pick the right half — **true, and this narrows 3c-1 §5.5**

The line above the wire refusal is `browser.reapply.obstacle.correspondence` — *could not identify
the snippet this change is about* — or `…obstacle.anchorCorrespondence` — *could not identify, in the
version on disk, the snippet this one was to be placed after*. Which one is drawn is observable, and
it is right in **each of the nine refusal cases this reading ran** — which is a statement about those
nine and not about the rule in general:

| Case | Half drawn | Why that is the right half |
|---|---|---|
| `editor-collision`, `editor-ambiguous`, `editor-missing` | subject | the fixture changed or removed the target |
| `deleter-changed`, `duplicator-changed`, `mover-changed` | subject | the fixture changed the target's own lines |
| `creator-anchor`, `creator-anchor-gone` | **anchor** | a creation has no subject; only its placement can refuse |
| `mover-after-changed` | **anchor** | the fixture changes `:gamma` and leaves `:beta` byte-identical |

3c-1 §5.5 recorded that `mover-after-changed`'s refusal came from the placement as an **inference**
the transcript did not state. The transcript states it now: L77 and L78 draw the anchor line and not
the subject line, over a fixture whose subject is untouched.

### 5.7 The two positive sentences — **`reapplied` true; `alreadySatisfied` judged only for the editor**

`browser.reapply.reapplied` — *This window now shows the version on disk, with what you kept set up
over it. Nothing has been written yet: send it when you are ready, and that save can still be refused
or conflict.* Drawn in 21 launches on all five match surfaces in both languages. *This window now
shows the version on disk* holds for both adoption answers, since `installed` and `alreadyThere` both
mean the window holds the snapshot. *Nothing has been written yet* is a claim about the moment the
sentence is drawn, and **this reading cannot time it**: what the artifacts show is that the launch
**ended** at the authored bytes with a backup directory, after the plan had pressed the surface's
send control. The ordering claim rests on the transitions being pure functions that call no command
(§5.1's citations) and not on the byte check.

`browser.reapply.alreadySatisfied` — *This window now shows the version on disk, and that version
already holds what you asked for, so there is nothing left to send. Nothing was written.* L45, L46,
**the editor only**. On that surface the arm is `planMatchReapply`'s `writesAnything === false`
(`matchEditor.ts:2082-2084`), and the screen corroborates it: after this arm the editor's focusable
list holds no *Save this snippet* and no *Undo*, the launch ended at R1 and no backup exists. A
sentence saying *there is nothing left to send* beside a live send control would have been the
defect; there is no live send control. **The other four surfaces' `alreadySatisfied` arms were never
drawn and are not judged here** (§12.9).

---

## 6. Item 5 — the ordinary refusal/acknowledgement round after a successful reapply. **PASS, both languages**

The duplicator is the one surface whose ordinary path carries an acknowledgeable finding, so it is
where Q7's closing clause is answerable. L63 (en), L64 (es): conflict → *Keep what I asked for* →
`reapplied` → *Duplicate this snippet* → **refusal with a finding** → *Save anyway* → the launch ends
at the authored bytes.

```
L63 duplicator refusalRound block[1] box=658,337,508x145 clip=in
    "Nothing was written. The file on disk is exactly as it was. The result contains something that
     looks wrong. Saving it needs your confirmation first. What the check found: The duplicate keeps
     the same trigger definition as its source, and espansoConfig cannot determine how espanso
     chooses between overlapping definitions.  Save anyway   Leave this as it is"
L63 duplicator refusalRound ctl[1] "Save anyway"        box=667,452,85x23  clip=in  focusable=true
L63 duplicator refusalRound ctl[1] "Leave this as it is" box=758,452,108x23 clip=in focusable=true
L63 duplicator final "The file was written. What is on disk now is exactly the text that was sent.…
     This snippet has been copied.…"
```

Four things this establishes:

- **The ordinary round is undisturbed by the reapply.** The finding is
  `DuplicateKeepsTriggerDefinition`, content-addressed to the candidate, and it had to be
  acknowledged again — the consent collected before the conflict did not carry it.
- **The refusal panel is entirely in view** on both languages (`clip=in`, no scroll needed): once the
  conflict panel is gone the pane's content fits. This is the one panel of this reading that needs no
  scrolling at all.
- **`Leave this as it is` is the operation-choice label here too**, so 2c-4a-3c-3's fix reaches the
  refusal choices and not only the conflict choices.
- **The launch ends at the authored bytes.** `duplicator-exact-expected.yml` matched in both
  languages, with the external writer's own change to `:alpha` intact and a backup directory present.

Two smaller rounds, read on their own surfaces:

- **The deleter's renewed confirmation is real and visible.** After a reapply the deleter offers
  *Leave this alone* and *Delete this snippet* — the **request**, not the confirmation (L59, L60). A
  destructive action re-established over a newly parsed document has to be asked for again, which is
  consult Q4 on a screen.
- **The mover's destinations are rebuilt against the new sequence.** After L67's reapply the list
  offers *At the top of the list · After :alpha · After :gamma · At the bottom of the list* — the
  anchors of R1's order, not R0's. The bytes carry the rest: L75 ended with the target placed after
  the item R1 spells `:gamma`, which is **first** in R1 and was **last** in R0.

---

## 7. The Q7 matrix

One row per surface × language × reading. *Ended at* is `bytes.txt`'s verdict; *Panel* is whether the
arm and its sentence were drawn and read.

| Q7 | Reading | Surface | en | es | Verdict |
|---|---|---|---|---|---|
| 1 | exact positive | editor | L41 | L42 | **PASS** — reapplied, sent, ended at authored bytes |
| 1 | exact positive | deleter | L59 | L60 | **PASS** — renewed confirmation, then authored bytes |
| 1 | exact positive | duplicator | L63 | L64 | **PASS** — and the acknowledgement round (§6) |
| 1 | exact positive | mover | L67 | L68 | **PASS** |
| 1 | reorder: the target moves, not its former index | mover | L71 | L72 | **PASS** — ended at `:beta,:gamma,:alpha`; lifting index 1 would have given `:alpha,:gamma,:beta` |
| 1 | strict refusal | deleter | L61 | L62 | **PASS** — `noExactCorrespondence`, ended at R1 |
| 1 | strict refusal | duplicator | L65 | L66 | **PASS** |
| 1 | strict refusal | mover | L69 | L70 | **PASS** |
| 2 | fallback positive, undrafted field survives | editor | L43 | L44 | **PASS** — the second writer's single-quoted `label:` line survives verbatim and only `replace` is patched |
| 3 | field collision names the field | editor | L47 | L48 | **PASS** on the arm, the field name and the bytes; **the sentence overclaims its predicate — §11.5** |
| 3 | `alreadySatisfied`, not a collision | editor | L45 | L46 | **PASS** — its own sentence, no send control left, ended at R1 |
| 4 | target removed | editor | L51 | L52 | **PASS** on refusal and final state; *no save command issued* is **not observable** (§12.1) |
| 5 | ambiguous trigger | editor | L49 | L50 | **PASS** — refuses rather than choosing the old position |
| 6 | `top` after a reorder | mover | L71 | L72 | **PASS** |
| 6 | **`end` after a reorder** | mover | **L73** | **L74** | **PASS** — new case; ended at `:gamma,:alpha,:beta` |
| 6 | resolvable `after` anchor | mover | L75 | L76 | **PASS** — anchor resolved in R1's order |
| 6 | anchor whose bytes changed | mover | L77 | L78 | **PASS** — refuses, anchor half named, ended at R1 with no backup |
| 7 | targetless positive, `front` | creator | L53 | L54 | **PASS** — destination rechecked, ended at authored bytes |
| 7 | anchor changed | creator | L55 | L56 | **PASS** — anchor half named, ended at R1 |
| 7 | anchor deleted | creator | L57 | L58 | **PASS** — anchor half named, ended at R1 |
| 8 | no reapply control on the raw editor | raw | L79, L85, L105 | L80, L86, L106 | **PASS** — neither label, neither readiness sentence |
| — | choice ordering | all six | §2 | §2 | **PASS** |
| — | focus and scroll reachability | all six | §4 | §4 | **PASS** on reachability; §11.1 on what is not reached; real `Tab` untested |
| — | every new refusal sentence | all six | §5 | §5 | **PASS on five of six**; `fieldCollisions` overclaims (§11.5), and the selection notice beside a reapply is false (§11.3) |
| — | refusal/acknowledgement round after a reapply | duplicator | L63 | L64 | **PASS** |

---

## 8. The final filesystem state

Every launch compared the fixture file against what its case must leave behind, searched the whole
synthetic tree for `.espansoconfig-backups`, and diffed the tree against a pristine copy taken
immediately before it.

- **21 launches ended with the file byte-identical to a document authored before the launch**, each
  with a backup directory present.
- **50 launches ended with the file byte-identical to R1**, each with **no `.espansoconfig-backups`
  directory anywhere in the tree** and a tree diff equal to the second writer's own change and
  nothing else. That includes the two `alreadySatisfied` launches, the 42 `manualResolution`
  launches — of which four pressed the control twice — and the six raw negatives.
- **No launch ended at bytes its case did not predict**, and no launch of this step failed or was
  discarded.

**This is the final filesystem state and nothing more.** There is still no invoke spy and no command
counter, so *a refusal issued no save command* is not established here, and neither is *when* any
file changed; a write producing identical bytes, or a transient one undone before the launch ended,
would leave the same artifacts. 3b §8.11 and 3c-1 §7.0 are unchanged.

**How these numbers were derived, and the count they replace.** Each figure above is a count over the
retained `bytes.txt` of `<scratch>/launches/L40`…`L110`: a launch is counted as *authored* when its
`bytes=MATCH against …` names an `*-expected.yml` file, and as *R1* otherwise. The two partitions
were cross-checked against the independent `backups=` line and agree exactly — **21 `PRESENT`, 50
`none`**. Round 1 of this record said **28 and 43**, which is wrong and was not derived from the
ledger at all; the review caught it, and 21/50 is what the evidence says. The rest of §8 through §11
was then re-counted from the same evidence rather than patched, which is what turned round 1's
"eighteen `manualResolution` launches" into **42**, its "sixteen positive launches" in §10 into
**21**, its "six editor positives" into **nine** and its "ten deleter, duplicator and mover
positives" into **twelve**. **A miscount in one total is a reason to distrust every total**, and
§16 lists the ones that moved.

---

## 9. The standing negative-`y` finding: **judged, and it is §11.1's Medium**

3b measured a status block at a negative `y` in nine of twenty-three launches and said "reading
finding for 3c". 3c-1 measured it again in eight more and said "3c-2's judgement, not this record's".
It is judged here.

**The verdict is that it is a real defect of one specific kind, Medium, and that the two things
measured at a negative `y` are two different things that must not be fixed as one.**

**The first is the reapply report on a refusal, and that is the defect.** In **all 42**
`manualResolution` launches — five surfaces, both languages, four driver revisions — the block that
says *espansoConfig applied nothing … The reason follows* is drawn **entirely above the visible
band**: `clip=above` in 42 of 42, at y ∈ {−53, −70, −87, −104}, its bottom edge above the band's top
of 44. It is reachable: `scrollIntoView` brings it to y = 44 in every case. **Nothing takes a person
there**, and nothing else on screen changes. §11.1 has the mechanism, the severity argument and the
file:line.

**The second is the selection-repair banner on a success, and that is not this defect.** Of the 23
launches whose reapply adopted, 21 drew a selection notice (the creator's two hold no selection, so
there is nothing to repair). It is above the band on the **nine editor** ones (y between −85 and
−184, `clip=above`) and comfortably in view at y = 58 on the **twelve** deleter, duplicator and mover
ones. It is above the fold only where the surface's own form is tall enough to keep the scroller
down; the same block on a shorter surface is visible. **Its own problem is §11.3, which is about what
it says, not where it is** — and §11.3 is a High. A fix aimed at the reapply report will move this one
too, and that is fine; but the two were counted together in both earlier records, and they are not
one finding.

**Why this was invisible to every other kind of evidence.** The report block is a second
`role="status"` panel drawn immediately **before** the outcome panel in all five components. The
reveal machinery knows only about the outcome panel: `outcomeReveal`
(`src/lib/browser/saveOutcome.ts:1711`) maps a save arm to one of five cues and has no arm for a
reapply report, and `revealOutcome` (`src/lib/components/reveal.ts:87`) is only ever handed
`outcomePanel` and `outcomeChoices`. Neither a model test nor a mounted test can fail for this,
because neither has a viewport.

**What is not distinguishable from these artifacts**, and is not claimed: whether the outcome panel
stays at y = 44 because WebKit's scroll anchoring compensated for the inserted block, or because the
`$effect` re-ran and re-revealed the same panel. `section.detail`'s `scrollTop` moved from 666 to 763
in L47 — exactly the inserted block's height plus its gap — which is consistent with either. The
finding does not depend on which: no cue in the application points at the report, under either
mechanism.

---

## 10. The selection-repair banner: **diagnosed, and it is a false sentence**

3c-1 §7.8 recorded that the banner said *"what is now in that position is a different snippet, so the
selection was cleared"* in L25–L29 where L24's said *"the snippet you had selected was found again"*,
and made no defect claim and no diagnosis. **This step diagnoses it.**

The arm drawn is decided by `reresolve` in `src/lib/browser/selection.ts:176-193`:

```ts
const candidate = view.matches[previous.position];
if (candidate === undefined)                                 return { outcome: 'gone' };
if (matchFingerprint(candidate) !== previous.fingerprint)    return { outcome: 'differentMatch' };
return { outcome: 'sameMatch', … };
```

and `matchFingerprint` (`:109-111`) is `match.source_text`. So the predicate is **the index the
selection was held at, plus the exact source text of whatever is now at that index** — nothing else.
That predicts every arm this reading drew, and the prediction was checked against **all 21 launches
that drew a notice**:

| Case | What R1 did at the held index (1) | Arm predicted | Arm drawn | Launches |
|---|---|---|---|---|
| `editor-exact` | nothing — `:beta` byte-identical | `sameMatch` | *found again* | L40, L41, L42, L83, L84 |
| `deleter-exact`, `duplicator-exact`, `mover-exact` | nothing | `sameMatch` | *found again* | L59, L60, L63, L64, L67, L68 |
| `editor-fallback` | added a `label:` line to `:beta` | `differentMatch` | *a different snippet* | L43, L44 |
| `editor-satisfied` | rewrote `:beta`'s replacement | `differentMatch` | *a different snippet* | L45, L46 |
| `mover-reordered`, `mover-after` | index 1 is now `:alpha` | `differentMatch` | *a different snippet* | L71, L72, L75, L76 |
| `mover-reordered-end` | index 1 is now `:gamma` | `differentMatch` | *a different snippet* | L73, L74 |

**11 `kept` and 10 `differentMatch`**, over ten en/es pairs plus the unpaired smoke launch L40, and
the Spanish twin drew the same arm as its English original in all ten pairs.

**The sentence is not merely misleading. It is false, and round 1 of this record got this wrong.**
*"What is now in that position **is a different snippet**"* is an identity conclusion. The predicate
supports only *the bytes at that position are not the bytes that were selected*, and the two come
apart exactly when another program edits the selected snippet **in place** — which is what L43–L46
did. In those four launches the thing at index 1 is `:beta`, the same snippet, with a second writer's
`label:` line or replacement in it. The window says it is a different snippet; the same window, two
lines below, says espansoConfig identified *the snippet this change is about* in the disk version and
set the draft up over it, and the launch then ended at bytes that patch that very snippet.

**Nothing here is a defect claim about the repair rule itself.** A positional-plus-bytes rule that
refuses to guess is the conservative one, and a rule that kept the selection on changed bytes would
be claiming an identity it cannot establish. **The rule is right and the sentence about it is wrong**,
which is the distinction §11.3 turns on.

**Attribution is right, and checking *how* it is guarded is what kept §11.3 honest.**
`displacedNoticeFor` (`src/lib/browser/workspace.svelte.ts:3075-3084`) picks `displacedByMove` or
`displacedByDuplicate` for a reorder the *person* asked for; the reorder in these launches was an
external writer's, and the un-attributed `differentMatch` is what was drawn. Nothing blamed the person
for another process's change. **And those two attributed notices are only reachable when the re-read
is the committed write's own parse** — a move through `adoptTheDocumentOnDisk`'s guard
(`:2750-2752`), a duplicate through `adoptAfterTheDuplicate`'s own (`:2891-2893`), which are two
guards of identical shape and not one shared line. That is what makes their identity claim sound
where `differentMatch`'s is not — §11.3, where a first attempt at this sweep got it wrong.

---

## 11. What the window showed that is wrong

### 11.1 **A refused reapply says so where nobody can see it, and nothing on screen changes.** Medium — handed to 3d

Pressing *Keep my draft* / *Keep what I asked for* and being refused produces, in the visible part of
the window, **no change at all**. The report that explains the refusal is drawn above the top of the
scrollport.

**Measured in 42 of 42 `manualResolution` launches**, five surfaces, both languages, all four driver
revisions:

```
L47  editor      report box=658,-53,491x90   clip=above   scrolledTo 658,44 clip=in
L49  editor      report box=658,-70,491x107  clip=above
L51  editor      report box=658,-87,491x124  clip=above
L55  creator     report box=658,-87,491x124  clip=above
L61  deleter     report box=658,-87,491x124  clip=above
L65  duplicator  report box=658,-87,491x124  clip=above
L69  mover       report box=658,-87,491x124  clip=above
L77  mover       report box=658,-87,491x124  clip=above
the Spanish twins and the revision-C/D repeats: clip=above, y ∈ {-53, -70, -87, -104}
```

and the outcome panel below it is **unchanged**: L47's four choices are at `667,1046`, `756,1046`,
`848,1046`, `945,1046` before the press and at the identical coordinates after it.

**The second press is what settles the severity.** L107–L110 pressed the control again. The identical
sentence was drawn at the identical rectangle (`box=658,-53,491x90` in L107, matching its own first
attempt exactly), the scroller was at the identical `scrollTop=763`, and the launch ended at R1 with
no backup directory. **So the natural next action after an invisible answer produces the same
invisible answer**, and the person has no way to tell the two presses apart without scrolling up.

**Mechanism.** The report is a second `role="status"` panel drawn immediately before the outcome
panel — `MatchEditor.svelte:796`, `MatchCreator.svelte:720`, `MatchDeleter.svelte:496`,
`MatchMover.svelte:759`, `MatchDuplicator.svelte:651` — and **the code provides no reveal cue for
it**: `OutcomeReveal` and `outcomeReveal` (`src/lib/browser/saveOutcome.ts:1676-1729`) enumerate five
cues, all of them about the *outcome* panel, and `revealOutcome`
(`src/lib/components/reveal.ts:87-105`) is handed only `outcomePanel` and `outcomeChoices`.
**It was above the band in every launch that produced it, and the absence of a cue is why nothing
moved it there** — that is what the artifacts and the source jointly show. It is **not** claimed that
DOM placement alone makes this so: whether the panel below stays put through scroll anchoring or
through the effect re-running is exactly the pair §9 calls indistinguishable, and the finding does
not rest on either.

**Why Medium and not High.** Nothing false is claimed, nothing is written, nothing is lost, and the
block is `role="status"` and reachable by scrolling. **Why not Low.** 2c-4a-3c-2 §10.3 graded a
wholly-invisible *statement that nothing was written* a Medium; this is that, plus the fact that the
control which produced it stays offered and unchanged, so nothing distinguishes *refused* from *did
not fire*.

**For 3d.** The repair is one more cue and one more bound element — the decision belongs in
`outcomeReveal` beside the other five, not in five renderers (2c-3c-3's Medium). Whatever is done
must be done for **five** surfaces, checked in Spanish, and must not push the conflict panel's own
first line out of view; §11.4 is the constraint. This reading must be re-taken over every component
3d changes.

### 11.2 **The Spanish reapply family says *usted* where the rest of the Spanish says *tú*.** Low — handed to 3d

Seven strings, all of them 2c-4b-3a's: `browser.reapply.ready`, `.readyOperation`, `.reapplied`,
`.alreadySatisfied`, `.manualResolution`, `.adoptionRefused` (`src/lib/i18n/es.json:140-145`) and
`browser.matchEditor.reapply.fieldCollisions` (`:255`). A whole-word search for *usted* over
`es.json` matches **exactly seven lines**, and they are those seven.

Measured on one screen, in one launch (L48), the two blocks one above the other:

```
report [reapply]  "…y lo que usted conservó sigue aquí exactamente igual…"
                  "La versión en disco ha cambiado campos que usted también había cambiado…"
report [conflict] "Tu texto sigue aquí, exactamente como lo escribiste. …
                   Lo que escribiste no se podrá recuperar después, así que cópialo antes si
                   quieres conservarlo."
```

The imperatives disagree too: the new family says *envíelo cuando quiera* and *no se escribe nada
hasta que usted envíe algo*, where the application everywhere else says *Vuelve a abrir*, *cierra
esto*, *elige un fragmento*, *cópialo*. **33 lines of `es.json` match at least one of five *tú*
markers** (`Vuelve a`, `puedes`, `elegiste`, `Pediste`, `escribiste`).

**Why it is a finding and not a taste.** It is two registers in adjacent paragraphs of one panel, and
it is the exact gap `CLAUDE.md` §6 names: the i18n suites check parity and placeholder agreement, so
**nothing today would fail if these seven were rewritten, and nothing failed when they were written
this way.** Low rather than Medium because nothing false is claimed and nothing is unreachable.

**For 3d.** Seven strings, prose only, no code. Whatever is added to stop it recurring has to be
something the suites cannot already do.

### 11.3 **`browser.notice.differentMatch` states an identity its predicate does not support, and it is false where the same snippet was edited in place.** High — handed to 3d

> This file changed on disk, and what is now in that position **is a different snippet**, so the
> selection was cleared.

**Drawn in ten launches, both languages** — L43, L44, L45, L46, L71, L72, L73, L74, L75, L76 — and
**false in four of them**. In L43/L44 (`editor-fallback`) and L45/L46 (`editor-satisfied`) the item at
the held index is the same `:beta` the person had selected, carrying a second writer's added `label:`
line or rewritten replacement. §10 has the predicate: `reresolve` compares the index and
`match.source_text` and nothing else, so *"the bytes here are not the bytes you selected"* is all it
knows, and *"is a different snippet"* is a stronger claim it cannot make.

**The contradiction is on one screen and is the sharpest evidence.** In L43 the notice says the
selection was cleared because a different snippet is there, and the block below it says the window
now shows the disk version with the retained draft set up over it — the reapply having identified
that snippet by correspondence evidence — and the launch ends at
`editor-fallback-expected.yml`, the drafted field patched onto that same snippet. **The application
asserts and denies the identity of one snippet in one frame.**

**Why High.** This is `CLAUDE.md` §6's named worst defect class — a claim the code does not support —
and it is not a claim about a control or a door but about the **identity of the person's data**. Its
consequence is that a person is told the snippet they had selected is not there when it is, and their
reasonable response is to go looking for something that was never lost. 2c-4a-3c-2 §10.1 graded a
false claim about whether a file had been written a High on the same reasoning; §10.5's Low is the
different case, where the substance was right and the sentence named the wrong control. Here the
substance is wrong. Round 1 of this record graded it Low on the argument that the sentence was *true
of its predicate*; it is not, and that verdict is withdrawn.

**Newly reachable at 2c-4b, and not new in itself.** The string and the rule both predate this phase.
What 2c-4b changed is that a reapply adopts and **keeps the surface open**, where 2c-4a's only
adoption — a confirmed reload — closes the match surface; so for the first time the notice and a live
surface holding the same snippet are drawn together, and the contradiction is visible.

**The sweep found one further instance, and manufactured two that are not there. The two are
retracted.** Round 1 of this fix round wrote that `browser.notice.displacedByMove` (`en.json:128`) and
`browser.notice.displacedByDuplicate` (`:130`) carry the same unsupported clause, on the strength of
their sharing the wording and the `differentMatch` outcome. **That was wrong, and checking the
attribution path is what shows it.** `displacedNoticeFor` (`workspace.svelte.ts:3075-3084`) is
reached only through `repairAfter`'s `attribution` argument, and **each of the two operations has its
own adoption with its own guard of identical shape** — a move through `adoptTheDocumentOnDisk`
(`:2750-2752`), a duplicate through `adoptAfterTheDuplicate` (`:2891-2893`). Each hands
`repairAfter` the requested attribution **only when `fresh.value.revision === moved.revision`** — that
is, only when the projection just read is the very parse the committed operation produced; anything
else falls back to `externalChange`. Within that parse the two
operations have properties an external writer's change does not: **a move reorders the same items and
changes no item's bytes**, and **a duplicate inserts a byte-exact clone and changes nothing else** —
and the operation's own snippet never reaches `repairAfter`, because the `positionInSameParse` re-point
above each guard returns first (`:2741-2746` for the move, `:2882-2887` for the clone). So a
fingerprint mismatch at the held index really does mean
another snippet now occupies it, and *"is a different snippet"* is **earned** for those two. Their
further sentence — *the snippet you had selected is still in the file* — is sound for the same reason.

**The one further instance that is real is `browser.notice.gone`, and it has its own predicate and
needs its own wording** (`en.json:124`): *"This file changed on disk and no longer holds the snippet
that was selected."* `reresolve` returns `gone` on `view.matches[previous.position] === undefined`
(`selection.ts:177-180`) — a statement about the **length** of the list, with no fingerprint compared
at all. An external deletion of an **earlier** snippet shortens the list, so a selection held at the
last index falls off the end while the snippet it named is still in the file one index lower. That is
a different mistake from `differentMatch`'s: one claims *this is a different snippet* from a bytes
comparison, the other claims *the file no longer holds it* from a length comparison, and a single
rewording covering both would repeat this round's error in the other direction. `gone` was **not
drawn in any launch** and is derived from source by inspection.

**For 3d, and the scope is two strings and not four.** `browser.notice.differentMatch` needs wording
that says what a bytes comparison knows — that what is at that position no longer exactly matches what
was selected — and `browser.notice.gone` needs wording that says what a length comparison knows: that
the position the selection was held at is no longer in the list. **`displacedByMove` and
`displacedByDuplicate` are not to be changed**; their claim is backed by the revision guard, and
"fixing" them would remove a true sentence.

### 11.4 **The conflict panel's controls, the new one included, are below the fold on five of six surfaces.** Observation — an acceptance constraint on §11.1's fix, not a repair request

§4.1 has the numbers. This is **not new** and is **not a regression**: 2c-4a-3c-2 §10.3 measured it,
2c-4a-3c-4 chose `block: 'start'` deliberately so that *Nothing was written* would be the line in
view, and the reading that accepted that trade said so. What 2c-4b changed is that **the row now
carries the control this phase exists to offer**, and in Spanish it carries four controls over two
rows.

It asks for no behavioural change on its own, which is why it is recorded as an observation rather
than as a defect. **Its content is a constraint**: a repair for §11.1 that reveals the reapply report
by scrolling further down, or that changes the conflict cue's block alignment, would trade one
invisible sentence for another.

### 11.5 **`fieldCollisions` claims the disk changed a field's value when the predicate only requires its state to differ.** Medium — handed to 3d

§5.2 has the predicate. `fieldReapply` (`matchEditor.ts:1835-1854`) answers `collision` on
`!sameBaselineState(was, now)` plus a failed satisfaction test, and `sameBaselineState` (`:1794-1800`)
compares presence, value **and eligibility** — with the function's own contract table (`:1805-1814`)
naming *"newly ineligible"* as a collision cause in as many words. So:

- a field whose **value did not change** produces *"The version on disk has changed fields that you
  had changed too"*; and
- in the sub-case where the disk holds **exactly the drafted value** but the field is no longer
  editable, *"so espansoConfig will not choose between them"* invites the person to resolve a conflict
  of values that does not exist — and the resolution it implies, choosing one of two values, is not
  the thing that would help.

**This finding is derived from source inspection, not from a screen.** All eight launches that drew
the sentence staged a genuine value collision, where it is true. That is why round 1 of this record
graded it *true*, and the review is right that an unobserved arm cannot be validated by its absence.

**Why Medium and not High, stated as a disagreement.** The review graded this High. The severity here
follows consequence, as this project's own precedents do: 2c-4a-3c-2 graded a false claim about
whether the file had been written a **High** (§10.1) and a refusal explained by a sentence about the
wrong control a **Low** (§10.5). This is the second shape, not the first — the outcome sentence above
it (*Nothing was written*) is correct, every branch that produces this sentence is one of §5.1's
early returns and so calls no command, and what is wrong is the
**reason** given for a refusal that is itself correct. It is graded above §10.5's Low because the
wrong reason is actively misdirecting rather than merely misplaced. **3d may reasonably raise it**;
the argument is set out here so that the decision is made with it in view rather than by inheriting a
number.

**For 3d.** Either narrow the sentence to what the predicate gives — the fields the person changed no
longer hold the state the draft was built against — or split the ineligible arm into its own obstacle
beside `targetNotEditable`, which already exists for the whole-target case.

### 11.6 **Nothing moves focus into the conflict panel.** Observation

§4.3. Recorded, not filed as a defect: moving focus into a `role="status"` region is not the accepted
pattern, and the controls are in document order immediately after the surface's own. It is the other
half of §11.1's *nothing takes you there* and belongs in the same conversation.

### 11.7 **A refusal draws no selection notice on the four surfaces that hold one.** Observation

All 21 notice-drawing launches are adoptions, and not one of the 42 refusals drew a notice. **The
evidential half of that is narrower than the observation**, and §5.1 states the limit: an absent
notice is only evidence of an absent adoption where a selection was held to repair. The creator's
plan holds none, so its two *successful* adoptions drew no notice either — which means its **eight**
refusals corroborate nothing. What stands is the **34** refusals on the editor, the mover, the
deleter and the duplicator, each of which had selected `:beta` before it began: an adoption on any of
those would have repaired a selection and said so, and none did. That is `manualResolution`'s *this
window was not moved* corroborated by the absence of a block rather than by the presence of a
sentence — on four surfaces, not on five.

### 11.8 **The mover's destinations and the deleter's confirmation are rebuilt, visibly.** Observation

§6. After a reapply the mover offers the anchors of the **new** order and the deleter offers the
**request** rather than the confirmation. Both are consult Q4 rules that had model and mounted
evidence only.

### 11.9 **`alreadySatisfied` leaves nothing to press.** Observation

L45, L46: no *Save this snippet*, no *Undo*. A sentence saying *there is nothing left to send* beside
a live send control would have been Q9's predicted lie; it is not what is drawn. Read on the editor
only — the arm was not drawn on the other four surfaces.

---

## 12. What this reading does not cover

**Re-derived item by item against 3c-1 §7 and 3b §8, not against a memory of them.** Round 1 of this
record was written the other way and dropped four inherited limitations: 3b §8.9 entirely, and 3c-1
§7.3, §7.4 and half of §7.6. They are items 2, 8, 9 and 10 below.

1. **There is still no invoke spy and no command counter** (3c-1 §7.0, 3b §8.11). Every claim about
   what was or was not written is a claim about the **final filesystem state**: the file
   byte-identical to R1 or to an authored file, the backup directory present or absent, a tree diff
   equal to the second writer's own change. Q7 point 4's second clause — *and no save command is
   issued* — is not observable by this instrument at all, and neither is the *timing* of any write.
   Closing it needs a counter in the harness or a Rust-side assertion, not another launch.
2. **`--- end` is a wrapper signal and not a success signal** (3b §8.9, kept open by 3c-1 §7).
   `startProbe()` prints it **unconditionally**, after the failure report if there was one, so
   `reached-end=yes` says only that the wrapper reached its last line. **And it says nothing about
   what the window did after the driver's last line**: L04 of 3b remains the demonstration that a
   launch can write the right bytes and still fail to say so. Both halves apply to all seventy-one
   launches here; what stands in their place is the four-part conjunction 3b §8.9 defines, which no
   part of the harness computes and which a reader supplied on each launch.
3. **A byte match is not a proof of mechanism** (3c-1 §7.1). `cmp` says the file equals a document a
   person wrote by hand; a transcript says which strings were drawn. Neither says why. 2c-4b-1's
   Rust-side tests carry the mechanism claims.
4. **The correspondence tier is still invisible** (3c-1 §7.2). `editor-fallback` shows *an*
   identification across changed target bytes; whether the trigger fallback or the mapping-slice tier
   produced it is not observable.
5. **`HTMLElement.click()` is not a mouse click and no key was ever pressed** (3b §8.3). §4.2
   establishes programmatic focusability, `tabIndex` and DOM order, which are **consistent with** an
   expected tab order and are not a measurement of one. Real `Tab` traversal, pointer hit-testing and
   keyboard activation are unread, and where focus lands after a real click is unread.
6. **The `activeElement` reading is clean only at the conflict moment.** `reportReach` focuses every
   control it measures, so the `afterReapply` and `afterSecond` readings show the probe's own last
   `focus()` call and say nothing about the application.
7. **Whether a `role="status"` block inserted whole is announced** by VoiceOver was not measured, and
   this instrument cannot measure it. §11.1's severity does not rest on it either way.
8. **The refusals are still not attributed to the rules they were designed around** (3c-1 §7.3). §5.6
   narrows this — which *half* of the evidence refused, subject or anchor, is now observed — but
   **which rule inside the core produced a given `ReapplyRefusal` code is not**. A sentence is a
   string the panel drew.
9. **`alreadySatisfied` is distinguishable from `reapplied` only by its sentence** (3c-1 §7.4). §11.9
   adds one corroborating fact — the send controls are gone — but nothing here observes
   `writesAnything === false`, and a generic no-op that drew the same sentence and left the same
   controls would be indistinguishable. It was drawn on the **editor only**; the other four surfaces'
   `alreadySatisfied` arms were never produced and §5.7 does not judge them.
10. **One case per Q7 point is not exhaustion of any Q7 point** (3c-1 §7.6). Every numbered point has
    at least one case and point 6 now has all four of its placement shapes, but no point is covered
    exhaustively, and the fixture pairs were chosen to make one distinction each.
11. **Nine of the ten surface-specific reapply obstacle sentences were never drawn**, and neither of
    the two shared `evidenceNot…` arms was. `browser.*.reapply.*` in `en.json` holds exactly ten keys,
    and only `browser.matchEditor.reapply.fieldCollisions` reached a screen. `targetNotEditable`,
    `anchorNotInDestination`, `notTheDestination`, `creationRefused`, `notDeletable`,
    `notTheSameSequence`, `anchorNotInSequence`, `moveRefused` and `notDuplicable`, together with
    `browser.reapply.obstacle.evidenceNotATarget` and `…evidenceNotAnAnchor`, keep model and mounted
    evidence only.
12. **Three of the six `ReapplyOutcome` arms were never drawn**: `adoptionRefused`, `unavailable` and
    `notAttempted`. `adoptionRefused` needs a projection replacement between the conflict and the
    press, which nothing on a conflict panel can cause — the same argument 2c-4a-3c-2 §7.4 made for
    `alreadyThere` and `refused`. `unavailable` and `notAttempted` are unreachable because the raw
    editor draws no control that could call `beginReapply`.
13. **The adoption arm is invisible** (3b §8.7). `installed` and `alreadyThere` both reach
    `reapplied`; no transcript here says which one a launch got.
14. **Whether the mover's previously chosen destination is still marked after a reapply** was not
    measured. The bytes show the anchored placement was carried and resolved against R1; the mark on
    screen was not read.
15. **`fieldCollisions` was staged only by a value change**, never by a disk change that makes a field
    ineligible — the arm §11.5 is about. That finding is source-derived and has no screen behind it.
16. **The selection notice's `gone` arm was never drawn.** No fixture pair shortened the snippet list
    past the held index, so the half of §11.3 that is about `browser.notice.gone` is source-derived
    (`selection.ts:177-180`) and has no screen behind it, exactly as item 15 is. The half about
    `differentMatch` does have one, in ten launches.
17. **The second press was read on two surfaces**, the editor and the mover, in both languages. The
    creator, the deleter and the duplicator were not pressed twice.
18. **One fixture shape, and it is still the easy one** (3c-1 §7.5, 3b §8.4). Twenty cases over three
    snippets in one file: plain `replace:` scalars, double-quoted triggers, one leading comment, LF
    line endings, no BOM, no block scalars, no item-owned comments, no blank-line runs, no second
    sequence, no read-only file, no package. The fifteen corpus fixtures `CLAUDE.md` §4 lists exist
    precisely because those shapes behave differently, and **none has been through this harness**.
19. **One window size.** 1180 × 728, with a 645-pixel scrollport, on every launch. Every rectangle in
    this record is that geometry's; nothing here says what any of it looks like in a resized window,
    and §4.1's *below the fold* verdicts are geometry-dependent by construction.
20. **Nothing about the real configuration** (3b §8.8). By construction: every launch is confined to a
    synthetic two-file tree, and the one claim made about the owner's files is that none was opened.
21. **A false sentence prints as well as a true one** (3b §8.2). §5 judged each sentence against the
    code that produces it; that is an argument a reader made, and §5.2 is the demonstration that such
    an argument can be got wrong.

**Discharged rather than carried forward**: 3c-1 §7.7 (bilingual coverage — closed, §1.3), §7.8 and
§7.9 (the two deferred judgements — taken, §9 and §10), and 3b §8.1 (*nothing here is a window
reading* — this is the reading). 3b §8.5 and §8.10 were already discharged by 3c-1.

---

## 13. Deviations

1. **§7.6 closed rather than deferred** (§1.3). 3c-1 handed `end`-after-a-reorder to "the next
   construction step"; this step built it — two fixtures, one case row, one parameter value — and ran
   it in both languages (L73, L74).
2. **§7.7 closed for the whole matrix** (§1.3). All twenty cases ran in both languages, against eight
   of nineteen when 3c-1 handed over.
3. **The driver changed, six times over four revisions** (§1.2, §1.4). Nothing in the application
   changed; `src-tauri/src/probe.rs` did not change at all.
4. **A launch runner was added**, `<scratch>/run-3c-2.sh`, which calls `launch.sh` once per plan and
   prints a one-line summary instead of the whole transcript. It changes nothing about a launch: the
   bundle is still fresh per launch, the plan is still one per launch, and every artifact is still
   retained under `launches/Lnn/`.
5. **A post-image manifest was written**, `<scratch>/manifest-3c-2-post.sha256`, 243 entries, for the
   same reason 3c-1 wrote one — and 3c-1's was **verified** first (§1.1), which is the first time this
   sequence of steps has had a real before-image.

---

## 14. Verdict

| Item | Verdict |
|---|---|
| 1 — choice ordering | **PASS**, six surfaces, both languages (§2). Q6's order exactly; the copy absent on the three operation-choice surfaces; neither reapply label on the raw editor |
| 2 — the readiness sentence and its branch | **PASS**, both languages (§3). `ready` on the two authored-text surfaces, `readyOperation` on the three operation-choice ones, neither on the raw editor; drawn directly above the control; all five of Q6's requirements present and none of its prohibitions breached |
| 3 — focus and scroll reachability | **PASS on reachability** (§4). Every drawn control `tab=0`, enabled, focusable, and scrollable into view on all six surfaces in both languages. **Nothing moves focus into the panel** (§11.6), and on five of six the controls start below the fold (§11.4). Real `Tab` traversal is untested (§12.5) |
| 4 — the truth of every new refusal sentence | **PASS on five of six** (§5). `manualResolution`, `ambiguousTrigger`, `targetMissingOrTriggerChanged`, `noExactCorrespondence` and both shared obstacle halves each claim exactly their predicate, and the subject/anchor half is right in each of the nine refusal cases run — which **narrows 3c-1 §5.5 from an inference to an observation**. **`fieldCollisions` overclaims (§11.5)** |
| 5 — the refusal/acknowledgement round after a successful reapply | **PASS**, both languages (§6). The duplicator's finding came back, had to be acknowledged again, and the launch ended at the authored bytes; the deleter's renewed confirmation and the mover's rebuilt destinations were read on their own surfaces |
| 6 — the standing negative-`y` finding | **JUDGED** (§9). A real defect, **Medium** (§11.1), measured in 42 of 42 refusal launches — and two things that were counted as one: the reapply report on a refusal and the selection banner on a success (§11.3), which is a different and worse finding |
| 7 — the selection-repair banner | **DIAGNOSED, and it is a false sentence** (§10, §11.3). Positional index plus exact source text, `selection.ts:176-193` with `matchFingerprint` at `:109`; predicted and confirmed on all 21 notice-drawing launches. **Not** true of its predicate — it states an identity, and in four launches (L43–L46) the "different snippet" is the selected snippet edited in place, which the same window identifies two lines below. **High.** Its scope is **two strings** — `differentMatch`, drawn, and `gone`, source-derived — after two further instances alleged in the first fix round were **retracted** (§11.3, §16) |
| 8 — the final filesystem state | **PASS** (§8). 21 launches ended at authored bytes with a backup directory; 50 ended at R1 with no backup directory in existence; none ended at bytes its case did not predict. A final state, never a history (§12.1) |

**One High, two Mediums, one Low and five observations**, re-counted from the classifications above
after the second fix round's retraction: §11.3 (`differentMatch` states an unsupported identity and is
false where a snippet was edited in place, **High**), §11.1 (a refused reapply reports where nobody
can see it, **Medium**), §11.5 (`fieldCollisions` overclaims its predicate, **Medium**, argued down
from the review's High in the finding itself), §11.2 (the Spanish reapply family's *usted*, **Low**),
and §11.4, §11.6, §11.7, §11.8, §11.9 as observations. **The retraction changed a finding's scope and
not the tally**: §11.3 was and remains one High, over two strings instead of four.

**No launch ended at bytes this application should not have produced.** Every launch whose reapply
refused ended byte-identical to what the second writer had installed, with no backup directory
anywhere in the tree; every launch whose reapply succeeded and was then sent ended byte-identical to a
document authored before the launch. That is the final filesystem state on all six surfaces in both
languages, and it is not a statement about which commands ran or when.

**Step 3c-2 is complete. Step 3d owes the fixes for §11.1, §11.2, §11.3 and §11.5, a decision on
§11.4's constraint, a re-take of this reading over every component it changes, and the removal of the
harness.**

---

## 15. The gates, with the harness still in the tree

| Command | Result |
|---|---|
| `npm test` | **1624** passed, 49 files — unmoved |
| `npm run check` | **419** files, 0 errors, 0 warnings — unmoved |
| `npm run build` | **176** modules — unmoved |
| `cargo test --workspace` | **1086** passed, 0 failed — unmoved |

Every number is 3c-1 §8's, unmoved, and that is the expected shape: this step **edited** `src/probe.ts`
rather than adding a source module, and changed no Rust source and no production file at all. An
unmoved count is evidence of an unmoved count and of nothing broader; no gate transcript was retained.

`git status --short --untracked-files=all` lists the four harness paths — `src/main.ts` and
`src-tauri/src/main.rs` modified by two hook lines each, `src/probe.ts` and `src-tauri/src/probe.rs`
untracked — accompanied by this record and its review, both also untracked until they are committed.
Nothing under `crates/espansoconfig-core/tests/corpus/real/` appears, no scratch path is inside the
repository, and no git command that changes anything was run.

---

## 16. What review round 1 changed in this record

`docs/reviews/phase-2c-4b-3c-2-reading.md`, nine items. **No launch was re-run and no application
source was touched**: every correction below is either a re-derivation from the artifacts already on
disk or a re-reading of source that was always there. That is itself the point — the evidence
supported the corrected statements the whole time, and round 1 of this record did not read it
carefully enough.

| Review item | What it was | What it is now |
|---|---|---|
| High — `differentMatch` | §10/§11.3 said the sentence was *true of its predicate*, misleading only beside its neighbour; **Low** | It states an identity the predicate does not support and is **false** in four launches; **High**. Its sweep named three further instances, of which **round 2 retracted two** — see below |
| High — `fieldCollisions` | §5.2 graded it **true** on eight launches | It overclaims a predicate that includes *newly ineligible*; new finding **§11.5**, Medium, with the review's High rebutted in writing |
| High — §12 dropped an inherited limitation | 3b §8.9 absent | §12.2, both halves; and §12 re-derived item by item, which recovered 3c-1 §7.3, §7.4 and half of §7.6 as well (§12.8, §12.9, §12.10) |
| High — the write counts | "28 positive, 43 wrote nothing" | **21 and 50**, derived from every `bytes.txt` and cross-checked against the `backups=` line; §8 says so and says which count it replaces |
| High — temporal and command claims | *every conflicted save wrote nothing*, *the write happens only on the next press* | Final-state phrasing throughout; every timing or command claim is attributed to named source inspection (§5's rule 2, §5.1, §5.7, §8, §14) |
| Medium — an over-wide citation | `reapply.ts:228-239` cited for *calls no command* | The five transitions' early-return line ranges against their single `adoptForReapply` call, plus the five component handlers (§5.1) |
| Low — "by construction" | §11.1 said the report is offscreen by construction | Offscreen **in every launch that produced it**, and the code provides **no reveal cue**; the mechanism stays the pair §9 calls indistinguishable |
| Low — "document order is the tab order" | stated as fact | Consistent with the expected tab order; real traversal untested (§4.2, §12.5) |
| Low — §11.4 misfiled | **Low** | **Observation**, an acceptance constraint on §11.1's fix |

**Counts that moved in the recount, beyond the two the review named**: `manualResolution` launches
18 → **42**; the §10 notice table 16 launches → **21** (11 `kept`, 10 `differentMatch`, ten pairs plus
the unpaired smoke launch); editor adopting launches 6 → **9**; deleter/duplicator/mover adopting
launches 10 → **12**; the *usted* line count 9 (with two false positives from `…Exhausted`) → **7**
with a whole-word search.

**Two more the recount found on its own, after the review's list was exhausted** — which is this
repository's own rule about fix rounds working: sweep for what the corrected claim says, not for the
words the finding used. §5.6 and §14 said the subject/anchor half was right in *ten* refusal cases;
there are **nine** refusal cases among the twenty (the twentieth refusal-shaped case,
`raw-negative`, has no reapply control at all, and `editor-satisfied` is not a refusal). And §12 said
*ten of the eleven* surface-specific obstacle sentences were undrawn; `browser.*.reapply.*` holds
exactly **ten** keys, so it is **nine of ten**, with the two shared `evidenceNot…` arms undrawn
beside them. **Counts that survived the recount unchanged**: 71 launches; 36 en / 35 es;
20 cases, all twenty bilingual; 4 second-press launches; 96 OK / 2 FAILED on 3c-1's manifest; 243
entries in this step's; 33 *tú*-marker lines; and the four gate numbers of §15.

### 16.1 The second fix round, and the finding it had to take back

Round 2 of the review confirmed the recount against the retained evidence, confirmed that §12 drops
nothing from 3c-1 §7, and **adjudicated §11.5's Medium-rather-than-High rebuttal in this record's
favour**. It returned three items, one of them a High against this record's own sweep.

| Round 2 item | What it was | What it is now |
|---|---|---|
| High — a **manufactured** instance | §11.3's sweep claimed `displacedByMove` and `displacedByDuplicate` carry the same unsupported identity clause | **Retracted.** The attribution is honoured only when the re-read is the committed write's own parse — two guards of identical shape, `adoptTheDocumentOnDisk` (`workspace.svelte.ts:2750-2752`) for the move and `adoptAfterTheDuplicate` (`:2891-2893`) for the duplicate — where a move changes no item's bytes and a duplicate inserts a byte-exact clone, so the claim is earned. §11.3's scope is **two strings**, not four |
| Low — the handler description | "two model calls and two assignments each" | What holds across all five: they synchronously call model and local helpers, assign component state, and invoke no IPC command. The deleter has a third assignment; the mover and the duplicator each call a further draft getter (§5.1) |
| Low — a corroboration that does not corroborate | "a refusal launch draws no selection notice" offered as evidence over all 42 | Limited to the **34** refusals whose plan holds a selection; the creator's **8** corroborate nothing, because its own two successful adoptions drew no notice either (§5.1, §11.7) |

**The High is the one worth writing down twice.** This record spent round 1 correcting sentences that
claimed more than the code gives, and its own sweep then produced exactly that defect **pointed the
other way** — a claim that the application was wrong where it was right, which would have handed 3d
two strings to "fix" that are already true, and the fix would have deleted a sound sentence. The
difference between the true instance and the false ones is a **guard four call frames away from the
string**, in a file the finding did not cite; the wording and the outcome enum were identical, and
reading only those two is what produced the error. `CLAUDE.md` §6's rule — *check the notes against
the code, not the code against the notes* — has this as its mirror image: **a sweep must be checked
against the code too, and a shared string is not a shared predicate.**

**`gone` survived that check and stays**, with its own predicate and its own wording (§11.3): it is a
claim about the **length** of the list, where `differentMatch` is a claim about **bytes**, and the two
need different repairs.
