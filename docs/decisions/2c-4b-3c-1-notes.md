# Phase 2c-4b step 3c-1 — the instrument, extended with the Q7 cases 3b left unbuilt

Step 3c-2 is the window reading 2c-4b-3 owes for six surfaces. **This step is not that
reading**, and nothing here judges a screen. It builds the parts of the reapply instrument
`docs/decisions/2c-4b-3b-instrument.md` section 8.5 and section 8.10 named as missing — eight new
fixture-pair cases and the Spanish coverage — and **proves each of them in a running WKWebView
before 3c-2 depends on it**, exactly as 3b proved the instrument before the reading and 2c-4a-3c-1
provoked a true `SaveResult::Conflict` before 3c-2 read anything.

**The coverage this step reaches is bounded, and section 7 states the bound.** An earlier draft of
this record was titled *"extended to the whole Q7 matrix"*; that was false in two ways at once and
the review that found it is `docs/reviews/phase-2c-4b-3c-1-instrument.md`. Q7 point 6 names four
move-placement shapes — `top` after a reorder, `end` after a reorder, a resolvable `after`, and an
`after` anchor whose bytes changed — and the first draft built two of them; Q7 point 4 asks for an
operation target that was **removed, or whose trigger and item bytes both changed**, and no case in
either step supplied one. The changed anchor and the removed target are built now —
`mover-after-changed` and `editor-missing` — which leaves **`end` after a reorder still unbuilt**,
for the next construction step. Section 7.6 lists that and the rest of what is *still* not covered,
rather than letting a title imply it is.

**Sixteen launches, all sixteen with a zero-byte `probe.err`, all sixteen reaching `--- end` with no
`--- failed` line anywhere.** One is a smoke re-run of an existing case; eight prove the eight new
cases in English; four close section 8.10's named gaps — **the two surfaces with no Spanish launch
at all, the mover with no Spanish positive, and the creator's anchor-refusal report**; three are
re-runs taken after the transcript's text limit was raised (section 5.6).

**Read section 5 before quoting anything above it.** The claim classes are separated there, and
they are separated because 3b took four review rounds and ten findings, and **every one of the ten
was a sentence in the record** rather than a defect in the harness or in the application. This
step's own first round then produced seven more of the same kind, and one of them — section 5.6 —
is the sharpest instance this project has recorded: **a quotation that ran past the end of the
retained evidence.**

---

## 1. What this step changed, and where

| File | What changed |
|---|---|
| `<scratch>/fixtures/` | **nine new files** — six R1 fixtures and three expected-bytes files (section 2) |
| `<scratch>/launch.sh` | **eight new rows** in the case table, and one corrected comment above it |
| `src/probe.ts` | `moverPlan` takes a placement; `BLOCK_TEXT_LIMIT`; eight new arms in `runPlan`'s switch (section 3) |
| `<scratch>/launches/L24…L39` | sixteen new launch directories |
| `<scratch>/manifest-3c-1-post.sha256` | a **post-image** hash manifest (section 5.7) |
| `docs/decisions/2c-4b-3c-1-notes.md` | this record — the only file this step adds under version control |

`<scratch>` is
`/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad`,
outside the repository. It is **step 3b's tree, extended**.

`src-tauri/src/probe.rs` did not change. The harness remains deliberately uncommitted, and
`git status --short --untracked-files=all` still lists exactly the four harness paths:
`src/main.ts` and `src-tauri/src/main.rs` modified by two hook lines each, `src/probe.ts` and
`src-tauri/src/probe.rs` untracked. Nothing under `crates/espansoconfig-core/tests/corpus/real/`
appears, and **the owner's real configuration was never opened** — every launch points
`XDG_CONFIG_HOME` at the synthetic two-file tree `launch.sh` writes and `HOME` at an empty
directory, so neither candidate `resolve_config_dir()`
(`crates/espansoconfig-core/src/discovery.rs`) probes can reach it. All fixture content is neutral
and hand-authored.

