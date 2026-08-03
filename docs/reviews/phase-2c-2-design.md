### Q1

Recommend the three plain-text fields for the first editing surface; do not offer a boolean or tri-state control.

Even a restricted control classifies spellings as truth values, violating D2u. Preserving the spelling family only answers serialization, not whether `on`, `yes`, or `true` means true. Keep absent distinct from empty and refuse fields with `decoded === false` or zero-width values.

Strongest counter-argument: three text inputs expose YAML/espanso mechanics and allow values users may reasonably expect the app to validate.

### Q2

Choose policy (i): make any projected value containing `\r` visibly read-only for this sub-phase.

Policy (ii) can mistake a deliberate CR-to-LF edit for no change. Worse, if the user changes another character, the difference is no longer “only normalization,” so the normalized LF can still be submitted and corrupt the value. Policy (iii) contradicts the preservation promise. Detect the condition from the projection before binding the value to an editable DOM control.

Strongest counter-argument: the app can decode and re-emit this value correctly, yet prevents the user from fixing it because of a frontend limitation.

### Q3

Use `DraftField` as the authoritative intent plus an input buffer and baseline presence; do not model “absent,” “present,” and “removed” as three equivalent value states.

Seed every field as `Unchanged`. An initially absent blank control remains `Unchanged`; typing produces `Set(value)`. Clearing an existing value produces `Set("")`; an explicit removal action produces `Remove`. This preserves all required distinctions without inventing another state machine.

Strongest counter-argument: retaining baseline presence alongside draft intent is less locally obvious than a single three-state UI model and requires careful reset handling.

### Q4

Coalesce consecutive edits per field, ending the group on blur, field change, explicit structural action, save, or a short idle boundary.

The live draft should still update on every keystroke; only history snapshots are coalesced. Otherwise a moderately long replacement exhausts all 100 history entries and performs 100 clones and recursive freezes of the 22-field object. Undoing one typing burst is a defensible unit.

Strongest counter-argument: time-based grouping makes undo granularity partly unpredictable and can remove more text than a user expected from one undo.

### Q5

Agree: make the trigger visibly read-only unless the projection contains exactly one single `trigger:` form.

Do not knowingly create a draft that can only reach an unacknowledgeable semantic refusal. Prefer read-only over merely disabled so the value remains selectable and accessible, and show the reason inline. Keep the semantic gate as defense in depth.

Strongest counter-argument: this prevents an otherwise understandable conversion from `triggers:` or `regex:` to a literal trigger; that should eventually be a separate explicit conversion operation.

### Q6

Harden the save outcome so successful completion requires adopting the returned identity or explicitly discharging invalidation.

The re-point-by-identity path is sufficient only if every caller is forced through it. If `moved` is ignored, the first save succeeds but the component retains an identity containing the old revision; the next edit, save, or selection lookup uses a stale identity and is rejected or loses its selection/draft context.

Strongest counter-argument: a sealed one-shot result adds ceremony if identity adoption is already centralized behind one well-tested save wrapper with no alternative call path.

### Q7

The most likely missed defect is an untouched `replace: "a\rb"` passing through a real browser control and being submitted with LF instead of CR.

Rust tests and synthetic component tests can seed strings without reproducing the browser’s value normalization. Add one WebKit end-to-end test loading that exact escaped scalar, opening the small editor, attempting the normal focus/blur/save flow, and asserting both the visible typed refusal and byte-identical disk contents.

Strongest counter-argument: once CR-bearing projections are structurally prevented from reaching editable controls, identity adoption becomes a more likely integration-only failure.

### What I would change about this proposal

1. Add a typed edit-eligibility result covering CR values, `decoded === false`, and zero-width values.
2. Make save-result identity adoption mandatory through a sealed outcome or single enforced wrapper.
3. Add the real-browser escaped-CR regression test before enabling `replace` editing.
4. Use per-field coalesced history rather than per-keystroke snapshots.
5. Keep word-boundary fields textual and trigger editing restricted to single `trigger:` matches.
6. Represent optional fields with baseline presence, a buffer, and existing `DraftField` intent.

Codex session ID: 019fc4da-347f-79a3-a812-610f97abc1b7
Resume in Codex: codex resume 019fc4da-347f-79a3-a812-610f97abc1b7
