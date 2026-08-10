# Phase 2c-4b step 3c-2 — Codex review of the window reading, round 1

Job `task-msmuwv1e-sem61z`, Codex thread `019fea61-a02d-7c92-bab3-b337cc39b8d4`, run read-only
(`write: false`) against the working tree at the 3c-2 reading. Verdict: **NOT READY** — five High,
one Medium, three Lows. The full reply follows verbatim.

---

- **High** — [docs/decisions/2c-4b-3c-2-window-reading.md:637](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:637), repeated at lines 737–758 and 886. The record calls `browser.notice.differentMatch` “true of its predicate,” but `reresolve` only proves that the source bytes at the retained index differ. It explicitly produces `differentMatch` when the same snippet was externally edited. The record should call the sentence false, not merely misleading, and recommend wording such as: “what is now in that position no longer exactly matches the snippet you selected.” §11.3 should be High, not Low.

- **High** — [docs/decisions/2c-4b-3c-2-window-reading.md:385](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:385), especially lines 397–399 and verdict line 883. `fieldReapply` returns `collision` when a drafted field becomes ineligible, even if its value did not change. Therefore “The version on disk has changed fields…” claims more than the predicate guarantees. It should say that fields the user changed “no longer have the same editable state” or “cannot be applied safely.” The unobserved arm does not make the universal “true” verdict valid.

- **High** — [docs/decisions/2c-4b-3c-2-window-reading.md:802](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:802). §12 says it carries forward every still-open limitation, but drops the inherited 3b §8.9 limitation explicitly retained by 3c-1 §7: `--- end` is printed unconditionally, is only a wrapper signal, and says nothing about activity after the driver’s last line. Add that limitation explicitly, including both parts.

- **High** — [docs/decisions/2c-4b-3c-2-window-reading.md:549](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:549), repeated at lines 887 and 894–896. The ledger supports **21 launches ending with authored output and 50 ending at R1**, not 28 and 43. L40–L80 contribute 19 writes; only L83–L84 add two afterward. Either correct the totals to 21/50 or correct the ledger from retained evidence. Related counts also drift: the §10 table at lines 626–633 contains 18 positive launches/nine language pairs, not “sixteen” and “ten pairs”; after adding the new end case, §9 has 12 shorter-surface positives, not ten.

- **High** — [docs/decisions/2c-4b-3c-2-window-reading.md:894](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:894), also lines 28–30 and 452–453. “Every conflicted save wrote nothing” and “the write happens only on the next press” exceed an instrument with no invoke spy or command counter; §8 itself admits identical or transient writes are indistinguishable. Replace these with final-state claims: the launch ended at R1/expected bytes, with the stated backup result. Temporal or command claims must be attributed to static source inspection, not the probe.

- **Medium** — [docs/decisions/2c-4b-3c-2-window-reading.md:374](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:374). `src/lib/browser/reapply.ts:228-239` is only the `manualResolution` type arm and comments; it does not show that the arm “calls no command.” Cite the early-return paths in each of the five surface transitions, plus their component handlers, or narrow the statement to what the cited type promises.

- **Low** — [docs/decisions/2c-4b-3c-2-window-reading.md:692](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:692). DOM placement before a revealed panel does not make the report offscreen “by construction”; that also depends on WebKit scroll anchoring or the reveal effect rerunning—mechanisms §9 correctly says are indistinguishable. Say that it was offscreen in every measured launch and that the code provides no reveal cue for it.

- **Low** — [docs/decisions/2c-4b-3c-2-window-reading.md:327](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:327). “Document order is the tab order” overstates a run in which no `Tab` key was sent. Say the DOM order and `tabIndex` values are consistent with the expected tab order; real traversal remains untested.

- **Low** — [docs/decisions/2c-4b-3c-2-window-reading.md:769](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:769). §11.4 explicitly requests no behavioral change and records a constraint on another fix. That is an observation/acceptance constraint, not a Low defect. Reclassify it, leaving one Medium, two genuine Lows before correcting §11.3’s severity.

The other load-bearing references are exact: `outcomeReveal`, `revealOutcome`, `reresolve`, `matchFingerprint`, all five component panel lines, and the cited i18n lines. The other four refusal sentences and both shared obstacle lines match their predicates. The negative-`y` issue is correctly split into two distinct concerns, and §11.1’s Medium severity is reasonable. The five deviations are sound.

---

# Round 2 — the confirmation pass over round 1's fixes