**`L01…L23` and 3b's eight fixture files carry modification times this step did not move**, which is
a timestamp observation and not a content comparison — section 5.7 says what evidence exists for it
and what does not.

## 2. The eight new cases

Every fixture is a **complete, neutral, hand-authored document**; none is produced by substituting
text into another. `base-r0.yml` is unchanged from 3b — one comment line and a `matches:` sequence
of `:alpha`, `:beta` and `:gamma`, each a double-quoted `trigger:` and a plain `replace:`, with
`:beta` the target of every plan.

| Case | R0 | R1 | Expected afterwards | Q7 point | Launch |
|---|---|---|---|---|---|
| `editor-fallback` | `base-r0.yml` | `target-labelled-r1.yml` | `editor-fallback-expected.yml` | 2 | L25 (en) |
| `editor-satisfied` | `base-r0.yml` | `target-satisfied-r1.yml` | **exactly R1** | 3, second half | L26 (en) |
| `editor-ambiguous` | `base-r0.yml` | `target-ambiguous-r1.yml` | **exactly R1** | 5 | L27, L37 (en) |
| `editor-missing` | `base-r0.yml` | `target-deleted-r1.yml` | **exactly R1** | 4's *target removed* | L36 (en) |
| `mover-reordered` | `base-r0.yml` | `reordered-r1.yml` | `mover-reordered-expected.yml` | 1, and 6's *`top` after reorder* | L28 (en) |
| `mover-after` | `base-r0.yml` | `reordered-r1.yml` | `mover-after-expected.yml` | 6's *resolvable `after` anchor* | L29 (en) |
| `mover-after-changed` | `base-r0.yml` | `anchor-changed-r1.yml` | **exactly R1** | 6's *`after` anchor whose bytes changed* | L35 (en) |
| `creator-anchor-gone` | `base-r0.yml` | `target-deleted-r1.yml` | **exactly R1** | 7's *anchor deleted* | L30, L38 (en), L34, L39 (es) |

### 2.1 `editor-fallback` — the unique-trigger fallback positive

**R1 changes only the target, and only in a field the draft does not touch.**
`target-labelled-r1.yml` is `base-r0.yml` with one line added to `:beta`:

```yaml
  - trigger: ":beta"
    label: 'beta label written by the second writer'
    replace: beta value
```

`:alpha` and `:gamma` are byte-identical to R0 — deliberately, because 3b's `elsewhere-r1.yml`
changed `:alpha` and left the target alone, which is the opposite arrangement. The draft is the
editor plan's usual `replace: probe edit`. The expected file is R1 with `replace: probe edit`, so a
match requires **the single-quoted `label:` line and its spelling to survive** and only the drafted
field to be patched.

### 2.2 `editor-satisfied` — the `alreadySatisfied` arm

`target-satisfied-r1.yml` is `base-r0.yml` with `:beta`'s replacement set to **exactly the string
the plan drafts**, `probe edit`. Nothing is left to send, so the expected bytes are **exactly R1**
and there must be no backup directory. The case table records this row as `REFUSAL=nowrite` rather
than `yes`: `alreadySatisfied` is a success with nothing to write, not a refusal, and the column is
descriptive — see section 5.3.

### 2.3 `editor-ambiguous` — the ambiguous-trigger refusal

`target-ambiguous-r1.yml` rewrites `:beta`'s replacement **and** adds a second item spelling its
trigger `":beta"` character for character, with a different replacement:

```yaml
  - trigger: ":beta"
    replace: beta value rewritten by the second writer
  - trigger: ":beta"
    replace: a second snippet the second writer added under the same trigger
```

The two replacements differ from each other and from R0's, which is the part that is easy to get
wrong: an added item that copied `:beta`'s R0 bytes exactly would have been a **unique exact**
candidate and the editor would have identified it rather than refusing. Expected bytes are exactly
R1, with no backup directory.

### 2.4 `editor-missing` — the target that is gone

