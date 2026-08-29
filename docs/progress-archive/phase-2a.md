# Phase 2A — verification and review dispositions

_Archived verbatim from `PROGRESS.md` on 2026-08-29, when the checkpoint was split. The text below is unedited; see `PROGRESS.md` for the live state._

---

## Phase 2a-3b review disposition

The review is [`docs/reviews/2a-3b-codex.md`](docs/reviews/2a-3b-codex.md) — an adversarial review
aimed first at the destructive half, rotation. **Eleven findings: one critical, four high, five medium,
one low**, and its verdict was **"not safe to commit as-is"**. All eleven are dispositioned finding by
finding in `docs/decisions/2a-3b-notes.md` §12: **seven fixed, four partly fixed with the residue
disposed** against a named standing rule.

**What the review actually found, and it was right.** The first pass rotated **before** the copy was
written, so a backup that then failed had already spent a retention slot and deleted an older batch —
which falsified the notes' own sentence that a failed backup costs *"the attempt, and nothing else"*.
It also trusted a **timestamp-shaped directory name as proof of ownership**, excluded the current batch
from rotation only by where its name happened to **sort**, and adopted an existing
`.espansoconfig-backups` that might be a **symlink**, which `read_dir` would then follow out of the
tree. Four separate routes to deleting something the application did not create, in the one function
that deletes anything.

**The five that changed the code most.**

- **F3 — rotation now runs *after* the copy is written and fsynced.** §6's structural argument survives
  the reorder and was re-derived rather than assumed: the new batch is still outside the removal
  window.
- **F10 — the current batch is excluded by identity, not by name order.** Its `(device, inode)` pair,
  with its path as a fallback. *Newly created* does not imply *newest by name*: a clock adjusted
  backwards, or ten future-dated directories, would otherwise make the directory holding this session's
  own copies the oldest candidate.
- **F2 — a batch now carries an ownership marker**, `.espansoconfig-batch`, holding a format identifier
  and a version. `rotate` removes only directories that carry it; a timestamp-shaped directory somebody
  else made is `unrecognised` and survives. The marker is forgeable by a principal who can write inside
  the backup root, and **that principal is out of scope by the same standing rule the rename rests on**
  (2a-3a): the operation is by pathname.
