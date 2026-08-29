# Phase 2d-4a-C — the closure narrative

_Archived verbatim from `PROGRESS.md`'s "Next action" section on 2026-08-29, when the
checkpoint was split. The text below is unedited._

---

### **PHASE 2d-4a-C IS ✅ CLOSED, by owner decision of 2026-08-29.** Step 1 closed at round 4 (READY, 0 findings). Step 2 is implemented, every gate green, and **closed after nine review rounds** — the owner ended the tail rather than running a tenth. The record-structure decision is **answered and carried out**. THE NEXT ACTION IS **2d-4a REVIEW ROUND 7**, then **PHASE 2d-4b**.

#### ✅ ROUND 9 RAN AND RETURNED, 2026-08-29 — and it is the round the tail ends on

Round 9 was re-dispatched after the Codex window reopened at 2:03 PM WEST and **returned a complete
verdict**: **NOT READY — 0 High, 0 Medium, 4 Low**, recorded in full under `## Step 2 — round 9` in
`docs/reviews/phase-2d-4a-C.md`. Its own summary of what it found: *"All four findings are substantive
overclaims in round 8's new record or orchestrator wording, not restatements of wording already
corrected. **The Rust machinery and inventories remain cleared.**"*

**All four Lows are prose, and all four are fixed.** They are §25.1–§25.4 of
`docs/decisions/2d-4a-C-notes.md`: a stylistic claim about this record that the record itself refutes;
§19.2's **71** folded in with the guard-dependent figures when it is ordinary file enumeration;
*every one was run once* over-describing an execution history the same block prints; and a true
statement about one pipeline written as a fact about pipes. §25.5–§25.11 record what the round
measured and deliberately did not fix, and §25.12–§25.14 are its changes, gates and thin spots.

**What the nine rounds establish, and it is the ground for closing.** Rounds 4, 5, 6, 7, 8 and 9 each
cleared the code outright — the shared sweep, both guards and their inventories have now stood
unchanged across **six** consecutive reviews, and round 9 changed **no source file at all**. The
tail's own arithmetic says the same: eight consecutive rounds had found their entire finding list in
the previous fix round's own words, round 9 made it nine, and the severity fell to **zero High and
zero Medium** for the first time in the step.

#### 🛑 THE OWNER ENDED THE TAIL AT ROUND NINE — 2026-08-29. **There is no round 10.**

Step 2 closes on round 9's verdict rather than running another round against round 9's own fix. The
ground, stated so a later session can weigh it rather than accept it:

- **The code has been clear for six consecutive rounds.** Round 9's findings, like rounds 7's and 8's,
  are entirely about the accuracy of the record's own prose. At the close `git status` showed **no
  source file modified** — only the two documents.
- **The tail has no termination condition of its own.** *A fix is a change, and the round that reviews
  it is not optional* generates a round for every round, and §25.14 item 11 duly nominates round 9's
  own new sentences as round 10's targets. **This is the shape that ran Phase 2d-3 to fourteen
  rounds**, whose round 14 changed **zero** non-comment lines under `src-tauri/src/` before the owner
  ended it the same way on 2026-08-26.
- **What a round 10 would buy is measured, not guessed.** Rounds 7 and 8 returned 0 High; round 9
  returned 0 High and 0 Medium. The expected yield of a tenth round is a few Lows against sentences
  round 9 wrote about sentences round 8 wrote.

**The residue is recorded, not pretended away.** §25.5–§25.11 and §25.14 carry what round 9 measured
and left, including the items it marked *Unchecked*; **R9 remains OPEN**; and §3 is still knowingly
two passages short, whose closure needs a ruling that reopens step 1. None of these is a defect in the
machinery, and each is a named entry a later phase can pick up.

#### ✅ THE RECORD-STRUCTURE DECISION IS ANSWERED — **reorganize** — and it is done, 2026-08-29

The standing question §22.6 put to the owner — **reorganize §18–§20, or keep annotating** — was
answered **reorganize**. It has been carried out, recorded at `docs/decisions/2d-4a-C-notes.md` **§26**,
with the moved material in **Appendix A** of the same file.

**Both arguments were honoured, because nothing was dissolved into prose.** The stacked blocks were
moved **verbatim**, each still headed by the round that wrote it and in the order it was written, so
the audit trail §21.7 defended survives intact; the body keeps one block per passage stating the
current claim, which is the linear readability round 6 asked for.

- **Taken:** §14 item 5's **three** amendment blocks → **Appendix A.1**, and §17.2's **two** →
  **Appendix A.2**. Those are exactly the two stacked passages §22.6 handed to the owner.
