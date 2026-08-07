# Phase 2c-4a step 3c-4 — the re-take

`docs/decisions/2c-4a-3c-4-notes.md` changes all six write surfaces again, so **a window reading is
re-taken after any change to a component**: twenty-two launches, all six surfaces, both languages, on
the instrument of `docs/decisions/2c-4a-3c-1-instrument.md`, one plan per launch into a bundle path
never used before, over a synthetic configuration rebuilt per launch.

**All twenty-two reached their own `--- end` with a zero-byte `probe.err`.** Twenty wrote nothing at
all; the two that wrote are the byte check's control and wrote exactly what was asked for.

**The owner's real configuration was never opened.** `XDG_CONFIG_HOME` points at a synthetic
four-snippet tree outside the repository and `HOME` at an empty directory, so neither candidate
`resolve_config_dir()` probes can reach it.

---

## 1. What the instrument gained, and what it cost

Three additions, all temporary and all recorded rather than folded in silently.

**1.1 A three-armed outcome classification** (`src/probe.ts`, `reportOutcome`). Every transcript in
this project before this step reported a refusal as *"not a conflict"*. That is exactly how a reading
could be taken over a surface whose refused arm carried the wrong label and say nothing about it — the
review's Medium, and the hole 3c-3's §2.2 mistook for evidence of absence. A conflict is still named
by its own *The version on disk* heading; a refusal is now named by *Nothing was written* **without**
that heading, which no committed panel draws.

**1.2 An `anyway` step** (`src/probe.ts`, `anywayStep`). It presses *Save anyway* on a refused panel
and prints the scroller's position and the panel's rectangle **before** and **after**, leaving the
scroller exactly where the application put it — the whole question being where the replacement panel
lands relative to an unmoved viewport.

**1.3 A `suspect` fixture** (`<scratch>/launch.sh`). A fourth synthetic snippet declaring
`type: notatype` raises `VariableTypeNotRecognised`, a `SuspiciousButPermitted` finding, so **every**
save of that document comes back `RefusedForUnacknowledgedSuspicions` with findings. That is the only
way a window can be driven to the mover's, the deleter's and the match editor's refused arm; the
duplicator needs none of it, because `DuplicateKeepsTriggerDefinition` is its ordinary first outcome.
The fixture asserts nothing about espanso semantics — it is a `type` value this application's own
table has no entry for.

**1.4 One instrument defect fixed, worth its own line.** The launch script's window-raising loop is a
detached subshell running `osascript … AXRaise of window 1`; when the application has just been
killed, that call blocks for about two minutes, and the script's bare `wait` paid it **every launch**.
The raiser's PID is now killed before the wait. It changes nothing the probe measures — the raise
loop's whole job is done seconds after `open` returns, well before the plan's first press — and it
took a launch from about three minutes to about twenty seconds. **L49 ran under the unfixed script
and L50–L70 under the fixed one**, so the two are directly comparable: same transcript shape, same
`--- end`, same zero-byte `probe.err`, same empty byte diff.

---

## 2. The launches

