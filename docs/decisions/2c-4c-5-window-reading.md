# Phase 2c-4c step 5 — the window reading

This is the bilingual window reading Phase 2c-4c owes for **six** surfaces. Steps 4a and 4b built
the instrument; this step launches it, **judges what a person would see**, and records findings.
Every one of its twenty-seven `bytes.txt` files names one and the same binary digest, and both probe
sources matched the digests `manifest-2c-4c-4b-post.sha256` pins for them. That is two comparisons
between retained artifacts, and it is the whole of what is retained about how these launches came to
be (§8.13).

> **Corrected at 5b-3, after Codex review round 1.** `docs/reviews/phase-2c-4c-5-reading.md` returned
> **NOT READY** on three Highs, one Medium and one Low. Three classes of claim in the first version of
> this record were wrong, and they are rewritten here rather than hedged.
> **M2 was called *latent, inferred and never constructed*, and it was none of those** — the covering
> state was constructed in eight of these very launches and this step's instrument did not measure it;
> §3.2 and §6's M2 now carry what 5b-1 measured and 5b-2 fixed.
> **Post-images were read as construction chronology** — §§1, 2, 2.2 and 10 now claim only the
> retained comparisons and the resulting tree shape.
> **Final bytes and final backup presence were read as intermediate write history** — §§2, 4.2, 4.4,
> 4.5 and 7 now claim final state, and describe drawn sentences as *consistent with* it.
> §3.1's causal attribution to `revealOutcome` is narrowed to the two facts that were observed, and
> §6's L3 is re-judged with its reasoning stated. §8 gains five bounds and one unexplained
> observation. **No measurement changed**; what changed is what this record claims from them.
>
> **Then corrected again, after Codex review round 2** (`docs/reviews/phase-2c-4c-5b-record.md`,
> **NOT READY**, two Highs) — and **both of round 2's findings were against 5b-3's own corrections,
> not against the original record**. The rewrite had raised M2 from Medium to **High** on pointer
> unreachability, which this record's own §8.16 and §8.17 withhold and which its retained rectangles
> contradict at the 7-px strip; **M2 is Medium again** and §6's M2 keeps all three arguments so the
> raise is not attempted a fourth time. And the rewrite reintroduced **construction chronology inside
> the passages narrowing it** — an ordering of the gate run against the rewrite, an ordering of 5b-2's
> bundle search against its CSS edit, and `PROGRESS.md` offered as a witness outside the record; §10,
> §1.3 and §8.13 now claim current comparisons only. **This is the eleventh consecutive round in this
> phase to find a narrower instance of what the round before it closed**, and the first where the
> instance was created by the fix round rather than surviving it.

**Twenty-seven launches, P27–P53.** Every one reached `--- end` exactly once, printed **no**
`--- failed` line, left a **zero-byte** `probe.err`, and answered `bytes=MATCH`. The matrix is the
thirteen cases the brief names in **both** languages — which is what closes *both languages on all
six surfaces* — plus a second `duplicator-exact:en` artifact (P53) that settles a question P39 raised
about the instrument rather than about the application.

**The headline judgement on the geometry, which 4b measured and refused to judge:**

- **`section.recovery`'s zero-height rectangle was real, and it was covering the host's own conflict
  panel.** This record's first version called it latent, inferred and inconsequential today; that was
  **wrong**, and the false step was the premise, not only the conclusion — see §3.2. The covering
  state was constructed by eight of these twenty-seven launches and this step's instrument did not
  measure it. 5b-1 extended the instrument and measured it; 5b-2 deleted one CSS declaration and
  re-measured. That is **M2**, and it is this phase's **first defect to reach a screen** and its first
  to change a tracked source file. It is still **not** a defect in what is written to a user's file.
- **The four recovery-without-creation paragraphs at `y = -14/-15` are laid out correctly.** They sit
  immediately above the conflict panel with the surface's own `0.5rem` gap, and they are reachable by
  scrolling up. The application **asked** for the conflict panel to be brought into view, and the
  window **was found** at a scroll position that puts the paragraph above the band; those are two
  observations and this record does not join them into an observed movement (§8.14). The layout is
  not a defect — but on three of the four surfaces the sentence is wholly outside the visible band at
  the moment it is drawn, which is L1.

**The two Medium findings, M1 and M2, rank neither above the other** — and that is a statement about
those two only, not a roster: the full roster is two Mediums, two Lows and six Observations (§6).
This record's first version said *"the headline finding is not a geometry finding"* and named M1 — a
fair ranking against a geometry entry believed latent, but that premise is gone, so **the ranking is
withdrawn rather than inverted**. 5b-3 briefly inverted it, on an M2 severity round 2 of the review
did not sustain.

**M1 remains the finding no English-only reading could have produced**, and that is its own point:
in Spanish, the deleter and the duplicator each draw **two different controls carrying the identical
label *Dejarlo como está***, one of which closes the panel and one of which keeps the requested
operation. In English the two are *Leave this alone* and *Leave this as it is* and cannot be
confused. No test in this repository can fail on it. **That is what "both languages judged, not just
launched" bought** — and M2 is what "measured, not inferred" bought, one review round later.

**No finding of this reading is a defect in what is written to a user's file**, M2 included. All
twenty-seven launches ended with final bytes equal to the document their case names — `bytes=MATCH`,
including the earliest retained comparison against the fifth prediction fixture — and the eight
launches that constructed M2's covering state are among them. **M2 reached a screen and not a file.**

---

## 1. The tree, the binary and the instrument

The scratch tree is `/private/tmp/espansoconfig-harness-2c-4c/`. It holds everything
`manifest-2c-4c-4b-post.sha256` names — all 55 of that manifest's entries verified when this step's
check was run — plus this step's twenty-seven launch directories and a third manifest. It measured
**2.1 GB** with
fifty-three launch directories present, because `launch.sh` assembles a fresh `.app` bundle per launch
and every launch keeps its own; that is the growth rate 4a §1 recorded and not a measurement of what
this step cost.

**One digest is named by all twenty-seven, and it is the one 4b's launches name.** Every one of the
twenty-seven `bytes.txt` files carries
`binary=fcc9c3ac8713906d9793552a714e744218f720ea9714b6a1e700e99e05effc2e`, and the retained `.app`
executables sampled inside those launch directories hash to it.
`docs/reviews/phase-2c-4c-5-reading.md` reports the same equality independently, adding that the
then-current `target/debug/espansoconfig` answered that digest too.

**That is a digest comparison between retained artifacts, and this record claims nothing beyond it.**
It does not establish who built that binary, when, how many builds preceded it, or that no probe
source was edited at any point before these launches — no retained artifact records any of those, and
the first version of this record asserted several of them (§8.13). What can be added to the digest
equality is the **shape of the tree** this step left, immediately below.

**The digest has since moved twice, by design.** 5b-1 extended `src/probe.ts` and its launches name
`a4d86645…`; 5b-2 removed one declaration from `RecoveryPanel.svelte` and its launches name
`0ea33c78…`. So `target/debug/espansoconfig` no longer answers `fcc9c3ac…`, and the equality above is
recorded as it stood rather than re-asserted.

**`git status --short --untracked-files=all` lists exactly the four harness paths** at the close of
this step, plus this record:

```
 M src-tauri/src/main.rs      ← two hook lines
 M src/main.ts                ← two hook lines
?? src-tauri/src/probe.rs
?? src/probe.ts
```

Nothing was committed. **Never `git commit -a` while these are in the tree.**

That listing is the tree shape at the close of this step: no tracked production file differed from
`HEAD`. It is a statement about a tree and not about a history. **5b-2 later changed one tracked
production file** — one declaration in `src/lib/components/RecoveryPanel.svelte` — and that change is
recorded in `docs/decisions/2c-4c-5b-2-notes.md` and committed, so the same listing taken now shows
the four harness paths and nothing else again.

### 1.1 The viewport, and the band this reading measures against

`1180 x 728`, `dpr=2`, `hasFocus=false`, `visibility=hidden`, printed by all twenty-seven launches
and identical on every one. `section.detail` is the only real scroller — every `reach` line names it
— with its top at `y = 44` and `clientHeight=645`, so **the visible band is [44, 689]**. That is the
same band 3c-2 §4 and 3d-2b §1.3 measured, reproduced here on every launch that printed a `reach`
line.

`lang=` equals `picked=` on all twenty-seven: the picker was used in every launch, which matters
because the WebKit data store follows the bundle identifier every probe bundle shares
(`2c-2-2-window-reading.md` §1.2).

### 1.2 The instrument this step ran against, and what is retained about it

**`manifest-2c-4c-4b-post.sha256` pins both probe sources by digest** — entries 26 and 27 are
`src/probe.ts` and `src-tauri/src/probe.rs` — and this step's verification of that manifest passed on
all 55 entries. That, plus all twenty-seven `bytes.txt` files naming one binary digest, is why every
reporting bound 4b stated is read here as still holding. **They are not a history**: a digest equality
says two files agree, not that neither was edited and restored, and no artifact says whether anything
was rebuilt or discarded. The first version of this record made the claim in the stronger form
(§8.13).

One consequence of the instrument as it stood is recorded as a limitation rather than repaired: see
O3.

**The instrument did grow afterwards.** 5b-1 added `reportRecoveryGeometry()` to `src/probe.ts`
precisely because this step's instrument could not answer the question §3.2 needed answered —
what rectangle the host outcome panel occupied while the recovery form was open, and whether a
**pointer** could reach anything on the form. That extension is
`docs/decisions/2c-4c-5b-1-instrument.md`.

### 1.3 The manifest

`manifest-2c-4c-5-post.sha256` carries **79 entries** and all of them verify: `launch.sh`, the
twenty-four fixtures, and `probe.log` plus `bytes.txt` for P27–P53. It is the third manifest in the
tree and is named by no earlier record. `manifest-2c-4c-4b-post.sha256` **verified all 55 of its
entries** when this step checked it directly. `manifest-2c-4c-4a-post.sha256` verifies its fixtures
and fails on `launch.sh` and the two probe files, which is what 4b §7.2 calls a partial-verify
artifact by design.

