# Phase 2c-4b step 3d-2b — the re-take window reading

`docs/decisions/2c-4b-3d-1-notes.md` §7 is the work list: six components, obligations (a)–(f), both
languages. `docs/decisions/2c-4b-3d-2a-instrument-rebuild.md` §6.7 is what scheduled it. **This
record is the reading**, and every claim below names the **launch** it comes from; where a claim
quotes text or a rectangle it also names the transcript **line**, and where a table names only a
P-number the value is recoverable unambiguously from that launch's log by the field name the prose
uses. **That is the promise, and it is weaker than the one the first version of this paragraph
made** — the review of this record (`docs/reviews/phase-2c-4b-3d-2b-reading.md`, coverage section)
found the practice looser than the promise, and this is the promise corrected to the practice rather
than the practice tightened to the promise.

**Sixty-four launches, P12–P75, in two rounds.** P12–P53 are the reading as first taken; **P54–P75
are its review round**, which instrumented the harness for two facts the first forty-two could not
observe and retook the cases that owed them (§18). All sixty-four reached `--- end`, none printed
`--- failed`, every `probe.err` is zero bytes, and every `bytes=` verdict is **MATCH** — including
all five of the expected-bytes files 3d-2a §6.3 flagged as never compared against anything. **Every
case in the driver's 23-row table has now been launched at least once on this tree.**

