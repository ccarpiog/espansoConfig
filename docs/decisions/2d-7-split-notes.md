# Phase 2d-7 — the design consult, and the ten-step split it rules

**Status:** the record of a design decision, taken before any line of 2d-7 exists. It changes no
source file and no other document. `docs/reviews/phase-2d-7-design.md` is the consult itself and is
the authority for *what* 2d-7 builds, except where §5.8–§5.17 below narrow it; this file is this
project's own restatement of it as binding rulings, the step plan, the open-items map and the
citation audit the house rule owes. Its shape is [`2d-6-split-notes.md`](2d-6-split-notes.md)'s.

---

## 1. What the consult was, and what it does not cover

- **Provider and effort:** a Claude Opus agent, dispatched 2026-09-23 by the orchestrator, because
  Codex is out of quota until 2026-09-26 19:14 (`PROGRESS.md` *Next action*, item 2). It says it
  is an independent consultant that wrote none of the code, the brief or the records it rules on
  (`phase-2d-7-design.md:3-4`). **It is not the second provider on this material.** The 2d-6
  consult was Codex's, while every 2d-6 step review since 9b-2 was run by the fallback agent. So the
  prior this consult shares is the fallback agent's. That is a reason for §5's narrowings, not for
  distrust.
- **The brief** is [`2d-7-design-brief.md`](2d-7-design-brief.md): 400 lines and twelve questions,
  Q1–Q12, with its own coverage bounds in §8. It takes no position on any question it asks. Its
  §5.7 sort is offered to be overturned (§8 item 5).
- **The reply** is [`phase-2d-7-design.md`](../reviews/phase-2d-7-design.md), 788 lines. It gives a
  provider header and an inputs list (lines 1-22), a `## VERDICT` (24-46), and then Q1–Q12 under
  `###` headings (48-585), each opening with a **Ruling:** line. It closes with its corrections to
  the brief (589-623), a handed-on map (625-642), risks (644-669) and the step cut (673-788).
- **What the consult ran:** no gate and no launch, as the brief required. It took `cargo fmt
  --check`'s failure from the brief and says so (`:20-22`). It did not open the real corpus.

**What this record ran:** `cargo fmt --check`, piped to `rg '^Diff in'`. It found **ten hunks, all in
`src-tauri/src/probe.rs`, starting at lines 844, 855, 865, 874, 903, 927, 944, 951, 959 and 966**.
The exit status seen is `rg`'s, so the failure is established by the ten `Diff in` lines, not by a
status. Beyond that it ran `git diff --stat` and `git diff` over the two hook files, and `rg`, `sed`,
`wc` and `ls` reads. **It ran no other gate, no `npm` command and no launch, and it opened no
real-config file.** Every count in §4 and §7 is a reading made with `rg`, `sed` or `ls` on
2026-09-23, not a compiled figure.

Four bounds, stated because each could be assumed:

1. **A design consult is not a review round.** Nothing here is a finding or has a severity. The
   review policy is `CLAUDE.md` §7's: one adversarial review per phase, blockers fixed, verification
   re-run, the phase closes; a fix is not owed a review.
2. **No claim here is about what a window does.** Neither the consult nor this record opened one.
   Where §2 assigns a reading, it states an obligation. It is never evidence.
3. **The tree read was `main` at `55fb75d`**, with the four uncommitted instrument paths, the
   modified `PROGRESS.json`, and the untracked brief and consult. Every `main.rs` line cited here or
   in the consult was read on that **working tree**. At `HEAD` every `main.rs` line after 166 is one
   lower, because the hook adds `mod probe;` at line 166. §4 is a snapshot with a date on it.
4. **Re-deriving a citation is not validating a design.** A line that resolves proves that the
   consult read what it named. Only 2d-7-3 and 2d-7-4, run against a compiler and a webview, can
   test the Tauri-side mechanisms it proposes (§3 entries 11–15).

---

## 2. The ten-step split, restated

The consult's step cut (`phase-2d-7-design.md:673-788`) is kept at **ten steps, in its order and with
its numbering**. Each step below restates the consult's version and adds the narrowings of §5. Each
step is **one autoclaude phase**, with one worker and **one adversarial review** (§3 entry 35).

Every step owes the machine-checkable gate set of `CLAUDE.md` §4. **From 2d-7-3 on, that set exits 0
with the instrument present**, `cargo fmt --check` included (entry 4). The following constraints
bind every worker brief, and each brief says them in so many words:

- never run `git stash`, `git checkout`, `git restore` or `git reset` on any path;
- stage by path, and never stage `src-tauri/src/` as a directory;
- the hook diff stays `5 insertions(+), 1 deletion(-)`;
- no real corpus;
- every launch goes to a fresh bundle path, with its language set through the picker.

Two terms are used in every step below:

- **Risk class** is the workflow's (`~/.claude/scripts/autoclaude-base.md`, *Phase selection* item
  3): `high` or `routine`.
- **Driven** means the step can run in an unattended `autoclaude-until-done` iteration whose screen
  may be locked.

**Cutting a step.** A step the orchestrator judges too large when it selects it may be cut before it
starts. The pieces take a numeric suffix (`2d-7-6-1`, `2d-7-6-2`) and never a letter. The cut is
recorded as a dated addendum under that step in this section, the way 2d-6's record kept its
"orchestrator's cut" subsections. **A step is never cut after its review to hold a fix** (§3 entry
31).

**2d-7-4 may be cut only at one boundary, and the instrument review stays single.** If the
orchestrator cuts 2d-7-4 before it starts, the cut is at "harness and tools" against "page side and
shakedowns":
- **`2d-7-4-1`** delivers `launch-7.sh`, the writers, the fixture import and the input tool, under the
  harness root. Its review is its own phase review of that content. **It is not the instrument
  review**, and a finding about the probe files is written down as an open item for `2d-7-4-2`.
- **`2d-7-4-2`** delivers everything else in 2d-7-4 and runs the five shakedowns. **Its review is the
  instrument review.** It covers the whole instrument, `2d-7-4-1`'s harness included, against the
  entry-7 checklist.

The first piece's review reviews different content, so neither review re-reviews the other (§3
entries 6, 35). No other cut of 2d-7-4 is permitted.

### 2d-7-1 — the `stale` ruling and its fix

**Delivers** a written ruling, in the step's notes, on what `stale` means while a write surface is
open, and the model fix that follows from it. The ruling covers two items: 11a §5 item 1 (a `stale`
mark survives a `writtenHere` release) and 9b-3 §6 item 1 (a hold begun while an automatic read is
out, with a successful re-adoption, leaves `stale` with nothing to acknowledge).

**The ruling must first decide provenance.** The `stale` status carries no cause today: "**It does not
say which**" (`observationTransitions.ts:130-140`). The consult's acceptance — clear a mark "that only
the released reading set" and leave one "from another cause" — assumes a distinction the type cannot
yet express (§5.9).

**Touches** `src/lib/browser/observationTransitions.ts`, `src/lib/browser/workspace.svelte.ts`, and
their model and mounted tests. Each is staged by name.

**Acceptance:**
- The ruling is written, and it says how a mark's cause is known: a new field, a registry question,
  or a stated decision to clear without knowing.
- A model test for the `writtenHere` release passes, and it was shown failing first on the unfixed
  tree.
- A second model test covers 9b-3 §6 item 1: the file ends either acknowledgeable or not `stale`, as
  the ruling says.
- Where the ruling keeps a mark standing, a test pins that it stands.
- The gate set passes, and the module-count delta is explained.

**If the ruling cannot be made without 9b-3 §6 items 2–3**, 2d-7-1 records that and fixes nothing
beyond what the ruling needs. G4's stale-under-hold rows are then named unread, and the ruling goes to
a later phase (consult `:660-662`).

**Risk `high`**: this is the model semantics that every later reading records. **Driven:** yes.
**Depends on** nothing. **Bound by** entries 27, 28.

### 2d-7-2 — the presentation and comment fixes, and the ES mounted cases

**Delivers:**
- a distinct disabled style on the status control (9c §6 item 1);
- ES row marks that keep a file name whole (9c §6 item 2);
- the `SourceText` `.invisible` marker no longer wrapping inside a file line, or else its comment
  corrected so it no longer claims that it does not (8c §4 item 1);
- the false caller claim at `matchEditor.ts:2664-2665` removed (11b §6 item 8);
- ES mounted cases for `AppShell`'s last-document removal and for the save-origin adoption loops in
  `MatchEditor`/`MatchCreator` (11a §5 item 4).

**Touches** `SourceText.svelte`, the status-control component(s), the row-mark stylesheet,
`matchEditor.ts`, and the mounted suites. Each is staged by name.

**Acceptance:**
- `rg -n tSupersededEvidence src/lib/browser/matchEditor.ts` shows no renderer claim.
- Each of the three visual fixes has a stylesheet or mounted assertion.
- The new ES cases pass.
- The gate set passes, with the Vite module delta explained per file.

**No window claim is made**; 2d-7-9 confirms each fix by eye.

**Risk `routine`**. **Driven:** yes. **Depends on** nothing. **Bound by** entries 28, 29.

### 2d-7-3 — the instrument, Rust side

**Before changing anything**, the step copies the pre-step `probe.rs` to
`/private/tmp/2d7-3-probe.rs.orig`, so its review has a diff (entry 3).

**Delivers:**
- `rustfmt --edition 2021 src-tauri/src/probe.rs`, on that file only;
- true header counts;
- the command-parity test and `const PROBE_COMMANDS` (entry 8);
- the dispatch tally and `probe_tally` (entry 11);
- the read-only `probe_witness` (entry 12);
- the wake-emit tally, installed from `on_page_load` (entry 13);
- the snapshot request token (entry 10);
- the `shots` confinement, and `probe_lock_other` changed to act through an `O_NOFOLLOW` descriptor —
  the fifth and sixth rebindings, closed or disclosed (entry 9).

**Touches** `src-tauri/src/probe.rs` only, which stays uncommitted. **Its commit carries records
only.**

**Acceptance:**
- `cargo fmt --check` and `cargo clippy --workspace --all-targets -- -D warnings` exit 0 with the
  instrument present.
- The parity test passes, and is shown failing once with one command removed from either list.
- `rg -n "save_document|replace_file_atomically|replace_locked_file|run_one_save|begin_commit" src-tauri/src/probe.rs | rg -v '^[0-9]+:\s*//'`
  finds nothing. The check reads **code lines only**. On today's tree its one hit is the safety doc
  comment at `probe.rs:56`, which states that `save_document` stays the only writer. **That comment
  is kept; the check never requires deleting or rewording a comment.** A name inside a trailing
  comment on a code line still counts as a hit, and the worker explains it or removes the code.
- `rg -c "\.setup\(" src-tauri/src/probe.rs` finds nothing.
- The Rust test-count delta equals the tests added.
- The hook diff is still 5/1.

