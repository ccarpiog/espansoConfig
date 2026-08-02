## 1. Correctness of the two commands

No finding.

`create_match` takes `DocumentId`, closed `NewMatch`, identity-based `NewMatchPosition`, revision, and acknowledgement. `delete_match` takes `MatchId`, revision, and acknowledgement. Both:

- Check the cached projection’s revision before resolving positional data.
- Resolve anchors/targets through `MatchId`.
- Construct exactly one primitive.
- Delegate the authoritative planning and write to `save_document`.
- Return semantic refusals through `SaveResult::Refused`.
- Re-mint the created identity only after refreshing the committed revision.
- Return successful `moved: None` if post-save re-resolution fails; deletion routinely returns `None`.

Relevant implementation: [commands.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:840), [commands.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:933), [commands.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:1063).

## 2. Invariants

No finding.

I found no command-layer call to either low-level replacement function, no force flag, no finding cache, and no acknowledgement bypass. Both new paths pass the caller’s acknowledgement directly into `SaveRequest`. Transactional patch failures remain nested `SaveFailed` errors, while semantic findings remain acknowledgeable value-channel refusals.

R25 is preserved: each new batch contains exactly one edit. Stale identities are rejected before their paths are used. D2 is centralized in `after_a_save`, whose return type prevents post-commit refresh failure from becoming an `Err`.

The core changes contain no `tauri` dependency; the only core occurrence found was documentation referring to the Tauri result type.

## 3. Core change

Low — [edit.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:4251), [patch_item.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_item.rs:449): `ItemPlacement::After(0)` is accepted when the target is a bare implicit-null `matches:` value.

That contradicts `After(usize)`’s contract: it means “after the item at this index in the original sequence,” but an implicit-null value has zero items. The new test explicitly codifies all three placements as equivalent, including the nonexistent anchor.

Smallest correct fix: during the implicit-null branch, accept `Front` and `End`, but return `NoSuchDestinationItem { items: 0, … }` for every `After(_)`; change the test accordingly. This is Low because `create_match` cannot produce this state—an `After` position requires a resolvable anchor—but the public core API currently accepts an invalid coordinate.

Otherwise, the front insertion is sound: it calls the same `removal_span(...).start` derivation used by `plan_move`, and the offset-equivalence test verifies that relationship. All pre-existing `insert_item(..., None, ...)` call sites became `ItemPlacement::End`; none silently became `Front`. Previous `Some(k)` calls became `After(k)`.

## 4. Test quality

No additional finding.

The removal suite asserts complete expected documents and independently reconstructs candidates from original bytes plus declared replacements. Command-level creation and deletion tests also compare the complete resulting file, so they do test surrounding bytes rather than only the new or removed snippet.

The object-shape contract test is supported by declaration-derived checks over all 36 `EditError` and nine `SaveError` variants, plus an actual nested serialization.

The single most valuable missing test is:

`deletion_that_creates_doubled_separation_returns_a_layout_presentation_note`

It should assert both the byte-exact doubled gap and the note crossing in `SaveResult::Saved`. The current blank-line test ignores the returned result entirely, so it provides no presentation guarantee.

## 5. Hole 5 deferral

Medium — [edit.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:4089), [commands.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:3440).

The implementer’s diagnosis is sound: the existing `PresentationNote` is specifically a scalar-style transition, and inventing fake `from`/`to` styles would be dishonest. Preserving both blank lines is also the correct byte-fidelity behavior; collapsing either would delete user-owned trivia outside the item.

The deferral is nevertheless not safe against this phase’s own ruling. `plan_item_removal` always emits `note: None`, and the command test merely pins the silent outcome. A backend test cannot make the UI “not surprised.” The user receives no indication of the secondary layout consequence explicitly required by Q6.

Smallest correct fix: generalize the successful-save note model into a tagged note union with the existing scalar-restyling form and a layout form such as `DoubledSequenceSeparation { edit }`. Detect it in `plan_item_removal`, carry it through `PatchedDocument` and `SaveResult`, and add the TypeScript union, English/Spanish sentences, accessor, and wire-contract tests. Do not collapse either blank line.

This is Medium rather than High because no surviving byte is corrupted or reformatted; the defect is missing required disclosure.

## 6. i18n and wire contracts

No finding for the delivered surface.

`DocumentHasNoMatchList` has:

- A struct-shaped Rust variant and serialized operand.
- English and Spanish messages, each containing two sentences.
- TypeScript error-union membership.
- Operand-table membership.
- Rust and frontend contract samples.

`NewMatchPosition` uses object-shaped struct variants for all arms. No new user-facing hardcoded string was introduced, and the synthetic tests do not expose the owner’s configuration.

I did not independently rerun the reported test and lint totals under the read-only constraint; those counts remain implementer-reported, although the claimed new contract tests are present.

**READINESS: NOT READY for Phase 2b-2c-3 — implement the required Hole 5 note first; also correct the invalid `After(_)` implicit-null behavior.**

Codex session ID: 019fc2eb-a6ab-7fc0-8dfb-4a7fea225179
Resume in Codex: codex resume 019fc2eb-a6ab-7fc0-8dfb-4a7fea225179
