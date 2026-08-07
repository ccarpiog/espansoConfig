NOT READY

## Findings

### High — A move placed `after` another snippet has only half of the required evidence

**Location:** `src-tauri/src/commands.rs:989`, `docs/decisions/2c-4b-1-notes.md:203`

`move_one_match` captures and threads only the moved item's anchor. A move whose destination is `after` another match has two cross-revision identities to establish: the moved item and the placement anchor. The decision record acknowledges that only the moved item is answered and that 2c-4b-2 would have to request a wire-shape change to obtain the other answer. That is not a sound deferral. The design requires `after` to survive only when its anchor has unique exact owned-run correspondence, and 2c-4b-2 cannot derive that fact from the stale `MatchId` or from the returned target projection without recreating the core algorithm or guessing by position.

This also makes a move's generic `Identified` payload misleading: it can identify the subject while providing no evidence that the requested destination is still expressible. The step whose scope is the core correspondence evidence and conflict contract should leave the contract sufficient for the browser transition that consumes it.

**Specific fix:** represent all correspondence operands needed by the operation. For a move, capture both the subject anchor and the optional `after` anchor before the transaction, require `ExactItem` for both, resolve both against the same `fresh` snapshot, and serialize distinct subject and placement results (or an operation-specific move resolution). Add cases where the subject resolves but the placement anchor is missing, changed, ambiguous, or moved to another sequence.

### Medium — The tests do not discriminate whether an anchored answer came from the exact fresh snapshot

**Location:** `src-tauri/src/commands.rs:3148`

Production is currently correct: `conflict_after_the_lock` refreshes once and passes that exact `SourceDocument` to `reconcile` at `src-tauri/src/commands.rs:1482-1490`, while every production anchor is captured before `run_one_save`. There is also still only one production `SaveResult::Conflict` construction site. The test for the crucial R1/R2 interleaving, however, passes `ReapplyMode::Unsupported` at line 3158. That arm never reads the snapshot. Consequently, a mutation that resolved anchored evidence against the cached/refusing observation while continuing to take `disk`, `disk_text`, and `disk_revision` from the later refresh would leave this test green. The ordinary end-to-end move conflict has `found == disk_revision`, so it cannot close this gap.

This is the exact provenance failure Q9 item 2 predicts: a correct algorithm answering the wrong observation. The implementation deserves a falsifiable integration assertion, not only a doc comment and an anchorless mode.

**Specific fix:** in the two-writer interleaving test, capture a real anchored mode from R0, make R1 and R2 differ so the anchor has different resolutions in them, call `conflict_after_the_lock`, and assert that `reapply` is the R2 result whose target revision equals `disk_revision`. Choose fixtures for which resolving against R1 would return a different target or refusal.

### Medium — Both corpus “every anchor” tests let `capture` choose what they audit

**Location:** `crates/espansoconfig-core/tests/reconcile.rs:582`

`every_anchor_finds_itself` silently `continue`s whenever `ReapplyAnchor::capture` refuses (lines 588-590). The test therefore does not establish its stated property over every eligible match. A mutation that newly refuses a class of matches can remove that class from the audit while the synthetic count remains above 100. `every_real_anchor_finds_its_own_item` is even vacuous when a present corpus yields zero captured anchors because it has no non-zero assertion. This is the repository's recurring “coverage audit audits what the implementation emitted” defect.

The file-level claim is also false as written: “Every case is an **R0 → R1** pair” (`crates/espansoconfig-core/tests/reconcile.rs:5`) does not describe the same-snapshot corpus properties or the anchorless-mode case.

Corrected wording: “The cross-revision cases below use explicit R0 → R1 pairs; the corpus cases separately check self-resolution in one snapshot.”

**Specific fix:** determine eligibility independently (a projected match with a sequence-item path in a parsed snapshot), require `capture` to succeed for every eligible target, and fail with the fixture name when it does not. Count eligible, captured, identified, and ambiguous cases separately; assert equality of eligible and captured counts and assert a non-zero real-corpus count when the corpus is present.

### Medium — Several new sentences overstate the predicates they describe

**Location:** `crates/espansoconfig-core/src/reconcile.rs:4`, `crates/espansoconfig-core/src/reconcile.rs:159`, `src-tauri/src/save.rs:270`, `src/lib/i18n/en.json:763`, `src/lib/i18n/es.json:763`

The following claims are wider than the code's narrowest predicates:

- Rustdoc says: “does the snapshot on disk still contain the item this operation named, beyond reasonable doubt?” The trigger fallback establishes only a unique candidate with the same source-spelled trigger and explicitly cannot distinguish deletion followed by replacement.

  Corrected wording: “does the fresh snapshot contain exactly one candidate carrying the evidence this operation permits? For the editor's trigger tier, that is provisional correspondence, not proof that the original item remains.”

- `ReapplyConfidence` says: “Not a preference and not a caller's opinion: it is a property of what the operation would then do to the item.” The public enum and `ReapplyMode::anchored` accept either confidence for any target; only today's command call sites enforce the operation-to-confidence mapping.

  Corrected wording: “The command layer must select this from what the operation would do; the type does not prevent a caller from selecting the weaker policy for a destructive operation.”

- `SaveResult::Conflict::reapply` says it reports “whether the item ... can be identified, beyond reasonable doubt.” That repeats the identity claim for a trigger-only provisional match.

  Corrected wording: “It reports whether exactly one candidate in the fresh snapshot carries evidence at a tier the command selected; the trigger-only tier is provisional and does not prove identity.”

