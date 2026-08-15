READINESS: NOT READY

### Instrument defects

None.

### Prose defects

1. Low — `docs/decisions/2c-5-5a-instrument-rebuild.md:1685-1686,1741-1746,1837-1839,1869-1874`, **Claimed:** `phase-2c-5-5a-instrument-round5.md` is round 6, and §13.4 describes what "round 6" says the "round-5 fixes" created. **Actually true:** the established mapping is initial review → round 1, `-round2.md` → round 2, through `-round5.md` → round 5. This confirmation is round 6. Consequently, §13 records the round-5 review of the round-4 fixes. §13.4 is additionally self-contradictory: it cites the round-5 review file while assigning its findings to the round-5 fixes. **Minimal fix:** change the affected "round 6" references to "round 5"; make §13's heading "Disposition of the three round-5 review findings"; and make §13.4 "What round 5 says the round-4 fixes created." This includes the references in §§12.2 and 12.5.

2. Low — `docs/decisions/2c-5-5a-instrument-rebuild.md:3-20,1120-1128`, **Claimed:** the record was revised four times by four fix rounds, §12 is the latest disposition, and every sentence made false by a fix was rewritten. **Actually true:** §13 is the fifth disposition and its addition made both the four-revision count and "§12 is the latest" stale. That directly falsifies the preamble's exhaustiveness claim. **Minimal fix:** update the preamble to five revisions/fix rounds, add the round-5 review and §13 to its ledger, and change the "latest" reference at line 1128 from §12 to §13.

3. Low — `docs/decisions/2c-5-5a-instrument-rebuild.md:1848`, **Claimed:** "Three wordings changed, in two files." **Actually true:** three findings were addressed, but more than three wording sites changed: `src/probe.ts`, §§11.6 and 12.2, the §7 and §10 terminology references, §12.5, and the new §13 prose. **Minimal fix:** say "Three findings were addressed through comments and prose in two files."

The substantive §13 claims otherwise hold. §13.5 still leaves all four pathname rebindings open and disclosed, calls them accepted rather than proven, and explicitly says acceptance is not proof of impossibility. §13.4's trend statement does not claim monotonically decreasing counts: it gives the actual 8 → 4 → 5 → 6 → 3 sequence, while the stated High → Medium → Low severity-ceiling trend is supported.

### Round-5 finding status

1. CLOSED — `src/probe.ts:483-498` accurately separates inert geometry reads from the later assignment. The write-back can attempt to overwrite an intervening position, but guarantees neither movement, preservation, nor restoration; clamping permits unchanged, moved, or neither-value outcomes.

2. CLOSED — §§11.6 and 12.2 now use the same non-categorical contract, and §12.2 expressly records clamping and all three possible outcomes.

3. CLOSED — §7 now says "nineteen-launch complete proof set," §10 says "twelve plan-proof launches," and §12.5 retracts rather than repeats its false "used everywhere" claim.

### Did the fix round create anything?

Yes. It created:

- the round-5/round-6 identity error and §13.4's incorrect fix lineage;
- stale four-round/latest-§12 metadata, which also falsifies the record's "every sentence … has been rewritten" claim;
- the unsupported exact count "Three wordings changed."

I swept:

- the `reportReach` read/await/write sequence and every possible clamped `scrollTop` outcome;
- the corresponding claims in §§11.6, 12.2, and 13.1–13.2;
- every defined proof-set term and the cited §7, §10, §12.5, and §13 references;
- asserted `all`, `every`, `everywhere`, `exactly`, `the only`, and `no other/no fifth` shapes across the decision record and both probe sources;
- all four pathname check-and-spend classes and their open/accepted/unproven disclosures;
- the review-file-to-round mapping, disposition headings, fix lineage, revision count, and "latest section" claims;
- §13.4's finding-count and severity-ceiling trend.

---

**Capture note.** This round's Codex job ran in a read-only workspace and could not write this file; the
orchestrator captured its final message verbatim to this path. The text above the rule is the review as
returned, unedited. Rounds 1–5 are `phase-2c-5-5a-instrument.md`, `-round2.md`, `-round3.md`,
`-round4.md` and `-round5.md`.