**Q7 point 4, and neither step had it.** The consult asks for an R1 that *removes the target, or
changes both its trigger and its item bytes*; 3b's `target-changed-r1.yml` changes `:beta`'s
replacement and leaves the trigger `":beta"` standing, which is why `editor-collision` **identifies**
the target and then refuses on a field. This case reuses `target-deleted-r1.yml` — `base-r0.yml`
with the whole `:beta` item removed — under the editor's ordinary plan, so the surface with the
weakest correspondence tier is asked about a target that has no candidate at any tier. Expected
bytes are exactly R1, with no backup directory.

### 2.5 `mover-reordered`, `mover-after` and `mover-after-changed`

**Three cases, which is not all of Q7 point 6.** That point names `top`/`end` after a reorder, a
resolvable `after`, and an `after` anchor whose bytes changed; the three cases here are `top`, the
resolvable `after` and the changed anchor, and **`end` after a reorder is unbuilt** — section 7.6.
The first two share
`reordered-r1.yml`, which holds the same three items as `base-r0.yml`, each byte-identical in its
own lines, in the order `:gamma`, `:alpha`, `:beta`. The target's former index was 1; index 1 of
that R1 is `:alpha`.

- `mover-reordered` chooses *At the top of the list*. `mover-reordered-expected.yml` is `:beta`,
  `:gamma`, `:alpha` — the target lifted to the front. Lifting **index 1** instead would have
  produced `:alpha`, `:gamma`, `:beta`, a different file.
- `mover-after` chooses *After `:gamma`*, which in R0 meant *last* because `:gamma` was last there.
  `mover-after-expected.yml` is `:gamma`, `:beta`, `:alpha` — the target placed immediately after
  the item spelled `:gamma`, which in R1 is **first**. Reusing the R0 position instead would have
  left `:beta` where R1 already put it, and written nothing.
- `mover-after-changed` chooses the same *After `:gamma`* against `anchor-changed-r1.yml`, which
  changes **`:gamma`'s** replacement and leaves `:alpha` and `:beta` byte-identical. The subject
  still has an exact candidate and **the anchor does not**, so this is the placement half refusing
  on its own. Expected bytes are exactly R1, with no backup directory.

### 2.6 `creator-anchor-gone` — a creation whose anchor was deleted

`target-deleted-r1.yml` under the creator's anchored plan — a new `:probe` snippet placed *After
`:beta`* — so the subject is targetless and only the placement can refuse. Expected bytes are
exactly R1, with no backup directory. This is the deletion half of Q7 point 7; 3b's `creator-anchor`
is the change half.

## 3. The driver did have to change, and this corrects section 8.5

**Section 8.5's last sentence — "The case table in `launch.sh` takes a new row and two files;
nothing in the driver has to change" — is false, and `mover-after` is the counterexample.**
`moverPlan` reached its destination with `pressNamed('browser.matchMove.position.top')`, a literal
dictionary key, and **no fixture pair can turn that into *After {trigger}***. The placement is a
control the plan presses, not a byte on disk. `moverPlan` therefore takes an `anchor: string | null`
parameter, and when it is a trigger the row is looked up with
`buttonContainingIn('.mover .destinations', anchor)` — scoped, because `:gamma` is also on screen in
the snippet list and section 6.6's lesson is that the unscoped lookup presses the wrong one.
`mover-after-changed` then reused that parameter and needed nothing new.

**What that shows is this one requirement, and not a rule.** An earlier draft generalised it to *a
new case needs a driver change exactly when it presses a control the existing plan does not press*;
that is an "exactly when" drawn from a single case, and a future case could just as well need a
different typed value, a different order, another synchronisation point or an extra printed line
while pressing only controls these plans already press. The narrow statement is the whole of the
evidence: **`mover-after` needed a driver change because it had to select a placement the existing
mover plan never selected.**

