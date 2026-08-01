1. **Blocking — rule 5 ignores references inside variable parameters.**  
   [validate/mod.rs:584](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:584), [2a-2a-notes.md:388](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2a-2a-notes.md:388)

   `check_references` scans only `replace`, `markdown`, and `html`. The notes acknowledge that espanso also renders references inside values such as a shell `cmd` and form `layout`, but call this a “coverage hole.” It is an implementation gap in one of the six required rules.

   Concrete failure: a shell variable contains `cmd: "echo {{missing}}"`, while the match’s output references only declared variables. The validator reports nothing about `missing`, although the scope is closed and espanso will attempt to render that parameter. This is exactly the expensive false-negative direction.

2. **Blocking — malformed non-mapping `params` suppresses a provably missing required parameter.**  
   [validate/mod.rs:487](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:487), [validate_semantics.rs:311](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/validate_semantics.rs:311), [2a-2a-notes.md:146](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2a-2a-notes.md:146)

   `params_are_readable` conflates aliases, whose target might be a mapping, with scalars and sequences, which provably cannot contain a `cmd` mapping entry. The negative-side test then explicitly requires silence for `params: "echo hi"`.

   Concrete failure: `type: shell` plus `params: "echo hi"` produces no `VariableMissingRequiredParam`. The projection already records the value’s `ValueKind`, so this is not unknowable. The claim that “nothing may report” is overstated; only an alias or unresolved merge needs conservative treatment.

3. **Blocking — `type: match` is accepted without the required `params.trigger`.**  
   [validate/mod.rs:362](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:362), [IMPLEMENTATION_PLAN.md:149](/Users/ccarpio/Developer/espansoConfig/IMPLEMENTATION_PLAN.md:149), [2a-2a-notes.md:374](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2a-2a-notes.md:374)

   The plan’s nine-type table assigns `params.trigger` to `match`, but `required_param` returns `None`. Thus a recognized `type: match` with no `params` passes rule 3 entirely.

   The notes explicitly admit this false negative as hole 3. Source uncertainty may justify a suspicious classification, but not complete silence while the public model recognizes the type and the implementation claims all six rules are implemented.

4. **Blocking — several rule-5 “openers” suppress genuinely unresolved references rather than conservatively modelling scope.**  
   [validate/mod.rs:635](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:635), [validate/mod.rs:666](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:666), [validate_semantics.rs:540](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/validate_semantics.rs:540)

   `opens_scope` returns true for:

   - any presence of `inject_vars`, even `inject_vars: false`;
   - any `form` variable;
   - any `match` variable;
   - a nameless variable.

   None of those inherently introduces an arbitrary top-level name. A form variable named `f` explains `{{f.who}}`, but not `{{nobody}}`; a nameless invalid variable cannot declare `nobody`. The repository’s existing fixture describes `inject_vars` as controlling expansion inside a variable’s value, not importing arbitrary names ([variable-chain.yml:70](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/corpus/synthetic/variable-chain.yml:70)).

   Concrete failure: the test fixture containing declared form variable `f` and output `{{f.who}} {{nobody}}` is required to be silent. Likewise, adding `inject_vars: false` to an otherwise closed match disables reference validation completely. The E8 experiments prove these branches affect tests; they do not establish that the branches model espanso correctly. Section 6’s closure-table claim is therefore overstated.

5. **Should-fix — the real-configuration test can skip and pass, and it does not check the claimed “all six rules” negative side.**  
   [validate_semantics.rs:847](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/validate_semantics.rs:847), [validate_semantics.rs:864](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/validate_semantics.rs:864), [validate_semantics.rs:921](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/validate_semantics.rs:921)

   The test named `the_real_configuration_produces_no_editor_model_errors` returns successfully when the private corpus is absent. When present, it asserts only `errors == 0`; suspicious findings—including all unresolved references—are merely printed. It also asserts no regex coverage, and the recorded corpus has zero regex triggers.

   Concrete weaker implementation: change rule 5 to report every brace pair in every output. If those become suspicious findings, this test still passes. In a public checkout with no private corpus, any validator passes it. The doc comment’s “check of all six rules” and the notes’ corresponding claim at [2a-2a-notes.md:323](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2a-2a-notes.md:323) assert more than the body checks.

6. **Should-fix — the test claiming exact parity with espanso tests only this crate’s own regex against six hand-selected strings.**  
   [validate/mod.rs:743](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:743)

   `the_reference_pattern_reads_a_name_exactly_where_espanso_does` never invokes espanso, an independent oracle, or even a separately sourced expected corpus. It checks the transcribed constant against manually expected outputs.

   Concrete weaker implementation: a subtly mistranscribed pattern that behaves correctly for these six strings but differs for another whitespace, Unicode, dotted-name, or brace-boundary case passes. The notes’ claim that this test “pins both halves” of espanso’s behavior at [2a-2a-notes.md:242](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2a-2a-notes.md:242) is overstated.

7. **Should-fix — the fixture and purity sweeps have names/doc comments broader than their bodies.**  
   [validate_semantics.rs:726](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/validate_semantics.rs:726), [validate_semantics.rs:783](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/validate_semantics.rs:783)

   `every_fixture()` is not every fixture in the file: it omits numerous inline sources, including merge-key, non-mapping-params, each closure opener, markdown/html, image-path, and malformed-entry fixtures. Consequently, `validation_is_a_pure_function_of_the_projection` covers only that subset and merely checks repeatability.

   Concrete weaker implementation: validation could mutate hidden state, perform I/O, or behave incorrectly only for an omitted fixture while returning equal results on two immediate calls. The test still passes. The notes also incorrectly say every fixture is an inline `const` ([2a-2a-notes.md:35](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2a-2a-notes.md:35)); many fixtures are local `let source` strings.

8. **Should-fix — validation is quadratic on large variable scopes.**  
   [validate/mod.rs:445](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:445), [validate/mod.rs:589](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:589), [validate/mod.rs:660](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:660)

   Duplicate detection uses a `Vec` plus `contains`, and every reference linearly scans another `Vec`. Each match also clones every global name.

   Concrete failure: tens of thousands of unique global variables require roughly quadratic string comparisons during duplicate checking; many matches or references multiply further full-scope scans and clones. Since this runs while the future save lock is held, an adversarial but parseable document can make saving appear hung.

9. **Nit — the duplicate-location test’s doc comment claims runtime precedence it never checks.**  
   [validate_semantics.rs:417](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/validate_semantics.rs:417)

   The body proves only that the finding’s node and span identify the second declaration. It does not prove the second declaration “lost” or that the first is “in effect.”

   Concrete scenario: if espanso uses last-wins insertion, the later declaration is effective and the earlier one loses; this test remains green while its explanatory claim is false.

I found no new `Serialize` derives, no Tauri dependency introduced into core, no production `unwrap`/`expect` on adversarial input, and no private configuration content leaked into the change. The regex finding’s code and module documentation are appropriately scoped to this crate’s regex version; the questionable part is the notes’ unmeasured “strictly more permissive” justification, not the variant name itself.

Codex session ID: 019fbc81-8049-7290-b39d-5c562893f9a1
Resume in Codex: codex resume 019fbc81-8049-7290-b39d-5c562893f9a1
