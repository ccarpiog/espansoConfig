# Phase 2d-6-9b-3 — entry 15 enforced on the coordinator's automatic reread

**Status: implemented and reviewed** (`ship-with-fixes`, 0 blockers, 1 SHOULD-FIX fixed; §8).
Risk class: **high**. This is the corrective sub-phase the orchestrator ruled at 9b-2
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, the 9b-3 bullet; [`2d-6-9b-2-notes.md`](2d-6-9b-2-notes.md) §3),
closing the gap [`2d-6-9b-1-notes.md`](2d-6-9b-1-notes.md) §6 item 1 measured.

In short:
- While a file is under an uncertainty hold, the coordinator's automatic reread is **refused**: at the
  request (no `reload_document` is sent) and again immediately before the installation.
- The refused observation is **registered** through the window's own arbitration, so the `stale` file
  has an origin to acknowledge. Acknowledge, then read the file again: that is the exit.
- **The manual `requestFileReread` path is unchanged**, and so is `rereadDocument`.
- Two route sentences, EN and ES, corrected to what the code now does. **No new dictionary key.**
- **No Rust changed.**

Abbreviations: `W` — `src/lib/browser/workspace.svelte.ts`; `OT` — `src/lib/browser/observationTransitions.ts`;
`RS` — `src/lib/browser/reconciliationStatus.ts`.

---

## 1. What changed

