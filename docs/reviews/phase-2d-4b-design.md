# Phase 2d-4b — the TypeScript half of the reconciliation wire, design consult

**Reviewer: Codex (GPT-5 family), high effort, dispatched 2026-08-30 by `/autoclaude-opus` in driven
mode via the companion CLI**, per `docs/decisions/codex-dispatch-procedure.md`. The brief is
reproduced in §2 of `docs/decisions/2d-4b-notes.md`. Codex ran read-only and wrote no file; its
final message is reproduced below verbatim, with only the two edits that procedure permits — the
`Resume in Codex` trailer dropped, the session ID kept. It is the **second provider** to look at this
phase's work since 2d-4a began, which is the coverage bound `docs/decisions/2d-4a-notes.md` §22.4
carried forward and did not discharge.

**This consult binds Phase 2d-4b.** Where it rules against the split notes or against a habit of this
project, the ruling wins unless a later record says why not.

---

## VERDICT — PROCEED AS ONE COHERENT WIRE STEP

2d-4b should add only typed transport, injection, localization access, and contract evidence. Persistent reconciliation state and all drain orchestration belong to 2d-5.

### Q1 — Mirrored types and Rust drift

**Ruling.** Put every reconciliation wire type in `src/lib/ipc/types.ts`. Do not create a second wire-type module. Add the reconciliation types to the existing Rust `wire_contract.rs` machinery; do not introduce code generation.

The required mirrors include not only the types named in the brief, but also `CorrespondenceEntry` and `CorrespondenceTable`, because `ChangedContent::Projected.correspondences` exposes them.

The externally tagged enums must be uniform one-key objects:

```ts
export type ObservedDocument =
  | {
      readonly Addressable: {
        readonly document: DocumentId;
        readonly relative_path: string;
      };
    }
  | {
      readonly Named: {
        readonly document: DocumentId;
        readonly relative_path: string;
      };
    }
  | {
      readonly Unnamed: {
        readonly relative_path: string;
      };
    };

export type ExternalObservation =
  | {
      readonly Changed: {
        readonly sequence: number;
        readonly document: ObservedDocument;
        readonly previous_revision: ContentRevision | null;
        readonly disk_revision: ContentRevision;
        readonly content: ChangedContent;
      };
    }
  | {
      readonly Added: {
        readonly sequence: number;
        readonly document_summary: DocumentSummary;
        readonly content: AddedContent;
      };
    }
  | {
      readonly Removed: {
        readonly sequence: number;
        readonly document: ObservedDocument;
        readonly previous_revision: ContentRevision | null;
      };
    }
  | {
      readonly Unreadable: {
        readonly sequence: number;
        readonly document: ObservedDocument;
        readonly reason: UnreadableReason;
      };
    };
```

`UnreadableReason`, `AddedContent`, and `ChangedContent` must use the same `{ Variant: { ... } }` representation, including empty payloads such as `{ PermissionDenied: {} }`. Add explicit `…Name` unions for all four code enums and for `ObservedDocument`, following the existing tagged-union convention.

The existing mirror is hand-written. It already carries both mixed representations—bare strings for Rust unit variants and one-key objects for struct variants—and all-object unions such as `DraftError` and `NewMatchPosition`. Here Rust deliberately made every arm a struct variant, so bare strings are wrong.

There is currently **no mechanism that would fail specifically for drift in the new reconciliation types**, because they are absent from `wire_contract.rs`. 2d-4b must extend that existing mechanism with:

- serialized samples for every struct and every enum arm;
- interface property comparisons in both directions;
- union-name comparisons in both directions;
- tagged-payload field comparisons in both directions;
- source-derived completeness checks so a newly added Rust variant cannot be omitted from both the samples and TypeScript.

That will make Rust field and variant drift fail `cargo test`. It still does **not** prove TypeScript property type text: the contract explicitly admits that `byte_len: string` could pass a name-only interface check. It also does not make JavaScript `number` a lossless representation of the entire Rust `u64` range; epochs and sequences remain numbers on this JSON wire and are exact only within JavaScript’s safe-integer range. State that limitation rather than claiming a mathematically exact `u64` mirror.

Evidence: the hand-written mirror and its stated contract are documented at [wire_contract.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/wire_contract.rs:1), including the type-text limitation at line 41. Existing mixed and uniform enum shapes are at [types.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/types.ts:294), [types.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/types.ts:2498), and [types.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/types.ts:2595). The Rust externally tagged shape is explicit at [reconciliation.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/reconciliation.rs:301), while the two correspondence structs are at [correspond.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/watch/correspond.rs:58). The present missing contract coverage is recorded at [2d-4a-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-4a-notes.md:1202).

### Q2 — Drain wrapper and watermark ownership