**The 4b manifest verifies 54 OK and one FAILED as it stands**, and the one is `src/probe.ts` — the
file 5b-1 extended. `src-tauri/src/probe.rs` still matches 4b's digest. That is a current comparison
and nothing more: it says the two digests disagree now, not when they came to disagree. The single
expected failure is worth recording because a manifest that stops verifying for an **unexplained**
entry is the only signal this tree has that something changed under it.

**A manifest is a post-image and witnesses nothing about first attempts.** It says what these files
hold now; it cannot say whether any launch was discarded, whether a file was written more than once,
or in what order anything happened (§8.13). This record makes no such claim — and where its first
version did, §8.13 names the sentence.

---

## 2. The launch ledger

Every row satisfies, **by a reader and never by the harness**, the four-part conjunction
`2c-4b-3b-instrument.md` §8.9 defines. `launch.sh` runs three checks and conjoins none of them; the
conjunction below is supplied per launch and is stated as one paragraph after the table, because it
holds identically on every row.

| # | Case | Surface | Lang | `bytes=` | `backups=` | Verdict |
|---|---|---|---|---|---|---|
| P27 | `editor-recovery-create` | editor | en | MATCH | PRESENT | PASS — no retained launch before it names the fifth prediction fixture |
| P28 | `editor-recovery-create` | editor | es | MATCH | PRESENT | PASS |
| P29 | `editor-recovery-refused` | editor | en | MATCH | PRESENT | PASS |
| P30 | `editor-recovery-refused` | editor | es | MATCH | PRESENT | PASS |
| P31 | `editor-recovery-conflict` | editor | en | MATCH | none | PASS — two conflict blocks; final bytes equal the fixture, no backup directory |
| P32 | `editor-recovery-conflict` | editor | es | MATCH | none | PASS |
| P33 | `creator-recovery-create` | creator | en | MATCH | PRESENT | PASS |
| P34 | `creator-recovery-create` | creator | es | MATCH | PRESENT | PASS |
| P35 | `deleter-exact` | deleter | en | MATCH | PRESENT | PASS |
| P36 | `deleter-exact` | deleter | es | MATCH | PRESENT | PASS |
| P37 | `mover-exact` | mover | en | MATCH | PRESENT | PASS |
| P38 | `mover-exact` | mover | es | MATCH | PRESENT | PASS |
| P39 | `duplicator-exact` | duplicator | en | MATCH | PRESENT | PASS on bytes; final panel sampled early (O3) |
| P40 | `duplicator-exact` | duplicator | es | MATCH | PRESENT | PASS |
| P41 | `raw-negative` | raw | en | MATCH | none | PASS |
| P42 | `raw-negative` | raw | es | MATCH | none | PASS |
| P43 | `editor-reload-gone` | editor | en | MATCH | none | PASS |
| P44 | `editor-reload-gone` | editor | es | MATCH | none | PASS |
| P45 | `creator-reload` | creator | en | MATCH | none | PASS — `notice=absent`, correctly |
| P46 | `creator-reload` | creator | es | MATCH | none | PASS |
| P47 | `deleter-reload-gone` | deleter | en | MATCH | none | PASS |
| P48 | `deleter-reload-gone` | deleter | es | MATCH | none | PASS on the conjunction; **M1 found here** |
| P49 | `mover-reload-gone` | mover | en | MATCH | none | PASS |
| P50 | `mover-reload-gone` | mover | es | MATCH | none | PASS; **O2 found here** |
| P51 | `duplicator-reload-gone` | duplicator | en | MATCH | none | PASS |
| P52 | `duplicator-reload-gone` | duplicator | es | MATCH | none | PASS; **M1 again** |
| P53 | `duplicator-exact` | duplicator | en | MATCH | PRESENT | PASS — the second retained `duplicator-exact:en` artifact; it settles O3 |

**The four-part conjunction, supplied by a reader, holding on all twenty-seven:**

1. **No `--- failed` line, one `--- end`, zero-byte `probe.err`.** Swept mechanically over all
   twenty-seven: `failed=0 end=1 err=0` on every row.
2. **The conflict block, with `expected ≠ found` and `diskRevision == found`.** Every launch printed
   three revisions; P31 and P32 printed **two** such blocks, the host's and the recovery form's, and
   both satisfy the inequality. Every revision printed equals the SHA-256 of the fixture it names,
   checked directly: `base-r0.yml` is `9246ae21…`, `elsewhere-r1.yml` `04e4bef8…`,
   `target-deleted-r1.yml` `cf285e09…`, `target-changed-r1.yml` `f53dfa44…`, `target-labelled-r1.yml`
   `6278f5c1…`. That is 4a §4.2's observation holding again over five files on this build; it is
   still an observation of these files on this build and not a documented property of the revision
   function.
3. **The expected control and action lines for that surface.** The recovery surfaces printed the
   offer, the opened form, its destination list, its six transfer rows and its ending; the four
   non-creating surfaces printed `elements=1 documentWide=1` with the reason that component derived
   and a `sentencesByDictionary` naming the same reason — fifteen readings, no exception. The reload
   plans printed the two-control roll before and after the first press. P39's last line is the one
   place where the *expected* line is not the drawn one, and O3 is what that is.
4. **The intended byte predicate, as a final state.** `bytes=MATCH` on all twenty-seven —
   **thirteen** against an authored expected-bytes document and **fourteen** against a fixture the
   case must leave unchanged (R1 on twelve of them, R2 on P31 and P32). The backup split falls on the
   same thirteen and fourteen: `backups=PRESENT` on exactly the thirteen whose final bytes are the
   authored document and `backups=none` on exactly the fourteen whose final bytes equal the fixture,
   checked mechanically over all twenty-seven with no exception. **Twelve** of the thirteen also drew
   the sentence saying a copy had been kept; the thirteenth is P39, which sampled its panel early
   (O3) and drew no ending sentence at all.

   **What that pairing supports, and what it does not.** For the thirteen, changed final bytes plus a
   backup directory support that a write occurred at some point during the launch. They do **not**
   say how many writes occurred, which panel event caused any of them, or in what order anything
   happened — there is no invoke spy, no command counter and no intermediate filesystem snapshot in
   this harness (§8.3). For the fourteen, an unchanged file with no backup directory is a post-image
   that a write producing identical bytes, or a transient write undone before the launch ended, would
   also leave. Every "wrote" and "did not write" in this record is shorthand for that final-state
   pairing and for nothing stronger.

### 2.1 Language coverage — the aggregate hole 4b left is closed

4b's §10.8 left the editor and creator in both languages and the deleter, mover, duplicator and raw
editor in one each. **Every one of the six surfaces has now been read in both languages**, and every
case in the matrix ran twice:

| Surface | English | Spanish |
|---|---|---|
| editor | P27, P29, P31, P43 | P28, P30, P32, P44 |
| creator | P33, P45 | P34, P46 |
| deleter | P35, P47 | P36, P48 |
| mover | P37, P49 | P38, P50 |
| duplicator | P39, P51, P53 | P40, P52 |
| raw | P41 | P42 |

### 2.2 The fifth prediction fixture, compared against a file for the first time

`editor-recovery-create-expected.yml` was authored by 4b and compared against nothing (4b §6.3).
**No retained launch before P27 names it**, and P27 and P28 both answer `bytes=MATCH` against it.
**The prediction is borne out by the retained comparisons**, and no investigation of a suspect
fixture appears in this record.

What is not retained is how many attempts stand behind those two artifacts. A launch directory is a
post-image of the launch that produced it; nothing in the tree witnesses a discarded predecessor, and
the first version of this sentence claimed a first attempt (§8.13).

The other four predictions — `editor-fallback-expected.yml`, `mover-reordered-expected.yml`,
`mover-after-expected.yml`, `mover-end-expected.yml` — **are named by no retained launch of this
step**, and each carries **one and the same digest in all three manifests**
(`manifest-2c-4c-4a-post.sha256`, `-4b-post`, `-5-post`), which verify against the files as they
stand. That is a comparison of digests across three post-images, not an account of what was done to
those files between them.

---

## 3. The geometry judgement

4b measured two rectangles and refused to judge either. Both are judged here, from the transcripts and
from the components' markup and CSS. **One of the two judgements was wrong**, and §3.2 is where it is
withdrawn and replaced by what 5b-1 measured and 5b-2 fixed; §3.1's judgement stands, with its causal
step removed.

### 3.1 The recovery-without-creation paragraph at `y = -14/-15` — **not a layout defect**

Measured on fifteen readings across four surfaces and both languages, and the numbers are stable to
the pixel:

| Surface | Launches | Box | In band [44, 689]? |
|---|---|---|---|
| deleter | P35, P36, P47, P48 | `658,-14,491x51` | no — wholly above |
| mover | P37, P38, P49, P50 | `658,-15,491x51` | no — wholly above |
| duplicator | P39, P40, P51, P52, P53 | `658,-14,491x51` | no — wholly above |
| raw | P41, P42 | `658,138,491x51` | **yes** |

**The layout is correct and the paragraph is exactly where the markup puts it.** Each of the four
hosts mounts `RecoveryWithoutCreation.svelte` immediately **before** its outcome panel
(`MatchDeleter.svelte:548`, `MatchMover.svelte:815`, `MatchDuplicator.svelte:708`,
`RawEditor.svelte:541`), and each host section is a column flex container with `gap: 0.5rem`. The
arithmetic in the transcripts is that gap and nothing else: on the deleter the paragraph occupies
`-14 … 37` and the conflict panel begins at `44`, seven or eight pixels below its bottom edge.

**The negative `y` is a scroll position, and the harness did not produce it.** The same numbers
arrive by two different routes. In the `*-exact` plans `reportReach` runs first, captures the
scroller's `scrollTop`, scrolls, and **restores** it; in the four `*-reload-gone` plans
`reportRecoveryWithoutCreation` is called **directly after `reportConflict` with no `reportReach` at
all**, so the scroll is untouched by the harness. Both routes print `-14`/`-15`.

**Two facts, and this record does not join them.** The first is that the application **asked** for the
conflict panel to be brought into view: `revealOutcome` in `src/lib/components/reveal.ts` runs when
the panel appears. The second is that the window **was found**, at the moment the reporter sampled
it, at a scroll position that puts the paragraph above the band. Nothing here observes the first
producing the second. `scrollQuietly`, which every reveal in that file goes through, returns without
scrolling when `scrollIntoView` is missing and swallows the refusal when the call throws —
**both arms are silent, so no caller can learn whether anything moved**
(`src/lib/components/reveal.ts:57-82`), and `revealOutcome`'s own contract says the same in the words
*"asked for, not achieved"* (`:96-99`). The same final coordinates could equally come from layout
clamping or from scroll anchoring over content that grew. The reveal request is the most plausible
account and it is not an observed one; §8.14 carries the bound.