| File | Change |
|---|---|
| `OT` | `ReconciliationWorkspace.rereadUnderGuard` gains a fourth parameter, `observation: ExternalConflictObservation \| null` (orchestrator ruling (1) at 1b's close permits widening the interface as entries require). `applyChange` passes `externalConflictObservationOf(route)`. The member's doc and `ObservationOutcome`'s `'reread'` doc now say the host may refuse |
| `W` | The host's `rereadUnderGuard` member: after the `stale` mark (unchanged), a held file is refused before the read and the observation registered; otherwise the private helper runs with a guard that, after the caller's guard, asks the hold again and registers on a refusal. New private `takeInObservation` — the barrier-or-arbitrate body of `observeExternalChange`, which now calls it. `arbitrateAndDeliver`'s doc names the new caller |
| `RS` | `RouteControlNote`'s doc: the route's exits are now three, a further observed change first |
| `src/lib/browser/conflictSource.ts` | `ExternalChangeConflictSource.kind`'s doc: an external origin can now arise with no surface open (entry 41) |
| `src/lib/i18n/en.json`, `es.json` | Two sentences corrected (§3). No key added or removed |
| `src/lib/browser/workspace.test.ts` | A new nested suite, *entry 15 on the coordinator's automatic reread — Phase 2d-6-9b-3*: 5 cases (§2) |
| `src/lib/components/ReconciliationStatus.test.ts` | A new per-locale suite: 1 case × EN, ES (§4) |
| `src/lib/i18n/reconciliationStatusCodes.test.ts` | The route sentence's literal pin updated; the two 9b-1 wording cases rewritten in place for the new truth (§3) |
| `docs/decisions/2d-6-split-notes.md` | The 9b-3 bullet says it is implemented, where, and names §6 item 1 |

### The mechanism, in order

In the host member (`W`, the coordinator-facing `rereadUnderGuard`):
1. `owns()` → the `stale` mark, exactly as before.
2. `arrival` = the file's projection generation, taken here, before any read.
3. **Request-time refusal.** `uncertainWrites.has(document)` → register the refused observation and
   return. No command is sent.
4. Otherwise the private `rereadUnderGuard(document, guard')`, where `guard'` asks the caller's guard
   first and then the hold; a held file is registered and refused (`false`). The private helper's own
   `stillCurrent()` still follows the guard, then `installView`.

**Registration** (`registerTheRefused`) is fenced by `owns()` asked again, then calls
`takeInObservation(document, observation, arrival)`: held behind the barrier if a write is out,
otherwise `arbitrateAndDeliver` — so ruling 25 (coalescing on identical bytes) and the standing
external origin's sequence (`notLater`) still decide whether the observation becomes the file's origin.
With the hold standing, a fresh observation arbitrates to `raisedWithoutReload`, and `arbitrateHere`
registers it through `rememberTheConflict` **after** the `stale` mark, so `conflictStatusWrites`
records a count that includes the mark (9b-1's clear rule for `adoptDiskVersion` is unaffected).

**Why the refusal is the hold alone and not `decideAutomaticReload`.** The ruling is about the
uncertainty hold. Asking the whole predicate would also refuse on `observationRetained`, a behaviour
change the ruling did not make (§6 item 3). `surfaceOpen` is already the transition's own question
(`tellTheSurfaceAbout`), asked with the same predicate.

## 2. The model cases, and the failures before the fix, verbatim

Suite: `workspace.test.ts` › *what a conflict does to this window, and what only a confirmed reload
does* › *entry 15 on the coordinator's automatic reread — Phase 2d-6-9b-3*. Each case starts a real
`BrowserState` with a scripted wake transport, opens, and drains one `Changed` observation of
`match/base.yml` on a wake.

| Case | Shows | Before the fix |
|---|---|---|
| (a) *refuses the automatic reread under an uncertainty hold, sending no reload and installing nothing* | the refused reread | **fails** |
| (b) *registers the refused observation as the file's acknowledgeable origin, and acknowledging it opens the reread* | the registered origin, the manual refusal under the hold, the exit | **fails** |
| *lets a further observed change replace an outlived origin on the route, so the acknowledgement is offered again* | the new truth of the route's exits note (§3) | **fails** |
| *installs nothing when the hold is established while the automatic read is out* | the race of §6 item 1, pinned | passes before and after |
| *still rereads and installs on the automatic path when no hold stands* | the clean path is not narrowed | passes before and after |

**The first run**, against a `W` with no change at all (only `OT`'s interface widened, which the host
ignored): `Tests  3 failed | 1 passed | 375 skipped (379)`. (a) and (b) failed with:

```
 FAIL  src/lib/browser/workspace.test.ts > what a conflict does to this window, and what only a confirmed reload does > entry 15 on the coordinator’s automatic reread — Phase 2d-6-9b-3 > refuses the automatic reread under an uncertainty hold, sending no reload and installing nothing
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times

Received:

  1st vi.fn() call:

    Array [
      2,
    ]


Number of calls: 1

 ❯ src/lib/browser/workspace.test.ts:13063:43
```

```
 FAIL  src/lib/browser/workspace.test.ts > what a conflict does to this window, and what only a confirmed reload does > entry 15 on the coordinator’s automatic reread — Phase 2d-6-9b-3 > registers the refused observation as the file’s acknowledgeable origin, and acknowledging it opens the reread
AssertionError: expected undefined to be 'externalChange' // Object.is equality

- Expected:
"externalChange"

+ Received:
undefined

 ❯ src/lib/browser/workspace.test.ts:13089:28
```

The third case of that first run was a first draft of the race case expecting a registration at the
installation. It failed the same way (`expected undefined to be 'externalChange'`) and, measured, it
**kept failing after the fix**: §6 item 1 says why, and the case was rewritten to pin what really
happens.

**The second run**, after the fix was written, with both hold checks of the host member replaced by
`false` (the unfixed behaviour, reproduced in place and restored byte-for-byte from a copy; no git
command was used): `Tests  5 failed | 2 passed | 406 skipped (413)` across both suites. Besides (a) and
(b) as above, the outlived-origin case failed with:

```
 FAIL  src/lib/browser/workspace.test.ts > what a conflict does to this window, and what only a confirmed reload does > entry 15 on the coordinator’s automatic reread — Phase 2d-6-9b-3 > lets a further observed change replace an outlived origin on the route, so the acknowledgement is offered again
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
 ❯ src/lib/browser/workspace.test.ts:13182:43
```

(The file-wide `afterEach` also reported `expected 1 to be +0` for the undisposed state each failing
case left behind; that is a consequence of the failure, not a second defect.)

**Each half proved necessary on its own.** With the refusal kept and the registration removed, (b)
and both mounted cases failed (`expected undefined to be 'externalChange'`; the route lacked *"The
disk snapshot this acknowledgement is about:"* / *"La instantánea del disco a la que se …"*), while (a)
passed. With the request-time refusal removed, (a) and both mounted cases failed on the
`reload_document` count.

### The manual path is unchanged

`requestFileReread` and `rereadDocument` call the private helper directly and never pass through the
host member; neither body was edited. Evidence: case (b) asserts the manual request under the hold
still answers `{ kind: 'refused', reason: 'uncertaintyUnresolved', at: 'request' }` with no command,
and `completed` after the acknowledgement; every existing 2d-6-1c case of `requestFileReread`
(*refuses the reread at the request under each of the three per-file holds, sending nothing*, the
installation re-ask cases, the key-getter case) passes unmodified.

## 3. The wording — two sentences corrected, EN and ES

Both are claims this phase changed the truth of (entry 41), in the route's own keys. **The new
Spanish has had no bilingual review** (R35), like 9a's, 9b-1's and 9b-2's.

1. **`browser.externalConflict.route.writeOutcomeUnknown`.** 9b-1 removed *"this window does not read
   the file again on its own"* because it was measured false. It is true again in substance, so a
   clause is restored, worded about **loading an observed change** rather than reading the file (the
   raw viewer still reads its own text):
   - EN: *"… has closed. While this stands, a change observed on disk is not loaded into this window on
     its own."*
   - ES: *"… se ha cerrado. Mientras siga así, un cambio observado en el disco no se carga en esta
     ventana por su cuenta."*
2. **`browser.reconciliation.route.projectionReplacedExits`.** On the route a further observation is
   now an exit (refused, registered at the current generation, acknowledgeable):
   - EN: *"Acknowledging stays unavailable here until a further change to this file is observed, a later
     write to this file from this window ends with a known outcome, or the workspace is reloaded."*
   - ES: *"Aquí el reconocimiento seguirá sin estar disponible hasta que se observe otro cambio en este
     archivo, una escritura posterior en este archivo desde esta ventana termine con un resultado
     conocido o se recargue el espacio de trabajo."*
   "Until", never "when": nothing forces a further change to happen (§6 item 2).

Neither sentence uses *automatically*/*automáticamente*, *newer*/*más reciente* or any other form
the forbidden-claim scans hold; both keys were already in `BOUNDED_KEYS`. In
`reconciliationStatusCodes.test.ts` the literal pin is updated, *pin the exits note* now asserts an
observation **is** named, and the 9b-1 case *never claim … on its own* became *say on the route that
an observed change is not loaded on its own while the outcome is unknown* (and that neither locale
says *read* / *leer*).

## 4. The route and acknowledgement drawn for the new origin, mounted

`ReconciliationStatus.test.ts` (jsdom by docblock; its invoke guard at exact zero already declared) gains
*an automatic reread refused under the hold, and its exit, in %s — Phase 2d-6-9b-3*, one case per
locale over one real `createBrowserState` with the status, sidebar and pane mounted:
- an uncertain raw save of `match/b.yml`, then a wake draining a `Changed` of it;
- **refused**: no `reload_document`, the hold stands;
- **the route** draws the unknown-outcome sentence, *the disk snapshot this acknowledgement is about*,
  the refused observation's disk text (`:disk`), and an **enabled** acknowledgement;
- **the pane and the row** draw `stale`, the reread **disabled** with the `uncertaintyUnresolved`
  refusal;
- the acknowledgement press calls **no command** (every count unchanged) and ends the hold; the route
  sentence goes and the pane's reread becomes enabled;
- the reread press sends exactly one `reload_document(2)`, and `stale` leaves the pane and the row.

No component changed: `FileReconciliationStatus.svelte` already draws the standing origin's snapshot
beside the acknowledgement, and the new origin is a standing origin like any other.

## 5. What none of this shows

A window. 2d-6-9c reads the enforced behaviour over its hard fixture; it should include this state
(route acknowledgement, then the pane's reread).

## 6. Open items (not fixed here, `CLAUDE.md` §7)

1. **A dead end this phase does not close: a hold established while the automatic read is out, by a
   write whose re-adoption replaced the projection.** A may-have-written failure re-adopts the file;
   when that re-adoption installs a parse (a raw save's `adoptTheReplacedDocument`, or
   `adoptTheDocumentOnDisk` whose `get_document` succeeded), the private helper's projection capture
   refuses the answer *before* the host's hold recheck is asked. Nothing is installed over the hold
   (entry 15 holds), but no origin is registered: the file is left `stale`, held, with no
   acknowledgeable origin — the reread refused `uncertaintyUnresolved`, no acknowledgement offered
   (`noStandingOrigin` draws no control). Exits: a later write ending on a named revision, `open()`,
   or a further observation (which is now refused and registered). The same shape arises when a
   surface opens and closes during the read (the registry-generation refusal marks `stale` and
   registers nothing). Pinned by *installs nothing when the hold is established while the automatic
   read is out* (a raw save) so a fix has to move it. Registering at that point would need a
   generation the observation never arrived at, which is what `adoptDiskVersion`'s generation check
   exists to refuse — a ruling, not a patch. **When the re-adoption's `get_document` fails** the
   projection is not replaced and this is not a dead end: the installation-time recheck refuses and
   registers (§8).
2. **Coalescing still decides.** A refused observation whose disk revision equals an *outlived*
   standing origin's coalesces into it (ruling 25) and registers nothing, so that origin stays
   `projectionReplaced`. The exits note says "until", so it promises nothing; recorded because the
   ruling's words were "registered as an acknowledgeable origin".
3. **`observationRetained` is still not asked on the automatic path**; only the hold is.
   `decideAutomaticReload` remains asked only by `requestFileReread`. Out of the ruling's scope.
4. **The installation-time hold recheck is reached** exactly when the write that established the hold
   left the projection unchanged — `adoptTheDocumentOnDisk`'s `get_document` failed on the
   re-adoption (§8). When the re-adoption installed a parse, the projection capture refuses first
   (item 1). This item said the recheck was reached by no case; the review showed that was false.
5. **A stale sentence noticed, not fixed**: the host member's doc in `W` still ends *"Nothing draws
   either today; 2d-6 does."* about the `stale` mark, which 9b-1 draws.
6. **Carried unchanged**: 9b-2 §6 items 1-3 and 5; the bilingual review of 9a's, 9b-1's, 9b-2's and now
   this step's two corrected Spanish sentences; 9b-1 §8.3's release-path sequence.

## 7. Verification

Each gate was run on its own, output redirected to a file and read from it. The tree includes the
uncommitted instrument. No Rust changed, so no Cargo gate is owed.

| Command | Exit | Evidence |
|---|---|---|
| `npm test` | 0 | **3365 passed**, 69 files (after the fix round, §8) |
| `npm run check` | 0 | **457 files**, 0 errors, 0 warnings |
| `npm run build` | 0 | **200 modules** |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | nothing found (server-only oracle absent) |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2` (client-only oracle present) |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)`, unchanged |

**New rung: `1323 / 457 / 3365 / 200`**, with the instrument in the tree (previous `1323 / 457 / 3357 / 200`; `3364` before the fix round).

| Figure | Change | Per file |
|---|---|---|
| Rust tests | unchanged | no Rust touched |
| svelte-check files | unchanged | no file added |
| vitest tests | **+8** | `workspace.test.ts` **+6** (the new suite, one case added by the fix round); `ReconciliationStatus.test.ts` **+2** (1 case × 2 locales); `reconciliationStatusCodes.test.ts` **±0** (two cases rewritten in place) |
| Vite modules | unchanged | no module added; the changes are inside modules already bundled |

Only read-only git commands were run (`status`, `diff --stat`). No commit, no stash; `PROGRESS.md` and
`PROGRESS.json` were not edited by this step, and none of the four instrument paths was touched.

## 8. Review fix — `docs/reviews/phase-2d-6-9b-3.md`

**`ship-with-fixes`, 0 BLOCKERS, 1 SHOULD-FIX.**

**Finding.** The host member's comment in `W` and §6 items 1 and 4 claimed the installation-time hold
recheck was unreachable, because a hold established during the read always replaces the projection
first. **Re-derived from the code, it is reachable**: in the may-have-written arm of the wrappers that
re-adopt through `adoptTheDocumentOnDisk` (edit, delete, move, duplicate, create), a failed
`get_document` returns before `installView`, so the projection generation does not move; the lease's
`close()` still adds the file to `uncertainWrites`; the automatic read answering afterwards passes
`stillCurrent()` and reaches `guardAndHold`, which refuses and registers.

**Resolution.**
- New case in `workspace.test.ts`: *refuses the installation and registers the observation when the
  hold is established during the read with the projection unchanged* — a may-have-written
  `deleteMatch` whose re-adoption `get_document` fails, then the held automatic read answers. It
  asserts nothing installed, `stale`, the observation (sequence 1) standing, and an eligible
  acknowledgement. With the installation-time recheck disabled it failed:

```
 FAIL  src/lib/browser/workspace.test.ts > what a conflict does to this window, and what only a confirmed reload does > entry 15 on the coordinator’s automatic reread — Phase 2d-6-9b-3 > refuses the installation and registers the observation when the hold is established during the read with the projection unchanged
AssertionError: expected [ 77 ] to deeply equal [ 10, 11 ]
 ❯ src/lib/browser/workspace.test.ts:13189:65
```

  It passes with the recheck restored.
- The host member's comment in `W` now states both branches (projection replaced → the capture
  refuses, nothing registered; projection unchanged → the recheck refuses and registers).
- §6 items 1 and 4 corrected to the same effect.

**Gates after the fix** (each alone, redirected, grepped): `npm test` exit 0, **3365 passed**, 69 files;
`npm run check` exit 0, 457 files, 0 errors, 0 warnings; `npm run build` exit 0, 200 modules. **Rung
`1323 / 457 / 3365 / 200`** (+1 test, `workspace.test.ts`).
