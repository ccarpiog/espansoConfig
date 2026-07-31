Blocking: none.

Major:

- [src/lib/i18n/en.json:72](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:72), [DetailPane.svelte:115](/Users/ccarpio/Developer/espansoConfig/src/lib/components/DetailPane.svelte:115) — `unknownValue` always says the value is “shown here as the file writes it,” but an unreadable non-empty span renders `valueUnavailable` instead. Trigger: `value_text: ""`, `value_span: {start: 4, end: 9}`. The pane simultaneously says the bytes are shown and that it could not read them. Smallest fix: make `unknownValue` describe only the value’s kind, then put the “shown as written” sentence exclusively in the `text` branch. The unavailable branch is also unproven at the component level; no automated test instantiates it and the notes say it was never exercised in a window.

- [src/lib/i18n/en.json:74](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:74), [index.rs:473](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:473) — the scope sentence assumes every match uses a block-sequence `-` marker on its first line. Rust projects every sequence item, including flow-sequence and non-mapping items. For `matches: [{trigger: x}]`, there is no `-` or indentation before the match; for a bare empty item (`matches:\n  -`), the span is zero-width, so it has neither a first nor last character. Terminal empty mapping values also make the block span stop before the final colon. Smallest fix: use shape-neutral prose such as “This is the source span reported for this snippet node. Surrounding sequence syntax and comments outside that span are not included,” in both languages.

- [sourceText.ts:180](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/sourceText.ts:180), [1c-2b-2b-1-notes.md:398](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1c-2b-2b-1-notes.md:398) — the renderer is not visually lossless for its own “every character that has no glyph is named” claim. For example, `a\u200Bb` remains an ordinary text segment; U+200B draws no width, so it looks identical to `ab`. The notes acknowledge this while their headline claim says the opposite. The same class includes other default-ignorable formatting characters. Smallest fix: classify and mark the supported default-ignorable characters, with round-trip and ordering tests, or explicitly narrow every UI/documentation claim to the enumerated controls.

Minor:

- [1c-2b-2b-1-notes.md:372](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1c-2b-2b-1-notes.md:372) — the claim that a lone CR and all other C0/C1 controls cannot reach the detail pane is unproven. The cited measurement establishes that NUL prevents parsing, but the committed fixtures do not test representative C1 input such as U+0085 or each claimed category. Smallest fix: add parser/projection tests for the claimed representatives or narrow the note to NUL, the case actually measured.

Nit: none.

Codex session ID: 019fb9db-cff8-7cd1-912b-778967ff4a03
Resume in Codex: codex resume 019fb9db-cff8-7cd1-912b-778967ff4a03