- **Left, and this is a finding rather than an omission:** §18.6 and §19.7. Round 4's part and round
  5's part of each **correct two different sentences, and both are current** — round 5 narrowed only
  round 4's own tail — so moving either half would take a live correction out of the body. Round 6's
  consolidation is the reorganization those two needed. §26.1 carries this.
- **The residual is named rather than retrofitted**, per §22.6's own practice: seven passages naming
  §14 item 5's individual amendments now resolve into Appendix A.1 rather than into §14, and two
  statements that the stacks *are untouched* were true when written and are now historical. **None
  was edited.** §26.3 lists them by line.

The body's marked-block count is **57**, down from 60; Appendix A holds the five originals, so the
file carries **62** marked blocks of which five are historical copies. §26.2 states the test by which
a reader can check that nothing was lost, and §26.4 says where §26 itself is thin.

#### The next action: **2d-4a review round 7**, then **Phase 2d-4b**

2d-4a-C is closed, so the deferred round-7 brief below is now **live**: round 7 runs against **both**
the round-6 fix and the mechanism 2d-4a-C built. Then 2d-4b, whose spec is
`docs/decisions/2d-4-split-notes.md` §2 and whose four inherited constraints are listed at the end of
that brief. **Do not run a step-2 round 10** — the tail is closed by owner decision, and reopening it
needs a new owner ruling rather than a fresh session's judgement.

**⚠️ The working tree was left uncommitted at the close.** It holds round 9's review record, round 9's
fix round, and the §26 + Appendix A reorganization, across `docs/reviews/phase-2d-4a-C.md` and
`docs/decisions/2d-4a-C-notes.md`. **No source file is modified.** Commit these before dispatching
round 7, so the round has a revision to bind its measurements to.

#### The dispatch that works, measured across eleven rounds

Codex runs **read-only** and writes no file, so the brief must say the workspace may be read-only,
that **its final message IS the deliverable**, that the caller captures it, and that a sandbox limit
**must not affect the verdict**. Rounds 5 and 6 each hit one, ran the analyses another way, and said
so inside the reply without hedging the verdict — exactly what the brief asks for. Dispatch with the
companion CLI directly rather than through the subagent, so the verbatim reply is capturable:

```sh
CC=$(ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | head -1)
node "$CC" task --background --effort high "$(cat brief.txt)" --json    # returns jobId and logFile
node "$CC" result <job-id>                                              # after a TERMINAL status
```

**`node "$CC" status <job-id> --json` answers `{workspaceRoot, job}` — the status is at `.job.status`,
and round 6 lost two nine-minute windows to a poller that looked for it anywhere else.** Search
`.job.status` first; the `running` / `recent` / `latestFinished` pools with `id || jobId` are for
`status --all`. `~/.claude/scripts/codex-wait.sh` **false-stalls on healthy jobs** — its `updatedAt`
never advances — so keep the **log file's mtime** as the stall signal, with a hard deadline as well.

**A dead watchdog is not a dead job, and rounds 5 and 6 proved it twice, differently.** Round 5's
poll process was killed while the job ran on; round 6's poller simply could not see a completed job.
**Check the job before concluding anything, and never re-dispatch the review** — one review per
round, however many waits it takes to collect. Note that `status` echoes the entire prompt back, so
filter its output rather than reading it whole.

Durations so far: step 1 round 3 **301 s**, round 4 **141 s**, step 2 round 1 **604 s**, round 2
**262 s**, round 3 **302 s**, round 4 **402 s**, round 5 **~11 min**, round 6 **~13 min**, round 7
**~11 min**, round 8 **543 s (~9 min)**, all at high effort. **Budget two nine-minute windows; one
may now suffice.** **Round 8 is the first round in the phase collected by a SINGLE bounded foreground
wait** — 543 s, the fastest since round 4, and `codex-wait.sh` was not used at all: a hand-rolled
loop read `.job.status` directly and carried the log file's mtime as the stall signal, with a 540 s
hard deadline. Nothing false-stalled and nothing was re-dispatched.
**Round 7 collected cleanly on the round-6 advice**: `.job.status` read directly, the log file's
mtime as the stall signal, two chained **foreground** waits of 540 s (the first expired with the log
actively being written — that is a healthy job, not a verdict; the second saw `completed` at 90 s).
Nothing false-stalled and nothing was re-dispatched.