| # | Plan | Lang | Purpose | Result |
|---|---|---|---|---|
| L49 | `duplicatorconflict:en:nowriter:noscroll` | en | **the refusal arm, drawn for the first time in this project** | refused; *Leave this as it is* |
| L50 | `duplicatorconflict:es:nowriter:noscroll` | es | the Spanish twin | refused; *Dejarlo como está* |
| L51 | `moverconflict:en:nowriter:suspect:noscroll` | en | the mover's refused arm | refused; *Leave this as it is* |
| L52 | `moverconflict:es:nowriter:suspect:noscroll` | es | the Spanish twin | refused; *Dejarlo como está* |
| L53 | `deleterconflict:en:nowriter:suspect:noscroll` | en | the deleter's refused arm | refused; *Leave this as it is* |
| L54 | `deleterconflict:es:nowriter:suspect:noscroll` | es | the Spanish twin | refused; *Dejarlo como está* |
| L55 | `editorconflict:en:nowriter:suspect:noscroll` | en | **the authored-text control** — *Keep editing* must be unchanged | refused; *Keep editing* |
| L56 | `editorconflict:es:nowriter:suspect:noscroll` | es | the Spanish twin | refused; *Seguir editando* |
| L57 | `duplicatorconflict:en:nowriter:anyway:noscroll` | en | **the arm-to-arm reveal**, on the surface whose ordinary path it is | refused → saved, same node; **wrote the file** |
| L58 | `editorconflict:en:nowriter:suspect:anyway:noscroll` | en | the same, where the pane really is scrolled | refused → saved, `scrollTop` **176 → 188**; **wrote the file** |
| L59 | `rawconflict:en:reload:noscroll` | en | the conflict panel still revealed, and the second step | conflict; panel y = 111, `scrollTop` 258 |
| L60 | `rawconflict:es:reload:noscroll` | es | the Spanish twin | conflict; identical geometry |
| L61 | `editorconflict:en:reload:noscroll` | en | §10.3's own surface | conflict; panel **y = 44**, `scrollTop` 676 |
| L62 | `editorconflict:es:reload:noscroll` | es | where the panel was once wholly invisible | conflict; panel **y = 44**, `scrollTop` 727 |
| L63 | `creatorconflict:en:reload:noscroll` | en | §10.4's worst case | conflict; panel y = 44, `scrollTop` 547 |
| L64 | `creatorconflict:es:reload:noscroll` | es | the Spanish twin | conflict; panel y = 44, `scrollTop` 564 |
| L65 | `deleterconflict:en:reload:noscroll` | en | an operation surface's conflict | conflict; *Leave this as it is* |
| L66 | `deleterconflict:es:reload:noscroll` | es | the Spanish twin | conflict; *Dejarlo como está* |
| L67 | `moverconflict:en:after:reload:noscroll` | en | the mover, anchored destination | conflict; *Leave this as it is* |
| L68 | `moverconflict:es:after:reload:noscroll` | es | the Spanish twin | conflict; *Dejarlo como está* |
| L69 | `duplicatorconflict:en:reload:noscroll` | en | the duplicator's conflict | conflict; *Leave this as it is* |
| L70 | `duplicatorconflict:es:reload:noscroll` | es | the Spanish twin | conflict; *Dejarlo como está* |

Every one of the twenty-two set its language **through the picker** and printed the resulting
`documentElement.lang`, because the webview's `localStorage` follows the bundle identifier and not
`HOME` (`2c-2-2-window-reading.md` §1.2). All twenty-two agreed.

---

## 3. The refusal arm — the transcript that had never existed

`2c-4a-3c-3-notes.md` §4.3 says *"It is a sentence no window reading in this project has ever
drawn."* This is that reading. The panel is reached by an ordinary press of the surface's own control,
and every button under it is reported with its rectangle.

**L49, the duplicator, English — its documented ordinary first outcome:**

```
duplicator outcome: refused
duplicator outcome [0] p: Nothing was written. The file on disk is exactly as it was.
duplicator outcome [1] p: The result contains something that looks wrong. Saving it needs your
                          confirmation first.
duplicator outcome [2] p: What the check found:
duplicator outcome [3] ul: The duplicate keeps the same trigger definition as its source, and
                           espansoConfig cannot determine how espanso chooses between overlapping
                           definitions.
duplicator outcome buttons: 2
  button box=667,405,85x23  "Save anyway"
  button box=758,405,108x23 "Leave this as it is"
```

**L53, the deleter, English**, over the `suspect` fixture:

```
deleter outcome: refused
deleter outcome [3] ul: espansoConfig does not recognise the variable type “notatype”. A newer
                        espanso may know it.
deleter outcome buttons: 2
  button box=667,357,85x23  "Save anyway"
  button box=758,357,108x23 "Leave this as it is"
```

**L55, the match editor, English — the control that must not have moved:**