**A person can reach it.** A box at `y = -14` inside a scroller whose client top is `44` *entails*
`scrollTop > 0`, so scrolling up is possible; the `reach` lines make it concrete —
`scrollTop=199` on the deleter, `459`/`476` on the mover, `318` on the duplicator. Roughly sixty
pixels of upward scroll brings the whole sentence into the band on all three.

**Verdict: not a layout defect, and not a harmless artifact of measurement either — "something in
between".** The rectangle is honest, the layout is right, and the sentence is nonetheless invisible
at the moment it becomes relevant on three of the four surfaces. That is **L1**.

### 3.2 `section.recovery`'s `491x0` rectangle — **a real collapse that was covering the host's own conflict panel**

> **This subsection is the correction.** Its first version was headed *real, and inconsequential
> today*, and it was wrong — not only in its verdict but in the premise the verdict rested on. The
> measurements below are unchanged; everything after them is rewritten, and **one cell of the table
> that was never a measurement is corrected in place**. The defect is **M2**, it was **measured at
> 5b-1** and **fixed at 5b-2**, and this is the first defect of Phase 2c-4c to reach a screen.

Measured on all eight launches that drew a recovery panel, in both languages, in three different
states:

| State | Launches | `section.recovery` | A child, at the same `y` |
|---|---|---|---|
| holding the offer | P27, P29, P31 (en) | `658,158,491x0` | offer `658,158,296x27` |
| holding the offer | P28, P30, P32 (es) | `658,174,491x0` | offer `658,174,357x27` |
| holding the offer | P33 (en) / P34 (es) | `658,175,491x0` / `658,192,491x0` | offer `…,296x27` / `…,357x27` |
| holding the whole open form | P27–P34 | unchanged, still `491x0` | **no child measured** — see below |
| empty | P25, P26 (4b) | `…,491x0` | — (correct: no children) |

The fourth row is the one that matters and it is a **correction to the table itself**. The first
version put *"form content down to `y = 689`"* in that cell; no line of any of those eight
transcripts measures the form's content, and `recoveryForm box=` prints the section's own `491x0`
again rather than its content's. 5b-1's measurement of that row is `158 → 1159` (en) and
`174 → 1210` (es).

**It is not an artifact of how the rect is measured.** `box()` calls `getBoundingClientRect()`, which
returns the border box; a border box of height 0 with children of height 27 laid out at the same `y`
is an element whose box was shrunk below its content, not an element that was mismeasured.

**The cause.** `section.detail` is `display: flex; flex-direction: column; overflow: auto`
(`DetailPane.svelte:993`). Each write surface's own section — `.matchEditor` at
`MatchEditor.svelte:1061`, `.creator` at `MatchCreator.svelte:933`, and the rest — is a flex item of
it and sets `min-height: 0`; `.recovery` in `RecoveryPanel.svelte` set `min-height: 0` **inside**
that. `min-height: 0` defeats the automatic minimum size that keeps a flex item at its min-content
height, so the column's negative free space is absorbed by exactly the items that opted out of that
protection — and `.recovery` went to zero while its siblings, which have that floor, kept their
heights.

*This step* read that cause from the stylesheets and sampled no computed style, which would have
required a probe edit. **5b-1 then sampled it in the window** and it is confirmed:
`section.recovery display=flex overflow=visible flex=0 1 auto minHeight=0px height=0px
position=static`, identical in all eight of its launches, with the layout parent at
`minHeight=0px height=579.9375px` over roughly 1800 px of content (5b-1 §8). `display` is `flex` and
not `contents`, so the zero height is a **real border box** its children lay out past rather than an
absent one.

#### What this record first concluded, and why the premise was false

The first version said that a zero-height box positions every later sibling as though the panel were
not there, that in `MatchEditor.svelte` and `MatchCreator.svelte` that sibling is the host's own
outcome panel drawn when `view.outcome !== null` — both true — and then that **"in every state this
reading reached that value is `null`, the reapply that opens recovery is what cleared it"**, from
which it concluded that nothing overlapped, that the overlap was reachable only in principle, and
that no launch had constructed it.

**That premise is false, and the source says so in four steps:**

- `conflictOf()` reads a conflict **out of** `session.outcome` — `return conflictArm(session.outcome)`
  (`src/lib/browser/matchEditor.ts:1078-1079`) — so a session showing a conflict has a **non-null**
  outcome by construction;
- `applySave` installs that outcome for **every** non-saved result: it computes it through
  `describeEditSave` (`matchEditor.ts:1522`) and returns it in the `result.outcome !== 'saved'` arm
  (`:1525-1530`);
- `attemptOfReapply` returns the **held** session unchanged for `manualResolution`
  (`src/lib/browser/reapply.ts:540-547`), so that arm clears nothing — and `manualResolution` is the
  arm **P27–P34 all printed** (`recoveryEntry arm=browser.reapply.manualResolution`);
- both creating hosts draw the host outcome panel as the sibling **immediately after**
  `<RecoveryPanel>` (`src/lib/components/MatchEditor.svelte:895-912`, `MatchCreator.svelte:779-795`).

So the overlap state was **constructed in eight of this step's own launches**, P27–P34, with the
conflict panel rendered as the following sibling for the whole time the recovery form was open. The
instrument did not remeasure that sibling after the form opened, so no retained artifact of this step
shows the resulting rectangles. **The record inferred absence from an instrument's silence** — which
is the same defect class as reading a post-image as a chronology, applied to geometry.

**And the panel's own box is on line 6 of every one of those transcripts.** Each of P27–P34 printed
`outcome=conflict panel box=` at the conflict stage, before the form was opened: `658,44,491x1032`
(P27, P29, P31), `658,44,491x1094` (P28, P30, P32), `658,44,491x812` (P33), `658,44,491x890` (P34).
Those heights are **exactly** the sibling heights 5b-1 measured with the form open, which is a useful
cross-check between two instruments — and it means the panel this record said was not there was
measured, by this step, one screen earlier. What no reporter of this step took is its **position**
once the form was open.

#### What 5b-1 measured

`docs/decisions/2c-4c-5b-1-instrument.md` added `reportRecoveryGeometry()` to `src/probe.ts` and took
eight launches, P54–P61, over the same four cases in both languages, all printing the same
`manualResolution` arm. With the form open:

- `section.recovery` reports `491x0` while its **ten children extend 1001 px (English) / 1035 px
  (Spanish)** past its top — `158 → 1159` and `174 → 1210` on the editor, `175 → 1176` and
  `192 → 1227` on the creator — and the section's `scrollHeight` equals that extent while its
  `clientHeight` is `0`;
- the sibling is a `div[role="status"]` carrying the host component's scoped class in all eight, and
  it is placed at **the section's top + 7 px** — `658,165,491x1032` against a section top of `158`,
  and correspondingly in the other seven. Seven pixels is the host column's own `gap: 0.5rem`. The
  panel therefore began 994 (English) or 1028 (Spanish) pixels **above** the form's last child;
- the one form control whose centre fell inside the 728-pixel viewport is the form's **close button**,
  and `document.elementFromPoint` at that centre returned `div.panel[role="status"]` — the host
  outcome panel — **in all eight launches**, never the button.

**That is the defect on a screen**: the conflict panel was painted over the recovery form, and it was
painted over the one control a pointer could have reached at that scroll position.

#### What 5b-2 changed, and what it re-measured

`docs/decisions/2c-4c-5b-2-notes.md` deleted **one declaration** — `min-height: 0` from `.recovery` in
`src/lib/components/RecoveryPanel.svelte`, leaving `display: flex; flex-direction: column;
gap: 0.5rem` and a comment saying what the absence is for (`RecoveryPanel.svelte:804-818`). Nothing
else in the file changed, and none of the six host surfaces was touched: the `min-height: 0` idiom
stays where it belongs, on the items whose ancestors scroll. Twelve launches, P62–P73, re-measured at
the same viewport and — in all eight recovery pairs — at an **identical scroller `scrollTop`**:

- `section.recovery` goes `491x0` → `491x1001` (en) / `491x1035` (es); its `clientHeight` goes
  `0` → the `scrollHeight` it always had; its computed style goes `minHeight=0px height=0px` →
  `minHeight=auto height=1001.0625px`;
- **the sibling now begins at the recovery children's bottom edge + 7 px, in all eight** — `1166`
  against a children bottom of `1159`, `1217` against `1210`, `1183` against `1176`, `1234` against
  `1227`. The form and the conflict panel no longer occupy one band;
- `document.elementFromPoint` at the close button's centre returns **`isTheControl` — the button
  itself — in all eight**, against `somethingElse` in all eight before. The control's own rectangle is
  identical before and after; what changed is what is painted at its centre;
- the panel is mounted unconditionally, so four launches with no recovery on screen check that no gap
  was introduced: `section.recovery` renders empty at `491x0` on all four, and **P70 and P73 are
  line-for-line identical to P25 and P26** — the most recent retained same-case, same-language
  launches — after normalising the launch directory name that appears inside logged paths. P71 and
  P72 have no same-language predecessor in this harness and are claimed only by their own table row.

#### What the first version offered as evidence of harmlessness, re-read

Four observations were offered. **One is a sound measurement, one is a measurement of one control
asserted of seven, one is not evidence of what it was offered for, and one has no measurement behind
it at all.** They are re-read here against what the retained transcripts actually print, because that
check is what the first version did not do.

1. **True of one control, asserted of seven.** The claim was that the offer control, the destination
   row, the six transfer rows, the trigger box, the replacement box and the create control *all
   report natural sizes at sensible positions*. **Only the offer control has a rectangle in these
   transcripts** — `recovery offer=present box=658,158,296x27` (en) / `…,357x27` (es), at the
   section's own `y`. Everything else on the form is reported by **presence and text only**:
   `recoveryForm destinations:`, `transfer[0]…transfer[5]`, `trigger=`, `replace=`, `create=present`
   carry no boxes, and `recoveryForm box=` prints the **section's** own `491x0` rather than its
   content's. One control at natural size is real evidence that the collapse is a shrunk box rather
   than clipped content; it is not evidence about seven.