**Ruling.** Split the boundary in the established way:

- Add `drainExternalChanges(afterSequence)` to `src/lib/ipc/commands.ts`, returning `Promise<CommandResult<ReconciliationBatch>>` and invoking `drain_external_changes` with `{ afterSequence }`.
- Add a required `drainExternalChanges` member to `BrowserCommands` and forward it from `REAL_COMMANDS`.
- Do not add reconciliation state or a drain-response method to `BrowserState` in 2d-4b.

`BrowserCommands` is in `src/lib/browser/workspace.svelte.ts`, not `src/lib/ipc/commands.ts`; the latter owns the low-level typed functions and command-name value.

The wrapper owns no watermark. `afterSequence` is a required caller-supplied value. The wrapper returns the batch and retains nothing. It performs no epoch comparison.

Persistent watermark state, current workspace epoch, per-document accepted sequence, `discarded` handling, and acceptance or rejection of a batch all belong to the 2d-5 coordinator. That coordinator must compare `batch.epoch` with the epoch it is showing before advancing any watermark or installing any observation.

Holding a watermark or drained batch as production state in 2d-4b **would cross into 2d-5**. Returning a batch to the caller, or retaining one only inside a boundary test, does not: those uses do not arbitrate or survive the call. Thus 2d-4b’s answer to a drain is simply the typed `CommandResult`; it does not consume it.

Evidence: `commands.ts` centralizes invocation and rejection classification at [commands.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/commands.ts:225), while `BrowserCommands` and its real implementation are at [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:128) and [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:284). Rust defines `after_sequence` as an acknowledgement watermark at [commands.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:3462), and the batch says its monotonicity is epoch-scoped at [reconciliation.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/reconciliation.rs:683). The phase allocation puts arbitration in 2d-5 at [phase-2d-design.md](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2d-design.md:126).

### Q3 — Injectable event listener

**Ruling.** Add a dedicated `src/lib/ipc/events.ts` containing:

- a value for the exact event name, preferably a one-element `RECONCILIATION_EVENT_NAMES` array that Rust can compare;
- a narrow `ReconciliationEventSource` interface with an asynchronous `subscribe(handler)` returning an unlisten function;
- a factory that accepts the raw Tauri `listen` function and wraps `Event<ReconciliationWake>` by passing only `event.payload` to the typed handler;
- one real source constructed from Tauri’s `listen`.

Use factory/dependency injection, not a mutable module-level setter. Later, 2d-5 injects the resulting event source into its coordinator, just as browser state receives a `BrowserCommands` object. Tests can inject a fake raw listener or a fake source without a Tauri process.

The repository currently has no Tauri-event-listener precedent in `src/lib/ipc/menu.ts`: that module invokes `set_menu_labels`. `src/lib/menu.ts` subscribes to locale state, which is useful lifetime precedent but is not a Tauri event wrapper.

The subscription wrapper must not store its unlisten function. The 2d-5 coordinator owns it for the coordinator/window lifetime and calls it during disposal. A workspace replacement does **not** unsubscribe or resubscribe: one listener remains active while the current epoch changes, and stale wakes are rejected by the coordinator’s epoch comparison. Re-registering on every open would create avoidable delivery gaps.

Because Tauri registration is asynchronous, 2d-5 must also handle disposal racing registration: if disposal happens before `listen()` resolves, call the eventual unlisten function immediately. Subscription failure must remain observable; the wrapper must not pretend registration succeeded.

The ordering obligations all belong to **2d-5**, not 2d-4b:

- drain after listener registration — 2d-5;
- drain after a successful `BrowserState.open()` completes — 2d-5;
- drain on foreground/resume — 2d-5;
- drain on a current-epoch wake — 2d-5.

These are orchestration decisions, not open-surface decisions, but Q7 explicitly assigns listener/drain orchestration to 2d-5. 2d-4b supplies only the injectable event transport and tests its name, payload forwarding, registration failure, and unlisten forwarding.

Extend a Rust contract test to compare the frontend event-name value with `RECONCILIATION_READY`. Otherwise both a fake-driven frontend test and the Rust emitter test can be green while spelling different event names.

Evidence: Tauri’s installed declaration returns `Promise<UnlistenFn>` at [event.d.ts](/Users/ccarpio/Developer/espansoConfig/node_modules/@tauri-apps/api/event.d.ts:65). The Rust name is at [events.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/events.rs:34), and that file expressly assigns the recovery drains to the frontend coordinator at lines 47–59. Existing dependency injection is at [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:1463), while explicit subscription disposal precedent is at [locale.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/stores/locale.svelte.ts:178). The phase split assigns orchestration to 2d-5 at [phase-2d-design.md](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2d-design.md:124).

### Q4 — i18n accessors

