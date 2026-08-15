READINESS: NOT READY

### Instrument defects

None.

### Prose defects

1. Low — `docs/decisions/2c-5-5a-instrument-rebuild.md:24-27,1939-1948`, **Claimed:** the replacement preamble is no longer exhaustive because "each fix round rewrote the sentences its own fixes made false," followed by "that is a sweep, not a guarantee." **Actually true:** the first clause remains an exhaustive claim and is disproved by its own cited example: adding §13 made the preamble's four-round count false, yet that fix round did not rewrite it. The disclaimer does not narrow the categorical claim before it. **Minimal fix:** say each fix round rewrote the sentences it *identified* as false, or attempted to do so, and that the following review swept for misses.

2. Low — `docs/decisions/2c-5-5a-instrument-rebuild.md:13-16,1955-1968,1990-2011`, **Claimed:** all three round-6 findings were the record having gone stale against its newest section, and "a seventh round is owed on exactly these three fixes." **Actually true:** only finding 2 was the stale-on-append mechanism. Finding 1 was an off-by-one identity/lineage error and finding 3 was an unsupported exact count. More directly, §14.4 says five sites were fixed and §14.7 says the seventh round is owed on the two extras as much as on the cited three, contradicting "exactly these three fixes." **Minimal fix:** describe the three distinct defect shapes accurately and say the seventh round is owed on all five changes—the three cited fixes and two extras.

3. Low — `docs/decisions/2c-5-5a-instrument-rebuild.md:43-50,1810-1816`, **Claimed:** every fix round re-runs `cargo build -p espansoconfig --features custom-protocol`. **Actually true:** §13.6 enumerates round 5's subset without that command, and §14.6 expressly says it was not run in round 6. The claim became stale after round 4 and remains in two places. **Minimal fix:** bind the statement to the first four fix rounds or simply say the round-4 run rewrote the working binary path.

### Round-6 finding status

1. CLOSED — §§9–§14 now map correctly to rounds 1–6: the initial review is round 1 and `-roundN.md` is round N. §13, §13.4 and the affected references inside §12 correctly say round 5 and round-4 fixes; no reverse off-by-one was introduced.

2. PARTIALLY CLOSED — the six-round ledger and latest-§14 reference are correct, and the two §7 stale counts were repaired, but the replacement preamble still makes an exhaustive "each fix round rewrote" claim that its own example disproves.

3. CLOSED — §13 now counts three findings, says the changes were in two files, and enumerates the multiple changed sites rather than claiming exactly three wordings.

§14.7 extra 1: CLOSED — §7 accurately distinguishes the first five full-table readings from the round-5 and round-6 subsets. Round 5 re-ran the four numbered gate rows plus formatting and linting; round 6 re-ran those six plus the bundle oracle and omitted the custom-protocol Cargo build. "No reading … moved a figure" is narrowly about readings actually taken and is supported.

§14.7 extra 2: CLOSED — the initial reading plus six fix-round `npm run build` readings gives seven, all at 185 modules. The two extras share §14.2's stale-on-later-append mechanism, although they remain separate changed sites requiring confirmation.

The four-residual-rebinding disclosure remains intact and honest in §8.1, §13.5 and §14.5: all four remain open and disclosed, accepted rather than proven, with acceptance explicitly not proof of impossibility. The probe module note says the same.

### Did the fix round create anything?

Yes. It created:

- a replacement "not a guarantee" paragraph whose first clause still functions as an exhaustiveness guarantee;
- an inaccurate characterization of all three round-6 defects as staleness;
- "exactly these three fixes," contradicting §14's own five-change account;
- two surviving "every fix round re-runs" claims contradicted by the enumerated round-5 and round-6 subsets.

I swept:

- every review-file/round reference and fix-lineage reference throughout §§9–§14;
- the preamble ledger, revision count, latest-section claim and replacement disclaimer;
- all of new §§14.1–14.7;
- §7's seven rows, per-round subsets, seven-reading arithmetic, module count and bundle-oracle claims;
- `all`, `every`, `everywhere`, `exactly`, `only`, `no fifth`, `always`, `never`, bare round/reading counts and equivalent categorical shapes across the entire record and both probe sources;
- the claims that round 6 found no instrument defect, cited three findings, and that five sites were fixed;
- all four residual check-and-spend/rebinding classes and their open, disclosed, accepted-not-proven status.

No additional instrument defect was found in either probe source.

---

**Capture note.** This round's Codex job ran in a read-only workspace and could not write this file; the
orchestrator captured its final message verbatim to this path. The text above the rule is the review as
returned, unedited. Rounds 1–6 are `phase-2c-5-5a-instrument.md`, `-round2.md`, `-round3.md`,
`-round4.md`, `-round5.md` and `-round6.md`.