2. **Not evidence, and this is the sharpest correction.** The plans **pressed** controls inside the
   collapsed section — `browser.recovery.open`, `browser.recovery.create`,
   `browser.rawSave.choice.saveAnyway`, `browser.saveOutcome.choice.reloadDiskVersion`,
   `browser.saveOutcome.choice.confirmReload` — and every press was found and had its effect. That was
   offered as *clickable*. It is not: the harness presses through `HTMLElement.click()`, which
   **bypasses hit testing entirely** (4b §8.3, inherited here as §8.6). Every one of those presses
   succeeded **while the covering stood**, which is precisely why programmatic success says nothing
   about a pointer.
3. **Sound as a measurement.** Every status panel the recovery section drew — eight of them, across
   the six launches that drew one — ends at exactly `y = 689`: `560+129`, `526+163`, `544+145`,
   `510+179`, the band's bottom edge to the pixel. (P31 and P32 drew none, by design: after their
   confirmed reload the section holds no status block.) 5b-1 measured the scroller directly and found
   `scrollHeight` 1819/1966/1716/1784 against a `clientHeight` of 645, so the overflowing content is
   inside the scrollable extent. **Whether a person scrolls there is still not measured.**
4. **Withdrawn: no measurement stands behind it, and 5b-1 contradicts it.** The claim was that the
   whole form's content lies within `[158, 689]` in English and `[174, 689]` in Spanish — inside the
   band. **No retained line of this step gives the form's content extent**; the interval was assembled
   from the section's own top and the bottom edge of a *later* panel, the one drawn after the form has
   finished. 5b-1 measured the extent directly and it is `158 → 1159` (en) and `174 → 1210` (es) —
   **470 pixels past the band's bottom edge**, not inside it. This is the observation that made the
   collapse look harmless, and it was the one with nothing under it.

**M2 is therefore a confirmed defect that reached a screen, and it is closed.** It is still **not** a
defect in what is written to a user's file: all eight launches that constructed the covering state
answered `bytes=MATCH`, as did all twelve of 5b-2's. §6's M2 carries the classification.

### 3.3 One more thing the band shows, on the same three surfaces

While measuring the paragraphs above, the same transcripts put the conflict panel's **own three
controls** at `y = 771`–`788` on the deleter, the mover and the duplicator, in both languages —
**wholly below the band's bottom edge of 689**, by 82 to 99 pixels. On the raw editor they are at
`y = 658`, inside it. This is not new: `reveal.ts`'s own contract says that on five of the six write
surfaces the conflict panel's controls begin below the fold at 1180 × 728, and states that
`revealReapplyReport` deliberately does not ask for more scrolling than it needs. It is **reproduced**
here on three surfaces and in Spanish for the first time, and recorded as **L2**.

The combined picture for a person on the deleter at 1180 × 728, in either language: the panel's first
line — *Nothing was written. The file on disk is exactly as it was.* — is at the very top of the
pane, the panel body fills the pane, the recovery sentence is about sixty pixels above, and the three
controls are about a hundred pixels below. Both are one short scroll away and neither is on screen.

---

## 4. The sentence judgement

**A false sentence prints exactly as well as a true one** (4b §10.2), so what follows is a reading of
what each sentence *claims* against what the code can establish — and, wherever the harness's one
piece of independent evidence reaches, against the bytes.

### 4.1 The two recovery-unavailable sentences

**`browser.recovery.unavailable.operationDraft`**, drawn on the deleter, the mover and the duplicator
(thirteen readings):

- **en** — *"What you asked for here is an action on a snippet rather than text you wrote, so there
  is nothing to make a new snippet out of. Load the version on disk, choose a snippet in it, and ask
  again."*
- **es** — *"Lo que pediste aquí es una acción sobre un fragmento y no un texto que escribieras, así
  que no hay nada con lo que crear un fragmento nuevo. Carga la versión en disco, elige un fragmento
  en ella y vuelve a pedirlo."*

**Both claims are true and the two languages say the same thing.** The first clause is a statement
about the retained draft's kind, which is what `RecoveryWithoutCreation.svelte` is handed
(`kind="operationChoice"` on all three hosts) and what the marked attribute carried on all thirteen
readings. The second is **advice, and this reading confirms the advice is followed by the window**:
P47–P52 press *Load the version on disk*, confirm, and land on a pane holding one thing — the
selection-cleared notice — so *choose a snippet in it, and ask again* is exactly what the person must
then do. The instruction matches the observed behaviour in both languages.

Two wording observations, folded into **O6**: the English *"Load the version on disk"* is the
control's label verbatim; the Spanish *"Carga la versión en disco"* is not — the control says
*"Cargar la versión del disco"*, which O6 judges to be the application's register rule applied
correctly rather than a mismatch. And the reload is two controls, not one: the sentence names the
first and the second appears after it.

**`browser.recovery.unavailable.wholeDocumentDraft`**, drawn on the raw editor (P41, P42):

- **en** — *"What you have here is a whole file rather than one snippet, so there is nothing to make
  a new snippet out of. Carry on editing, copy your text, compare it with the version on disk, or
  load that version."*
- **es** — *"Lo que tienes aquí es un archivo entero y no un fragmento, así que no hay nada con lo
  que crear un fragmento nuevo. Sigue editando, copia tu texto, compáralo con la versión en disco o
  carga esa versión."*

**True, and the two languages agree.** It names four actions where the panel draws three controls —
`[Keep editing] [Copy my text] [Load the version on disk]` in English, `[Seguir editando]
[Copiar mi texto] [Cargar la versión del disco]` in Spanish — and the fourth, *compare it with the
version on disk*, has **no control at all**. It is not a false claim: the panel prints the disk
version's whole text inline (verified in both P41 and P42), so comparing is something a person can do
by reading. It is advice pointing at something that is on the screen rather than at a button. Folded
into **O6**, with the English's own unevenness beside it: *"Carry on editing"* where the control says
*"Keep editing"*, in a sentence whose other two verbs do echo their controls.

### 4.2 The recovery form's sentences — three of them are **byte-verified**

This is the one place the harness gives independent evidence, and it is worth stating in full.

- **`browser.recovery.transfer.omitted`** — *"not carried over, so this key is not written at all"* /
  *"no se traslada, así que esta clave no se escribe en absoluto"*, drawn on four of the six transfer
  rows in P27–P30 and P33–P34. **The bytes agree**: all three expected-bytes documents these six
  launches were compared against hold the new snippet with `trigger` and `replace` and **no other
  key** — no `label`, no `word`, no `left_word`, no `right_word`.
- **`browser.recovery.position`** — *"It goes at the end of that file's snippet list, and there is no
  other choice here. This app does not guess at a position from a change it could not carry out."*
  **The bytes agree**: in all three documents the new snippet is the **last** item of the list. The
  creator's case is the sharper one — its original request was *After :beta*, its reapply refused
  because that anchor was gone, and the recovery create put the snippet at the end rather than
  guessing. That is the sentence's second clause, verified.
- **`browser.recovery.what`** — *"how each value is quoted … [is] not carried over"*. **The bytes
  agree**: in all three documents the created snippet's trigger is written single-quoted while every
  pre-existing trigger in the same file is double-quoted. The panel warns about exactly the
  difference the file then shows.

- **`browser.recovery.destinationScope`** — *"Only files this app can write a snippet into are listed
  here. A file with no “matches:” list is not offered, and this app does not add one."* **The
  observed lists agree**, and the contrast is drawn inside this reading: the recovery form's
  destination list holds **one** row (`match/conflict.yml`) in all four launches that opened a form,
  in both languages, while the **creator's own** list in P45 and P46 holds **two**
  (`config/default.yml` and `match/conflict.yml`). The synthetic profile has no `matches:` list. The
  sentence describes the list the person is looking at.

- **`browser.recovery.committed`** — *"This snippet is in the file. The file it went into has been
  written to since this panel opened, so nothing more can be created from here."* /
  *"Este fragmento está en el archivo. El archivo en el que ha entrado ha recibido una escritura
  desde que se abrió este panel, así que desde aquí ya no se puede crear nada más."* Drawn as the
  last block of P27, P28, P29, P30, P33 and P34. **The two languages say the same thing, and the
  sentence attributes the write to nobody.** Whether the write it reports is this panel's own is
  **not** something these artifacts establish: the harness has no invoke spy and no intermediate
  snapshot (§8.3), so what is retained is a final file equal to the authored expected-bytes document,
  a backup directory, and this sentence on screen — consistent with the panel's own create having
  written, and unable to exclude anything else. The observation that stands is about the wording: a
  reader may take *"has been written to since this panel opened"* as news of an **external** event
  when on this path the obvious cause is the panel itself. Recorded as **O1**; no claim is false and
  nothing is proposed.

### 4.3 The refusal on the recovery path

P29 (en) and P30 (es) drove the recovery form to its refusal ending and then pressed *Save anyway*:

- **en** — *"The new snippet repeats trigger text another snippet in this list already writes, and
  espansoConfig cannot determine how espanso will handle overlapping definitions."*
- **es** — *"El fragmento nuevo repite un texto de disparador que ya escribe otro fragmento de esta
  lista, y espansoConfig no puede determinar cómo tratará espanso las definiciones superpuestas."*

**Correct under D2u in both languages**: it claims a risk this application cannot resolve and makes
**no** claim about espanso's semantics. The refusal is also correct on the facts — the ending keeps
the carried trigger `:beta`, and `target-changed-r1.yml` still holds a `:beta`. The two offered
answers are *Save anyway* / *Keep editing* and *Guardar de todos modos* / *Seguir editando*, and the
file that resulted matched `editor-recovery-refused-expected.yml` byte for byte in both languages.

### 4.4 The conflict panels, per surface, both languages

