# Phase 2D — verification and review dispositions

_Archived verbatim from `PROGRESS.md` on 2026-08-29, when the checkpoint was split. The text below is unedited; see `PROGRESS.md` for the live state._

---

## Verification — Phase 2d-4a-C step 2, review round 8 (NOT READY — 0 High, 0 Medium, 4 Low; **the fix is in the tree, every gate green and MEASURED, and round 9 is OWED**)

Appended verbatim to `docs/reviews/phase-2d-4a-C.md` under `## Step 2 — round 8`. Codex ran
**read-only** and wrote no file. Job `task-mte7uu76-vxm6o8`, high effort, **~9 min (543 s)** —
collected by a **single** bounded foreground wait, the first round in this phase not to need a
chained second one. Record `docs/decisions/2d-4a-C-notes.md` §24. The append is **58 lines**.

The only edit to the reviewer's text was dropping the Codex session-ID trailer — **no heading
demotion**, for the sixth round running. The brief asked for `###` and nothing came back at `##`
(verified: `rg -c '^## '` over the reply returned **0** before appending).

**The poller advice held for the second round.** `codex-wait.sh` was **not** used; a hand-rolled
bounded wait read `.job.status` directly and carried the log file's mtime as the stall signal, with a
540 s hard deadline. Nothing false-stalled and nothing was re-dispatched. Duration trend across the
phase: 604 s, 262 s, 302 s, 402 s, ~11 min, ~13 min, ~11 min, **543 s** — round 8 is the fastest since
round 4, so *budget two nine-minute windows* remains right but one may now suffice.

### The round, in one sentence

**Round 8 is the eighth consecutive round whose finding list is drawn from the previous fix round's
own output, and the fifth in a row to clear the code outright** — and like round 7 it states plainly
that its findings are *"substantive defects in still-live record wording, not restatements of
already-fixed language"*. **Two of its four findings sit inside holes §23.8 had itself nominated**,
and a third is a defect in §23.8's own text rather than in anything it nominated.

### The four findings, all Low, all in the record's prose

1. **Sweep D misidentifies its carrier, and sweep H misses the false explanation.** The record said
   sweep D's candidate set "is therefore inline code spans and nothing else," justified by *a code
   span cannot contain the backtick the pattern is looking for*. Both are false: line 3364 matches
   because that **fenced** command carries the literal `` `git `` inside its own regex, so the carrier
   is not a code span; and a CommonMark code span **can** hold a backtick under a longer delimiter.
   The reviewer grants §23.2's two-genuine-misses conclusion still stands — 3363 was surfaced and
   re-run, 594 is covered by its inline duplicate at 591 — so **the defect is the carrier account and
   the necessity claim, not the conclusion.**
2. **Sweep J's first count is 12, not 13.**
3. **§23.8 says the §3 caveat appears in "four places" and immediately enumerates five.**
4. **The round-7 record is 4853 lines, not 4831** — 4831 was the pre-gate handoff length, and the
   gate-result insertion that followed added 22 lines.

### All four re-derived by the orchestrator BEFORE the fix worker was dispatched

The phase's *measure, don't comply* rule, which has now paid off four rounds running:

- Sweep J's first pattern run against `e9cfa10` returns **12** lines, at that revision's lines
  **303, 321, 329, 337, 1395, 1523, 1525, 1530, 4114, 4186, 4187, 4196** — **exactly** the reviewer's
  list. The second pattern returns **24**, as recorded.
- The "four places" sentence enumerates **five** (§1, §3, §5 item 2, §5 item 6, §14 item 9), read
  directly.
- `git show e9cfa10:…| wc -l` = **4227**; `git show 1c5a9bb:…| wc -l` = **4853**;
  `git diff --stat e9cfa10..1c5a9bb` over that path = **650 insertions, 24 deletions**, and
  4227 + 650 − 24 = **4853**, delta **+626**.

**No disagreement with the reviewer on any figure this round** — the first round in the phase where
the orchestrator's independent derivation matched the reviewer's on every number checked.

### What the fix round added beyond the four findings

**It corrected four of its own drafts by measurement and recorded each in place** — a "four lines up"
distance claim; "line 145" for a sentence spanning 144–147; "stacked passages three → six" where the
true figure is **four**, verified by listing all 45 annotations and testing adjacent pairs; and a
claim that §23.8 item 8's five line numbers had gone stale, when all five are still exactly right.

**And its own sweeps found two new defects**, neither named by the reviewer: sweep H's arithmetic
`2 + 2 + 7 + 3 = 16` (the sum is 14; the missing last term is the pair of *anchored* in unrelated
senses, now written `2 + 2 + 7 + 3 + 2 = 16`), and a ±40-line clause in §22.7 describing its filter as
"code span" when it filtered the pattern's own hits.

### The gates — ALL NINE measured on this tree by the orchestrator after the fix, none inherited

`1313 / 431 / 2125 / 184` (`cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules) — **unmoved from round 7 and necessarily so:
`git diff --stat -- src-tauri crates src` is EMPTY.** 26 result lines, all `ok`, **0 failed**.
`npm run check` **431 files, 0 errors, 0 warnings**; `npm test` **2125 passed** over 56 files;
`npm run build` **184 modules**. Clippy clean; `cargo fmt --check` clean; `cargo doc --workspace
--no-deps` exit 0 with **73** `private_intra_doc_links` and **zero** unresolved links;
`cargo tree -p espansoconfig-core | rg tauri` **empty**. Bundle oracle, both lines:
`$$payload|head_payload|push_element` **absent**, `window.__svelte|svelte-trusted-html` **present, 2**.

### ⚠️ THE HOST SCAR FIRED ON THIS RUN, in its ten-failure form — and two new facts about it

The first `cargo test --workspace` ended **`FAILED. 278 passed; 10 failed`**, every one a
`watch_check::` panic at `src-tauri/src/watch_check.rs:141:5`, *timed out waiting for the watcher's
baseline scan*. The documented remedy was applied verbatim and both halves came back clean: orphans
killed, then the single-threaded gate **20/20 with 268 filtered out (122.19 s)**, then one clean
workspace re-run at **1313 passed, 0 failed**. **No source file changed this round**, so a genuine
regression was not available as an explanation.

Two things the next round should carry:

- **A piped gate does not report the gate's exit status.** The first run was invoked as
  `cargo test --workspace 2>&1 | tail -40`, and the harness reported **exit code 0** — which was
  `tail`'s. The ten failures were only visible by reading the captured text. **Do not pipe a gate
  whose exit status you intend to trust**; let the harness capture the full output instead.
- **Ten, not nine.** `PROGRESS.md` had said the scar produces *nine* `watch_check::` timeouts; round 7
  saw ten and this round saw ten. **The honest range is nine or ten**, and the wording above is now
  written that way.

### What the orchestrator wrote into the record, and why it is marked as its own

§24.7's nine gate cells were left `Pending — measured by the orchestrator after this round` by the fix
worker, which was **forbidden to run Cargo** for the third consecutive round and complied. The
orchestrator filled them and added **two blocks marked `> **Filled by the orchestrator`** — one for
the gate table and the scar, one for the committed line count. **Both are deliberately outside the
`Correction|Corrected|Narrowed|Bound|Amend` alternation** the record counts, because they fill cells
that were declared pending rather than correct a false sentence; the correction-block count is
therefore **44** both before and after them.

**The committed line count was taken self-referentially and the method is recorded.** §24.6 states
**5479** as a *handoff* figure and explicitly refuses to claim a committed total — exactly what
finding 4 asked for. The orchestrator's block supplies **5515**, delta **+662** from 4853, obtained by
inserting the block with its number withheld, measuring, then substituting: **replacing a placeholder
with digits cannot change a line count.**

### Counts after this round

`docs/decisions/2d-4a-C-notes.md` **4853 → 5515** (+662); `docs/reviews/phase-2d-4a-C.md`
**681 → 739** (+58). Correction blocks **37 → 44** (+7, none removed). `git diff --stat` is **two
files, both under `docs/`**; nothing under `src/`, `src-tauri/` or `crates/`.

---
## Verification — Phase 2d-4a-C step 2, review round 7 (NOT READY — 0 High, 0 Medium, 4 Low; **the fix is in the tree, every gate green and MEASURED, and round 8 is OWED**)

Appended verbatim to `docs/reviews/phase-2d-4a-C.md` under `## Step 2 — round 7`. Codex ran
**read-only** and wrote no file. Job `task-mte5twhy-rraggu`, high effort, **~11 min** — collected by
two chained bounded foreground waits (the first expired at its own 540 s deadline with the log
actively being written; the second saw `completed` at 90 s). Record `docs/decisions/2d-4a-C-notes.md`
§23. The append is **86 lines**.

The only edit to the reviewer's text was dropping the Codex session-ID trailer — **no heading
demotion**, for the fifth round running. The brief asked for `###` and nothing came back at `##`
(verified: `rg -c '^## ' ` over the reply returned **0** before appending).

**The poller advice from round 6 worked.** `.job.status` was read directly and the log file's mtime
carried the stall check; no watchdog false-stalled, nothing was re-dispatched, and one review was
collected in two waits as budgeted. Round 6's note that the trend is upward held — 11 min, against
round 6's 13 and round 5's 11.

### The round, in one sentence

**Round 7 is the seventh consecutive round whose finding list is drawn from a previous fix round's own
output, and the fourth in a row to clear the code outright** — but it is the first round to state
plainly that its findings are *"substantive defects in still-live wording, not restatements of wording
already fixed"*, and it earned that by **reimplementing `prose_units` and the guard's matcher in
memory** and reproducing §13.2 exactly (88 phrases, 224 hits over 140 keys, 20 zero-hit phrases, and
the 36 / 19 / 12 / 18 / 5 excluded-phrase totals).

### The four findings, and what answers each

| # | Sev | Kind | The finding | The fix |
|---|---|---|---|---|
| 1 | Low | sentence | §21.7's round-6 correction and §22.3 both say *the leading `^\s*` matters, because the **unanchored form** misses every block indented under a bullet*. **That is reversed.** The unanchored form misses nothing — it returns the same 24. The form that misses the indented blocks is the one anchored directly at `>`, `^>`, which returns 17. The four-passage table built on the count is correct; only the explanation of why is false | §23.1. Both live clauses now name **`^>`, the form anchored directly at `>`**, and each carries a round-7 correction block quoting the superseded wording. **Independently re-derived by the orchestrator before dispatch**, at `5593a90`, with the record's own pattern: `^\s*> \*\*(Correction\|Corrected\|Narrowed\|Bound\|Amend)` → **24**, truly unanchored → **24**, `^>` → **17** |
| 2 | Low | sentence | §22.7 states *Sweeps D and E found nothing beyond their findings* and *No further instance of the shape was found* over the whole shape *a printed, re-runnable command credited with an exact count* — but sweep D's pattern selects only **inline code spans** beginning with six command names. Fenced commands credited with a zero-line result cannot match it, and the deliberately excluded Cargo/npm gate rows include `cargo tree … \| rg tauri`, credited with an empty result, contradicting the record's own *none of them is a search* | §23.2. The negative is **scoped to the inline code-span constructions the pattern returns**, and the gate-row clause is corrected. **The fix round measured rather than complied and disagreed with the review on two of its four named misses** — see below. Sweep E's negative survived the review's broader reading and was **not** weakened |
| 3 | Low | sentence | Three live claims still treat the historical 45-pointer inventory as the current complete set — §5 item 2, §5 item 6 and §14 item 9. Two defects: the list behind *five further pointers* names **six** (3 + 1 + 2, and 2 + 6 = the eight the same sentence asserts), and the 8/37 split is bound to no commit and is no longer current — step 1's own review fixes added two further passages, making the subject **47** | §23.3. *Five* → **six**; the 8/37 split is **bound to `34cd5af`**; the current **9 / 38 over 47** is stated, derived independently and then found to agree with the review; §5 item 6's *§3 lists the 45 pointers* is scoped and §14 item 9 likewise. **§22.4 already recorded the 45-versus-47 gap — the finding is that it sits in §3 and does not scope these three present-tense sentences** |
| 4 | Low | sentence | §22.7's sweep G says *thirteen **positions** were re-derived … and they are the thirteen semicolon-separated items here*. There are thirteen semicolon-separated slots, but the last combines two distinct record locations (§20.8 and §21.7) and other slots group several figures, so it counted grouped constructions, not positions | §23.4. They are now **construction slots**, with the last slot's two passages named. **13 was deliberately kept** — the review warns that changing the number without first defining the unit repeats the same defect |

### Where the fix round measured and disagreed with the reviewer — the phase's standing rule, paying off again

**Finding 2's four "mechanically missed" fenced commands are not four.** Re-derived at `5593a90`:
only **819** and **1070** are genuine misses. **594** is surfaced by line 591 — the same command as an
inline span, credited *zero lines*. **3363** matches at its own body line 3364, which prints a literal
`` `git ``. The gate-row half of the finding is **confirmed and is larger than stated**: **12**
`cargo tree … | rg tauri` lines (10 gate rows, 2 prose), all credited with an empty result — and they
were **never candidates at all** (`cargo|npm` among the 54 → **0**), so the record's *excluded
deliberately* was wrong as well as its *none of them is a search*.

This is the third consecutive round in which a reviewer's incidental count or attribution did not
survive derivation — round 5 mis-attributed a limit, round 6 named two stacked blocks where four
exist, round 7 named four missed fences where two are. **Do not copy a reviewer's figure into the
record.** The fix round also corrected **two of its own first drafts** by measurement (sweep I is
**11** lines, not 12; stacked passages go **two → three**, not "five where round 6 left four") and
recorded both corrections in §23 rather than smoothing them away.

### One further instance the reviewer did not name

The fix round's own sweep I found **§20.7's sweep-1 negative** carrying the same over-wide shape as
finding 2, and corrected it with an eighth correction block. That is the pattern round 6 established:
**sweep for the shape, never for the words of the finding just closed.**

### The gates — all nine measured on this tree, once, alone

`1313 / 431 / 2125 / 184` (`cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules), **identical to round 6's baseline and necessarily so: no source file
changed** — `git diff --stat -- src-tauri crates src` is **empty**.

- `cargo test --workspace` **1313 passed, 0 failed**; no `test result:` line reports a non-zero failure count
- `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` **20/20**, 268 filtered out, **92.65 s**, run alone after `pkill -f 'target/debug/deps/espansoconfig-'`
- `cargo clippy --workspace --all-targets -- -D warnings` clean, exit 0; `cargo fmt --check` clean, no output
- `cargo doc --workspace --no-deps` exit 0, **73** warnings all `private_intra_doc_links`, **zero** unresolved links — the pre-existing count
- `cargo tree -p espansoconfig-core | rg tauri` **empty**
- `npm run check` **431 files, 0 errors, 0 warnings**; `npm test` **2125 passed** over 56 files; `npm run build` **184 modules**

**The six-round frontend carry is discharged.** `431 / 2125 / 184` had been carried forward
**unverified since 2d-4a round 6** — six consecutive rounds — because the standing rule only fires for
a step that touches `src/`, and no step in that span did. This round ran the three commands anyway.
All three reproduce exactly, so **round 8 inherits measured figures rather than inherited ones**, and
the carry is now zero rounds long.

**The bundle oracle was run because a build was run**, both lines, per `CLAUDE.md`:
`rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js` → **absent**, and
`rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js` → **2**, present. **184 is a
legitimate count**, established by the discriminating oracle rather than by reading the number.

### File state

`docs/decisions/2d-4a-C-notes.md` **4227 → 4853** lines. Annotation blocks **29 → 37** by the anchored
pattern (**+8**, and **none removed** — verified against `e9cfa10`; the fix round's own count is
30 → 38, the same delta over a wider marker alternation). `docs/reviews/phase-2d-4a-C.md` **592 → 681**.
`git diff --stat` is **two files, both under `docs/`**.

### The owner decision is still open, and round 7 did not take it

The reorganization of §18–§20 remains the owner's. The fix round was **forbidden to consolidate
anything** and did not; §23.8 item 5 raises it as a **recommendation to the owner only**, noting that
§21.7 — the passage round 6 corrected *about* stacking — is now itself a stack. §23.8 item 8 records
that §22.9 item 3's five line numbers are now stale (303/321/329/1525/1603 → 303/358/366/1571/1649),
deliberately not retrofitted, per §22.6's precedent.

## Verification — Phase 2d-4a-C step 2, review round 6 (NOT READY — 0 High, 0 Medium, 5 Low; **the fix is in the tree, every gate green, and round 7 is OWED**)

Appended verbatim to `docs/reviews/phase-2d-4a-C.md` under `## Step 2 — round 6`. Codex ran
**read-only** and wrote no file — `git status --short --untracked-files=all` immediately after the
job returned nothing. Job `task-mte3g3gu-2vtdnf`, high effort, **~13 min**. Record
`docs/decisions/2d-4a-C-notes.md` §22.

The only edit to the reviewer's text was dropping the Codex session-ID trailer — **no heading
demotion**, for the fourth round running. The append is **82 lines**.

**The watchdog was wrong about the shape of the status JSON, and the job was not.** Both bounded
foreground waits expired (523 s each) on a job that had already completed: the poller matched
`id`/`jobId` against `running`, `recent` and `latestFinished`, and `node "$CC" status <job-id> --json`
in fact answers **`{workspaceRoot, job}`** — the status is at **`.job.status`**. Nothing was
re-dispatched; the job was inspected and its result fetched. **Poll `.job.status`**, and keep the
log-file-mtime stall check beside it, because `codex-wait.sh`'s own false-stall is unchanged.

### The round, in one sentence

**Round 6 is the sixth consecutive round whose finding list is drawn from a previous fix round's own
output** — and the first in which part of it was drawn from a hole that round had itself pointed at:
two of the five findings are the step-1 measurements §21.9 item 6 nominated as *left, not checked*,
and **both were stale when re-run**.

### The five findings, and what answers each

| # | Sev | Kind | The finding | The fix |
|---|---|---|---|---|
| 1 | Low | sentence | §21.5's sweep C prints `rg -n -i '\b(two\|…\|thirteen)\b[^.\n]{0,70}§'` and credits it with **30** lines, **21** from §13 on. The `…` is a **literal alternative** to `rg`, not shorthand: run as printed it returns **14** / **11**. Expanding it to the numeral words does reproduce 30 / 21, so the tally is right and the command credited with establishing it is not. The following **78 / 57** tally gives no regex at all | §22.1. The first regex is printed **in full** in a fenced block, with both readings measured at `2695cbb` (literal **14**, expanded **30 / 21**). The 78 / 57 tally is labelled **not reproducible** rather than reconstructed — **eleven** attempted reconstructions are recorded with what each returned (66, 71, 72, 74, 76, 83, 84, 94, 96, 158, 258), none of them 78 |
| 2 | Low | sentence | §21.8's deviation paragraph presents an **inference as a measured diagnosis**: an orphaned test binary and a just-completed build named as *"both … named rather than guessed at"*, two copies *"were competing"*, and 333 s → 110 s as *"the contention showing up in the clock"*. One re-run followed, with both circumstances changed at once — that is correlation with the improved result | §22.2. The paragraph now calls them **observed circumstances that may have contributed** and the timing change **consistent with** contention, and names the three things it does not establish. §21.9 already called it an inference; a later disclaimer does not make an earlier paragraph measured, so the fix landed in the paragraph |
| 3 | Low | sentence | §21.7 and §21.9 item 1 both say *§19 and §20* hold sentences with two stacked correction blocks. The stacks are at **§18.6** and **§19.7**; §20's two round-5 blocks sit under **different** passages, so §20 carries no stack at all | §22.3, **and here the fix round's measurement disagrees with the review** — see below. Both passages now name **§18.6 and §19.7**, each **scoped to the round that wrote them**, because round 6 consolidated exactly those two and a present-tense claim would be the same defect one round later |
| 4 | Low | sentence | §3's *45 passages … verified by `rg -n 'retained_state'` over both trees* is **unbound and no longer true of any command**. The command returns **99** lines over **13** files today; restricted to §3's eight files, 48 lines, one of them `main.rs`'s `mod retained_state_contract`, leaving **47** — and `34cd5af..57e8800` added two while step 1's own review fixes were being applied, so the claim was already stale **at step 1's READY commit** | §22.4. **45** is bound to `34cd5af` and described as the **hand-judged passage inventory** (4 + 22 + 12 + 7), not a raw `rg` line count; **50 / 11** unrestricted there, **47** from `57e8800`, and **99 / 13 → 48 → 47** at `3ca9828` are all recorded with their revisions |
| 5 | Low | sentence | §12.2 says `rg -n 'decide\(' src-tauri/src/ crates/ --type rust` returns *exactly three* call sites *plus its definition*, and that *the only other match* is `ownership.rs`'s unrelated `decide`. The command returns **eight** lines — it also matches two `End of function decide()` markers and the unrelated function's own call and definition | §22.5. It now leads with the call-specific `rg -n '^\s+decide\(' src-tauri/src/ledger.rs` (**3**) and **accounts for all eight** lines the wide command returns, at `3ca9828` and `57e8800`. The substantive conclusion — exactly three call sites of the ledger `decide` — was re-verified and stands |

### The fix round disagreed with the reviewer once, and the reviewer's number was too small

Finding 3 named **two** stacked passages. The fix round refused to accept either pair and took the
inventory instead, with `rg -n '^\s*> \*\*(Correction|Corrected|Narrowed|Bound|Amend)'` at `5593a90`
— the leading `^\s*` being load-bearing, because the unanchored form misses every block indented
under a bullet — and then **read** each hit to see whether it sits under the same passage as its
neighbour. The record holds **four** such passages, not two: §14 item 5 (**three** blocks), §17.2,
§18.6 and §19.7. The orchestrator re-ran the anchored search independently — **24** blocks at
`5593a90`, at exactly the line numbers §22.3's table gives — and checked one near-miss pair by hand
(1567 and 1589 sit under different passages in §15, so they are correctly not counted). **The
review's pair is right about which two round 5 created and wrong as an inventory of the record.**

### The record-structure decision — the minimum taken, the rest put to the owner

Round 6 answered the standing question plainly: **the record has passed the point where further
stacking is better than consolidation.** It named a minimum and a broader option.

- **Taken.** §18.6's and §19.7's stacks are each now **one** block. Both prior wordings survive
  verbatim under per-round headings with the chronology explicit; the orchestrator verified this by
  searching the shipped file for each superseded wording and finding both. **Only navigational words
  changed** (*the block below* → *the part below*, and so on).
- **⚠️ NOT taken, and it is an OWNER DECISION, not a deferral by drift.** The broader reorganization
  of §18–§20 into a current account plus a historical appendix is recorded in §22.6 with **both**
  arguments intact — round 6's (a reader who stops at the first block reads a superseded narrowing;
  reorganizing *"would now improve reliability rather than merely aesthetics"*) and §21.7's (every
  block corrects a **specific sentence**, and dissolving them erases the audit trail by which rounds
  4, 5 and 6 each checked the round before them). **§14 item 5's three stacked blocks and §17.2's two
  go with it** — consolidating those would be the broader reorganization under another name.

### The fix round's own sweeps — four shapes, each bound to a revision

