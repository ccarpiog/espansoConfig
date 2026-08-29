# Dispatching a Codex review round, and collecting it

_Live operational procedure, measured across thirteen review rounds of phases 2d-4a and 2d-4a-C.
Moved out of `PROGRESS.md` to keep the checkpoint under its 400-line budget; it is **not** archive
material and it is not history. Every review round of this project should read it before dispatching._

Codex runs **read-only** and writes no file, so the brief must say the workspace may be read-only, that
**its final message IS the deliverable**, that the caller captures it, and that a sandbox limit **must
not affect the verdict**. Dispatch with the companion CLI directly rather than through the subagent, so
the verbatim reply is capturable:

```sh
CC=$(ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | head -1)
node "$CC" task --background --effort high "$(cat brief.txt)" --json    # returns jobId and logFile
node "$CC" result <job-id>                                              # after a TERMINAL status
```

- **The status is at `.job.status`.** `node "$CC" status <job-id> --json` answers
  `{workspaceRoot, job}`; search `.job.status` first, because the `running` / `recent` /
  `latestFinished` pools are for `status --all`. Round 6 lost two nine-minute windows to a poller that
  looked elsewhere. `status` echoes the entire prompt back — filter its output rather than reading it
  whole.
- **`~/.claude/scripts/codex-wait.sh` false-stalls on healthy jobs** — its `updatedAt` never advances.
  Use the **log file's mtime** as the stall signal, with a hard deadline as well. Round 8 was collected
  by a single bounded foreground wait doing exactly that, in 543 s. A working replica of that wait is
  reproduced in `docs/decisions/2d-4a-notes.md` §17 — a `zsh` loop polling `.job.status`, stalling on
  the log's mtime, exiting 0/2/3.
- **A dead watchdog is not a dead job**, proved twice and differently in rounds 5 and 6. Check the job
  before concluding anything, and **never re-dispatch the review** — one review per round, however many
  waits it takes to collect.
- **A `failed` job whose log ends in a usage-limit notice is not a review, and not a reason to skip
  one** — take the Opus fallback, and do **not** report `QUOTA`. Round 7 is the worked example.
- Durations at high effort so far: 141 s to ~13 min; the Opus fallback took 9 min for round 7 and
  under 4 min for the narrowly scoped round 8.
- **Only two edits to the reply are permitted**: demoting its internal `##` headings to `###` so the
  review file stays one `##` per round, and dropping the Codex session-ID trailer. Ask for `###` in the
  brief and the first is usually unnecessary.
- **Do not copy a reviewer's file/line attribution or count into the record without deriving it
  yourself**, and when yours disagrees, record yours and say so. Rounds 5, 6 and 7 each supplied an
  instance of a reviewer's count being wrong; the round-7 fix caught five of its reviewer's
  attributions and the round-8 fix caught three of the round-7 fix's own counts.
- **A round that cannot run a gate must not report one.** Do not let the fix worker run Cargo at all;
  run the gates once, alone, afterwards, and record any cell the round could not measure as pending.
  Both fix workers today were forbidden Cargo and both complied; §16.3 was written all-`pending` and
  filled by the orchestrator.

---

## When Codex is unavailable

`~/.claude/scripts/goahead-base.md` governs: a Codex usage limit is **one bounded attempt spent**, it
is never relaunched inside a phase, and it is **not** a `QUOTA` status — it is another provider's
window closing and it stops no Claude work. The review still happens: a fresh cold
`general-purpose` agent on `model: "opus"`, with no share in the code, reviews in Codex's place and
writes its own report file whose **first line names the reviewer**, so the record can never imply
Codex reviewed something it did not. Round 7 of 2d-4a on 2026-08-29 is the worked example, and round
8 is the example of that fallback being scoped narrowly enough to return in under four minutes.