**The eight switch arms are a second change, and that one was chosen rather than forced.** Six of the
eight new cases are an existing plan function run against a new fixture pair; had `launch.sh` carried
a *plan* column beside its case column, those six would have needed nothing in `src/probe.ts` at all.
They were given their own arms so that each transcript's `--- begin` line names the **case** that
ran rather than the plan it borrowed, which is what makes a retained `probe.log` self-describing.

**`BLOCK_TEXT_LIMIT` is a third change, and section 5.6 is why.** `reportReapply` and `reportFinal`
kept the first 300 characters of a status block; they now keep 1500. Nothing else in either function
changed.

`src-tauri/src/probe.rs` did not change at all.

## 4. The launches

| # | Case | Lang | Purpose | Result |
|---|---|---|---|---|
| L24 | `editor-exact` | en | smoke: does the harness still run on this machine | **conflict**, reapplied, **bytes MATCH** — reproduces L02 exactly, including its `507e98f5…/31be59eb…/31be59eb…` |
| L25 | `editor-fallback` | en | the fallback positive | **conflict**, *Keep my draft*, `reapplied`, saved, **bytes MATCH** `editor-fallback-expected.yml` |
| L26 | `editor-satisfied` | en | the `alreadySatisfied` arm | **conflict**, *Keep my draft*, the **`alreadySatisfied` sentence**, **bytes = R1**, `backups=none` |
| L27 | `editor-ambiguous` | en | the ambiguous-trigger refusal | **conflict**, *Keep my draft*, `manualResolution`, **bytes = R1**, `backups=none`; transcript truncated at 300 (5.6) |
| L28 | `mover-reordered` | en | `top` over a reordered sequence | **conflict**, *Keep what I asked for*, `reapplied`, moved, **bytes MATCH** |
| L29 | `mover-after` | en | a resolvable `after` anchor | **conflict**, placement `After :gamma`, `reapplied`, moved, **bytes MATCH** |
| L30 | `creator-anchor-gone` | en | the deleted-anchor refusal | **conflict**, *Keep my draft*, `manualResolution`, **bytes = R1**, `backups=none`; truncated at 300 |
| L31 | `creator-front` | es | the creator's **first** Spanish launch | **conflict**, *Conservar mi borrador*, reapplied, saved, **bytes MATCH** |
| L32 | `duplicator-exact` | es | the duplicator's **first** Spanish launch | **conflict**, *Conservar lo que he pedido*, *Guardar de todos modos*, **bytes MATCH** |
| L33 | `mover-exact` | es | the mover's **first** Spanish positive | **conflict**, *Conservar lo que he pedido*, reapplied, moved, **bytes MATCH** |
| L34 | `creator-anchor-gone` | es | the creator's Spanish anchor refusal | **conflict**, `manualResolution` in Spanish, **bytes = R1**, `backups=none`; truncated at 300 |
| L35 | `mover-after-changed` | en | Q7 point 6's changed-anchor placement shape | **conflict**, *Keep what I asked for*, `manualResolution` naming the anchor, **bytes = R1**, `backups=none` |
| L36 | `editor-missing` | en | Q7 point 4's removed target | **conflict**, *Keep my draft*, `manualResolution` naming the subject, **bytes = R1**, `backups=none` |
| L37 | `editor-ambiguous` | en | L27 re-run at the raised text limit | same arms and same byte verdict as L27, with the sentence retained whole |
| L38 | `creator-anchor-gone` | en | L30 re-run at the raised text limit | same arms and same byte verdict as L30, with the sentence retained whole |
| L39 | `creator-anchor-gone` | es | L34 re-run at the raised text limit | same arms and same byte verdict as L34, with the Spanish sentence retained whole |

**Sixteen launches. All sixteen printed `--- end`, none printed `--- failed`, and all sixteen left a
zero-byte `probe.err`.** `--- end` remains a wrapper signal and not a success signal — section 8.9
of the 3b record is unchanged and still governs — so the absence of `--- failed` is stated
separately above, and each launch was checked by hand against the same four-part conjunction 3b
used: no `--- failed`; a conflict block with three revisions where `expected ≠ found` and
`diskRevision == found`; the expected control and action lines for that surface; and the intended
byte predicate. **No part of the harness conjoins those four**; a reader does, on every launch, and
one did here.

