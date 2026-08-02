# Phase 2b-2b-2 — the aggregate code review

A Codex review of the **written code** of Phase 2b-2b-2, run at the opening of the session that
follows it, because the 2b-2b-2 session spent its Codex budget on the design consult
(`phase-2b-2b-2-open-key-design.md`) and reached its context limit before a code round could be
spent. The `/goahead` policy asks for one review of the aggregate per phase; this is 2b-2b-2's.

The brief was deliberately narrow — three questions, a named file list, a word cap and an explicit
ban on web search — because two consecutive Codex jobs on this phase had run 26 and 20 minutes and
the first had to be cancelled with zero output events. **This one returned in 1 minute 53 seconds.**
The narrowing was chosen from the previous session's own note: the three places named are the three
where a defect would be invisible to the 82 tests in `tests/draft_plan.rs`.

- Job `task-msbn646t-j2plml`, effort `medium`, read-only, 1m 53s.
- Files in scope: `src/draft/{plan,audit,error,match_draft}.rs`.
- Questions: (Q1) `plan_open_mapping`'s index-to-key resolution; (Q2) the `NestedKeys` construction
  feeding `check_every_named_key_is_unique`; (Q3) whether `check_closed_surface`'s admitted set has a
  gap the six over-deep refusals do not cover.

---

## The reply, verbatim

```
## Q1

**NONE FOUND**

- `plan_open_mapping` indexes the exact projected `&[FieldView]` supplied by `variable.params` or a form-field mapping, without filtering or reordering (`plan.rs:498-501`, `plan.rs:573-580`, `plan.rs:597-606`).
- Out-of-range indices refuse before path construction (`plan.rs:600-603`).
- Non-scalar and undecoded target keys refuse through `nameable_key` (`plan.rs:703-707`).
- Duplicate decoded keys are checked against every entry in the same projection and refuse regardless of which duplicate was drafted (`plan.rs:708-718`).
- Non-scalar or undecoded sibling keys cannot match a key path, so excluding them from duplicate comparison cannot redirect the edit (`plan.rs:682-697`).

## Q2

**DEFECT**

- Variable mappings themselves are omitted from `NestedKeys`; only their `params` mappings are recorded, and only when params are drafted (`plan.rs:492-502`).
- Path: `draft.vars[i].name = Set(...)` → `plan_variable_scalar` emits `<variable-path>.name` (`plan.rs:524-545`).
- If that variable mapping contains duplicate `name` keys, `named_key_in_parent` identifies the variable mapping as the parent (`audit.rs:492-500`).
- With no params draft, `nested` has no entry for that parent; the uniqueness guard silently skips it (`audit.rs:303-310`).
- Thus an unedited duplicate variable key escapes and path resolution may address a different occurrence than the projection represented.
- Duplicate `params` keys are likewise not audited as intermediate path segments; only keys inside the selected params mapping are recorded (`plan.rs:498-501`).

## Q3

**NONE FOUND**

- Scalar paths admitted are: `M.<MatchField>`; `M.<SequenceField>[i]`; `M.vars[i].<VariableField>`; `M.form_fields.<key>.<key>`; `M.vars[i].params.<key>`; and the last two open-entry shapes followed by `[i]` (`audit.rs:438-455`).
- Removal paths admitted are: `M.<MatchField>`; `M.vars[i].<VariableField>`; `M.form_fields.<key>.<key>`; `M.vars[i].params.<key>` (`audit.rs:471-481`).
- Insertions are admitted only into `M` under a recognized `MatchField`; moves are always refused (`audit.rs:109-118`).
- Every scalar/removal pattern matches an exact suffix slice, so additional segments cannot pass (`audit.rs:435-457`, `audit.rs:468-483`).
- The implementation and the seven-scalar/four-removal comments agree (`audit.rs:418-430`, `audit.rs:460-466`).
```

---

## Verification, independently of the reply

The Q2 finding was checked against the code before it was accepted, and it is **half right in a way
that changes what the fix is for**. The gap is real; the consequence Codex names for it is not
demonstrated.

**What is confirmed.** `plan_vars` pushes exactly one `NestedKeys`, for the `params` mapping, and only
when `drafted.params` is non-empty (`src/draft/plan.rs:498-501`). The variable's *own* mapping — where
`name`, `type`, `inject_vars` and the `params` key itself live — is never recorded. The uniqueness
guard's own doc comment states the consequence as a design choice — *"a mapping the caller did not
describe is not judged: this module reads paths, never documents"* (`src/draft/audit.rs:303-306`) —
so the guard skips that parent by construction, silently. The paths of a variable's three
schema-known scalars are composed from `VariableField::key()`, a literal, so `nameable_key` — which
*is* the duplicate-refusing gate for every open-mapping key — is never consulted for them either.
**Neither of the two mechanisms that refuse an ambiguous key can see a variable mapping's own keys.**