**Its review covers this step's Rust diff against the `.orig` copy. It is not the instrument
review**, and a page-side finding it raises is written down as an open item for 2d-7-4.

**Risk `high`**: it is instrument code beside the save path, and the Tauri mechanisms it uses are
unproven. **Driven:** yes. **Depends on** nothing in 2d-7-1 and 2d-7-2; it is ordered after them.
**Bound by** entries 2–5, 8–13.

### 2d-7-4 — the instrument, page side and harness, and THE instrument review

**Before changing anything**, the step copies the pre-step `probe.ts` to
`/private/tmp/2d7-4-probe.ts.orig`. This is also the consult's pre-prune reference copy, which the
consult named `2d7-probe.ts.orig` (§5.14).

**Delivers:**
- `PROBE_OWN_COMMANDS` checked against Rust at run time;
- the event spy (entry 14);
- `--- tally` checkpoints, and the reconciliation lines (entry 15);
- the heartbeat;
- keep-alive as an explicit plan flag;
- the recorder-ordering check (§5.11);
- the cases no step names, pruned;
- selectors that name fields, which answers the 9c `SourceText` artifact.

Under the harness root it delivers `launch-7.sh`, with:
- a per-launch bundle identifier;
- window-only captures;
- a lock-state preflight line;
- script-side writers for `config/` and for bursts;
- a fixture import that checks SHA-256.

It also builds, under `tools/`, the synthesized-input tool that 2d-7-9 will use (entry 20). **That
tool is built and reviewed here, and not exercised on a real window here.**

**Evidence:** the five shakedown controls of consult Q2 item 11, as transcripts, plus the checklist
in entry 7.

**Touches** `src/probe.ts` (uncommitted) and the harness tree outside the repository. **Its commit
carries records only.**

**Acceptance:**
- Every entry-7 checklist item is shown with its command and its observed output.
- The SHA-256 of the four instrument paths, `launch-7.sh` and `tools/*` is recorded in the notes.
- The reviewed set is copied to `/private/tmp/2d7-instrument-reviewed/`.
- The baselines are re-derived against a pristine `git archive HEAD` copy.

**Its review is the instrument review, and there is exactly one** (entry 6).

**Risk `high`**. **Driven:** yes. The shakedowns need no visible window, and a locked screen is
recorded as such. **Depends on** 2d-7-3. **Bound by** entries 2–7, 14–16, 19, 20, 34.

#### Addendum 2026-09-23 — the orchestrator's cut

2d-7-4 is cut before it starts, at the one boundary the cutting rule above permits:
- **`2d-7-4-1`**: `launch-7.sh` and its writers and fixture import under the harness root, and the
  synthesized-input tool under `tools/` (built, not exercised on a real window). It does not touch
  `src/probe.ts` or `src-tauri/src/probe.rs`. Its review is its own and **not** the instrument
  review; a finding about the probe files becomes an open item for `2d-7-4-2`.
- **`2d-7-4-2`**: everything else in 2d-7-4 (the `/private/tmp/2d7-4-probe.ts.orig` copy, the page
  side, the five shakedowns, the entry-7 checklist, the hashes, the reviewed-set copy and the
  baselines). **Its review is the instrument review**, over the whole instrument including
  `2d-7-4-1`'s harness.

Reason: the whole step is a page-side rewrite, a harness, a native input tool, five shakedown launches
and the one instrument review, which is more than one worker finishes coherently.

### 2d-7-5 — G1: delivery, watcher and counters

**Records only.** The instrument is frozen. The step prints its four hashes, and **refuses to read**
if any of them differs from 2d-7-4's.

**Reads:**
- both roots, through the script writer on `match/conflict.yml` and on `config/default.yml`;
- a burst, as three writes 60 ms apart, against a control of two writes 600 ms apart;
- self-save suppression;
- the raw view refreshing automatically;
- add and remove, through the probe writers and the script under `config/`;
- workspace reopen with a late old callback, under `delay`;
- emits against deliveries at every checkpoint;
- the watermark's advance.

**Acceptance:** one line per G1 row, each with its tallies, its witness and its class (entry 17).
- Emits equal deliveries, or each difference is written down as an application fact (entry 15).
- No launch has a Rust/page command mismatch, or each one that does is voided and re-run.
- Each window statement carries the three visibility conditions, or is named unread (entry 18).

**Risk `high`**: this is item 7's central "overwrite neither side" claim. **Driven:** yes. **Depends
on** 2d-7-1 and 2d-7-4. **Bound by** entries 15–19, 23, 24.

### 2d-7-6 — G2 and G3: retention, conflict timing, choices and adoption arms

**Records only.** Reads:
- the eight surfaces' retention;
- disabled-state timing (under `delay`) and enabled-state timing;
- the locale switch per family;
- compare, keep, reload and recovery per family;
- copy by `click()`, recorded as whatever it reads;
- the reload's `installed` arm;
- `alreadyThere` and `refused` under `delay`, or named unread;
- the open-surface refusal, which counts as reached **only** if a transcript shows `competing≥1`
  (§5.8).

Committed-but-reprojection-failed is named unreachable up front.

**Acceptance:**
- All eight surfaces retain their values with `writes=0` and an unchanged witness.
- Each choice is read on each family.
- Each adoption arm is classed.
- EN is covered in full, and ES covers each distinct sentence these panels draw.

**Risk `high`**: the held and constructed classifications are subtle, and the matrix is the longest
here. **Driven:** yes. If the orchestrator judges it too large, it cuts it into `2d-7-6-1` (G2) and
`2d-7-6-2` (G3) **before** it starts (the cutting rule above). **Depends on** 2d-7-5. **Bound by**
entries 15–18, 23, 25.

### 2d-7-7 — R38: the fifteen fixtures

**Records only.** Each of the fifteen `CLAUDE.md` §4 fixtures is:
- copied byte-exact from `crates/espansoconfig-core/tests/corpus/synthetic/`;
- placed as `match/conflict.yml`;
- drawn in the raw **viewer**;
- given one external change, written by the script as a byte-level edit that keeps the fixture's line
  endings, BOM and final-newline state;
- drawn on one conflict panel, or on the viewer's refresh where no match projects;
- witnessed.

`config/default.yml` gets a CRLF+BOM synthetic config with neutral content. Three fixtures are also
read in ES: `crlf-line-endings.yml`, `unicode-offsets.yml` and `file-comments-and-mixed-endings.yml`.

**Acceptance:**
- For each fixture, four SHA-256 values: source, copy, launch-before and launch-after. The first two
  are equal, and a mismatch voids the launch.
- The viewer's text is compared verbatim against the bytes, out of the app.
- Each fixture has its panel or refresh line and `writes=0`.
- Each fixture's record says what it was drawn in.

**Risk `routine`**. **Driven:** yes. **Depends on** 2d-7-4. **Bound by** entries 22, 34.

### 2d-7-8 — G4: the status states left unread by 9c

**Records only, after 2d-7-1.** Each G4 row (consult `:434-452`) is classed reached, held,
constructed or unread, with its launch and tallies. `noTransport` is classed constructed (by
`listenRefused`) or unread. The 9b-1 §8.3 sequence is named unreachable, with 9b-1's own judgement
cited.

**Acceptance:** every G4 row appears exactly once with its class.

**Risk `routine`**. **Driven:** yes. **Depends on** 2d-7-1 and 2d-7-4. **Bound by** entries 17, 23.

### 2d-7-9 — the owner-present visible session (G5)

**Records only. It needs the owner at an unlocked screen, and Accessibility permission granted by the
owner to the input tool.** No keep-alive and no substitution may be used (entries 17, 18). It reads:
- **the foreground case.** The window is occluded for more than 10 s until the beats stop, and the
  owner then clicks the Dock icon. The record answers whether `focus` and `visibilitychange` arrive,
  whether they arrive in one task, what drains follow (with the Rust tally), and whether the beats
  resume.
- Tab and default activation, and pointer hit-testing, each with `isTrusted` printed.
- *Copy my text*, pressed by the owner and pasted into TextEdit, with the owner confirming the text.
- ⌘Q, with `pagehide` and `unload` observed.
- the visual judgements, in EN and ES at a stated window size: the C1 fold on each family; the fixed
  disabled status control; the `SourceText` marker; the ES row mark; the close and keep labels.
- one visible re-take per family, compared against its hidden twin.

**Acceptance:**
- The three visibility conditions are printed at each claim.
- Every G5 row is answered, or named unread with its reason.
- Each owner statement is recorded as the owner's.
- Captures are `-l` window captures only.

**Risk `high`**: the owner's time cannot be replayed, and it is the only real-input evidence.
**Driven: no.** A driven run stops here BLOCKED (entry 21). **Depends on** 2d-7-2 and 2d-7-4. It
may be taken earlier than 2d-7-5 … 2d-7-8 in an interactive session if the owner is present; a
driven run never selects it. **Bound by** entries 18, 20, 21, 25, 26.

### 2d-7-10 — the consolidation

**Records only.** Writes:
- the 2d-7 matrix: every item-7 clause, every row of consolidated §5.1 and §5.2, and every G row,
  each exactly once, with its class and its launch;
- the ES sentence inventory (key, drawn text, launch) that R35's review would need;
- the 2d-8 deletion manifest and the carried-forward list (entry 32).

It also corrects two documents:
- consolidated §5.4's pre-edit-copies row, which is to name the full list and 2d-8;
- `CLAUDE.md` §6's `save_document` location, from `persist/write.rs` to `persist/save.rs` (§5.5).

**Acceptance:**
- The four gates are re-measured, with the instrument's share re-derived from a pristine
  `git archive HEAD` copy.
- Every manifest entry is shown to exist with `ls`.
- Every *constructed* and *unread* row is carried forward.

**Risk `routine`**. **Driven:** yes, **but only once 2d-7-9 has closed** or the owner has ruled its
rows recorded unread (entry 21). **Depends on** 2d-7-1 … 2d-7-9. **Bound by** entries 5, 32, 33, 36.

---

## 3. The binding rulings

One entry per ruling that constrains later work. Each says what it forces **and, in the same
sentence or the next, what it does not**, because a record claiming a guarantee the code does not
give is this project's worst defect class. The question each answers is in brackets. "The consult"
is `phase-2d-7-design.md`.

**The instrument, its custody and its review**

1. **Adopt, prune and repair the existing instrument; do not rebuild it from nothing** [Q1]. The
   2d-7 matrix is largely the 2d-6 cases re-run against counters. The kernel is reviewed hard; the
   cases no step names are pruned. This overrides `phase-2d-design.md:130`'s "rebuild the removed
   harness only after its own review" (§5.2). What survives into readings is the pruned and reviewed
   instrument; **a prune cannot show that what remains is correct**, and only 2d-7-4's checklist and
   shakedowns examine that.