**What a reader must not carry across from the two records above.** 3d-2a proved an *instrument*;
3b §8, 3c-1 §7 and 3d-2a §6.1 are inherited whole and none of them is repealed here. In particular:
there is still **no invoke spy and no command counter**, so every refusal claim in this record is a
claim about the **final filesystem state** and nothing more; `HTMLElement.click()` is not a mouse
click and no plan pressed a key; `--- end` proves the wrapper reached its last logging statement and
nothing else; and the fixture shape is still the easy one (3d-2a §6.1's amendment of 3c-1 §7.5) —
**none of the fifteen corpus fixtures `CLAUDE.md` §4 lists has been through this harness and the
owner's real configuration has never been opened by it.**

**The review round adds a `scrollIntoView` spy and nothing else.** It is a spy on **one DOM method**,
not on `invoke`: it observes what the window asked a scroll container to do and what that container's
offset did around the call. Every sentence above about commands, clicks, keys and fixtures stands
exactly as written.

---

## 1. The tree, the binary and the instrument

**The repo-side half of the harness is what 3d-2a handed over, with `src/probe.ts` instrumented by
the review round.** `git status --short --untracked-files=all` lists `M src-tauri/src/main.rs`,
`M src/main.ts`, `?? src-tauri/src/probe.rs`, `?? src/probe.ts`, this record and the review.
**No tracked source file was changed by this step.** `src/probe.ts` is uncommitted harness code and
is not a tracked source file; changing it is nevertheless a change to something the four gates
measure, so **the four gates were re-run for the review round** (§16). The first round did not run
them and said so for the same reason: it changed no file at all.

**The scratch half verified before anything ran.** `shasum -a 256 -c manifest-3d-2a-post.sha256` in
`/private/tmp/espansoconfig-harness-2c-4b-3d/` succeeded for all 46 entries before P12.

### 1.1 A third and a fourth binary ran, and their provenance is established where the earlier two's is not

3d-2a §5.10 measured two binaries — `3f1b3506…` for P01–P06 and `21359e1a…` for P07–P11 — and could
bind neither to a source snapshot or a build command. This step ran the recipe of that record's §3,
in its stated order, over the tree described above:

```sh
npm run build      # 176 modules — the count 3d-1 §9 and 3d-2a §7 both record
touch src-tauri/build.rs
cargo build -p espansoconfig --features custom-protocol
```

`target/debug/espansoconfig` digested `21359e1a…` **before** the build — equal to what 3d-2a says
P07–P11 ran — and
`84148bbf60687e307e7f7bf38863f358b029f17592339db786e09b4cffe75275` after it. **A relink of an
unchanged tree is not byte-reproducible in this profile, and that is the whole of what the change of
digest establishes.** What it costs is digest continuity with P01–P11; what it buys is that every
launch numbered P12 and above ran a binary built by the three commands above from the tree §1
describes. §3 says what this record reuses from P01–P11 and what it does not.

**A fourth binary ran the review round, and its provenance is established the same way.** The same
three commands, in the same order, over the tree with the instrumented `src/probe.ts`, produced
`7fe2a6da4b27d6993a69567f759b8baa0e004a4d34fe2d1732d8fd9aeceaac8b`. **P54–P75 ran that binary and
P12–P53 ran `84148bbf…`**, so the two rounds are two binaries and a cross-round geometric comparison
is a comparison across binaries. §5.1 states where one is made and what it is worth; §12 states where
one is refused.

### 1.2 Two additions to the scratch tree, stated as deviations

`run-batch.sh` — a wrapper that calls `launch.sh` once per `<plan> <name>` pair and prints each
launch's summary. **It changes nothing about a launch**: `launch.sh` still seeds R0, assembles a
fresh bundle at a path never used before, runs one plan, kills the application, waits and then
byte-checks. One plan per launch, into a fresh bundle path, exactly as
`docs/decisions/1c-2b-2b-2-notes.md` §6.1 requires. What it removes is a round trip per launch, and
it lets no launch's failure stop the next, because each launch is independent of every other.

`make-manifest-3d-2b.sh` — writes `manifest-3d-2b-post.sha256`, **131 entries**: `launch.sh`,
`run-batch.sh`, every fixture, both probe sources and every retained `probe.log` and `bytes.txt` of
all 53 launches. `shasum -a 256 -c` succeeded for all 131 when it was written. **It never touches
`manifest-3d-2a-post.sha256`**, which was re-verified afterwards and still succeeded for all 46 —
3d-2a §8.5 records what regenerating a manifest destroyed once, and the two now stand side by side
rather than one replacing the other.

`make-manifest-3d-2b-fix.sh` — the review round's own addition — writes
`manifest-3d-2b-fix-post.sha256`, **177 entries**: the same file set, extended by the two manifest
scripts and by the 22 new launches' `probe.log` and `bytes.txt`. `shasum -a 256 -c` succeeds for all
177. It regenerates neither older manifest.

**Both older manifests now fail on exactly one entry each, and it is the same entry.**
`shasum -a 256 -c manifest-3d-2a-post.sha256` verifies **45 of 46** and
`manifest-3d-2b-post.sha256` **130 of 131**; the single failure in each is
`/Users/ccarpio/Developer/espansoConfig/src/probe.ts`, the file the review round instrumented.
Recorded rather than repaired: a manifest is a statement about a moment, and rewriting one to hide a
deliberate change is what 3d-2a §8.5 is a record of.

### 1.3 The viewport, and the band this reading measures against

`1180 x 728`, `dpr=2`, `hasFocus=false visibility=hidden`, printed by every launch. `section.detail`
is the only real scroller, top at `y = 44`, `clientHeight=645`, so **the visible band is [44, 689]**
— the same band 3c-2 §4 measured, reproduced on every launch of this step.

### 1.4 The reveal instrument, added by the review round

**What it was built for.** 3d-1 §7 asks, for obligation (f), that the reading *record which of the
three happened* — `'nearest'` scrolling the pane up, down, or not at all — and, for obligation (c),
that a second press *still scrolls*. The first round sampled only **after** each transition, so a
pane that had stopped overflowing and a pane that had room and did not move printed the same line, and a
second press that issued a request and a second press that issued none printed the same line too.
The review found both (`docs/reviews/phase-2c-4b-3d-2b-reading.md` findings 1 and 2) and neither
could be closed by rewording.

**What it does.** `src/probe.ts` wraps `Element.prototype.scrollIntoView`. Every call is recorded
with its target, the target's index in the current `role="status"` list, the first 30 characters of
its text, the options passed, whether the platform threw, and — sampled **synchronously either side
of the original call** — the pane's `scrollTop`, `scrollHeight`, `clientHeight`, the derived maximum
offset `scrollHeight − clientHeight`, `window.scrollY`, and the target's own rounded `top`. Requests
this file issues itself are tagged `origin=probe`; the window's own are `origin=app`. The press is
bracketed by a `scrollstate` line before it and one after it, and the requests of that press are
dumped under a segment name, `count=` first, so **a segment with no request prints `count=0`** rather
than being an absence a reader has to notice. What one press looks like, from P66 `probe.log:28`–`:31`
with the long fields elided:

```
editor scrollstate beforeReapply top=666 max=1037 sh=1682 ch=645 overflow=yes winY=0
editor scrollreq segment=reapply count=1
editor scrollreq[0] seg=reapply origin=app target=div.panel status=0 opts=block:nearest,…
        before[top=780 max=1150 sh=1795 ch=645 overflow=yes] after[top=666 …] delta=-114 rect=-70->44
editor scrollstate afterReapply top=666 max=1150 sh=1795 ch=645 overflow=yes winY=0
```

**Why that separates the three answers.** `delta` is the pane's own movement caused by that one
request: negative is the pane scrolling **up** (`scrollTop` decreasing, which carries content **down**
the screen), positive is **down**, zero is no movement. `max` at the same instant says whether the
pane could have moved at all, and in which direction it had room. A `delta=0` against `max=0` is a
container that **cannot** move and says nothing about what was asked for; a `delta=0` against a
non-zero `max` with unspent room is **no movement that a range clamp can explain** — and no movement
is also the outcome `'nearest'` specifies for an element already fully inside the scrollport. Which
of those the platform did internally is **not** observed here (bound 1 below); what is measured is
that the request was issued and that it caused no movement while range was available. That is the
distinction the first round could not draw.

**Three bounds, stated here rather than left to be inferred.**

1. **A request is a request.** This observes what the window asked for and what the pane's offset did
   around the call. It does not observe the platform's internal decision, and a platform that moved
   the pane by some other means in the same tick would appear as a `delta` on the next request rather
   than as its own event. **`threw=false` says only that the native call returned without throwing**;
   it does not by itself separate an honoured specified no-op from a silent ignore.
2. **The instrument perturbs layout timing.** The wrapper reads `getBoundingClientRect` and
   `scrollTop` immediately before the original call, so an instrumented launch forces a layout flush
   an uninstrumented one does not. `scrollIntoView` forces one itself, so what this changes is *when*
   layout happens and not *whether*; it is a bound and not a proof of no effect.
3. **`section.detail` is the pane every sample is taken from**, looked up by class rather than by
   walking up from the target — because `scrollerOf` answers `null` the moment the pane stops
   overflowing, and the pane's numbers at that moment are the whole question. The window's own
   `scrollY` is printed beside it on every sample, so a document-level scroll is observable too; a
   reveal that moved some **third** container would show here as `delta=0` with `winY` unchanged, and
   the target's `rect` before-and-after is what would contradict that reading.

---

## 2. The launch ledger

Every launch below reached `--- end`, printed **no** `--- failed` line, and left a **zero-byte**
`probe.err` (verified over all 64 by a sweep of `launches/*/probe.log` and `probe.err`). `bytes=` is
`launch.sh`'s own `cmp` verdict and `backups=` its two-half search (3d-2a §5.4).

### 2.1 The first round, P12–P53 — binary `84148bbf…`

| # | Case | Surface | Lang | `expect=` | `bytes=` | `backups=` |
|---|---|---|---|---|---|---|
| P12 | `editor-ineligible:en:twice` | editor | en | `target-empty-replace-r1.yml (R1)` | MATCH | none |
| P13 | `editor-ineligible:es:twice` | editor | es | `target-empty-replace-r1.yml (R1)` | MATCH | none |
| P14 | `editor-collision:en` | editor | en | `target-changed-r1.yml (R1)` | MATCH | none |
| P15 | `editor-collision:es` | editor | es | `target-changed-r1.yml (R1)` | MATCH | none |
| P16 | `creator-anchor:en:twice` | creator | en | `target-changed-r1.yml (R1)` | MATCH | none |
| P17 | `creator-anchor:es:twice` | creator | es | `target-changed-r1.yml (R1)` | MATCH | none |
| P18 | `deleter-changed:en:twice` | deleter | en | `target-changed-r1.yml (R1)` | MATCH | none |
| P19 | `deleter-changed:es:twice` | deleter | es | `target-changed-r1.yml (R1)` | MATCH | none |
| P20 | `mover-changed:en:twice` | mover | en | `target-changed-r1.yml (R1)` | MATCH | none |
| P21 | `mover-changed:es:twice` | mover | es | `target-changed-r1.yml (R1)` | MATCH | none |
| P22 | `duplicator-changed:en:twice` | duplicator | en | `target-changed-r1.yml (R1)` | MATCH | none |
| P23 | `duplicator-changed:es:twice` | duplicator | es | `target-changed-r1.yml (R1)` | MATCH | none |
| P24 | `editor-exact:en` | editor | en | `editor-exact-expected.yml` | MATCH | **PRESENT** |
| P25 | `editor-exact:es` | editor | es | `editor-exact-expected.yml` | MATCH | **PRESENT** |
| P26 | `creator-front:en` | creator | en | `creator-front-expected.yml` | MATCH | **PRESENT** |
| P27 | `creator-front:es` | creator | es | `creator-front-expected.yml` | MATCH | **PRESENT** |
| P28 | `deleter-exact:en` | deleter | en | `deleter-exact-expected.yml` | MATCH | **PRESENT** |
| P29 | `deleter-exact:es` | deleter | es | `deleter-exact-expected.yml` | MATCH | **PRESENT** |
| P30 | `duplicator-exact:en` | duplicator | en | `duplicator-exact-expected.yml` | MATCH | **PRESENT** |
| P31 | `duplicator-exact:es` | duplicator | es | `duplicator-exact-expected.yml` | MATCH | **PRESENT** |
| P32 | `mover-exact:en` | mover | en | **`mover-exact-expected.yml`** | MATCH | **PRESENT** |
| P33 | `mover-exact:es` | mover | es | **`mover-exact-expected.yml`** | MATCH | **PRESENT** |
| P34 | `editor-empty-satisfied:en` | editor | en | `target-empty-quoted-r1.yml (R1)` | MATCH | none |
| P35 | `editor-empty-satisfied:es` | editor | es | `target-empty-quoted-r1.yml (R1)` | MATCH | none |
| P36 | `editor-fallback:en` | editor | en | **`editor-fallback-expected.yml`** | MATCH | **PRESENT** |
| P37 | `editor-fallback:es` | editor | es | **`editor-fallback-expected.yml`** | MATCH | **PRESENT** |
| P38 | `raw-negative:en` | raw | en | `elsewhere-r1.yml (R1)` | MATCH | none |
| P39 | `raw-negative:es` | raw | es | `elsewhere-r1.yml (R1)` | MATCH | none |
| P40 | `mover-reordered:en` | mover | en | **`mover-reordered-expected.yml`** | MATCH | **PRESENT** |
| P41 | `mover-after:es` | mover | es | **`mover-after-expected.yml`** | MATCH | **PRESENT** |
| P42 | `mover-reordered-end:en` | mover | en | **`mover-end-expected.yml`** | MATCH | **PRESENT** |
| P43 | `editor-reload-gone:en` | editor | en | `target-deleted-r1.yml (R1)` | MATCH | none |
| P44 | `editor-reload-gone:es` | editor | es | `target-deleted-r1.yml (R1)` | MATCH | none |
| P45 | `editor-satisfied:en` | editor | en | `target-satisfied-r1.yml (R1)` | MATCH | none |
| P46 | `editor-ambiguous:es` | editor | es | `target-ambiguous-r1.yml (R1)` | MATCH | none |
| P47 | `editor-missing:en` | editor | en | `target-deleted-r1.yml (R1)` | MATCH | none |
| P48 | `creator-anchor-gone:es` | creator | es | `target-deleted-r1.yml (R1)` | MATCH | none |
| P49 | `mover-after-changed:en` | mover | en | `anchor-changed-r1.yml (R1)` | MATCH | none |
| P50 | `deleter-exact:en` | deleter | en | `deleter-exact-expected.yml` | MATCH | **PRESENT** |
| P51 | `creator-front:es` | creator | es | `creator-front-expected.yml` | MATCH | **PRESENT** |
| P52 | `deleter-exact:en` | deleter | en | `deleter-exact-expected.yml` | MATCH | **PRESENT** |
| P53 | `creator-front:es` | creator | es | `creator-front-expected.yml` | MATCH | **PRESENT** |

**The five bold `expect=` files are 3d-2a §6.3's predictions**, authored from the records' *Expected
afterwards* columns and never compared against anything until now. All five match. P50–P53 are §12's
stability experiment and are repeats of P28 and P27 by design.

### 2.2 The review round, P54–P75 — binary `7fe2a6da…`, the instrumented harness

**Twenty-two launches, and every one of them is a re-take of a case P12–P53 already ran.** No new
case was invented, no row was added to `launch.sh` and no arm was added to `runPlan`: what changed is
what the transcript prints. The twelve success launches discharge obligation (f) on the five match
surfaces in both languages plus the editor's `alreadySatisfied` arm; the ten `:twice` launches
discharge obligation (c) on all five in both languages.

| # | Case | Surface | Lang | Owes | `expect=` | `bytes=` | `backups=` |
|---|---|---|---|---|---|---|---|
| P54 | `editor-exact:en` | editor | en | (f) | `editor-exact-expected.yml` | MATCH | **PRESENT** |
| P55 | `editor-exact:es` | editor | es | (f) | `editor-exact-expected.yml` | MATCH | **PRESENT** |
| P56 | `creator-front:en` | creator | en | (f) | `creator-front-expected.yml` | MATCH | **PRESENT** |
| P57 | `creator-front:es` | creator | es | (f) | `creator-front-expected.yml` | MATCH | **PRESENT** |
| P58 | `deleter-exact:en` | deleter | en | (f) | `deleter-exact-expected.yml` | MATCH | **PRESENT** |
| P59 | `deleter-exact:es` | deleter | es | (f) | `deleter-exact-expected.yml` | MATCH | **PRESENT** |
| P60 | `duplicator-exact:en` | duplicator | en | (f) | `duplicator-exact-expected.yml` | MATCH | **PRESENT** |
| P61 | `duplicator-exact:es` | duplicator | es | (f) | `duplicator-exact-expected.yml` | MATCH | **PRESENT** |
| P62 | `mover-exact:en` | mover | en | (f) | `mover-exact-expected.yml` | MATCH | **PRESENT** |
| P63 | `mover-exact:es` | mover | es | (f) | `mover-exact-expected.yml` | MATCH | **PRESENT** |
| P64 | `editor-empty-satisfied:en` | editor | en | (f) | `target-empty-quoted-r1.yml (R1)` | MATCH | none |
| P65 | `editor-empty-satisfied:es` | editor | es | (f) | `target-empty-quoted-r1.yml (R1)` | MATCH | none |
| P66 | `editor-ineligible:en:twice` | editor | en | (c) | `target-empty-replace-r1.yml (R1)` | MATCH | none |
| P67 | `editor-ineligible:es:twice` | editor | es | (c) | `target-empty-replace-r1.yml (R1)` | MATCH | none |
| P68 | `creator-anchor:en:twice` | creator | en | (c) | `target-changed-r1.yml (R1)` | MATCH | none |
| P69 | `creator-anchor:es:twice` | creator | es | (c) | `target-changed-r1.yml (R1)` | MATCH | none |
| P70 | `deleter-changed:en:twice` | deleter | en | (c) | `target-changed-r1.yml (R1)` | MATCH | none |
| P71 | `deleter-changed:es:twice` | deleter | es | (c) | `target-changed-r1.yml (R1)` | MATCH | none |
| P72 | `mover-changed:en:twice` | mover | en | (c) | `target-changed-r1.yml (R1)` | MATCH | none |
| P73 | `mover-changed:es:twice` | mover | es | (c) | `target-changed-r1.yml (R1)` | MATCH | none |
| P74 | `duplicator-changed:en:twice` | duplicator | en | (c) | `target-changed-r1.yml (R1)` | MATCH | none |
| P75 | `duplicator-changed:es:twice` | duplicator | es | (c) | `target-changed-r1.yml (R1)` | MATCH | none |

**Every one of the twenty-two printed `--- scrollspy installed=true native=true`**, so no verdict
below rests on a launch whose spy failed to install or whose platform lacked the method.

**No launch of either round hit `bytes=DIFFER`**, so 3d-2a's suspect-the-fixture-first instruction
was never exercised.

---

## 3. What this record reuses from P01–P11, and what it does not

**No rectangle in this record comes from a P01–P11 launch.** Every geometric claim below is measured
on a launch of §1.1's binary. That is deliberate: P01–P06 ran a binary whose provenance is not
established, and §12 shows that a panel rectangle is not even stable between two launches of the
identical case, so corroborating geometry across binaries would have been reading noise as signal.

**Two P01–P11 rectangles are cited, both as contradicted measurements and never as evidence for a
verdict**: P05's `491x758` and P03's `491x908` are what §12 measures against.

Every §7 obligation in §14's coverage table is discharged by a launch **of this step**. P07 and P11
(3d-2a's `fieldCollisions` launches) and P09 and P10 (its `notice.gone` launches) were re-taken here
as P12/P13 and P43/P44 rather than reused.

---

## 4. Question 1 — **is the reapply report visible now? YES.** The §11.1 Medium is closed

3c-2 measured the refused-reapply report at `y ∈ {−53, −70, −87, −104}` with `clip=above` in **all
42** `manualResolution` launches — five surfaces, both languages, four driver revisions — with the
outcome panel below it unmoved (§9 and §11.1 of that record, which agree on 42). **`PROGRESS.md`'s
"Next action" section says 18 for the same measurement; 42 is what the reading itself records, twice,
and it is the number used here.** **Sixteen refusal-arm readings of this step put the report at
`y = 44` — the band's own top — every time.**

| Surface | Lang | Launch | Case | Report box | `clip` |
|---|---|---|---|---|---|
| editor | en | P12 | `editor-ineligible` | `658,44,491x107` | **in** |
| editor | en | P14 | `editor-collision` | `658,44,491x107` | **in** |
| editor | en | P47 | `editor-missing` | `658,44,491x124` | **in** |
| editor | es | P13 | `editor-ineligible` | `658,44,491x124` | partial |
| editor | es | P15 | `editor-collision` | `658,44,491x124` | partial |
| editor | es | P46 | `editor-ambiguous` | `658,44,491x124` | partial |
| creator | en | P16 | `creator-anchor` | `658,44,491x124` | **in** |
| creator | es | P17 | `creator-anchor` | `658,44,491x141` | **in** |
| creator | es | P48 | `creator-anchor-gone` | `658,44,491x141` | **in** |
| deleter | en | P18 | `deleter-changed` | `658,44,491x124` | partial |
| deleter | es | P19 | `deleter-changed` | `658,44,491x141` | partial |
| mover | en | P20 | `mover-changed` | `658,44,491x124` | **in** |
| mover | en | P49 | `mover-after-changed` | `658,44,491x124` | **in** |
| mover | es | P21 | `mover-changed` | `658,44,491x141` | **in** |
| duplicator | en | P22 | `duplicator-changed` | `658,44,491x124` | partial |
| duplicator | es | P23 | `duplicator-changed` | `658,44,491x141` | partial |

**`clip=partial` here is at most a sub-pixel at the block's top edge, and the transcript proves the
bound rather than assuming it.** `clipOf` returns `partial` only when a block is neither wholly
inside the band, nor wholly above it, nor wholly below it. Every block above has a bottom of at most
`44 + 141 = 185` against a band bottom of `689`, so the bottom edge cannot be what makes it partial;
the only remaining possibility is `box.top < bandTop` with both printing `44` after `Math.round`.
Corroboration from the same transcripts: the following `block[0] scrolledTo` line, which asks the
platform for `block: 'start'`, reports the **identical** rectangle and the identical `partial` —
a block genuinely above the band moves when scrolled to, and none of these did. The same
`in`/`partial` split appears at identical heights across surfaces (creator en `124` is `in`, deleter
en `124` is `partial`), which is what a fractional scroll offset produces and not what a height
does.

**What is established.** In sixteen readings over five surfaces and both languages, the refused
reapply's report is drawn at the top of the visible band, legible without scrolling, up to at most
one sub-pixel of its top edge. **The outcome 3c-2 §11.1 handed to 3d has been reached** — stated as
the outcome, because the paragraph below is why this record does not state it as `revealReapplyReport`
having caused it.

**What made it move, and the review round measured the cause the first round could only infer.**
3c-2 §11.1 recorded that the outcome panel below the report was *unchanged* by the press — L47's four
choices at `667,1046` before and after. Here the opposite is measured: in P12 the editor's choices are
at `y = 1029` before the press and `y = 1143` after, and the scroller's `scrollTop` is `666` both
times while `scrollHeight` grows from `1682` to `1795`. So the outcome panel was displaced downward
by the report's own height instead of being held in place.

**The first round stopped there, saying it was not a proof that `scrollQuietly` was the cause,
because it could observe a position and not a request. P66 is the same case with the request
observed**, and it is:

```
P66:29  editor scrollreq segment=reapply count=1
P66:30  editor scrollreq[0] seg=reapply origin=app target=div.panel status=0
        opts=block:nearest,inline:nearest before[top=780 max=1150 sh=1795 ch=645 overflow=yes]
        after[top=666 …] delta=-114 rect=-70->44 text="espansoConfig applied nothing."
```

One request, issued by the window, `'nearest'`, on the report block. At the instant it fired the
report's top was at **−70** — above the band, exactly where 3c-2 measured it — and the pane's offset
was `780`. The call moved the pane to `666`, a `delta` of **−114**, and the report's top to **44**.
**The 114 recurs on both launches**: P12's outcome panel moved from `1029` to `1143`, and P66's pane
moved up by 114 — the same 114 px transition shape reproduced across the first launch and its
instrumented re-take. **They are not two observations of one event**: P12 and P66 are separate
launches on separate binaries, and the causal statement does not rest on pairing them. It rests on
P66's own record — one application-issued `block:nearest` call on the report, `count=1`, synchronously
paired with `delta=-114` and `rect=-70->44` — together with `rg -n 'scrollQuietly' src/lib`, which
leaves `revealReapplyReport` (`src/lib/components/reveal.ts:168`) as the only production path that
calls `scrollQuietly` with `'nearest'`, called from each match component's reveal effect. **So
`revealReapplyReport` is the cause of `y = 44`, measured, on the same case in which the first round
declined to claim it.** The other nine
`:twice` launches show the identical shape, with `delta` between −114 and −148 and `rect` ending at
`44` in every one (§9.1).

---

## 5. Question 2 — the success-path geometry

§7 item (f), on **all five** match surfaces in **both** languages, plus three extra mover placements
and both `alreadySatisfied` launches.

**What was never measured before is the *report* on a success arm; the selection banner beside it
was.** 3c-2 §9's second half measured that banner over 21 adopting launches and located it precisely
(nine editor ones above the band, twelve elsewhere at `y = 58`). It said nothing about where the
reapply report lands on a success, and 3d-1 §3.6's widening runs on exactly those two arms. §5.1 is
that measurement; F1 is the banner, reproduced.

### 5.1 (i) The report block is in the visible band on every success arm

| Surface | Lang | Launch | Arm | Report box | `clip` | Pane after |
|---|---|---|---|---|---|---|
| editor | en | P24 | `reapplied` | `658,622,491x67` | **in** | scrolls, `scrollTop=160` |
| editor | es | P25 | `reapplied` | `658,622,491x67` | partial | scrolls, `scrollTop=228` |
| editor | en | P36 | `reapplied` | `658,622,491x67` | partial | scrolls, `scrollTop=232` |
| editor | es | P37 | `reapplied` | `658,621,491x67` | **in** | scrolls, `scrollTop=305` |
| editor | en | P34 | `alreadySatisfied` | `658,639,491x50` | **in** | scrolls, `scrollTop=206` |
| editor | es | P35 | `alreadySatisfied` | `658,639,491x50` | partial | scrolls, `scrollTop=295` |
| editor | en | P45 | `alreadySatisfied` | `658,639,491x50` | **in** | scrolls, `scrollTop=206` |
| creator | en | P26 | `reapplied` | `658,591,508x50` | **in** | **no scroller** |
| creator | es | P27, P51, P53 | `reapplied` | `658,608,508x67` | **in** | **no scroller** |
| deleter | en | P28, P50, P52 | `reapplied` | `658,289,508x50` | **in** | **no scroller** |
| deleter | es | P29 | `reapplied` | `658,289,508x67` | **in** | **no scroller** |
| duplicator | en | P30 | `reapplied` | `658,337,508x50` | **in** | **no scroller** |
| duplicator | es | P31 | `reapplied` | `658,337,508x67` | **in** | **no scroller** |
| mover | en | P32 | `reapplied` | `658,478,508x50` | **in** | **no scroller** |
| mover | es | P33 | `reapplied` | `658,495,508x67` | **in** | **no scroller** |
| mover | en | P40 | `reapplied` | `658,541,508x50` | **in** | **no scroller** |
| mover | es | P41 | `reapplied` | `658,558,508x67` | **in** | **no scroller** |
| mover | en | P42 | `reapplied` | `658,541,508x50` | **in** | **no scroller** |

**On the four operation surfaces the pane stops scrolling altogether after a successful reapply.**
`scrollerOf` walks the ancestor chain for a computed `overflow-y` of `auto`/`scroll` **and**
`scrollHeight > clientHeight + 1`, and it named `section.detail` on the same blocks at the conflict
moment. That the blocks are still inside `.detail` afterwards is read from the transcript and not
assumed: `reportReach`'s `focusOrder` line enumerates `.detail`'s own focusables and begins with the
notice's *Dismiss*. **So `scroller=none` says the surface's whole content now fits the band**, and
everything on those surfaces is visible without scrolling. Their status blocks are `508` wide where
the scrolling ones are `491` — the scrollbar gutter, and §12 returns to it.

**On the editor the pane still scrolls, and the report sits at the bottom of the band.** The
editor's own form keeps the content taller than 645 px. The `partial` readings are the same
sub-pixel case as §4: `622 + 67 = 689` is exactly the band bottom.

**Every rectangle in the table above reproduced exactly on the review round's twelve re-takes**, on a
different binary: P54 `658,622,491x67`, P55 `658,622,491x67`, P56 `658,591,508x50`, P57
`658,608,508x67`, P58 `658,289,508x50`, P59 `658,289,508x67`, P60 `658,337,508x50`, P61
`658,337,508x67`, P62 `658,478,508x50`, P63 `658,495,508x67`, P64 and P65 `658,639,491x50` — twelve
for twelve against P24–P35, launch for launch in the same order. **What that is worth, and no more:**
it is a
reproduction of the *success-path report geometry* across two binaries, and §12 is why a
reproduction is worth stating rather than assumed. It is **not** a reproduction of the conflict
panel's height, which §12 shows is unstable and which P57 reproduces the higher of its two observed
values of.

### 5.2 (ii) The controls a person would use next

- **Deleter — the renewed confirmation (`MatchDeleter.svelte:464`, above the report at `:516`).**
  P28/P29 `focusOrder=[Dismiss | Show this file's text | Leave this alone | Delete this snippet]`
  (Spanish: `Descartar | Mostrar el texto de este arc | Dejarlo como está | Eliminar este
  fragmento`), with `scroller=none`. **The reveal did not take the confirmation off the top of the
  band**, which is the question §7 asks of this surface: nothing on the surface is outside the band
  at all.
- **Mover — the rebuilt destination list (`MatchMover.svelte:663`–`:703`, above the report at
  `:779`).** P32/P33 `focusOrder=[… | Leave it where it is | At the top of the list | After …]`
  (Spanish `… | Dejarlo donde está | Al principio de la lista | …`), `scroller=none`. Same verdict,
  and Spanish — the longer text — is `no scroller` too.
- **Duplicator — the ordinary refusal/acknowledgement round.** P30: `refusalRound block[1]
  box=658,337,508x145 clip=in`, `lastControlScrolledTo box=758,452,108x23 clip=in`, *Save anyway* at
  `667,452,85x23`. P31: block `508x179`, *Guardar de todos modos* at `667,486,150x23`, `clip=in`.
  **§7's requirement that this panel still need no scrolling holds in both languages.**
- **Creator.** P26/P27 `focusOrder=[Show this file's text | Stop adding | match/conflict.yml | At the
  top of the list… | …]` with `scroller=none`.
- **Editor — the one surface where this is an argument and not a measured rectangle.** The action
  row is drawn at `MatchEditor.svelte:771` (*Undo*) and `:777` (*Save this snippet*), **before** the
  report at `:816`. P24's `afterReapply focusOrder` ends `… | Undo | Save this snippet`, and the
  probe's focus-order line drops disabled buttons, so both are enabled. The report is the last block
  in the pane and its bottom coincides with the band's bottom, so the 578 px of document immediately
  above it are on screen. **The transcript prints no rectangle for *Save this snippet*** — the probe
  measures controls only inside `role="status"` blocks — so this is DOM order plus a measured band,
  not a measured rectangle. That is a bound of the instrument, recorded in §15.

### 5.3 Which of the three the reveal did — **measured: it moved nothing, on all five surfaces in both languages**

**This section replaces a claim the first round could not support.** It said *down or nothing, never
up*, and the review found (finding 1) that every sample was taken after the transition, so nothing
in the first round's evidence distinguished a reveal that scrolled from a clamp that produced the
same final number. **The review round measured the request.** In all twelve success launches the
window issued **exactly one** `scrollIntoView`, `origin=app`, `block:nearest`, on the report block,
and in all twelve the pane's `delta` was **0** and the report's own `top` was unchanged across the
call.

| Launch | Surface, lang | At the instant of the request | `delta` | Report `top` |
|---|---|---|---|---|
| P54 | editor en | `top=160 max=160 overflow=yes` | 0 | `622 -> 622` |
| P55 | editor es | `top=228 max=228 overflow=yes` | 0 | `622 -> 622` |
| P64 | editor en, `alreadySatisfied` | `top=206 max=206 overflow=yes` | 0 | `639 -> 639` |
| P65 | editor es, `alreadySatisfied` | `top=295 max=295 overflow=yes` | 0 | `639 -> 639` |
| P56 | creator en | `top=0 max=0 overflow=no` | 0 | `591 -> 591` |
| P57 | creator es | `top=0 max=0 overflow=no` | 0 | `608 -> 608` |
| P58 | deleter en | `top=0 max=0 overflow=no` | 0 | `289 -> 289` |
| P59 | deleter es | `top=0 max=0 overflow=no` | 0 | `289 -> 289` |
| P60 | duplicator en | `top=0 max=0 overflow=no` | 0 | `337 -> 337` |
| P61 | duplicator es | `top=0 max=0 overflow=no` | 0 | `337 -> 337` |
| P62 | mover en | `top=0 max=0 overflow=no` | 0 | `478 -> 478` |
| P63 | mover es | `top=0 max=0 overflow=no` | 0 | `495 -> 495` |

**The four operation surfaces: nothing scrolled, and nothing could.** At the instant the request
fired the pane's `max` was already **0** — `sh=645 ch=645`, the content already fitting the band. So
`delta=0` there is a **container with no range**, and it is not evidence about what the request asked
for. What *is* established on those four is that the report was already inside `[44, 689]` before the
reveal and stayed there, and that no reveal could have moved anything on that surface at all.

**The editor: nothing scrolled, and something could have — so there the zero is not a range clamp.**
At the instant the request fired the pane had `overflow=yes` with between 160 and 295 px of **upward**
room (`top` equal to `max` in all four), and the reveal spent none of it. The request returned
without throwing and produced **no movement while the report was already in view** — which is the
specified no-movement outcome for an element already fully inside the scrollport, and no range clamp
can account for it. What is now a measurement rather than an inference is the request and the absence
of movement; the platform's own handling of the request is not observed (§1.4 bound 1).

**The clamp, separated from the reveal at last.** On the editor the pane's offset before the press
is 666–735 and at the instant of the request it is already 160–295, equal to the **new** `max`; the
request itself then moves nothing. Two things make the clamp the only remaining explanation: the
segment records `count=1`, so that request is the *only* `scrollIntoView` issued between the press
and the settled frame; and **nothing in `src/lib/` writes `scrollTop` or calls `scrollTo` at all** —
`rg -n 'scrollTop|scrollTo\(' src/lib` finds only doc comments and `reveal.ts`'s
`scrollIntoView`. **So the editor ends at its maximum offset because the browser clamped `scrollTop`
to a `scrollHeight` that shrank when the panel was rebuilt, not because the reveal scrolled it
down** — which is precisely the pair the first round said it could not separate.

**The answer to §7's question, stated as the three-way choice 3d-1 asked for.** On the success path
the reveal **does not scroll at all**, on any of the five match surfaces, in either language: not up,
not down. The `'nearest'` request is issued every time and moves nothing every time. On the **refusal**
path the same call does scroll, and it scrolls the pane **up** by 114–148 px — `scrollTop`
decreasing, which carries the outcome panel's controls **down** the screen — bringing the report from
`y ∈ {−70, −87, −104}` to `y = 44` (§4, §9.1).

**What this does not establish.** That the report is *readable* where it ends up is §5.1's `clip`
evidence and not this section's; that no other mechanism moved the pane in the same tick is bounded
by §1.4's first bound; and the four operation surfaces contribute no evidence about what the request
would have done to a pane with room, only about the container's range.

---

## 6. Question 3 — `browser.notice.gone` judged on a screen, both languages

P43 (en) and P44 (es), through `editor-reload-gone`: *Reload disk version*, then *Confirm reload*.

```
P43:25  editor afterReload report box=658,58,508x103
        "The selection was cleared, because espansoConfig can no longer point at the snippet that
         was selected. That is not a statement that it was removed: nothing here searched this file
         for it. Dismiss"
P44:25  "Se ha borrado la selección porque espansoConfig ya no puede señalar el fragmento que estaba
         seleccionado. Eso no significa que se haya eliminado: aquí no se ha buscado el fragmento en
         este archivo. Descartar"
```

`clip=in`, `scroller=none`, its *Dismiss* at `1088,66,66x27` (`1075,66,79x27` in Spanish), also
`clip=in`. **Visible without scrolling in both languages.**

**The judgement, and this launch is the ideal case for it.** The predicate is
`view.matches[previous.position] === undefined` — a fact about the **length** of the list. The plan
holds the selection at `:gamma`, position 2, and the R1 is `target-deleted-r1.yml`, whose two items
are `:alpha` and `:gamma`. **So `:gamma` is still in the file** — it moved to position 1 — and the
notice fires anyway. The sentence's disclaimer is therefore not decorative: *"That is not a
statement that it was removed: nothing here searched this file for it"* is **true, load-bearing and
exactly right in this launch**, where the naive reading would have been false. **PASS, both
languages.**

**Its second producer is a hole and was not provoked.** `repairSelection`'s `clearSelection` arm
(`src/lib/browser/selection.ts:292`) has no row in `launch.sh` and no arm in `runPlan`. Both
producers render the same string, so the sentence has been read; what is unmeasured is the
*situation* the second producer puts a person in. Unchanged from 3d-2a §6.7 point 1.

---

## 7. Question 4 — `browser.matchEditor.reapply.fieldCollisions`, in full, in both languages

The two arms were isolated by the fixture pair 3d-2a §8.2 built, and this step launched both in both
languages: `editor-ineligible` (P12 en, P13 es) and `editor-collision` (P14 en, P15 es).

**English (P12:27, byte-identical in P14:27):**

> espansoConfig applied nothing. Nothing was written, this window was not moved, and what you kept is
> still here exactly as it was. The reason follows. The version on disk does not hold these fields
> the way the version your draft was built on did — a different value, the key added or removed, or a
> change in whether this app will edit it — so espansoConfig will not decide what to do with them:
> Replacement text.

**Spanish (P13:27, byte-identical in P15:27):**

> espansoConfig no ha aplicado nada. No se ha escrito nada, esta ventana no se ha movido y lo que
> conservaste sigue aquí exactamente igual. El motivo es el siguiente. La versión en disco no
> contiene estos campos tal como los contenía la versión sobre la que se construyó tu borrador —un
> valor distinto, la clave añadida o quitada, o un cambio en si esta aplicación los edita—, así que
> espansoConfig no decide qué hacer con ellos: Texto de sustitución.

**Verdict: TRUE of the predicate in both arms, in both languages. 3c-2 §11.5's Medium is closed.**
The old sentence claimed the disk had *changed a field's value*; the predicate only requires the
field's state to differ. The new one is a **disjunction** naming three states, and the two launched
arms are two different disjuncts:

- **P14/P15** (`target-changed-r1.yml`): `:beta`'s `replace` holds different bytes on disk — the
  first disjunct.
- **P12/P13** (`target-empty-replace-r1.yml`): the disk's `replace:` owns no bytes, so
  `fieldEligibility` answers `ownsNoBytes` and the field is refused as read-only, **while the value
  the draft asks for (`""`) is what the disk already holds** — the third disjunct, and the one the
  old wording was false about. The two fixtures differ by one pair of quotation marks, so eligibility
  is the only thing that separates the launches.

Both name the affected field (*Replacement text* / *Texto de sustitución*), and the Spanish is in
the *tú* register (*conservaste*, *tu borrador*) — 3c-2 §11.2's Low, closed for this key.

**One neutral observation, and it is not a defect (F5 in §13).** The two arms draw the
**byte-identical** sentence, so a person cannot tell from it whether the disk holds a different value
or the field has become read-only. **That is the model working as 3d-1 designed it, and the first
version of this paragraph was wrong to add "and those call for different actions."** The review found
it (finding 4) and `2c-4b-3d-1-notes.md` §4.2 lines 339–358 is the governing record: the sentence was
widened deliberately, because **any one collision refuses the whole reapply and "the recovery offered
is identical for all three"**, and because a field can differ in value *and* in eligibility at once,
so attributing a collision to one disjunct would need a precedence rule — a claim about which
difference *caused* the refusal that the predicate does not support, which is the defect being fixed
re-introduced one level down.

**3d-1's truthfulness fix is therefore delivered.** The rendered sentence is a real disjunction and
is true in both isolated arms, which is what §7 measures. That the model does not hold the
distinction is visible in the code — `fieldReapplyVerdict` returns a bare `{ kind: 'collision' }`
(`src/lib/browser/matchEditor.ts:1862`, `:1866`) and `MatchReapplyPlan.collisions` is a list of
fields with no reason attached — so there is nothing being hidden from the sentence. Naming a disjunct
would be a model change *and* a change to §4.2's decision, not a wording one.

---

## 8. (b) Where the conflict panel's first line landed — and 3c-2 §11.4's acceptance constraint holds

3d-1 §3.3 predicted from arithmetic that the editor's conflict panel would be pushed to ≈141–178.
Measured, on the refusal arm, as the second `role="status"` block after the press:

| Surface | en | es |
|---|---|---|
| editor | **158** (P12, P14) / 175 (P47) | **174** (P13, P15, P46) |
| creator | 175 (P16) | 192 (P17, P48) |
| deleter | 174 (P18) | 191 (P19) |
| mover | 175 (P20, P49) | 192 (P21) |
| duplicator | 174 (P22) | 191 (P23) |

The editor's two values fall inside §3.3's predicted range; the other surfaces land at 174–192,
17–34 px lower, because their reports are one or two lines taller than the editor's.

**Every one of them is inside the band [44, 689].** 3c-2 §11.4 set the acceptance constraint on this
fix — *whatever is done must not push the conflict panel's own first line out of view* — and it
**holds on all five surfaces in both languages**. The gap between the report's bottom and the outcome
panel's top is **6 or 7 px** in every one of the sixteen launches — editor en `44 + 107 = 151`
against `158`, editor es `44 + 124 = 168` against `174` — and the one-pixel spread is the rounding of
the printed rectangles, not two different layouts.

---

## 9. (c) The second press — a mechanism with an observation at last

**Ten launches used the `:twice` third segment** — P12, P13, P16–P23 — the first in this project's
history. For every one of the ten, the `report` lines after the first press and the `second report`
lines after the second are **identical, text and rectangle**, compared mechanically over the whole
retained transcript; and `scrollTop`, `scrollHeight` and `clientHeight` are identical too.

```
P12  first  report box=658,44,491x107 …    second report box=658,44,491x107 …    scrollTop=666 both
P21  first  report box=658,44,491x141 …    second report box=658,44,491x141 …    scrollTop=417 both
```

**What the ten launches of the first round settle.** **A person cannot tell the two presses apart.**
Nothing on screen changes: not the sentence, not the rectangle, not the scroll position.

**What they do not settle, and the review found it (finding 2).** 3d-1 §7 owes *two* things of a
second press — that it **still scrolls** and that a person can tell the presses apart — and comparing
two identical final frames answers only the second. "Remained in the band" is not "still scrolls":
the first round's ten launches were equally consistent with a second press that issued no reveal
request at all. §9.1 is the measurement that separates them.

### 9.1 The second press, with the request observed — **it still scrolls, and the request moves nothing**

**Ten re-takes, P66–P75, five surfaces, both languages.** In every one of the ten the second press
issued **exactly one** `origin=app` `scrollIntoView`, `block:nearest`, on the same report block as
the first press, and in every one it moved nothing:

| Launch | Surface, lang | First press `delta` | Second press | Second `delta` | Report `top` |
|---|---|---|---|---|---|
| P66 | editor en | −114 (`rect -70->44`) | `count=1` | 0 | `44 -> 44` |
| P67 | editor es | −131 (`-87->44`) | `count=1` | 0 | `44 -> 44` |
| P68 | creator en | −131 (`-87->44`) | `count=1` | 0 | `44 -> 44` |
| P69 | creator es | −148 (`-104->44`) | `count=1` | 0 | `44 -> 44` |
| P70 | deleter en | −131 (`-87->44`) | `count=1` | 0 | `44 -> 44` |
| P71 | deleter es | −148 (`-104->44`) | `count=1` | 0 | `44 -> 44` |
| P72 | mover en | −131 (`-87->44`) | `count=1` | 0 | `44 -> 44` |
| P73 | mover es | −148 (`-104->44`) | `count=1` | 0 | `44 -> 44` |
| P74 | duplicator en | −131 (`-87->44`) | `count=1` | 0 | `44 -> 44` |
| P75 | duplicator es | −148 (`-104->44`) | `count=1` | 0 | `44 -> 44` |

**The zero is not a range clamp, and that is what the transcript excludes.** At the instant
of the second request the pane reported `overflow=yes` in all ten, with `max` between 384 and 1297
and `top` between 141 and 735 — room in **both** directions, hundreds of pixels of it. The pane
could have moved and did not: the request returned without throwing and produced **no movement while
the report was already in view**, which is the specified no-movement outcome for an element already
fully inside the scrollport and is what `revealReapplyReport`'s contract in
`src/lib/components/reveal.ts:145`–`:159` asks for. Whether the platform honoured that specified
outcome or ignored the call is not observable here (§1.4 bound 1).

**So obligation (c)'s first half is discharged, and its answer is narrower than the words suggest.**
*Still scrolls* is true in the sense that the second press **re-issues the reveal request and the
native call returns without throwing** — `threw=false` in all ten, which says the call did not throw
and not that the platform honoured it; it is false in the sense of producing movement, and the report
was already where the reveal asks for it to be. The `$effect` at
`MatchEditor.svelte:335`–`:337` and its four counterparts do re-run on a second press, which is what
`count=1` in the `secondReapply` segment measures.

This is the surviving half of 3c-2 §11.1's second paragraph, and it is much smaller than it was:
there the second press reproduced an **invisible** refusal, so nothing distinguished *refused* from
*did not fire*. Now the refusal is on screen and true before the second press is made, and what is
missing is only a signal that a **new** attempt was processed. Graded **Low** in §13 (F3).

**A bound that stands.** There is still no invoke spy and no command counter, so *whether the second
press ran a second reapply transition* is not observable here. What §9.1 adds is one link of that
chain and not the chain: the component's reveal effect re-ran, which it does when the report object
is rebuilt. That the report object was rebuilt by a second **attempt** rather than by anything else
is an inference from `MatchEditor.svelte:328`–`:334`'s own reasoning and not a measurement.

---

## 10. (e) `differentMatch` beside a reapply block that identifies the same snippet

P36 (en) and P37 (es), through `editor-fallback` — `target-labelled-r1.yml`, where the disk adds a
label to `:beta`, so its bytes differ while its trigger does not. **3d-2a §6.7's caution 3 is
respected: P08 and P34/P35 pair the notice with `alreadySatisfied` and are a different pairing; the
launches quoted here are `reapplied`.**

```
P36:27  "This file changed on disk, and what is now in that position is no longer written the way the
         snippet you had selected was, so the selection was cleared. That may be the same snippet
         with changes in it, or a different one: espansoConfig compares the text and cannot tell
         which. Dismiss"
P36:28  "This window now shows the version on disk, with what you kept set up over it. Nothing has
         been written yet: send it when you are ready, and that save can still be refused or
         conflict."
```

**The contradiction 3c-2 §11.3 opened is gone.** The old sentence asserted that *what is now in that
position is a different snippet* while the block below reported that the reapply had identified that
same snippet by correspondence evidence. The new sentence asserts no identity at all: it states the
byte comparison, names its two possible causes and says the application cannot choose between them —
a restatement of `matchFingerprint` inequality and nothing more. The reapply block beside it claims
no identity either; it says the window now shows the disk version with the draft set up over it.
**The two are consistent. PASS, both languages** (P37's Spanish is the same three clauses:
*"Puede ser ese mismo fragmento con cambios, o uno distinto: espansoConfig compara el texto y no
puede saberlo"*).

The reapply then wrote the file: P36 and P37 both end `bytes=MATCH against
editor-fallback-expected.yml` with a backup present — the first comparison ever made against that
predicted fixture.

**One residual, recorded as an observation (F6).** The notice says *the selection was cleared* while
the editor stays open on the very snippet whose bytes changed, and the save that follows writes to
it. Both sentences are true — they are about two different things, the snippet **list**'s selection
and the editor's own target — and nothing on screen says they are about different things. P36:38's
final panel is where the consequence surfaces: *"This window does not hold a fresh reading of this
snippet, so it cannot read it again here. Stop editing, open the file…"*.

---

## 11. The RawEditor — the negative, now in both languages

P38 (en) and P39 (es). 3d-2a had `raw-negative` in English only.

```
P38:12  raw keepMyDraft=absent keepMyRequest=absent
P38:13  raw readiness ready=absent
P38:14  raw readiness readyOperation=absent
P39:12  raw keepMyDraft=absent keepMyRequest=absent      (documentElement.lang=es, P39:2)
P39:13  raw readiness ready=absent
P39:14  raw readiness readyOperation=absent
```

Three choices only, in both languages — *Keep editing · Copy my text · Load the version on disk* /
*Seguir editando · Copiar mi texto · Cargar la versión del disco* — and **exactly one
`role="status"` block on screen** (`block[0]` and no `block[1]` in either `reportReach` dump), which
is the conflict panel itself. **So no reapply control, no readiness sentence and no report block; the
whole reapply family is absent from this surface in both languages.** `clip=in` on the panel and on
all three controls: the raw editor remains the one surface whose conflict panel needs no scrolling.

**A bound on the register half of §7's row.** `rawPlan` never calls `reportReapply`, so the panel's
own text is not in the transcript. What is established is *absence by enumeration* — no reapply
control, neither readiness sentence, one status block — and not a scan of the panel's prose.

---

## 12. The 17 px discrepancy — **reproduced, and the comparison it came from is confounded**

3d-2a §4.1 measured two panels 17 px taller than 3c-2 §4.1 records and could separate neither of its
two candidates (3d-1 changed the components; the fixtures are re-authored). **This step launched the
identical case more than once on one binary, and the result is that the earlier comparison cannot
decide anything.**

| Case | Lang | Launches | Binary | Conflict panel heights |
|---|---|---|---|---|
| `creator-front` | es | P27, P51, P53 | `84148bbf…` | **925**, 908, 908 |
| `creator-front` | es | P57 | `7fe2a6da…` | **925** |
| `deleter-exact` | en | P28, P50, P52 | `84148bbf…` | 741, 741, 741 — and **758** in 3d-2a's P05 |
| `deleter-exact` | en | P58 | `7fe2a6da…` | 741 |

**The conflict panel's height is not stable between launches of the identical case.** P27 and P51
differ by exactly 17 px with the same case, the same fixture, the same binary and the same viewport;
so do P28 and 3d-2a's P05. The review round's P57 lands on 925 again, so `creator-front:es` has now
produced 925 twice and 908 twice across two binaries — a two-valued measurement, not a drift.

**What that establishes, and what it does not — corrected from the first round's claim.** The first
version of this section said the discrepancy was "neither of the two candidate causes" and that this
step "separates both". **It does not.** One differing repeat is enough to establish that the panel's
height is **not deterministic** under the variables this harness records, and enough to **retire a
bare 17 px cross-launch difference as evidence** of a component or fixture effect. It is *not* enough
to show that a component change or a fixture difference made no contribution to the P01–P11
comparison: an uncontrolled 17 px variation can mask a real effect or coincide with one, and no
design here can tell those apart. **The correct conclusion is that the 3d-2a discrepancy is
confounded by demonstrated between-launch instability and cannot distinguish either candidate** —
neither confirming nor excluding a component or fixture contribution. `deleter-exact:en` repeating
741 four times out of four does not change that causal limit, and 3d-2a's P05 ran an unprovenanced
binary in any case.

**Where 17 comes from, as a hypothesis with one piece of evidence and not a finding.** 17 px is one
text line in this layout — the report block measures 107/124/141 across the launches, in steps of 17,
and the en/es pairs differ by exactly one step. And **17 px is also this webview's scrollbar
gutter**: a status block is `491` wide inside a scrolling `section.detail` and `508` wide once the
pane stops scrolling (§5.1), a difference of exactly 17. A layout computed while the gutter is
present wraps one string one line earlier than one computed without it. That is consistent with
everything measured here and is **not established**; nothing in this instrument observes when the
layout was computed.

**What survives as a stable measurement, stated as the repeats it rests on.** Two cases were launched
more than once: `deleter-exact:en` repeated its conflict panel exactly, four times out of four —
three on `84148bbf…` and one on `7fe2a6da…` — and `creator-front:es` did not, over the same four.
**So the instability is real and it is not universal, and four launches per case is all the evidence
there is for either half** — enough for both existence statements and not enough to exclude a cause. The *success*-path geometry, by contrast, repeated
exactly in both cases and across both binaries — P27, P51, P53 and P57 all put the creator's success
report at `658,608,508x67`, and P28, P50, P52 and P58 all put the deleter's at `658,289,508x50`. What
varies is the conflict panel's own height, which is the one box whose content is a long wrapped prose
block.

**Consequence for this record.** No verdict above rests on a panel height. Question 1's verdict rests
on `y = 44` and `clip`, question 2's on `clip`, on `scroller=none` and — since the review round — on
`delta` and `max` at the instant of the request, and §8's on the outcome panel's `y` being inside
`[44, 689]`. All of those have margins of hundreds of pixels, not seventeen; and `delta` is a
before-and-after of the same pane inside one call, so a panel that laid out 17 px taller changes both
its terms equally and their difference not at all.

---

## 13. Findings

**None of the six touches what is written to disk.** Every launch's `bytes=` is MATCH over both
rounds, the **nine** positive cases produced their hand-authored or predicted post-reapply bytes with
a backup present, and every refusal case ended byte-identical to R1 with no `.espansoconfig-backups`
directory found by either half of the search. The review round adds ten more positive launches over
five of those nine cases (P54–P63) and twelve more refusal launches (P64–P75), all MATCH, so the
instrumentation changed nothing about what reaches a file — which is the one thing a harness change
had to be checked against.

### F1 — **On the editor's success path a status block with a control lies wholly outside the visible band.** Low, and **reproduced rather than discovered**. Not a disk defect

Measured on the editor and only on the editor, in both languages and on all three of its success
launches with a selection notice:

```
P24  editor afterReapply block[0] box=658,-102,491x61  clip=above   ctl "Dismiss" box=1071,-94  clip=above
P25  editor afterReapply block[0] box=658,-170,491x61  clip=above   ctl "Descartar" clip=above
P34  editor afterReapply block[0] box=658,-148,491x124 clip=above   ctl "Dismiss" clip=above
P35  editor afterReapply block[0] box=658,-237,491x145 clip=above
P36  editor afterReapply block[0] box=658,-174,491x124 clip=above
P37  editor afterReapply block[0] box=658,-247,491x145 clip=above
P45  editor afterReapply block[0] box=658,-148,491x124 clip=above
```

The block is the selection notice — `browser.notice.kept` (`en.json:122`, *"…the snippet you had
selected was found again"*) in P24/P25, `browser.notice.differentMatch` in P34–P37 and P45 — and it
carries a *Dismiss* control. It is at `y ∈ {−102 … −247}` with nothing on screen indicating it
exists.

**3c-2 §9 measured this already, and deliberately did not file it.** That section separated *two*
things drawn at a negative `y`: the reapply report on a refusal — its Medium, now closed — and **the
selection banner on a success**, which it put "above the band on the **nine editor** ones (y between
−85 and −184, `clip=above`) and comfortably in view at y = 58 on the **twelve** deleter, duplicator
and mover ones", adding that its problem was §11.3, *what it says*, and not where it is. This reading
reproduces that measurement on seven editor success launches after 3d-1, and confirms the other four
surfaces are still at `y = 58` (§5.1, `scroller=none`). **So the correction to the brief this step was
given is that the success-path geometry was not wholly unmeasured — the banner's position was; what
had never been measured is the reapply *report* on a success arm, which is §5.1 and is sound.**

**It is a layout conflict rather than a misplaced reveal, and the numbers say so.** The editor's
success layout is 805–950 px tall in a 645 px band, with the notice at the document's top and the
report at its bottom. **The two cannot both be in the band at any scroll offset**: at `scrollTop=0`
the notice is visible and the report is below the fold; at the maximum offset — which is where every
launch ended — the report is visible and the notice is above it. Choosing the report is the better of
the two, and the notice is reachable: P24:32 shows `block[0] scrolledTo box=658,44,491x61 clip=in`.

**Why Low — grounded in current impact and reachability, which is a correction.** The first version
of this paragraph gave as part of its reason that 3c-2 §9 had judged the same measurement and
declined to file it. The review found that unsound (finding 6): an earlier reading's decision not to
file is evidence that the behaviour is **reproduced and not a regression**, and it is not an
independent reason to cap a grade after the new fact that the block carries a control. The grade
therefore rests on three things that are true today, each checkable:

1. **The block is informational.** It is `browser.notice.kept` or `browser.notice.differentMatch`,
   a statement about what happened to the selection; its only control is *Dismiss*, which removes the
   statement and nothing else.
2. **It is off-screen, not unreachable.** P24 `probe.log:32` — `block[0] scrolledTo
   box=658,44,491x61 clip=in` — brings it to `y = 44`, the band's own top, by scrolling alone.
3. **It is confined to one surface.** The other four put the same block at `y = 58`, `clip=in`,
   with `scroller=none` (§5.1), so nothing on them is outside the band at all.

**What this reading adds to 3c-2 §9 is one fact that section does not state** — the block carries an
interactive control, and that control is above the band with it. That is why it is filed here where
§9 did not file it; the grade is Low for 1–3 above and for nothing else.

**Not a regression of 3d-1, and this is the whole of what 3c-2 §9 is cited for**: that section
measured the identical geometry on nine editor launches before 3d-1 existed, which establishes
provenance and non-regression and settles no question of severity.

### F2 — **The reapply report's bottom is flush with the band's bottom on the editor's success path.** Low. Not a disk defect

P24/P25/P36 put the report at `y = 622` with height 67 — bottom at exactly 689, the band bottom —
and P34/P35/P45 at `y = 639` with height 50, likewise 689. Three of those six print `clip=partial`,
which by §4's argument is a sub-pixel overhang. The report is legible, but its last line sits on the
edge with no margin below it, and any future growth of that string by one line would take it out of
view on this surface. **Low**: it is on screen today, in both languages, in every launch.

### F3 — **A second press changes nothing on screen.** Low. Not a disk defect

§9. Ten `:twice` launches, five surfaces, both languages: the report's text and rectangle and the
scroll position are identical after the second press. The answer is visible and true; what is absent
is any signal that a new attempt was processed. **Low**, down from the Medium half of 3c-2 §11.1 that
this is the remainder of, because the person is no longer looking at an unchanged screen with no
answer on it — they are looking at the answer.

**The finding and the evidence gap the review found beside it are two different things, and §9.1 is
why they are now separate.** F3 is an application feedback defect: no signal of a new attempt. The
gap was a **record** defect: obligation (c) also owed *that a second press still scrolls*, and the
first round answered it with "the report remained in the band". §9.1's ten re-takes close the gap by
measurement — a second `origin=app` request is issued in all ten and produces no movement, against a
pane that had room to move — and they do **not** soften F3, because a request that produces no
movement is exactly a second press with nothing on screen to show for it.

### F4 — **The report block and the outcome panel are two same-width status panels 6–7 px apart.** Observation

3d-1 §7 asked for this to be looked at and said a finding here would be 3d's and not a regression.
Measured: on the refusal arm the report is `491` wide at `y = 44` and the outcome panel `491` wide at
`y = 158`–`192`, with a **6 or 7 px** gap in all sixteen refusal launches (§8; the one-pixel spread is
the rounding of the printed rectangles). **Whether they read as one panel is not decidable from a
transcript** — this instrument prints rectangles and text, never computed style — so this is recorded
as the geometry and not as a verdict. What can be said is that nothing in the geometry separates them
beyond that gap and that both are the same width.

### F5 — **`fieldCollisions`' two arms draw one sentence, by design.** Observation, and no defect is claimed

§7. The same sentence for a changed value and for a field that became read-only, measured
byte-identical in P12/P14 and P13/P15. **`2c-4b-3d-1-notes.md` §4.2 chose that deliberately**: every
collision member refuses the whole reapply, the recovery offered is identical for all three, and
overlapping causes make attributing one reason a precedence claim the predicate cannot support. So
this is recorded as *what the model intentionally does not attribute*, and **not** as an incomplete
fix — 3d-1's truthfulness fix is delivered. Changing it means changing that decision first.

### F6 — **A cleared selection is announced beside an editor still open on that snippet.** Observation

§10. Both sentences are true; nothing on screen says they are about different objects.

### Three things that are **not** findings of this reading

1. **Nothing moves focus into either panel** (3c-2 §11.6, 3d-1 §7 point 2). Reproduced, and read
   from the **first** `reportReach` of each plan only: `conflict activeElement=textarea.text` on the
   editor (P12:17), the creator (P16:18) and the raw editor (P38, P39:15), `activeElement=body` on
   the deleter (P18:16), the mover (P20:15) and the duplicator (P22:15). **The `afterReapply` and
   `afterSecond` `activeElement` lines may not be read as the application's doing** — `reportReach`
   calls `focusable()` on every control it enumerates, so from the second call onward the line
   reports the probe's own last focus. That bound is new here; §4.3 of 3c-2 quoted only first-call
   readings and is unaffected.
2. **The Spanish editor and creator still wrap four choices onto two rows.** Editor es P15: rows at
   `y = 1079` and `y = 1107`. Creator es P17: rows at `y = 911` and `y = 938`. Layout, unchanged,
   and 3d-1 §7 point 3 predicted the reveal would push both rows lower — §8 measures exactly that.
3. **The 17 px panel-height difference** is §12's measurement instability and is filed as neither a
   regression nor a fixture defect.

---

## 14. Coverage against `2c-4b-3d-1-notes.md` §7

Every row is discharged by a launch **of this step** (§3). "Hole" and "coverage gap" are used as
3d-2a §6.7 defines them: a **hole** has no row in `launch.sh` and no arm in `runPlan`, so nothing
could be launched; a **coverage gap** is a case that exists and that no launch took.

| §7 obligation | en | es | Verdict |
|---|---|---|---|
| (a) editor — refused report in the band | P12, P14, P47 | P13, P15, P46 | §4, PASS |
| (a) creator | P16 | P17, P48 | §4, PASS |
| (a) deleter | P18 | P19 | §4, PASS |
| (a) mover | P20, P49 | P21 | §4, PASS |
| (a) duplicator | P22 | P23 | §4, PASS |
| (b) conflict panel's first line, all five | P12–P23, P46–P49 | idem | §8, PASS; §11.4's constraint holds |
| (c) second press — perceptibility | P12, P16, P18, P20, P22 | P13, P17, P19, P21, P23 | §9, F3 |
| (c) second press — **still scrolls** | P66, P68, P70, P72, P74 | P67, P69, P71, P73, P75 | §9.1, PASS: request re-issued, no movement, pane had room |
| (d) `fieldCollisions` in full | P12, P14 | P13, P15 | §7, PASS; §11.5 closed |
| (e) `differentMatch` beside a same-snippet reapply | P36 | P37 | §10, PASS; §11.3 closed |
| (f) editor — `reapplied` | P24, P36 | P25, P37 | §5, PASS + F1, F2 |
| (f) editor — `alreadySatisfied` | P34, P45 | P35 | §5, PASS + F1, F2 |
| (f) creator | P26 | P27, P51, P53 | §5, PASS |
| (f) deleter, incl. the renewed confirmation | P28, P50, P52 | P29 | §5.2, PASS |
| (f) mover, incl. the rebuilt destination list | P32, P40, P42 | P33, P41 | §5.2, PASS |
| (f) duplicator, incl. the acknowledgement round | P30 | P31 | §5.2, PASS |
| (f) **which of the three the reveal did** — editor | P54, P64 | P55, P65 | §5.3, PASS: one `'nearest'` request, `delta=0`, room unspent |
| (f) **which of the three** — creator | P56 | P57 | §5.3, PASS: `delta=0` against `max=0`; report already in band |
| (f) **which of the three** — deleter | P58 | P59 | §5.3, as above |
| (f) **which of the three** — mover | P62 | P63 | §5.3, as above |
| (f) **which of the three** — duplicator | P60 | P61 | §5.3, as above |
| RawEditor — no reapply control, no readiness | P38 | P39 | §11, PASS (with §11's bound) |
| `browser.notice.gone` on a screen | P43 | P44 | §6, PASS |

**Two claims, and only the narrower one was true before the review round.**

1. **"No coverage gap remains in the driver's 23-row table."** A *case* that exists and that no launch
   took — 3d-2a §6.7's definition. This is true, and it was true after P53: all 23 cases have been
   launched, checked by collecting the `--- begin` line of all 75 transcripts.
2. **"Every fact §7 asks for was measured."** A different and stronger claim. **It was false after
   P53**: obligation (f)'s *record which of the three happened* and obligation (c)'s *still scrolls*
   had no observation behind them, because every sample was taken after the transition (the review's
   findings 1 and 2). Both were closed by measurement in the review round — §5.3 and §9.1 — and are
   claimed here on that evidence and not on the first claim.

**The first round's own sentence, "Nothing in §7 is left unmeasured", was an expansion of claim 1
into claim 2 and is the reason this distinction is now written down.** With P54–P75 both claims hold;
the point of separating them is that a later reading which launches every case has still not, by that
fact alone, measured every requested fact.

What remains unreachable is what 3d-2a §6.7 already named, and neither round closed or widened it:

- **`browser.notice.gone`'s second producer** — `repairSelection`'s `clearSelection` arm
  (`src/lib/browser/selection.ts:292`) — is a **hole**. No row, no arm; a case costs a plan function
  before it costs a launch. Not a §7 obligation. **Hole 1 of five.**
- **The confirmed-reload transition on the creator, the deleter, the mover and the duplicator** —
  four **holes**, 3d-2a §6.7 point 2. The transition exists on all five match surfaces and has a case
  on one. Not a §7 obligation. **Holes 2–5 of five.**
- **No coverage gap remains in the driver's 23-row table.** 3d-2a §6.2 listed fourteen
  existing-but-unlaunched cases; **all fourteen were launched here** — `editor-collision` (P14, P15),
  `editor-fallback` (P36, P37), `editor-satisfied` (P45), `editor-ambiguous` (P46), `editor-missing`
  (P47), `creator-anchor` (P16, P17), `creator-anchor-gone` (P48), `deleter-changed` (P18, P19),
  `duplicator-changed` (P22, P23), `mover-exact` (P32, P33), `mover-reordered` (P40),
  `mover-reordered-end` (P42), `mover-after` (P41) and `mover-after-changed` (P49) — so the list is
  now empty and **all 23 cases of the table have been launched at least once on this tree**, checked
  by collecting the `--- begin` line of all 75 transcripts.

**The five holes are a bound on this reading and §15 item 10 carries them there**, because a reader
who opens the bounds section must find the whole boundary without having to read this table too.

---

## 15. What this reading does not cover

1. **Everything 3b §8, 3c-1 §7 and 3d-2a §6.1 exclude**, inherited whole. No invoke spy, no command
   counter, no mouse, no keyboard, no claim about which command ran or when.
2. **`Save this snippet` on the editor's success path was not measured as a rectangle** (§5.2). The
   probe prints boxes only for controls inside `role="status"` blocks.
3. **The panel's prose on the raw editor was not scanned** (§11). Absence is established by
   enumeration of controls and status blocks.
4. **`clip=in` versus `clip=partial` at `y = 44` is resolved by argument, not by a sub-pixel
   measurement** (§4). The probe rounds every rectangle.
5. **No computed style was read**, so F4 is geometry only.
6. **`hasFocus=false visibility=hidden` on every launch.** Every focus statement is about that
   condition and not the one a person at the machine would have.
7. **The fixture shape is still the easy one** (3d-2a §6.1). No BOM, no CRLF, no block scalars, no
   item-owned comments, no read-only file, and the owner's real configuration was never opened.
8. **The cause of §12's instability is a hypothesis.** What is established is that it exists — and
   §12's earlier comparison is **confounded** by it, so it excludes neither of 3d-2a's two candidate
   causes and this reading claims no verdict on either.
9. **This reading judges what a window drew.** That a sentence is drawn is not that it is true;
   §§6, 7 and 10 judge three sentences against their predicates by reading the code beside the
   transcript, and no other sentence on any of these screens was re-judged — 3c-2 §5's verdicts on
   the rest stand untouched, and 3d-1 changed none of those strings.
10. **The five holes of §14, restated here as bounds** and **not** folded into item 1 — they are
    3d-2a §6.7's holes and not §6.1's inherited exclusions. (i) `browser.notice.gone`'s second
    producer, `repairSelection`'s `clearSelection` arm at `src/lib/browser/selection.ts:292`; and the
    **confirmed-reload transition** on (ii) the creator, (iii) the deleter, (iv) the mover and (v) the
    duplicator. Each has **no row in `launch.sh` and no arm in `runPlan`**, so nothing could be
    launched for it; each would cost a plan function before it cost a launch. None is a §7 obligation.
11. **The reveal is observed as a *request* and a pane offset, never as a platform decision** (§1.4
    bound 1). What §§5.3 and 9.1 establish is what the window asked for and what `section.detail`'s
    offset did around the call. A movement produced in the same tick by something other than that
    call would appear on the *next* request rather than as its own event.
12. **The instrumented launches force a layout flush the uninstrumented ones do not** (§1.4 bound 2).
    P54–P75 read `getBoundingClientRect` and `scrollTop` immediately before each `scrollIntoView`.
    `scrollIntoView` forces layout itself, so this changes *when* layout happens and not *whether* —
    stated as a bound, not as a proof of no effect. The twelve success rectangles reproduced P24–P45's
    exactly (§5.1), which is consistent with no effect and is not a demonstration of none.
13. **On the four operation surfaces the success-arm `delta=0` says nothing about what the request
    would have done to a pane with room** (§5.3). The pane's range was already `0` when the reveal
    fired, so no reveal could have moved anything there; only the editor's launches, where the pane
    had unspent room, distinguish *no movement while range was available* from *could not move*.
14. **Whether a second press ran a second reapply *transition* is still unobservable** (§9.1's
    bound). There is no invoke spy and no command counter. What is measured is that the component's
    reveal effect re-ran and re-issued its request.
15. **Two facts were unmeasured when this record was first written and are measured now.** The
    success-path reveal direction (§5.3) and the second press's reveal request (§9.1) had no
    observation behind them in P12–P53; both are closed by P54–P75. They are listed here so a reader
    of the bounds section learns that they *were* the reading's two central measurement limits and
    what closed them, rather than meeting a softened summary elsewhere.

---

## 16. The gates

**Not re-run for the first round, and re-run in full for the review round.** The first round changed
no file at all, so nothing the gates measure could have moved. The review round changed `src/probe.ts`
— uncommitted harness code, but a file `svelte-check`, `vitest` and `vite` all read — so all four
were re-run after the instrumentation and **before** P54.

| Command | Result | Round |
|---|---|---|
| `npm test` | **1634** passed, 49 files | both, unchanged |
| `cargo test --workspace` | **1086** passed, 0 failed | both, unchanged |
| `npm run check` | **419** files, 0 errors, 0 warnings | both, unchanged |
| `npm run build` | **176** modules | both, unchanged |

**The module count is a regression guard and the guard is the shape of a change, not the number.**
The instrumentation is code added **inside** `src/probe.ts` and imports nothing new, so it adds no
module and 176 is the count that had to hold. It held. A jump to ~180 with `svelte/internal/server`
in the bundle would have been the `resolve.conditions` regression `CLAUDE.md` describes, and would
have stopped this step rather than been rebaselined.

---

## 17. Verdict

**The reading passes, and the four fixes 3d-1 applied are visible on a screen.**

- **§11.1's Medium is closed.** The refused reapply's report is at the top of the visible band on
  five surfaces in both languages, in sixteen readings, where 3c-2 measured it above the band in
  42 (§4: 3c-2 §9 and §11.1 both say 42; the 18 in `PROGRESS.md` is the stale value).
- **§11.4's acceptance constraint holds.** The conflict panel's own first line stays inside the band
  on all five surfaces in both languages after the reveal.
- **§11.3's High is closed.** `differentMatch` no longer asserts an identity, and it no longer
  contradicts the reapply block beside it.
- **§11.5's Medium is closed.** `fieldCollisions` is a disjunction over the three states its
  predicate allows, and both launched arms are true of it.
- **§11.2's Low is closed for the strings this reading drew**: the reapply family reads *tú* in every
  Spanish transcript quoted above. This reading did not re-scan `es.json`.
- **The success-arm report, measured for the first time, is in the band on all five surfaces in both
  languages**, and on four of them the surface stops scrolling altogether. The editor cannot show its
  selection banner and its report at the same time and shows the report (F1) — a geometry 3c-2 §9 had
  already measured and declined to file.
- **The reveal's direction is measured, not inferred.** On the success path the `'nearest'` request is
  issued on all five surfaces in both languages and **scrolls nothing** — the editor's final offset is
  the browser's clamp and not the reveal (§5.3). On the refusal path the same request scrolls the pane
  **up** by 114–148 px and lands the report at `y = 44` (§4, §9.1). **A second press re-issues the
  request, and the request returns without throwing and produces no movement while the report is
  already in view** — no range clamp explains that zero, and the platform's own handling of the call
  is not observed (§9.1, §1.4 bound 1).

**Nothing this reading found touches what is written to disk.** Sixty-four launches, sixty-four
`bytes=MATCH`, and the five never-before-compared expected-bytes fixtures all matched on their first
comparison.

**3d-3 removes the harness.** `src/probe.ts`, `src-tauri/src/probe.rs` and the two hook lines each in
`src/main.ts` and `src-tauri/src/main.rs` are still in the tree — `src/probe.ts` carrying the review
round's instrument — and `/private/tmp/espansoconfig-harness-2c-4b-3d/` holds
`manifest-3d-2b-fix-post.sha256` (177 entries, all verifying) beside `manifest-3d-2b-post.sha256`
(131 entries, 130 verifying) and `manifest-3d-2a-post.sha256` (46 entries, 45 verifying). **The one
failing entry in each of the two older manifests is `src/probe.ts` and nothing else** (§1.2).

---

## 18. The review round — the six findings, and what closed each

`docs/reviews/phase-2c-4b-3d-2b-reading.md` returned **NOT READY** on the first round with six
findings. **Two of them could not be closed by rewording**, and this section says for each what
changed and against which artifact the change is now checkable. **None of the six is a defect in the
save path or in what is written to a user's file**, which the review states of its whole set and
which the twenty-two new launches' `bytes=MATCH` re-checks.

| # | Finding | Closed by | Checkable against |
|---|---|---|---|
| 1 | Medium — the reveal direction is not measured | **Instrumentation and twelve new launches.** §1.4 is the instrument; §5.3 is the measurement and replaces "down or nothing, never up" with *the reveal scrolls nothing on the success path*, plus the clamp separated from it | `launches/P54…P65/probe.log`, the `scrollstate` and `scrollreq` lines |
| 2 | Medium — obligation (c)'s "still scrolls" half | **Ten new `:twice` launches.** §9.1: a second `origin=app` request in all ten, `delta=0` against a pane with room in both directions | `launches/P66…P75/probe.log`, the `secondReapply` segment |
| 3 | Medium — §12's causal exclusion | **Rewritten to the confounding conclusion.** The instability is established; the exclusion of either candidate cause is withdrawn | `launches/P27,P51,P53,P57/probe.log` (925/908/908/925) |
| 4 | Low — F5 contradicts 3d-1 §4.2 | **"those call for different actions" removed**; F5 kept as a neutral observation that the model intentionally does not attribute a collision to one disjunct, and 3d-1's fix stated as delivered | `docs/decisions/2c-4b-3d-1-notes.md` §4.2 lines 339–358 |
| 5 | Low — §15 is not a complete bounds list | **Six items added** (10–15): the five holes by cross-reference to §14, the three instrument bounds, the operation surfaces' uninformative zero, and the two questions that were the reading's central limits | §15 itself, against §14's hole list and §1.4's bounds |
| 6 | Observation — F1's grade rests on the wrong precedent | **Regrounded in current impact and reachability**: informational block, one surface, reachable at `y = 44`. 3c-2 §9 is now cited for provenance and non-regression only | `launches/P24/probe.log:32` |

**The coverage consequence, which the review called the finding behind the findings.** §14 now
separates *no coverage gap remains in the 23-row table* from *every fact §7 asks for was measured*.
The first was true after P53; the second was not, and is claimed only on P54–P75's evidence.

**The record's opening promise was also overstated and is now corrected rather than defended.** It
said every claim names the transcript **line** it comes from; many tables name only a P-number. The
promise now matches the practice, and the practice is unchanged.

**What the review verified and this round did not disturb.** Every sampled `y`, `box`, `clip`,
`scroller`, `scrollTop`, `scrollHeight` and `clientHeight` traced to its named launch; the
`clip=partial` sub-pixel argument at `y = 44`; the 23 rows matching the 23 `runPlan` arms; the
five-hole count; the third binary's provenance and the refusal to use P01–P11 geometry affirmatively;
and that no verdict other than §12's uses conflict-panel height as a premise. Those are left exactly
as they were written.

**One thing this round did not do.** It re-took only the cases that owed findings 1 and 2 — twelve
success launches and ten `:twice` launches, covering twenty-two case-and-language combinations that
twenty-six of the first round's forty-two launches had already run. **The remaining sixteen launches
of P12–P53 have no re-take**, and their cases were not re-run, because the
review verified their content obligations as sound and the instrument change adds a transcript line
rather than altering what any of them drew. **So the refusal-arm geometry of §4 and §8, the sentence
readings of §§6, 7, 10 and 11, and the acknowledgement round of §5.2 all still rest on launches of
the `84148bbf…` binary**, and §5.3's and §9.1's verdicts rest on `7fe2a6da…`. Where the two rounds
are compared — §5.1's twelve reproduced rectangles and §12's P57 and P58 — the record says so.