Job `task-msmvxftk-5wlrjo`, Codex thread `019fea7b-a882-7a31-81da-077537368dae`, read-only. Scoped to
whether round 1's nine findings closed without introducing a narrower instance, whether the recount is
right against the retained launch evidence, and whether the §11.5 Medium-rather-than-High rebuttal
holds. Verdict: **NOT READY** — one High and two Lows, the High being a **false new finding** the fix
round's own sweep produced. The full reply follows verbatim.

---

NOT READY

- **High** — [2c-4b-3c-2-window-reading.md:855](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:855). `displacedByMove` and `displacedByDuplicate` do not carry unsupported identity claims. Their attribution is used only when the reread matches the committed operation’s revision; move preserves existing snippets while reordering them, and duplicate inserts a byte-exact copy. A fingerprint mismatch at the old position therefore does identify another snippet. Retract these two alleged instances; retain `differentMatch` and the genuinely unsupported `gone`, with separate predicates and wording.

- **Low** — [2c-4b-3c-2-window-reading.md:421](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:421). The five handlers are not “two model calls and two assignments each”: the deleter has a third assignment, while mover and duplicator call an additional draft getter. Say only that the handlers synchronously call model/local helpers, assign component state, and invoke no IPC command.

- **Low** — [2c-4b-3c-2-window-reading.md:430](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:430), repeated at [line 926](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-2-window-reading.md:926). Absence of a selection notice does not corroborate absence of adoption: the record itself identifies two successful creator adoptions with no selection and therefore no notice. Limit the corroboration to launches that held a selection, or remove it.

- **Clean** — The recount is correct (21 authored/50 R1; 42 `manualResolution`; 21 notices split 11/10; nine editor adoptions; 12 shorter-surface adoptions; seven whole-word *usted* lines), §12 drops nothing from 3c-1 §7, and the §11.5 **Medium** rebuttal holds: the refusal and no-write outcome are correct; only its reason is false and misdirecting.

---

# Round 3 — the scoped confirmation over round 2's fixes

Job `task-msmvxftk-5wlrjo`'s successor, read-only, scoped to round 2's three fixes and what they
touched. Everything rounds 1 and 2 ruled clean was declared out of scope. Verdict: **NOT READY on one
Low**, everything else clean. The full reply follows verbatim.

---

NOT READY

Low — `docs/decisions/2c-4b-3c-2-window-reading.md:740-742, 869-877, 1186` — The retraction incorrectly grounds both attributed notices in `adoptTheDocumentOnDisk:2750-2752`; committed duplicates use `adoptAfterTheDuplicate`, whose equivalent revision guard is `workspace.svelte.ts:2891-2893` and whose clone-follow early return is `:2882-2887`. Name both paths and reserve `:2741-2746` for moves.

CLEAN — Retraction scope and predicates: `differentMatch` is correctly bounded to byte inequality, while `gone` is consistently described as length-based, source-derived, and never drawn (`§11.3`, `§12.16`, `§16.1`).

CLEAN — No surviving count, verdict, tally, or summary treats the retracted pair as findings; §14 and §16 consistently retain one High over two strings.

CLEAN — Handler fix is accurate at `§5.1`: all five cited handlers synchronously call model/local helpers, assign state, and directly invoke no IPC command; the documented deleter and mover/duplicator differences are correct.

CLEAN — Corroboration fix agrees between `§5.1` and `§11.7`; the ledger supports 34 selected refusals—editor 12, mover 10, deleter 6, duplicator 6—and excludes the creator's 8.

CLEAN — Section 12 contains 21 items, and every surviving `§12.x` cross-reference resolves to the named limitation after renumbering.

---

## Disposition of round 3's Low — closed by the orchestrator, not by a worker

The finding is a citation correction with no judgement in it, so it was applied directly rather than
dispatched. `src/lib/browser/workspace.svelte.ts` was read at both sites first and Codex is exactly
right: `adoptAfterTheDuplicate` carries **its own** revision guard at `:2891-2893` and **its own**
clone-follow early return at `:2882-2887`, structurally identical to the move's at `:2750-2752` and
`:2741-2746` but a separate pair of lines. The record's three sites — §10's attribution paragraph,
§11.3's retraction argument and §16's round table — now name both paths and reserve `:2741-2746` for
the move. **The retraction's conclusion is unchanged and was never at risk**: it rested on there being
a revision guard on each attributed path, and there are two, one per path. What was wrong was citing
one line range for both.