**Only two edits to the reply are permitted**: demoting its internal `##` headings to `###` so the
review file stays one `##` per round, and dropping the Codex session-ID trailer. Nothing else.
**Rounds 3, 4, 5, 6 and 7 each needed only the second of the two** — every brief asked for `###`
headings and nothing came back at `##` (round 7 verified it: `rg -c '^## '` over the reply → **0**). Ask for the heading depth in the brief; it is one fewer edit
to be trusted about.

#### A reviewer's incidental attribution is a claim like any other — and so is a reviewer's inventory

Round 5's finding 1 said the same-key substitution limit is stated in *the module documentation*,
meaning `prose_sweep.rs`. **It is not** — `prose_sweep.rs` defers inherited limits to each check, and
the limit lives in the two guards' own headers. **Round 6 then supplied the second instance**: its
finding 3 named **two** stacked correction blocks, and the record holds **four** (§14 item 5 with
three, §17.2, §18.6, §19.7). The fix round measured rather than complied, and the orchestrator
re-ran the anchored search independently. **Round 7 supplied the third**: its finding 2 named **four**
fenced commands as mechanically missed by sweep D, and only **two** are — 819 and 1070; 594 is
surfaced by line 591 as an inline span, and 3363 matches at its own body line 3364. **Do not copy a
reviewer's file/line attribution or count into the record without deriving it yourself** — and when
yours disagrees, record yours and say so. **This now applies to the fix round's own drafts too**:
round 7's fix round caught two of its own by measurement before shipping them.

**Round 8 is the first round with NO disagreement, and that is a result, not a licence to stop.** The
orchestrator re-derived all three of its numeric findings **before** the fix worker was dispatched —
sweep J's 12 and its twelve line numbers, the five caveat places, and 4227 / 4853 / 650 / 24 / 626 —
and every one matched the reviewer exactly. **The instruction is what produced the agreement; four
rounds of disagreement are what made it worth running.** Meanwhile the *fix round's own drafts* went
on being wrong in the usual proportion: round 8's fix worker corrected **four** of its own by
measurement — a "four lines up" distance claim, a "line 145" for a sentence spanning 144–147, a
"stacked passages three → six" where the true figure is **four** (verified by listing all 45
annotations and testing adjacent pairs), and a **false staleness alarm** claiming §23.8 item 8's five
line numbers had gone stale when all five are still exactly right. **The reviewer being right does
not make the fix round right.**

#### The gate baseline — ALL NINE measured on this tree after round 8's fix, none inherited

- **`1313 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). **Unmoved by round 8's fix, and necessarily so: no source file changed** —
  `git diff --stat -- src-tauri crates src` is **empty**. `git diff --stat` for the round is two
  files, both under `docs/`. 26 result lines, all `ok`, **0 failed**.
- **The frontend three were re-measured again, on a tree where no source file changed.** The standing
  rule only fires for a step that touches `src/` and this step did not, so this was optional; it was
  run because the phase's discipline is *all nine measured, none inherited*. All three reproduce:
  `npm run check` **431 files, 0 errors, 0 warnings**; `npm test` **2125 passed** over 56 files;
  `npm run build` **184 modules**. **Round 9 inherits measured figures.**
- **The bundle oracle was run because a build was run**, both lines per `CLAUDE.md`:
  `rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js` → **absent**;
  `rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js` → **2**, present. **184 is a
  legitimate count**, established by the discriminating oracle and not by reading the number alone.
- `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean;
  `cargo doc --workspace --no-deps` exit 0 with **73** `private_intra_doc_links`, the pre-existing
  count, and **zero** unresolved links; `cargo tree -p espansoconfig-core | rg tauri` **empty**.
- Source line counts, **all three unchanged** by rounds 4, 5, 6, 7 and 8: `prose_sweep.rs` **405**,
  `retained_state_contract.rs` **1305**, `liveness_contract.rs` **874**. Inventory entries **86**
  liveness / **140** retained-state and shapes **61** / **88**, unmoved since `65a0138` and unmoved
  **by construction** for five rounds now, since no file under `src-tauri/` was touched.
- `docs/decisions/2d-4a-C-notes.md` is **5515** lines (4853 after round 7's fix, 4227 after round 6's,
  3593 after round 5's, 2954 after round 4's, 2437 before it); `docs/reviews/phase-2d-4a-C.md` is
  **739**. Annotation blocks **37 → 44** by
  `rg -c '^\s*> \*\*(Correction|Corrected|Narrowed|Bound|Amend)'` (**+7, none removed**, verified
  against `1c5a9bb`; the fix round's own count is 38 → 45, the same delta over a wider marker
  alternation that includes `Discharg` — **the delta is the invariant, not the absolute**).