- English says: “espansoConfig could not record what this change was about before it tried to save, so there is nothing to look for.” Spanish says: “espansoConfig no pudo registrar a qué se refería este cambio antes de intentar guardar, así que no hay nada que buscar.” `NoAnchorInBase` can mean the target was known but its sequence address or ownership envelope could not be derived.

  Corrected English: “espansoConfig could not record the correspondence evidence this change requires before it tried to save, so it cannot search the current file with that evidence. The file on disk was not examined.”

  Corrected Spanish: “espansoConfig no pudo registrar los indicios de correspondencia que requiere este cambio antes de intentar guardar, así que no puede buscarlos en el archivo actual. El archivo del disco no se examinó.”

- English says: “The file as it is now cannot be read as YAML, so it holds no list of snippets to look in.” Spanish says: “El archivo tal como está ahora no se puede leer como YAML, así que no contiene ninguna lista de fragmentos donde buscar.” A parse failure proves that no searchable projection was produced, not that the bytes contain no list.

  Corrected English: “The file as it is now could not be parsed as YAML, so espansoConfig has no parsed snippet list to search.”

  Corrected Spanish: “El archivo tal como está ahora no se pudo analizar como YAML, así que espansoConfig no tiene una lista de fragmentos analizada donde buscar.”

- English says: “The file as it is now holds no list of snippets where this change’s snippet was.” Spanish says: “El archivo tal como está ahora no contiene ninguna lista de fragmentos donde estaba el de este cambio.” `SequenceMissing` is also returned when the addressed sequence exists but has no projected candidates, including an empty list.

  Corrected English: “espansoConfig found no snippet candidate at the recorded sequence address in the file as it is now.”

  Corrected Spanish: “espansoConfig no encontró ningún fragmento candidato en la dirección de secuencia registrada en el archivo tal como está ahora.”

- English says: “More than one snippet in that list is written exactly the way the one this change was about was written.” Spanish makes the same claim (“está escrito exactamente igual”). At the mapping-slice tier, leading owned trivia may differ; the actual predicate is equality of the tier's digest.

  Corrected English: “More than one snippet in that list carries the same exact correspondence evidence recorded for this change, so espansoConfig cannot tell them apart.”

  Corrected Spanish: “Más de un fragmento de esa lista contiene los mismos indicios exactos de correspondencia registrados para este cambio, así que espansoConfig no puede distinguirlos.”

- English says: “This action moves, removes or copies a snippet’s own lines, so nothing less exact will do.” Spanish says: “Esta acción mueve, quita o copia las líneas propias de un fragmento, así que nada menos exacto sirve.” `NoExactCorrespondence` is also reachable for a creator's `after` placement anchor, where the action inserts after the anchor and does not move, remove, or copy its lines.

  Corrected English: “This operation or positional anchor requires exact owned-line correspondence, so nothing weaker will do.”

  Corrected Spanish: “Esta operación o ancla de posición requiere una correspondencia exacta de las líneas propias, así que nada menos exacto sirve.”

**Specific fix:** narrow the cited Rustdoc and both dictionaries to the corrected predicates, then update the decision record wherever it repeats the stronger identity or behaviour claim. Do not rely on the current lexical i18n tests as proof of meaning.

### Low — The required multiple-sequence property has no discriminating test

**Location:** `crates/espansoconfig-core/tests/reconcile.rs:386`, `docs/decisions/2c-4b-1-notes.md:215`

The only claimed multiple-sequence case changes `DocumentId`, so it exits at `WrongDocument` before `in_sequence` is exercised. A mutation that accepted every candidate path within the correct document would pass all current tests because every projected fixture uses the same top-level `matches` sequence. The decision record acknowledges this as an argument rather than a test, but Q8 explicitly requires the property to be pinned.

**Specific fix:** add a core unit test that places otherwise matching candidate views under two distinct sequence path heads in the same document (cloning a projected `MatchView` and changing its public `path` is sufficient for this private-helper test), and assert that only the original sequence is considered. The test must fail if `in_sequence` ignores the path head.

### Low — The operand contract deliberately skips both empty resolution arms

**Location:** `src/lib/ipc/types.ts:1617`, `src-tauri/src/wire_contract.rs:2479`

`Unsupported` and `Targetless` are declared as `Record<string, never>`, which `tagged_variant_fields` classifies as nested and skips. Therefore the wire test does not pin that Rust serializes `{}` and TypeScript declares no operands for those variants. Adding an operand on one side only can remain green. The fact that an older enum uses the same spelling does not make the hole harmless; this step added a new contract and explicitly claims exhaustiveness.

**Specific fix:** teach the wire-contract parser to recognize `Record<string, never>` as a checked zero-field payload and compare it with the serialized object, or use a TS spelling that the checker can parse as an explicit empty payload without weakening the type. Update the expected checked/nested counts so both arms are checks, not skips.

## Confirmed properties

The production anchor is captured from the revision-validated pre-transaction `SourceDocument`; `conflict_after_the_lock` is the sole production conflict constructor and derives `disk_text`, `disk_revision`, `disk`, and the resolution from one refreshed snapshot. The tier walk never reads `item_index`; strict operations stop after owned-run correspondence; only the match editor reaches mapping and unique-trigger tiers; all nine refusal variants and all four resolution variants are reachable and distinct. `item_owned_runs` is a wrapper over the existing `entry_owned_runs`, not a second ownership implementation. No command, writer, force flag, projection-to-YAML path, three-way merge, or Tauri dependency in the core was added, and the existing single-save and batch-shape constraints remain intact.