| Shape | What it hunts | Result |
|---|---|---|
| **D** | a printed, re-runnable command credited with an exact count that the command **as printed** does not produce (finding 1's shape) | 54 command lines, 17 constructions, **13 re-run and all reproduce**; **0** further instances |
| **E** | an inference or a correlation presented as a measurement (finding 2's shape) | 13 lines; **0** further instances |
| **F** | a cross-reference naming the wrong section, or an enumeration whose items do not match its count (finding 3's shape) | 32 lines, 26 of them in §§20–21, plus 4 forward promises; **1** found — §21.5's *It is §21.9's* names a hand-off §21.9 never took. Fixed with a block |
| **G** | a count over **source** with no revision binding, not re-run since the source changed (findings 4 and 5' shape) | 22 lines plus folded-in commands; **2** found — §13.2's five left-out-phrase figures and §19.2's **71** `.rs` files. **Neither is closable without running the guard**, and both are recorded as open rather than approximated |

**Sweeps D and E returning nothing is itself nominated as a likely round-7 finding** (§22.9 item 9):
a negative over a pattern this round chose, and a badly chosen pattern produces an empty sweep that
looks like a clean one.

### The gates — measured on this tree by the orchestrator, not inherited from the worker

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1313** passed, **0** failed, 26 result lines — **unmoved**, and necessarily: **no source file changed** |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 268 filtered out, **81.46 s**, run alone after `pkill` |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo doc --workspace --no-deps` | exit 0, **73** `links to private item`, **zero** unresolved |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** — the architecture rule holds |
| Source line counts | `prose_sweep.rs` **405**, `retained_state_contract.rs` **1305**, `liveness_contract.rs` **874** — all three **unchanged**, verified by `wc -l` |
| Inventories and shapes | **86** / **140** entries and **61** / **88** shapes, **unmoved by construction** — `git diff --stat -- src-tauri crates src` is **empty** |

`git diff --stat` is **two files, both under `docs/`**: `2d-4a-C-notes.md` 3593 → **4227** lines and
the review file 510 → **592**. The three frontend figures — **431** / **2125** / **184** — are
carried forward **unverified**, for the sixth consecutive round, and must be re-measured by any step
that touches `src/`.

### What this round leaves open, said plainly

- **The 78 / 57 tally is labelled unreproducible, which is honest and is not a repair.** Sweep C's
  table row still reads *plus 78 numeral-and-noun lines read*, and nothing establishes that 78 lines
  were read. §22.1 argues the figure was never a premise — **that argument is a reading of sweep C's
  own text, not a measurement**.
- **§3's inventory is knowingly two short of its own subject.** The two `ledger.rs` pointers added by
  step 1's review fixes were never judged into §3's tables, and **five** further sentences across §5
  and §14 are built on 45. They are consistent with each other and with the inventory; none is
  re-derived against the tree.
- **§22.3's four-passage table is a hand reading of `rg` output** — the listing is mechanical, the
  *same passage?* judgement was made by eye four times, and §22.9 nominates it as the likeliest thing
  in §22 to be wrong.
- **Two source counts cannot be closed without running the guard**: §13.2's five left-out-phrase
  figures need `prose_units`' comment-run joining, and §19.2's **71** reproduces only under
  `SWEPT_TREES`, which its sentence does not name.
- **The self-skip hole is unchanged and still has no owner** — 308 and 196 own-family matches sit
  unjudged in the two guards' own sources, and this round could not re-derive either figure.
- **Nine passages still call the consolidated blocks *blocks*, and none was edited**, each sitting
  inside a preserved wording or a historical sweep tally. §22.9 item 8 calls this **the strongest
  argument in the record for the broader reorganization** — and it was produced by taking the minimum.
- **The annotation count went UP by six** on a record whose readability is what round 6 filed:
  four stacked blocks became two, and this round added eight annotations.

## Verification — Phase 2d-4a-C step 2, review round 5 (NOT READY — 0 High, 0 Medium, 3 Low; **the fix is in the tree, every gate green, and round 6 is OWED**)

Appended verbatim to `docs/reviews/phase-2d-4a-C.md` under `## Step 2 — round 5`. Codex ran
**read-only** and wrote no file. Job `task-mtbtk4tg-ombcs4`, high effort, **~11 min**. Record
`docs/decisions/2d-4a-C-notes.md` §21.

The only edit to the reviewer's text was dropping the Codex session-ID trailer — **no heading
demotion**, for the third round running. The append is **66 insertions, 0 deletions**.

**The watchdog was killed mid-wait and the job was not.** `codex-wait.sh`'s known false-stall is why
this project polls the **log file's mtime**; this time the poll process itself died while
`node "$CC" status` showed `running` with a live `progressPreview` at 7m40s and `updatedAt` frozen
13 s after `startedAt` — the same frozen-`updatedAt` signature. The watchdog was relaunched against
the same job and it completed normally. **Do not re-dispatch on a dead watchdog; check the job.**

### The round, in one sentence

**Round 5 is the fifth consecutive round whose entire finding list is a previous fix round's own
work** — and it is the first round of this phase to **independently re-derive the fix round's own
measurements** rather than reason about them, reproducing every number in §20.6 from its own
in-memory replication of the sweep.

### The three findings, and what answers each

| # | Sev | Kind | The finding | The fix |
|---|---|---|---|---|
| 1 | Low | sentence | *"no existing hit was reworded away — every inventoried hit lives in a file its own guard sweeps, so those two are inside what the gates cover"* attributes to the **guards** something their comparison cannot establish. `complaints_against` compares only the **count** for each `(file, phrase)` key, so one occurrence can be reworded away while another of the same phrase appears elsewhere in that file and both guards stay green. **Round 4's finding 4 was the first half of this exact shape; round 4's own fix wrote the second half** | §20.5 and §21.2. Green guards now claim only *no inventoried count changed* and *no un-inventoried key appeared*. *No hit was reworded away* is re-attributed to the thing that actually established it — a **three-step diff argument the fix round ran**: all hits live in inventoried files (29 / 20); rounds 2 and 3 touched three source files, of which the inventories name exactly one; and neither diff contains that phrase, not even as context |
| 2 | Low | sentence | §20.7 prints `rg` searches beside their tallies — **36**, **13 plus 60**, **23** lines — which are correct for `2695cbb~1` but **carry no revision**. Re-run over the shipped record they return 66, 32 plus 77, and 49, because §20's own prose necessarily adds matches. The measurement is historically sound and not reproducible from the file that presents it | §21.3. All three tallies are **bound inline to `2695cbb~1`** and the historical figures kept — **not updated**, which would have destroyed the measurement. The fix round's sweep then found the same shape twice more, including §17.4's `git show HEAD:<path>` table, bound to `2ce4e47` |
| 3 | Low | sentence | *"the three gate tables of §16, §17.7, §18.7 and §19.9"* lists **four**, and the surrounding total of thirteen only works when all four are counted — a false arithmetic sentence inside the subsection that audits accounting errors | §21.4. **Four**, with the derivation written out: §16 (1) + §17 (4) + §18 (4) + §19 (4) = 13 |

### The reviewer was wrong about one thing, and the fix round checked rather than complied

Finding 1 said *"The module documentation expressly identifies this same-key substitution limit"*,
meaning `prose_sweep.rs`. **It does not.** The limit is stated in each **check**, not in the shared
machinery — `retained_state_contract.rs:60-63` and `liveness_contract.rs:25-26` — because
`prose_sweep.rs` explicitly defers inherited limits to the checks that use it. The orchestrator
verified this independently: `rg` for the limit's wording over `prose_sweep.rs` returns **nothing**,
and the retained-state guard's module header carries it verbatim (*"the key is `(file, phrase)`, so
swapping one recorded sentence for a different sentence using the same phrase moves no count"*). The
citation went where the sentence actually lives. **A reviewer's incidental attribution is a claim like
any other**, and this phase's whole subject is prose outrunning its code.

### The sweeps — for the shape, not the words

Three shapes, each **bound to a revision**, which is finding 2's own lesson applied to the fix (§21.5):

- **Shape A** — a claim attributing to the guards, or any green gate, a property their count-based
  comparison cannot establish. 21 lines; 2 cited, **one found beyond** — §18.6's round-4 block, on the
  *appearance* direction — 17 left in seven kinds. All five gate tables read directly: nothing.
- **Shape B** — a measurement printed with a re-runnable command but no revision bound. 43 lines, 23
  of them in §17–§20; **two found beyond** (§17.4's table and its `git show HEAD:`, and §17.6's two
  sentences), 12 left, two of those re-run to confirm.
- **Shape C** — an enumeration whose stated count disagrees with the items it lists. 30 + 78 pattern
  lines and **21 tables re-derived row by row**; **three found beyond**, one of which had been shipped
  at **`65a0138`** and missed by all five rounds: §13.3's *three rows are mixed* over **two**.

### What round 5 confirmed independently, and what it did not

Round 5 ran **its own in-memory replication** of the sweep and reproduced every figure §20.6 asserted
from a scratch script: 140 of 140 retained-state and 86 of 86 liveness inventory keys over the 70
files each guard selects with zero count disagreements; **308 = 95 / 192 / 21** and
**196 = 72 / 106 / 18**; the **6 / 11 / 4** reading of the 21; unchanged per-phrase counts and
matched-window multisets across `2bd7bd5~1..2bd7bd5` **and** `e75ec2b~1..e75ec2b`; 13 lines added to
each guard including exactly **20** added `///` lines; 224 hits over 29 files; the reverse-inventory
29 / 20; and §20.8's **+517** line delta. It also cleared §20.3's six-position table **row by row**,
and cleared the judgement not to grow `prose_sweep.rs`'s module doc.

**Two agreeing implementations of a measurement are still not a guard.** §21.6 records the
strengthening and stops there: nothing in the workspace re-runs either implementation, and §21.9
item 5 keeps the self-skip hole open with no owner.

### The gates — measured on this tree by the orchestrator, not inherited from the worker

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1313** passed, **0** failed, 26 result lines — **unmoved**, and necessarily: **no source file changed** |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 268 filtered out, 79.92 s, run alone after `pkill` |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo doc --workspace --no-deps` | exit 0, **73** `links to private item`, **zero** unresolved |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** — the architecture rule holds |
| Inventories and shapes | **86** / **140** entries and **61** / **88** shapes, **unmoved by construction** — `git status` names no file under `src-tauri/` |
| Source line counts | `prose_sweep.rs` **405**, `retained_state_contract.rs` **1305**, `liveness_contract.rs` **874** — all three **unchanged**, verified by `wc -l` |

`git diff --stat` is **two files, both under `docs/`**: `2d-4a-C-notes.md` 2954 → **3593** lines and
the review file's 66-line append. The three frontend figures — **431** / **2125** / **184** — are
carried forward **unverified**, for the fifth consecutive round.

**The host scar bit the fix round and was recovered from, and the account of it is an inference.** Its
first `cargo test --workspace` failed, exit 101, `279 passed; 9 failed`, all nine `watch_check::`
baseline-scan timeouts, with an orphaned test binary left by a run it had killed mid-compile. After
`pkill` the re-run passed and the bin target went 333 s → 110 s. **Nobody re-ran the failure with the
orphan removed and the build cold to separate the two causes**, and §21.8 and §21.9 item 7 say exactly
that rather than presenting the diagnosis as measured. The orchestrator's own verification pass
overlapped the worker's at one point; both of the orchestrator's runs came back clean (1313/0 and
20/20), so nothing was contaminated.

### What this round leaves open, said plainly

- **§21.2's diff argument is a three-step chain and nothing in the workspace re-derives any step.**
  It is reproducible from `2bd7bd5~1..2bd7bd5`, `e75ec2b~1..e75ec2b` and `231907e` by anyone who runs
  the four commands §21.2 names — that is the whole of its evidence. Step 2 in particular stops being
  true the moment any phrase of either family is written into a swept guard source.
- **Seven more correction blocks, and §19 and §20 now each hold sentences carrying two stacked
  blocks.** A reader who stops at the first reads a narrowing that has itself been narrowed. The fix
  round **kept annotating and said so, with its reason, in §21.7** — but round 5 itself said
  reorganizing §18–§19 would now improve readability, and §21.9 item 1 records that the argument for
  doing it is stronger after this round than before.
- **Two step-1 tallies in §3 and §12.2 read source, carry no revision, and were not re-run.** They
  were left because step 1 closed READY at its round 4; §21.9 item 6 records plainly that **this is
  not the same as their having been checked**.
- **§21.5's account of §19.6's finding-4 search survives only because §21 deliberately avoided the
  pattern's phrases** — a promise no later section is bound by, left unbound to avoid an eighth
  correction block on a sentence that is still true.

## Verification — Phase 2d-4a-C step 2, review round 4 (NOT READY — 0 High, 0 Medium, 4 Low; **the fix is in the tree, every gate green, and round 5 is OWED**)

Appended verbatim to `docs/reviews/phase-2d-4a-C.md` under `## Step 2 — round 4`. Codex ran
**read-only** and wrote no file. Job `task-mtbrwbtj-7p7k8k`, high effort, **402 s**. Record
`docs/decisions/2d-4a-C-notes.md` §20.

The only edit to the reviewer's text was dropping the Codex session-ID trailer — **no heading
demotion**, for the second round running, because the brief asked for `###` headings and none came
back at `##`. The append is **76 insertions, 0 deletions**.

### The round, in one sentence

**Round 4 is the fourth consecutive round whose entire finding list is a previous fix round's own
work** — and the first of the four to find **no code defect at all**: the round-3 read-path fix,
`SelectedFile`'s untestable non-UTF-8 argument and §19.4's assertion arithmetic were all cleared
against the diff, and every one of the four findings is a sentence in §19, the record round 3 wrote
about itself.

### The four findings, and what answers each

| # | Sev | Kind | The finding | The fix |
|---|---|---|---|---|
| 1 | Low | sentence | §19.2 described the alternative the review had **offered** as its opposite: *"a bare `PathBuf` … would move the lossy conversion back out of the selection layer and into the sweep, which is the opposite of what the finding asks for"*. Round 3's finding named bare relative `PathBuf`s **first** among its remedies and said to keep `to_string_lossy` at the `Hit::file` boundary — which is exactly where converting inside `sweep` would put it | §20.2. Both shapes satisfy the finding; `SelectedFile` was a **caller-simplicity preference, not a correctness argument**, and the record now says so. The fix round added the detail that makes the preference concrete: the conversion could not have left the selection layer anyway, because the skip lists are `&[&str]` |
| 2 | Low | sentence | Two defects in one place, §19.3. (a) *"the property the assertions defend … is unaffected by which of the two traversals answers"* **reintroduces the identity overclaim round 3 had just removed** — a filter between `selected_files` and `sweep`'s read loop, or a filesystem change between the two calls, drops a file from the walk while the test's fresh traversal still holds it. (b) *"the narrowed claim, which every corrected position now makes"* overstates uniformity: the six homes are each **true**, but `prose_sweep.rs`'s module doc states neither the second traversal nor the no-coupling limitation | §20.3. The uniform part is the **removal** — all six dropped the identity claim; five state the second traversal, two state the no-coupling limitation, the module doc states neither, and the record now tabulates which is which. The relapse is replaced by what is true: the assertions protect **what `selected_files` answers for those constants**, not the files that invocation of `sweep` opened — so widening `sweep` *would* buy real actual-walk coverage, which §19.3's refusal had denied |
| 3 | Low | sentence | §19.6's row 2 read `3 homes (§18.2; prose_sweep.rs selected_files doc; both guards' test docs)` against a total of 6 with 2 found beyond the citation. The review cited **four** positions — the two guards' test docs are two files, not one home — so the row's own arithmetic was 3 + 2 ≠ 6, in a section that describes itself as *cited position by cited position* | §20.4. The cell reads **4 positions**, named individually, and 4 + 2 = 6 holds. The fix round's own sweep then found a **second wrong cell in the same row**: its *inspected and left* cell counted sentences where every other cell counts positions |
| 4 | Low | sentence | §19.7 promoted the green guards past what they cover: *"both stayed green in both directions — which means the new prose matched no phrase of either family"*. **Each guard skips its own source.** A retained-state phrase written into `retained_state_contract.rs`, or a liveness phrase into `liveness_contract.rs`, is invisible to that file's own guard and would need no inventory entry. Green establishes **both** families only for `prose_sweep.rs`, and cross-family only for the two guards | §20.5 and §20.6. The gate evidence is scoped to what each guard actually sweeps, the self-skip is verified in code (`SKIPPED` = own source, `retained_state_contract.rs:288` / `liveness_contract.rs:203`), and — because this finding demanded work rather than a rewording — the inspection the guards cannot perform **was performed by hand** and is §20.6 |

### The inspection finding 4 demanded, and the number it produced

`prose_units`' comment-run joining and the lowercased substring search were **replicated by hand** and
run over each guard's own skipped source at `2bd7bd5~1` and `2bd7bd5`. The replication was
**validated against both inventories before being believed** — over the 70 files each guard really
selects it reproduces the retained-state `INVENTORY` exactly (**140 of 140**, zero disagreements) and
the liveness `INVENTORY` exactly (**86 of 86**, zero disagreements).

Result: round 3's additions — 13 lines to each guard, **20** of them `///` lines — introduced **no**
own-family phrase. `retained_state_contract.rs` holds **308** retained-state matches at both
revisions and `liveness_contract.rs` holds **196** liveness matches at both, with **zero** windows
gained or lost and per-phrase counts identical for all 88 and all 61 phrases. The same run over round
2 (`e75ec2b~1..e75ec2b`) is also empty. **So §19.7's claim was true of this commit — it was simply
not the guards that established it**, which is the whole of finding 4.

That inspection also put a number on a hole §14 item 5 had only ever stated qualitatively: **308 and
196 own-family matches sit unjudged and unjudgeable by their own guard**, split 95 / 192 / 21 and
72 / 106 / 18 across each file's phrase array, its inventory and everything else. The last column is
the part that is genuinely prose about the subsystem, and its 21 were **read**, not characterized.

### The sweeps — for the shape, not the words

Four shapes, swept, with the empty results said out loud rather than left silent (§20.7):

- **Finding 1's shape** — a record mischaracterizing a **rejected alternative**, especially one the
  reviewer offered. 36 `rg` lines, 8 refusals and trades inspected. **Zero** beyond the citation.
- **Finding 2's shape** — an *"every position now says X"* uniformity claim, and any surviving
  traversal-identity claim. 73 lines over two passes, **one** found beyond the citation — §19.6's own
  *all six now carry the narrowed sentence* — and corrected; 6 inspected and left.
- **Finding 3's shape** — an accounting table whose groupings break its own arithmetic. **Zero**
  further tables (13 re-added and 12 left), but **one further cell of the very row cited**. §13.3's
  *224 over 29* and §19.5's 29 / 20 were re-derived and are correct.
- **Finding 4's shape** — a green gate promoted past its coverage. 23 lines, **one** found beyond the
  citation and **worse than it**: §18.6 calls two of three edited files *the two swept files*, and
  one of the two is a guard's own skipped source. 18 lines left, in four kinds.

### The one judgement this round made, recorded as a judgement

Finding 2 could have been answered the other way — by growing `prose_sweep.rs`'s module doc until the
*every position* claim became true. **The record was narrowed instead**, on three grounds stated in
§20.3: this module's doc surface has grown three consecutive rounds and shrunk in none; a second copy
of one claim inside one module is this project's named failure mode; and the record must be made to
fit the code rather than the code enlarged to fit the record. §20.10 item 2 records plainly that a
round weighing it differently would edit the module doc, and that nothing enforces the link the
narrowed text now leans on.

### The gates — measured on this tree by the orchestrator, not inherited from the worker

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1313** passed, **0** failed, 26 result lines — **unmoved**, and necessarily: **no source file changed** |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 268 filtered out, 74.25 s, run alone after `pkill` |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo doc --workspace --no-deps` | exit 0, **73** `links to private item`, **zero** unresolved |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** — the architecture rule holds |
| Inventories and shapes | **86** / **140** entries and **61** / **88** shapes, **unmoved by construction** — `git status` names no file under `src-tauri/` |
| Source line counts | `prose_sweep.rs` **405**, `retained_state_contract.rs` **1305**, `liveness_contract.rs` **874** — all three **unchanged**, verified by `wc -l` |

`git diff --stat` is **two files, both under `docs/`**: `2d-4a-C-notes.md` 2437 → **2954** lines
(555 changed lines) and the review file's 76-line append. The three frontend figures — **431**
`npm run check` files, **2125** `npm test`, **184** `npm run build` modules — are carried forward
**unverified by this round**, which touched no path under `src/`, and that is now four consecutive
rounds of the same carry.

### What this round leaves open, said plainly

- **§20.6's inspection is a hand replication in a scratch directory, and nothing in the workspace
  re-runs it.** Its agreement with both inventories is strong evidence, not a proof, and it is a
  **second implementation** of `prose_units` — the very thing §18.8 item 4 refused to build inside a
  test. §20.10 item 3 names the two honest options for round 5: a test that sweeps each guard's own
  source with its own family and pins the count, or an accepted permanent hole. **A note in a record
  is what exists today.**
- **§20.3's six-position table is a hand reading, and nothing checks it.** A later edit to any of the
  six — the module doc especially — makes one of its rows false with no test failing.
- **The annotation cost compounded again.** Round 3 left six correction blocks and one inline
  addition; this round added five more, in §18.6, §19.2, §19.3, §19.6 and §19.7. Round 4 cleared the
  annotate-rather-than-delete policy as defensible and it is kept, but **§19 has now become what §18
  was — a section that cannot be read straight**, and §20.10 item 5 says a round that reorganizes
  rather than annotates should say so before starting.
- The workspace suite ran **twice** during the fix round (the first tail showed no total); recorded in
  §20.9 exactly as §10.6 recorded the same thing.

## Verification — Phase 2d-4a-C step 2, review round 3 (NOT READY — 0 High, 0 Medium, 4 Low; **the fix is in the tree, every gate green, and round 4 is OWED**)

Appended verbatim to `docs/reviews/phase-2d-4a-C.md` under `## Step 2 — round 3`. Codex ran
**read-only** and wrote no file. Job `task-mtbpygxs-u0wobv`, high effort, **302 s**. Record
`docs/decisions/2d-4a-C-notes.md` §19.

The only edit to the reviewer's text was dropping the Codex session-ID trailer. **No heading demotion
was needed this time** — the brief asked for `###` headings and none came back at `##`, so the file
stays one `##` per round without touching a line of the reply.

### The round, in one sentence

**Round 3 is the third consecutive round whose entire finding list is a previous fix round's own
work** — and the first of the three to find a **code** defect in it as well as sentences. All four
findings are new defects introduced by the round-2 fix; none is a restatement of wording already
corrected, and the reviewer says so in as many words.

### The four findings, and what answers each

| # | Sev | Kind | The finding | The fix |
|---|---|---|---|---|
| 1 | Low | **code** | The round-2 extraction was **not lossless**. `selected_files` answered a lossy `String` and `sweep` rebuilt the filesystem path with `root.join(&relative)`, where before the extraction it read through the real `PathBuf` from `rust_files_under`. A `.rs` file whose name is not valid UTF-8 gains a U+FFFD on the way into the string, so the new code would open some other path or none and panic where the old code read the file | `selected_files` now answers `Vec<SelectedFile>` — a lossless `relative: PathBuf` beside the lossy `reported: String`. `sweep` reads through `root.join(&file.relative)` and stamps `file.reported` on each `Hit`. **Skip membership is unchanged** (still matched against the lossy string), and `Hit::file` carries what it always carried, so no inventory key moved. The struct was chosen over a bare `PathBuf` because `sweep` needs both forms on every iteration and the six assertion sites go on comparing string literals |
| 2 | Low | sentence | *"`sweep` calls it, so there is one selection and a test observes the same one the sweep walks"* is false: each guard's `the_sweep_reaches_both_trees` calls `sweep()`, which drops its selection on return, and then calls `selected_files` **again**. The assertions read a **second traversal**, not the vector the sweep walked | Narrowed at **six** positions to what is true — the test re-derives the check's selection *through the same function the sweep selects with*, so it asserts what that function answers for those arguments; weaker than identity, stronger than a test that rebuilt the walk for itself. Each position also states that **nothing in the code holds the two traversals to each other**. The reviewer's alternative remedy — widen `sweep` to hand its selection back — was **refused**, see below |
| 3 | Low | sentence | §18.2's *"the `prose_sweep.rs` hit-based assertion is **kept**: nothing was dropped, four assertions were added"* is false. That assertion inspected `hits`; its replacement inspects `selected`. The retained-state test went from **four** assertions to **seven** — one replaced, four added, net +3 | The arithmetic is corrected and counted per guard (retained-state 4→7 with one hit-based assertion removed; liveness 3→7), with the true consolation the reviewer supplied: the `prose_sweep.rs` hit is still independently forced by the retained-state inventory's **reverse** comparison. §18.5, §18.6 and §18.7 reconciled to the corrected account |
| 4 | Low | sentence | §18.8 item 4's *"a change dropping one **file** would not [be caught]"* overstates the hole. A dropped file carrying **any** inventoried hit *is* caught, because `complaints_against`'s reverse direction finds its recorded `(file, phrase)` keys missing | Restated at its true size: only a file with **zero** family hits can disappear silently. §18.8's own cost/benefit argument about exhaustive enumeration is re-weighed on the narrower premise rather than left standing on the overstatement it was built on |

### The API-widening remedy was refused, and the refusal is a judgement

Finding 2 offered two remedies and the fix round took the narrowing one. §19.3 is the record and its
ground is this phase's own measurement: **§17.8 item 4 and §18.8 item 3 record that `prose_sweep.rs`'s
doc-and-API surface has grown every round and shrunk in none**, and the widening buys an upgrade from
*the same function, the same arguments* to *the same value* at the cost of a new signature, a new doc
paragraph and a new tuple at two call sites — all of it prose a later round must audit. The property
the assertions defend, that a file dropped from the walk is noticed, is unaffected by which traversal
answers. The worker's instruction was to **stop and report** rather than widen the API if it came to
think the widening right; it did not come to think so, and §19.10 item 4 records plainly that a round
weighing the surface cost differently would decide the other way and nothing in the code would resist.

### The sweeps — for the shape, not the words

This phase's measured pattern is that a fix round closes the cited position and leaves narrower ones
standing; round 2's fix corrected **one of three**. Each finding was therefore swept for its shape:

- **Finding 1** — 21 `to_string_lossy` / `to_str()` positions across `src-tauri/src/`. **Zero** further
  instances in the subject code. **One** same-shape position out of scope, `dispatch_check.rs:1044-1050`
  (a corpus file name becomes a copy destination), left deliberately and **named in §19.10 item 2** so
  it is not rediscovered as a new finding.
- **Finding 2** — 3 cited homes (4 positions), **2 found beyond them**: `prose_sweep.rs`'s module doc,
  and §14 item 5's round-2 amendment. Six corrected in all; four further positions inspected and left
  because they are true as written.
- **Finding 3** — 1 cited, **3 beyond**: §18.7's row, §17.2's block, §18.6's bullet.
- **Finding 4** — 1 cited, **0 beyond**, stated explicitly rather than left silent. The four other
  positions that look like it are each about a specific zero-hit file and are true; both inventories
  were checked.

### The gates — measured on this tree by the orchestrator, not inherited from the worker

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1313** passed, **0** failed — **unmoved**; no test added, and none could be (see below) |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 268 filtered out, 77.42 s |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo doc --workspace --no-deps` | exit 0, **73** `links to private item`, **zero** unresolved |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** — the architecture rule holds |
| Inventories | **86** liveness / **140** retained-state, both **unmoved**, counted on this tree |
| Source line counts | `prose_sweep.rs` **405** (was 377), `retained_state_contract.rs` **1305** (was 1297), `liveness_contract.rs` **874** (was 867) |

The three frontend figures — **431** `npm run check` files, **2125** `npm test`, **184** `npm run build`
modules — are carried forward **unverified by this round**, which touched no path under `src/`. The
`git diff --stat` confirms it: five files, none of them frontend.

### The one thing this round could not do, and says so

**Finding 1's fix has no automated statement behind it and cannot have one on this host.** The
`EILSEQ` this volume returns for a non-UTF-8 filename is what separates the two implementations, so
no probe here can demonstrate or refute `SelectedFile`'s claim that *a read through `reported` would
open some other path or none*. It is **fidelity restoration of the extraction, not the repair of
anything observable in this repository**, and §19.2 and §19.10 item 1 say exactly that rather than
letting the fix read as a bug closed. Faking the filesystem would be a bigger machine than the guard
it would defend.

## Verification — Phase 2d-4a-C step 2, review round 2 (NOT READY — 0 High, 0 Medium, 2 Low; **the fix is in the tree, every gate green, and round 3 is OWED**)

Appended verbatim to `docs/reviews/phase-2d-4a-C.md` under `## Step 2 — round 2`. Codex ran
**read-only** and wrote no file. Job `task-mtbo2a7o-0wtky8`, high effort, **262 s** — less than half
round 1's 604 s, on a narrower target. Record `docs/decisions/2d-4a-C-notes.md` §18.

The only edits to the reviewer's text were **heading depth** (its `##` demoted to `###`, so the file
stays one `##` per round) and dropping the Codex session-ID trailer. Nothing else was touched.

### The two findings, both confirmed by the orchestrator before anything was commissioned

**Finding 1 — Low, a sentence.** `retained_state_contract.rs`'s module doc still listed, as its
**fifth limit**, *"The both-direction comparison below is this test's own, and
[`crate::liveness_contract`] keeps its own copy of it"*, and went on to explain that the comparison
*stayed duplicated* because folding it would have rewritten the older check's tests. **Every clause
of it was false**, three lines above the file's own
`use crate::prose_sweep::{complaints_against, Hit, Judged};`. Round 1's fix had annotated §13.1 of
the record and left the module doc that repeats it standing.

**Finding 2 — Low, and it is a *behaviour* defect.** `the_sweep_reaches_both_trees` no longer proved
what the `SKIPPED` doc said it proved. Its fourth assertion had named `liveness_contract.rs` until
round 1's fix moved the sibling's one retained-state-shaped wording into `prose_sweep.rs`, leaving
that file with nothing for this sweep to find; the assertion was re-pointed at `prose_sweep.rs`.
**A hit-based assertion cannot prove coverage of a file that legitimately has zero hits**, so the
retained-state sweep could have been changed to skip `liveness_contract.rs` outright with all four
assertions still green.

### Two further instances the reviewer did not name, found by the orchestrator's own sweep

This is the project's declared recurring failure mode — *sweep for the shape, never for the words of
the finding you just closed* — and it applied to the reviewer as much as to a fix round.

- **`liveness_contract.rs:56–58`**, the sibling file, *"The four tests below are unchanged by that
  extraction, which is the evidence that it took nothing away."* False since round 1's fix rewrote
  `every_liveness_claim_is_judged` and its doc comment. Finding 1's shape, in the other file.
- **`docs/decisions/2d-4a-C-notes.md` §15 and §16** make the identical byte-identity claim that
  §13.1's own correction block retracts — §15's `liveness_contract.rs` bullet (*"`LIVENESS_SHAPES`,
  `INVENTORY` and the whole `mod tests` block are byte-identical to `HEAD`"*) and §16's last gate
  row — and **carried no annotation**. The round-1 fix corrected one of the three positions and left
  two.

A third observation, verified in the source rather than reported: the liveness guard's own
`the_sweep_reaches_both_trees` had **no assertion about its sibling at all**, so the *mutual*
non-exemption claim was unsupported in **both** directions, not one.

### What the fix built

- **`prose_sweep::selected_files(trees, skipped) -> Vec<String>`**, extracted out of `sweep`, which
  now **consumes it** (`prose_sweep.rs:228`) rather than keeping a second copy of the selection. That
  is the whole point of the remedy: a test that reimplemented selection would prove only the test's
  own copy.
- **Four hit-independent assertions in each guard's `the_sweep_reaches_both_trees`** — the sibling
  check is selected, `prose_sweep.rs` is selected, the skip list is exactly this check's own source,
  and the walk really excludes it. The three hit-based assertions are unchanged; the fourth,
  hit-based `prose_sweep.rs` one was **replaced** by its selection-based twin, which is not a
  weakening — that file's hit is already forced by `INVENTORY`'s reverse direction.
- **`SKIPPED` became `&[&str]`, named once.** `sweep` is passed it and the test reads it, so the list
  the test describes is the list the walk is given; writing `&[SKIPPED]` at the call site would have
  re-created the finding's own shape — two spellings of one skip list.
- **Both `SKIPPED` doc comments** now say what the tests actually assert, in both directions, and
  each says plainly that *neither exempts the other* is a claim the two tests carry **between** them
  and neither carries alone.
- **The record: correction blocks on §15 and §16 in §13.1's exact pattern**, second amendments to §14
  item 5 and §17.2, and a new **§18** (18.1–18.8) whose last subsection is what this round is thin
  about.

### The two red probes — re-run by the orchestrator, not accepted from the report

**This is the one acceptance criterion step 2's round 1 recorded as the worker's; this round it is
the orchestrator's.** Each probe adds the sibling to that check's own `SKIPPED` and is reverted by
**inverse edit**, never by git.

| Probe | Pre-probe digest | Result | Restored |
|---|---|---|---|
| A — `retained_state_contract.rs` skips `liveness_contract.rs` | `b8e9ee46…87e4` | **FAILED** at `:1224:9`, *"the sibling contract check is covered by this walk, hit or no hit — neither check exempts the other"* | `b8e9ee46…87e4` ✅ |
| B — `liveness_contract.rs` skips `retained_state_contract.rs` | `31f0264c…bf5d` | **FAILED** at `:796:9`, the same message | `31f0264c…bf5d` ✅ |

**The decisive line is the tally, not the failure**: both runs reported **`3 passed; 1 failed`**. The
guard itself and all three hit-based assertions stayed green under a walk that had dropped the
sibling entirely — which is the finding, demonstrated rather than argued. Two directions, two files,
and now two people.

### The byte-identity claim in the new correction blocks, verified as characters

The correction blocks assert that `LIVENESS_SHAPES` and `liveness_contract.rs`'s `INVENTORY` are
**still** byte-identical to `65a0138` while the `mod tests` block is not. Extracted from
`git show 65a0138:…` and from the worktree and hashed, bounding each array on the first `];` at
**column zero** — the wrong-boundary trap §13.1 records:

- `LIVENESS_SHAPES` — **IDENTICAL**, `30a7a31751288a2d`, 83 lines both sides.
- `INVENTORY` — **IDENTICAL**, `264c0e885d004afe`, 517 lines both sides.
- Entry counts unchanged: **86** liveness, **140** retained-state. **Zero inventory entries added,
  removed or re-counted** — this round's new prose matched no phrase of either family, and both
  guards were run after every edit to find that out rather than to confirm it.

### The gates — every one re-run by the orchestrator on this tree

- `cargo test --workspace` — **1313 passed, 0 failed**, 26 result lines all `ok`. **Unmoved**: no test
  was added, four assertions were added to two existing tests.
- `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` — **20 passed,
  0 failed**, 268 filtered out, 76.09 s.
- `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean.
- `cargo doc --workspace --no-deps` — **73** `links to private item`, the pre-existing count, and
  `rg '^warning: unresolved|^error'` finds **nothing**.
- `cargo tree -p espansoconfig-core | rg tauri` **empty**.
- `git status --short --untracked-files=all` shows **no path under `src/`**, so the frontend baselines
  (**431 / 2125 / 184**) are untouched and were not re-measured.
- Line counts after this round: `prose_sweep.rs` **377**, `retained_state_contract.rs` **1297**,
  `liveness_contract.rs` **867** — measured, and recorded in §18.6.

### Open risks carried into round 3 — §18.8 is the list, and these are its sharpest

1. **Coverage is asserted for three named paths and no more.** A change dropping a whole *tree* is
   caught by the hit-based assertions; a change dropping one **file** other than those three is not.
   The general form — *the selection is exactly the `.rs` files of the trees minus the skip list* —
   was deliberately **not** built, because it would be `selected_files` restated in the test.
2. **The three coverage paths are string literals and nothing checks that those files exist.** A
   renamed sibling fails loudly but reports the wrong cause: it reads as *the sibling is exempted*.
3. **Nothing pins what `selected_files`'s doc comment claims**, and this round added ~15 more lines of
   exactly the prose class `CLAUDE.md` names as this project's worst defect. §17.8 item 4 said the
   same of `complaints_against` one round ago: **the surface has grown, not shrunk.**
4. **§13.1's byte-identity evidence has now been invalidated twice by two consecutive rounds**, each
   for a good reason. There is no automated statement about the extraction left at all — only
   `65a0138` and this record's word for it.
5. **The two `SKIPPED` docs each describe what the *other* file's test asserts**, a claim neither file
   can check. §18.8 item 7 names it as round 3's likeliest finding site, beside §18.2's symmetry
   table.

## Verification — Phase 2d-4a-C step 2 (the check; implemented and green, **review round 1 done and its fix in the tree — round 2 is executed, see the section above**)

**The mechanism exists.** `src-tauri/src/retained_state_contract.rs` (1281 lines) is the analogue of
`liveness_contract.rs` for the family four review rounds kept finding, and
`src-tauri/src/prose_sweep.rs` (236 lines) is the machinery both checks now share. Record
`docs/decisions/2d-4a-C-notes.md` §13–§16.

### The extraction took nothing away, and that was verified as characters rather than accepted

The step's central risk was that factoring the sweep out of the shipped check would quietly weaken it.
**The orchestrator verified the three named blocks itself**, by extracting each from
`git show HEAD:src-tauri/src/liveness_contract.rs` and from the worktree and hashing them — not by
reading the diff, and not by accepting the worker's report:

- **`INVENTORY` — BYTE-IDENTICAL**, 518 lines, `e2e4a6270e28ab50`, **86 entries** in both.
- **`LIVENESS_SHAPES` — BYTE-IDENTICAL**, 84 lines, `d80261d59b83edc6`.
- **`mod tests` → EOF — BYTE-IDENTICAL**, 130 lines, `adb5e9dce3789523`. Its four tests therefore pass
  **unedited**, which is the whole proof that the older check came out exactly as strong.

**A first attempt at this comparison was wrong and is recorded because it nearly passed.** Bounding
each `const` array at the first bare `];` **over-ran into the extracted functions** and reported
`DIFFERS` for `INVENTORY` — the array closes on `]; // End of the recorded liveness inventory`, this
project's own closing-bracket convention. The over-running extraction swallowed seven function
definitions in the HEAD copy and one in the worktree copy, so the "difference" was the extraction's,
not the file's. **A comparison whose boundary is wrong reports a difference that is its own**, and the
same slip in the other direction would have reported a false IDENTICAL.

**No copy of the machinery remains**: `rg` for `fn rust_files_under|fn prose_units|fn window_around|fn
tally|struct Hit|struct ProseUnit|struct Judged|fn workspace_root` over `src-tauri/src/` finds them
**only** in `prose_sweep.rs`. `liveness_contract.rs`'s `sweep()` is now a two-line wrapper.

### Both directions were confirmed to exist, in the source and not only in the report

`every_retained_state_claim_is_judged` complains in **both** directions, read at
`retained_state_contract.rs:1222–1281`:

- a `(file, phrase)` the sweep **found** whose count differs from the inventory — including an
  expected count of zero, which is the unrecorded-hit case;
- an inventory entry the sweep **did not find**, whose message is *"inventory says N, found none —
  reworded or removed, so judge it again"*.

It additionally asserts that every inventory phrase is a member of the family, that every entry
carries a non-empty reason, and that there is **one entry per (file, phrase)**.

### The family has both halves, and the five phrase drops were checked rather than trusted

`RETAINED_STATE_SHAPES` is 88 phrases in three groups; group 3 is round 3's wording verbatim —
*atomic execution promoted into a correlated post-state when the mutations have different
predicates* — and carries **both** the guard vocabulary and the two-values-move-as-one vocabulary, so
it reaches the *unconditional paired insertion* round 2 corrected **and** the *conditional paired
removal* in `adopt_reloaded_revision_under_the_session_lock` that round 2's sweep could not see.

**Five candidate phrases were dropped for noise, and that is the one move this check cannot catch**
(`2d-4a-notes.md` §11.4). The record argues each with a measured hit count — `backwards` (36, only 4
the claim), `process-wide` (19), `one way` (12), `monotonic` (18, nine of them `Instant`), `in the
same breath` (5, rhetorical). **The orchestrator verified the claimed replacements exist rather than
taking the argument on its word**: `nothing evicts`, `for the life of`, `watermark backwards` and
`monotonic within` are all present in `RETAINED_STATE_SHAPES` (`:144`, `:162`, `:192`, `:195`) **and
all four carry live inventory entries**, so they fire. The drops were substitutions, not deletions —
but §14 item 4 correctly records that **nothing in the repository shows a phrase was ever in the
list**, and this is the judgement a later round is likeliest to disagree with.

### `persist/write.rs` is inventoried as judged out, not narrowed away

Six entries, five of them explicitly `**judged out**` and one a labelled false positive. The reason
line for `one entry per` says it in the required words: *"the boundary is drawn on the claim and is
recorded here rather than narrowed out of the pattern."* The substantive reason is round 4's — those
mutexes serialize disk writes and **nothing decides an observation, a drain, a suppression, a
coalescing or a save admission against them**. `persist/backup.rs` is inventoried as false positives.

### The two red probes — the worker's evidence, recorded as the worker's

**2d-3-C §4.4's standard is that the check is watched failing, and this is the one acceptance
criterion the orchestrator did not independently re-run**; it is recorded here as reported, with the
evidence the worker gave:

- **Probe 1, `reconciliation.rs`** (2d-4a round 5's retention defect): *"Of the three ways a stored
  entry then leaves"* became *"leaves this queue in exactly two / ways"*, wrapped across a line break.
  RED with three complaints — `leaves this queue` 3 vs 2, `three ways` 1 vs 2, `two ways` 2 vs 1 — and
  **`two ways` matched only via the joined comment run**, which is the load-bearing behaviour of
  `prose_units` demonstrated rather than asserted.
- **Probe 2, `dispatch_check.rs`** (round 6's watermark defect): the scope sentence *"Both drains here
  are the same epoch's… never across a replacement"* deleted, leaving `unconditionally` standing. RED
  in the **reverse** direction: *"across a replacement: inventory says 1, found none — reworded or
  removed, so judge it again."*
- Both reverted by **inverse edit**, each verified by `shasum -a 256` returning the pre-probe digest
  (`120583fe…4330`, `98a989ff…fd1db`), with all four tests green afterwards. Two directions, two
  files.

### The gates — every one re-run by the orchestrator on this tree

- `cargo test --workspace` — **1313 passed, 0 failed**, 26 result lines, exit 0. **+4** on the 1309
  baseline, which is the new check's four tests; the liveness check's four are unchanged and included.
- `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean.
- `cargo doc --workspace --no-deps` exit 0 — **73** warnings, **every one** `links to private item`,
  the pre-existing count; `rg '^warning: unresolved|^error'` finds **nothing**, and `espansoconfig`
  (the shell, where both new modules live) emits **no** doc warning at all.
- `cargo tree -p espansoconfig-core | rg tauri` **empty** — the architecture rule (D2x).
- `git status --short` shows **no path under `src/`**, so the frontend baselines (431 / 2125 / 184)
  are untouched and were not re-measured.


### Step 2 review round 1 — **NOT READY (1 Low, and it is a *code* defect)**, and the fix that answers it

Appended verbatim to `docs/reviews/phase-2d-4a-C.md` under `## Step 2 — round 1`. Codex ran
**read-only** and wrote no file. Job `task-mtbmi9p6-ia8b5z`, high effort, **604 s**. Record §17.

**This is the first finding of the whole phase that is not prose-only.** Rounds 1–4 of step 1 each
found a false sentence beside right code; this one found working prose over a guard that did not do
what it said.

**The defect: zero as an "unseen" sentinel, in *both* guards.** The comparison loop read
`or_insert(0)` → `assert_eq!(*slot, 0, …)` → `*slot = entry.count`, and its reverse direction was
guarded by `*count > 0`. Two invariants each test **expressly claims** were therefore defeated:

- a first inventory entry with `count: 0` leaves the slot at zero, so **a duplicate for that
  `(file, phrase)` passes** the uniqueness assertion;
- **a phantom entry — one matching nothing — passes the reverse check**, which is precisely the
  *reworded or removed, so judge it again* direction the guard exists for.

**Nothing was broken on the shipped data** — all 86 liveness entries and all 140 retained-state
entries carry positive counts — which is why it is a Low. **The orchestrator confirmed both halves by
reading before commissioning the fix**, rather than accepting the finding.

**The defect was pre-existing in `liveness_contract.rs`, and the duplication propagated it into the
new check.** That is the concrete instance of the failure mode **§14 item 7 predicted in the same
breath as accepting the trade**, and the review's own audit item 6 says so. So the fix is **not** to
repair it twice: `prose_sweep::complaints_against(hits, inventory, shapes)` now holds the comparison
**once**, both guards call it, and each keeps only its own final `assert!` sentence. `entry.count > 0`
is a hard error with a message saying why; duplicates are detected by
`recorded.insert(key, count).is_none()` with **no sentinel**; the reverse loop lost its `count > 0`
condition and now covers **every** recorded key. `prose_units` is untouched.

**What the discharge cost, stated rather than elided.** §13.1's proof that the extraction took
nothing away was that `liveness_contract.rs`'s four tests pass **byte-identical**. Folding the
comparison rewrites that guard test, so **that proof is now historical** — it holds at commit
`65a0138` and **cannot be re-derived from the current tree**. §14 item 7 is amended to say the trade
is discharged and what it cost, not deleted; §13.1 carries a correction block.

### The check caught its own refactor, and that is better evidence than any probe

**One `INVENTORY` entry had to change, and it is the only one.** Extracting the comparison physically
moved the assertion string `one entry per file and phrase` out of `liveness_contract.rs` into
`prose_sweep.rs` — and **that string was itself an inventoried retained-state hit**. The guard failed
on the first run **in both directions** and printed it.

**The entry was re-pointed, not deleted, and the orchestrator ruled on that rather than leaving it to
the worker.** `file` moved from `src-tauri/src/liveness_contract.rs` to `src-tauri/src/prose_sweep.rs`;
`phrase` (`one entry per`), `count` (`1`) and the judgement (false positive) are **unchanged**, and the
reason was reworded to stay true and to record the move. 140 entries before and after. **The
alternative was to reword the assertion message so the hit disappeared, and that is exactly the
narrow-the-pattern-until-the-hit-vanishes move `2d-4a-notes.md` §11.4 records as the one such a check
cannot catch.** Re-pointing preserves a judged position; rewording would have destroyed one to keep a
test quiet. For the same reason `the_sweep_reaches_both_trees`'s last assertion — which asserted
`liveness_contract.rs` appears among the retained-state hits — became **false** and now names
`prose_sweep.rs`. Both are recorded in §17.2 and §14 item 5.

**Verified by the orchestrator, not accepted**: the diff of `retained_state_contract.rs` changes
exactly one entry's `file` and `reason` and nothing else in the data; the diff of
`liveness_contract.rs` is **purely** the comparison's removal, with no `file:`/`phrase:`/`count:`/
`reason:` line touched, so `INVENTORY` (86) and `LIVENESS_SHAPES` are untouched there.

### The probes — eight, four per guard, and the shared line numbers are the evidence

Reported by the worker and recorded as the worker's; all exit 101, all reverted by **inverse edit**
with `shasum -a 256` matching the pre-probe digest (liveness `14229287…aae50`, retained
`0ecdc2f3…b8997`). Four modes: a **phantom** entry; a **duplicate whose first has `count: 0`** — the
exact case the old sentinel let through; a **duplicate both positive**; and an **existing entry set to
`count: 0`**. **The two zero-count modes both fail at `prose_sweep.rs:307` and the duplicate at
`:314`, reached through *both* guards** — which is what proves the comparison is genuinely shared
rather than merely called from two places. Full table with all eight digests in §17.5.

### The gates after the fix — every one re-run by the orchestrator

- `cargo test --workspace` — **1313 passed, 0 failed**, 26 result lines, exit 0. **Unmoved**: the
  repair changed guard logic, not coverage.
- `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean.
- `cargo doc --workspace --no-deps` exit 0 — **73** `links to private item`, the pre-existing count;
  `rg '^warning: unresolved|^error'` finds nothing.
- `cargo tree -p espansoconfig-core | rg tauri` **empty**; **no path under `src/`**, so the frontend
  baselines (431 / 2125 / 184) are untouched and were not re-measured.
- The comparison exists **once**: `rg` finds `fn complaints_against` only in `prose_sweep.rs:288`,
  called from `liveness_contract.rs:791` and `retained_state_contract.rs:1234`.

### Open risks carried into the Codex round

1. **A third `rust_files_under` exists and was not folded.** `src-tauri/src/dictionary_contract.rs:622`
   has its own, with a **different signature** (`&str`, not `&Path`). It predates this phase and was
   out of scope, but "a fix made in one copy and not the other" is this project's named failure mode
   and there are now two functions of that name in one crate.
2. **The ~45-line both-direction comparison is duplicated** between the two checks — a deliberate trade
   (§14 item 7): folding it would have rewritten `liveness_contract.rs`'s tests, which is exactly the
   evidence that the extraction took nothing away. Real cost, named in the module doc and the record.
3. **The five phrase drops** (§13.2, §14 item 4) — the move the check cannot catch, exercised by the
   step that built the check.
4. **140 reason lines are new prose**, and §14 item 11 names them as the likeliest finding site,
   singling out the reasons that summarise several passages at once (`outlives` covers twelve hits,
   `until the epoch` seven, `no decision can` five).

## Verification — Phase 2d-4a-C step 1 (the contract and its pointers; **CLOSED** — four review rounds, rounds 1-3 NOT READY and each fixed, round 4 READY with 0 findings)

**The owner's decision, and it is the thing a fresh session cannot re-derive.** On 2026-08-27 the
standing question recorded at the head of "Next action" — *round 7 first, or the mechanism first* —
was put to the owner and answered **build the mechanism first**. Round 7 is deferred, not cancelled,
and it will then review the mechanism as well as the round-6 fix. The commissioned work is **Phase
2d-4a-C**, the analogue of 2d-3-C, in **two steps**: the contract and its pointers (step 1, this
section), then the check (step 2).

**Why a contract and not a seventh round.** Six rounds, all NOT READY, all finding a real defect in
what the round before built — and **two consecutive rounds found the same failure shape**, a rule
stated without the scope that bounds it: round 5 on the queue's retention boundary, round 6 on the
watermark. `2d-4a-notes.md` §15.4 named the absence in as many words: nothing fails if a future edit
drops a qualification, the way `liveness_contract.rs` fails on an unmarked liveness claim.

### What step 1 built

- **One canonical statement**, `crates/espansoconfig-core/src/watch/retained_state.rs` — 211 lines
  and **zero non-comment lines**, exactly as `watch/liveness.rs` declares no item. The family is
  drawn around **claims a consumer's correctness depends on**, never around the vocabulary: the three
  holders are the core's process-wide identity register, the shell's write ledger and the shell's
  reconciliation queue. 9 guaranteed clauses, 8 expressly not, and a "what this module is not".
- **It lives in the core, and the tension is stated rather than smoothed over.** Two of the three
  holders are `src-tauri`'s and the core does not own them; but a doc comment creates no dependency
  (CLAUDE.md §3 is not at risk), R9's register *is* core-side, and only a core doc comment can be
  reached from both trees by a **compile-checked** intra-doc link — both crates deny
  `rustdoc::broken_intra_doc_links`. Shell items are named as **plain text**, as `liveness.rs` names
  `decide`. The worker drove the link gate to red by renaming the module.
- **45 pointers, judged one at a time** — 37 compile-checked, 8 plain text in `#[cfg(test)]` modules
  or `//` comments, which rustdoc never resolves. A passage stating a fact about its own call site
  keeps that fact and points for the rest. §3 of the record carries the judgement for each.
- **31 prose units judged out of the family**, the boundary argued rather than pattern-matched:
  backup-file rotation (`persist/backup.rs`, ~40 vocabulary hits and not one claim of this family),
  resource and thread lifetimes, the revision-keyed parse cache, the engine's determinism
  qualification, and plain false positives.
- **A false claim found in the tree and fixed, reported loudly** (record §4): `ledger.rs`'s module doc
  named *a serialized reading* as one of the four things that end an app-write record, where `decide`
  clears it for **every** reading that survives both retaining checks — the ordinary external change
  included. `decide`'s own doc has contradicted the module header **since round 8**, so the record
  held its own refutation for six rounds. A narrower instance in `CommitAnchor` was fixed with it.
  Words only; **no behaviour changed**, which was step 1's explicit scope limit.

### The gates — every one re-measured by the orchestrator on this tree, not accepted from the report

- `cargo test --workspace` — **1309 passed, 0 failed**, 26 result lines all `ok`, exit 0. **+0**: this
  step added no test, and the baseline held exactly.
- `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean.
- `cargo doc --workspace --no-deps` exit 0, **73** `private_intra_doc_links` warnings (the
  pre-existing count), **zero unresolved links** — this is the gate that proves the 37 pointers are
  compile-checked.
- `cargo tree -p espansoconfig-core | rg tauri` **empty**.
- `git diff --stat` shows **no path under `src/`**; the frontend baselines (431 / 2125 / 184) are
  therefore untouched and were not re-measured.
- **The non-comment change was verified independently, not accepted**: filtering the diff for
  non-comment, non-blank changed lines in both source trees returns **exactly 7 lines, all
  additions** — `pub mod retained_state;` and the six-line `Judged` entry the *existing*
  `liveness_contract.rs` demanded, because the new module's own disclaimer contains the phrase
  "observed again". The worker watched that check go red and then green, and filed the entry as a
  **pointer** rather than rewording the module to dodge the sweep, which is the move
  `2d-4a-notes.md` §11.4 records as the one the check cannot catch.

### What step 1 does **not** close — record §5, and step 2 starts here

1. **There is no check.** Nothing fails today if an edit drops a qualification or restates the claim
   beside a pointer. What was bought is the reduction of surface — one place to be right instead of
   fifty — plus a real guarantee about the **link** and none at all about the **sentence**.
2. **Eight of the 45 pointers are not compile-checked** and a rename leaves them silently stale.
3. **The contract's clauses are prose over code**, and no test fails if one drifts from the code it
   cites. §2's tables are an audit trail, not an oracle.
4. **G4's *exactly three* and G8's *the one exception* rest on a reading** of every mutation of one
   field; nothing fails when a fifth appears. The contract says so where it states them.
5. **The sharpest limit, and step 2 inherits it as a limit rather than a detail:** the sweep ran
   recursively over both trees with 33 probe phrases over 85 prose units, comment runs joined — and
   **four of the 45 pointer passages sit in units none of the 33 phrases matched**
   (`ReconciliationWake::newest_sequence`, `drain`'s inline `max` comment, `CommitAnchor`,
   `LedgerState::announced`), found by reading. That is direct evidence that **a phrase family is not
   the family**. `watch/native.rs`'s `NativeWatch` handle is a fifth such unit.
6. **No count of positions left as local facts is asserted**, deliberately: the sweep's grain is a
   prose unit and the pointer's grain is a passage, and reconciling the two by hand is the arithmetic
   §15.1's L5 and 2d-3's round 14 both got wrong.
7. **The closest call, recorded rather than left silent.** `persist/write.rs`'s lock registry is one
   entry per real path ever written, process-wide, never evicted, leaking a `&'static Mutex<()>` per
   path — **R9's exact shape in a second subsystem, unmeasured** — and is judged **out** because
   nothing decides an observation, a drain or a save admission against it. **Step 2's phrase family
   will hit it, and must inventory it as a judged position rather than narrow the pattern away.**
8. **R9 is OPEN.** N1 states it as the unbounded retention it is and adds nothing to the three
   rounds' verdicts. Writing a residue into a contract is not a closure, and the contract says so.
9. **`docs/` is not covered and cannot be** — `2d-4a-notes.md` quotes six rounds' false sentences on
   purpose, so any check over it fails on its own record. 2d-3-C §5 limit 4, inherited unchanged.

### Review round 1 — **NOT READY (1 High, 1 Low, both prose)**, and the fix that answers it

`docs/reviews/phase-2d-4a-C.md` holds it verbatim. Codex changed no source file; the review file was
its only write.

**The High is G9, and it landed on one of the three sites record §5 item 11 had named.** The clause
said *"a commit anchor lives as long as the epoch"* and *"exactly one thing removes an anchor: the
workspace replacement"* — asserting **one lifetime for three different subjects**:

1. the **app-write record**, which four things end (this half was right, and is step 1's own §4 fix);
2. the **per-path map slot and the latest-commit chronology fact**, which *is* epoch-lived;
3. the **concrete `CommitAnchor` value**, which `WriteLedger::record_app_write` drops and replaces on
   **every later commit to the same path**, well before the epoch ends.

The module defines its family as retained **values**, which is precisely what makes the conflation a
defect rather than a quibble. **`src-tauri/src/ledger.rs:1258`'s local insertion comment stated the
true thing all along** — the second time in two rounds this file has held a correct local statement
beside a false general one, which is the finding and not a coincidence.

**The Low**: the contract's introduction called the three discoveries *"three consecutive review
rounds"* when its own enumeration is round 5, round 6 and **this implementation step**, which was no
review round at all.

**What the reviewer cleared**, and it is worth recording because these were the orchestrator's least
certain calls: the **core placement** is *"the least-bad placement for a compile-checked cross-crate
documentation target"*, with the tension stated honestly and no dependency inversion introduced;
**`persist/backup.rs` is correctly out** (an on-disk rotation policy with its own contract, and
nothing is decided against it); and **`persist/write.rs`'s lock registry is defensibly out** — the
retained object is *synchronization, not observation state* — with step 2 still obliged to inventory
it as judged-out rather than phrase-tune around it. It also confirmed step 1's **ledger fix left no
narrower instance** of that wording standing.

### The fix round, and what its sweep found

**G9 was restated by fixing its subject, not by hedging it.** The anchor half is now a claim about the
**per-path slot and the chronology fact it answers** — *when did this session last commit to this
path* — of which exactly one thing removes it, the workspace replacement; and it says expressly that
this is **not** a claim about the concrete value, which a later commit supersedes, the slot never
emptying and the fact staying true *because* the value was replaced. **The consumer guarantee is kept
and called out**: none of the record's four ends touches the anchor, so a reading older than this
session's latest commit to a path is refused even where the record is gone.

**The sweep judged 152 family sentences one at a time**, 132 of them in the ten pipeline files, and
found **ten false positions — eight beyond the reviewer's two**: `ledger.rs`'s module-doc
*anchor-outlives-the-record* paragraph, `Admission::PrecedesACommit`, `LedgerTally::preceded_a_commit`,
`LedgerState::writes`, `begin_epoch`'s inline anchor comment, `record_app_write`'s doc, `decide`'s
step-1 check list, and **two test comments**.

**The sweep reproduced this project's named failure mode inside itself, and caught it before editing.**
Its first pattern was `commit anchor|CommitAnchor|latest_commit_at` — written from the *reviewer's*
wording — and it missed the two test comments; they surfaced only after widening to `\banchor`. That
is `CLAUDE.md`'s rule demonstrated once more: **sweep for what the sentence now says, never for the
words of the finding you are closing.** `record_app_write`'s correct insertion comment was kept
verbatim.

**N2 and N5 were examined and left**, both true as written: N2 denies a capacity policy and neither
map has one (its *entries leave one at a time* is a restriction — true of `announced`, vacuously true
of `latest_commit_at`, which never removes an entry individually); N5 is an existence counterexample
matching `enqueue`'s eviction arm and `begin_epoch`'s whole-state assignment.

**Record §5 item 11's prediction half held**: the High landed on G9, one of the three sites it named;
the Low landed on line 8, which it did not.

### The gates after the fix round — re-measured by the orchestrator

- `cargo test --workspace` — **1309 passed**, 26 result lines, **zero failures**, exit 0. **+0**.
- `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean.
- `cargo doc --workspace --no-deps` exit 0, **73** `private_intra_doc_links`, **zero unresolved or
  ambiguous links**.
- `cargo tree -p espansoconfig-core | rg tauri` **empty**; `git diff --stat` shows no path under
  `src/`.
- **Prose-only, verified rather than asserted**: filtering the diff of both source trees for
  non-comment, non-blank changed lines returns **0**. No code defect was found; all ten corrections
  were comments.

### Review round 2 — **NOT READY (1 High, 1 Medium)**, and the fix that answers it

Appended verbatim to `docs/reviews/phase-2d-4a-C.md`. Codex changed no source file.

**The High is the round-1 fix's own new text, at the exact clause round 1 found false.** The fix ended
G9 with *"none of the record's four ends touches the anchor"* — **false under both the value sense and
the slot sense it had just separated**: `record_app_write` ends the old record **and replaces the old
`CommitAnchor`** (`ledger.rs:1284`, `:1303–1309`), and `begin_epoch` clears **both** the record map and
`latest_commit_at` (`:1195`, `:1206`). Two of the four ends touch anchor state. **The fix corrected
G9's subject and then collapsed the distinction again one sentence later**, which is this project's
recurring shape, now demonstrated inside the mechanism built to stop it.

**The Medium is a claim family the round-1 sweep could not see, and it is the most valuable thing this
round produced.** `ledger.rs:494` and `:1232` said, unqualified, that the shared insertion guard means
**no decision can see the record without the anchor, or the anchor without the record**. That is false,
and **seeing an anchor after its record is gone is the intended design** — Phase 2d-3 round 9's
mechanism, and **G9 depends on precisely that state**: `decide` reads the two independently
(`:2071–2072`) and every path below its two retaining returns calls `clear_the_record_at` (`:2137`),
which expressly leaves `latest_commit_at` alone. The mutex proves only that a decision **cannot
interleave with `record_app_write` and observe a half-written pair**. `record_app_write`'s doc repeated
the false claim and then, lines later, said clearing the record leaves the anchor standing — **the
third time in three rounds this file has held its own refutation**.

**Why the sweep could not see it: it is a *co-existence* claim, not a *duration* claim.** It asserts
two values are always observed together, in none of the vocabulary of lifetime, removal or survival
that round 1's widened pattern was built from. The reviewer calls it *"a genuine miss by the widened
sweep"*. **Step 2's phrase family must absorb this**, or the checker ships with the same blind spot the
sweep had — record §10 carries it as this round's standing lesson.

**What round 2 cleared, and step 2 may rely on**: G4's *exactly three* (the four production mutation
sites of `QueueState::pending` confirmed at `reconciliation.rs:1097`, `:1102`, `:1187–1189`,
`:1029–1030`), G8's *one retained value*, **N2** and **N5** are all true at their stated boundary, and
**G9's slot/value account before the false summary now matches production code**. It also confirmed the
fix did **not** weaken the guarantee — the consumer protection is present; only its stated premise was
false. The `stamp_the_anchor_at` seam is explicitly test-only and does not refute the guarantee.

**The stopping rule was tested and did not trigger.** The brief carried the instruction to say so if
the findings were only restatements. The reviewer answered unprompted: *"These are not merely
restatements of round 1's wording… Both have new substantive content."*

### The round-2 fix, and what its two sweeps found

**G9's conclusion is restated as three distinct cases**, the consequence kept but re-derived from a
true premise: (a) **within the retained epoch, a reading or reload that clears a record does not touch
the anchor** — `clear_the_record_at` removes the record and the path index and expressly leaves
`latest_commit_at` alone; (b) **supersession preserves the per-path slot**, replacing its value with the
*newer* anchor, so the write that ends a record leaves the path anchored; (c) **epoch replacement does
clear the anchor, and costs nothing** — the epoch fence refuses a predecessor's observation *before*
chronology is consulted (G3). The false universal is named inline as the round-2 High.

**All three co-existence sentences are narrowed** to *no decision can interleave with this insertion and
observe a half-written pair*, each stating expressly that this is **not** a claim the two are always
seen together, and **each naming the state that refutes it** — an anchor with no record below the
retaining checks; an announcement with no record after step 3 or step 5.

**Two sweeps, and the second is the one that shows the first fix held.**

- **Co-existence**: 339 positions on the bare pattern, 66 conjoined with a family subject, of which
  **3 are the claim shape and all 3 were false** — the review's two plus **one beyond them**,
  `record_app_write`'s *"the two cannot be observed apart"* about the announced state and the record
  (`ledger.rs:1261–1263`).
- **Duration, re-checked**: **199** sentences across 31 files (54 ledger, 22 commands, 18
  reconciliation, 14 `retained_state`) — **zero** new false positions, which is evidence that round 1's
  widened pattern was thorough *within its own family* and blind *outside* it.

**Three ambiguity positions were tightened, none of them a weakening**: `begin_epoch`'s *"one place a
commit anchor is removed"* (`ledger.rs:1198`) and `CommitAnchor`'s subjectless *"Written by / read by /
removed by"* triple (`:805`) now name the **slot**; and **N2**'s *"Entries leave them"* became *"A
path's slot leaves them"*. N2 is the one edit no reviewer asked for, and record §10.7 item 5 says so:
it is not a weakening because under the *value* reading the old sentence is **false** of the anchor map,
so naming the slot selects the reading round 2 certified true, and the capacity denial is untouched.

### The gates after the round-2 fix — re-measured by the orchestrator

- `cargo test --workspace` — **1309 passed, 0 failed**, 26 result lines, exit 0. **+0**.
- `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean.
- `cargo doc --workspace --no-deps` exit 0, **73** `private_intra_doc_links`, **zero unresolved,
  ambiguous or error**.
- `cargo tree -p espansoconfig-core | rg tauri` **empty**; no path under `src/`.
- **Prose-only, verified not asserted**: non-comment, non-blank changed lines across both source
  trees = **0**. No code defect found; in every case the code was right and the comment wrong.

### Review round 3 — **NOT READY (0 High, 1 Medium, prose-only)**, and the fix that answers it

Appended verbatim to `docs/reviews/phase-2d-4a-C.md`. Codex ran **read-only** and wrote no file; its
final message was the deliverable and the orchestrator appended it. Job `task-mtbiox9r-v74dy9`,
high effort, 301 s.

**The count is falling, and that is the fact the owner is owed at this handoff.** Round 1: 1 High,
1 Low. Round 2: 1 High, 1 Medium. Round 3: **0 High, 1 Medium**. And round 3 **cleared six of the
seven attack-list items** — G9's corrected conclusion, all three narrowed co-existence sentences,
the slot/value wording at `CommitAnchor` and `begin_epoch`, N2 (the edit no review had asked for),
G4's *exactly three*, G8's *the one exception*, and N5. The unreviewed remainder of step 1 is now
**one paragraph of new prose**, twelve lines long.

**The Medium is a fourth member of round 2's co-existence family, in the one shape round 2's own
sweep could not see.** `adopt_reloaded_revision_under_the_session_lock`'s doc
(`src-tauri/src/ledger.rs:1656`) said *"Both invalidations happen under one state guard, taken once
here, so no decision can observe the record cleared and the announcement still standing, or the
reverse."* Both invalidations are **independently conditional** — the record is cleared only when
its revision differs from the reload, the announcement removed only when its state differs — so a
reload the announcement already names but the record does not leaves an announcement with no
record, and the converse leaves a record with no announcement. **Both are intentional**, and the
same doc comment says so **twelve lines above the false sentence**: *"the equal cases are kept
deliberately, and the two comparisons are independent."* That is the **fourth time in this phase**
`ledger.rs` has held a correct local statement beside a false general one.

**Round 3 names the family more precisely than round 2 could**, and this is what step 2's phrase
family must absorb: not *two values are always seen together*, but **atomic execution incorrectly
promoted into a correlated post-state when the mutations have different predicates**. Round 2's
three corrected sentences are all about an **unconditional paired insertion**, which is why its
sweep, written from them, could not reach a **conditional paired removal**.

### The round-3 fix, and what its sweep found

**The corrected sentence claims what the guard proves and nothing wider**: no decision can interleave
between the two conditional checks and the removals they select, so none meets a half-applied
invalidation. It then **denies predicate agreement expressly**, names both predicates as the body
writes them, states that both one-sided post-states are legal **after the method returns**, and
**points at** the *equal cases are kept deliberately* paragraph rather than restating its argument.
The false sentence is named inline as round 3's Medium, as the round-1 and round-2 fixes named
theirs.

**Round 3's four predicted round-4 regressions were all avoided, verified by reading after the edit
rather than asserted**: the independence statement above the sentence and the two predicates below
it are byte-identical; the three insertion-atomicity passages round 3 cleared are untouched; and
`clear_the_record_at`'s genuinely unconditional record/index pairing was not generalized. The
`ledger.rs` diff is **one hunk**.

**The sweep, and its pattern was derived from the claim rather than from the finding's words** —
`CLAUDE.md`'s standing rule, and the third consecutive round to supply evidence for it. Both trees,
recursive, `#[cfg(test)]` modules and `//` comments included, **comment runs joined into prose units**
because a ~76-column wrap puts a claim across a line break. Pass 1: 26 regexes, 97 matching runs, 138
windows judged. Pass 2 widened by 13 regexes **on suspicion rather than on a hit**: 166 runs, **252
windows judged**, 114 of them new — and the widening found **nothing further**. Of the 252, **12 are
the claim's subject matter; 1 was false and is fixed, 11 are true and were left**, each listed in
record §11.3 with the code checked against it.

**One position beyond round 3's list was examined and deliberately left with its residue written
down**: `documents_by_path`'s field doc (`ledger.rs:1093–1104`) claims a pairing that is true at
every mutation site but rests on the one-`DocumentId`-per-path invariant **Rust does not enforce**.
The residue of violating it — an orphaned `writes` entry no decision reads, cleared at the next
`begin_epoch` — is recorded so round 4 can **disagree with the judgement rather than rediscover the
position**.

### The gates after the round-3 fix — every one re-measured by the orchestrator on this tree

- `cargo test --workspace` — **1309 passed, 0 failed**, 26 result lines, exit 0. **+0**.
- `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean.
- `cargo doc --workspace --no-deps` exit 0, **73** warnings and **every one of them** `links to
  private item` — zero unresolved, zero ambiguous, zero error. `espansoconfig` (the shell) emitted
  **no** doc warning, which is what proves the fix's new `[ObservedState::Content]` link resolves.
- `cargo tree -p espansoconfig-core | rg tauri` **empty**; `git diff --stat` shows **no path under
  `src/`**, so the frontend baselines (431 / 2125 / 184) are untouched and were not re-measured.
- **Prose-only, verified not asserted**: filtering the diff of both source trees for non-comment,
  non-blank changed lines returns **0**. No code defect was found — the code was right and the
  comment wrong, for the third round running.

### Round 4 is owed, and step 2 still must not start before it

**A fix is a change, and the round that reviews it is not optional** — and in this phase that is not
a precaution, it is the measured record: **rounds 1, 2 and 3 each found the previous fix round's own
new sentence defective**, twice at the very clause the round before had just corrected. The round-3
fix wrote **one** new paragraph and nothing else, so round 4's target is narrower than any before it,
but it is not empty.

**Round 4's attack list, from round 3's own "likeliest sites" plus what the fix wrote:**

- **The corrected paragraph itself** (`ledger.rs:1656` onward) — the regression round 3 names is a
  sentence that says both invalidations are always absent or present together instead of only that no
  decision interleaves. The new text denies that reading twice in the same paragraph and names both
  asymmetric outcomes as legal, **which is itself new prose that this round cannot see the flaw in**.
- **Whether the interleaving claim is true.** Record §11.7 item 3 says plainly that it rests on a
  **reading** — the method takes `enter_gate()` then `lock()` and `decide`'s entry points take the
  same two in the same order — and that **no test in this repository races a decision against this
  method**, nor can one be written against a `std::sync::Mutex` without a scheduler hook.
- **`documents_by_path`'s field doc** (`ledger.rs:1093–1104`), judged true and left this round on an
  unenforced invariant. Round 4 may disagree.
- **G4's *exactly three*, G8's *the one exception* and N5** — all three cleared by round 3, all three
  still structurally unguarded by any test or type.
- **The `persist::write` lock-registry boundary** (record §5 item 8), still owed an **inventory as a
  judged-out position** by step 2, never a narrowing of the pattern to make it disappear.


### Review round 4 — **READY (0 findings)**. No fix round. **Step 1 is closed.**

Appended verbatim to `docs/reviews/phase-2d-4a-C.md` under `## Round 4`. Codex ran **read-only** and
wrote no file; its final message was the deliverable and the orchestrator appended it. Job
`task-mtbk9hs8-ubpryt`, high effort, **141 s** — under half of round 3's 301 s, which is what a
target narrowed to one paragraph costs. Record §12.

**Round 4 is the first round of this phase to find nothing.** The counts, whole: round 1 — 1 High,
1 Low; round 2 — 1 High, 1 Medium; round 3 — 0 High, 1 Medium, prose-only; **round 4 — 0 findings**.
It cleared **all six** attack-list items and states plainly that **no round 5 is warranted**. The
brief carried the standing instruction — *if everything you find is a restatement of wording already
fixed, say so plainly in the verdict* — and the answer came back stronger than that: not a
restatement, but nothing at all. **The judgement recorded at the round-3 handoff — run round 4 and
expect it to be the last — is therefore measured rather than predicted.**

**What it cleared, against what round 3 left open**: the corrected paragraph itself (the regression
round 3 predicted was **not** written — the record clears only on a differing revision, the
announcement only on a differing state, so both asymmetric outcomes the paragraph calls legal *are*
legal, and they agree with the *equal cases are kept deliberately* statement twelve lines above); the
interleaving claim; `documents_by_path`'s field doc, which round 4 was invited to disagree with and
did not, finding **no concrete production violation**; G4's *exactly three*, G8's *the one exception*
and N5; the four regressions round 3 forbade, all confirmed intact — which **independently
corroborates §11.2**, where the fix round asserted the same thing from its own reading; and the
`persist::write` lock-registry boundary, cleared **as judged out** in the reviewer's own words —
those mutexes serialize disk writes and are **not** retained observation state any observation,
drain, suppression, coalescing or save-admission decision consults.

**The one claim the orchestrator verified rather than accepted.** A review's report is a claim, and
round 4's central clearance rests on *"Those are the only source-tree calls to `decide`"* — a fourth
entry point reaching decision state without both acquisitions would falsify the corrected paragraph
and the clearance together. `rg -n 'decide\(' src-tauri/src/ crates/ --type rust` returns **exactly
three** call sites of this `decide` (`ledger.rs:1373`, `:1483`, `:1558`) plus its definition at
`:2088`; the only other match is `syntax/ownership.rs`'s unrelated function of the same name in a
different crate. Each of the three takes `let _gate = self.enter_gate();` then
`let mut ledger = self.lock();` in that order immediately before the call — `:1367–1368`,
`:1481–1482`, `:1556–1557` — the same pair in the same order as
`adopt_reloaded_revision_under_the_session_lock` at `:1683–1684`. **Verified by reading, twice, by
two readers — and still not tested**: §11.7 item 3 stands, no test races a decision against this
method and none can be written against a `std::sync::Mutex` without a scheduler hook. Round 4 records
the same limit in its own words, correctly calling the absence *unenforced evidence, not proof that
the claim is false*.

### The gates after round 4 — deliberately not re-measured, because nothing changed

**No fix round ran.** Round 4 found nothing to fix, so **no file in either source tree was
modified**; `git status --short --untracked-files=all` was **empty** immediately after the job, which
also confirms the read-only sandbox wrote nothing. Re-running a suite over an unchanged tree measures
the host, not the work, so the step-1 figures stand exactly as the round-3 fix measured them:

- **`1309 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). The three frontend figures remain carried forward unverified from 2d-4a
  round 6 and **must be re-measured by any step that touches `src/`**. Step 2 should not touch `src/`.

### What step 2 inherits, and where step 1 is still thin

**A READY is a reader's judgement, not a proof, and it does not reduce the case for step 2 by one
line.** Nothing in step 1 is enforced by anything: the round-3 falsehood survived 1309 passing tests,
`clippy`, `cargo doc`, a written audit trail and **two** review rounds aimed at its own family. That
is precisely what step 2 exists to fix.

- The six cleared positions are **inventory entries**, not re-litigable questions.
- **G4's *exactly three* and G8's *the one exception* are the highest-risk drift sites** — round 4
  clears them and names them so in the same breath, because both are true today and guarded by
  nothing; a fourth mutation site or a second session-lived field would falsify them silently.
- **`persist::write` is a judged-out position** to be inventoried, **never** a pattern narrowed until
  it disappears (`2d-4a-notes.md` §11.4 records that move as the one such a check cannot catch).
- **N5 keeps its existential reading.**
- **The phrase family is round 3's**: *atomic execution incorrectly promoted into a correlated
  post-state when the mutations have different predicates* — covering **both** the unconditional
  paired insertion and the conditional paired removal, or it ships with the blind spot that produced
  round 3's finding.
- **`docs/` is deliberately not swept and cannot be**: `2d-4a-notes.md` quotes six rounds' false
  sentences on purpose, so sweeping the documentation tree would flag the record of every defect this
  phase fixed. The module doc must say so.
---

## Verification — Phase 2d-4a review round 6 (NOT READY — 0 High, 1 Medium, 5 Low; the fix is in the tree, every gate green, committed at `6be7231`, round 7 owed)

**Round 6 was the round that could have ended the tail, and it did not.** The brief carried the
owner's standing instruction explicitly: *if everything you find is a restatement of the
retention-boundary wording with no new substance, say so in the verdict* — the 2d-3 precedent being
to stop and build the mechanism instead of running another round. Round 6 **cleared** the twelve
retention positions, **cleared** the fifth-mutation question (`insert` and `remove` in `enqueue`,
`retain` in `drain`, the whole-state assignment in `begin_epoch`, and nothing else), and then found
round 5's own lesson **one level up**, on a different subject. So the tail continues on evidence, not
on momentum.

**M1 is the watermark, and it is the retention finding's shape applied to the number a consumer
actually stores.** `ReconciliationBatch::newest_sequence` was documented as never falling below the
highest watermark this **queue** — or, in `commands.rs`, this **session** — had *ever* been drained
with, and therefore storable **unconditionally**. `begin_epoch` assigns a fresh `QueueState` with
`acknowledged == 0`, so: epoch 1 drains with watermark 9; `begin_epoch(2)`; `drain(0)` on the empty
successor answers `newest_sequence == 0`. **The code is right** — sequences and watermarks are
epoch-scoped and a sequence means nothing across two epochs — so the fix is words, and the claim is
now scoped *within the epoch the batch names* at **nine** source positions. The review named four;
the fix round's own sweep found two more in `dispatch_check.rs`, which the review never looked at,
plus the `max` comment and two test positions. The corrected sentence is now **asserted**, which the
false one never was: `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` gained
epoch 2's watermark of 9 and the successor's `newest_sequence == 3`, watched failing at `left: 9`,
`right: 3` with a process-lifetime high-water mark spliced into `drain`.

**L1 is the one behaviour change, and it is a data defect wearing a Low's label.** A
`debug_assert_eq!` is not an invariant-failure policy: in release it disappears and
`address_of_minted` answers `Addressable` with the **workspace's** identity while the same
observation's `ChangedContent::Projected` carries the **snapshot's** in `DocumentView::id` and in
every `MatchId` beneath it — **one `Changed` object with two document identities for one file**, not
merely an arm that is locally true. It is now an `assert_eq!` on **every profile**, and that is
forced rather than chosen: **no arm is true** in that case, since `Named` claims the workspace does
not hold a path it holds (round 5's finding) and `Addressable` with either number is false about one
half of the object. The new test
`a_snapshot_identity_the_open_workspace_contradicts_is_a_failure_and_never_a_wire_value` is the one
round 5 correctly said was impossible against a `debug_assert_eq!` — such a test measures the
**profile** — and it was watched failing in a **release** run with the old assertion restored:
*"test did not panic as expected"*. **The trade is stated rather than implied**: a panic inside a
command holding two locks, on any profile, but **not a panic on input** — no file's bytes, no
filesystem state and no action a person can take reaches it, only a second identity source added to
this process's own code. The two mutexes are not a second failure because every lock in
`reconciliation.rs` and `commands.rs` absorbs poisoning through `PoisonError::into_inner`, **which
the orchestrator verified line by line rather than accepting**: `self.lock()` at `commands.rs:1473`
is itself the absorbing helper. **What happens to the process around the panic is asserted by nothing
in this repository**, and §15.4 says so.

**L2 was closed with coverage, not with a better argument.** The `UnreadableReason` walk had
exercised `PermissionDenied` and `NotUtf8` — with `NotUtf8` **duplicated** — while `Other` was
checked only as a Rust value and `InvalidData`, `TimedOut` and `Interrupted` were serialized by
nothing; a coherent change of `InvalidData {}` to a unit variant would have crossed as a bare string
with the test green. All six arms are now driven by real read failures, and `wire_tag`'s exhaustive
`match` makes a **seventh variant a compile error** — stated as forcing a decision, not as coverage.
This is the same shape of argument §14.4 made and rounds 3 and 4 made before it, refused for the
third time.

**L3 and L5 are the record over-claiming, and L4 is a no-change verdict.** R10's round-3 correction
said a repeat stream *"can only displace its own document's older entries"*; `evictable_sequence`
breaks a tie between equally busy paths by **the lower of their lowest sequences**, so at capacity
256 — B holds 1 and 2, 253 singletons hold 3–255, A holds 256, A's identical repeat arrives at 257 —
the tie picks B's sequence 1 and A's repeat evicts **another document's** entry. The narrow
implemented guarantee (a singleton is never the victim while another path has two) is untouched and
`evictable_sequence`'s own doc already stated only that, so **only the record was wrong**. L5: §14.2
listed four files where `eced554` touched five, omitting `docs/reviews/phase-2d-4a-queue.md` — the
orchestrator verified this against `git show --stat` **before** commissioning the fix. It is the same
habit Phase 2d-3's round 12 found. **R9 remains an open Low by round 6's verdict as by round 5's**:
the core identity register is still unbounded, unevicted, uncapped and unmeasured, nothing changed,
and it was not closed by weakening anything.

**Gates after the fix, all measured by the orchestrator on this tree, not accepted from the report:**
`cargo test --workspace` **1309** passed / 0 failed over **26** result lines all `ok`, exit 0 (**+1**
on 1308 — L1's new test is the only one added; L2 extended an existing one); clippy clean; `cargo fmt
--check` clean; `cargo doc --workspace --no-deps` exit 0 with **73** `private_intra_doc_links`
warnings, **unmoved**; `cargo tree -p espansoconfig-core | rg tauri` empty; `watch_check::` **20/20**
with **264** filtered out (263 → 264) in 70.73 s; `npm test` **2125** in 56 files; `npm run check`
**431** files / 0 errors; `npm run build` **184** modules with the server oracle absent and the client
oracle present with 2 matches. `docs/decisions/2d-4a-notes.md` **§15** is the record and **§15.4** is
what it is thin about.

## Verification — Phase 2d-4a review round 5 (NOT READY — 0 High, 1 Medium, 3 Low; the fix is in the tree, every gate green, committed at `eced554`, round 6 owed)

**Risk class: `high`. Worker model: `opus`** (this run was driven by `/goahead-opus`, so every agent
at every depth was Opus and no Fable quota was spent).

### What round 5 asked, and what it answered

Round 5's scope was **the round-4 fix**, commissioned under the rule that commissioned rounds 2, 3 and
4. Its brief carried round 4's own lesson — *a replacement test can assert the shape of an answer
instead of the property the test it replaced was holding* — and turned it on round 4: **do the
round-4 fix's own two tests assert properties or shapes?** It was also pointed at the three-arm
`ObservedDocument` and its absent accessor, `address_of` / `address_of_minted`, `ChangedContent` and
the operands outside its arms, the retention sweep's six positions, the liveness-inventory filing,
the L2 downgrade, and §13's nine correction blocks.

**The thing the brief attacked hardest cleared.** Both round-4 tests protect behaviour rather than
spelling: the replacement test first proves the successor workspace neither contains the path nor
accepts the old identity and *then* requires `Named` with both operands, and the non-UTF-8 change
test requires the outer observation to stay `Changed`, preserves both independently computed
revisions and requires a reason instead of projection text. Both round-3 tests renamed by round 4
keep their underlying properties too. Round 5 further cleared the merged `Named` as usable by a
correct 2d-5 consumer, cleared **R3** as substantively closed, cleared the liveness filing as not a
dodge, and cleared queue concurrency, lock ordering, the coalescing fold, `evictable_sequence` and
**R10** — the third clearance for the last of those.

**What it found is the retention boundary, for the third consecutive round, still false — and false
in a direction none of rounds 2, 3 or 4 looked in.** Every one of those rounds counted the ways a
stored entry leaves the queue **by the entry's own properties**: acknowledged by a drain, or chosen
by the eviction policy. None counted the one that depends on nothing about the entry at all.
`ReconciliationQueue::begin_epoch` assigns a **fresh `QueueState`** when the session adopts a
replacement workspace, discarding the pending set, the watermark and the loss count together. Round
4's sweep found four positions round 3 had missed and was, in this direction, no more complete than
round 3's.

### The four findings and how each was closed

`docs/decisions/2d-4a-notes.md` **§14** is the record, with a finding-by-finding table naming the
test that fails without each fix, and six round-5 correction blocks.

- **M1 (Medium) — closed by words, at twelve positions.** The boundary now has **three** clauses
  everywhere: an admitted observation is **stored** unless it is one of the two arrivals no later
  drain could return — a replaced epoch, or a sequence at or below the acknowledged watermark — and a
  **stored** entry then leaves in exactly three ways: a later drain acknowledges it, an overflow
  evicts it, **or the queue adopts a replacement epoch and discards everything the previous one
  held**. The third is counted in **no** `discarded`, and that is deliberate: the open that causes it
  has already replaced the authoritative workspace, so the discarded entries describe a directory
  nothing is showing, and `ReconciliationBatch::epoch` already makes their batches stale — counting
  them would oblige a reload of a workspace the open has just performed. The idempotence sentences
  gained the matching second condition, *and no replacement epoch was adopted between them*, which
  rounds 1 and 2 wrote the first half of and nobody wrote the second. **Nothing was weakened**: the
  third clause was always what `begin_epoch` did.
- **L1 (Low) — closed by code, and it is the round's one behavioural change.**
  `address_of_minted` branched on the open workspace resolving a path to a *different* number than
  the snapshot minted and answered `ObservedDocument::Named` — an arm whose own doc says the open
  workspace does **not** hold the path, in a branch reached only when it demonstrably does. §13.4 had
  called that arm *conservative*; a branch is not conservative when the answer it gives is untrue. It
  now matches `Some(resolved)` and answers `Addressable { document: resolved }`, true of what it
  carries whatever that number is, with the agreement between the two sources carried by a
  `debug_assert_eq!` and `Named` reserved for `None`. **`Named`'s doc was not weakened** — that is
  the reason the contradicting branch went rather than the doc.
- **L2 (Low) — a no-change verdict, recorded.** R9 is **OPEN**: the core identity register retains
  every distinct `PathBuf` ever named for the life of the process, unbounded, unevicted, uncapped and
  unmeasured, while the queue stays capped at 256. Round 4 corrected the *reassurance* without
  correcting the *bound*, because there is none, and its block opened with the word *Closed*; that
  word is corrected in R9's own entry. Judged against this project's precedent — **seven** Phase 2d-3
  items recorded as bounded residues and later found to be real defects — it stays open until
  measured and either bounded safely or accepted with evidence.
- **L3 (Low) — closed by code and words, one level deeper than the finding.** Round 4 strengthened
  `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor` to walk the two nested content
  enums and gave it two **projected** fixtures, so it covered `ChangedContent::Projected` and
  `AddedContent::Projected` and neither `Unreadable` arm, while §13.2 claimed it covered the nested
  enums generally. Two non-UTF-8 fixtures were added so **both arms of both** enums are now
  serialized rather than asserted only as Rust values, and the walk was extended one level further to
  `UnreadableReason`, which nothing checked at all.

### The defect the review did not find, that its own remedy found

**The branch round 5 called *"cannot be reproduced on this tree"* was reproduced, by a test, on the
`debug_assert_eq!`'s first full run of the workspace suite.**
`crate::commands`'s `the_drain_hands_back_what_the_queue_holds_above_the_watermark` built its
projection with `DocumentContext::detached(DocumentId(1), "x.yml")` — a snapshot claiming an identity
the register never issued for the path its own observation named — so the open workspace resolved
that path to 157 while the snapshot said 1, and the shipped code answered exactly the false
`Named { document: 1 }` the finding describes. The fixture now mints through
`espansoconfig_core::workspace::identity_of`, which is what `crate::reconciliation`'s own `snapshot`
helper had already been doing, for the reason its doc comment already gave: a helper that invents a
number turns identity assertions into tests of the helper. **§14.4 says plainly that changing a
fixture is the shape of fixing the test instead of the code**, and argues why it is not that here —
the fixture's wire value was false about the workspace whichever way `address_of_minted` answered.

### The gates, all measured on this tree by the orchestrator

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1308** passed, 0 failed, **26** result lines all `ok`, exit 0 (1308 before the round; **+0** — three tests strengthened, none added) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, clean |
| `cargo fmt --check` | exit 0, clean |
| `cargo doc --workspace --no-deps` | exit 0; **73** `private_intra_doc_links` warnings, the pre-existing count |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 263 filtered out (unchanged), 79.44 s, no timeout |
| `npm test` | **2125** passed, 56 files — unchanged |
| `npm run check` | **431** files, 0 errors, 0 warnings — unchanged |
| `npm run build` | **184** modules — unchanged; server oracle absent, client oracle 2 matches |

The workspace suite was run **once** on a quiet host after
`pkill -f 'target/debug/deps/espansoconfig-'`, with nothing else running concurrently. No frontend
file changed this round at all — the three frontend numbers are re-measured rather than assumed, and
they are unchanged because nothing under `src/` was touched.

**The test total moved by 0, and that is the evidence, not the absence of it.** M1 changed no code;
L2 changed no code; L1's branch cannot be driven by a test at all, because release compiles the
`debug_assert_eq!` out, so a test built to drive it would pass or fail **by build profile**, which
§14.1 states rather than papering over. What moved is three existing tests:
`adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` gained the **watermark** half
that nothing had asserted, `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor`
gained two non-UTF-8 fixtures and the `UnreadableReason` walk, and the `commands.rs` fixture above.
The watermark half was **watched failing** — with `begin_epoch` carrying the acknowledged watermark
across the replacement it failed on *"a replacement resets the watermark with everything else"*,
`left: []` against a one-entry list, the batch printing `discarded: 1` — and the probe was reverted
with the inverse edit, never with `git checkout`.

### What this round did not do, and what round 6 should attack

Recorded here because §14.4 is where round 6 will start, and because this phase's five rounds have
each found what the round before left behind.

- **The retention sweep is still a human reading**, and this is the second round in a row to say so
  after the previous one's sweep proved incomplete. Nothing mechanical checks that the boundary is
  stated identically everywhere, the way `liveness_contract.rs` checks the liveness family. **A
  thirteenth position written tomorrow is invisible**, and the record deliberately does not claim the
  sweep is complete — which is exactly what rounds 3 and 4 claimed and were wrong about.
- **"Exactly three ways" rests on a reading, not on a test.** It is true because `QueueState::pending`
  is mutated in exactly four places, established by reading every mutation of that field rather than
  by anything that fails when a fifth appears.
- **The `debug_assert_eq!` is on a path a Tauri command reaches** and panics there in a debug build.
  §14.4 records that as a deliberate trade and records that the **release** behaviour of that branch
  is asserted by nothing: with a second identity source, release would cross `Addressable` carrying
  the workspace's number while the consumer's projection arrived under the snapshot's.
- **A test fixture was changed to make an assertion pass.** The argument that it is not
  fixing-the-test-instead-of-the-code is in §14.4 and is round 6's to judge.
- **`UnreadableReason` is walked for three of its six variants.** `InvalidData`, `TimedOut` and
  `Interrupted` are serialized by nothing. The rule the walk checks is uniform across the enum, which
  is an argument for not enumerating all six — and it is an argument, not a check.
- **Nothing in the boundary is enforced against `crate::commands`**: the wording lives in two source
  files and the record, kept identical by a reader.
- **R9 is open, unmeasured and unbounded**, and no step of the 2d split owns building a bound.
- **R8 is unchanged.** Round 1's fix wrote three of round 2's findings, round 2's wrote at least one
  of round 3's, round 3's wrote four of round 4's five, and round 4's wrote **three of round 5's
  four**. The most likely place for round 6's finding is the sentence directly above the one it
  quotes: this round rewrote twelve retention positions and one helper, and every previous round that
  rewrote a retention position left a narrower instance of the same claim standing somewhere else.



## Verification — Phase 2d-4a review round 4 (NOT READY — 0 High, 3 Medium, 2 Low; its fix is committed at `16d11b3`, and **round 5 is executed** — see the round-5 section above, which found what this round's fix left behind)

**Risk class: `high`. Worker model: `opus`** (this run was driven by `/goahead-opus`, so every agent
at every depth was Opus and no Fable quota was spent).

### What round 4 asked, and what it answered

Round 4's scope was **the round-3 fix**, commissioned under the rule that commissioned rounds 2 and 3.
Its brief carried round 3's own lesson — *moving a rule does not move the bound it depended on* — and
turned it on round 3: the round-3 fix **changed the eviction victim, the wire shape and the identity
source in one round**, so what did it leave behind? It was pointed hardest at `evictable_sequence`,
whose order-independence §12.4 records as argued and bounded-checked but **expressly not proved**, and
at the residues R3, R9 and R10 against this project's precedent that **seven** items recorded as
bounded residues in Phase 2d-3 were later found to be real defects.

**The thing the brief attacked hardest cleared, and the two things the same fix touched in passing did
not.** `evictable_sequence` is order-independent at four or more paths; its state count is irrelevant
because it never reads `ObservedState`; and **two paths cannot tie on both documented keys**, because a
globally unique sequence cannot be both paths' lowest. The selector preserves a suffix per path, so an
eviction cannot join two state runs. Round 4 also independently reproduced the refused alternative's
`{1,2,5}` / `{2,4,5}` counterexample and confirmed it valid, cleared `Box<DocumentView>` as
serialization-transparent, cleared public `identity_of` of any misuse in this tree, cleared the
round-3 liveness rewording as honest, and cleared R10 as conservative but genuinely bounded.

**What it found instead is that round 3 closed round 1's finding by replacing one wrong answer with
another.** Deleting `issued_identities` and asking the core's process-wide register left `address_of`
answering `Known { D }` for an identity minted in a **previous** epoch that the open workspace rejects
as `UnknownDocument` — and dropping the display path while doing it. The test round 3 deleted,
`an_identity_issued_in_one_epoch_addresses_nothing_in_the_next`, was protecting a real distinction —
**stable path identity may survive an epoch; current addressability does not** — and its replacement
builds an empty workspace, receives `Known`, and declares it correct **without ever testing
addressability**. That is this project's worst defect class arriving through a *test*: the replacement
asserts the shape of the answer and not the property the deleted one held.

### The five findings and how each was closed

`docs/decisions/2d-4a-notes.md` **§13** is the record, with a finding-by-finding table naming the test
that fails without each fix, and its round-4 correction blocks.

- **M1 (Medium) — closed by code.** `ObservedDocument` is now `Addressable | Named | Unnamed` and
  **every arm carries the display path**. `address_of` asks the open `Workspace` first and the
  identity register second, so a number the current workspace cannot resolve crosses as a **name**
  rather than as an address. `address_of_minted` is new for the arms that already hold a snapshot's
  identity: it asks the workspace the same question and requires it to answer with the **same**
  number, falling back to `Named` on disagreement. **Round 1's finding 1 is not reopened** — the
  identity still crosses; it is simply no longer called a current address. The module declares **no
  accessor over the three arms**, deliberately, because one answering *the identity, where there is
  one* would let a consumer collapse `Addressable` and `Named` with a `?` — which is the collapse
  round 4 found.
- **M2 (Medium) — closed by code, on the wire.** `ExternalObservation::Changed` carries
  `content: ChangedContent = Projected { disk_text, disk, findings, correspondences } | Unreadable
  { reason }`, the symmetry with `AddedContent` that round 3 left untaken, with `previous_revision`
  and `disk_revision` **outside** the arm so a change to bytes that are not UTF-8 keeps both. Q3
  requires those operands and 2d-5 could recover neither from the value supplied. The concrete reason
  for putting the revisions outside rather than in each arm is recorded: `ExternalObservation::
  Unreadable` also carries **stable read failures**, for which no revision exists.
- **M3 (Medium) — closed by words, and the sweep found more than the finding cited.** Every position
  now states one canonical two-half boundary. The finding named two; the sweep found **four more** —
  two in `main.rs`, one at `WorkspaceSession::new`, one at `queueing_sink`, plus a wake sentence.
  Nothing was closed by weakening a guarantee the code keeps.
- **L1 (Low) — closed by words.** §12.4's universal — that a capacity rule which is a function of
  state equality **cannot** be arrival-order independent — is false, and round 4 gave the
  counterexample: retaining the top `K` under a fixed total key containing `(state discriminant,
  sequence)` is state-dependent and order-independent. Corrected to the true narrower claim, which is
  the refusal of that **one** policy.
- **L2 (Low) — closed by an honest downgrade, not by a fix.** `session_identities`' comment now says
  unbounded, unevicted, uncapped and **unmeasured**, and names 2d-7 to measure it and 2d-5 to bound
  it, in place of asserting that it never becomes a consideration. The bound itself is untouched.

The sweep also reached three "address" overclaims in the **core** and one in `Added`'s own doc, and
renamed two tests whose **names** claimed addressability.

### The gates, all measured on this tree by the orchestrator

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1308** passed, 0 failed, **26** result lines all `ok`, exit 0 (1307 before the round; **+1**, the one net-new test) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, clean |
| `cargo fmt --check` | exit 0, clean |
| `cargo doc --workspace --no-deps` | exit 0; **73** `private_intra_doc_links` warnings, the pre-existing count |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 263 filtered out (was 262; +1), 69.12 s, no timeout |
| `npm test` | **2125** passed, 56 files — unchanged |
| `npm run check` | **431** files, 0 errors, 0 warnings — unchanged |
| `npm run build` | **184** modules — unchanged; server oracle absent, client oracle 2 matches |

The workspace suite was run **once** on a quiet host after
`pkill -f 'target/debug/deps/espansoconfig-'`, with nothing else running concurrently.

**The test total moved by 1, not 2, and that is worth not mistaking for thin evidence.** The new test
is `an_identity_minted_under_a_replaced_workspace_is_named_and_is_not_an_address`. M2's evidence
*replaced* an existing test rather than adding one, because the old test's **name** —
`present_bytes_that_are_not_utf8_cross_as_unreadable_rather_than_as_content` — asserted the defect;
it is now `a_change_to_bytes_that_are_not_utf8_keeps_both_revisions_and_carries_no_text`. Both were
watched failing against inverse edits (register-alone `address_of`; the old non-UTF-8 routing), each
reverted with the inverse edit and the file `diff`-verified identical to a pre-probe copy.

### What this round did not do, and what round 5 should attack

Recorded here because §13.4 is where round 5 will start, and because this phase's four rounds have
each found what the round before left behind.

- **`Named` merges two situations the queue cannot distinguish** — added-this-epoch versus
  replaced-epoch — and the arm's doc says so. A consumer that needs them apart cannot get them apart.
- **Nothing forces 2d-4b to match on the arm.** The round-4 defect can return in TypeScript with
  every Rust gate green. The absent accessor makes the collapse awkward, not impossible.
- **`address_of_minted`'s conservative branch is unreachable today and untested.** It exists for a
  disagreement that one register makes impossible now and that no type forbids later.
- **`ChangedContent` is a wire change with no consumer.** If 2d-5 finds those two revisions
  insufficient, this is the **third** round in which R3 was declared closed.
- **The liveness sweep fired on the fix round's own new prose for the third round running**, on
  `address_of_minted`'s *"the workspace must answer with the same number"*. This round **filed it in
  the inventory** rather than rewording it — the opposite of what round 3 chose for its own hit — and
  the reasoning is in §13.4. Round 5 should judge that choice, because a rewording and a filing leave
  different traces and both can be dodges.
- **The core register is still unbounded.** L2 was downgraded honestly, not fixed.


## Verification — Phase 2d-4a review round 3 (NOT READY — 0 High, 4 Medium, 1 Low; its fix is committed, and **round 4 is executed** — see the round-4 section above, which found what this round’s fix left behind)

**Risk class: `high`. Worker model: `opus`** (this run was driven by `/goahead-opus`, so every agent
at every depth was Opus and no Fable quota was spent).

### What round 3 asked, and what it answered

Round 3's scope was **the round-2 fix**, commissioned under the rule that commissioned round 2: *a fix
is a change, and the round that reviews it is not optional.* Its brief put one question first —
whether calling the arrival-order dependence that survived round 2's fix a `discarded` **loss** rather
than a coalescing failure is a true distinction or a relabelling. **The answer is that it was a
relabelling**, and that is round 3's finding 1.

**Round 3's finding 1 is round 1's finding 3 and round 2's finding 1 in a third shape.** Round 2's fix
moved the coalescing rule out of `enqueue` into `drain`; **the capacity bound stayed in `enqueue`**,
where `while pending.len() >= QUEUE_CAPACITY { evict the lowest }` ran **before** the arrival was
stored. So a full queue's contents still depended on which thread arrived first, and through the fold
so did the batch: one path at `A(1), B(2), A(257)` retained `B(2), A(257)` in one arrival order and,
having lost the separator to the eviction, folded to `A(257)` alone in the other. **One finding, three
shapes, three rounds, each round's fix producing the next round's finding.**

Round 3 also **cleared** the things round 2's fix was most likely to have broken, and they are worth
not re-litigating: `coalesced_sequences` folds runs longer than two correctly and handles interleaved
paths independently; the highest pending sequence is always carried, so `newest_sequence` is correct
even when it is the last member of a folded run; §4's two-case epoch split is exhaustive over the
queue mutex and names fences that exist; the four same-watermark idempotence qualifications are true;
the two reclassified liveness entries do fit the `a pointer:` definition; and the round-2 rewording of
`answered by` to `obliging` was an **honest** false-positive removal rather than a dodge — a
whole-workspace reload is a consumer response to recorded loss, not observation-pipeline liveness.

### The five findings and how each was closed

`docs/decisions/2d-4a-notes.md` **§12** is the record, with a finding-by-finding table naming the test
that fails without each fix, and **fourteen** round-3 correction blocks.

- **1 (Medium) — closed by code.** The arrival is stored **first** and the bound restored after
  (`while pending.len() > QUEUE_CAPACITY`), so what the queue retains is its best `QUEUE_CAPACITY`
  entries out of everything admitted — a function of the admitted set. An arrival that is itself the
  right victim now leaves again rather than displacing a resident entry.
- **2 (Medium) — closed by code, and *not* with the policy the orchestrator's brief suggested.** The
  brief proposed preferring an entry the fold currently makes redundant. The fix round **brute-forced
  that suggestion and refused it**: it is not arrival-order independent (path `a` at states S,T,S,S,S
  over sequences 1–5 with capacity 3 retains `{1,2,5}` in one order and `{2,4,5}` in another), so it
  would have reopened finding 1. What shipped instead is `evictable_sequence` — **the lowest pending
  sequence of the busiest path**, ties broken by the lower of their lowest sequences — so **a document
  with one pending entry is never evicted while another has two**, and with every path at one entry it
  degenerates to the lowest sequence, which is the original overflow test's case.
- **3 (Medium) — closed by code, in the core and on the wire.** `ExternalObservation::Added` now
  carries `content: AddedContent = Projected { disk, findings } | Unreadable { reason }`, which is
  Q3's `disk?` as a discriminated value, so a first sighting of a non-UTF-8 file is a row **with an
  address** rather than a bare display path. `Changed` is untouched and still total.
- **4 (Medium) — closed by words.** Every position that states retention now states the identical
  boundary — acknowledgement or eviction, an eviction being a counted loss obliging a whole-workspace
  reload — **the record's header included**, which had still claimed no admitted observation is
  dropped despite three drop causes. Every sentence naming the *oldest* entry was rewritten, because
  the new policy makes *oldest* false.
- **5 (Low) — closed by deletion.** `QueueState::issued_identities` is **gone**. The new
  `espansoconfig_core::workspace::identity_already_issued` — a public read that **mints nothing** — is
  what `address_of` asks, so there is one path-keyed structure instead of two.

### The two reversals this round took deliberately

Both are recorded as reversals rather than presented as refinements:

- **`identity_of` is now `pub`.** Its own doc had said it stays crate-private because handing
  identities out is that module's job. One case forced it: a file created after the workspace opened
  whose bytes are not valid UTF-8 never reaches `project_source`, so nothing ever minted an identity
  for it, and the Tauri layer must still hand its row an address. The alternative was for that layer
  to invent a number, which would name nothing and could collide. **§12.4 concedes that nothing
  enforces the one intended use** — any `src-tauri` code can now mint an identity for any path, and
  what would catch a misuse is a review, not a type.
- **An address now survives a workspace replacement.** `ObservedDocument::Unknown` is narrowed to
  *nothing in this process ever named this path*. The test
  `an_identity_issued_in_one_epoch_addresses_nothing_in_the_next` **no longer exists**: the sentence it
  asserted contradicted the core's own identity model, which deliberately gives a path the same number
  for the life of the process, recreation included. Its replacement is
  `an_identity_survives_a_replacement_and_the_epoch_is_what_makes_a_batch_stale`.

### The gate baseline — all nine measured on this tree by the orchestrator, not accepted from a report

**`1307 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules). 1307 passed, **0 failed**, over **26** `test result: ok.` lines, exit 0, on a
quiet host after `pkill -f 'target/debug/deps/espansoconfig-'`. The Rust ladder across this step:
**1272** at 2d-3-C, **1297** at the implementation, **1301** after fix round 1, **1303** after fix
round 2, **1307** here (+4, exactly the four new tests).

Also green, each run by the orchestrator: `cargo clippy --workspace --all-targets -- -D warnings`;
`cargo fmt --check`; `cargo doc --workspace --no-deps` exit 0 with **73** `private_intra_doc_links`
warnings — the pre-existing count, the new public core function having first added a seventy-fourth by
linking a private type, which its doc now names in words instead;
`cargo tree -p espansoconfig-core | rg tauri` **empty** — the architecture rule holds even though this
round is the first of the step to touch a core file;
`cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` **20/20** with
**262** filtered out (223 → 227 → 252 → 256 → 258 → 262 across the step), 76.63 s, no timeout; the
production-bundle oracles — `$$payload|head_payload|push_element` **absent**,
`window.__svelte|svelte-trusted-html` **present** with 2 matches.

**The three frontend numbers are unchanged rather than re-measured** for the reason §7.1 gives: this
round's only frontend change is two keys in two JSON dictionaries, which adds no module, no
`svelte-check` file and no test. The re-measurement obligation still falls to **2d-4b**.

### The evidence discipline this round kept

**All four new tests were watched failing before their fix**, by inverse edit — including the
**intermediate** state, which is the part that matters: with insert-before-evict restored but the
victim still the globally lowest sequence, **only** finding 2's test failed. That is what separates
finding 1's fix from finding 2's rather than letting one cover for the other.

### Git state

**`2cb57ec`, tree clean, pushed to `origin/main`** (this paragraph recorded by the follow-up commit).
The commit holds **nine** files, all modified and none new: `crates/espansoconfig-core/src/workspace/mod.rs`
— **the first core file this step has touched**, and `cargo tree -p espansoconfig-core | rg tauri` is still
empty — `src-tauri/src/{reconciliation,commands,dictionary_contract}.rs`, the **two i18n dictionaries**,
`docs/decisions/2d-4a-notes.md` (§12 and fourteen round-3 correction blocks),
`docs/reviews/phase-2d-4a-queue.md` (round 3 verbatim, appended after rounds 1 and 2) and this checkpoint.
**The only `src/` paths are `src/lib/i18n/{en,es}.json`** — the TypeScript wire is 2d-4b's by the split.
`git status --short --untracked-files=all` after the commit is **empty**: no real-config path, no launch
artifact, no untracked file. **The step is NOT closed by it** — three Codex rounds, all NOT READY, all
three fixes in the tree and green, and **round 4 is owed against the round-3 fix**. A fresh session
resumes from "Next action".

### What is NOT proven

- **Round 4 has not run.** Fix round 3 changed the eviction victim, the wire shape and the identity
  source in one round, reversed two recorded decisions, and deleted a test. This project's record is
  unambiguous about what that means.
- **`evictable_sequence`'s order-independence is argued and measured, not proved.** The measurement is
  exhaustive over every assignment and arrival order for **two and three paths, two states, up to six
  sequences and capacities two to four** — a bounded check of an unbounded claim — and it lives in the
  record, not in the repository. **No test enumerates arrival orders**; the three orders in
  `a_full_queue_retains_the_same_entries_whatever_order_they_arrive_in` are a sample chosen because
  round 3 named two of them. §12.4 says so in as many words.
- **R9 is closed as a *duplicate*, not as a bound.** `espansoconfig_core::workspace` still keeps every
  path it has ever named for the life of the process, and this round measures it no more than the last
  one did. What changed is that there is now one such structure rather than two.
- **R3 is narrowed again, not closed.** What it now means is only that a non-UTF-8 `Changed` loses its
  two revisions; the *addition* case it also covered is closed.
- **The liveness sweep fired on this round's own new prose (`answered by`) and it was reworded**, the
  second consecutive round in which that has happened. §12.4 records it. Rewording to dodge a sweep is
  precisely what the check cannot catch.
- **Nothing consumes the queue, and nothing has been seen on a screen.** No frontend can call
  `drain_external_changes` until 2d-4b registers the wrapper; Q7 assigns mounted and window evidence to
  2d-6 and 2d-7. The two new i18n keys are present and **unreachable** — there is no accessor.


---

## ⚠️ SUPERSEDED — Verification — Phase 2d-4a rounds 1 and 2 (kept for the record of those two rounds; **round 3 reversed several of its claims** — see the round-3 section above). Where this section and the round-3 section disagree, the round-3 section is current.

**What round 3's fix reversed in this section, said here rather than by rewriting it:** `issued_identities` **no longer exists** — the three sentences below that describe it in the present tense (what it records, that `address_of` consults it, and R9's unbounded duplicate) are history; `espansoconfig_core::workspace::identity_already_issued` is the single path-keyed source now. The overflow rationale below — an eviction taking the queue's *oldest* entry — is **false of the shipped policy**: the victim is `evictable_sequence`, the lowest sequence of the busiest path, and the arrival is stored before the bound is restored. The `1303` and `258` figures are round 2's and are now **1307** and **262**. "R3 is narrowed, not closed" now means only that a non-UTF-8 `Changed` loses its revisions; the **addition** half it also named is closed by `AddedContent`. And the `private_intra_doc_links` count below reads 74; the measured pre-existing count is **73**.


**Risk class: `high`. Worker model: `opus`** (this run was driven by `/goahead-opus`, so every agent
at every depth was Opus and no Fable quota was spent).

### What was built

2d-4 as consult Q7 item 4 states it spans the Rust queue, a Tauri event, a new command, the
TypeScript wire, the i18n accessors and three re-measured frontend baselines. It was **split** before
execution — `docs/decisions/2d-4-split-notes.md` — on the seam Q3 itself draws: *the Rust command
surface returns `Result<T, CommandError>`, while the TypeScript wrapper converts invoke
success/failure into `CommandResult<T>`; preserve that split.*

**2d-4a is the Rust half.** `src-tauri/src/reconciliation.rs` is new. `queueing_sink` replaced
`ledger::discarding_sink`, which is deleted and whose own doc had said it would be: until this step
an admitted observation was produced and **dropped**, so a sequence and a publication were spent on a
value no code recovered. `AdmittedObservation` lost its `#[cfg_attr(not(test), allow(dead_code))]`.

- `ReconciliationWake { workspace_epoch, newest_sequence }` on `workspace://reconciliation-ready`.
  A hint, expendable, and deliberately **not** a `CommandResult` — it reports no requested operation.
- `drain_external_changes(after_sequence)` — the **sixteenth** workspace command, seventeenth
  registered counting the menu command — is the authoritative answer:
  `ReconciliationBatch { epoch, newest_sequence, observations, discarded }` over typed
  `ExternalObservation` (`Changed` / `Added` / `Removed` / `Unreadable`).
- `after_sequence` is an **acknowledgement watermark**, accumulated with `max`, so the returned
  watermark is safe for a caller to store unconditionally (round 2 verified this explicitly).
- Ten EN/ES keys for `ExternalObservation` and `UnreadableReason`; `ObservedDocument` is a named
  `NOT_A_CODE` address.

### The gate baseline — all measured on this tree by the orchestrator, not accepted from a report

**`1303 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules). The Rust ladder across this step: **1272** at 2d-3-C, **1297** at 2d-4a's
implementation (+25), **1301** after fix round 1 (+4), **1303** after fix round 2 (+2). 26 result
lines, all `ok`, exit 0, on a quiet host after `pkill -f 'target/debug/deps/espansoconfig-'`.

Also green, each run by the orchestrator: `cargo clippy --workspace --all-targets -- -D warnings`;
`cargo fmt --check`; `cargo doc --workspace --no-deps` (the 2d-3-C gate — 74 warnings, all
pre-existing `private_intra_doc_links` in `espansoconfig-core`, none in `src-tauri`);
`cargo tree -p espansoconfig-core | rg tauri` **empty**;
`cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` **20/20** with
**258** filtered out (223 → 227 → 252 → 256 → 258 across the step), 66.35 s, no timeout; the
production-bundle oracles — `$$payload|head_payload|push_element` **absent**,
`window.__svelte|svelte-trusted-html` **present** with 2 matches.

**The three frontend numbers are no longer carried — they were re-measured here and are unchanged
at 431 / 2125 / 184**, because 2d-4a touched only `src/lib/i18n/{en,es}.json`, which are neither
modules nor `svelte-check` files. **The re-measurement obligation the 2d-3 handoff assigned to 2d-4
therefore falls to 2d-4b**, which is the step whose `git diff --name-only 08a3366 -- src/` first
becomes non-empty beyond those two files.

### The two review rounds

`docs/reviews/phase-2d-4a-queue.md` holds both **verbatim**, newest last. Round 2's scope was round
1's fix, exactly as this project requires: *a fix is a change, and the round that reviews it is not
optional.*

**Round 1 — NOT READY, 1 High, 4 Medium, 2 Low.** The High was the Q8 failure class reached through
the implementer's own deviation: `Added` hands out a `DocumentId` the backend `Workspace` never
adopts, so a later non-UTF-8 `Changed` resolved to `ObservedDocument::Unknown`, whose
`relative_path` is expressly lossy display data and **not an address** — the consumer was left
holding a projection it could no longer be told to invalidate. Two code Mediums: an **empty** drain
returned the caller's lower `after_sequence` instead of the accumulated acknowledgement, so an
out-of-order drain (which Q7 item 5 requires of 2d-5) moved the watermark backwards; and coalescing
had an arrival-order hole. Four findings were the **declared worst defect class** — the sharpest
being an overflow rationale claiming that dropping the globally oldest entry preserves "the newest
state of every document", **asserted by a test that was itself dropping three documents that were
their document's only state**.

**Round 2 — NOT READY, 0 High, 4 Medium, 1 Low, and three of the five were sentences round 1's fix
round wrote.** Its finding 1 is the one that mattered: **round 1's finding 3 was never closed.**
Comparing only the highest pending entry for a path cannot normalise arbitrary arrival order — given
9/A then 3/A, 3 was discarded as a repeat; if 5/B then arrived, the true history was A(3), B(5),
A(9) and **an observation that was not a repeat in sequence order had been dropped**. The mirror
order left the batch uncoalesced.

Round 2 also **cleared** five things, and they are worth not re-litigating: the lock order is
session → ledger gate → ledger state with both ledger guards released before the downstream call, so
a re-entrant `WorkspaceSession::open` meets no held lock; `issued_identities` cannot hand back a
stale identity, because this repository's process-wide table deliberately assigns a path the same
identity for the process lifetime, recreation included; the watermark `max` cannot skip a pending
entry; the extension of the High to `Removed` and io-`Unreadable` is valid, both arms sharing the
`address_of` fallback; and `AWAITING_FRONTEND_DECLARATION` is genuinely bidirectional, so the hole
the split opened **cannot outlive 2d-4b**.

### What the two fix rounds changed, and the one that is a design decision

**Coalescing moved from `enqueue` to `drain`.** This is the step's substantive design change and it
was **not** what round 2's brief asked for. The brief said sequence-adjacency; the fixer established
that adjacency is necessary but **not sufficient at enqueue time** — in arrival order `[9, 3, 5]` an
enqueue-time rule still drops A(3) — so the rule had to become a pure function of the complete
pending set. `coalesced_sequences` now folds, at drain, each path's sequence-**adjacent** run of one
`ObservedState` to its highest sequence; `newest_for_path` and `reindex` are deleted and `enqueue`
stores every admitted observation. Q3's rule that `Removed` → `Added` at one path stays **two**
observations survives on `Absent != Content`. Cost recorded as **R10**: a folded repeat holds a
pending slot until the drain that folds it.

The other fixes: the watermark answers `max(batch highest, acknowledged)`; `issued_identities`
records every `DocumentId` put on the wire against its path for the epoch and is consulted by
`address_of` after the workspace answers `None`; the retention sentence carries its eviction
condition at five positions and says an eviction costs a **whole-workspace reload**, not a repeated
drain; §4's epoch passage was rewritten twice and now splits exhaustively on the queue-mutex order,
covering the interleaving round 2 found (an observation that passes `ledger.admit`, pauses, and
resumes after **both** resets, failing the **queue** check rather than either previously claimed
one); the two liveness-inventory entries were reclassified from *local fact* to the taxonomy's
existing **`a pointer:`** category, which is what they always were.

`LIVENESS_SHAPES` was widened twice — six phrases in fix round 1 (2 hits, both self-inflicted, both
now inventoried) and five more in fix round 2 (`drained again`, `re-drain`, `reconciled again`,
`reconciliation resumes`, `resumes reconciliation`) producing **zero** new unmarked hits tree-wide.
The orchestrator's stop rule — report rather than fix if a widening surfaces more than five
pre-existing hits — was never reached in either round.

**Git state:** `00cb174`, tree clean, pushed to `origin/main` (this paragraph recorded by the
follow-up commit). The commit holds **16** files: **four new** — `src-tauri/src/reconciliation.rs`
(the queue, the wire types and the command), `docs/decisions/2d-4a-notes.md` (the record, with both
fix rounds' correction blocks), `docs/decisions/2d-4-split-notes.md` (the split decision, taken
before execution) and `docs/reviews/phase-2d-4a-queue.md` (rounds 1 and 2 verbatim) — nine modified
`src-tauri` sources, the **two i18n dictionaries**, and this checkpoint. **No core file at all**, and
`cargo tree -p espansoconfig-core | rg tauri` is still empty. **The only `src/` paths are
`src/lib/i18n/{en,es}.json`** — the TypeScript wire is 2d-4b's by the split. `git status --short
--untracked-files=all` after the commit is empty: no real-config path, no launch artifact, no
untracked file. **The step is NOT closed by it** — two Codex rounds, both NOT READY, both fixes in
the tree and green, and **round 3 is owed against the round-2 fix**. A fresh session resumes from
"Next action".

### What is NOT proven

- **Round 3 has not run.** Fix round 2 changed both code and prose, including a design change no
  reviewer asked for, and this project's record is unambiguous about what that means: in Phase 2d-3,
  rounds 12, 13 and 14 each found a High that a previous fix round had written.
- **No mounted and no window evidence, deliberately.** Q7 assigns those to 2d-6 and 2d-7. 2d-4a
  draws nothing, so it owes neither — but that also means **nothing here has been seen on a screen**.
- **Nothing consumes the queue.** No frontend can call `drain_external_changes` until 2d-4b registers
  the wrapper, so every claim about what a consumer will do is a claim about a future step. The two
  wake sentences now say so in as many words; they said the opposite for one round.
- **The obligations `discarded > 0` implies are assigned, not enforced.** Overflow is observable
  rather than silent because `discarded` is cumulative, and the documentation requires a complete
  workspace reload rather than partial reconciliation — but **nothing in 2d-4a enforces that**, and
  R4 assigns enforcement to the future consumer.
- **`issued_identities` has no bound within an epoch** (R9), and duplicates the path retention of
  `espansoconfig_core::workspace`'s process-wide table. It is unmeasured; round 2 confirmed it adds
  no new stale-address class.
- **R3 is narrowed, not closed**: a non-UTF-8 *added* file still arrives as a path rather than a
  sidebar row, and a non-UTF-8 `Changed` still loses its revisions. That is a deviation from Q3's
  `Added { disk? }`, taken deliberately and argued in `2d-4a-notes.md` §3.
- **Q3's watcher failure/degraded-mode code does not exist to register.** `WatchStatusView` is two
  booleans, unserialized and rendered by nothing, so nothing tells a window that the polling fallback
  engaged. That is a **phase hole for 2d-6**, not something 2d-4a could close.

---
## Verification — Phase 2d-3-C (COMPLETE — the liveness contract, its twenty pointers and the check that keeps them; 2d-3 CLOSED by owner decision)

**This step exists to end a review tail, by owner decision taken 2026-08-26: *"Do it then, I don't
want more rounds."*** Fourteen consecutive rounds of the 2d-3 review each found a false claim about
the observation pipeline's liveness guarantees, and rounds 12, 13 and 14 each found Highs that a
*previous fix round* had written. The record named the root cause twice and twice declined to build
the remedy — **residue 38** (§19.7: the contract is stated in no single place, so every consumer
paraphrases it) and **residue 41** (§20.7: a sweep scoped to a file list cannot find the twin in the
file the list omits). **This step builds both.** There is no round 15.

### The argument, stated so it can be judged rather than admired

**The claim had roughly twenty surfaces on which it could be false, and the tail was long because
each round could only find some of them.** Reducing the surfaces to **one** is the convergence
mechanism; the test is what keeps it at one. That is the whole argument, and it is deliberately
narrower than *"the check reviews the prose"* — **it does not**, and §5 of
`docs/decisions/2d-3-C-notes.md` says so in the same sentences that describe what it does.

### What was built

**1. The contract** — the module doc of `crates/espansoconfig-core/src/watch/liveness.rs`, which
declares no type, no function and no constant. **Five guaranteed clauses and six expressly not
guaranteed**, each derived from and cited to the code item it comes from. It lives in the core
because the core owns the primitive, already carries `#![deny(missing_docs)]`, and — decisively — a
doc comment there is reachable by **compile-checked** intra-doc link from `src-tauri`, which no
markdown file is. Items in the application shell are named as **plain text** rather than linked,
because the core never depends on `tauri` (CLAUDE.md §3) and such a link could not resolve.

**2. Twenty pointers** — `ledger.rs` 9, `watch.rs` 4, `engine.rs` 3, `main.rs` 2, `commands.rs` 1,
`watch_check.rs` 1 — each replacing a paraphrase with a link. **Both crates now deny
`rustdoc::broken_intra_doc_links`**, so renaming or deleting the contract **breaks the build** rather
than silently orphaning twenty pointers. That lint turned **11 pre-existing** broken or ambiguous
links into errors, which were fixed in passing (5× ambiguous `[write]` → `[mod@write]`, `MatchDraft`,
`WriteStep`, 2× `CommandError`, and two links to `#[cfg(test)]` items reduced to plain names) — doc
comments only, and unavoidable once the gate exists.

**3. The check** — `src-tauri/src/liveness_contract.rs` walks `src-tauri/src/` and
`crates/espansoconfig-core/src/` **recursively**, joins comment runs into prose units before matching
(so a claim wrapped across a line break is still one claim), matches **50 phrases** in 5 shape
groups, and compares **both ways** against an inventory of **82 entries over 125 hits in 17 files** —
11 contract, 1 pointer, 50 local fact, 20 false positive. **Every one of the 125 is classified and
none was made to disappear by narrowing the pattern.** Four new tests.

### The check was driven to red twice, by two people, on two files — and that is the gate

**This project has been burned by a guard that was argued rather than driven** (round 11 removed a
`preceded_a_commit == 0` assertion as "redundant"; round 12's High was that the removal was recorded
as costing nothing when it cost a detection). So the check was **proved**, not asserted:

- **The implementer's proof.** A wrapped false claim planted in `ledger.rs`'s module doc →
  `FAILED. 0 passed; 1 failed`, reporting `"answered by": found 2, inventory says 1` among others —
  and `answered by` **matched across the line break**, which a line-based sweep cannot see. Removed →
  `ok. 4 passed`.
- **The orchestrator's independent proof, in a different file the implementer never used.** Planted
  `"Every owed observation the engine must answer, and a refusal re-owes the path so it stays owed
  until it is answered."` into `src-tauri/src/main.rs`'s module header →
  **`FAILED. 3 passed; 1 failed`**, naming all four phrases with found-vs-inventory counts
  (`"is answered"`, `"must answer"`, `"re-owe"`, `"stays owed"`, each *found 1, inventory says 0*),
  each with its surrounding prose, and closing with the four categories to judge it under. Reverted →
  green.

**Round 13's and round 14's Highs would both now be test failures rather than review findings.**

### The contract was checked against the code, not against the record

The orchestrator verified the sharpest clause independently. **G2** — *the engine's `settle` removes
the debt before running the three settlement kinds and puts it back when none produced an
observation* — is exactly `engine.rs:1043`'s `let owed = self.owed.remove(path);` and the
`self.owed.insert(path.to_path_buf());` in the `else` arm, whose own comment calls the alternative
"a check and a spend in two places". **G4**'s basis is the `Undone { replaced, owed }` written two
lines below it. The clauses describe the code.

The implementer's own self-review also caught **one over-claim in the contract before it shipped**:
G3 first said a rollback *"puts the path back into the pipeline"*, when **both** of
`revert_settlement`'s arms drop an unwatched path. It now states the restore as unconditional and the
re-entry as **not**, citing §5 item 17 — the item that had said the true thing since round 5.

### The gates — re-measured by the orchestrator on the shipped tree

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1272 passed / 0 failed** over **26** result lines, exit 0 — **+4**, exactly the four new tests |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, **227** filtered out, **67.19 s**, exit 0, no timeout |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo doc --workspace --no-deps` | exit 0 — **so with `broken_intra_doc_links` denied, all twenty pointers resolve**. Its 74 remaining warnings are `private_intra_doc_links`, a **different and pre-existing** lint about public docs linking to private items |
| `cargo tree -p espansoconfig-core \| rg tauri` | empty — the architecture rule holds with the new module in the core |
| `git diff --name-only 08a3366 -- src/` | empty — so **431 / 2125 / 184** are carried |

**The non-comment diff across both source trees is five lines**, verified by the orchestrator:
two `#![deny(rustdoc::broken_intra_doc_links)]` attributes, `pub mod liveness;`, and
`#[cfg(test)] mod liveness_contract;`. **No behaviour, no signature, no control flow**; `decide`,
`revert_settlement` and `observe_owed` are untouched.

### What this step does NOT close — read §5 of the step record before trusting the mechanism

Seven limits are recorded there. The four that matter to whoever writes the next liveness sentence:

1. **The check cannot judge whether a claim is true.** It catches an **unmarked** claim and a **new**
   one. A passage carrying a pointer and still saying something false passes — **and so does a
   reworded sentence reusing a recorded phrase in the same file**, because the inventory key is
   `(file, phrase)` and a swap moves no count.
2. **A paraphrase built from none of the fifty phrases is invisible.** *"The engine is obliged to
   emit"* would pass. The family is a set of wordings, not a semantic test.
3. **The sweep skips exactly one file — the check's own source**, whose phrase table holds the whole
   family by construction. It asserts that file exists so a rename cannot silently empty the skip
   list; nothing else defends the hole.
4. **It sweeps two source trees and no document.** `docs/` is excluded on purpose — it holds the
   append-only review history, where fourteen rounds of false sentences are quoted deliberately, and
   a check over it would fail on its own record. So §1's headline and §5's note point at the contract
   **as prose, with nothing enforcing it.**

Residues **39** and **42** (the two argued-not-driven halves) are untouched — neither is a claim
about where the contract is stated. Residue **44** survives at its new position: the contract's own
clauses are prose over code and no test fails if one drifts. **What changed is the count — one
passage to check against `revert_settlement` instead of twenty.**

### One process note, recorded because it cost a recovery

The orchestrator reverted its own planted probe with `git checkout src-tauri/src/main.rs` on a tree
with **unstaged** work. The index was `HEAD`, so that discarded the implementer's edits to that file
along with the probe — including the `#[cfg(test)] mod liveness_contract;` declaration, which
**orphaned the entire check module** (the suite silently ran *0 tests, 243 filtered out*). The
implementer restored the file from its own context. **On a tree with unstaged work, `git checkout
<path>` is not an undo**: revert a probe with the inverse edit, or plant it on a copy.

The documented host scar recurred once and behaved exactly as recorded: the implementer's **first**
workspace run hit 3 `watch_check` baseline timeouts **while two of its own poll loops were running**;
loops killed, orphans reaped, re-run quiet, clean. **Do not poll the machine while these suites run.**

**Git state:** `04d0889`, tree clean, pushed to `origin/main` (`5c2a285..04d0889`; this paragraph
recorded by the follow-up commit). The commit holds **18** files: **three new** —
`crates/espansoconfig-core/src/watch/liveness.rs` (the contract),
`src-tauri/src/liveness_contract.rs` (the check) and `docs/decisions/2d-3-C-notes.md` (the record) —
eleven modified sources across both crates, `docs/decisions/2d-3-notes.md` (§1's headline, one
correction block and one §5 note; **§7–§20 and the review ledger untouched**, per residue 43) and this
checkpoint. **This is the first 2d-3 commit to add a file to `crates/espansoconfig-core`**, and
`cargo tree -p espansoconfig-core | rg tauri` is still empty. **No frontend file and no `src/` path**,
for the last time — 2d-4 touches the frontend. `git status --short --untracked-files=all` after the
commit is empty. **Phase 2d-3 is CLOSED by this commit**; the next action is 2d-4.

---

## Verification — Phase 2d-3 review round 14 (NOT READY — 2 High, 2 Low; fix in the tree, round 15 owed)

Commissioned as a **static** review, by the precedent 2d-2's round-1 High set. The brief carried the
host-measured gates and forbade running `cargo test` or anything matching `watch_check::`; the
reviewer's closing paragraph confirms it used no tests, builds, watcher checks, npm commands or
network access. Codex wall clock **242 s** at `--effort medium` — the fastest round of the fourteen,
and note that round 13 took ~7 min on a brief of comparable size, so the duration is host and queue
state and not a signal about depth.

**The brief predicted the seam and the reviewer found it one layer deeper than the brief aimed.** It
asked whether round 13's *narrower* liveness claim was true at every one of the eight positions it
replaced. The answer was that the narrower claim is **still unconditional where the code is
conditional**: round 13 replaced *the engine must answer* with *the path stays owed*, and *stays
owed* is itself a guarantee `revert_settlement` gives only sometimes.

**Both Highs are this project's declared worst defect class, and both were verified against the code
by the orchestrator before the fix round was commissioned** — the standing rule after thirteen rounds
in which a fix round's own fix became the next round's finding. That makes **fourteen consecutive
rounds** with a name-position finding, and the **third consecutive round** in which both Highs are
sentences a *fix round* wrote while closing something else.

### What round 14 found

**High 1 — the §1 headline made a rollback produce an observation.** *"a refused reading is
**answered** — the engine takes its settlement back and **observes the path again**"*, against
`ObservationEngine::revert_settlement`'s own doc, which says in as many words that it *"schedules a
read, so it emits nothing itself. The observation comes back out of a later `tick`, with whatever the
file holds **then**"*. The headline now says the engine restores the prior tracked state and
**re-hints** the path, and that *answered* names **that rollback and never an observation that
arrives**.

**High 2 — *re-owes the path* is conditional in the code and was unconditional in thirteen
descriptions of it.** This one is a genuine reading of the primitive rather than a paraphrase drift,
and the orchestrator confirmed it in `crates/espansoconfig-core/src/watch/engine.rs` before
commissioning anything. `revert_settlement` ends:

```rust
let owed = match self.undo.remove(path) {
    Some(Undone { replaced, owed }) => { /* restore the tracked state */ owed }
    None => false,
};
if owed { self.observe_owed(path, now); } else { self.hint(path, now); }
```

So a path is re-**owed** only where the settlement being taken back had itself discharged an
`observe_owed` request. **An ordinary native-hint settlement has `owed == false` and takes the plain
`hint` branch** — and a hint is exactly the thing the whole suppression argument says may be
*coalesced into silence*, which is what *stays owed* promises cannot happen. Thirteen positions said
it unconditionally: six in `ledger.rs` (including round 13's own new safety sentence at ~509–513),
one in `watch_check.rs`, five in the record, and the reviewer cited `engine.rs:928` as the authority.
Every one now says the debt is restored **only where the settlement taken back had discharged one**,
and **the two negatives the reviewer expressly cleared are retained** — a `PrecedesACommit` refusal
publishes nothing and clears nothing.

**Low 1 — three of §19.4's after-counts were measured on the wrong tree.** §19.4's finished-tree
counts for `docs/reviews/phase-2d-3-ledger.md` were taken before the same commit appended round 13's
own review text to that file, so they were false the moment the commit was made: re-measured on
`5a41d7d` the file holds **10** liveness-shape, **3** debt-shape and **6** `same sentence` hits
against the recorded 0, 0 and 5. §19.7 item 40's example also said the record's debt count went
2 → 2 while §19.4 itself correctly says 2 → 10. The fix round **re-measured every §19.4 count on a
`git archive` copy rather than copying the reviewer's figures**; the reviewer's three were confirmed
and the rest stand.

**Low 2 — §19.5 said six correction blocks and named seven.** §1, §10.5, §12.6, §15.3, §16.1, §18.1
and §18.5; `rg -n 'Correction \(round-13 fix round'` returns seven. **The miscount had already
propagated into this file's round-13→round-14 handoff**, which called them *the six correction blocks*
and then listed seven — recorded here rather than rewritten there, because that section is now
historical.

### What the fix round's own sweeps added

**Six positions beyond the four cited — two in code and four in the record — and the two code
positions are both in `src-tauri/src/main.rs`'s module header.** That file is the twin §19.4's sweep
**could not see**, because round 13's sweep enumerated `ledger.rs`, `watch.rs`, `watch_check.rs` and
`commands.rs` and not the directory. **One of the two is round 13's own High 2 sentence — *"an
**owed** observation the engine **must answer**"* — still standing a full round after it was
corrected in `commands.rs` and in the headline.** This is the sharpest instance yet of the standing
rule that a sweep must be run over a *directory*, never over a remembered file list.

The name-position pass separately found **§10.3's section heading** (*"a rollback promises a fresh
observation"*), blocked rather than rewritten per §2.6's precedent.

**Judged and deliberately kept, with reasons in §20.4:** `ledger.rs`'s *is re-observed* section
heading and its four driven test comments and messages; `watch.rs`'s *ask* heading and the
`…_asks_for_a_re_observation…` test names; `engine.rs`'s `revert_settlement` and `settle` docs, which
are **already conditional** and are the reviewer's own authority; `2d-1-notes.md:140` and
`watch.rs:1199`; §1's `Undone` bullet, recorded as the closest call because its antecedent is *the
debt*; and the eight *What is guaranteed* sections. **§5 item 17 turns out to have said the true
thing since round 5** and is named in §20.2 as the witness — the record contained its own refutation
for nine rounds.

### The gates — re-measured by the orchestrator on the fixed tree, not accepted from the worker

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1268 passed / 0 failed** over **26** result lines, all `ok`, exit 0 |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 223 filtered out, **66.77 s**, exit 0, no timeout |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | empty |
| `git diff --name-only 08a3366 -- src/` | empty — so **431 / 2125 / 184** are carried, not re-measured |

**The workspace total is unmoved and it had to be**: `git diff -U0 src-tauri/src/` filtered to
non-comment lines returns **nothing at all** this round. Round 13 changed exactly one such line (an
assertion message); round 14 changes **zero**. No behaviour, no signature, no control flow, no test,
no assertion, no assertion message; `decide`'s `read_after <= at` untouched; no core file, no `src/`
path, no command, wire type, event, queue, i18n key or user-visible string.

The orchestrator also re-wrapped one line of the `ledger.rs` safety sentence that the fix round's
edit had left broken mid-clause (*"never a\nstate reported\nwrongly"*). Comment whitespace only;
`cargo fmt --check` and clippy re-run clean after it.

### Round 14's own deviations, recorded rather than smoothed over

1. **Four numbers were corrected in place**, not only beneath — §19.4's three after-counts and
   §19.5's block count — each still carrying a correction block beside it. The argument, recorded as
   **residue 43**: a count is read as a *measurement*, and a later round re-runs the sweep against
   the figure it finds, so leaving the false one standing above a correction invites the next round
   to compare against it. Every other correction this round is added beneath, per the convention.
2. **The new residues are 41–44 and live in §20.7, not §5.** This record's convention since round 9
   puts items 25+ in each round's own `§N.7`; the fix round followed it and added a navigational note
   at §5's head mapping items 25–44 to their sections. That is a deviation from the brief, which
   asked for §5, and the convention is the right call.
3. **Round 13's preamble in `phase-2d-3-ledger.md:717` still carries *"leaves the state owed"*.** It
   was left standing because **that file is append-only**, and corrected in §20.2 with the reason
   stated in both files.
4. **No `crates/espansoconfig-core` change was needed**, which matters for the same reason it did at
   round 13: the primitive already said the true thing — `revert_settlement`'s *"A debt is restored
   with the state. **If** the settlement being taken back discharged an `observe_owed` request"* is
   correctly conditional — and only its consumers' descriptions were wrong. **Two rounds running, the
   code was right and the prose about it was not.**

### Operational — a new trap, and it cost a false exit 0

**The companion's launch response names the job `jobId`; `status --all --json` names it `id`.** A
watchdog written from the launch response matches `x.jobId === id` against the listing, finds nothing,
and — under round 13's *"job not found anywhere means probably finished"* rule — reports terminal
**at 0 s, on a job that had not started yet**. The rebuilt `wait-on-log.sh` now matches `x.id ||
x.jobId` **and** treats *not found* as terminal only once the job has actually been seen listed, with
a 120 s grace period before it gives up. The round-13 rule is right and was incompletely stated: *not
found* means finished **only after the job has been seen**.

The rest of round 13's traps held exactly as recorded: `codex-wait.sh` is unusable (the companion
stamps `updatedAt` once and never advances it, so it cries STALLED on a healthy job — poll the **log
file's mtime**); `cargo test --workspace 2>&1 | tail -40` discards the totals; and `git status` for
unexplained one-line document changes came back with exactly the five expected files and nothing else.

**Git state:** `c5f2289`, tree clean, pushed to `origin/main` (`5a41d7d..c5f2289`; this paragraph
recorded by the follow-up commit). The commit holds **six** files: three sources
(`src-tauri/src/{ledger,main,watch_check}.rs`), **no core file** (the fifth 2d-3 fix round to need
none — and the second running in which the core said the true thing and only its consumers were
wrong), two documents (`docs/decisions/2d-3-notes.md`, `docs/reviews/phase-2d-3-ledger.md`) and this
checkpoint. **No frontend file and no `src/` path**, across the whole step. **`src-tauri/src/main.rs`
is in a 2d-3 commit for the first time since round 9** — it is where both of round 14's Highs had a
twin nobody had swept. `git status --short --untracked-files=all` after the commit is empty — no
real-config path, no launch artifact, no untracked file, and no unexplained one-line document change
of the kind round 12 caught. **The step is NOT closed by it**; round 15 is owed against the round-14
fix. A fresh session resumes from "Next action".

---

## Verification — Phase 2d-3 review round 13 (NOT READY — 2 High, 1 Low; fix in the tree, round 14 owed)

Commissioned as a **static** review, by the precedent 2d-2's round-1 High set. The brief carried the
host-measured gates and forbade running `cargo test` or anything matching `watch_check::`; the
reviewer's closing paragraph confirms it used no tests, builds, watcher checks, npm commands or
network access. Codex wall clock **~7 min** at `--effort medium`.

**The brief predicted the seam and the reviewer found it there.** Round 12 had corrected a premise at
four positions, and in doing so *wrote* two new claims — *bounded by the host clock advancing* and
*bounded in the safe direction*. The brief asked, in as many words, what the corrected sentences now
rest on. **They rested on a liveness guarantee this pipeline expressly refuses**, and the refusals
were already written in the code's own doc comments.

**Both Highs are this project's declared worst defect class, and both were verified against the code
by the orchestrator before the fix round was commissioned** — the standing rule after twelve rounds in
which a fix round's own fix became the next round's finding.

- **High 1** — `ledger.rs:486` said the retry *"is bounded by the host clock advancing"* and that
  *"every refusal is answered by a re-observation"*. `watch.rs`'s `ReObserveOutcome` doc says
  **`Asked` is not a promise that an observation will arrive** and that a continuously written path
  *"is never answered at all"*; `engine.rs`'s `observe_owed` says it *"promises no answer at all for a
  path that never stabilizes"*; and `WorkerMessage::Stop` can be consumed before the next tick. The
  clock may therefore advance indefinitely with the retry never completing.
- **High 2** — the **§1 headline**, untouched across twelve rounds, said *"every one of those requests
  is an **owed** observation the engine must answer"*. `observe_owed` refuses precisely that. This is
  the document's single most load-bearing sentence.
- **The Low** — §18.5 recorded all five `commands.rs` ordering-pattern hits as the serialized-doors
  argument. **The orchestrator re-ran the sweep**: only `:155` and `:2409` are; `:1339`, `:1371` and
  `:2057` matched the pattern's *a second time* alternative and concern resolving something twice. The
  count was right and the judgement was wrong.

**Nothing was cleared.** The reviewer positively cleared `decide`'s equality refusal (round 10's
ruling, untouched), the safety property that a `PrecedesACommit` decision never reaches the downstream
sink, the exact-zero assertion's removal and its round-12 replacement justification, §18.5's supplied
sweep arithmetic and file list, and the serialized-door reasoning at the two hits where it does apply.

**The fix round's own two sweeps found nine further instances the reviewer did not name**, eight in
code — `ledger.rs`'s *two proofs* bullet, both halves of `LedgerTally::preceded_a_commit`, a comment
in `record_app_write`, the closing sentence of *a read the save path could not use*, `watch_check.rs`'s
round-12 paragraph, `commands.rs`'s **module header** (the code twin of the §1 sentence), and, at a
**name position**, the assertion message at `commands.rs:8372`, which said *is observed again* over a
test that asserts an **inbox** and now says *is asked for again*. That makes **thirteen consecutive**
rounds with a name-position finding.

**Verification the orchestrator performed rather than accepted**, because a worker's report is a claim:

- the review file's verbatim half is **byte-identical** to the fetched Codex result (`diff` clean);
- `git diff -U0 src-tauri/src/` filtered to non-comment lines yields **exactly one** changed line in
  the whole round — the assertion's message string — so *no behaviour, no signature, no control flow*
  is a measured statement and not the author's;
- the changed line is the **message argument** to `assert_eq!(inbox.re_observations(), vec![path], …)`;
  the asserted values are untouched;
- §19.5's *file by file* list names **all five** files plus `PROGRESS.md`, so §18.4's Low 2 is not
  repeated;
- §18.5's and §17.5's carried sweep counts were re-measured on the tree **before** briefing, and all
  six matched, which is why the brief told the reviewer the arithmetic was not where to look.

**Gates, all measured by the orchestrator, twice — before the fix and after it:** `cargo test
--workspace` **1268 passed / 0 failed across 26 result lines, exit 0**; focused serial
`cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` **20/20, 223
filtered out, exit 0** (237.04 s before the fix, 65.14 s after — host state, not a baseline); clippy
`-D warnings` exit 0; `cargo fmt --check` exit 0; `cargo tree -p espansoconfig-core | rg tauri` empty;
`git diff --name-only 08a3366 -- src/` empty, so the frontend's 431 / 2125 / 184 stand as carried.

**The scar re-measured itself this session, and it is worth recording.** The **first**
`cargo test --workspace` failed with **9 `watch_check` bounded-wait timeouts** on the clean tree at
`719c864`, aborting before any other binary reported — while the orchestrator was polling `git status`
and running `rg` sweeps against the same host. The focused serial gate then passed **20/20** on that
identical tree, and a quiet re-run gave **1268 / 0 over 26 lines**. **The suite is evidence on a quiet
host only**, and polling the machine during it is enough to confound it.

**A checkpoint defect caught and repaired before the commit.** Replacing the "Next action" block
initially **destroyed** the superseded round-12→round-13 handoff while inserting a header claiming to
preserve it — a false label of exactly the class this review has spent thirteen rounds finding. The
218-line block was recovered from `HEAD` and restored beneath its header; the handoff chain is intact.

**Open risks and deviations:** none deviated from the reviewer's remedies, and none of the three
findings was cleared. Three new residues in §19.7 — item 38 (**the root cause of both Highs**: the
liveness contract is stated in no single place, so every consumer paraphrases it, no type carries the
*asked* / *observed* distinction, and nothing enforces the paraphrase; the fix round **deliberately
declined** to invent a canonical section while fixing eight positions, and that judgement is round
14's to test), item 39 (the safety half is argued and not driven — no test holds a path permanently
unstable and asserts nothing is published for it), item 40 (every correction is prose). The standing
posture holds: **seven** §5 items recorded as bounded residues have since been found to be real
defects, and rounds 12 **and** 13 both had Highs that were records about a residue written by the
round that created it.

**Git state:** `3b52479`, tree clean, pushed to `origin/main` (`719c864..3b52479`). The commit holds
**six** files: three sources (`src-tauri/src/{commands,ledger,watch_check}.rs`), **no core file**
(the fourth 2d-3 fix round to need none), two documents (`docs/decisions/2d-3-notes.md`,
`docs/reviews/phase-2d-3-ledger.md`) and this checkpoint. **No frontend file and no `src/` path**,
across the whole step. `git status --short --untracked-files=all` after the commit is empty — no
real-config path, no launch artifact, no untracked file, and no unexplained one-line document change
of the kind round 12 caught. **The step is NOT closed by it**; round 14 is owed against the round-13
fix. A fresh session resumes from "Next action".

---

## Verification — Phase 2d-3 review round 10 (NOT READY — 0 High, 0 Medium, 1 Low; fix in the tree, round 11 owed)

Commissioned as a **static** review, by the precedent 2d-2's round-1 High set. The brief carried the
host-measured gates and forbade running `cargo test` or anything matching `watch_check::`; the
reviewer's closing paragraph confirms it used no tests, builds, watcher checks or network access.
Codex wall clock **282 s** at `--effort medium`.

**Round 10 is the first round in ten to return no High and no Medium.** Its verdict line is still
`NOT READY`, on the strength of one Low.

**Acceptance criteria and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| The round-9 fix's *combination* of three remedies judged, not just each in isolation | yes | cleared: three lifetimes are right because the three maps answer three different questions |
| §5 item 25 judged rather than inherited | yes | **downgraded** to a maintenance risk; the arm-scoped refresh audit is exact today |
| The orchestrator's named suspect resolved either way | yes | **cleared**: the withholding door's refreshed state is shown to nobody |
| Every finding closed | yes | the single Low is fixed, with the sweep and a regression |
| Gates green, re-measured by the orchestrator | yes | 1268/0 across 26 lines; 20/20 serial in 64.44 s; clippy, fmt, tree all clean |

**Verification, run by the orchestrator on the post-fix tree, not accepted from the worker:**

```sh
cargo test --workspace                    # 1268 passed; 0 failed; 26 `test result:` lines; exit 0
cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1
                                          # 20 passed; 0 failed; 223 filtered out; 64.44 s; exit 0
cargo clippy --workspace --all-targets -- -D warnings   # exit 0
cargo fmt --check                         # exit 0
cargo tree -p espansoconfig-core | rg tauri             # empty — architecture rule holds
git diff --name-only | rg '^src/'         # empty — no frontend path touched
```

The `223 filtered out` is itself evidence: round 9's run reported 222, so the new test is in the same
binary and the +1 in the workspace total is that test rather than a recount.

**Decisions, and why:**

- **The asymmetry between the reload and the two save tails is deliberate and must not be "fixed".**
  The orchestrator briefed it as a suspect — `conflict_after_the_lock` and `after_a_save` also accept
  a foreign revision into the workspace cache, yet only the reload got the new `announced`
  invalidation — and the reviewer cleared it: the withholding door's refreshed state is shown to
  nobody, so an older announced entry stays valid and a return to it may correctly coalesce. Recorded
  because a later round that re-derives the suspicion without the answer would "fix" a non-defect.
- **`watch_check`'s exact-zero assertion was kept rather than weakened**, and the timing argument it
  rests on is recorded as unmeasured (§5 item 30) instead of being asserted as sound. Weakening it
  would have removed the only executable check on the tally's ordinary-path value.

  > **Correction (round 11).** The last sentence is **false**, and it is round 11's Medium. The check
  > on the stamp is the **bounded positive wait** for `suppressed >= 1` twenty lines above the
  > assertion, not the assertion — proved by neuter: with the worker's stamp taken once at first use
  > rather than per pass, the test fails at *timed out waiting for the save's own bytes to be
  > suppressed*, the wait's message. **The assertion is removed at round 11** and item 30 is closed
  > as a defect, its residue standing.
- **The doc states its own limit in the same sentence as its claim** — it says what sustained growth
  would indicate and, in the same breath, that no threshold is enforced anywhere. That is this
  project's standing rule about guarantees the code does not give.

  > **Correction (round 11).** **It did not**, and this bullet is round 11's second High seen at the
  > checkpoint's own name position. The claim ended in a full stop and *No threshold is enforced
  > anywhere* began a new sentence, so this line claimed compliance with the standing rule that the
  > code it describes did not give — the one defect class no test can fail. The doc's bullet is one
  > sentence as of round 11, and the concession is widened to name that the tally keeps no per-path
  > count and that nothing fails when the counter climbs.

**Open risks and deviations:** none deviated from the reviewer's remedy. Three new residues are
recorded honestly in §16.6 rather than as reassurances — items 30, 31 and 32 — and the standing
posture is that such items are expected to become real defects, not merely suspected of it. Seven of
them have; item 25 is the first to survive its round.

**Git state:** `82c7dc5`, tree clean, pushed. Frontend untouched across the whole step.

---

### Phase 2d-3 — round 11 of the ledger review, and its fix round

**Completed.** Round 11 was briefed from the round-10 fix and returned **NOT READY with 2 High, 1
Medium and 1 Low**. All four are fixed and the fix is green. **Round 10's clean sheet lasted exactly
one round**, and the shape of what broke it is the lesson: **round 10 corrected a *conclusion* and
left its *premise* standing, in the same paragraph.** Its Low was the tally doc's *on a healthy
production path this stays zero*; the rewrite that closed it kept, in the very next clause, *the hints
one commit generates are decided after that commit's anchor and **never** reach this arm*. Eleventh
consecutive name-position finding; third consecutive that was a premise rather than a word. **Both
Highs were this project's declared worst defect class.**

**Acceptance:**

- **High 1 closed** — the doc's *never* and §16.6 item 30's *nothing enforces this ordering* were
  written in the same fix round and contradicted each other from the moment both existed. The doc now
  says zero is the **usual** outcome, says *usually is all it is* in the same breath, and names the
  stall that produces the exception. §16.1's first bullet carries a correction block.
- **High 2 closed** — §16.1 asserted the tally doc stated its concession *in the same sentence* as its
  claim. It did not. The doc's bullet is now one sentence and the concession is **widened**, naming
  that no per-path count exists and that nothing fails when the counter climbs.
- **Medium closed** — `watch_check`'s `preceded_a_commit == 0` removed. **Proved by neuter, not
  argued**: the worker's per-pass `Instant::now()` replaced by a `OnceLock` initialized at first use —
  the permanently early stamp in production shape — makes the test fail at *timed out waiting for the
  save's own bytes to be suppressed* (`watch_check.rs:141`, 128.06 s), the **wait's** message, not the
  removed line's. `watch.rs` restored byte-identically and absent from the diff.
- **Low closed** — the test's four-tuple message said *no other decision was taken* while step 3 takes
  and asserts a withhold; corrected, and `withheld == 1` now asserted.

**Verification** — every gate measured by the orchestrator, **twice**: on the clean tree before the
fix and again after it.

```sh
cargo test --workspace                    # 1268 passed, 0 failed, 26 result lines, exit 0 (both runs)
cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1
                                          # 20/20, 223 filtered out, 64.77 s then 64.85 s, exit 0
cargo clippy --workspace --all-targets -- -D warnings   # exit 0
cargo fmt --check                         # exit 0
cargo tree -p espansoconfig-core | rg tauri             # empty — architecture rule holds
git diff --name-only 052dd38~1 HEAD | rg '^src/'        # empty — no frontend path across the step
```

The totals are **unchanged at 1268**, and that is the expected result rather than a missing
measurement: this round removed one assertion and added one, and neither is a test.

**Decisions, and why:**

- **A removed check must be proved redundant, not argued redundant.** The reviewer's Medium and the
  comment above the assertion both said the positive wait carries the detection, but round 10's record
  had said the opposite with equal confidence. The neuter is what settles it, and it is recorded in
  §17.6b with the failing message quoted.

  > **Correction (round 12).** *Settles it* claims too much, and that is round 12's **second High**.
  > The neuter replaced the per-pass stamp with a `OnceLock`, so it drives the **permanently** early
  > stamp and nothing else; what it proves is that the surviving wait catches *that* case. It does
  > **not** prove the removed line detected nothing else, and it did detect something else: under an
  > **intermittently** early stamp the tally — which `begin_epoch` does not reset, so it is
  > cumulative for the session — stayed non-zero and the exact-zero line failed, while the rollback's
  > correctly stamped re-pass satisfies the wait and the test now passes. **The removal was still
  > right** — the line could not tell that defect from the harmless save-thread stall — but it cost a
  > detection, and round 11 recorded it as costing nothing. §18.2 carries the correction and §18.7
  > item 35 carries the debt.
- **The concession was widened rather than relocated.** Satisfying the same-sentence rule by moving a
  clause would have left the weaker claim intact; the doc now also says the tally keeps no per-path
  count and that nothing fails when the counter climbs, which is what makes *sustained growth* legible
  as a suspicion rather than a diagnosis.
- **Item 30 is closed as a defect and kept as a residue.** The assertion it was written about is gone,
  but no test exercises the rename-to-record window and none can without a deterministic
  production-stamping seam — which is 2d-4's shape, not this step's.

  > **Correction (round 12).** The last clause is **false**, and it is round 12's third Low. The
  > authority is `docs/reviews/phase-2d-design.md` **Q7 item 4**, which scopes 2d-4 to the queue, the
  > wake event, the drain command and the wire contracts and names no stamp and no seam. **Q7 assigns
  > the seam to no phase at all.** The debt is carried unassigned in §18.7 item 35 and must not be
  > quietly attached to a phase again.

**Open risks and deviations:** none deviated from the reviewer's remedy. Two new residues are recorded
in §17.7 — item 33 (the save-thread stall has no test) and item 34 (`watch_check` now asserts strictly
less: the surviving wait proves a **permanent** early stamp only, so an intermittent one still passes).
Item 34 is the sharpest thing round 12 inherits, because round 11 removed a check and the round that
reviews it must decide whether the trade was right rather than accept the argument that removed it.

**Git state:** `411658f`, tree clean, pushed. Frontend untouched across the whole step.

---

### Phase 2d-3 — round 12 of the ledger review, and its fix round

**Completed.** Round 12 was briefed from the round-11 fix and returned **NOT READY with 2 High and 3
Low**. All five are fixed, none was cleared, and the fix is green. **Round 11's lesson held against
round 11 itself**: the brief asked whether a *third* premise stood in the paragraphs round 11 had
corrected twice, and it did. Twelfth consecutive name-position finding; both Highs are again this
project's declared worst defect class — a record claiming a guarantee the code does not give.

**Acceptance:**

- **High 1 closed — program order does not give a strictly greater `Instant`, and four claims said it
  did.** `decide`'s chronology check is `read_after <= at`, so **equality refuses**, deliberately: the
  comment directly above it already said `Instant` is monotonic but *not* guaranteed strictly
  increasing, and the test helper `later_than_now()` is `Instant::now() + 1ns` **because** of it. So
  *the re-observation's own stamp is taken after the anchor* is true in **program order only**, and a
  clock collision lets one anchor refuse successive re-readings. Four positions presented one refusal
  per commit as a guarantee — `ledger.rs:480`, `ledger.rs:861`, `watch_check.rs:1227` and item 30's
  round-11 correction block. Each now carries the concession **inside the same sentence**, never
  beginning a new one — repeating round 11's High 2 here would have been the fourth instance of that
  shape. `decide`'s comparison is untouched; the behaviour was already right.
- **High 2 closed — the assertion's removal was recorded as costing nothing, and it cost a
  detection.** Round 11's neuter replaced the per-pass stamp with a `OnceLock`, so it drives only the
  **permanently** early stamp; it proves the surviving wait catches that case and nothing more. Under
  an **intermittently** early stamp the removed line *did* fire: `LedgerTally` is cumulative —
  `begin_epoch` clears `writes`, `documents_by_path`, `announced` and `latest_commit_at` but **not**
  the tally — so one transient refusal left `preceded_a_commit` non-zero for the session and the
  exact-zero assertion failed, whereas the rollback's correctly stamped re-pass satisfies the wait and
  the test now passes. **The removal stands** — the line could not tell that defect from the harmless
  save-thread stall — but §17.7 item 34's *"exactly as it did before"* was false, and five record
  positions plus `watch_check.rs`'s own comment now state the trade.
- **Low 1 closed** — the orchestrator's named suspect, confirmed. §16.1's closing paragraph still
  claimed *the first half of the old paragraph is intact* and *the one production assertion of zero is
  kept rather than weakened*; round 11 changed that first half and removed that assertion. A
  correction block now sits beneath it.
- **Low 2 closed** — §17.6's *file by file* list named three files; `git show 411658f --stat` lists
  **five**. Corrected, and the fix round found the habit is older than round 11: **seven** prior such
  sections (§§10.2, 11.2, 12.4, 13.3, 14.6, 15.6, 16.3) never named the review file either.
- **Low 3 closed** — item 33 assigned the deterministic production-stamping seam to 2d-4. The
  authority does not: `phase-2d-design.md` **Q7 item 4** scopes 2d-4 to the typed queue,
  `workspace://reconciliation-ready`, `drain_external_changes`, the TypeScript wrapper, command
  registration and dispatch tests, sequence/epoch/coalescing tests and the EN/ES namespaces — **no
  stamp and no seam anywhere in it**. The attribution is removed and the debt carried unassigned.

**Verification** — every gate measured by the orchestrator, **twice**: on the clean tree before the
fix and again after it.

```sh
cargo test --workspace                    # 1268 passed, 0 failed, 26 result lines, exit 0 (both runs)
cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1
                                          # 20/20, 223 filtered out, exit 0 — three runs, see below
cargo clippy --workspace --all-targets -- -D warnings   # exit 0
cargo fmt --check                         # exit 0
cargo tree -p espansoconfig-core | rg tauri             # empty — architecture rule holds
git diff --name-only 08a3366 -- src/                    # empty — no frontend path in this round
```

The totals are **unchanged at 1268**, and that is the expected result: this round adds and removes no
test and changes one assertion's **message** only.

**The focused serial gate's wall-clock moved and it is not this round's doing.** 71.24 s before the
fix, then **285.53 s** and **253.40 s** after it — the second on a verified-quiet host with no orphaned
binary. All three are 20/20, 0 failed, 223 filtered out, exit 0. That file's round-12 diff is comments
only: no timing constant, no wait, no test. **The duration is host state**, and the ladder of past
figures (64.77 s, 64.85 s, 71.24 s) is not a regression baseline — what this gate asserts is 20/20 and
no timeout, never a wall-clock. Recorded in §18.6b so round 13 does not read it as a finding.

**Decisions, and why:**

- **A neuter proves the case it drives, and no more.** Round 11 removed a check on the strength of one
  neuter and recorded the removal as costless. The neuter was sound and the *conclusion drawn from it*
  was too wide — which is the same failure as round 11's own finding against round 10, one level up.
  The removal is kept because it is right on its merits, not because the neuter licensed it.
- **A residue must not be assigned to a phase that does not own it.** Reading Q7 item 4 rather than
  accepting the reviewer's summary was the check; the reviewer was right, and the debt now names no
  phase at all rather than a convenient one.
- **Four files were reverted, not committed.** `PROGRESS.md` and three `docs/reviews/phase-0*` records
  were rewritten mid-session by something outside this run, changing `/goahead` to `/goahead-fable`
  inside **historical** text. Those documents record what was actually run at the time; the rename
  belongs to the environment's present, not to their past. Reverted before the commit.

**Open risks and deviations:** none deviated from the reviewer's remedy, and none of the five findings
was cleared. Three new residues in §18.7 — item 35 (the intermittent-early-stamp detection is gone and
nothing replaces it; recovering it needs the seam Q7 assigns to no phase), item 36 (every correction
this round made is prose and no test fails if a later round un-makes one), item 37 (§18.6's complete
file list is a convention, not a check — nothing compares such a list against `git show --stat`). The
standing posture holds: **seven** §5 items recorded as bounded residues have since been found to be
real defects.

**Git state:** `d079dd5`, tree clean, pushed. Frontend untouched across the whole step.

---

## Verification — Phase 2d-3 review rounds 4 and 5 (IN PROGRESS — both NOT READY, both fixes in the tree, round 6 owed)

Both rounds were commissioned as **static** reviews, by the precedent 2d-2's round-1 High set: the
Codex sandbox blocks FSEvents delivery, so a delivery-dependent test times out there while the
supported host passes it repeatedly. Each brief carried host-measured numbers instead, taken by the
orchestrator on the tree under review rather than reported by the author.

| Command | Round 4's brief | After the round-4 fix | After the round-5 fix |
|---|---|---|---|
| `cargo test --workspace` | 1249 / 0 | 1251 / 0 | **1256 / 0** |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | 20 / 0 (68 s) | 20 / 0 (62 s) | **20 / 0 (63 s)** |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | clean | clean |
| `cargo fmt --check` | clean | clean | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | empty | empty | empty |

The frontend was never touched across the whole step — `git diff --stat` names only
`crates/espansoconfig-core/src/watch/engine.rs`, `src-tauri/src/{commands,ledger,main,watch}.rs` and
three documents — so `npm run check` 431 files, `npm test` 2125 and `npm run build` 184 modules are
carried, not re-measured.

**Round 4 — NOT READY (1 High, 1 Low).** The High: a clock-equality refusal on the **save path**
could permanently lose a differing post-save external observation, because that door had neither an
engine settlement to revert nor a retry. It falsified `2d-3-notes.md` §5 item 16, which the round-3
fix round had written as an honestly bounded hole claiming the cost was one *publication* and that
the watcher's own hints would report the change — `2d-2-notes.md` §2.3 expressly permits a healthy
native backend to miss a hint. The Low: `revert_settlement`'s doc promised "the same observation
again" though it re-reads. Cleared without findings: the one-pass `undo` lifetime, rescan ordering,
the exhaustive sink answer, the strict `Instant` proof, lock order, post-guard rollback, no weakened
test, no 2d-4 scope creep.

**The round-4 fix.** `decide`'s chronology operand became the **private** `ReadChronology`;
`admit_at_current_epoch` was renamed `admit_under_the_session_lock`, lost its `Instant`, and can
build only `SerializedWithEveryRecord`, which skips the chronology arm — so the save path consults
no clock and `PrecedesACommit` is unreachable there. `decide` matches the enum exhaustively, making a
future third proof a compile error. Its premise was re-derived from the call graph rather than
inherited, and round 5 later confirmed it independently.

**Round 5 — NOT READY (1 High, 2 Low).** The High is **§5 item 18 judged quietly optimistic**: a
post-save refresh that *fails* evicted the cache, admitted nothing and returned `Saved`, losing the
same external change round 4 called High, reached through `Err` instead. Both Lows were
**name-position misses by the round-4 fix round's own sweep** — documentation still describing
save-path stamping that no longer happens, `main.rs` saying "three things" where there are now four,
and a test named for a session-lock premise it does not exercise. Round 5 also **confirmed** the
chronology premise independently, `ReadChronology`'s privacy, the lock order, the leaf mutexes and
the absence of 2d-4 scope creep.

**The round-5 fix.** `ReObserver::re_observe(path)` puts one `WorkerMessage::ReObserve` on the
running watcher's existing inbox; the worker absorbs it through the **extracted**
`WatchWorker::hint_paths`, so a re-observation and a native hint are one code path; the engine's
ordinary two reads settle and the stamped door admits. Nothing publishes from the failed single read
and nothing clears the record. Three properties were verified in code before it was built, and the
orchestrator re-verified the first two: the inbox is `std::sync::mpsc::channel()` — **unbounded**, so
the send cannot block under the session lock, which is the whole lock-order argument (no
`sync_channel` exists in the file); a workspace with no watcher answers `ReObserveOutcome::NoWatcher`
rather than panicking or erroring a save; and the path adds no event, queue, command, wire type or
serialization.

**A sixth narrower instance, found by the round-5 fix round in its own change before any reviewer saw
it**: `run_one_save`'s `may_have_written()` arm evicted the cache and returned having read nothing —
the same lost-observation shape through a third arm. Closed by `after_an_uncertain_write`.

**Ten neuter runs across the two fix rounds**, each disabling exactly one thing the fix added and
each restored: the round-4 pair failed `left: PrecedesACommit, right: Admitted { sequence: 1 }`
(16/1) and `left: None, right: Some(Content(…))` (72/1); the round-5 four failed with the
re-observation missing (75/1, three times) and `left: NoWatcher, right: Asked` (4/1).

**Not driven, and stated rather than hoped about** (`2d-3-notes.md` §11.6): no test pushes a
`WorkerMessage::ReObserve` through a *spawned* worker, because that would put a second real FSEvents
session into `watch_check` and move its 20/20. The ask, the message's arrival and the
engine-plus-gate stabilization are each driven separately.

---

---

## Phase 2d-4a — rounds 7 and 8, and the corrective phase they left behind

_Archived from `PROGRESS.md` on 2026-08-29 when Phase 2d-4a-D closed. Both blocks below are
verbatim as the live head carried them: first the verification narrative of rounds 7 and 8, then
the "next action" block that commissioned 2d-4a-D. 2d-4a-D's own record is
`docs/decisions/2d-4a-notes.md` §18._

### The verification narrative, as it stood

### Phase 2d-4a — rounds 7 and 8 (2026-08-29, `/goahead-opus`, driven mode)

**Reviews: 2/2 — the workflow's whole allowance — tail started 17:42, closed 18:27, both rounds the
adversarial Opus fallback, both `ship-with-fixes`, every finding fixed.** Neither was Codex: the
round-7 Codex job failed 221 s in on a usage limit ("try again at 7:07 PM"), which is one bounded
attempt spent and **not** a `QUOTA` outcome. Round 8 was commissioned by `CLAUDE.md` §7.1 because the
round-7 fix changed five source files — a comment-only change to a source file is a source change,
and this project keeps contracts in comments.

- **Round 7** — 0 High, 1 Medium, 4 Low, all false or incomplete sentences in source comments. Its
  Medium: the panic policy cited `crate::commands`' module header as why two poisoned mutexes are
  safe, when none of that header's three grounds is true of `QueueState`. The fix **refused the
  reviewer's own proposed replacement reasoning** and derived a stronger one from `drain`. It changed
  **no executable line**.
- **Round 8** — 0 High, 1 Medium, 2 Low, scoped to the round-7 fix. Its Medium: the rewritten panic
  paragraph claimed an *enforcement* the code does not perform — `after_sequence` is an unvalidated
  `u64` off the wire, and `begin_epoch` replaces the whole state. Its two Lows were a span description
  that was backwards for one of two spans, and a "fifteenth"/"fifteen-position" count that counted
  three pointers as statements. All three fixed, at eight positions.
- **Round 8 also cleared three claims by its own derivation** rather than accepting them: no
  executable line changed (verified with `git diff -U0`, whitespace-stripped); the round-7
  reproduction is verbatim (97 lines against 97, zero hunks after demotion); and M1's substituted
  claim traces true through `drain`.
- **Round 9 is owed and cannot run here.** The round-8 fix changed two source files, so §7.1
  commissions it; the cap of two invocations and 45 minutes is spent; §7.4 makes the debt a corrective
  phase. **2d-4a is recorded as superseded by 2d-4a-D, never as complete.**

**Gates on the tree this iteration produced**, measured by the orchestrator alone, no worker running
Cargo: `cargo test --workspace` **1313** passed / 0 failed over **26** result lines all `ok`, exit 0;
`clippy -D warnings` clean; `cargo fmt --check` clean; `cargo doc` **73** `private_intra_doc_links`,
0 unresolved; `cargo tree -p espansoconfig-core | rg tauri` empty; `watch_check::` **20/20**, 268
filtered, 77.63 s; `npm test` **2125** in 56 files; `npm run check` **431** files / 0 errors; `npm run
build` **184** modules, server oracle absent, client oracle present with 2 matches.

**The first of those runs failed, and it is the iteration's most useful result.** Exit 101, 287 passed
/ 1 failed: `every_retained_state_claim_is_judged` rejected the M1 comment at
`src-tauri/src/reconciliation.rs:1425` on phrase `"things end"` — *found 1, inventory says 0*. 2d-4a-C's
guard caught a new claim written by a fix round, within an hour of its own nine-round tail closing,
having never fired on new prose before. Judged in `INVENTORY` as a local fact, with the reason recorded.

### The next-action block that commissioned 2d-4a-D

### Rounds 7 and 8 of 2d-4a both RAN today. The next action is **Phase 2d-4a-D** — round 9's review of the round-8 fix — then **Phase 2d-4b**.

**🛑 Do not run a step-2 round 10 of 2d-4a-C.** That tail is closed by owner decision; reopening it
needs a new owner ruling, not a fresh session's judgement. 2d-4a's own tail is a different tail and
is *not* closed — see below.

#### What happened on 2026-08-29, under `/goahead-opus` in driven mode

**Round 7 ran, its fix ran, round 8 ran, and its fix ran. Both reviews were the adversarial Opus
fallback, not Codex.** The Codex job dispatched for round 7 (`task-mtem01j9-fnltn3`, high effort)
failed 221 s in on *"You've hit your usage limit ... try again at 7:07 PM"*. Under
`~/.claude/scripts/goahead-base.md` that is one bounded attempt spent — Codex is never relaunched
inside a phase — and **a Codex limit is explicitly not a `QUOTA` outcome**, because it is another
provider's window closing and stops no Claude work. So both rounds ran as fresh cold Opus agents,
each writing its own report file, each reproduced verbatim into the queue.

| Round | Verdict | Findings | Report |
|---|---|---|---|
| 7 | ship-with-fixes | 0 High, 1 Medium, 4 Low — all false or incomplete sentences in source comments | [`docs/reviews/phase-2d-4a-round-7.md`](docs/reviews/phase-2d-4a-round-7.md) |
| 8 | ship-with-fixes | 0 High, 1 Medium, 2 Low | [`docs/reviews/phase-2d-4a-round-8.md`](docs/reviews/phase-2d-4a-round-8.md) |

Both are reproduced verbatim in [`docs/reviews/phase-2d-4a-queue.md`](docs/reviews/phase-2d-4a-queue.md)
(§ `## Round 7 — verbatim`, `## Round 8 — verbatim`); the round-8 reproduction was checked with `diff`
and is byte-identical apart from the permitted `###`→`##` demotion. The record is
[`docs/decisions/2d-4a-notes.md`](docs/decisions/2d-4a-notes.md) **§16** (round 7) and **§17** (round 8).

**Round 8 cleared, by its own derivation, the three things the brief told it to disbelieve**: no
executable line changed in the round-7 fix; the round-7 reproduction is verbatim; and M1's
*substituted* claim — the round-7 fix having refused the round-7 reviewer's own reasoning and put a
different one in its place — traces true through `drain`.

#### 🔔 2d-4a-C's guard fired on new prose, for the first time, in anger

The first `cargo test --workspace` after the round-8 fix **failed**, exit 101, 287 passed / 1 failed:
`retained_state_contract::tests::every_retained_state_claim_is_judged` rejected the M1 comment,
naming `src-tauri/src/reconciliation.rs:1425`, phrase `"things end"`, *found 1, inventory says 0*.
The mechanism 2d-4a-C spent nine rounds building — which had cleared the code outright from round 4
onward and had never once caught a new claim — **caught one written by a fix round within an hour of
that tail closing.** It is judged in `INVENTORY` as a *local fact* with its reason; the suite is
green. `docs/decisions/2d-4a-notes.md` §17.3 is the account.

#### Step 1 — Phase 2d-4a-D, the corrective phase (THE NEXT ACTION)

**Why it exists, and why 2d-4a is recorded as superseded rather than complete.** The round-8 fix
changed **two source files** — `src-tauri/src/reconciliation.rs` (one comment hunk) and
`src-tauri/src/retained_state_contract.rs` (one `INVENTORY` entry) — so `CLAUDE.md` §7.1 commissions
round 9. The `/goahead-opus` workflow caps a phase at **two review invocations and 45 minutes**, both
exhausted (the tail ran 17:42–18:27), and `CLAUDE.md` §7.4 says that cap binds first and that **a
source fix it leaves unreviewed is a debt carried, not written off**: it becomes a corrective phase
with its own acceptance criteria, its own commit and its own mandatory review.

**Scope — narrow, and this is all of it.** Round 9 reviews the round-8 fix's diff: the M1 comment
hunk at `reconciliation.rs:1489-1493` and the `INVENTORY` entry in `retained_state_contract.rs`, plus
§17 of the record. **The `INVENTORY` entry is the sharper half** — it was written *after* round 8 read
the diff, because the guard that demanded it had not yet run, so nothing has reviewed the judgement
itself. §17.4 marks that *actionable*.

Reuse the dispatch procedure below. Codex's window reopened at **19:07 on 2026-08-29**, so round 9
can be a real Codex round; if it is not, the fallback is a fresh cold `general-purpose` agent on
`model: "opus"` with the brief template in `~/.claude/scripts/goahead-base.md`.

#### The dispatch that works, measured across thirteen rounds

**It is [`docs/decisions/codex-dispatch-procedure.md`](docs/decisions/codex-dispatch-procedure.md)** —
the read-only brief's shape, the `.job.status` trap, why `codex-wait.sh` false-stalls and what to poll
instead, the never-re-dispatch rule, the two permitted edits to a reply, and what to do when Codex
returns a usage limit rather than a review. **Read it before dispatching round 9.**

#### Step 2 — Phase 2d-4b

Spec: [`docs/decisions/2d-4-split-notes.md`](docs/decisions/2d-4-split-notes.md) §2 — the mirrored
TypeScript types, the `BrowserCommands` wrapper for the drain, the **injectable** event-listener
wrapper, the `describe*` builders in `src/lib/i18n/codes.ts` with their reactive `t*` wrappers in
`index.ts`, the frontend tests, and the re-measured `npm run check` / `npm test` / `npm run build`
baselines. Its four inherited constraints are listed at the end of the round-7 brief. By the standing
rule since 2b-2c, a design consult comes before any line of it is written.

---
