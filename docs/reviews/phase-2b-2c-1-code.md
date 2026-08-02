# Phase 2b-2c-1 — aggregate code review

**Reviewer:** Codex (`codex:codex-rescue`), 2026-08-02, reading the repository, over the whole
uncommitted working tree before the phase was committed.
**Under review:** `InsertItem` and `RemoveItem` in `crates/espansoconfig-core/src/patch/edit.rs`, the
new `crates/espansoconfig-core/tests/patch_item.rs`, the five wire and i18n files the new refusals
forced, and `docs/decisions/2b-2c-1-notes.md`.

The brief named six priorities and told the reviewer to verify the implementer's five reported
deviations rather than trust them, with an explicit instruction to re-derive the two highest-risk
claims itself: that the CRLF fix leaves every pinned tally unchanged, and that the
`RemoveItem` == `ItemMove`-lift test compares bytes rather than a proxy.

---

## The reply, verbatim

### 1. Byte-preservation defects

No findings in category 1.

### 2. `ItemMove` regression surface

No findings in category 2. `RemoveItem` and `ItemMove` genuinely share `editable_sequence_item()`, `lift_item()`, and the source-close block-scalar check. The CRLF helper is shared by both ownership paths, and the existing pinned move/structure tallies remain unchanged.

### 3. Tests that cannot fail

No findings in category 3. The comparison in [patch_item.rs:302](../../crates/espansoconfig-core/tests/patch_item.rs) compares both the actual departure replacement spans and the actual output bytes after discarding the move's landing replacement; it is not a success-only or derived-summary proxy.

### 4. Refusals

No findings in category 4. The eight refusals occur during planning, before splicing. `InconsistentSequenceIndentation` is defensively unreachable as reported. The blank-line behavior and lack of insertion-before-first support are also accurately documented.

### 5. Wire additions

No findings in category 5. All eight new `EditError` variants are struct variants, their TypeScript operands agree with Rust, and the contract samples/counts cover them. The five reported `src/` and `src-tauri/` changes are justified by the existing wire and localization contracts. No Tauri dependency or command was added to the core.

### 6. Notes document

- **Low — the claimed corpus gap is overstated.** `docs/decisions/2b-2c-1-notes.md:214`,
  `crates/espansoconfig-core/tests/corpus/synthetic/crlf-line-endings.yml:1`,
  `crlf-line-endings.yml:3`

  Concrete scenario: the CRLF fixture has a contiguous comment block immediately above its root mapping entry, so the statement that it has "no entry or item with a leading comment block" is false. The unchanged tally is nevertheless real because removing that root entry is refused earlier as the mapping's last entry, so `entry_owned_runs()` never evaluates this shape; its sequence items have no such leading block. The real corpus currently has zero CRLF files.

  Suggested fix: narrow the note to say that no attempted corpus removal or move reaches the corrected CRLF ownership walk—specifically, the synthetic CRLF fixture's only leading-comment entry is rejected before envelope derivation, and none of its movable sequence items has a leading comment block.

---

## Disposition

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | Low | §5 of the notes claimed `crlf-line-endings.yml` has *no* entry or item with a leading comment block. It does — a two-line block at column zero immediately above `matches:`, the root mapping's only entry | **Fixed.** Verified independently before fixing: `rg -n '#' crlf-line-endings.yml` returns exactly lines 1–2, and `rg -n '^[a-zA-Z]'` returns exactly `3:matches:`, so the entry carrying that block is the mapping's only one and is refused before any envelope is derived. §5 now states the narrower true claim — *no attempted corpus removal or move reaches the corrected walk* — names the fixture's comment block explicitly rather than denying it, and records that the real corpus has zero CRLF files. The closing sentence no longer says "the shape no fixture had" but "shapes no corpus sweep attempts" |

**Nothing was found in categories 1 through 5** — byte preservation, the `ItemMove` regression
surface, vacuous tests, the refusals, and the wire additions. Each was reported as an explicit
"no findings", not left silent, and the two claims the brief singled out for independent re-derivation
were both confirmed by the reviewer's own reading rather than accepted from the implementer.
