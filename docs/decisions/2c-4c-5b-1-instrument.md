# Phase 2c-4c step 5b-1 — the instrument extension, and the measurement it was built to take

**This record reports numbers. It reaches no verdict**, and the judgement it exists to enable —
whether the geometry it measures costs a person anything — belongs to step 5b-2 and is deliberately
not taken here.

---

## 1. Why the instrument grew during a fix round

`docs/reviews/phase-2c-4c-5-reading.md` returned **NOT READY** on three Highs. The first is this
step's subject: `docs/decisions/2c-4c-5-window-reading.md` §3.2 classified finding **M2** — the
`491x0` border box `section.recovery` reports — as *latent, inferred, never constructed*, on the
premise that the host surface's outcome panel was `null` in every state those launches reached.

The review established that the premise is false, and the check is in the source:

- `conflictOf()` (`src/lib/browser/matchEditor.ts:1078`) reads a conflict **out of** `session.outcome`,
  so a session showing one has a non-null outcome;
- `describeEditSave` sets that outcome for every non-saved result (`matchEditor.ts:1522`, `:1525–1530`);
- `attemptOfReapply` returns the **held** session unchanged for `manualResolution`
  (`src/lib/browser/reapply.ts:540–547`), which is the arm P27–P34 all printed;
- both creating hosts draw the host outcome panel as the sibling immediately after `<RecoveryPanel>`
  (`src/lib/components/MatchEditor.svelte:895–912`, `MatchCreator.svelte:779–795`).

So the state was constructed and the instrument did not measure it. Two things no retained artifact
from P27–P53 could answer: what rectangle that sibling occupied while the recovery form was open, and
whether a **pointer** could reach anything on the form — `HTMLElement.click()` bypasses hit testing
(`2c-4b-3b-instrument.md` §8.3), so every programmatic press in this harness's history succeeding is
not evidence about reachability.

**No production source was changed by this step.** The extension lives entirely in `src/probe.ts`,
which is untracked and is deleted with the rest of the harness at step 6.

---

## 2. What the extension is

One new reporter, `reportRecoveryGeometry()` in `src/probe.ts`, plus four helpers it composes and one
extraction. It is called from `driveRecoveryForm` on the line **immediately after**
`reportRecoveryForm` returns — that is, with the form open, before anything on it is typed into and
before any control on it is pressed, so no act of the plan can have moved the layout being recorded.

| Added | What it does |
|---|---|
| `scrollerOf(element)` | The nearest ancestor that really scrolls, by computed `overflow-y`. **Extracted** from `reportReach`, which had held the walk inline since 3c-2 §1.2(2), so both callers ask one question. `reportReach`'s behaviour is unchanged. |
| `describeElement(element)` | `tag=… class="…" role=…`. Structural naming, so an unexpected element is **named** rather than reported as the expected one being absent. |
| `hitTestOf(control)` | The control's centre, then `document.elementFromPoint` at it. Six cases: `isTheControl`, `containsTheControl`, `descendantOfTheControl`, `somethingElse` (the covering element is named), `nullAtPoint`, `outsideViewport`. |
| `boxStyleOf(element)` | Computed `display`, `overflow`, `overflow-y`, `flex`, `min-height`, `height`, `position`. |
| `formControlsIn(scope)` | `button, input, select, textarea` in document order — wider than the existing `buttons()`, because a covered `<textarea>` is the same defect as a covered button. |

The five measurements it prints, all scoped to `RECOVERY_SURFACE` (`section.recovery`) for that
constant's standing reason — the host surface has status panels of its own, and the covering element
this is looking for **is** a host element:

1. **`section.recovery`'s `nextElementSibling`** — found structurally, never by string — with its
   tag, class, `role`, rectangle, text and a hit test of its first control.
2. **The section's own child elements**, each with its rectangle, plus the extent they occupy and the
   section's `scrollHeight`/`clientHeight`.
3. **The scroller's** `scrollTop`, `scrollHeight`, `clientHeight` and box, with the form open. The
   restore discipline is kept: `scrollTop` is read and written back. Nothing in this reporter scrolls,
   so that write is a no-op today; it is there so a line added later cannot leave the pane moved.