Every fixture's revision digest is stable across launches because the fixtures are. The ones this
step introduced, as the transcripts print them: `target-labelled-r1.yml` is `d96e9fec…`,
`target-satisfied-r1.yml` is `7e9b3ec0…`, `target-ambiguous-r1.yml` is `8232cb0d…`,
`reordered-r1.yml` is `b6793954…`, `target-deleted-r1.yml` is `d750e574…`, `anchor-changed-r1.yml`
is `e0950216…`. R0 is still `507e98f5…` and `elsewhere-r1.yml` still `31be59eb…`, which is one more
way of saying L24 reproduced L02.

**No launch of this step failed, and no launch was discarded.** There is therefore no
contemporaneous diagnosis in this record whose evidence was not retained — the class 3b's L01, L04,
L07–L09, L12 and L15 fall into is **empty here**, and the absence is worth stating because it is the
class most likely to be read into a record that does not mention it. L27, L30 and L34 are not
discarded either: their byte verdicts and control lines stand, and only their **quoted text** is
short, which L37, L38 and L39 supply instead.

## 5. Claim classes

3b's hardest-won lesson, applied to this record. The list is **not exhaustive** — it is the set
worth naming, so that a reader does not carry section 4's standing across the whole file.

**5.1 Launch-case outcome claims.** Everything in section 4's table, section 2's *expected* columns
as they were confirmed, and the revision digests. These are observed outcomes: strings the panels
drew, rectangles the driver measured, and `cmp` verdicts `launch.sh` computed. **None of them is a
proof of mechanism** (section 7.1).

**5.2 Quotations, which reach exactly as far as a transcript does.** Section 5.6 is the rule and
section 4's *truncated at 300* notes are where it bites.

**5.3 Harness-source claims — read from `launch.sh` or `src/probe.ts`, not from a transcript.**
That the `REFUSAL` column is descriptive and only `EXPECT` drives the comparison, so `nowrite` on
the `editor-satisfied` row changes nothing but the line `bytes.txt` prints. That the anchored move's
lookup is scoped to `.mover .destinations`. That `runPlan` dispatches six of the eight new cases to
plan functions 3b wrote. That the case name and the language are one string split twice
(section 6).

**5.4 Application-source facts — read from the application's own source, and not measured here.**
`crates/espansoconfig-core/src/reconcile.rs` walks four tiers in order — sequence address, owned-run
digest, mapping-slice digest, then the exact trigger fingerprint for the editor only — and a
placement stops at the owned-run tier. `trigger_fingerprint` records the trigger value's **source
slice verbatim**, which is why section 2.3's second item had to be spelled `":beta"` character for
character. `fieldReapply` in `src/lib/browser/matchEditor.ts` answers `satisfied` when the new
projection already holds the drafted value, and `planMatchReapply` reports `writesAnything: false`
when nothing is left, which is the `alreadySatisfied` arm. `MatchMover.svelte` draws its
destinations as buttons inside `ul.destinations`. **These are why the fixtures were built the way
they were; they are not things this step observed.**

**5.5 Launch-derived inferences — true of the artifacts, but conjoined by a reader.**
That `mover-reordered` moved the **target** and not its former index: the transcript never says
which item moved, and the inference is the final bytes together with the fixture's own arrangement
(index 1 of R1 is `:alpha`, and `:alpha` did not move to the front). That `mover-after`'s anchor was
**resolved** rather than reused: the same shape of argument. That `mover-after-changed`'s refusal
came from the **placement** rather than the subject: the fixture leaves `:beta` byte-identical and
changes `:gamma`, and the sentence drawn is the anchor one — but the transcript states no half.
That `editor-fallback` identified an item whose own bytes had changed since the session opened: the
final bytes show the drafted field patched onto the item R1 spells `:beta`, and R1 changed that
item's lines — but **which rule identified it is not observable**, and section 7.2 says so.