2. **The instrument stays uncommitted through the whole of 2d-7, and `CLAUDE.md` §6's
   never-commit rule is unchanged** [Q1]. Committing the hook would register twelve probe commands
   and link the raw Objective-C snapshot code in every normal build, guarded only by an environment
   variable (`probe.rs:284-288`, `:730-732`). That is a change to the shipped surface. Concretely:
   - 2d-7-3 and 2d-7-4 change only the two untracked probe files and the harness outside the repo, so
     **their commits contain records only**.
   - Every commit is staged by path, never `src-tauri/src/` as a directory.
   - All instrument code goes into `probe.rs` or `probe.ts`. **No fifth instrument path may appear
     under `src/` or `src-tauri/src/`**, so `AUTOCLAUDE_PREFLIGHT_DIRTY` keeps naming the same four.
   - The hook diff stays `5 insertions(+), 1 deletion(-)`.
   - `git stash`, `checkout`, `restore` and `reset` are never run.

   **Nothing in git enforces any of this.** The driver's preflight names the dirty paths; the rest is
   discipline that every worker brief states.

3. **Provenance comes from copies and hashes, because git has none** [Q1, amended]. Three things
   replace the missing history:
   - **Before diff.** 2d-7-3 and 2d-7-4 each copy their pre-step file to `/private/tmp/2d7-3-probe.rs.orig`
     and `/private/tmp/2d7-4-probe.ts.orig`, so each step's review has a before to diff against. An
     untracked file has no `git diff`.
   - **Hashes.** At 2d-7-4's close, its notes record the SHA-256 of the four instrument paths,
     `launch-7.sh` and `tools/*`. The reviewed set is copied to
     `/private/tmp/2d7-instrument-reviewed/`, so a lost working tree does not force a new review.
   - **Refusal on mismatch.** Every reading step prints the four hashes and refuses to read on a
     mismatch.

   A matching hash proves that the bytes are the reviewed bytes, **not that the review was right**.

4. **`probe.rs` is formatted in 2d-7-3, with `rustfmt` on that file only** [Q1]. From then on,
   `cargo fmt --check` exits 0 with the instrument present. A red gate kept for all of 2d-7 is how a
   real regression would hide. The ten hunks were re-measured for this record (§1).

5. **Baselines are normalised by subtraction from a pristine `git archive HEAD` copy, and each step
   reports both figures** [Q1, Q11]. The instrument's Rust share becomes non-zero at 2d-7-3, when
   its `#[cfg(test)]` tests start running under `cargo test` in this tree. **Those tests run only
   where the instrument is present**, so the committed tree's figures never include them. The share
   is re-derived at 2d-7-4 and at 2d-7-10. The rung in force is `PROGRESS.md:233`.

6. **The instrument review is 2d-7-4's one review** [Q2]. It covers the whole instrument: both probe
   files, the hooks, `launch-7.sh`, `tools/` and the fixtures.
   - Its reviewer is the workflow's: the fallback agent until Codex returns.
   - It runs once. Its blockers are fixed, the shakedowns are re-run, and the step closes. **A fix is
     not reviewed.**
   - Its acceptance is entry 7's list. A finding outside the list is written into 2d-7-4's notes as
     an open item.
   - The instrument record is a table of checks, each with its command and its output. **It carries
     no narrative of review rounds**, which is 2c-5-5a's failure mechanism
     (`2c-5-5a-instrument-rebuild.md` §16.1).
   - **Blocker fixes that overflow one worker session stay inside 2d-7-4.** No later step changes the
     instrument. 2d-7-5 … 2d-7-9 are records only, over the frozen set, and refuse to read on a hash
     mismatch (entry 3). If the fixes cannot be finished in the session:
     - the phase ends with its verified work committed as records only;
     - its row stays `in_progress` / `awaiting fixes`;
     - the next session resumes 2d-7-4's fix work, deepening the prune if that is what the blockers
       need, under the same review's findings;
     - that session **does not commission a second review** (`CLAUDE.md` §7).

     **The reviewed set** (`/private/tmp/2d7-instrument-reviewed/` and the hashes in the notes) **is
     written only when 2d-7-4 closes**, after the last fix and the re-run shakedowns. It therefore
     never holds bytes that predate the fixes, or bytes changed after them.

     Needing more than one session is recorded in the notes as evidence that the prune was too
     shallow.

   2d-7-3's review is that step's own, and is not the instrument review.

7. **The instrument-review checklist** [Q2] is the consult's eleven items (`:109-170`), with three
   additions from this record:
   - **12. Recorder ordering** (§5.11). At the first checkpoint the Rust tally and the page recorder
     must agree by name. A Rust surplus there means some module imported ahead of `./probe` issued a
     command before `probe.ts` evaluated. Those modules are `App.svelte`'s graph and `main.ts:15-19`'s
     imports. The check is the reconciliation line; TypeScript cannot
     force module-evaluation order.
   - **13. The input tool** (entry 20). Its source is read. It posts to one window id and nothing
     else, and a dry run against a locked screen refuses cleanly.
   - **14. The pre-step copies and hashes** of entry 3 exist and match what the notes say.

   Every item is checked by `rg`, by a test, or by a shakedown transcript. None is checked by prose.

8. **Command parity is a `#[cfg(test)]` test in `probe.rs`** [Q2 item 1]. It reads `main.rs` and
   `probe.rs` with `include_str!`, extracts the paths in both `generate_handler!` lists
   (`main.rs:243-261` and `probe.rs:213-243` on the working tree), and requires the application half
   to match.
   - The two lists spell paths differently: `commands::…` in one, `crate::commands::…` in the other.
     The test strips `crate::` before comparing, and says so.
   - A `const PROBE_COMMANDS` must equal the probe half of the macro.
   - The test cannot see a command registered by any other mechanism. It exists only while the
     instrument does.

9. **Confinement: the four rebindings stay open and accepted in their present words (`probe.rs:41-54`);
   two further rebindings are closed or disclosed as the fifth and sixth, never folded into "four"**
   [Q2 item 4].
   - **The fifth.** `probe_lock_other` canonicalizes the target, then calls `set_permissions` by
     pathname (`:929-930`), and `chmod` follows a symlink planted at the final component in the
     meantime. Opening with `O_NOFOLLOW` and calling `File::set_permissions` closes the
     final-component case. **It does not close a directory above the target being rebound**, which
     stays in rebinding three's class.
   - **The sixth.** `probe_snapshot` joins `shots` onto the canonical launch directory without
     checking it (`:751`). The fix canonicalizes `shots` and requires it to be `<launch>/shots`, or
     else restates the claim at `:713-714`.

10. **Snapshot attribution uses a request token** [Q2 item 5]. The completion handler reads the
    global `SNAPSHOT_PATH` *when it completes* (`probe.rs:647`), not when the request was made. A
    keep-alive request already in flight when `shot()` sets its path (`probe.ts:4046-4057` against
    `:2194-2207`) therefore writes its image to the shot's path and sets `written`. The fix carries
    a monotonic token into the state (`written#<n>`), and `shot()` requires it to match. **Every
    2d-6 `webview=written` line is thereby weaker than it read.** The image on disk was probably
    re-written by the shot's own completion later. The line itself is not proof of which request it
    reports (§5.10).

**Counters, witness and spy**

11. **The Rust counter counts application command dispatches by name, in `probe.rs`, by wrapping the
    handler `register_with_probe` already installs** [Q3]. `invoke_handler` is a plain replacing
    setter (`app.rs:1658-1662`); `Invoke.message` is public (`ipc/mod.rs:213`); `command()` exists
    (`:543`).
    - Probe commands are tallied separately, so `pause`'s `probe_plan` trips cannot drown the count.
    - The six write commands are those at `main.rs:205-208`.
    - **No counter goes in `commands.rs`, in `run_one_save`, in `commit_and_record` or in the core.**
      `commit_and_record` takes the non-reentrant ledger gate (`commands.rs:1934-1941`).
    - The wrapper calls `inner(invoke)` exactly once.

    **Rust forces none of this.** The type system would let the wrapper call anything in the crate.
    The `rg` check in 2d-7-3's acceptance is a review check, not a guarantee.

12. **The file witness (`probe_witness`) is read-only** [Q3]. It uses `symlink_metadata` over
    `<launch>/xdg`, the launch's backup root and `<launch>/home`, and reports each entry's relative
    path, inode, size, `mtime` and `ctime` in nanoseconds, **and the SHA-256 of each regular file's
    bytes**. It computes the hash by opening the file **read-only**, through `O_NOFOLLOW`, so the hash
    covers the entry that `symlink_metadata` described and not a link target. It never opens a file
    for writing.

    Comparing two witnesses sorts each file as follows:
    - **No write:** the inode, `ctime` and hash are unchanged.
    - **Identical write:** a new inode with the same size and the same hash, because a commit
      renames.
    - **Transient write:** a changed inode or `ctime`, with the same hash at the later witness.
    - **Changed:** a different hash.

    **The witness is taken at checkpoints, not continuously**, so it cannot see a file that was
    written and then restored to its old inode and `ctime` between two witnesses. It sees no content
    it did not hash: an unreadable file is reported as `unhashed` with its metadata.

    **It sees nothing outside those three trees**, and the record says so wherever it is cited.

13. **The wake-emit tally wraps `events::wake_emitter` and is installed through
    `install_wake_emitter` from `Builder::on_page_load`, guarded by a `OnceLock`; never from
    `.setup`** [Q3]. `setup` is a replacing setter (`app.rs:1773-1779`), so a probe `.setup` would
    silently discard `register`'s own emitter installation (`main.rs:236-241`). `on_page_load` is
    also a replacing setter (`app.rs:1783-1789`), and nothing in `src-tauri/src/` sets it today.
    **The installation happens on the first `on_page_load` callback of any kind** — `Started` included,
    never filtered to `Finished` — so it precedes any script the page runs. The order of those
    callbacks on macOS was not checked here; the spy control of 2d-7-4 is what shows the installation
    in place before the listener registers.
    **Narrowing:** an emit before the first page-load callback goes through the uncounted production
    emitter. The tally therefore counts emits **from installation on**. No page listener exists
    before that point, so no delivery can be missed by it (§5.12).

14. **The event spy wraps the listener's entry in `window.__TAURI_INTERNALS__.callbacks`, keyed by the
    `handler` id in the `plugin:event|listen` request body** [Q4]. The mechanism:
    - `callbacks` is a mutable `Map` (`core.js:22`, published at `:64-66`).
    - Every event delivery runs `runCallback(listener.handlerId, …)` (`event/mod.rs:224-236`), which
      is `callbacks.get(id)` (`core.js:39-41`).
    - The consult left the argument name unverified. **This record verified it:**
      `@tauri-apps/api` 2.11.1 sends `handler: transformCallback(handler)` (`event.js:76-79`).
    - The wrap happens synchronously when the recorder parses the body (`probe.ts:560`), before
      the request is issued.
    - If `callbacks` is not a `Map`, the launch prints `--- spy unavailable`, and every delivery
      claim in it is void.

    The property is documented "just for the debugging purposes" (`core.js:63`), so **the spy holds
    for the pinned 2.11.5/2.11.1 only**.