4. **A real hit test of every control the form draws**, and of the sibling's first control.
5. **The computed box properties** of the section, its **layout** parent and its `offsetParent`.

It is inert when the form is not open (the trigger box is the test; its absence prints one line and
returns) and it cannot throw — every reporter runs inside one `try` whose `catch` prints the failure
as an ordinary transcript line, because a throw would reach `startProbe`'s handler and turn a measured
launch into `--- failed`.

---

## 3. The launches

Eight, **P54–P61**, in `/private/tmp/espansoconfig-harness-2c-4c/launches/`. Four cases in both
languages. The conjunction below was applied by hand to every launch, because `launch.sh` conjoins
none of its checks.

| Launch | Case | Lang | `--- end` | `--- failed` | `probe.err` | `bytes` | Conjunction |
|---|---|---|---|---|---|---|---|
| P54 | `editor-recovery-create` | en | 1 | 0 | 0 bytes | MATCH | PASS |
| P55 | `editor-recovery-create` | es | 1 | 0 | 0 bytes | MATCH | PASS |
| P56 | `editor-recovery-refused` | en | 1 | 0 | 0 bytes | MATCH | PASS |
| P57 | `editor-recovery-refused` | es | 1 | 0 | 0 bytes | MATCH | PASS |
| P58 | `editor-recovery-conflict` | en | 1 | 0 | 0 bytes | MATCH | PASS |
| P59 | `editor-recovery-conflict` | es | 1 | 0 | 0 bytes | MATCH | PASS |
| P60 | `creator-recovery-create` | en | 1 | 0 | 0 bytes | MATCH | PASS |
| P61 | `creator-recovery-create` | es | 1 | 0 | 0 bytes | MATCH | PASS |

Every launch prints 28 `recoveryGeometry` lines. Every launch prints
`--- viewport 1180x728 dpr=2 hasFocus=false visibility=hidden` and
`recoveryEntry arm=browser.reapply.manualResolution` — the arm that opens recovery, and the arm P27–P34
printed. Every `bytes.txt` names binary digest `a4d86645…`, which differs from the `fcc9c3ac…` that
P27–P53's `bytes.txt` files name. That is a comparison between retained artifacts and nothing more; see
§7.

**No launch was discarded.** P54–P61 are every launch this step took, and this sentence is the worker's
own statement — no artifact retains it, because no artifact can.

---

## 4. Measurement 1 — the host outcome sibling's rectangle

`section.recovery.nextElementSibling` was **present in all eight launches**, and in all eight it was a
`div` carrying `role="status"` and the host component's scoped class — `panel svelte-1i7fzq8` on the six
editor launches, `panel svelte-g3zdg1` on the two creator launches. Its text in every launch is the
host conflict sentences and the three revision hashes.

Boxes are `x,y,WxH` in CSS pixels, viewport-relative, as `box()` prints them.

| Launch | `section.recovery` box | Sibling box | Sibling's vertical span |
|---|---|---|---|
| P54 `editor-recovery-create` en | `658,158,491x0` | `658,165,491x1032` | y 165 → 1197 |
| P55 `editor-recovery-create` es | `658,174,491x0` | `658,181,491x1094` | y 181 → 1275 |
| P56 `editor-recovery-refused` en | `658,158,491x0` | `658,165,491x1032` | y 165 → 1197 |
| P57 `editor-recovery-refused` es | `658,174,491x0` | `658,181,491x1094` | y 181 → 1275 |
| P58 `editor-recovery-conflict` en | `658,158,491x0` | `658,165,491x1032` | y 165 → 1197 |
| P59 `editor-recovery-conflict` es | `658,174,491x0` | `658,181,491x1094` | y 181 → 1275 |
| P60 `creator-recovery-create` en | `658,175,491x0` | `658,182,491x829` | y 182 → 1011 |
| P61 `creator-recovery-create` es | `658,192,491x0` | `658,199,491x873` | y 199 → 1072 |

The sibling's top is **7 px below the section's top in every launch**, and the two share the same x
extent (658 → 1149).

Its first control is the host conflict panel's *Keep editing* / *Seguir editando*:

| Launch | Sibling's first control | Box | Centre | Hit case |
|---|---|---|---|---|
| P54 | `Keep editing` | `667,1167,83x23` | 709,1178 | `outsideViewport` |
| P55 | `Seguir editando` | `667,1217,101x23` | 718,1228 | `outsideViewport` |
| P56 | `Keep editing` | `667,1167,83x23` | 709,1178 | `outsideViewport` |
| P57 | `Seguir editando` | `667,1217,101x23` | 718,1228 | `outsideViewport` |
| P58 | `Keep editing` | `667,1167,83x23` | 709,1178 | `outsideViewport` |
| P59 | `Seguir editando` | `667,1217,101x23` | 718,1228 | `outsideViewport` |
| P60 | `Keep editing` | `667,980,83x23` | 709,991 | `outsideViewport` |
| P61 | `Seguir editando` | `667,1014,101x23` | 718,1025 | `outsideViewport` |

`outsideViewport` here means the centre's `y` exceeds the 728-pixel viewport height, so no point was
tested. It is a statement about the sampled scroll position, not about covering.

---

## 5. Measurement 2 — the recovery form's own children and their extent

**Ten child elements in every launch**, in the same order on both surfaces: `div.head`, two `p.kind`,
`h4`, `ul.transfer`, `div.field`, `p.kind`, `div.field`, `div.field`, `div.actions`.

| Launch | Children | Extent (top → bottom) | Extent height | `section.scrollHeight` | `section.clientHeight` |
|---|---|---|---|---|---|
| P54 | 10 | 158 → 1159 | 1001 | 1001 | 0 |
| P55 | 10 | 174 → 1210 | 1035 | 1035 | 0 |
| P56 | 10 | 158 → 1159 | 1001 | 1001 | 0 |
| P57 | 10 | 174 → 1210 | 1035 | 1035 | 0 |
| P58 | 10 | 158 → 1159 | 1001 | 1001 | 0 |
| P59 | 10 | 174 → 1210 | 1035 | 1035 | 0 |
| P60 | 10 | 175 → 1176 | 1001 | 1001 | 0 |
| P61 | 10 | 192 → 1227 | 1035 | 1035 | 0 |

The children's extent height equals the section's `scrollHeight` in all eight, while the section's
border box height and `clientHeight` are both zero. The children start at the section's own `y` and
continue **past** the sibling's top in every launch: the sibling begins 7 px below the section's top,
and the children continue for a further 994 (English) or 1028 (Spanish) pixels below that point.

P54's children, as the shape all eight share:

```
child[0] div.head        658,158,491x27
child[1] p.kind          658,192,491x51
child[2] p.kind          658,250,491x85
child[3] h4              658,347,491x17
child[4] ul.transfer     658,371,491x349
child[5] div.field       658,727,491x107
child[6] p.kind          658,842,491x51
child[7] div.field       658,900,491x78
child[8] div.field       658,985,491x140
child[9] div.actions     658,1133,491x27
```

---

## 6. Measurement 3 — the scroller with the form open

The scroller found by computed `overflow-y` was `div.detail` (class `detail svelte-11my561`) in all
eight launches, box `644,44,536x645` in all eight — visible rows y 44 → 689.

| Launch | `scrollTop` | `scrollHeight` | `clientHeight` | Max `scrollTop` |
|---|---|---|---|---|
| P54 | 666 | 1819 | 645 | 1174 |
| P55 | 735 | 1966 | 645 | 1321 |
| P56 | 666 | 1819 | 645 | 1174 |
| P57 | 735 | 1966 | 645 | 1321 |
| P58 | 666 | 1819 | 645 | 1174 |
| P59 | 735 | 1966 | 645 | 1321 |
| P60 | 584 | 1716 | 645 | 1071 |
| P61 | 601 | 1784 | 645 | 1139 |

**One derivation, with its assumption named.** Mapping a viewport `y` to a scroller-content offset as
`y − 44 + scrollTop` assumes the scroller has no border and no transform above it; that assumption is
not measured. Under it, the lowest retained bottom edge maps onto `scrollHeight` **exactly** in every
launch — the sibling's bottom on the six editor launches (P54: 1197 − 44 + 666 = 1819 = `scrollHeight`;
P55: 1275 − 44 + 735 = 1966), and the recovery children's bottom on the two creator launches
(P60: 1176 − 44 + 584 = 1716; P61: 1227 − 44 + 601 = 1784). Eight exact closures is a consistency check
on the mapping, not a proof of it.