The opening pair is identical across all six surfaces and both languages and is the sentence
`reveal.ts` exists for: *"Nothing was written. The file on disk is exactly as it was."* /
*"No se ha escrito nada. El archivo del disco sigue exactamente igual."* followed by *"This file
changed after its text was loaded here, so the save was refused rather than applied over that
change."* **Drawn on every one of the twenty-seven launches**, and **consistent with the final
filesystem state in every one**: the twelve launches whose panel later said a file **had** been
written are twelve of the thirteen whose final bytes are the authored document and which left a
backup directory — the thirteenth being P39, which drew no ending sentence at all (O3) — and the
fourteen whose ending said nothing was written are exactly the fourteen whose final bytes equal the
fixture with no backup directory. **No launch drew a backup sentence without a backup directory, and
none drew a "nothing was written" ending beside one.**

That is an agreement between drawn text and a **post-image**, and it is worth exactly that. It does
not establish the sentence true *at the moment it was drawn*: nothing here observes the file between
the panel appearing and the launch ending, so a write producing identical bytes, or one undone before
the launch closed, would leave the same artifacts (§8.3). What the twenty-seven do establish is that
no launch's drawn account **contradicts** the state its file was left in.

The third line is the one that differs by draft kind, and both wordings are right:

- **authored text** (editor, creator, raw) — *"Your text is still here, exactly as you wrote it."* /
  *"Tu texto sigue aquí, exactamente como lo escribiste."*
- **an operation** (deleter, mover, duplicator) — *"What you asked for here is still set up, exactly
  as you left it."* / *"Lo que pediste aquí sigue preparado, exactamente como lo dejaste."*

The deleter's *what you asked for* block is the most careful sentence in the set and it says the same
thing in both languages: *"This panel names the snippet as this window read it before the file
changed. This app does not look for a matching snippet in the version on disk, so nothing here says
what that version holds."* / *"Este panel nombra el fragmento tal y como lo leyó esta ventana antes de
que cambiara el archivo. Esta aplicación no busca un fragmento equivalente en la versión del disco,
así que nada de lo que hay aquí dice qué contiene esa versión."* **It claims exactly what the code
does and explicitly disclaims what it does not do.**

### 4.5 The reapply reports

Two arms were drawn, fifteen times in all. `browser.reapply.reapplied` on the seven positive
`*-exact` launches — two deleter, two mover, three duplicator — *"This window now shows the version on
disk, with what you kept set up over it. Nothing has been written yet: send it when you are ready,
and that save can still be refused or conflict."* — **which is a promise about what has *not*
happened, and this harness cannot check a promise of that shape.** Its byte check runs once, after
the launch; it says nothing about the file at the moment the report was drawn. The retained
agreement is only that each of those seven launches ended with the final bytes its case names. The
first version of this sentence said that nothing was on disk at that point which the later send did
not put there, and no artifact witnesses it (§8.3).