- **F7 — a partial backup used to poison every retry in the same session.** `create_new` failed forever
  on the leftover. It now writes to a temp name inside the batch, fsyncs, checks inode identity
  (`names_the_same_inode`, extracted from 2a-3a's `verify_temp_identity`), publishes exclusively, and
  cleans up on `Drop`. **A residue of the same shape survived and was closed by the confirmation
  round** — see below.
- **F1 / F9 — an existing backup root is now type- and mode-checked.** `symlink_metadata` refuses
  anything that is not a real directory, and a group- or other-accessible root is refused rather than
  adopted, because §5's confidentiality argument rests on the tree being `0o700`.

**F4 is the one that stayed open, deliberately.** The backup is taken before `replace_locked_file`'s
own pre-commit identity checks, which can still refuse — so a backup can exist for a save that did not
commit. The full fix is splitting the locked writer into a prepare phase and a commit phase that cannot
refuse, which is a **redesign of 2a-1's write primitive** and is out of this sub-phase. The cheap and
important half *was* fixed: a `discard` path un-captures the file and removes its copy when the commit
did not write, so a retry cannot commit over a newer target with no copy of the bytes it replaced. The
confirmation round restated `discard`'s contract rather than changing that direction: **the un-capture
stays unconditional** — making it depend on the removal succeeding would reopen F4 on exactly the
failure it exists to survive — and **a removal that fails is now recorded** instead of ignored.

**Three disagreements with the orchestrator's triage were argued and accepted**, and they are recorded
because each is a judgement rather than a fact: F5's guard lives in `capture` rather than in
`rooted_at`, so the constructor stays infallible and the check fires exactly where the first byte would
be written; it matches only the **final** component, because refusing every path containing `config`
would break a legitimate `~/config/espanso`; and F7 has no deterministic mid-write OS failure available
without a production seam, so its biting test asserts the *step* in the error plus the session-level
retry, which is stated in the notes rather than papered over.

**The confirmation pass then ran, and its question 2 found one residue — now closed.** Finding 7
removed the *partial copy* that poisoned every retry; it did not remove the *copy that could not be
removed*. `discard` un-captured the file and removed its copy best effort, so a refused `unlink` left
the file un-captured **and** its backup name occupied, and the exclusive publish answered
`BackupError::DestinationExists` on that retry and on **every later attempt in the session** — a file
made permanently unsaveable by a failure that had nothing to do with it. The refusal was the right
*direction*; the permanence was a trap.

`publish_backup` now **disambiguates instead of refusing** when the occupied name is one this session
left behind: `create_batch`'s bounded counter loop one level down, `-1`, `-2`, …, the undisambiguated
name always tried first, every candidate checked to be free before the `rename`. **Nothing is ever
overwritten** — a stale copy may be the only pristine version of an older file — and **a retry can
always take its own backup**. `discard` keeps un-capturing unconditionally (making it conditional would
reopen F4 on exactly the failure it must survive) and now records the failed removal;
`DestinationExists` survives for the case it was written for, two different targets resolving to one
backup path, which is a defect and not a race. `docs/decisions/2a-3b-notes.md` §7.1 and §12 findings 4
and 7 carry the reasoning.

---

## Phase 2a-3a review disposition

The review is [`docs/reviews/2a-3a-codex.md`](docs/reviews/2a-3a-codex.md) — a focused correctness and
security review of the `fcopyfile` step, its ordering, its failure policy and its `unsafe` block.
**Fourteen findings: two blocking, five should-fix, seven nits.** Its verdict was *"No — `fcopyfile`
itself is suitable, but the guaranteed-cleanup / 'nothing written' claim and the named-temp pathname
race should be fixed before committing as safe."* All fourteen are dispositioned finding by finding in
`docs/decisions/2a-3a-notes.md` §11; the two blocking ones are closed **in code**.

**The two blocking findings, and what closed them.**

- **Finding 12 — the temp file was chmod-ed by *pathname*.** `fs::set_permissions(guard.path(), …)`
  named a file even though the trusted inode was already open, so a process able to modify the
  directory could have had one inode chmod-ed, another written through the descriptor, and an
  attacker-supplied entry renamed over the target. Closed two ways: the mode now goes on through
  `handle.set_permissions(…)` — `fchmod` on the descriptor — and a new `verify_temp_identity` proves,
  immediately before the rename, that `guard.path()` still `lstat`s to the same `(dev, ino)` as the
  open handle. A mismatch is the new `WriteError::TempFileChangedDuringWrite`, which is a **refusal**,
  not an I/O failure, and not a *target* change. The rename itself is still by pathname and cannot be
  made descriptor-based here, so **a directory writable by an untrusted principal is now an explicit
  precondition** in the module documentation rather than a solved problem.
- **Finding 8 — "nothing was written" was too strong.** A `CopyMetadata` refusal leaves the *target*
  untouched, but a temp inode has received bytes and the guard swallows `remove_file` errors, so a
  populated temp file can survive. `may_have_written()` deliberately **kept its name** (public API),
  and its doc comment now says explicitly that it is a statement about **the target** and that `false`
  does not mean no inode anywhere received bytes. Every claim that a failure deletes the temp file was
  weakened, in `write.rs`, `persist/mod.rs`, `lib.rs` and the notes, to what is true: *the target keeps
  its bytes and its protection; a temp file may be left behind.*

**The one should-fix that changed the shape of the transaction.** Finding 5 pointed out that widening
the temp file to the target's mode *before* writing its bytes lets any legitimate reader of the target
observe an empty or partial candidate. The steps are now
`create 0o600 → write → flush → fsync → copy metadata → fchmod → fsync again → verify temp identity →
recheck target → rename`. The mode still goes on **after** the metadata copy, so it keeps exactly one
owner. That reordering also **disposed of finding 1 outright** — no data write follows `fcopyfile`, so
no question about either descriptor's file offset can arise — and carried finding 14's second `sync_all`.

**Two findings were accepted in full and deliberately not implemented**, both recorded as holes rather
than fixed:

- **Finding 11** — the pre-commit re-check compares the target's `(dev, ino)` and its content hash, not
  its metadata. Another process can change the target's ACL, xattrs or mode between the copy and the
  rename, and the newer protection is then lost with both checks still passing. The reordering shrinks
  that window; closing it needs a metadata comparison in the re-check or an inter-process lock, and
  that is a design change beyond a fix round. Notes hole 13.
- **Finding 7** — a copied *denying* ACL can make the guard's own `remove_file` fail, so the leftover
  is not merely possible but likelier in exactly the case the copy was added for. The claim was
  removed; the cleanup was not strengthened to neutralise the ACL or stage in a private directory.
  Notes hole 6 names the residue, and 2a-1's rule still holds: the **name**, not the guard, is the
  safety property — a leftover cannot be matched by espanso's include glob.

**Four findings were confirmations that required no change**, and are recorded as such rather than
omitted: 3 (read-only source and write-only destination are both sufficient; `O_NONBLOCK` is
irrelevant on an already-open regular file), 6 (`chmod` does not clear a macOS ACL — **measured here
before it was trusted**, which is what made the ordering safe), 10's `AsRawFd` half, and 13 (excluding
`COPYFILE_STAT` is right, and `COPYFILE_SECURITY` and `COPYFILE_METADATA` are both worse because they
include it).