Under the same mapping, `scrollHeight − clientHeight` equals the maximum `scrollTop`, at which the
visible band is `[scrollHeight − 645, scrollHeight]` — so the lowest retained edge lies inside the
scrollable extent in all eight launches. **Whether a person scrolls there is not measured.**

---

## 7. Measurement 4 — the hit tests

**Seven controls on the form in every launch**, in the same order on both surfaces: the close button,
the destination button, the trigger `input.text`, the replacement `textarea.text.body`, *Undo*, *Redo*,
and the create button.

**The close button is the only one of the seven whose centre fell inside the viewport in any launch,
and in all eight launches `document.elementFromPoint` at that centre returned `somethingElse` — the
host outcome panel `div[role="status"]`.**

| Launch | Close control | Box | Centre | Hit case | Element found |
|---|---|---|---|---|---|
| P54 | `Stop creating this snippet` | `967,158,182x27` | 1058,171 | `somethingElse` | `div.panel svelte-1i7fzq8 role=status` |
| P55 | `Dejar de crear este fragmento` | `940,174,209x27` | 1044,188 | `somethingElse` | `div.panel svelte-1i7fzq8 role=status` |
| P56 | `Stop creating this snippet` | `967,158,182x27` | 1058,171 | `somethingElse` | `div.panel svelte-1i7fzq8 role=status` |
| P57 | `Dejar de crear este fragmento` | `940,174,209x27` | 1044,188 | `somethingElse` | `div.panel svelte-1i7fzq8 role=status` |
| P58 | `Stop creating this snippet` | `967,158,182x27` | 1058,171 | `somethingElse` | `div.panel svelte-1i7fzq8 role=status` |
| P59 | `Dejar de crear este fragmento` | `940,174,209x27` | 1044,188 | `somethingElse` | `div.panel svelte-1i7fzq8 role=status` |
| P60 | `Stop creating this snippet` | `967,175,182x27` | 1058,188 | `somethingElse` | `div.panel svelte-g3zdg1 role=status` |
| P61 | `Dejar de crear este fragmento` | `940,192,209x27` | 1044,205 | `somethingElse` | `div.panel svelte-g3zdg1 role=status` |

The element returned is, by class, the same host outcome panel §4's table measures as the sibling. Its
rectangle contains that centre in every launch by arithmetic on the retained numbers — P54's sibling
spans x 658 → 1149 and y 165 → 1197, and the centre is 1058,171; P55's spans y 181 → 1275 with centre
188; P60's spans y 182 → 1011 with centre 188; P61's spans y 199 → 1072 with centre 205.

The other six controls answered `outsideViewport` in all eight launches — their centres lie below the
728-pixel viewport at the sampled scroll position, so **no point was tested for them and nothing here
says whether they are covered**. Their measured positions:

| Control | P54 / P56 / P58 (en, editor) | P55 / P57 / P59 (es, editor) | P60 (en, creator) | P61 (es, creator) |
|---|---|---|---|---|
| destination `match/conflict.yml` | `658,770,172x27` | `658,804,172x27` | `658,787,172x27` | `658,821,172x27` |
| trigger `input.text` | `658,919,491x22` | `658,952,491x22` | `658,935,491x22` | `658,970,491x22` |
| replacement `textarea` | `658,1004,491x84` | `658,1054,491x84` | `658,1021,491x84` | `658,1072,491x84` |
| Undo (disabled) | `658,1133,51x27` | `658,1183,77x27` | `658,1149,51x27` | `658,1201,77x27` |
| Redo (disabled) | `714,1133,49x27` | `740,1183,69x27` | `714,1149,49x27` | `740,1201,69x27` |
| create | `768,1133,138x27` | `815,1183,154x27` | `768,1149,138x27` | `815,1201,154x27` |

---

## 8. Measurement 5 — the computed style behind the zero height

Identical in all eight launches:

```
section.recovery   display=flex overflow=visible overflowY=visible
                   flex=0 1 auto minHeight=0px height=0px position=static
```

`display` is `flex`, **not** `contents`, so the zero height is a real border box that its children lay
out past rather than an absent one.