**5.6 Quotation may not run past the retained evidence, and the first draft of this record did.**
`reportReapply` kept the first **300** characters of a status block. L27's retained line therefore
ends at *"…is spelled the same on"*, L30's at *"…carries the exact owned"*, and L34's earlier still,
Spanish being longer. The first draft nevertheless wrote that L27's report *"says … its trigger is
spelled the same on more than one snippet"* and that L30's and L34's *"say … no snippet in that list
carries the exact owned-run correspondence"* — **endings that were on screen but were in no
artifact**, reconstructed from knowing what the dictionaries hold. That is this repository's
signature defect wearing a new costume, and no test can fail it. Two things were done about it:
`BLOCK_TEXT_LIMIT` is now 1500, and L37, L38 and L39 re-ran the three affected cases so that the
sentences quoted in section 7.3 are quoted from a retained line. **The rule generalises past the
limit that caused it**: a quotation is bounded by the artifact, never by what the reader knows the
application would have drawn.

**5.7 Change-history claims, which have no retained before-image.** *`L01…L23` and 3b's eight
fixture files are untouched* and *nothing else in the driver changed* are **not** verified
statements. Nothing hashed those paths before this step ran, and `src/probe.ts` is untracked so git
holds no baseline for it either; what the tree offers is **modification times** — 10:15 for 3b's
fixtures, 10:21–10:31 for `L01…L23`, against 18:18–18:38 for everything these two rounds wrote — and
an unchanged mtime is not an unchanged file. The driver claim is narrower still: it describes **the
edits this step made**, which is a claim about actions taken and not about a diff anybody can
re-read. `<scratch>/manifest-3c-1-post.sha256` now records SHA-256 for `launch.sh`, every fixture,
both probe sources and every retained `probe.log` and `bytes.txt`, so **a later step has the
before-image this one lacked**. It is a post-image only, and it is evidence for 3c-2 rather than for
3c-1.

**5.8 Gate results with no transcript.** Section 8's table is what the commands printed when they
were run, re-checkable only by running them again.

## 6. Spanish: the case table needed nothing, and that is the finding

**The language is not in the case table.** `launch.sh` takes `<case>:<language>` as one string,
splits the case off with `CASE="${PLAN%%:*}"` for the fixture lookup, and passes the **whole** string
through as `ECFG_PROBE_PLAN`; `runPlan` splits it again and calls `setLanguage` before dispatching.
So every case has always been runnable in either language, and section 8.10's gap was never a
missing row — it was **launches never taken**. Nothing was added to the case table for Spanish.

What L31–L34 change, in section 8.10's own terms — **the two surfaces with no Spanish launch, the
mover with no Spanish positive, and the creator's anchor-refusal report**:

- **the creator has Spanish launches** — a positive (L31) and a refusal (L34, re-run as L39);
- **the duplicator has a Spanish launch** (L32);
- **the mover has a Spanish positive** (L33), so its Spanish *reapplied* wording has now been drawn;
- the creator's **Spanish anchor-refusal report** — one of 2c-4b-3a's new strings, and named in
  section 8.10 as never having been put on a screen — was drawn in L34 and retained whole in L39.

All picked the language **through the picker** and printed `documentElement.lang=es`, per section
6.7: the WebKit data store follows the bundle identifier, which every probe bundle shares, so the
launch environment is not evidence of anything and the printed `lang` is.

**Eight of the nineteen cases now have a Spanish launch**, against four of eleven before. The eleven
without one are `editor-collision`, `creator-anchor`, `deleter-changed`, `duplicator-changed` and
the seven new English-only cases. That is not the matrix either; what this step establishes is that
running any of them in Spanish costs one launch and no new code, which is what 3c-2 needs to be
true.