- **The orchestrator's two `> **Filled by the orchestrator` blocks are deliberately OUTSIDE that
  alternation**, so the count does not move when the orchestrator writes. They fill cells the fix
  round had declared `Pending` rather than correct a false sentence. **§24.8 item 12 puts that choice
  up for review in round 9.**
- **The committed record length was taken self-referentially, and the method is the point.** §24.6
  states **5479** as a *handoff* figure and refuses to claim a committed total — which is exactly what
  round 8's finding 4 asked for. The orchestrator's block supplies **5515**, delta **+662** from 4853,
  obtained by inserting the block with its number withheld, measuring, then substituting: **replacing
  a placeholder with digits cannot change a line count.** Repeat that method; do not quote a handoff
  figure as a final one.
- **⚠️ THE HOST SCAR FIRED ON THIS RUN and produced TEN failures.** Kill orphans
  (`pkill -f 'target/debug/deps/espansoconfig-'`), run the workspace suite **once**, and stay off the
  machine — an orphaned bin target left by a killed run produces **nine or ten** `watch_check::`
  baseline-scan timeouts that look exactly like a real failure. Round 8's first workspace run ended
  `FAILED. 278 passed; 10 failed`, all ten panicking at `src-tauri/src/watch_check.rs:141:5`. The
  remedy worked in full: orphans killed, then the single-threaded gate
  `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` (**20/20**, 268
  filtered out, **122.19 s** this round), then one clean workspace re-run at **1313 passed, 0 failed**.
  **No source file changed, so a genuine regression was not available as an explanation.**
- **⚠️ A PIPED GATE DOES NOT REPORT THE GATE'S EXIT STATUS — this cost round 8 a wrong reading.**
  `cargo test --workspace 2>&1 | tail -40` was reported by the harness as **exit code 0**; that was
  `tail`'s status, and ten tests had failed. The failures were visible only by reading the captured
  text. **Do not pipe a gate whose exit status you intend to trust** — let the harness capture the
  full output and read the `test result:` lines. Note also that piping to `tail` discards all but the
  last binary's result lines, which is why the run appeared to have one result line instead of 26.
- **Do not run the workspace suite while another agent is running it** — and do not let the fix worker
  run Cargo at all; rounds 6, 7 and 8 all forbade it in the brief and ran the gates once, alone,
  afterwards. **Round 8's fix worker complied and recorded every gate cell as `Pending — measured by
  the orchestrator after this round`, with its expectations labelled as expectations**; the
  orchestrator then filled §24.7's table from its own runs. That is the shape to repeat: **a round
  that cannot run a gate must not report one.**

#### What step 2 had to build — **the original spec, now DISCHARGED**. Kept as the record of what was asked; do not re-execute it. Check the delivered check against it if you want to audit the step.

The analogue of `src-tauri/src/liveness_contract.rs` (1007 lines) for this family. Read that file
first — it is the working template, and its module header states the limits honestly enough to copy
the honesty as well as the shape.

1. **Do not duplicate the sweep machinery.** `liveness_contract.rs` holds `rust_files_under`,
   `prose_units`, `window_around`, `tally`, `sweep`, `Hit`, `ProseUnit` and `Judged` — roughly 150
   lines the new check needs identically. **Extract them into a module both checks use** (e.g.
   `src-tauri/src/prose_sweep.rs`) rather than copying, because a fix made in one copy and not the
   other is precisely this project's recurring failure. `prose_units`'s comment-run joining is
   **load-bearing** and must not be altered: this workspace wraps doc comments at ~76 columns, and a
   line-based sweep cannot see a claim that straddles a break.
2. **The liveness check must come out exactly as strong.** Its `INVENTORY`, its four tests and its
   both-direction guard stay; the proof is that its tests pass unchanged.
3. **A phrase family drawn around the claims, never the vocabulary.** Step 1 judged 31 prose units
   **out** and recorded why (verification section item 7 and record §5 item 7). Two calls step 2 must
   honour rather than re-litigate silently: `persist/backup.rs` is backup-file rotation, and
   `persist/write.rs`'s lock registry — **R9's exact shape in a second subsystem** — is out because
   nothing decides an observation, a drain or a save admission against it. **Step 2's family will hit
   `write.rs`. Inventory it as a judged position; never narrow the pattern to make it disappear**,
   which `2d-4a-notes.md` §11.4 records as the one move such a check cannot catch.
4. **Inherit step 1's sharpest limit as a limit.** **Four of step 1's 45 pointer passages sit in prose
   units that none of its 33 probe phrases matched** — `ReconciliationWake::newest_sequence`,
   `drain`'s inline `max` comment, `CommitAnchor`, `LedgerState::announced` — plus a fifth,
   `watch/native.rs`'s `NativeWatch` handle. They were found by **reading**. That is measured evidence
   that a phrase family is not the family, and the module doc must say so rather than let the guard
   look stronger than it is.
5. **Both directions must fail**: an unrecorded hit is a claim nobody judged, and an inventory entry
   matching nothing is a passage reworded or removed without being judged again.
6. **Prove it fails, twice, on two different files** — 2d-3-C's own evidence standard (§4.4, "the
   proof that the check fails"; it was driven to red twice, by two people, on two files). Use the
   **actual historical defects**: drop a qualification from a retention position (round 5's finding)
   and drop *within the epoch the batch names* from a watermark position (round 6's). **Revert each
   probe with the inverse edit — on a tree with unstaged work `git checkout <path>` is not an undo.**
7. **State the limits in the module, not only in the record**: it catches an *unmarked* claim and a
   *new* claim; it **cannot judge whether a passage's claim is true**; a rewording that reuses a
   recorded phrase in the same file passes; `docs/` is deliberately not swept and cannot be, because
   `2d-4a-notes.md` quotes six rounds' false sentences on purpose.
8. Then the record `docs/decisions/2d-4a-C-notes.md` gains its step-2 sections, and the phase gets
   its mandatory Codex round.
9. **Cover the co-existence family round 3 named, not only the duration family.** The claim shape is
   **atomic execution promoted into a correlated post-state when the mutations have different
   predicates** — round 2 found three instances of it in *unconditional paired insertions*, and round
   3 found a fourth in a **conditional paired removal** the round-2 sweep could not reach. A family
   drawn from either half alone ships with the blind spot that produced the finding.

#### The gate baseline — measured on this tree at the step-1 commit, not inherited

- **`1309 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). Step 1 was **+0** Rust and touched **no** frontend path, so the three
  frontend figures are carried forward from 2d-4a round 6 unverified-by-this-step **and must be
  re-measured by any step that touches `src/`**. Step 2 should not touch `src/` either.