**Ruling.** 2d-4a added **four namespaces and fourteen keys**:

- `externalObservation`: 4 variants;
- `unreadableReason`: 6 variants;
- `addedContent`: 2 variants;
- `changedContent`: 2 variants.

`ObservedDocument` is not a code namespace and gets no message accessor.

All four need new key builders and new `describe*` functions; none is an extension of an existing namespace:

- `externalObservationKey` / `describeExternalObservation`;
- `unreadableReasonKey` / `describeUnreadableReason`;
- `addedContentKey` / `describeAddedContent`;
- `changedContentKey` / `describeChangedContent`.

`index.ts` then adds the four reactive wrappers `tExternalObservation`, `tUnreadableReason`, `tAddedContent`, and `tChangedContent`.

Each key builder must take its exact `…Name` union and return `TranslationKey` from the mechanical template literal. That preserves the real guarantee: a variant missing its English key fails compilation **in `codes.ts`**. The `describe*` functions should use `wireVariantName` and `wireVariantOperands`, as the existing object-enum accessors do.

`codes.test.ts` must add exhaustive, `Missing`/`ExpectNever`-pinned sample/name tables and update the variant-count assertion with `4 / 6 / 2 / 2`. It must exercise every variant in both locales and reject blank output, `undefined`, raw missing keys, and unsubstituted placeholders.

**Close the key-without-accessor hole generally, not only for these four namespaces.** Add a value registry in `codes.ts` whose entries are actual typed key-builder function references, then compare the dictionary’s complete `code.*` namespace set against that registry in both directions. Admit only three explicit exceptions: `workspaceError`, `discoveryError`, and `identityError`, which do not cross the wire directly and are flattened into `CommandError`.

This general check will expose one existing frontend-wire gap: `duplicateSeam` has EN/ES keys and a TypeScript wire type but no key builder. 2d-4b should add `duplicateSeamKey`, `describeDuplicateSeam`, and `tDuplicateSeam` rather than exempting it. This is a bounded correction found by the required general invariant, not an unrelated localization expansion.

The registry must contain function references, not merely namespace strings. A string manifest could claim an accessor exists without naming callable code. The general test then guarantees that a newly added dictionary namespace fails until it acquires an accessor or is deliberately entered into the small exception set. It does not prove translation meaning, and should not claim to.

Evidence: the four Rust registrations are at [dictionary_contract.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dictionary_contract.rs:408), with measured counts at line 481. `ObservedDocument` is deliberately classified as an address rather than a code at [dictionary_contract.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dictionary_contract.rs:562). The fourteen English keys begin at [en.json](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:997). The compile-time key mechanism is documented at [codes.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/codes.ts:17), and the current pinned count table is at [codes.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/codes.test.ts:374). The pre-existing unaccessed namespace is visible at [en.json](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:869) beside its wire type at [types.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/types.ts:747).

### Q5 — Keeping `ObservedDocument` arms distinct

**Ruling.** Expose no `ObservedDocument` identity accessor. In particular, do not add `documentId(document): DocumentId | null`, a common-payload projection, or any helper that merges `Addressable` and `Named`.

Consumers that need an identity must narrow the externally tagged union and handle `Addressable`, `Named`, and `Unnamed` explicitly, with an exhaustive `never` terminus so a future fourth arm fails compilation.

The exact guarantee must be stated narrowly: the union makes direct access to `document` fail until the value is narrowed, and an exhaustive switch makes an added arm fail at participating consumers; **TypeScript does not force `Addressable` and `Named` to execute different logic after narrowing**. A consumer can deliberately combine the two branches or pass both to the same function, and neither the union nor `never` prevents that semantic collapse.

Do not add brands to imply otherwise. Both numbered arms carry the same serialized `DocumentId`; a frontend-only brand would not be established by runtime decoding and would merely turn the false guarantee into a type assertion. The distinction is enforced finally by 2d-5’s model logic and its tests: only `Addressable.document` may be handed to an open-workspace command.

The existing generic `wireVariantName` remains available because other code enums use it, but it is not an identity accessor and must not be presented as enforcing the addressability rule.

Evidence: Rust deliberately omits the accessor and explains the semantic distinction at [reconciliation.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/reconciliation.rs:363). The arms’ meanings are documented at [reconciliation.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/reconciliation.rs:307). The project requires any TypeScript limitation to be stated beside what is enforced at [CLAUDE.md](/Users/ccarpio/Developer/espansoConfig/CLAUDE.md:469).

### Q6 — Removing `AWAITING_FRONTEND_DECLARATION`

**Ruling.** Add `drain_external_changes` to `COMMAND_NAMES` and delete its `AWAITING_FRONTEND_DECLARATION` entry in the same commit. Update the workspace count to sixteen and the prose/count assertion to ten readers and six writers.

