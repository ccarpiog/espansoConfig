### Q1 — Substitute safety gate

**RULING: Require both successful parsing and the existing validation/acknowledgement gate.**

The replacement text must parse, then its validation findings must be empty or acknowledged as the exact multiset. This preserves the transaction’s semantic safety but not the patch engine’s locality proof. Raw mode loses the ability to claim that only a particular byte span changed, and it cannot save parser-rejected drafts.

### Q2 — Parser-rejected text

**RULING: Do not write text the YAML parser rejects.**

Treat this as a planning-time typed `CommandError`, such as object-shaped `InvalidYaml { path, diagnostics }`, not an acknowledgeable `Finding`. An acknowledgement must never override it. A broken existing file remains repairable: the raw editor can load its UTF-8 text and replace it with a candidate that parses. What is lost is incremental saving while the repair remains syntactically incomplete.

### Q3 — Identities and `moved`

**RULING: Keep `SaveResult`; return `moved: None`.**

A committed raw save has no distinguished match, so `None` is semantically correct. The frontend must invalidate all cached projections and identities and reload the document after `committed: true`. On `committed: false`, no identity becomes stale. Raw saves should normally return no presentation notes because the application must write the submitted text without restyling it.

### Q4 — Where whole text enters

**RULING: Use one core `save_document(SaveRequest)` entry point, branching internally.**

Add something like `SaveRequest::ReplaceText { text, revision, acknowledgement }` beside the edit-batch variant. After acquiring the one lock and rechecking the revision, the edit branch derives candidate bytes through the patch engine; the raw branch uses the supplied UTF-8 bytes directly. Both then share parsing, validation, acknowledgement, backup, and atomic-commit machinery. Do not expose a second public writing entry point, and never nest either path through another lock-taking function.

### Q5 — Acknowledgements

**RULING: Raw saves fully participate in acknowledgement for validation findings.**

Consent is still meaningful because it applies to the consequences computed from one exact candidate text, not to who produced that text. Changing the text requires recomputing findings and matching a new exact multiset. Syntax rejection remains non-acknowledgeable; semantic or operational findings retain the existing protocol.

### Q6 — Backups and revision

**RULING: No backup for a byte-identical result; every committed raw replacement must have a recoverable pre-commit image. The revision check is more load-bearing here.**

Prefer a versioned preimage for each raw commit. If the backup system supports only one session snapshot, preserve that snapshot rather than overwriting it, but do not commit without recoverability. Backup failure must occur before writing. The raw request must carry the revision from which its editor text was loaded, and the transaction must reject any mismatch without a force or acknowledgement escape hatch.

### Q7 — Highest-risk mistake and test

**RULING: The highest risk is silently overwriting changes made after the raw editor loaded the file.**

Test: `stale_raw_save_never_overwrites_newer_bytes`. Load revision A and text A, externally replace the file with byte-distinct text B, then attempt to save candidate C using revision A. With a bounded timeout, assert that the operation reports the existing concurrency conflict, B remains byte-identical, and no commit is reported. The timeout also exposes accidental reentrant-lock deadlocks.

### Q8 — Product guarantee

**RULING: Raw save is a separate replacement mode with a different promise, not a locality-preserving edit.**

Calling the whole file the “edited span” would make the original guarantee vacuous, so the UI must state plainly that raw save replaces the entire document. It owes the user a visible diff or replacement warning, stale-revision protection, validation, and recovery backup. Its narrower guarantee is: the exact submitted UTF-8 bytes are committed without parser formatting, newline normalization, or any other application-authored transformation.

### What I would build first

1. Add the core `SaveRequest::ReplaceText` branch inside the single transaction.
2. Add parse preflight, shared validation/acknowledgement, revision, no-op, and backup behavior.
3. Write the stale-revision test first, then invalid-YAML and byte-identical-save tests.
4. Expose `save_raw_document`.
5. Add the raw-mode boundary warning/diff and mandatory reload after a committed save.

Codex session ID: 019fc31e-b172-7de2-be42-d211f6b396e2
Resume in Codex: codex resume 019fc31e-b172-7de2-be42-d211f6b396e2

---

# Owner's ruling — Q2 is OVERRIDDEN

**This section overrides the consult above. Anyone building Phase 2b-2c-3 follows this, not Q2.**

The consult ruled *"Do not write text the YAML parser rejects."* The question was put to the owner
before any line was written, with the tradeoff stated: refusing means **this application cannot be
used to repair a file that is already broken**, which is arguably the single most valuable thing a
raw editor does — and the app already *displays* unparseable files, since a broken file crosses as a
view and never as an error.

**The owner's ruling: do not refuse to write it.** A raw save may write text the YAML parser rejects.

## What this changes, and what it does not

- **Q2 is reversed.** An unparseable candidate is not a refusal. `save_raw_document` writes it.
- **Q1 is narrowed by consequence.** The consult's substitute gate was "a successful reparse **and**
  the validation verdict". The reparse can no longer be a *gate*, because failing it is no longer
  disqualifying. It remains a **fact to be established and reported** — the transaction must still
  attempt the parse, because the answer is what the user is told and what the workspace cache must
  do next.
- **Q5 is unchanged and now carries the weight.** A raw save still participates fully in the
  acknowledgement protocol. **This is the mechanism that makes the owner's ruling safe**: the
  application does not refuse, and it does not write silently either — it reports that the text does
  not parse, and the user confirms by content, exactly as for any other finding. "Refused, not
  forced" was never "refused, full stop"; it is "never written without the user meaning it".
- **Everything else stands.** One `save_document` entry point branching internally (Q4 — the lock is
  not reentrant), `moved: None` (Q3), the backup and revision rules (Q6), the stale-revision test as
  the highest risk (Q7), and Q8's framing that a raw save is a **separate replacement mode with a
  different promise** rather than a locality-preserving edit.

## The one sub-decision this leaves, and the assumption taken

Writing unparseable text could be **silent** or **acknowledgeable**. Nothing in the owner's ruling
settles it, and the assumption taken is **acknowledgeable**, for a reason the project has already
committed to elsewhere: plan §6.2 forbids this application making an unrequested change silently,
`SaveResult::Refused` plus `Acknowledgement` is the machinery that exists for "this is risky, confirm
by content", and Phase 2b-2c-2 has just finished paying to disclose a doubled blank line — a far
smaller surprise than a file espanso will refuse to load.

**A phase that finds this assumption wrong should put it back to the owner rather than quietly
choosing the other reading.** The ruling above is theirs; this sub-decision is an inference from it.

## What the UI then owes the user

Not a blocked save. A sentence saying the file will not load in espanso until it is fixed, the
parser's own position if it has one, and the choice — in both languages, through i18n, like every
other user-facing string in this project.