`browser.reapply.manualResolution` on the eight recovery launches — six editor, two creator — with
two different obstacles: the
editor's field-collision obstacle (*"The version on disk does not hold these fields the way the
version your draft was built on did … Replacement text."*) and the creator's missing-anchor obstacle
(*"espansoConfig could not identify, in the version on disk, the snippet this one was to be placed
after."*). Both are true of the fixtures — `target-changed-r1.yml` rewrote `:beta`'s body, and
`target-deleted-r1.yml` removed `:beta` entirely — and the Spanish says the same in both cases.

### 4.6 The selection-cleared notice

Drawn on eight of the ten reload launches, identically:

- **en** — *"The selection was cleared, because espansoConfig can no longer point at the snippet that
  was selected. That is not a statement that it was removed: nothing here searched this file for
  it."*
- **es** — *"Se ha borrado la selección porque espansoConfig ya no puede señalar el fragmento que
  estaba seleccionado. Eso no significa que se haya eliminado: aquí no se ha buscado el fragmento en
  este archivo."*

**This is the sentence to hold up as the standard.** It states what happened, states what it is *not*
a statement about, and gives the reason in the same breath — and it is accurate: the producer here is
`reresolve`'s **length** arm, a claim about the size of the list rather than about the snippet. The
Spanish is a faithful rendering, including the disclaimer.

P45 and P46 print `notice=absent`, which is **correct and not a gap**: the creator's plans select no
snippet, so there is nothing to clear.

### 4.7 The final outcome sentences, per surface

Each surface's closing sentence names why nothing more can be done from that panel, and each names a
*different* reason. All four were read in both languages and all four are true of the model:

- deleter — *"Nothing more can be deleted from here: pick another snippet in the list first."* /
  *"Desde aquí ya no se puede eliminar nada más: elige antes otro fragmento en la lista."*
- mover — *"the places this panel offers came from the reading of the file it was opened over"* /
  *"los sitios que ofrece este panel vienen de la lectura del archivo con la que se abrió"*
- duplicator — *"the write gave every snippet in this file a new identity"* / *"la escritura le ha
  dado una identidad nueva a cada fragmento de este archivo"*
- editor — *"Reading it again is what tells this app how the file now spells each value, and which
  fields it may edit."*

**None of them says "the file was locked" or any other invented reason**, and each names the actual
invalidation. The Spanish carries the same reason in each case.

---

## 5. Both languages judged — register, agreement, and equivalence

**Register.** Spanish is second-person singular (*tú*) throughout — *"Lo que pediste"*, *"Carga"*,
*"elige"*, *"vuelve a pedirlo"*, *"copia tu texto"*, *"envíalo cuando quieras"* — and control labels
are infinitives — *"Cargar la versión del disco"*, *"Conservar mi borrador"*, *"Guardar de todos
modos"*. That split is consistent across every string this reading saw: prose addresses the person,
labels name the act. **No register break was found in any of the twenty-seven transcripts.**

**Agreement.** The pronouns resolve: *"elige un fragmento en ella"* (la versión), *"Descartar mi
texto y cargarla"* (la versión), *"compáralo con la versión en disco"* (el texto). *"Dejarlo"* and
*"Muévelo"* agree with *el fragmento*. **No agreement error was found.**

**Equivalence.** Every sentence pair read above says the same thing in both languages, including the
disclaimers, which are the part that is easiest to lose in translation and were not lost.

**The one place the two languages are not equivalent is M1, and it is not a translation error — it is
a collision.** Two keys whose English values are distinct have the **same** Spanish value, and both
are drawn on the same surface at the same time. A mechanical scan of the two dictionaries finds
exactly two such collisions in the whole application:

| Spanish value | Keys that share it | Their English values |
|---|---|---|
| `Dejarlo como está` | `browser.saveOutcome.choice.keepOperation`, `browser.matchDeletion.close`, `browser.matchDuplication.close` | *Leave this as it is*, *Leave this alone*, *Leave this alone* |
| `Expresión regular` | `browser.detail.field.regex`, `code.matchBadge.regex`, `code.triggerKind.regex` | *Regular expression*, *Regex*, *Regular expression* |

The second is benign — a field name and a badge for the same concept. The first is **M1**.

---

## 6. Findings

**Two Mediums, two Lows and six Observations, as the roster stands after 5b-3.** Two entries moved
and the rest are untouched: **M2** stays a **Medium** but is reclassified from *latent and inferred*
to **confirmed on a screen**, measured at 5b-1 and fixed at 5b-2 — it was briefly raised to High
during 5b-3 and round 2 of the review returned it, because the raise rested on pointer
unreachability that §8.16 and §8.17 withhold; the entry itself records all three arguments; **L3**
was withdrawn and re-judged as **O6**, with the reasoning stated there rather than deferred to the
review. Severities did not change for M1, L1, L2 or O1–O5.

### M1 — **Two different controls carry the same label in Spanish, on two surfaces.** Medium. Not a disk defect

**What was seen.** P48, the deleter in Spanish, prints the whole control roll of `section.deleter`
while the conflict is up:

```
[Dejarlo como está] [Dejarlo como está] [Conservar lo que he pedido] [Cerrar esto y cargarla]
```

P47, the same case in English:

```
[Leave this alone] [Leave this as it is] [Keep what I asked for] [Close this and load it]
```

P52 shows the same on the duplicator (`[Dejarlo como está] [Duplicar este fragmento]
[Dejarlo como está] …`), against P51's `[Leave this alone] [Duplicate this snippet]
[Leave this as it is] …`.

**What the two controls do.** The first is the surface's own close control —
`browser.matchDeletion.close` at `MatchDeleter.svelte:433`, `browser.matchDuplication.close` at
`MatchDuplicator.svelte:563` — which **closes the panel and abandons the request**. The second is the
conflict panel's *keep the operation* choice, `browser.saveOutcome.choice.keepOperation`, reached
through `conflictChoiceKey`'s `operationChoice` arm (`saveOutcome.ts:1536`), which **dismisses the
conflict and keeps the request set up**. They are opposite in effect and identical in wording.

**Why no test fails.** `saveOutcome.ts`'s own contract already names this class in the abstract —
*"`browser.saveOutcome.choice.keepOperation` could be re-worded to read exactly like
`browser.rawSave.choice.keepEditing` and every suite would stay green. The i18n suites check parity
and placeholders, never meaning"* — and holds a suite over that **one pair**. The collision found
here is with a **host** control rather than with the other conflict label, which that suite does not
cover, and `dictionaries.test.ts` asserts key-set equality, an untranslated-value heuristic,
placeholder parity and a no-verb-of-writing rule over the conflict family — **no global check that
two co-drawn controls have distinct labels**.

**Severity.** Medium, not High: neither control writes anything, so the worst outcome is a lost
set-up request or a panel left open — never a file. It is Medium rather than Low because it is a
correctness defect in the user-facing text of a **write** surface, it is invisible to every gate, and
it is invisible to any English-only reading, which is precisely the class of defect a bilingual
reading exists to find.

**Bound.** The two controls are in the same surface and in the DOM at the same moment (measured). They
are **not** measured as visible on screen at the same moment: the close control is in the panel head
and the conflict choices are in the panel's choice row, and §3.3 shows the choice row below the fold
while the head is above it. A person scrolling the pane meets the same three words twice.

**Not fixed here.** A reading records; the fix and its review round belong to whoever schedules them.

### M2 — **`section.recovery`'s box collapsed to zero height and the host's conflict panel was laid out over the form.** Medium, **confirmed on a screen**. Not a disk defect. **Fixed at 5b-2**

> **Reclassified at 5b-3.** This finding was first written as *Medium, latent and inferred*, on the
> premise that the host outcome panel was `null` in every state this reading reached. **The premise
> was false and the classification with it.** The covering state was constructed by P27–P34 — eight
> of this step's own launches — and the instrument of the time did not remeasure the sibling. §3.2
> holds the four-step source argument and the numbers; this entry holds the classification.

**What this step measured.** `section.recovery` reports `491x0` in all eight launches that drew it, in
both languages, empty, holding an offer, and holding the whole open form — and the one child it gives
a rectangle to, the offer control, lays out at natural size (`296x27` en, `357x27` es) at the
section's own `y`. **That is one control**; the form's other elements are reported by presence and
text, with no boxes (§3.2).

**What this step did not measure, and wrongly read as absence.** The host outcome panel drawn
immediately after `<RecoveryPanel>` in both creating hosts. It was on screen throughout P27–P34 —
`conflictOf()` reads a conflict out of `session.outcome` (`matchEditor.ts:1078-1079`), `applySave`
installs that outcome for every non-saved result (`:1522`, `:1525-1530`), and `attemptOfReapply`
returns the held session unchanged for `manualResolution` (`reapply.ts:540-547`), the arm all eight
printed. No reporter of this step looked at it after the form opened, and the record turned that
silence into *nothing was drawn after the section*.

**What is established now.** 5b-1's eight launches (P54–P61) measured the sibling at
**the section's top + 7 px** while the form's ten children extended **1001 px (en) / 1035 px (es)**
past that same top, and `document.elementFromPoint` at the centre of the one form control inside the
viewport — the close button — returned `div.panel[role="status"]`, the host outcome panel, **in all
eight**. 5b-2 removed `min-height: 0` from `.recovery`; its eight matching launches (P62–P69) put the
sibling at **the children's bottom + 7 px in all eight** and returned **`isTheControl` in all eight**,
with the two ordinary-path launches that have a retained predecessor, P70 and P73, coming out
line-for-line identical to P25 and P26 after normalising the launch directory name.

**Severity: Medium — and this entry has now been argued three times, twice wrongly.**

- **First version: Medium, on the ground that the state was never constructed.** The premise was
  false and round 1 of the review established it.
- **Then Medium again, on the ground that *the affected controls stayed operable through every path
  this harness drives*. That ground is unsound and is withdrawn.** The driver presses with
  `HTMLElement.click()`, which bypasses hit testing, so a programmatic press succeeding says nothing
  about a person's press. Operability was the harness's predicate, not a person's.
- **Then High at 5b-3, on the ground that the control was unreachable by pointer. That is
  over-claimed, and round 2 of the review is what caught it.** Disproving the operability ground does
  not establish its opposite. Two bounds this record states in its own §8 forbid the stronger claim,
  and the High crossed both: **§8.16** — `elementFromPoint` reports paint order at the sampled point
  and **not** event delivery — and **§8.17** — six of the seven form controls were `outsideViewport`
  and were never hit-tested, so nothing here generalises past one control per launch. There is a
  third reason, and it is arithmetic in the retained rectangles: **the sibling began 7 px below the
  section's top while the close button began at the section's top and stood 27 px high**, so the
  button's top 7-px strip was never inside the sibling's rectangle at all, and **no point in that
  strip was tested**. Even the one sampled control was not measured as wholly covered.

**Medium is what the retained evidence supports, and this is what it supports.** An opaque host
panel was painted through the band the recovery form's children occupy — visual occlusion, measured
in all eight pre-fix launches in both languages, and removed by 5b-2. That is a real defect on a
screen and it is confirmed rather than inferred.

**What would make it a High is named here so a later step is not tempted to assert it**: a trusted
pointer path — a real event dispatched through hit testing rather than `HTMLElement.click()` — over
coverage wide enough to speak for more than one control. No launch of this project has ever had one.

**What it is still not: a defect in what is written to a user's file.** Nothing here writes and
nothing here refuses a write, and **every launch that constructed the state answered `bytes=MATCH`**
— this step's eight and 5b-2's twelve alike.

**Fixed at 5b-2, not here.** A reading records; 5b-1 measured and 5b-2 changed one declaration, each
with its own record and its own review round. **No test in this repository can fail on it** — jsdom
performs no layout, so `getBoundingClientRect` returns zeros, `elementFromPoint` has nothing to
report, and no computed height distinguishes `min-height: 0` from `min-height: auto`. The window
measurement is the whole of the evidence (5b-2 §9.1).

### L1 — **On three of the four surfaces the recovery sentence is wholly outside the visible band at the moment it is drawn.** Low. Not a disk defect

Measured at `y ∈ [-15, 37]` with height 51 on the deleter, mover and duplicator, in both languages and
by both routes (with and without the harness's scroll restore), against a band of `[44, 689]`. On the
raw editor it is at `y = 138`, inside the band. It is reachable — roughly sixty pixels of upward
scroll — and the layout that puts it there is correct. **What is claimed is the position, not its
cause**: the application asked for the conflict panel to be brought into view, and the window was
found at a scroll position that leaves the sentence above the band. The reveal request is a silent
one and no caller can learn whether it moved anything (`src/lib/components/reveal.ts:57-82`,
`:96-99`), so this record names the two observations and stops (§3.1, §8.14).

Low rather than Medium: the sentence carries **no control**, it is an explanation of why recovery is
unavailable, and the panel it explains is the thing the application asked to bring into view — and
the panel's first line was found at the top of the band on every one of those launches.

### L2 — **On the same three surfaces the conflict panel's own controls are wholly below the band.** Low, **reproduced**. Not a disk defect

`y = 771`–`788` against a band bottom of 689, in both languages, on the deleter, mover and
duplicator; `y = 658` and inside the band on the raw editor. `reveal.ts`'s own contract states this
behaviour and the deliberate reason for it (`'nearest'` asks for the minimum, and asking for more
would trade one invisible sentence for another). This reading **reproduces** it on three surfaces and
in Spanish for the first time; it discovers nothing new and proposes nothing.

### L3 — **withdrawn at 5b-3.** Re-judged as **O6** below

The wording differences L3 named are real and are still recorded; what is withdrawn is their
classification as a Low defect. The reasoning is in O6, and it is not "downgraded per review" — one of
L3's three bullets is not even a terminology inconsistency, for a reason this record's own §5
establishes and the review did not use.

### O1 — **`browser.recovery.committed`'s second clause can read as news of an external write, on a path where the panel itself is the obvious cause.** Observation

*"The file it went into has been written to since this panel opened"* is drawn as the last block of
P27–P30, P33 and P34, in both languages, on a path whose obvious cause of a write is the panel's own
create. The sentence attributes the write to nobody, and the final bytes and backup directory are
consistent with it. A reader may still take it as news of an **external** change. No defect is
claimed. (**Which command wrote is not observed here** — §8.3; the first version of this entry said
the sentence was reporting the panel's own write as a fact.)

### O2 — **The mover's close control is one word from the conflict panel's keep control, in Spanish.** Observation

P50 draws `[Dejarlo donde está]` (`browser.matchMove.close`) and `[Dejarlo como está]`
(`keepOperation`) on the same surface. They are distinct — this is **not** M1 — but they differ by one
word, and the mover is the only one of the three operation surfaces where the collision was avoided.

### O3 — **The instrument's final report has no wait, and P39 sampled the duplicator's panel before its acknowledged save answered.** Observation. An instrument limitation, not an application defect

P39 (`duplicator-exact:en`) ends with the acknowledgeable-finding panel — *"The duplicate keeps the
same trigger definition as its source … Save anyway / Leave this as it is"* — rather than the written
panel, because `duplicatorPlan` presses *Save anyway* and then calls `reportFinal`, which does not
wait. **The file it left is the right one**: `bytes=MATCH` with a backup directory. **P53 is a second
retained artifact of the same case in the same language** and it drew *"The file was written… This
snippet has been copied…"*, with identical bytes; P15 (4b) and P40 (Spanish) drew it too. Four
retained artifacts of one case, one of which sampled early, is what supports calling this a race in
the reporter rather than behaviour — a source-supported inference from `duplicatorPlan`'s missing
wait, not something the artifacts alone decide. Recorded rather than repaired: repairing it means
editing the probe, which this step did not do. (5b-1 later edited `src/probe.ts` for a different
reason and did not touch `reportFinal`.)

### O4 — **Three recovery sentences are the only user-facing claims in this phase backed by bytes, and all three hold.** Observation, positive

`transfer.omitted`, `browser.recovery.position` and `browser.recovery.what`'s quoting clause are each
checked against `editor-recovery-create-expected.yml` and `creator-recovery-create-expected.yml` in
§4.2, and each is true of the bytes in both languages. **This is the harness's only independent
evidence about a sentence, and it is worth naming that it was spent on the three sentences it could
reach.**

### O5 — **The recovery form's destination list and the creator's own list disagree, correctly, and this reading shows both.** Observation

One row in the recovery form (P27, P28, P33, P34) against two in the creator's own list (P45, P46).
`recoveryDestinationsOf` carries only eligible files while `matchCreation.ts` lists every file with a
typed refusal, and `browser.recovery.destinationScope` says so on screen.

### O6 — **The two recovery-unavailable sentences give advice in words the controls do not use verbatim.** Observation. **Downgraded from L3 at 5b-3, and the reasoning is here**

The three wording differences, unchanged from what L3 recorded:

- `wholeDocumentDraft` (**en**) says *"Carry on editing"*; the control says *"Keep editing"*.
- `wholeDocumentDraft` (**both**) says *"compare it with the version on disk"* / *"compáralo con la
  versión en disco"*; there is **no compare control**.
- `operationDraft` (**es**) says *"Carga la versión en disco"*; the control says *"Cargar la versión
  del disco"*. The English *"Load the version on disk"* is the label verbatim.

**What L3 claimed, and what the evidence in this record does not support.** L3 classified these as a
Low defect on the ground that *"a person hunting for a named button may not find one."* Nothing in
this reading observes a person, and no artifact shows an action going unidentified — that ground is
an assertion about a reader's experience made from transcripts of a driven window, which is exactly
the kind of claim §8.2 says a transcript cannot carry. More decisively, **neither sentence promises a
verbatim-labelled control.** Both are advice about what can be done next, and §4.1 checks that the
advice is followed by the window: P47–P52 press *Load the version on disk*, confirm, and land on a
pane holding the selection-cleared notice, which is exactly the state the sentence's next clause
tells the person to act in. A defect needs a broken obligation, and there is none here.

**The third bullet is not even a terminology inconsistency, and this is the part the review's
argument does not reach.** §5 establishes, over every string this reading saw, that Spanish keeps a
systematic register split: **prose addresses the person in the second-person imperative** — *"Carga"*,
*"elige"*, *"vuelve a pedirlo"*, *"copia tu texto"* — **and control labels are infinitives** —
*"Cargar la versión del disco"*, *"Guardar de todos modos"*. `Carga la versión en disco` inside a
sentence and `Cargar la versión del disco` on a button are therefore the **same instruction rendered
by the rule the whole application follows**. Calling that a defect penalises the Spanish for obeying
a convention the record praises three sections earlier. The English pair *"Load the version on disk"*
/ *[Load the version on disk]* matches only because English collapses the imperative and the bare
infinitive into one form — it is a morphological coincidence, not a standard the Spanish failed.

**What survives as an observation.** Two things, and both are about consistency rather than
correctness. The English `wholeDocumentDraft` sentence uses *"Carry on editing"* where the same
sentence's other two verbs — *"copy your text"*, *"load that version"* — do echo their controls, so it
is one dictionary being internally uneven. And *"compare it with the version on disk"* points at
something on the screen rather than at a button: the panel prints the disk version's whole text
inline (checked in P41 and P42), so the action is possible by reading, but a reader scanning for a
control will scan in vain. Neither is untrue and neither breaks a promise. **Observation.**

**What would make it a defect, so the line is drawn rather than assumed.** M1 is the contrast: two
co-drawn controls carrying one label breaks *distinguishability*, an obligation a control genuinely
has. A sentence that describes an action in its own words breaks no obligation a sentence has — and
no suite in this repository checks either, which is why both had to be judged by a reader and why
getting the classification right matters more than usual.

### Things that are **not** findings of this reading

- **The conflict panel's controls being below the fold is not a new finding** — L2 says so, and it is
  `reveal.ts`'s stated behaviour.
- **`section.recovery`'s zero height is not a reading failure and not a mismeasurement** — M2 says
  which it is.
- **Nothing about hole 1.** See §7.

---

## 7. Is any finding a defect in what is written to a user's file? **No.**

**All twenty-seven launches ended with `bytes=MATCH`**, each against the document its case names:
thirteen against an authored expected-bytes document, fourteen against a fixture the case must leave
unchanged. Those thirteen also left a backup directory and twelve of them drew a sentence saying so —
the thirteenth drew no ending sentence at all (O3); the fourteen left no backup directory and drew an
ending saying nothing was written. The fifth prediction fixture is matched by both of the retained
launches that name it, one per language.

**This is a claim about final state, and §8.3 is the bound.** No launch in this harness observes an
intermediate filesystem state, counts a command, or attributes a write to an event, so "wrote" and
"did not write" here mean *ended with changed bytes and a backup* and *ended with the fixture's bytes
and none*. What the twenty-seven establish is that **no retained launch was left holding wrong
bytes**, not that the write system is universally correct and not that any particular write happened
when the prose implies.

**M1 and M2 are both about a screen, and M2 is now confirmed rather than latent.** M1's two controls
neither write nor refuse a write; its worst outcome is a discarded set-up. **M2 reached a screen — the
host's conflict panel was painted over the recovery form in P27–P34 — and never reached a file**: all
eight of those launches, and all twelve of 5b-2's, ended with `bytes=MATCH`. L1 and L2 are about where
text is; O6 is about what it names. **No finding of this reading touches the bytes.**

---

## 8. What this reading does **not** establish

3b §8, 3c-1 §7, 3d-2a §6, 4a §6 and 4b §10 are inherited whole. What matters most for a reader of
this file:

**8.1 Hole 1 is untouched, and this reading may not say otherwise.** `browser.notice.gone`'s second
producer — `repairSelection`'s `clearSelection` arm, `src/lib/browser/selection.ts:292` — was not
reached by 4b, and closing it is not step 5's to do with a launch. 4b §5 gives the five-link chain in
the code. All eight notices this step drew came from `reresolve`'s **length** arm, exactly as 4b's
four did. **No launch attempted the other producer, and no launch could have distinguished "unreachable"
from "not attempted."**

**8.2 A transcript cannot fail because a sentence is untrue.** Every judgement in §4 is a reader's,
made by comparing a claim against the code and — in the four cases §4.2 and §4.4 name — against the
bytes or the filesystem. For every other sentence, what is established is that those words were on
screen.

**8.3 There is still no invoke spy and no command counter.** *The refused create issued exactly one
command* and *the reload wrote nothing* are **not** established. What P31, P32 and the ten reload
launches show is a final filesystem state equal to the fixture with no backup directory; a write
producing identical bytes, or a transient one undone before the launch ended, would leave the same
artifacts. Each launch retains an `xdg-before` and an `xdg` tree — **a pair of snapshots that bound
the launch and order nothing inside it** — so a *changed* final state plus a backup supports that a
write occurred during that launch, and supports neither a count of writes nor an attribution to any
panel event. Every write-history sentence in §§2, 4.2, 4.4, 4.5 and 7 is bounded by this entry, and
the first version of those passages was not.

**8.4 The overlap M2 names *was* constructed — by P27–P34 — and this step's instrument did not
measure it.** This entry said the opposite until 5b-3, and the correction is §3.2. What no artifact of
*this step* holds is the sibling's rectangle with the form open, the scroller's extent at that moment,
or any hit test. 5b-1 took all three (§8.15).

**8.5 The flex-shrink cause was read here, not sampled here.** No computed style was read in the
window by this step, which would have needed a probe edit; every measurement it did take is consistent
with the cause given and none contradicts it. **5b-1 sampled it** —
`minHeight=0px height=0px display=flex` on `section.recovery`, identical in eight launches — and the
cause is confirmed rather than inferred.

**8.6 `HTMLElement.click()` is not a mouse click.** No plan used the keyboard, tabbed, or produced an
untrusted-event refusal. **Focus order and keyboard operability of the recovery panel are untested by
every launch here**, and M1's two same-labelled controls were never reached by tabbing, which is the
route on which identical labels are worst.

**8.7 The adoption arm is invisible.** `installed` and `alreadyThere` both reach the same drawn state,
so no launch here distinguishes them.

**8.8 The fixture shape is still the easy one.** Double-quoted triggers, one leading comment, LF
endings, no BOM, no block scalars, no item-owned comments, no blank-line runs, no second sequence, no
read-only file, no package. **R38 is untouched: none of the fifteen corpus fixtures `CLAUDE.md` §4
lists has been through this harness.**

**8.9 Sixteen of the thirty-one case-table rows have never been launched by any step of this phase.**
Fifteen distinct cases have now run — 4b's fourteen plus `editor-recovery-create`. The sixteen that
have not are `editor-collision`, `editor-fallback`, `editor-satisfied`, `editor-ambiguous`,
`editor-missing`, `editor-ineligible`, `editor-empty-satisfied`, `creator-anchor`,
`creator-anchor-gone`, `deleter-changed`, `duplicator-changed`, `mover-changed`, `mover-reordered`,
`mover-reordered-end`, `mover-after` and `mover-after-changed`. **A case-table row is not evidence.**
Four expected-bytes documents remain predictions compared against nothing.

**8.10 The band is one viewport.** Everything in §3 is measured at 1180 × 728. A taller window would
put L1's sentence and L2's controls inside the band and would change nothing about M1. **M2 is
different in kind**: the collapse is a response to a column's negative free space, so a window tall
enough to remove the overflow would not have produced it at all. Every measurement of M2, before the
fix and after it, is at this one viewport and at the scroll position the application left.

**8.11 No finding of any earlier reading was re-checked**, except where §3.3 reproduces a documented
behaviour, and nothing here is a reading of 3c-2's or 3d-2b's ledgers.

**8.12 The window's own claim that a draft survives is not checked.** `browser.recovery.what`'s
*"Creating it discards nothing you have here"* is about the host surface's draft after a recovery
create, and no reporter in this harness looks at the host surface after the recovery form finishes.

### The five bounds and one observation added at 5b-3

8.13–8.17 are bounds, three of them named by Codex review round 1 and two by 5b-2. 8.18 is not a
bound but an **observation 5b-2 made and could not explain**, kept here rather than resolved. They are
in §8 because that is where a limit belongs, and because the first version of this record claimed
past four of them in its prose.

**8.13 No construction chronology is retained, and this record claimed one.** Nothing in the tree
witnesses how many times anything was built, in what order any launch ran relative to any edit,
whether a launch had a discarded predecessor, that no probe source was ever edited and reverted, or
when the gates ran. What **is** retained: twenty-seven launch directories, each with one `probe.log`,
a zero-byte `probe.err`, a `bytes.txt` naming binary digest `fcc9c3ac…`, a `tree.diff`, an `xdg-before`
and an `xdg` config tree, a `home`, and the `.app` bundle assembled for it; three manifests; and the
tracked tree's own shape. **That is a before-image and an after-image, and nothing between them.**
Two snapshots bound a launch; they do not order anything inside it. The first version of this
record read those post-images as *no probe source was edited*, *no rebuild was performed*, *every
launch ran the binary 4b left*, *P27 was the first-ever launch and matched on its first attempt*,
*P53 was a commissioned re-take*, *the four other predictions stand exactly as 4a left them*, and
*the gates were re-run in this step*. **None of those is witnessed.** Each has been narrowed to the
comparison that is: a digest equality, a manifest agreement, or a statement about the current tree.
This is the project's named worst defect class, repeated after 4b's directly analogous High.

**And 5b-3's own first draft of the correction added two more, which is why this bound is stated
here rather than trusted.** It wrote that the gate run happened *before the rewrite was applied* and
that 5b-2 searched the bundle *after its CSS change* — two orderings of a command against an edit,
in the very passages narrowing other orderings, and it offered `PROGRESS.md` as a *witness outside
the record* when `PROGRESS.md` is prose by the same hand. Round 2 of the review named all three as
the narrower surviving instance of round 1's chronology High. **§10 and §1.3 now claim current
comparisons only.** The lesson is not that the rewrite was careless; it is that this class reappears
inside its own fix, and a round that reviews the fix is what finds it.

**8.14 A sampled scroll position cannot be attributed to an honoured reveal request.**
`scrollQuietly` returns silently when `scrollIntoView` is missing and swallows the refusal when the
call throws, so **no caller can learn whether anything moved**
(`src/lib/components/reveal.ts:57-82`), and `revealOutcome`'s contract says *"asked for, not
achieved"* (`:96-99`). Every geometry sample in this reading is taken **after** the transition, never
before and after it. Layout clamping and scroll anchoring produce identical final coordinates. So
§3.1 and L1 claim two facts — the application asked, and the window was found at that position — and
join them nowhere. The first version wrote *"what moved the pane is `revealOutcome`"*.

**8.15 The open-form launches before P54 did not remeasure the following host outcome, did not measure
the form's own content, and could not test a pointer.** No reporter of P27–P34 looked at
`section.recovery`'s `nextElementSibling` after the form opened, printed the scroller's extent at that
moment, or called `document.elementFromPoint` anywhere; and `HTMLElement.click()` bypasses hit
testing, so every successful press in this harness's history is silent about pointer reachability.
**The form's own content was never measured either**: the only rectangle those transcripts give
inside the section is the offer control's, and `recoveryForm box=` repeats the section's `491x0`. The
host panel's box *is* printed by all eight, one screen earlier, at the conflict stage
(`658,44,491x1032` / `491x1094` / `491x812` / `491x890`) — heights that match 5b-1's sibling exactly.
**That gap is discharged rather than open**: 5b-1 built
the reporter and measured the sibling, the section's children and extent, the scroller, the computed
styles and a real hit test of every form control, across eight launches in both languages; 5b-2
re-measured all of it after the fix over eight matching launches plus four ordinary-path ones. What
remains open about it is 8.16 and 8.17.

**8.16 `document.elementFromPoint` reports paint order at a point, not event delivery.**
`isTheControl` says the button is what is painted at its own centre. It does **not** establish that a
pointer event would be delivered to it, that the button would respond, or that a person's press would
land there. No launch in this harness has ever dispatched a real pointer event — presses still go
through `HTMLElement.click()`. The hit test narrows the question from *is anything painted over this*
to *is this painted here*, and stops there (5b-2 §9.2).

**8.17 The hit-test verdict rests on one control per launch.** The recovery form draws **seven**
controls, and in every one of 5b-1's and 5b-2's launches **six answered `outsideViewport`** — their
centres lie below the 728-pixel viewport at the sampled scroll position, so `elementFromPoint` was
never called for them and nothing says whether they are covered. The only control hit-tested is the
form's close button. `somethingElse` in all eight before and `isTheControl` in all eight after is a
one-control result reproduced sixteen times, not a seven-control sweep (5b-2 §9.3).

**8.18 The creator's host outcome panel height is bimodal, and the cause is unexplained.** After the
fix it measures `491x812` (en, P68) and `491x890` (es, P69) against `491x829` (en, P60) and `491x873`
(es, P61) before — ±17 px, one in each direction, which no single-direction account of a flex
redistribution explains. **It is not attributed to the fix**, because the same case and language
already produced both values with the old CSS: `creator-recovery-create:en` measured `491x829` in P17
and P60 and `491x812` in P33; `creator-recovery-create:es` measured `491x873` in P61 and `491x890` in
P34. Each post-fix value is one this harness had already recorded before any change, the panel's text
is identical in the P60/P68 pair compared as retained text, and the two editor surfaces show no such
variation (`491x1032` and `491x1094`, before and after, in all six editor launches). **What produces
the bimodality is not established, and this record does not guess** (5b-2 §6b).

---

## 9. Privacy, verified rather than assumed

- **No launch artifact contains any path under `$HOME`.** Swept over all twenty-seven `probe.log`
  files for the owner's home path and for the real espanso config's file names: no hit.
- **The real espanso configuration was never opened.** Every launch points `XDG_CONFIG_HOME` at the
  synthetic two-file tree `launch.sh` writes and `HOME` at an empty per-launch directory, so neither
  candidate `resolve_config_dir()` probes can reach it.
- **No `.espansoconfig-backups` exists outside the launch trees.** Checked directly at both candidate
  real-config locations; neither exists.
- **Every fixture is neutral** — `:alpha`, `:beta`, `:gamma`, `:probe`, and a synthetic profile that
  says so in its own first line. Nothing quoted in this record is anybody's configuration.
- This record says **`$HOME`** rather than spelling the owner's home path, which was 4b's Low finding.

---

## 10. The gates — figures **with the harness in the tree**, and what stands behind them

```sh
cargo test --workspace   # 1112 passed, 0 failed
npm test                 # 1768 passed, 51 files
npm run check            # 424 files, 0 errors, 0 warnings
npm run build            # 181 modules transformed
```

**No gate transcript is retained, by this step or by any other in this phase.** These four figures are
a worker's reading of four commands' output. No artifact witnesses that they were produced, when they
were produced, or what the tree held at the time, and the first version of this section asserted that
the gates *"were re-run in this step"* — which nothing in the tree can support (§8.13). The figures
are recorded because they are the numbers a later step must reproduce, and they are recorded as an
account rather than as evidence.

**They are also the numbers that stand now**, after 5b-1's instrument extension and 5b-2's
one-declaration change to `RecoveryPanel.svelte`: both those records report the same
`1112 / 424 / 1768 / 181`, and both say the same thing about retention.

**A fourth account exists and it is an account too.** 5b-3 records the same four figures —
`cargo test --workspace` 1112 passed / 0 failed, `npm run check` 424 files / 0 errors / 0 warnings,
`npm test` 1768 passed over 51 files, `npm run build` 181 modules with `svelte/internal/server`,
`svelte/server` and `async_hooks` all absent from the bundle — reported in `PROGRESS.md`'s
verification section for this step.

**That does not raise it above an account, and 5b-3's first draft of this paragraph claimed it
did.** The draft said the run happened *before the rewrite was applied* and called `PROGRESS.md` a
witness outside the record. Neither holds: `PROGRESS.md` is prose written by the same agent that
writes this record, no artifact couples any of these figures to a tree identity, and **the ordering
of a command against an edit is exactly the kind of chronology §8.13 says nothing here retains**.
Round 2 of the review caught it as the narrower surviving instance of round 1's chronology High. So:
four accounts of the same four numbers, none of them a transcript, and **what would close this is a
retained transcript coupled to a tree identity** — not a fifth account. `npm test` is unmoved by
either, and that is a bound rather than a reassurance — `src/probe.ts` is read by no suite, and no
suite in this repository can tell the broken CSS from the fixed CSS, because jsdom performs no layout
(5b-2 §9.1).

**The 181 was checked, not accepted.** `CLAUDE.md` records that the old regression shorthand — "a jump
to ~180" — now sits within one of a legitimate count, so the number alone decides nothing. The bundle
was searched for `svelte/internal/server`, `svelte/server` and `async_hooks`, and **none of the three
is present**. 181 is 4a's production 180 plus `src/probe.ts` — one new `.ts` module, no styles.
`2c-4c-5b-2-notes.md` reports the same three absent and reports reading the emitted rule back out of
the stylesheet to confirm no `min-height` reaches the binary. **That it did so *after* its CSS change
is an ordering no artifact retains** — the same limit this section states about the gate figures, and
5b-3's first draft of this paragraph asserted the ordering anyway.

**These are with-harness figures and must never be carried forward as production numbers.** Step 6
deletes the harness and re-derives `1112 / 423 / 1767 / 180` on a harness-free tree. **That
re-derivation is owed and not optional**: a count only a harness-free tree can produce must be
re-derived on one, never copied forward.

---

## 11. Verdict

**The reading is complete, its record has been corrected, and the geometry exit is now closed.**
Twenty-seven launches, all six surfaces in both languages, every one with its four-part conjunction
judged and recorded. The two rectangles 4b measured are judged: one is a correct layout seen at a
scroll position that leaves its sentence above the band, and one was **a real collapse that painted
the host's conflict panel over the recovery form**. **Two Mediums** — M2 measured at 5b-1 and fixed
at 5b-2 — two Lows and six Observations; **no High among the application findings**, and **no defect
in what is written to a user's file**. Codex round 1's three Highs and round 2's two were findings
about *this record* and not about the application, and they are closed by the rewrite it now
carries. **Round 2's first High was against 5b-3's own correction**: this record had raised M2 to
High on pointer unreachability, which its own §8.16 and §8.17 withhold.

**The record's first version was wrong about M2, and the correction is the substance of 5b-3.** It
called the overlap latent, inferred and never constructed, on the premise that the host outcome panel
was `null` in every state reached. The premise was false — §3.2 gives the four steps in the source
that make it false, and P27–P34 are the eight launches that constructed the state while the
instrument looked elsewhere. Two further classes of claim were narrowed in the same pass: post-images
read as construction chronology (§8.13), and final bytes read as intermediate write history (§8.3).
**No measurement changed.** What this reading measured, it measured correctly; what it claimed from
those measurements is what had to be rewritten.

**The geometry exit Codex round 1 held open is closed by 5b-1 and 5b-2, not by this record's
re-wording.** 5b-1 built the reporter this step lacked and took both sibling rectangles, the scroll
extent and a real hit test; 5b-2 removed one CSS declaration and re-measured all of it, plus four
ordinary-path launches to show nothing else moved. §§8.16–8.17 say exactly how far a hit test reaches,
and §8.18 records the one thing 5b-2 saw and could not explain.

**The one finding that could not have been found any other way is M1**, and it was found because the
brief insisted on both languages on every surface rather than in aggregate. The instrument prints
control labels; it cannot compare two of them; and no suite in this repository checks that two
controls drawn together say different things. **M2 is the mirror image**: it could not have been found
by any suite either, because jsdom performs no layout — only a window could show it, and only an
instrument built to look at the right element could measure it.

**What step 6 inherits.** The tree is `/private/tmp/espansoconfig-harness-2c-4c/`, with
`launches/P01…P73`, three manifests, and the four harness paths still uncommitted in the working
tree — `src/probe.ts` now carrying 5b-1's `reportRecoveryGeometry()`. Step 6 deletes it and
re-derives the harness-free gate figures.