## 7. What this step does **not** prove

In the spirit of 3b's section 8, which stands unchanged except where named. Sections 8.1
(nothing here is a window reading), 8.2 (a false sentence prints as well as a true one), 8.3
(`HTMLElement.click()` is not a mouse click), 8.7 (the adoption arm is invisible), 8.8 (it says
nothing about the real configuration), 8.9 (`--- end` is a wrapper signal) and 8.11 (nothing shows
that a refusal issued no save command) apply to these sixteen launches exactly as they applied to
the first twenty-three.

**7.0 There is still no invoke spy and no command counter.** Every refusal claim here is a claim
about the **final filesystem state** and nothing more: the file byte-identical to R1, no
`.espansoconfig-backups` directory in the tree, and a tree diff equal to the second writer's own
change. A write that produced identical bytes, or a transient one undone before the launch ended,
would leave those same artifacts. `launch.sh`'s own case-table comment used to say *"a refusal wrote
nothing"* and now says what the comparison actually establishes, because a harness comment that
promises more than the harness delivers is the same defect as a record that does.

**7.1 A byte match is still not a proof of mechanism.** `cmp` says the file equals a document a
person wrote by hand and a transcript says which strings were drawn; neither says why. 2c-4b-1's
Rust-side tests are what carries the mechanism claims.

**7.2 The correspondence tier is still invisible, and this step narrows the ambiguity without
closing it.** 3b's section 8.6 recorded that its positive cases could not tell an exact-tier
identification from a fallback one, because `elsewhere-r1.yml` left the target byte-identical.
`target-labelled-r1.yml` changes the target's own lines, so the identification in L25 cannot have
come from bytes identical to the session's — but **the mapping-slice tier and the trigger tier both
remain candidates**, since the added `label:` line changes the mapping slice too, and the transcript
prints no tier. L25 is therefore evidence of *an* identification across changed target bytes, not
evidence of *the trigger fallback*. Only a Rust-side test separates them.

**7.3 The refusals are not attributed to the rules they were designed around.** What is retained,
quoted from L37, L38 and L36 respectively, is that the ambiguous case's report says *"The trigger of
this change's snippet is spelled the same on more than one snippet — in the file as it was, in the
file as it is now, or in both — so it identifies nothing."*; that the deleted-anchor case's says
*"No snippet in that list carries the exact owned-line correspondence evidence recorded for this
change. This operation or positional anchor requires exact owned-line correspondence, so nothing
weaker will do."*; and that the removed-target case's says *"No snippet in that list is written the
way this change's was, and none spells its trigger the way the file spelled it. The snippet may have
been removed, or its trigger may have been rewritten or respelled."* L35 drew the same sentence as
L38. **Which rule produced any of those is not observed** — a sentence is a string the panel drew,
and section 8.2 still applies to whether it is true.

**7.4 `alreadySatisfied` is distinguishable from a refusal here, and from `reapplied` too, only by
its sentence.** L26 printed `browser.reapply.alreadySatisfied`'s text where L25 printed
`browser.reapply.reapplied`'s, which is a real difference on screen; it is not an observation of
`writesAnything` being `false`, and a generic no-op that drew the same sentence would be
indistinguishable.

**7.5 One fixture shape, still, and it is still the easy one.** These eight cases add a `label:`
key, a duplicated trigger, a reordered sequence, a changed anchor and a deleted item to 3b's shape.
They add **nothing else**: plain `replace:` scalars, double-quoted triggers, one leading comment, LF
line endings, no BOM, no block scalars, no item-owned comments, no blank-line runs, no second
sequence, no read-only file, no package. The corpus fixtures `CLAUDE.md` section 4 lists exist
precisely because those shapes behave differently, and **none of them has been put through this
harness**.

**7.6 Every numbered Q7 point has at least one case, and coverage is still bounded.** Point 1's
exact positives, point 2, point 3 in both halves, point 4's removed target, point 5, the three
placement shapes built here, point 7's targetless positive and both anchor failures, and point 8
all have a case and a launch. **That is one case per point, not exhaustion of any point** — and
point 6 is the one where the difference is already visible. What does **not** have a case:

- **`end` after a reorder.** Point 6 names `top`/`end`; of that pair only `top` was built, so the
  remaining `end`-after-reorder variant is unbuilt and point 6 is **not** exhaustively covered — the
  three shapes that do have a case are `top` after a reorder, the resolvable `after` and the changed
  anchor. `moverPlan` presses one placement per launch and would need a third parameter value.
  Handed to **the next construction step**, not to the reading step 3c-2.
- **"and no save command is issued"**, the second clause of point 4. Not observable here at all —
  section 7.0.
- **Point 1's *exercise editor, delete, duplicate, and move*** is carried by 3b's four positives,
  which section 8.6 of that record already says cannot tell an adopted target from a retained one.
  Nothing in this step changes that for the deleter or the duplicator.
- **Q7's closing paragraph** — *across the matrix, read both languages, all new refusal sentences,
  choice ordering, focus/scroll reachability* — is **3c-2's reading**, and only the *runnability* of
  it is what this step delivers.

**7.7 Bilingual coverage is eight of nineteen cases, not the matrix** (section 6). Nothing about
label truth follows in either language anyway; this is a limit on which strings were **rendered at
all**.

**7.8 Two things this step observed and deliberately did not judge.** The `manualResolution` reports
of L27, L30, L34, L35, L36, L37, L38 and L39 and the selection banners of L25, L26, L28 and L29 were
measured at a **negative** `y` — between `-70` and `-111`, and `-104` for both Spanish creator
refusals — which continues the pattern 3b's section 5 recorded in nine of its twenty-three launches,
and **whether that is acceptable is 3c-2's judgement, not this record's**. And the selection-repair
banner said *"what is now in that position is a different snippet, so the selection was cleared"* in
L25, L26, L27, L28 and L29, where L24's said *"the snippet you had selected was found again"*: the
five are the launches whose R1 changed or moved the target's own bytes. That is an observation about
which sentence was drawn, **not** a defect claim and **not** a diagnosis of the repair rule.

**7.9 The standing `manualResolution` negative-`y` finding is not judged here**, and no reading
record is written by this step. Both are 3c-2's.

## 8. The gates, with the harness in the tree

| Command | Result |
|---|---|
| `npm test` | **1624** passed, 49 files — unmoved |
| `npm run check` | **419** files, 0 errors, 0 warnings — unmoved |
| `npm run build` | **176** modules — unmoved |
| `cargo test --workspace` | **1086** passed, 0 failed — unmoved |
| `cargo fmt --check` | clean |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |

**Every one of the moving numbers stayed still, and that is the expected shape here.** 1624 and 419
are 3b's numbers because `src/probe.ts` was already a case of `scripts/lint/ipc-detail.test.ts`'s
`it.each` sweep and already a file `svelte-check` walks — this step **edited** that file rather than
adding one. **176 is 3b's module count** because no source module was added; the regression
`CLAUDE.md` section 6 warns about is a jump toward ~180 with Svelte's server build in the bundle, and
that is a different shape entirely. `cargo test --workspace` does not move because no Rust source
changed at all. **An unmoved count is evidence of an unmoved count and of nothing broader**, and
**no gate transcript was retained**.

The build order section 6.1 of the 3b record insists on was followed after **each** driver edit and
before the first launch depending on it: `npm run build`, then `touch src-tauri/build.rs`, then
`cargo build -p espansoconfig --features custom-protocol`. L24 was launched **before** the first of
those rebuilds, against the binary 3b left, which is what makes it a smoke test of the machine
rather than of this step's edits. **L24–L34 ran against the 300-character driver and L35–L39 against
the 1500-character one**, which is the only behavioural difference between the two groups and is
confined to how much of a status block a transcript keeps.

No git command that changes anything was run.