15. **Rust and page tallies are reconciled by name at every checkpoint** [Q4].

    **The comparison has two halves**, because the page never records a name in `PROBE_OWN_COMMANDS`
    (`probe.ts:554-556`) while Rust tallies probe commands separately (entry 11).

    **Application half:** Rust's application tally is compared by name against the page's recorded
    commands, excluding every name in Rust's `PROBE_COMMANDS`.
    - **Equal:** the transport was seen whole.
    - **Rust > page:** the launch is instrument-void and is re-run. The cause is a command sent
      outside `fetch` (the `postMessage` fallback), or the ordering gap of entry 7 item 12.
    - **Page > Rust:** allowed only for `plugin:event|*`, which the application handler never
      dispatches, or for a substitution that was never issued. Anything else is void.

    **Probe half:** this is a list check, not a count check.
    - Any recorded page name that is in `PROBE_COMMANDS` is instrument-void. It means a probe name is
      missing from `PROBE_OWN_COMMANDS`, so the page recorded probe traffic as if it were
      application traffic, which would show as **page > Rust**, not the reverse.
    - The run-time `--- instrument MISMATCH` line of entry 7 (consult item 2) catches the same drift
      before any checkpoint.
    - Rust's probe tally is printed, and is never compared with the page, which does not record it.

    For events:
    - **emitted = delivered:** delivery was observed.
    - **emitted > delivered:** an **application fact**, written down, never a failure of the reading.
    - **delivered > emitted:** impossible, so void.

16. **"Command count zero on every no-write path" means the following** [Q4]:
    - **Commands:** none of the six write commands is dispatched.
    - **Files:** the witness shows every file unchanged, except those a probe or script writer
      changed. Each of those equals the witness taken just after that writer returned.
    - **Window of time:** from the checkpoint before the path's first action until the transport has
      been quiet for `IPC_QUIET_MS` (`probe.ts:216`) **and** at least 2 s have passed.
    - **Paths:** those listed at consult `:270-281`.
    - Each path's line reads `writes=0 witness=unchanged(except …)`.

17. **Substitutions: three classes** [Q5].
    - ***Reached*** means real disk and real answers.
    - ***Held*** means a `delay` substitution only: real bytes and a real answer, with the timing
      chosen by the probe.
    - ***Constructed*** means any substitution that changes an answer's content: `mayHaveWritten`,
      `listenRefused`, `epochZero` or `discardOnce`.

    A constructed state is **never credited as reached**. Under item 7's last sentence it is named
    "unreachable by the disk, drawn from a substituted answer". 9c's wording stands: "the cause of
    that state is the probe's, never the disk's" (`probe.ts:600-601`).

    Two restrictions follow. A plan that makes a no-write claim may arm only `delay`. **No
    substitution is armed in 2d-7-9**, because the owner reads a window, not a transcript.

**Visibility, the owner and the driven stop**

18. **"Visible" means three conditions at once, at the moment of the claim** [Q6]:
    - `CGSSessionScreenIsLocked` is absent or false;
    - a `screencapture -l <window>` succeeds and is not the lock screen;
    - the transcript shows `visibility=visible` (`probe.ts:4940-4941`), plus `hasFocus()` where focus
      is the claim.

    How each step applies it:
    - A driven reading step checks the lock first. If the screen is locked, it runs its hidden half,
      **names every visual claim unread**, and does not stop the phase.
    - **The keep-alive is forbidden in a visible launch**, because its snapshot every second defeats
      the very occlusion stop the foreground reading must see (`probe.ts:4035-4043`). It is allowed
      in a hidden launch and disclosed there.
    - Steps 2d-7-5 … 2d-7-8 are item-7 readings, **not ruling-38 regression readings** (§5.3).

    A person's eyes are required only for visual judgements, which are 2d-7-9's.

19. **A launch with no terminal line makes no claim at all** [Q6]. Its last `--- beat` and its
    `alive-at-kill` value are recorded as a host event, and it is re-run under a new launch name.
    Nothing obliges 2d-7 to explain `P8-09` or `P9-06`.

20. **Synthesized input is 2d-7-9's alone** [Q6, narrowed]. The consult allows driven steps in an
    unlocked session to post `CGEvent` or System Events input (`:331-340`). This record narrows that.
    - The tool needs Accessibility permission, which **only the owner can grant**.
    - It is built and reviewed in 2d-7-4, and first exercised in 2d-7-9 with the owner present.
    - Driven steps 2d-7-5 … 2d-7-8 press controls with `click()` and claim nothing about real input.
    - The page prints `event.isTrusted` for every event.
    - Whether a `CGEvent` click grants WebKit user activation is unverified, so **the copy stays the
      owner's own gesture**.

21. **2d-7-9 needs the owner at an unlocked screen, and a driven run stops BLOCKED there. It never
    simulates the session** [Q6, Q11]. When a driven orchestrator reaches phase selection and the
    next step is 2d-7-9, it does what follows.

    **The rows exist first.** `PROGRESS.json` holds a single `"2d-7"` row today (`PROGRESS.json:732`).
    **When this record closes, the orchestrator replaces that row with ten step rows, `2d-7-1` …
    `2d-7-10`**:
    - each titled as in §2 and given the risk class §2 assigns;
    - `2d-7-1` … `2d-7-8` and `2d-7-10` start `queued`;
    - `2d-7-9` also starts `queued`, with the summary "owner-present; never selected by a driven
      run".

    A cut (§2) replaces one step row with its numbered pieces. **Before any driven run selects a 2d-7
    step, these rows exist.** The row marked `blocked` below is `2d-7-9`'s own. Then:
    - It starts no worker for 2d-7-9, runs no launch in 2d-7-9's name, and writes no 2d-7-9 notes.
      A hidden-window run labelled as 2d-7-9 would be exactly the claim entry 18 forbids.
    - It sets the `PROGRESS.json` row for 2d-7-9 to `blocked`, with the summary "needs the owner at
      an unlocked screen".
    - It writes `PROGRESS.md` *Next action*, naming the session's preconditions: owner present,
      screen unlocked, Accessibility granted to the input tool, instrument hashes matching 2d-7-4.
    - It commits that checkpoint, records only, staged by path.
    - It writes `STATUS=BLOCKED`, with a `LINE` that names the need.

    **2d-7-10 does not start.** It consolidates 2d-7-9's rows, and a consolidation written before
    them would have to be rewritten.

    There is one other exit. **If the owner, in the owner's own message, rules 2d-7-9's rows
    recorded unread**, then 2d-7-10 proceeds, carries every G5 row as unread, and cites that ruling.
    A message from an agent is not that ruling.

    2d-7 does not close without one of the two exits.

**Fixtures, states and languages**