**The review round cost one restart.** The first Codex job was given the phase diff, the notes and the
implementation file as *paths* and stalled after seven minutes with its `updatedAt` frozen; it was
cancelled and relaunched with the code inlined in the prompt and file reads, shell commands and web
search all forbidden. The second run returned in about four minutes. **A review brief for this project
should carry its code inline.**

---

## Phase 2a-2b review disposition

The review is
[`docs/reviews/phase-2a-2b-save-transaction.md`](docs/reviews/phase-2a-2b-save-transaction.md), an
adversarial correctness review by Codex over `persist/save.rs`, `tests/persist_save.rs` and the
decision record, read against plan §6.6 and §7's hazard register: **eight findings — one blocking,
seven should-fix. Five were fixed, three were dispositioned in writing and none was argued down.**
§9 of `docs/decisions/2a-2b-notes.md` is the finding-by-finding disposition.

**The finding that mattered most was not the blocking one.** Finding 8 is a **concrete deadlock**: the
transaction's step-2 read used `std::fs::read`, bypassing the primitive's regular-file check and its
`O_NOFOLLOW` open. A fifo at the resolved path — planted by a caller's context, or swapped in after
`lock_path()` resolved it — makes that read wait for a writer **with the non-reentrant path lock
held**, so every later save of that path waits behind it forever. The fix needed more than the reuse
the brief asked for: `open(O_RDONLY)` on a fifo blocks *wherever* it is called, and the type check that
would refuse the fifo is downstream of the open, so `inspect_target` itself gained **`O_NONBLOCK`**.
That is the only change this sub-phase made to 2a-1's primitive, and `persist_write.rs` still passes
25/25 unchanged.

**The blocking finding is real and is not this sub-phase's.** Plan §7 row 11 registers "capture and
restore all four" and `write.rs` restores **mode bits only** — 2a-2b changed no line of that code, and
2a-1 notes §4 already enumerates the eight dropped classes. What Codex adds beyond that record is
worth keeping: on macOS the **extended-attribute** case is ordinary rather than exotic (Finder tags,
comments, quarantine flags), and an ACL loss is an access-control **broadening**. It is accepted as a
real deviation from the plan's register, with `copyfile(3)` + `COPYFILE_ACL | COPYFILE_XATTR` between
the temp write and the rename as the named remedy and **2a-3 as its owner**. It is not silently closed.

