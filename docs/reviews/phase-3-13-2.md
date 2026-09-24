Reviewer: codex adversarial review

Codex adversarial review of the working tree at /Users/ccarpio/Developer/Utils/espansoConfig.
Codex verdict: needs-attention. 1 finding(s): 0 blocker(s), 1 should-fix.

Do not ship yet: saving a file can silently discard its open preferences draft.

- [SHOULD-FIX] medium · confidence 1 — src/lib/components/SnippetList.svelte:163 — Preserve preference drafts across projection replacement
    FilePreferences is mounted inside the scopedDocument guard. A whole-file save calls forgetTheReplacedDocument before awaiting reprojection, making scopedDocument null and destroyin…
    Fix: Mount FilePreferences from the selected document's stable summary rather than its transient projection, or retain its draft outside that lif…

Scope: the working tree only — anything already committed for this phase was outside it.

VERDICT: ship-with-fixes
BLOCKERS: none
SHOULD-FIX: src/lib/components/SnippetList.svelte:163 — Preserve preference drafts across projection replacement — Mount FilePreferences from the selected document's stable summary rather than its transient projection, or retain its draft outside that lif…
NOT-VERIFIED: Fix the preferences lifecycle and verify that unsaved names and defaults survive projection retirement and rereading.