22. **R38: all fifteen `CLAUDE.md` §4 fixtures, byte-exact** [Q7]. 7c's shaped-after set is retired,
    except where a writer needs a successor of a hard file.
    - **What closes R38's window half:** each of the fifteen drawn in the raw viewer and on one
      conflict panel (or the viewer's refresh), with `writes=0`, and three in ES.
    - **Bytes:** `tests/corpus_integrity.rs` pins only the committed copies. The harness copies are
      pinned by the four-hash comparison of 2d-7-7.
    - **What may be claimed:** that the text was drawn and matched the bytes.
    - **What may not be claimed:** an edit's byte-exactness over these shapes, sends not made, or
      anything about a raw **editor** over `\r`, which is refused by design.
    - `config/` gets one synthetic CRLF+BOM file. The fifteen are match-file shapes and stay under
      `match/`.

23. **The state list is the consult's G1–G5, and its classes are predictions** [Q8]. The reading
    records what happened. Named **unreachable up front**:
    - committed-but-reprojection-failed;
    - the 9b-1 §8.3 release-path sequence;
    - the claims of "general wake delivery" and "the full native matrix" (`phase-2d-6-design.md:267`).

    **Narrowing:** the open-surface refusal is **not** pre-credited as reached (§5.8).

24. **The harder shapes are produced by script writers, with the script's own timing** [Q8].
    - **Both roots:** no probe writer reaches `config/` (`probe.rs:77`, `:86`, `:864`), so
      `launch-7.sh` writes there.
    - **Burst:** three writes 60 ms apart against two writes 600 ms apart. The reading shows those two
      points only, and **must not claim the 150–300 ms boundary**, which belongs to the engine.
    - **Extra writer:** it writes in place (`probe.rs:877-885`), so the watcher may see a partial
      file. That is a real shape of foreign write, and the reading says so.
    - **Late old callback:** produced under `delay`, classed *held*.

25. **Languages: the full matrix in EN; in ES, every distinct drawn sentence at least once, checked
    verbatim against `es.json` out of the app, plus the locale switch per family** [Q9]. Every visual
    judgement in 2d-7-9 is made in both languages.
    - **2d-7 is a bilingual *reading*, not R35's bilingual *review*.** R35 stays open, owed by the
      owner before Phase 5.
    - 2d-7-10's ES inventory is the input that review needs. **It performs none of the review.**

26. **The close and keep near-synonyms are surfaced to the owner in 2d-7-9 and recorded in the
    owner's words; 2d-7 changes no wording** [Q9, Q10]. The same holds for the C1 fold: it is
    measured at a stated size and never "fixed" in 2d-7. Both rulings go to a later phase.

**Corrective steps and what 2d-7 leaves alone**

27. **The `stale` pair is ruled on and fixed in 2d-7-1, before anything reads `stale`** [Q10]. The
    defect is confirmed on this tree:
    - `markStaleWhileOurs` sets the mark (`observationTransitions.ts:1204-1206`);
    - the `writtenHere` arm deletes the retained reading and delivers, but never clears it
      (`workspace.svelte.ts:4650-4661`);
    - the status has no provenance (`observationTransitions.ts:130-140`).

    The ruling decides provenance first (§5.9). If it needs 9b-3 §6 items 2–3, it says so, fixes only
    what it can, and G4's stale-under-hold rows are named unread.

28. **2d-7-1 and 2d-7-2 are steps the consult created inside 2d-7, with their own acceptance; §7
    permits that** [Q10]. §7 forbids phases created to review a fix, and letter-appended re-review
    phases. It does not forbid a consult cutting its own phase into steps. 2d-6's consult did the
    same.

29. **2d-7-2's scope is exactly the five items named in its entry in §2** [Q10]. The false caller
    claim at `matchEditor.ts:2664-2665` is taken now because it is a live instance of `CLAUDE.md`
    §5's worst class. The EN-only mounted cases are taken because a window is not ES evidence for a
    mounted gap.

30. **2d-7 leaves these alone** [Q10]:
    - the refusal wording repeats;
    - the unused accessors;
    - the composition-check blind spots;
    - `dispose()` on window close (it only *observes* `pagehide`/`unload`);
    - the `acknowledgeSnapshot` dead end;
    - the CRLF-only disk text;
    - the fold;
    - the labels;
    - 9b-3 §6 items 2–3, unless 2d-7-1 needs them;
    - the "six surfaces" and "Nothing draws either today" comment-pass items;
    - `main.rs:214-227`.

**The cut, 2d-8, and the records**

31. **Ten steps, in the consult's order and numbering; a cut is numeric and made before the step
    starts** [Q11]. The `cargo fmt` failure is answered in 2d-7-3. The corrective work comes first,
    in 2d-7-1 and 2d-7-2, because readings depend on it and the instrument steps do not. No step is
    created to hold or review a fix.

32. **2d-8 keeps item 8's scope and owes no evidence; 2d-7-10 hands it a manifest that 2d-7-10
    verifies with `ls`** [Q12]. The manifest, corrected by this record (§5.14):
    - `src-tauri/src/probe.rs`, `src/probe.ts`, and the two hook lines in each of `main.rs` and
      `main.ts`.
    - The whole harness tree, `/private/tmp/espansoconfig-harness-2d-6-6c-2/`.
    - **Eight** probe-related pre-edit files: the consult's seven, plus `/private/tmp/7c-probe-block.ts`.
    - 2d-7's own copies: `/private/tmp/2d7-3-probe.rs.orig`, `/private/tmp/2d7-4-probe.ts.orig` and
      `/private/tmp/2d7-instrument-reviewed/`.
    - Probe WebKit data: `~/Library/WebKit/` and `~/Library/Caches/` entries for
      `cc.carpio.espansoConfig.probe`, `cc.carpio.espansoConfigProbe` (both exist today) and every
      `cc.carpio.espansoConfig.probe.<launch>`.
    - **Checked and reported, never deleted on a guess:** the shipped identifier's own
      `~/Library/WebKit/cc.carpio.espansoConfig` and `~/Library/Caches/cc.carpio.espansoConfig`
      (probe launches before 2d-7 wrote to them, and so may the owner's own runs);
      `/private/tmp/espanso.err` and `/private/tmp/espanso.out`.
    - **Not the instrument, and outside item 8's scope:** `/private/tmp/9aprobe/`, which holds a
      Vitest output from a scratch test, and this project's other scratch files in `/private/tmp`.

    2d-8 also corrects `main.rs:214-227` (by record) and rewrites `CLAUDE.md` §6's instrument bullet.
    It keeps the host facts and drops the instrument facts, `pause`'s cap among them.

33. **A state 2d-7 leaves unread or constructed is recorded as *permanently unread by a window
    harness*, and is not moved to 2d-8** [Q12]. The carried-forward list holds:
    - the four rebindings, plus the fifth and sixth if disclosed rather than closed;
    - every unread and constructed row;
    - R38's residue (shapes read only in the viewer);
    - R35;
    - the fold and label rulings owed to the owner.

34. **Privacy in the harness** [Q2 item 10, `CLAUDE.md` §1].
    - Fixtures are synthetic only. The fifteen are committed synthetic files.
    - `launch-7.sh` takes **window captures only**. All five existing scripts take a full-screen
      `screencapture -x` on every shot (`launch.sh:106` and the same line in the other four), which
      in an unlocked session would capture the owner's desktop.
    - Existing `*-screen.png` files in `launches/` are never quoted or copied into the repository.
      2d-8 deletes them with the tree.
    - The real corpus is never a launch input.

35. **The review policy is the current one** [`CLAUDE.md` §7]. There is one adversarial review per
    step-phase, and one for this record. Blockers are fixed and verification re-run; a fix is not
    reviewed. A finding about a record's wording is corrected in place and commissions nothing. No
    re-review phase, no letter-appended phase.

36. **Drift found by the brief and the consult is corrected in the document it lives in, by the step
    that owns that document; this record edits none of them** [brief §3, consult `:589-623`].
    - `CLAUDE.md` §6's `persist/write.rs` for `save_document` is an **open item for 2d-7-10**
      (§5.5). It is `crates/espansoconfig-core/src/persist/save.rs:1167`, re-exported at
      `persist/mod.rs:159-160`.
    - Consolidated §5.4's list is also 2d-7-10's.
    - The stale anchors in `phase-2d-design.md:130` and in `PROGRESS.md`'s 11a paragraph are recorded
      in §5.6 and §5.7 and edited by nobody. They are records; the current locations are given here.

---

## 4. Citation audit

**The consult makes 154 backticked line citations** (`rg -n -o` for a backticked token ending
`:NNN` or `:NNN-NNN` over `docs/reviews/phase-2d-7-design.md`). They fall into three groups:

- **32 are read ranges** in its inputs list (lines 7-19). They make no claim beyond "this was read".
  Each resolves if the file holds that range.
- **4 are the unformatted-line pointers** on line 21.
- **118 are claim citations**, lines 30-785.

**Every one of the 154 was checked by opening the cited line on the current working tree.** The
Tauri files were read from `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tauri-2.11.5/`.

- A single-line citation *resolves* if the named construct is at that line or begins there.
- A range *resolves* if the construct lies substantially within it.
- A *note* marks an offset, or a citation that resolves but does not carry the claim built on it.

**Result: 148 resolve, 6 resolve with a note, 0 do not resolve.** Two of the six notes affect the
record: row 122 feeds §5.8 and row 152 feeds §5.11. The other four (rows 18, 53, 93, 95) are
offsets, and none of them changes what the consult used its citation for.

**Read ranges and pointers (lines 7-21)**

| # | Line | Citation | Verdict |
|---|---|---|---|
| 1 | 7 | `CLAUDE.md:228-237` | resolves — §6 *Window readings* |
| 2 | 7 | `:239` | resolves — `## 7.` |
| 3 | 7 | `PROGRESS.md:1-244` | resolves — file holds 359 lines |
| 4 | 7 | `docs/reviews/phase-2d-design.md:118-138` | resolves — 146 lines; items 7, 8 at 130, 132; Q8 at 138 |
| 5 | 8 | `docs/reviews/phase-2c-5-7-removal.md:40-49` | resolves |
| 6 | 8 | `docs/reviews/phase-2d-6-design.md:235-269` | resolves — 391 lines |
| 7 | 9 | `docs/decisions/2d-6-split-notes.md:583-586` | resolves — entry 38 |
| 8 | 9 | `docs/decisions/2d-6-window-readings-consolidated.md:60-212` | resolves — file ends at 212 |
| 9 | 10 | `docs/decisions/2c-5-5a-instrument-rebuild.md:2152-2200` | resolves — §16 at 2152 |
| 10 | 11 | `src/probe.ts:1-240` | resolves — 5 210 lines |
| 11 | 11 | `:530-818` | resolves |
| 12 | 11 | `:944-960` | resolves |
| 13 | 11 | `:2194-2217` | resolves |
| 14 | 11 | `:3125-3160` | resolves |
| 15 | 11 | `:4028-4094` | resolves |
| 16 | 11 | `:4940-5210` | resolves |
| 17 | 12 | `src-tauri/src/main.rs:200-262` | resolves — 275 lines (working tree) |
| 18 | 13 | `src-tauri/src/events.rs:1-72` | resolves with a note — the file holds 71 lines |
| 19 | 13 | `src-tauri/src/commands.rs:565-584` | resolves |
| 20 | 13 | `:1800-1990` | resolves |
| 21 | 14 | `src-tauri/src/reconciliation.rs:990-992` | resolves |
| 22 | 14 | `crates/espansoconfig-core/src/persist/save.rs:1167` | resolves — `pub fn save_document` |
| 23 | 15 | `crates/espansoconfig-core/src/watch/engine.rs:241-252` | resolves — the trait's `read`/`enumerate` |
| 24 | 15 | `src/lib/browser/observationTransitions.ts:1195-1215` | resolves |
| 25 | 16 | `src/lib/browser/workspace.svelte.ts:4640-4665` | resolves |
| 26 | 16 | `src/lib/browser/matchEditor.ts:2660-2667` | resolves |
| 27 | 17 | `src-tauri/tauri.conf.json:5` | resolves — the identifier |
| 28 | 19 | `src/event/mod.rs:165-235` (tauri) | resolves |
| 29 | 19 | `src/app.rs:1658` | resolves — `invoke_handler` |
| 30 | 19 | `:1773-1779` | resolves — `setup` |
| 31 | 19 | `src/ipc/mod.rs:43` | resolves — `InvokeHandler` |
| 32 | 19 | `:543` | resolves — `command()` |
| 33 | 21 | `probe.rs:847` | resolves — inside the `fmt` hunk at 844 |
| 34 | 21 | `:858` | resolves — hunk at 855 |
| 35 | 21 | `:879` | resolves — hunk at 874 |
| 36 | 21 | `:947` | resolves — hunk at 944 |

**Claim citations (lines 30-785)**

| # | Line | Citation | Cited for | Verdict |
|---|---|---|---|---|
| 37 | 30 | `core.js:64-66` | `callbacks` published | resolves |
| 38 | 31 | `event/mod.rs:223-235` | delivery through `runCallback` | resolves — the script function begins at 224 |
| 39 | 55 | `probe.ts:5010-5097` | `runCase` | resolves — 42 `case` labels |
| 40 | 56 | `:543-588` | the recorder | resolves |
| 41 | 56 | `:590-778` | the substitutions | resolves |
| 42 | 56 | `:944-951` | `pause` | resolves |
| 43 | 57 | `:4089-4094` | `hold` | resolves |
| 44 | 57 | `:2194-2217` | `shot` | resolves |
| 45 | 57 | `:4028-4063` | `keepAlive` | resolves |
| 46 | 57 | `:5179-5210` | `startProbe` | resolves |
| 47 | 63 | `main.rs:266-269` | the hook in `main()` | resolves — the hook line is 269 |
| 48 | 64 | `probe.rs:284-288` | the plan guard | resolves |
| 49 | 64 | `:730-732` | the snapshot's plan guard | resolves |
| 50 | 66 | `probe.rs:6-9` | no feature flag | resolves |
| 51 | 85 | `PROGRESS.md:233` | normalisation by subtraction | resolves |
| 52 | 100 | `2c-5-5a-instrument-rebuild.md:2160-2167` | the tail was prose about its review history | resolves — §16.1's first bullet |
| 53 | 111 | `main.rs:242-260` | `register`'s `generate_handler!` | resolves with a note — the macro is 243-261; 242 closes `.setup` |
| 54 | 111 | `probe.rs:213-243` | the probe's macro | resolves |
| 55 | 112 | `probe.rs:201-203` | the unchecked "named again" sentence | resolves |
| 56 | 116 | `:183-192` (probe.ts) | `PROBE_OWN_COMMANDS` | resolves — eight names |
| 57 | 119 | `probe.rs:11` | "Eight IPC commands" | resolves |
| 58 | 119 | `:193` | "eight commands" | resolves |
| 59 | 119 | `:197` | "eight more" | resolves |
| 60 | 120 | `:31` | "Those last two are the dangerous part" | resolves |
| 61 | 121 | `probe.ts:174-175` | "The four probe commands are never recorded" | resolves |
| 62 | 122 | `:535-536` | "every one of the four probe commands" | resolves |
| 63 | 123 | `:255` (probe.rs) | `which` - "second" or "third" | resolves |
| 64 | 123 | `:368` | same | resolves |
| 65 | 123 | `:417` | same | resolves |
| 66 | 123 | `:465` | same | resolves |
| 67 | 123 | `:521` | same ("refusal sentence") | resolves |
| 68 | 125 | `probe.rs:41-54` | the four rebindings | resolves |
| 69 | 127 | `:929-930` | `set_permissions` by pathname | resolves |
| 70 | 130 | `:751` | the unchecked `shots` join | resolves |
| 71 | 132 | `:713-714` | "nothing is written outside a launch tree" | resolves |
| 72 | 135 | `probe.rs:553-556` | the two snapshot globals | resolves |
| 73 | 137 | `probe.ts:2194-2207` | `shot()` sets the flag, then requests | resolves |
| 74 | 137 | `:4046-4057` | the keep-alive request | resolves |
| 75 | 142 | `probe.ts:725` | `--- substituted` (listen) | resolves |
| 76 | 142 | `:742` | same (epoch zero) | resolves |
| 77 | 142 | `:751` | same (discard) | resolves |
| 78 | 143 | `:763` | same (may have written) | resolves — 763-766 |
| 79 | 143 | `:772` | same (delay) | resolves |
| 80 | 145 | `ipc-protocol.js:59-70` | a rejected fetch falls back to `postMessage` | resolves |
| 81 | 145 | `probe.ts:603-606` | the rule already stated | resolves |
| 82 | 146 | `:760-767` | `mayHaveWritten` issues the real save first | resolves |
| 83 | 148 | `probe.ts:564-567` | listen and drain wait for the plan | resolves |
| 84 | 151 | `:66` | `PAUSE_TRIP_LIMIT = 400` | resolves |
| 85 | 151 | `:944-951` | `pause` | resolves |
| 86 | 152 | `:4071-4073` | keep-alive by prefix | resolves |
| 87 | 159 | `tauri.conf.json:5` | the shipped identifier | resolves |
| 88 | 182 | `tauri/src/ipc/mod.rs:43` | `Fn(Invoke<R>) -> bool` | resolves |
| 89 | 182 | `probe.rs:213` | `register_with_probe` builds the handler | resolves |
| 90 | 184 | `ipc/mod.rs:543` | `InvokeMessage::command` | resolves |
| 91 | 184 | `app.rs:1658` | a plain setter | resolves — body at 1662 |
| 92 | 191 | `main.rs:205-208` | the six write commands | resolves |
| 93 | 195 | `ipc-protocol.js:59-81` | the `postMessage` fallback | resolves with a note — the `postMessage` send is at 84 |
| 94 | 196 | `commands.rs:1916-1930` | the non-reentrant lock and ledger gate | resolves — the doc of `commit_and_record` (1934), `begin_commit` at 1940 |
| 95 | 208 | `phase-2c-5-7-removal.md:47` | final bytes cannot separate the cases | resolves with a note — 47 is the Tab/pointer line; the no-counter sentence is 48 |
| 96 | 210 | `events.rs:67-71` | `wake_emitter` | resolves |
| 97 | 212 | `commands.rs:581-583` | `install_wake_emitter`, replacing | resolves |
| 98 | 212 | `reconciliation.rs:990-992` | the queue's setter | resolves |
| 99 | 213 | `app.rs:1773-1779` | `setup` replaces | resolves |
| 100 | 214 | `main.rs:236-241` | `register`'s emitter installation | resolves |
| 101 | 223 | `reconciliation.rs:991` | only the wake mutex | resolves |
| 102 | 236 | `core.js:64-66` | `callbacks` | resolves |
| 103 | 237 | `event/mod.rs:223-235` | delivery path | resolves |
| 104 | 238 | `core.js:39-41` | `runCallback` = `callbacks.get` | resolves |
| 105 | 238 | `probe.ts:560` | the body is parsed | resolves |
| 106 | 245 | `core.js:63` | "just for the debugging purposes" | resolves |
| 107 | 251 | `ipc-protocol.js:59-70` | fallback | resolves |
| 108 | 254 | `probe.ts:724-727` | `listenRefused` never issues | resolves |
| 109 | 268 | `probe.ts:216` | `IPC_QUIET_MS` | resolves |
| 110 | 293 | `probe.ts:769-776` | `delay` changes timing only | resolves |
| 111 | 296 | `:708-712` | `MAY_HAVE_WRITTEN` | resolves |
| 112 | 296 | `:724-727` | `listenRefused` | resolves |
| 113 | 297 | `:741-755` | `epochZero`, `discardOnce` | resolves |
| 114 | 299 | `:600-601` | "the probe's, never the disk's" | resolves |
| 115 | 318 | `probe.ts:4940-4941` | `visibility` printed | resolves |
| 116 | 328 | `probe.ts:4035-4041` | the keep-alive's purpose | resolves |
| 117 | 387 | `probe.rs:77` | `TARGET_TAIL` under `match/` | resolves |
| 118 | 387 | `:86` | `OTHER_TAIL` under `match/` | resolves |
| 119 | 387 | `:864` | the extra writer's `match` check | resolves |
| 120 | 398 | `probe.rs:877-885` | the extra writer writes in place | resolves |
| 121 | 405 | `probe.ts:836-841` | `watermarkOf` | resolves |
| 122 | 432 | `probe.ts:104-117` | the open-surface refusal "drawn since 2d-6" | resolves with a note — the key list detects the refusal; no record shows it drawn (§5.8) |
| 123 | 477 | `phase-2d-6-design.md:267` | the narrow-reading rule | resolves |
| 124 | 509 | `observationTransitions.ts:1204-1206` | `markStaleWhileOurs` | resolves |
| 125 | 510 | `workspace.svelte.ts:4652-4661` | `writtenHere` does not clear `stale` | resolves — the arm opens at 4650 |
| 126 | 516 | `matchEditor.ts:2664` | the false renderer claim | resolves |
| 127 | 516 | `matchEditor.ts:2664-2665` | same | resolves |
| 128 | 542 | `main.rs:214-227` | the `"permissions": []` paragraph | resolves (working tree; 213-226 at `HEAD`) |
| 129 | 583 | `main.rs:214-227` | same | resolves |
| 130 | 593 | `probe.rs:929-930` | the fifth rebinding | resolves |
| 131 | 595 | `:751` | the sixth | resolves |
| 132 | 595 | `:713-714` | the unenforced sentence | resolves |
| 133 | 598 | `tauri-2.11.5/scripts/core.js:64-66` | `callbacks` | resolves |
| 134 | 599 | `src/event/mod.rs:223-235` | delivery | resolves |
| 135 | 601 | `probe.rs:553-556` | globals | resolves |
| 136 | 601 | `probe.ts:2194-2207` | `shot()` | resolves |
| 137 | 602 | `:4046-4057` | keep-alive | resolves |
| 138 | 605 | `tauri.conf.json:5` | shipped identifier | resolves |
| 139 | 606 | `CLAUDE.md:233-234` | `localStorage` follows the identifier | resolves |
| 140 | 609 | `probe.ts:174-175` | stale count | resolves |
| 141 | 609 | `:535-536` | stale count | resolves |
| 142 | 610 | `probe.rs:31` | stale referent | resolves |
| 143 | 610 | `:193-197` | "eight" | resolves |
| 144 | 612 | `probe.rs:77` | `match/` only | resolves |
| 145 | 612 | `:86` | same | resolves |
| 146 | 612 | `:864` | same | resolves |
| 147 | 614 | `tauri app.rs:1773-1779` | `setup` replaces | resolves |
| 148 | 615 | `main.rs:236-241` | the production installation | resolves |
| 149 | 619 | `persist/save.rs:1167` | `save_document`'s home | resolves |
| 150 | 620 | `persist/mod.rs:159` | the re-export | resolves — `pub use save::{ save_document, …` at 159-160 |
| 151 | 631 | `matchEditor.ts:2664` | the comment item | resolves |
| 152 | 669 | `probe.ts:166-167` | the recorder-ordering argument | resolves with a note — true for `bootstrap()`, but `main.ts:14` imports `App.svelte` before `probe.ts` (`:20`), so the App graph evaluates first (§5.11) |
| 153 | 690 | `matchEditor.ts:2664-2665` | 2d-7-2's target | resolves |
| 154 | 785 | `main.rs:214-227` | 2d-8's | resolves |

**This record's own citations**, which the consult did not make, were each opened for this record:

| Citation | For | Verdict |
|---|---|---|
| `CLAUDE.md:152` | §6 names `persist/write.rs` | resolves |
| `observationTransitions.ts:130-140` | `stale` "does not say which" | resolves |
| `probe.rs:647` | the completion reads `SNAPSHOT_PATH` late | resolves |
| `probe.rs:319-360` | `confined_target` canonicalizes | resolves — `canonicalize` at 327 |
| `probe.ts:781` | `installIpcRecorder()` at module evaluation | resolves |
| `probe.ts:1799-1804` | the refusal reporter counts `competing` | resolves |
| `src/main.ts:14`, `:15-19`, `:20`, `:35`, `:37` | import order; `bootstrap`; `startProbe()` | resolves |
| `probe.ts:554-556` | a `PROBE_OWN_COMMANDS` name passes through unrecorded | resolves (added at §8 finding 3) |
| `probe.rs:56` | the safety doc comment naming `save_document` | resolves (added at §8 finding 2) |
| `PROGRESS.json:732` | the single `"2d-7"` row | resolves (added at §8 finding 5) |
| `core.js:22` | `const callbacks = new Map()` | resolves |
| `node_modules/@tauri-apps/api/event.js:76-79` (2.11.1) | `handler: transformCallback(handler)` | resolves |
| `tauri-2.11.5/src/app.rs:1783-1789` | `on_page_load`, replacing | resolves |
| `tauri-2.11.5/src/ipc/mod.rs:211-213` | `Invoke.message` is public | resolves |
| `commands.rs:1934-1941` | `commit_and_record` takes the gate | resolves |
| `persist/mod.rs:159-160` | the re-export | resolves |
| `/private/tmp/espansoconfig-harness-2d-6-6c-2/launch.sh:64`, `:106` | shipped identifier; full-screen capture | resolves; the same two lines are in `launch-7c.sh`, `-8c.sh`, `-9c.sh` and `-10.sh` |
| `2d-6-window-readings-consolidated.md:74`, `:149`, `:199` | the ES fold; `draftCopyFailed`; the three-copy row | resolves |
| `docs/decisions/2d-6-11a-notes.md:159`, `2d-6-9b-3-notes.md:195`, `2d-6-11b-notes.md:245`, `2d-6-10-notes.md:111`, `2d-6-9c-notes.md:141`, `2d-6-8c-notes.md:94`, `2d-6-9b-2-notes.md:211`, `2d-6-9a-notes.md:227` | the open-items sections §7 maps | resolves — each is the section heading |

**What the audit does not establish:** that a construct which resolves works as the consult proposes
to use it. The Tauri rows (37–38, 80, 88, 90–91, 93, 99, 102–104, 106–107, 133–134, 147) prove what
Tauri's source says. They do not prove that
a WKWebView running this build behaves that way; 2d-7-4's spy control and agreement control are the
first test.

---

## 5. Corrections — where the consult overrides an earlier document, and where this record narrows the consult

### 5.1 "Four rebindings" is incomplete for the current instrument

The brief's §3 and §5.3, `phase-2c-5-7-removal.md:44` and `probe.rs:45` all say "four". 9c's
`probe_lock_other` and 6c-2's `probe_snapshot` each open one more (entry 9). **Replaced by** "four,
plus the fifth and sixth, closed or disclosed". The consult wins because the four were written before
either command existed.

### 5.2 Item 7's "rebuild the removed harness only after its own review"

Item 7 was written when the harness had been removed (`phase-2d-design.md:130`). It has since been
rebuilt twice and extended four times, without a review. **Replaced by** entry 1: adopt, prune, and
review once at 2d-7-4. The consult wins because rewriting forty-odd cases buys a second review of
code nobody needs.

### 5.3 Ruling 38 does not bind 2d-7's own readings

2d-6 record entry 38 set a visible-window regression reading for component-changing steps, and every
2d-6 reading departed from it. 2d-7-5 … 2d-7-8 are item-7 readings with a hidden fallback, **and they
name every visual claim unread when the screen is locked**. The visible half is 2d-7-9's. Entry 38
still governs any *later* component-changing step.

### 5.4 Consolidated §5.4's pre-edit copies

That row names three files and "no record names a deleter" (`consolidated.md:199`). The consult finds
seven; this record finds **eight** (§5.14). The deleter is 2d-8. 2d-7-10 corrects the row in place.

### 5.5 `CLAUDE.md` §6 names the wrong file for `save_document` — open item, 2d-7-10

`CLAUDE.md:152` says `persist/write.rs`. The function is at `persist/save.rs:1167` and is re-exported
at `persist/mod.rs:159-160`. **This record does not edit `CLAUDE.md`.** 2d-7-10 corrects the one line.
If 2d-7-10 does not, 2d-8's rewrite of §6 must.

### 5.6 `phase-2d-design.md:130` cites `CLAUDE.md:488-500`

Since the 2026-09-20 rewrite, those constraints are at `CLAUDE.md:228-237`. The review is a record,
and it stays as written. This line is the correction.

### 5.7 `PROGRESS.md`'s 11a anchors

`observationTransitions.ts ~1203` is `markStaleWhileOurs` at `:1204`. `workspace.svelte.ts
~4634-4645` is the `writtenHere` arm at `:4650-4661`. Both drifted when 2d-6-11 added lines. The next
checkpoint that rewrites that paragraph uses the current lines.

### 5.8 Narrowing: the open-surface refusal is not "reached"

The consult classes it *Reached*, "drawn since 2d-6 (`RESTORE_REFUSAL_KEYS`, `probe.ts:104-117`)".
The list only lets the probe *detect* the sentences, through `reportRestoreRefusal` at
`probe.ts:1799-1804`.

Every `--- restore` line the records hold reads `competing=0`: the 2d-5-2c-2 reading, lines 258-261.
No record shows `competing≥1`. `phase-2c-5-7-removal.md:45` names it live-window-unreachable.

**It stays a prediction.** 2d-7-6 credits it only with a transcript line showing `competing≥1`, and
otherwise names it unread.

### 5.9 Narrowing: 2d-7-1's acceptance assumes provenance the status lacks

The consult asks for a test in which a `writtenHere` release "clears a `stale` mark that only the
released reading set, and leaves one standing from another cause". `stale` carries no cause
(`observationTransitions.ts:130-140`). So the ruling must decide first how a cause is known, before
any test can say "only". Entry 27 orders it that way.

### 5.10 Narrowing: the snapshot race is confirmed at a named line, and it weakens 2d-6's lines

`snapshot_done` reads `SNAPSHOT_PATH` at completion (`probe.rs:647`), which confirms the consult's
race. Every 2d-6 `webview=written` line is therefore evidence that *some* request completed, not the
named one. **No 2d-6 record is edited for this.** The consolidated record already says the visual
evidence was a hidden page's render, and 2d-7-10's matrix cites this paragraph.

### 5.11 Narrowing: the recorder-ordering argument has a gap

`probe.ts:166-167` says the recorder is in place "before the application issues anything", because
`main.ts` imports it ahead of `bootstrap()`. It is installed at module evaluation (`probe.ts:781`).
But `main.ts:14` imports `App.svelte` before `./probe` (`:20`), and so do `main.ts:15-19`
(`bootstrap`, the IPC errors, the menu modules and the locale store). All of those module graphs
evaluate first. **The claim holds only if no module in them invokes a command at evaluation time.**
This record did not establish that.

Entry 7 item 12 turns it into a check: the Rust tally and the page recorder must agree at the first
checkpoint.

### 5.12 Narrowing: the wake-emit tally counts from its installation

Installed from `on_page_load` (entry 13), the counting emitter replaces the production emitter only
when the first page-load callback fires. An earlier emit is uncounted. No listener exists before
then, so "delivered > emitted" cannot arise from it. Still, the tally's window is named "from
installation", never "since launch".

### 5.13 Resolved: the listen body's `handler` argument

The consult marked it unverified (`:242-245`, `:667`). `@tauri-apps/api` 2.11.1's `listen` sends
`handler: transformCallback(handler)` (`event.js:76-79`). The first shakedown still prints the
parsed body, because the installed package is the one checked, not the one a future `npm install`
fetches.

### 5.14 Correction: the deletion manifest is longer than the consult's

The consult's list misses four things, and adds one entry this record orders:

- **A missed probe fragment.** `/private/tmp/7c-probe-block.ts` is a 2d-6-7c probe source block, and
  the consult missed it.
- **Two existing probe identifiers.** `~/Library/WebKit/` and `~/Library/Caches/` already hold
  `cc.carpio.espansoConfig.probe` and `cc.carpio.espansoConfigProbe`, from earlier harness
  generations.
- **The shipped identifier's data.** The shipped identifier's own WebKit and Caches directories
  received probe launches' `localStorage` (all five scripts use `cc.carpio.espansoConfig`). They are
  also the owner's app's, so 2d-8 **reports them and does not delete them**.
- **Not the instrument.** `/private/tmp/9aprobe/` holds a Vitest output of a scratch test, not the
  instrument, and it is left out.
- **Renamed and added copies.** The consult's `2d7-probe.ts.orig` is renamed `2d7-4-probe.ts.orig`.
  `2d7-3-probe.rs.orig` and `2d7-instrument-reviewed/` are added (entry 3).

### 5.15 Narrowing: synthesized input is not a driven-step tool

The consult lets a driven step in an unlocked session post `CGEvent` input (`:331-340`). The
Accessibility grant it needs is an owner act, and an unattended session is exactly one without the
owner, so entry 20 confines the tool to 2d-7-9. The consult's own condition for the grant supports
this reading.

### 5.16 Amendment: pre-step copies, because an untracked file has no diff

The consult has 2d-7-3's review cover "only 2d-7-3's Rust diff" (`:96-97`). `probe.rs` is untracked,
so there is no diff unless a before-copy exists. Entry 3 orders the copies.

### 5.17 Amendment: the driven stop is specified to the field

The consult says the driver "must stop at 2d-7-9 as awaiting-owner, not simulate it" (`:654-655`).
Entry 21 states what that means in the workflow's own terms:
- the `PROGRESS.json` row is `blocked`;
- the status is `BLOCKED`;
- no worker, launch or notes are made in 2d-7-9's name;
- 2d-7-10 waits.

It also gives the one exit that does not need the session: the owner's own ruling.

---

## 6. What the consult did not settle

**No item here commissions a review round.**

**Permissions, not obligations** — a later step is free either way:

1. **The prune's extent** (entry 1). The rule is only that a case no step names is not reviewed. The
   worker chooses what goes.
2. **The form of the `stale` provenance** (entry 27): a new field, a registry question, or clearing
   without knowing. The ruling in 2d-7-1 chooses.
3. **Whether `SourceText`'s marker is fixed or its comment is corrected** (2d-7-2). Either satisfies
   the acceptance.
4. **The burst writer's tooling**, which may be a shell, a compiled tool or a script, provided each
   write's offset is printed.

**Deferred out of 2d-7:**

5. The fold ruling and any fix; the close and keep labels; the refusal wording repeats; the CRLF-only
   disk text: **later phase, after the owner's rulings**.
6. R35's native-speaker review: **the owner, before Phase 5**.
7. The unused accessors, the comment pass, `acknowledgeSnapshot`, and `dispose()` on close: **later
   phase**, none named.
8. The `main.rs:214-227` comment and the `CLAUDE.md` §6 instrument rewrite: **2d-8**.

**Gaps and overlaps in the split**, recorded rather than repaired:

9. **2d-7-6 is the longest step** (G2 and G3). Its pre-start cut is permitted (§2); it is not
   pre-made.
10. **2d-7-9 can float.** It depends only on 2d-7-2 and 2d-7-4, so an interactive session with the
    owner may take it early. The consolidation still waits for it.
11. **The visible re-take (G5) is the falsifier for 2d-7-5 … 2d-7-8's hidden readings**, and it
    comes after them. A difference found there moves the affected claims to *unread* in 2d-7-10. It
    does not reopen the earlier steps.

**Asked by the brief and not answered:**

12. **Whether `CLAUDE.md` §6 should gain the `pause` cap and keep-alive facts** before 2d-8. The
    consult answers "2d-8, which rewrites §6 anyway" and says `pause` goes with the instrument. The
    occlusion-stop *host* fact is already in §6. Nothing is added in 2d-7.
13. **Whether the reading measures the per-activation drain cost outside 2d-7-9.** It does not;
    2d-7-9's Rust tally around each activation is the only measurement.

---

## 7. The inherited work items, and the counts this record measured

Each item handed on to 2d-7 is listed below with what 2d-7 does with it: **taken** (with the step),
**deferred** (with where), or **untouched**. The sources are the rows of brief §5.7, `PROGRESS.md`
*Next action*'s handed-on lists, and the 2d-6 record's §7.

| Item | Source | Disposition | Where |
|---|---|---|---|
| "Six surfaces" and similar undercounts | 11b §6 item 1 | **Deferred** | later comment pass |
| `matchEditor.ts:2664` names `tSupersededEvidence` as a renderer | 11b §6 item 8 | **Taken** | 2d-7-2 |
| Refusal wording repeats | 11b §6 item 2; 9b-2 §6 | **Untouched** — read as drawn | later phase |
| Unused accessors (six) | 11b §6 item 3; 9b-2 §6 | **Deferred** | later deletion phase |
| Close and keep labels near-synonyms | 11b §6 item 9 | **Taken as a surfacing only** | 2d-7-9; ruling to a later phase |
| `cargo fmt --check` fails on `probe.rs` | 11b §6 item 6 | **Taken** | 2d-7-3 |
| No native-speaker review (R35) | 11b §6 item 7; 9b-3 §6 item 5; 9a §5 (d) | **Deferred**, with its input produced | owner before Phase 5; inventory in 2d-7-10 |
| A `stale` mark survives a `writtenHere` release | 11a §5 item 1 | **Taken** | 2d-7-1 |
| Hold during an automatic read leaves `stale` unacknowledgeable | 9b-3 §6 item 1 | **Taken** | 2d-7-1 |
| Same-bytes coalescing; the automatic path not asking `observationRetained` | 9b-3 §6 items 2–3 | **Deferred**, unless 2d-7-1's ruling needs them | later phase |
| "Nothing draws either today" | 9b-3 §6 item 4 | **Deferred** | comment pass |
| Composition-check blind spots | 11a §5 item 3 | **Untouched** | — |
| `AppShell` removal and save-origin loops EN-only | 11a §5 item 4 | **Taken** | 2d-7-2 |
| Visible-window foreground reading | 10 §4 item 1 | **Taken** | 2d-7-9 |
| Each activation costs one drain | 10 §4 item 2 | **Taken** (measured) | 2d-7-9 |
| No window-close `dispose()` | 10 §4 item 3; 2d-6 record §7 item 10 | **Untouched** — quit events only observed | 2d-7-9 observes; build deferred |
| Disabled status control drawn as enabled | 9c §6 item 1 | **Taken** | 2d-7-2, confirmed in 2d-7-9 |
| Long ES row mark breaks mid-word | 9c §6 item 2 | **Taken** | 2d-7-2, confirmed in 2d-7-9 |
| 9c's unread states | 9c §6 item 3 | **Taken** | 2d-7-8 (G4) |
| `P9-06` and `P8-09` silent stops | 9c §6 item 4; 8c §4 | **Taken as detection** (heartbeat); past stops unexplained | 2d-7-4 |
| Probe artifact: first `SourceText` is the trigger field | 9c §6 item 5 | **Taken** | 2d-7-4 review item |
| Visible-window reading owed | 9c §6 item 7; 8c; 7c | **Taken** | 2d-7-9 (and 2d-7-5 … 8 where unlocked) |
| `CLAUDE.md` §6 to gain `pause` and keep-alive | `PROGRESS.md` 9c paragraph | **Deferred** | 2d-8's §6 rewrite |
| `acknowledgeSnapshot` dead end | 9b-2 §6 item 3 | **Deferred** | later phase (model work) |
| 9b-1 §8.3 release-path sequence | 9a/9b-1 | **Taken as a naming** — unreachable | 2d-7-8, 2d-7-10 |
| `SourceText` `.invisible` wraps inside a line | 8c §4 item 1 | **Taken** | 2d-7-2, confirmed in 2d-7-9 |
| First choice row below the fold | 8c §4 item 2; 7c; 6c-2 | **Taken as a measurement** | 2d-7-9; ruling to a later phase |
| CRLF-only disk text named on neither panel | 8c §4 item 3; 7c | **Untouched** | later phase |
| `main.rs:214-227` `"permissions": []` | 2d-6 record §6 item 8 and §7 item 7 | **Deferred** | 2d-8 |
| The `file:line` drift checker | 2d-6 record §7 item 1 | **Untouched** — drift is corrected in §5 by hand | — |
| The `fetch` recorder is 2d-7's start | 2d-6 record §7 item 11 | **Taken** | 2d-7-3, 2d-7-4 |
| Native watcher matrix, real wake and resume, R38's window half | 2d-6 record §6 item 10 | **Taken**, narrowed: wake observed per launch; general wake and the full matrix named unclaimable | 2d-7-5, 2d-7-7, 2d-7-9 |
| Removal review: four rebindings | `phase-2c-5-7-removal.md:44` | **Carried**, plus fifth and sixth | 2d-7-3; carried to 2d-8 |
| Removal review: four live-window-unreachable states | `:45` | **Taken** — open-surface refusal and both adoption arms read or named; committed-but-reprojection-failed named unreachable | 2d-7-6 |
| Removal review: enabled-state half of conflict timing | `:46` | **Taken** | 2d-7-6 |
| Removal review: Tab/default and pointer evidence | `:47` | **Taken** | 2d-7-9 |
| Removal review: no counter, no spy | `:48` | **Taken** | 2d-7-3, 2d-7-4 |
| Removal review: fifteen fixtures never through the harness | `:49` | **Taken** | 2d-7-7 |
| Removal review: the owner's configuration never exercised | `:49` | **Untouched, deliberately** — never a launch input (`CLAUDE.md` §1) | — |

**Measured for this record, not copied forward:**

| Count | Figure | How |
|---|---|---|
| Backticked line citations in the consult | **154** (32 read ranges, 4 pointers, 118 claims) | `rg -n -o` |
| Audit verdicts | **148 resolve, 6 with a note, 0 fail** | each opened |
| `cargo fmt --check` hunks | **10**, all in `probe.rs`, starting 844 … 966 | `cargo fmt --check \| rg '^Diff in'` |
| Commands in `register_with_probe`'s macro | **29** — 17 application plus 12 probe | `probe.rs:213-243` |
| Names in `PROBE_OWN_COMMANDS` | **8** — four 9c probe commands absent | `probe.ts:183-192` |
| `case` labels in `runCase` | **42** | `rg -c` over `probe.ts:5010-5097` |
| Hook diff | **5 insertions, 1 deletion** | `git diff --stat` |
| Harness scripts using the shipped identifier | **5 of 5** | `rg CFBundleIdentifier` |
| Harness scripts taking a full-screen capture | **5 of 5** | `rg screencapture` |
| Probe-related pre-edit files in `/private/tmp` | **8** | `ls` |
| Existing probe WebKit/Caches identifier directories | **4** (two identifiers × two places), plus the shipped identifier's **2** | `ls -d ~/Library/*/cc.carpio.espansoConfig*` |
| `CLAUDE.md` §4 fixtures present in `synthetic/` | **15 of 15** | `ls` |

**What that table does not establish:** it counts files, lines and references, not correctness. The
twelve probe commands are counted, not reviewed. The eight pre-edit files are named by what their
first lines say, and nobody has diffed them against anything.

---

## 8. This record's own review

**Verdict: `ship-with-fixes`, 0 BLOCKERS, 6 SHOULD-FIX, and one minor finding.** The reviewer was
the fallback agent `autoclaude-reviewer` (opus), because `autoclaude-review.sh` exited 2 with
`REASON=usage-limit` (Codex out of quota). The report is
[`docs/reviews/phase-2d-7-design-record-review.md`](../reviews/phase-2d-7-design-record-review.md).

**Each finding was re-derived against the tree before it was fixed, and all six held.** Each is
corrected in place in this record.

| # | Finding | Re-derived | Disposition |
|---|---|---|---|
| 1 | Entry 6's "the next step prunes further" contradicts 2d-7-5's frozen, hash-checked, records-only instrument, and would put unreviewed bytes under the reviewed set | Holds. 2d-7-5 refuses to read on any hash mismatch (§2), so no later step can change the instrument | **Fixed in entry 6.** Overflowing blocker fixes stay inside 2d-7-4 and resume in a later session under the same review's findings, with no second review. The reviewed set and hashes are written only at 2d-7-4's close |
| 2 | 2d-7-3's `rg` acceptance fails on the doc comment at `probe.rs:56` | Holds. `rg` over `probe.rs` today returns exactly line 56 (`//! …save_document stays the only entry point…`) | **Fixed in §2, 2d-7-3.** The check drops comment lines (`rg -v '^[0-9]+:\s*//'`), keeps the comment, and never requires deleting one |
| 3 | Entry 15's command rule is wrong for probe commands, and its "probe name missing → Rust > page" is reversed | Holds. `probe.ts:554-556` passes `PROBE_OWN_COMMANDS` through unrecorded, while Rust tallies probe commands separately. A name missing from the list makes the page record it, giving page > Rust | **Fixed in entry 15.** The application half is compared excluding `PROBE_COMMANDS`. The probe half is a list check (a probe name in the page's records is void), and the causal sentence is corrected |
| 4 | The cutting rule conflicts with "exactly one" instrument review if 2d-7-4 is cut | Holds. A cut piece is a step-phase that owes its own review (entry 35) | **Fixed in §2, cutting rule.** 2d-7-4 may be cut only into `2d-7-4-1` (harness and tools; its own review of that content) and `2d-7-4-2` (page side and shakedowns; **the** instrument review, over the whole instrument). No other cut is permitted |
| 5 | Entry 21 marks a `PROGRESS.json` row for 2d-7-9 that does not exist | Holds. `PROGRESS.json:732` is a single `"2d-7"` row | **Fixed in entry 21.** When this record closes, the orchestrator replaces that row with ten step rows carrying §2's risk classes. `2d-7-9`'s own row is the one marked `blocked` |
| 6 | Entry 12 classifies writes by a SHA-256 the witness does not collect | Holds. The witness as written reported only path, inode, size, `mtime` and `ctime` | **Fixed in entry 12.** The witness now hashes each regular file, read-only through `O_NOFOLLOW`. It reports an unreadable file as `unhashed`, and says it cannot see a write undone between two witnesses |
| minor | Entry 7 item 12 and §5.11 name only `App.svelte`'s graph; `main.ts:15-19` also evaluate before `./probe` | Holds. Wording only | **Fixed** in both places |

**From the report's "not verified" list,** one wording gap was closed: entry 13 now says the tally is
installed on the **first** `on_page_load` callback of any kind, never filtered to `Finished`. The
macOS ordering of those callbacks stays unverified, and the entry says so; 2d-7-4's spy control is
the evidence.

**No fix touched a source file**, and under `CLAUDE.md` §7 a fix is not owed a review. The record
closes with these edits. The reviewer's own coverage bounds: it sampled about 30 of the 154 audit
rows and did not re-run `cargo fmt --check`.