`wire_contract.rs` reads `src/lib/ipc/commands.ts`, strips comments, parses the string members of the `COMMAND_NAMES` const array, unions them with `MENU_COMMAND_NAMES` from `src/lib/ipc/menu.ts`, and compares that set against the command names independently parsed from `generate_handler!`.

The pending entry is checked in both directions:

- it must be registered in Rust;
- it must be absent from the frontend-declared set.

Therefore adding the frontend name first makes the “pending must be absent” assertion fail, while deleting the pending entry first makes registered and reachable sets disagree. A transient red Rust test while editing is unavoidable and irrelevant; there must be no landed intermediate commit. The complete atomic change is green.

If both Rust and TypeScript gates cannot be made green in that one step, the worker must stop and diagnose the contract disagreement. They must not retain the exception, split the edits across commits, weaken the comparison, or add another suppression.

Evidence: frontend reading and comment stripping are at [wire_contract.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/wire_contract.rs:173). The declared-set construction is at [wire_contract.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/wire_contract.rs:1440), the bidirectional pending checks at line 1491, and the bounded exception at line 1528. The frontend value being parsed is at [commands.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/commands.ts:88).

### Q7 — Step boundary and evidence

**Ruling.** Keep 2d-4b as one worker’s coherent unit. Do not cut it again.

The Rust/TypeScript seam was already the justified split. A further cut would separate types from the contract that validates them, or localization keys from the accessors that discharge the known gap. It would also turn the command declaration and pending-entry deletion into an artificial red interval. The event source, drain wrapper, mirror, contracts, and accessors are one frontend boundary capability and share no policy state.

Required evidence is:

- Rust wire-contract tests for every new interface, union, payload, command name, and event name;
- TypeScript wire/helper tests with exhaustive samples;
- command-wrapper tests for exact name, `{ afterSequence }`, success, and classified rejection;
- event-wrapper tests for exact event name, payload unwrapping, registration rejection, and returned unlisten;
- i18n tests for all fourteen new variants in both locales, updated counts, reactive wrappers, and general namespace-to-accessor coverage;
- the full machine gate set recorded in `PROGRESS.md`;
- re-measured `npm run check`, `npm test`, and `npm run build` figures from the completed tree.

The current frontend baseline is `431 / 2125 / 184`; those are anchors, not predicted post-change results. The production module count may move depending on which new modules become reachable from the application entry. Judge the movement against added reachable source modules and use both bundle-oracle searches: server tokens absent and client tokens present. The module number alone proves nothing.

No mounted test and no window reading belongs to this step, because it changes no renderer and installs no coordinator.

Evidence: 2d-4’s exact boundary is at [phase-2d-design.md](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2d-design.md:124), and 2d-5’s orchestration begins at line 126. The no-mounted/no-window ruling is at [2d-4-split-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-4-split-notes.md:58). The live baseline and complete gate commands are at [PROGRESS.md](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:284). The discriminating bundle oracle is at [CLAUDE.md](/Users/ccarpio/Developer/espansoConfig/CLAUDE.md:442).

### Q8 — Sharpest green-suite failure

**Ruling.** The sharpest green-suite failure is a production Tauri listener adapter that never delivers a real wake even though its injected fake works.

All four gates can pass while:

- the frontend fake invokes the typed callback correctly;
- Rust emits the correct event;
- the application’s real adapter targets the wrong Tauri scope, unwraps the runtime value incorrectly, or otherwise never receives delivery in WKWebView.

The consequence is the entire active push half of the protocol being inert. While the window stays focused, an external change can remain queued indefinitely until some later recovery drain such as reopen or resume. This is sharper than a cosmetic localization error because the authoritative observations exist but the running window is never told to ask for them.

The observation that catches it is one real Tauri/WKWebView delivery probe: register the production adapter, emit `workspace://reconciliation-ready` from Rust with a distinctive wake, verify the frontend callback receives the exact payload, call the returned unlisten function, emit again, and verify no second callback occurs. That belongs to later window evidence, not 2d-4b’s gate obligation.

Evidence: Rust explicitly says it cannot establish that any webview is listening at [events.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/events.rs:61). Tauri requires explicit unlisten when the listener leaves scope at [event.d.ts](/Users/ccarpio/Developer/espansoConfig/node_modules/@tauri-apps/api/event.d.ts:75). The phase consult assigns real WKWebView event observation to 2d-7 at [phase-2d-design.md](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2d-design.md:130).

Not verified: no 2d-4b implementation exists yet, so post-change gate counts and real WKWebView delivery cannot be measured; this does not change the rulings.


Codex session ID: 01a051d2-0c24-7f13-bbe3-81f98850b605