```
editor outcome: refused
editor outcome buttons: 2
  button box=667,658,85x23 "Save anyway"
  button box=758,658,83x23 "Keep editing"
```

The eight, in one table. **Every operation surface says *Leave this as it is* and every authored-text
surface says *Keep editing*, in both languages**, which is the review's Medium closed on a screen.

| # | Surface | Lang | The way out of the refusal | Panel top | `section.detail` `scrollTop` |
|---|---|---|---|---|---|
| L49 | duplicator | en | **Leave this as it is** | y = 291 | 0 (`scrollHeight` = `clientHeight` = 645) |
| L50 | duplicator | es | **Dejarlo como está** | y = 291 | 0 (nothing to scroll) |
| L51 | mover | en | **Leave this as it is** | y = 461 | 0 (nothing to scroll) |
| L52 | mover | es | **Dejarlo como está** | y = 478 | 0 (nothing to scroll) |
| L53 | deleter | en | **Leave this as it is** | y = 243 | 0 (nothing to scroll) |
| L54 | deleter | es | **Dejarlo como está** | y = 243 | 0 (nothing to scroll) |
| L55 | match editor | en | **Keep editing** | y = 544 | **176** of 821 |
| L56 | match editor | es | **Seguir editando** | y = 527 | **244** of 889 |

On the six launches whose `scrollTop` is `0`, the pane's `scrollHeight` **equals** its `clientHeight`:
there is nothing to scroll, the panel was already whole in the viewport, and the reveal correctly did
nothing. That is stated rather than presented as a reveal: only L55 and L56 have a scroller with room
to move, and both moved.

*Save anyway* is drawn on all eight and reads the same on every surface, which is the other half of
the fix: it is a claim about the save and not about what the person was doing beforehand.

---

## 4. The arm-to-arm reveal, from a window

Provokable, and provoked. `beginSave` retains the refusal in flight, so pressing *Save anyway*
replaces `refused` with `saved` over the **same** element with no `null` interval — the transition the
old single `'panel'` cue could not see.

**L58, the match editor**, on a pane that really has somewhere to scroll:

```
editor outcome: refused
editor reveal: section.detail scrollTop=176 scrollHeight=821 clientHeight=645
editor before save anyway: panel box=658,544,491x145 scrollTop=176 control box=667,658,85x23
editor after  save anyway: same node=true box=658,532,491x157 scrollTop=188 firstLineInView=true
editor after save anyway outcome: saved
  [0] The file was written. What is on disk now is exactly the text that was sent.
```

`same node=true` is the finding's own precondition on a screen: the panel element did **not** remount,
so nothing but the cue's arm identity could have re-run the effect. `scrollTop` moved 176 → 188 and
the replacing panel's first line is in view.

**L57, the duplicator**, is the same transition with nothing to scroll — `scrollHeight` = 645 =
`clientHeight` — so `scrollTop` stayed at `0` and `firstLineInView=true` throughout. It is reported
as what it is: the transition happened over the same node and the panel was already in view.

**What this does not measure**, in the same breath as what it does: a window cannot show that the
effect *would not* have run before the fix — the old cue is not in this build. That half is the
mutation in `2c-4a-3c-4-notes.md` §6.1, where collapsing the cue fails the arm-to-arm case in all six
mounted suites.

---

## 5. The conflict panel is still revealed, on all six, in both languages

Nothing here is new work; it is the re-take 3c-3's fixes are owed after the cue changed shape.
`noscroll` on every one of the twelve, so the numbers are where the **application** put things.