**Two findings were about the record rather than the code, and both were overclaims.** §2.2 had said a
blanket "accept everything" acknowledgement **cannot be written** — it can, because `validate()` is
public and `Finding` is publicly constructible, so a caller can compute the findings itself and
acknowledge them without showing anyone anything. And hole 1 had said a `regex` version divergence
could bite "today" while **supplying no divergent pattern and no parity experiment anywhere**. Both
claims are withdrawn and replaced with what is established; the missing parity experiment is now its
own hole. This is the project's signature defect for the sixth phase running — a sentence asserting
more than its body can check — and it now appears in a decision record rather than in a test name.

**Findings 5 and 6 were confirmed and deliberately not fixed.** `DuplicateVariableName` and
`RegexDoesNotCompile` stay unoverrideable `EditorModelError`s, so a file espanso demonstrably runs can
be unsaveable through the visual editor. The reasoning, recorded rather than assumed: refusing a save
never destroys data while permitting one might, so the **reversible** direction is to refuse;
reclassifying is a change to `crate::validate`, which is 2a-2a's closed module; and the escape hatch
the plan names is a **raw editor**, which is a user-interface question **2b** answers and not a policy
question this layer can settle.

---

## Phase 2a-2a review disposition

The review is
[`docs/reviews/phase-2a-2a-semantic-gate.md`](docs/reviews/phase-2a-2a-semantic-gate.md), an
adversarial correctness review by Codex over `validate/mod.rs` and `tests/validate_semantics.rs`:
**nine findings — four blocking, four should-fix, one nit. All nine were accepted and all nine are
resolved; nothing was argued down.** §12 of `docs/decisions/2a-2a-notes.md` is the finding-by-finding
disposition.

**The round has one method, and three of the findings turned on it.** Where a fact about espanso
**can** be established, establish it from espanso `v2.3.0`'s own sources and cite it at the code;
where it cannot, the answer is `SuspiciousButPermitted` and a recorded hole — **never silence**.
Silence and certainty are both wrong answers to an unestablished fact, and the first pass had reached
for silence three times.

**The four blocking findings were all the same direction — false negatives, the expensive one.**

- **Rule 5 never looked inside variable parameters.** A `{{missing}}` in a `shell` variable's `cmd`
  is statically knowable and espanso renders it. The first pass recorded this as a *coverage hole*;
  it was an unimplemented half of a required rule. The projection was never in the way — `params` is
  a `Vec<FieldView>` of `ValueView`s, and the first pass simply did not look.
- **A non-mapping `params` suppressed a provably missing required parameter.** The predicate
  conflated an alias (whose target might be a mapping) with a scalar or a sequence (which provably
  hold no entry under any key). The negative-side test *required* the wrong silence — a fixture
  pinning a defect.
- **`type: match` was accepted with no `params.trigger`.** The first pass found no failure path
  because it looked among the eight registered render extensions, and `match` is not one — it is
  resolved in the renderer, where `get_matching_template` begins `params.get("trigger")?` and answers
  `None` with `MissingSubMatch`. **Looking in the right place and finding nothing is not evidence.**
- **Four of rule 5's five scope-openers suppressed real findings.** The sharpest is that
  **`inject_vars: false` opened scope** — the flag that *disables* injection was read as evidence
  that arbitrary names might arrive. A nameless variable cannot declare a name; a `form` variable
  named `f` explains `{{f.who}}` and not `{{nobody}}`. All five are gone, each with a citation.
  Narrowing an opener is the **false-positive** direction, so the real-corpus run is the guard: it
  still reports **zero** findings of either class.

**The four should-fix findings are one shape, and it is this project's signature defect** — a name or
a doc comment asserting more than its body can check, for the fifth phase running:

- `the_real_configuration_produces_no_editor_model_errors` **could skip and pass**, and when it did
  run it asserted only `errors == 0` while *printing* every suspicious finding. A rule 5 that
  reported every brace pair in the config would have passed it. It now asserts both classes are zero,
  and the skip is **demandable** — `ESPANSOCONFIG_REQUIRE_REAL_CORPUS` turns absence into a failure,
  with a four-combination test of the decision itself. A sabotage produces 117 suspicious findings the
  old assertion would have waved through.