**What is not confirmed.** *"Path resolution may address a different occurrence than the projection
represented"* is not reachable today. `VariableView::project` claims the **first** occurrence of a
modelled key and sends the second to `unknown_entries` with `UnknownReason::RepeatedKey`
(`src/model/variable.rs:147-149`, `src/model/project.rs:251-259`), and `patch::path::resolve` also
takes the **first**. Projection and resolution therefore agree, and the bytes edited are the bytes
that were displayed. There is no wrong-node write in the current tree.

**And a third thing, found only while implementing the fix, which downgrades the finding again.** The
first draft of this section said the gap "produces an edit on the first occurrence, with no note and
no refusal". **That is wrong, and the correction is the most useful thing this review produced.** A
repeated key raises `HazardKind::DuplicateMappingKey` on the mapping that holds it
(`src/syntax/ownership.rs:802-807`), and `TriviaIndex::disqualifying_hazard` counts a hazard on a
**descendant** as well as on an ancestor (`src/syntax/trivia.rs:605-611`). A variable's mapping is a
descendant of the match mapping, so a duplicate anywhere inside a variable sets the *match*'s
`blocking_hazard`, and `plan_match_edits`' third step refuses the whole match with
`DraftError::MatchNotEditable` before `plan_vars` is ever entered. **No projected document reaches
the gap.** There is no silent edit, and there never was.

**So what the defect actually is.** Not a corruption and not a silent edit, but a **policy that stops
at one level** and is currently masked by a coarser gate one mechanism up. A repeated key of the
*match* mapping is refused by name (`DraftError::AmbiguousKey`, `plan.rs:103-111`); the identical shape
one level down has no name of its own, and the caller is told only that the match is not editable.
Three facts decided this should be closed rather than recorded as a hole:

- **the masking gate is coarse and is a plausible thing to narrow.** One duplicate anywhere in a match
  makes the entire match uneditable today. Phase 2c is the editing UI, and narrowing that is exactly
  the kind of improvement it will want. On the day it narrows, the nested refusal has to already exist
  and already say *which* variable;
- **this crate already states invariants redundantly across layers on purpose.** `draft/mod.rs` says
  the closed-surface invariant "is stated three times", the third time over the derived batch by
  `check_closed_surface`, which is redundant with the planner by design. A nested twin of
  `AmbiguousKey` is the same pattern, not new licence;
- **the information is already in the projection and was simply not consulted** —
  `variable.unknown_entries` holds the `RepeatedKey` entry.

**The unreachability is written down and asserted, not just believed.** `AmbiguousVariableKey`'s doc
comment carries a *"No projected document reaches it today"* section — stated at the variant because
Phase 2b-2b-3 owes it a dictionary string and would otherwise be writing a sentence for a code no user
can see — and the test helper `one_match_with_its_duplicate_admitted` **asserts** that the gate still
refuses first before forcing the state. If a later phase narrows the gate, that assertion fails and
the paragraph gets re-read rather than rotting quietly.

**Codex's second Q2 bullet is the same defect, not another one.** A variable mapping holding two
`params:` keys is an ambiguous *intermediate* segment, which `check_every_named_key_is_unique` cannot
see either — it reads a path's last segment only (`named_key_in_parent`). It has the same cause, the
same reachability and the same fix, so it is not tracked separately.

**Form fields have no equivalent gap, and this was checked rather than assumed.** A duplicate inside
a form field's options mapping is caught by `check_every_named_key_is_unique` through the `NestedKeys`
that `plan_form_fields` does push (`plan.rs:580`); a duplicate key in the `form_fields` mapping itself
is caught by `nameable_key` (`plan.rs:698-720`); and a duplicate `form_fields:` in the match mapping is
caught by the match-level refusal. Q1 and Q3 were spot-checked at the cited lines and stand.

---

## Disposition

| # | Finding | Verdict | Disposition |
|---|---|---|---|
| Q1 | `plan_open_mapping`'s index-to-key resolution | NONE FOUND | Accepted. The index is consumed against the same `&[FieldView]` slice the projection presented, unfiltered and unreordered |
| Q2 | A variable's own mapping is audited by neither `nameable_key` nor `check_every_named_key_is_unique`, so a repeated `name` / `type` / `inject_vars` / `params` key is refused by no name of its own | DEFECT, downgraded twice — from *wrong node* to *unrefused ambiguity*, then to *unnamed ambiguity behind a coarser gate* | **Fixed anyway.** `plan_vars` refuses a drafted variable whose own mapping holds a repeated modelled key, mirroring `plan_match_edits`' match-level refusal one level down. `DraftError::AmbiguousVariableKey { variable }` is that refusal, index-only per D1. It is **unreachable from a projected document today** and both the variant's doc comment and an assertion in the test helper say so |
| Q3 | `check_closed_surface`'s admitted set | NONE FOUND | Accepted. The admitted set was re-derived from the code's suffix patterns and agrees with the seven/four comments |