| # | Surface | Lang | Panel top | `scrollTop` on arrival | Confirmation control | in view |
|---|---|---|---|---|---|---|
| L59 | raw editor | en | y = 111 | 258 of 903 | `confirmReload` | **yes** |
| L60 | raw editor | es | y = 111 | 258 of 903 | `confirmReload` | **yes** |
| L61 | match editor | en | y = 44 | 676 of 1720 | `confirmReload` | **yes** |
| L62 | match editor | es | y = 44 | 727 of 1771 | `confirmReload` | **yes** |
| L63 | creator | en | y = 44 | 547 of 1354 | `confirmReload` | **yes** |
| L64 | creator | es | y = 44 | 564 of 1371 | `confirmReload` | **yes** |
| L65 | deleter | en | y = 44 | 165 of 849 | `confirmReloadClosing` | **yes** |
| L66 | deleter | es | y = 44 | 165 of 849 | `confirmReloadClosing` | **yes** |
| L67 | mover | en | y = 44 | 425 of 1126 | `confirmReloadClosing` | **yes** |
| L68 | mover | es | y = 44 | 442 of 1143 | `confirmReloadClosing` | **yes** |
| L69 | duplicator | en | y = 44 | 284 of 968 | `confirmReloadClosing` | **yes** |
| L70 | duplicator | es | y = 44 | 284 of 968 | `confirmReloadClosing` | **yes** |

3c-2's §10.3 measured the match editor's panel at **y = 720** in English and **y = 771** in Spanish
with `scrollTop` at `0`. It is at **y = 44** in both now, and the second step's `scrollTop` moves again
(676 → 1106 in English, 727 → 1157 in Spanish) so the confirmation control is in view at the moment it
appears. §10.3 and §10.4 stay closed.

Four other behaviours re-checked and unchanged: the conflict choice labels branch by draft kind
(*Keep editing* / *Copy my text* on the raw editor, *Leave this as it is* and no copy control on the
three operation surfaces); the confirmation label branches the same way
(`confirmReload` / `confirmReloadClosing`); the raw editor stays **open** after a confirmed reload and
the five match surfaces **close**; and no launch produced a `.espansoconfig-backups` directory.

---

## 6. The bytes

Every tree was compared **whole** against a pristine copy taken before its own launch.

- **Twenty launches: no difference at all beyond the second writer's own line.** In the twelve
  conflict launches the only entry is `> # a second writer reached this file` — the external process's
  append — and in the eight refusal launches there is no difference whatsoever. **No
  `.espansoconfig-backups` directory existed in any of the twenty**, which is the strongest available
  statement that the transaction never reached its write.
- **Two launches wrote, and wrote exactly what was asked.** L57's duplicate cloned the first snippet's
  own runs immediately after it — its leading comment, its `trigger`, its `|` block body and its
  `label`, byte for byte, 304 → 450 bytes — and L58's edit added the single line `probe edit` inside
  the existing block scalar, 402 → 419 bytes. Both left a backup directory, which is what a committed
  save owes. These are the byte check's control: a check that never sees a write cannot say it would
  have noticed one.
- **The pasteboard was seeded with a per-launch sentinel and read back after `--- end` and again after
  exit.** No launch changed it; no launch pressed a copy control.

---

## 7. The verdict

| Finding | Where | Closed | Evidence |
|---|---|---|---|
| Review **Medium** — the refused arm labels an operation as editing | `rawSave.ts:152` | **yes** | L49–L54 draw *Leave this as it is* / *Dejarlo como está*; L55–L56 keep *Keep editing* / *Seguir editando* |
| Review **Low 1** — the cue does not distinguish arm replacement | `reveal.ts:73` | **yes** | L58: same node, `scrollTop` 176 → 188, first line in view; L57 the same transition with nothing to scroll. The counterfactual is the mutation, notes §6.1 |
| Review **Low 2** — the pure reveal rule sits in the renderer layer | `reveal.ts:33` | **yes** | not a window question: `outcomeReveal` is in `src/lib/browser/saveOutcome.ts`, `OutcomeArm` is derived from `SaveOutcomeModel`, and the twelve conflict launches show the behaviour is unchanged |
| **O1** — `reloadUnavailable` says *Keep editing* on all six | `en.json`/`es.json`, six components | **yes, without a window transcript** | see §8 |
| 3c-2 §10.3 — the panel below the fold | six surfaces | **stays closed** | L59–L70 |
| 3c-2 §10.4 — the confirmation control pushed out | six surfaces | **stays closed** | L59–L70, `inView=true` on all twelve |
| 3c-2 §10.1, §10.2, §10.5 | — | **stay closed** | unchanged by this step; re-observed in L59–L70 |