- A test named `..._exactly_where_espanso_does` compared six hand-picked strings to hand-written
  expectations. Renamed to what it checks, and joined by one built from **espanso's own unit-test
  expectations**.
- `every_fixture()` **was not every fixture** — many were local `let source` strings, so the
  reachability and purity sweeps covered a subset. All are now top-level `const`s, and
  `every_fixture_is_listed_in_every_fixture` reads the file's own source and fails when one is
  declared and not listed.
- The nit was **backwards, not merely unproven**: the doc comment said the *second* declaration lost.
  `generate_nodes` keys its node map by name, so espanso is last-wins and the **earlier** one is
  inert.

**One should-fix was a genuine cost, not a claim.** Duplicate detection was `Vec` + `contains` and
every reference linearly rescanned the scope, with a clone of every global name per match — quadratic
work about to run **inside the save lock**, where an adversarial but parseable document makes saving
look hung. Now a `HashSet`, with `NameScope` borrowing the document's global names once.

**E20 exposed a defect in the round's own instrument**: a guard meant to prove a `match` arm was
wired matched *its own text*. Recorded in notes §7 rather than quietly fixed — an oracle that cannot
disagree is the standing rule it violated.

**Two things could not be established and are holes, not decisions.** Whether espanso accepts a
pattern its `regex` 1.5.5 compiles and ours rejects (hole 4, unchanged), and whether a `match`
variable's named sub-match exists at all — that is cross-file and unanswerable from one document
(hole 12). **One new fact arrived too late to act on**: espanso 2.3.0 has a **tenth** variable type,
`var_type: "global"`, which this crate reports as `VariableTypeNotRecognised`. It is not fixed here
because `VariableKind` is a **Phase 1 wire type** owing entries in `en.json` *and* `es.json`; the
variant and the two strings land together or neither lands. Hole 13, and **2b owns it**.

---

## Phase 2a-1 review disposition

The review is
[`docs/reviews/phase-2a-1-atomic-write.md`](docs/reviews/phase-2a-1-atomic-write.md), an adversarial
correctness review by Codex over `persist/write.rs` and `tests/persist_write.rs`: **fifteen findings —
two critical, three high, two medium, one low, and six in a test audit.** **Every one is closed or
recorded before the commit**, so no commit holds a demonstrated defect. Section 11 of
`docs/decisions/2a-1-notes.md` is the finding-by-finding table; the summary is below.

**The two critical findings are one thing: the code promised a compare-and-swap it cannot perform.** The
mutex binds only this process, so an external writer can be lost between the hash and the rename. Fixed
by narrowing the window to one rename (`recheck_target()`, a new `TargetChangedDuringWrite` variant with
four arms) **and** by correcting every doc comment that claimed otherwise. **D4** records the decision.

**One reviewer premise was rebutted with evidence, not with an opinion.** The reviewer held that macOS
`sync_all()` is plain `fsync` and that `libc` was needed for `F_FULLFSYNC`. Reading the local `rust-src`
shows `std` already issues `fcntl(fd, F_FULLFSYNC)` on Apple targets. The wording was weakened anyway,
because `ENOTSUP` has no fallback and the directory sync measurably does not do the same work — so the
finding produced a better doc comment and **no new dependency**.

**Two findings were narrowed rather than implemented, both for the same reason.** Full metadata
preservation (ACLs, xattrs, ownership, BSD flags) and `F_FULLFSYNC` on the directory both need `libc`.
Each is renamed to what the code actually guarantees — **mode bits**, and fsync-grade durability for the
bytes with best-effort publication — and enumerated as a hole with an owner. The one consequence that is
not cosmetic is written down: **dropping a denying ACL broadens access.**