- `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean;
  `cargo doc --workspace --no-deps` exit 0 with **73** `private_intra_doc_links` warnings, the
  pre-existing count, and **zero unresolved links**; `cargo tree -p espansoconfig-core | rg tauri`
  **empty**.
- **The host scar still binds.** Kill orphans (`pkill -f 'target/debug/deps/espansoconfig-'`), run the
  workspace suite **once**, and stay off the machine. A host that has just built produces spurious
  `watch_check::` baseline-scan timeouts; the single-threaded gate is
  `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` (**20/20**).

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after the round-8 commit
# docs/reviews/phase-2d-4a-C.md              # step 1 rounds 1-4, step 2 rounds 1-8 — read before anything else
# docs/decisions/2d-4a-C-notes.md            # §24 is round 8 and its fix; §24.8 is ROUND 9's work list,
#                                            # and its item 10 nominates round 8's own five likeliest failure sites.
#                                            # §24.7 holds the gate table the ORCHESTRATOR filled, plus the host-scar note
# src-tauri/src/prose_sweep.rs               # complaints_against (r1), selected_files (r2), SelectedFile (r3)
#                                            # — UNCHANGED by round 4's fix; its module doc is §20.3's judgement
# src-tauri/src/retained_state_contract.rs   # the check; its SKIPPED doc (line 288) and the_sweep_reaches_both_trees
# src-tauri/src/liveness_contract.rs         # the sibling; the same two positions, and its SKIPPED doc (line 203)
# crates/espansoconfig-core/src/watch/retained_state.rs  # THE CONTRACT step 2 enforces
# crates/espansoconfig-core/src/watch/liveness.rs  # the other contract; unchanged by this phase
# docs/decisions/2d-3-C-notes.md             # the precedent, §4.4 the proof-it-fails standard
# docs/decisions/2d-4a-notes.md              # §15.4 named this phase's absence; §9 the residues; §11.4 the move a check cannot catch
```

#### After 2d-4a-C closes: review round 7, then 2d-4b

Round 7 runs against **both** the round-6 fix and the mechanism, from the deferred brief below.
Then 2d-4b, whose spec is `docs/decisions/2d-4-split-notes.md` §2 and whose four inherited
constraints are listed at the end of the deferred brief.

---