---

## 8. What this reading does **not** cover

1. **`browser.saveOutcome.reloadUnavailable*` was not drawn, and cannot be.** The sentence appears
   for a `DiskAdoptionOutcome` of `refused`, and `BrowserState.adoptDiskVersion` answers `refused`
   only for a conflict the window did not register, an unprojected document, or a projection
   generation that has moved — and **no control on a conflict panel can move a projection
   generation**. `rg` over all twenty-two transcripts finds neither sentence, in either language,
   which is the expected result rather than a gap in the plans. Both are covered by the six mounted
   suites, which script the adoption answer directly. **This is stated plainly rather than dressed up
   as coverage.**

   > **Correction (2c-4a-3c-5), the confirmation pass's Medium.** The word *only* above is false by
   > inspection: `BrowserState.adoptDiskVersion` has **five** refusal returns, not three
   > (`src/lib/browser/workspace.svelte.ts:1768–1811`) — (1) the confirmation was issued for another
   > conflict, so `authorizeDiskAdoption` answers `null`; (2) the confirmation has already been
   > spent through that state; (3) that state never registered the conflict, or the origin
   > `rememberTheConflict` recorded names a different document from the payload's; (4) the document
   > is no longer projected there; (5) that projection's generation has moved since the conflict
   > arrived. The two omitted guards are precisely the two a *caller* supplies, so the list as
   > written described the window's reach and not the method's.
   >
   > **The conclusion — that neither sentence is reachable through the current window controls —
   > stands, and the argument is separate from the list.** No control can pair a confirmation with
   > another conflict or present a spent one, because `reloadConfirmed` mints it from the conflict
   > the session is showing, `DetailPane.svelte:219–224` forwards the two together and retains
   > neither, each surface mints and spends in one synchronous expression, and the spend leaves the
   > `confirmed` step in the same handler — after which `offeredReloadStep` returns `unavailable`
   > and no reload label is named. Every conflict a surface can show arrived through one of the six
   > writing wrappers, each of which calls `rememberTheConflict`. And no control drawn while a
   > conflict panel owns the interaction removes or replaces a projection: the one control that
   > calls `BrowserState.rereadDocument` — `reloadFile`, on the mover and the duplicator — is
   > offered only from `session.sendFailure`, which a conflict outcome does not set.
   >
   > **The coverage limit is unchanged and is not strengthened by this correction.** The argument is
   > about the controls this window draws, not a proof that a reprojection begun before the panel
   > appeared cannot land while it is open — guard 5 exists for that case. The six mounted suites
   > script the adoption answer directly and so do not establish which guard produced it, and the
   > twenty-two launches remain evidence about those launches. The full version of this correction
   > is `2c-4a-3c-4-notes.md` §2.4; the production JSDoc on `reloadUnavailableKey` carried the same
   > false *only* and is corrected in the same round, whose record is `2c-4a-3c-5-notes.md` §1.
2. **The mover's and the deleter's refused arm needed a synthetic hazard to reach.** `suspect` is an
   instrument fixture (§1.3): those two surfaces have no refusal of their own the way the duplicator
   does. What the transcript therefore proves is that *when* a refusal with findings is drawn there,
   its way out is labelled correctly — not that a person will meet one.
3. **Nothing measured how the movement feels.** Every rectangle is at 1180 × 728, the reveal is
   instant by construction, and whether the jump is disorienting at other window sizes is a question
   no transcript answers. Unchanged from 3c-3.
4. **`HTMLElement.click()` carries no user activation.** Unchanged from every reading in this phase;
   it matters only for the clipboard, and no launch here pressed a copy control.
5. **Two launches wrote to their own synthetic tree.** That is deliberate and is §6's control. Neither
   is a claim about a file the owner has.