**Six of the fifteen were about the tests, and four of those were theatre.** The byte-exact fixture sweep
seeded each copy with the fixture's own bytes, so a no-op writer passed it. The concurrency test had each
writer replace the file, which passes with no mutex at all. The `chflags` test could print a skip and
pass. Two count claims said "three" above five-element lists. All fixed, each verified by a disabling
experiment that now fires. **This is the ninth consecutive sub-phase in which the review's most valuable
finding was a claim outrunning its evidence** — and the first in which most of them were in test bodies
rather than in prose.

**Two holes are stated in the reviewer's own words rather than presented as covered**: no test would fail
if either `sync_all` or the read-back verification were removed, and no test involves a second process.
One incidental narrowing was found while running the experiments — with the lock removed, the read-back
verification *does* fire — so that hole is smaller than stated, not absent.

---

## Verification — Phase 2a-3b

Every command below was run by the orchestrator **after** the confirmation fix round, each as its own
invocation, not taken on the worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo build --workspace` | ✅ clean |
| `cargo test --workspace` | ✅ **787 tests across 20 binaries**, 0 failed (**+51** on 2a-3a's 736: 34 for the first pass, 15 more in the review fix round, then 2 in the confirmation fix round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test persist_backup -- backing_up_the_real` | ✅ **not a vacuous skip** — 13 files copied into one batch, 0 with no editable scalar |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test persist_save -- saving_the_real_configuration` | ✅ 13 files, 65 matches, 13 committed, **0 refusals** |
| `npm test` | ✅ 27 files, 662 tests |
| `npm run check` | ✅ 374 files, 0 errors, 0 warnings |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**The first Codex review returned `not safe to commit as-is`** with eleven findings, and that verdict
is the reason this phase has a fix round at all. `docs/reviews/2a-3b-codex.md` is the review verbatim;
`docs/decisions/2a-3b-notes.md` §12 is the finding-by-finding disposition. Seven were fixed outright,
four partly fixed with the residue disposed against a named standing rule, and **two of them falsified
sentences the notes had already written** — §4's rotation ordering and §7's *"the attempt, and nothing
else"* — which were rewritten rather than annotated beside the old claim.

**Nine new disabling experiments (E30–E38) all fire**, and E25–E29b were re-measured after the fixes:
E28 dropped from 4 tests to 3 because the ownership marker is now a second defence behind the name
grammar, and E27 now requires both halves of the change to be reverted before it fires. Both sabotaged
files were restored `cmp`-identical.

**The confirmation round added three more (E39a–E39c), and all three fire.** E39a reproduces the
residue itself — `discard` recording nothing when its removal fails, and the retry then refused with
`DestinationExists`; E39b removes the other half, the publish's willingness to use the name it recorded;
E39c drops the guard entirely and fires on the case the fix deliberately does **not** widen, two targets
resolving to one backup path. `persist/backup.rs` was restored `cmp`-identical after each.

**The orchestrator spot-verified the three riskiest fixes directly in the source**, not on the worker's
report: rotation now runs *after* the copy is written and fsynced (`backup.rs` `capture`), the current
batch is excluded from rotation by its `(device, inode)` pair rather than by where its name sorts
(`rotate`'s property 4), and `remove_dir_all` is dominated by the `carries_batch_marker` check.

**The confirmation pass answered those same three questions independently**, and its answers are why
the phase closed here rather than after the first fix round:

| Question | Verdict |
|---|---|
| Can rotation remove a directory holding a copy the running session just took — under a backward clock, or with ten future-dated batches present? | **No.** The copy is published before rotation, and the current batch is excluded by path or `(device, inode)` regardless of timestamp ordering |
| Can the temp-then-publish and `discard` leave an orphan, or make a legitimate retry fail? | **Yes** — the one residue, now closed by `publish_backup`'s disambiguation |
| Does the ownership marker dominate every reachable `remove_dir_all`? | **Yes.** The sole reachable call consumes only `batches`, and an entry joins that collection only after `carries_batch_marker` succeeds |

**Its first attempt stalled and was cancelled**, with `updatedAt` frozen while the job kept reading —
it had been pointed at four files totalling some 5,600 lines. The relaunch named **exact line ranges**
and three questions, and returned in under two minutes. That is the operational lesson worth keeping:
a confirmation pass is a set of questions about named lines, not a second full review.

---

## Verification — Phase 2a-3a

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on the worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo build --workspace` | ✅ clean |
| `cargo test --workspace` | ✅ **736 tests across 19 binaries**, 0 failed (**+13** on 2a-2b's 723: 8 for the copy itself, then 5 more in the fix round — 4 unit tests on `verify_temp_identity` and the widening-window invariant) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way, with `libc` newly in the tree |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 cargo test -p espansoconfig-core --test persist_save -- saving_the_real_configuration` | ✅ **not a vacuous skip** — run with the switch that makes the corpus mandatory; 13 files, 65 matches, 0 refusals |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**Two macOS behaviours were measured by the orchestrator directly, not taken from either the worker or
the reviewer**, because the whole safety of the step ordering rests on them:

| Question | Command | Answer |
|---|---|---|
| Does `chmod` clear a macOS ACL? | `chmod +a "everyone deny write" f` · `ls -le f` · `chmod 0644 f` · `ls -le f` | **No** — `0: group:everyone deny write` survives. So copying the ACL and *then* applying the mode never discards it |
| Does writing data clear extended attributes? | `xattr -w com.apple.metadata:kMDItemFinderComment …` then a full overwrite, then `xattr -p` | **No** — the value reads back intact. So the reordered write-then-copy is safe in the other direction too |

**The disabling experiments were re-run and reported by the worker**, and are the evidence the tests
are load-bearing rather than decorative: removing the `copy_metadata` call fails **4** tests (3 in
`persist_write`, 1 in `persist_save`); restoring the *old* step ordering fires the new
widening-window test. `write.rs` was restored byte-identically after each, checked with `diff`.

---

## Verification — Phase 2a-2b

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on the worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **723 tests across 19 binaries**, 0 failed (**+45** on 2a-2a's 678: 29 integration in the new `persist_save.rs`, 16 unit across `persist/save.rs` and `persist/write.rs`) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 cargo test -p espansoconfig-core --test persist_save -- saving_the_real_configuration` | ✅ **not a vacuous skip** — run with the switch that makes the corpus mandatory |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**The real-corpus run, reported as counts only (D1).** 13 files, 65 matches walked; each file saved
**twice** — once with an empty batch, which exercises the lock, the read, the hash, the
reparse-verify, the projection, the semantic gate and the policy without changing a byte, and once
with a real scalar edit, which additionally exercises the commit. **13 files edited and committed, 0
saves refused by either gate.** Every committed file's bytes were checked by an independent rebuild
from the declared replacements rather than by trusting the candidate.

**`persist_write.rs` still passes 25/25 unchanged**, which is the check that mattered after this
sub-phase modified 2a-1's `inspect_target`. The `O_NONBLOCK` constant is hand-written per platform, so
the test that guards it — `the_non_blocking_flag_opens_a_fifo_without_waiting_for_a_writer` — pins its
**meaning** and not its number: a wrong constant fails rather than silently disabling the fix.

**Two verification facts that are not commands.** **No dependency was added**, in any section, by
either round — the fifo test shells out to `mkfifo(1)` and skips cleanly where it is absent. And
**eighteen disabling experiments** were run across the two rounds; every one fired a **named** test
except E7, which fired nothing and is the reason a test exists that did not before. Every sabotage was
reverted and the touched files diffed byte-identical against pre-experiment copies afterwards.

---

## Verification — Phase 2a-2a

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on the worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **678 tests across 18 binaries**, 0 failed (**+78** on 2a-1's 600: 70 integration in the new `validate_semantics.rs`, 8 unit in `validate/mod.rs`) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way, and re-checked because this sub-phase adds a dependency |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1) |

**The real-corpus run, reported as counts only (D1).** 13 files, 65 matches, 38 variables and **0
regex triggers** walked; **`EditorModelError` 0, `SuspiciousButPermitted` 0** — after the opener
narrowing, which is the direction that could have broken it. The walked-counts are asserted alongside
the zeros, so the zero cannot pass vacuously on an empty walk.

**Two verification facts that are not commands.** The `regex` crate is this crate's **first
production dependency since Phase 0a** — approved in advance against plan §6.6, which names it. And
**22 disabling experiments** were run across the two rounds (E12–E22 in the fix round alone); every
one fired a **named** test, and both source files were diffed byte-identical against pre-experiment
copies afterwards.

---

## Verification — Phase 2a-1

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on the worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo build --workspace` | ✅ clean |
| `cargo test --workspace` | ✅ **600 tests across 17 binaries**, 0 failed (**+41**: 25 integration in the new `persist_write.rs`, 14 unit in `write.rs`, and the pre-existing binaries unchanged) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `git diff --stat -- crates/espansoconfig-core/tests/corpus/` | ✅ **empty** — no fixture's bytes changed |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1) |

The frontend suite was **not** run and is unchanged: this sub-phase touches no file under `src/` or
`src-tauri/`, adds no user-facing string and no dictionary key.

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| Plan §6.6 steps 1, 2, 6–11 implemented, and no more | ✅ | `write.rs` is the only code in the crate that opens a file for writing. Steps 3–5 and 12–13 are absent by design and named in the module doc as 2a-2's and 2a-3's |
| A stale base revision refuses and leaves the file byte-identical | ✅ | `RevisionMismatch` carries both the expected and the found revision; pinned by test |
| A missing target refuses and creates nothing | ✅ | `TargetMissing`; the directory is enumerated afterwards and holds only what it held |
| The temp file cannot be matched by espanso's `[!_]*.yml` | ✅ | Asserted against the name `temp_file_name()` actually mints, not a hard-coded string. Two independent reasons: the leading `_` and the non-`.yml` suffix |
| No temp file survives success, refusal or an I/O error | ✅ | RAII guard disarmed only after a successful rename; a test unwinds the stack and checks. **Crash and abort are excluded and said to be** — a leftover is harmless *because of the name* |
| Mode bits are preserved | ✅ **renamed at the review** | The temp file is created `0o600` and widened, never briefly wider than the target. It is **mode bits**, not "permissions" — eight dropped metadata classes are enumerated |
| Symlink behaviour is decided, documented and pinned | ✅ | The target is `canonicalize`d before it is locked, hashed or written, so the real file receives the bytes and the symlink survives. A dangling symlink is `TargetMissing`. A retarget mid-call is refused by `recheck_target()` |
| Concurrent writers cannot lose an update | ✅ **after the review** | The original test would have passed with no mutex at all. `concurrent_read_modify_write_never_loses_an_update` has each writer append a unique line; it **fails with the lock removed** |
| A byte-exact fixture survives a round trip through the writer | ✅ **after the review** | The original sweep seeded each copy with the fixture's own bytes and a no-op writer passed it. Each copy is now seeded with a contradicting placeholder, and a companion test asserts both that the fixtures hold the hazards and that the placeholder contradicts them |
| No new production dependency | ✅ | `std` only; `O_NOFOLLOW` spelled out per target family with its **meaning** pinned by an `ELOOP` assertion |
| The primitive promises only what it can deliver | ✅ **after the review** | The "only if" claim was false against non-cooperating writers and is gone. D4 |
| Durability is not overclaimed | ✅ **after the review** | `std` does issue `F_FULLFSYNC` on Apple targets (verified in `rust-src`), so the bytes are power-cut durable — but `ENOTSUP` has no fallback and the **directory** sync is best effort, so the rename that publishes them is not |
| The residual external-writer race | ❌ **narrowed to one rename, not closed** | Unclosable without cooperating writers. D4, and 2a-3's backups plus 2d's watcher are its recovery path |
| `sync_all` and the read-back have a disabling experiment | ❌ **stated as a hole in the reviewer's terms** | No test would fail if either were removed; neither is reproducible from user space. One narrowing found: with the lock removed, the read-back verification *does* fire |
| A second process is exercised | ❌ **no test involves one** | Every test is in-process. The class of defect D4 describes is therefore reasoned about, not measured |

