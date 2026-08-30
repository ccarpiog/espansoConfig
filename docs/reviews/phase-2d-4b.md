Reviewer: autoclaude adversarial reviewer

# Phase 2d-4b — adversarial review

Reviewed uncommitted working tree (`git status --porcelain`: 17 modified, 2 untracked) against
`docs/reviews/phase-2d-4b-design.md`.

## Medium

**1. `src/lib/i18n/codes.test.ts:1009-1018` — the comment claims a check the assertion does not make.**
Lines 1011-1012 say "every value is asserted to be a function that really produces this namespace's
keys". Line 1016 asserts only `typeof builder === 'function'`. Nothing anywhere compares a registry
*key* with the namespace its builder emits, and `satisfies Readonly<Record<string, (value: never) =>
TranslationKey>>` (`codes.ts:1750`) cannot: `never` accepts every builder. So
`addedContent: changedContentKey` passes — key sets still match, `duplicateSeam`-style unreachability
returns for `code.addedContent.*`, and the reachability invariant this whole registry exists for is
silently void for that namespace. This is a narrower instance of the hole Q4 commissioned, inside the
fix for it. Actionable: probe each builder's returned prefix (all 49 take a string-ish argument except
`commandErrorKey`, which takes `{ code }`).

**2. `src/lib/ipc/events.ts:52-53` — the capability record is incomplete for the contract the same
file states.** It names `core:event:allow-listen` as "the narrowest entry that grants it". The
identifier is real (`src-tauri/gen/schemas/desktop-schema.json`) and correct for registration, but
`node_modules/@tauri-apps/api/event.js:42-47` shows the unlisten function `listen` returns invokes
`plugin:event|unlisten`, gated by the separate `core:event:allow-unlisten`. `events.ts:21-28` assigns
disposal to 2d-5 as this module's lifetime contract; under the named widening alone that call fails —
`__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener` runs, then the `invoke` rejects unhandled, and
the Rust-side listener is never removed. The phase that first registers will widen by one entry and
find disposal broken.

## Low

**3. `codes.test.ts:987` (`parts.length === 3`).** `codes.ts:1678-1690` calls the comparison set "the
complete set of `code.*` namespaces in `en.json`". A four-part `code.ns.variant.one` key (the shape
190 non-`code` keys already use) would register no namespace and be exempt with no entry. Derived from
`en.json`: 719 three-part, 190 four-part, 2 five-part, 0 non-three-part under `code.` today.

**4. Evidence not yet recorded.** `docs/decisions/2d-4b-notes.md` stops at §2 (the reproduced brief);
`PROGRESS.md` is unmodified and still carries 2d-4b as *Next action*. Q7 requires the gate set in
`PROGRESS.md` and the three re-measured frontend figures from the completed tree.

## Figures I re-derived, all agreeing with the brief

- `4 / 6 / 2 / 2`, 17 variants, 3 address arms / 14 keyed: parsed from `src-tauri/src/reconciliation.rs`.
- Union floor 44 → 49: exactly five new `…Name` twins; the five value unions carry no single-quoted
  member and are skipped by `every_typescript_wire_union_has_a_namespace`'s structural guard.
- Sixteen commands = ten readers + six writers, from `COMMAND_NAMES`.
- 49 registry entries + 3 exceptions = 52 `code.` namespaces in `en.json`.
- `npm run check` 431 + `events.ts` + `events.test.ts` + `@tauri-apps/api/event.d.ts` = 434.
  `event.d.ts` has no imports of its own, and nothing else in `src/` imports `@tauri-apps/api/event`.
- Build 184 unchanged: no non-test module imports `./events` (`rg` over `src/` excluding `*.test.ts`).
- `NOT_A_CODE` already carried `ObservedDocument` with its reason before this phase, so the
  `ObservedDocumentName` exemption is the pre-existing ruling's `…Name` twin, not a new claim.
- `const_array_members` slices `export const RECONCILIATION_EVENT_NAMES = [` to the first `]`;
  reading `events.ts` whole is safe today, and the doc's narrow claim (a *quoted* word inside the
  brackets fails loudly) is true. The broader bolded rule "no comment may go inside these brackets"
  is not enforced for an unquoted comment; harmless, not filed.
- `npx vitest run` over `events`, `codes`, `commands`, `types`: 125 passed.

## Not verified

`cargo test --workspace`, `clippy`, `npm run build` and the two bundle oracles were not re-run inside
the budget; taken from the brief. Real WKWebView delivery of `workspace://reconciliation-ready` is
2d-7's per Q8 and was not attempted.