The layout parent is the host surface's own section — `section.matchEditor svelte-1i7fzq8` on the six
editor launches, `section.creator svelte-g3zdg1` on the two creator ones — and in all eight:

```
layoutParent   display=flex overflow=visible overflowY=visible
               flex=0 1 auto minHeight=0px height=579.9375px position=static
```

Its measured box tops are above the viewport at the sampled scroll position: `658,-571,491x580`
(P54/P56/P58), `658,-640,491x580` (P55/P57/P59), `658,-489,491x580` (P60), `658,-506,491x580` (P61).
Its computed height of 579.94 px is smaller in every launch than the recovery children's extent alone
(1001 or 1035 px).

The `offsetParent` is `body` in all eight — `display=block overflow=visible flex=0 1 auto
minHeight=728px height=728px position=static`, box `0,0,1180x728` — that is, the nearest **positioned**
ancestor is neither the flex container nor the scroller.

---

## 9. The gates

Run from the repository root **with the harness in the tree**, so `+1` on each frontend figure against
the production numbers is expected:

| Gate | Figure |
|---|---|
| `npm run check` | 424 files, 0 errors, 0 warnings |
| `npm test` | 1768 passed, 51 files |
| `npm run build` | 181 modules transformed |
| `cargo build -p espansoconfig --features custom-protocol` | finished, no errors |

`npm run build` moved by nothing, which is what a change confined to an already-reachable module
predicts: `src/probe.ts` was on the graph before this step and gained no import. `npm test` moved by
nothing because no test reads this file — a bound, not a reassurance, and §10 says what it costs.

**No gate transcript is retained.** These figures are this worker's reading of four commands' output.
No artifact witnesses that they were produced, when they were produced, or what the tree held at the
time; §10 is where that limit belongs and it is not narrowed by repeating the numbers.

---

## 10. What these numbers do not establish

1. **No verdict is reached here.** Whether the measured covering, the zero height or the below-the-fold
   positions cost a person anything is step 5b-2's judgement. Nothing in §§4–8 is a defect claim.
2. **`visibility=hidden` and `hasFocus=false` in all eight launches.** The window was occluded, as it is
   in every launch this harness has ever taken. Layout and hit testing were evidently computed — the
   numbers exist — but nothing here establishes that an unoccluded, frontmost window lays this out
   identically.
3. **One viewport, one scroll position.** 1180x728 at `dpr=2` in all eight, with the scroll position the
   application left. A different window size or a different scroll position is a different measurement,
   and `outsideViewport` in particular is a statement about **this** scroll position only.
4. **Six of seven form controls were not hit-tested at all.** Their centres were below the viewport, so
   `elementFromPoint` was never called for them. Nothing here says whether they are covered.
5. **A hit test is not a click.** `document.elementFromPoint` reports what is painted at a point; it does
   not establish that a pointer event would be delivered to that element, nor that any control would or
   would not respond. No launch dispatched a real pointer event — the harness still presses through
   `HTMLElement.click()`, which is exactly the limit that made this extension necessary.
6. **The scroller mapping in §6 is a derivation with an unmeasured assumption**, stated inline there.
   The eight exact closures are consistent with it and do not prove it.
7. **No test covers the extension.** `src/probe.ts` is read by no suite in this repository, so
   `npm test`'s figure is unmoved by anything in it and a defect in a reporter here would be caught by
   reading transcripts and by nothing else. The 28 lines per launch and the internal agreement between
   §4's sibling rectangle and §7's returned element are what stand in for that.
8. **The record cannot witness chronology, and does not try to.** No artifact retained by this step
   records how many times anything was built, in what order the eight launches ran relative to any edit,
   whether any launch had a predecessor, or when the gates in §9 ran. What is retained is: eight launch
   directories, each with one `probe.log`, a zero-byte `probe.err`, a `bytes.txt` naming binary digest
   `a4d86645…`, a `tree.diff` and the `.app` bundle that was assembled for it; and P27–P53's own
   `bytes.txt` files naming a different digest. The digest comparison establishes that the bytes
   recorded for P54–P61 are not the bytes recorded for P27–P53. It does not establish who produced
   either, or when. The one chronology fact in this record is §3's last line, that no launch was
   discarded, and it is the worker's statement rather than an artifact's.
