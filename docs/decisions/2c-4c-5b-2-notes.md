# Phase 2c-4c step 5b-2 — the layout fix, and the re-measurement that judges it

Step 5b-1 (`docs/decisions/2c-4c-5b-1-instrument.md`) measured a geometry and deliberately reached no
verdict. This step takes the verdict, changes **one declaration** in one component, and re-measures
with the same instrument.

---

## 1. The property changed, and why that one

One declaration was removed from `src/lib/components/RecoveryPanel.svelte`'s `<style>` block:

```css
.recovery {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 0;   /* ← removed */
}
```

Nothing else in the file changed — no markup, no script, no other rule. The removal is accompanied by
a comment saying what its absence is for, because the next reader's instinct is to put it back.

**Why removing it rather than adding `flex-shrink: 0`.** `section.recovery` is a flex item of the host
surface's own column (`section.matchEditor`, `section.creator`), and that column runs at a used height
of 579.94 px over roughly 1800 px of content — measured, §3 below. The negative free space is
distributed to the items that can shrink, and each item stops at its automatic minimum size, which for
a flex item with `overflow: visible` is its min-content size. **Every other item of that column has
that floor.** `min-height: 0` removed the floor from this one item alone, so the whole of the column's
negative free space was absorbed here first: the section shrank to a zero-height border box while its
ten children laid out at full size past it, and the sibling drawn immediately after the section — the
host's outcome panel, `div.panel[role="status"]`, which holds the live conflict — was placed 7 px below
the section's **top** rather than below its content.

`min-height: auto` restores the floor and makes this item behave exactly as its siblings do. That is
the minimal change and the one that leaves no new rule to reason about: the alternative,
`flex-shrink: 0`, would additionally have forbidden a shrink this item is entitled to and would have
left the misleading `min-height: 0` in place beside it. The `min-height: 0` idiom stays where it
belongs — on the six host surfaces, whose scrolling ancestors need it — and none of those was touched.

**`section.recovery` is in the DOM even when the panel has nothing to offer**, and that was checked
before the property was chosen rather than after. Both hosts mount `<RecoveryPanel>` unconditionally
and the `<section>` is outside the component's `{#if}` chain, so on an ordinary screen it renders with
**no children at all**. A childless flex container's min-content height is 0, so restoring the floor
cannot introduce a gap — and §5 measures that prediction on four launches rather than resting on it.

---

## 2. The launches and the conjunction

Twelve, **P62–P73**, in `/private/tmp/espansoconfig-harness-2c-4c/launches/`. `launch.sh` conjoins none
of its checks, so the conjunction below was applied by hand to every launch: exactly one `--- end`, no
`--- failed`, a zero-byte `probe.err`, and `bytes=MATCH`.

| Launch | Case | Lang | `--- end` | `--- failed` | `probe.err` | `bytes` | Conjunction |
|---|---|---|---|---|---|---|---|
| P62 | `editor-recovery-create` | en | 1 | 0 | 0 bytes | MATCH | PASS |
| P63 | `editor-recovery-create` | es | 1 | 0 | 0 bytes | MATCH | PASS |
| P64 | `editor-recovery-refused` | en | 1 | 0 | 0 bytes | MATCH | PASS |
| P65 | `editor-recovery-refused` | es | 1 | 0 | 0 bytes | MATCH | PASS |
| P66 | `editor-recovery-conflict` | en | 1 | 0 | 0 bytes | MATCH | PASS |
| P67 | `editor-recovery-conflict` | es | 1 | 0 | 0 bytes | MATCH | PASS |
| P68 | `creator-recovery-create` | en | 1 | 0 | 0 bytes | MATCH | PASS |
| P69 | `creator-recovery-create` | es | 1 | 0 | 0 bytes | MATCH | PASS |
| P70 | `editor-exact` | en | 1 | 0 | 0 bytes | MATCH | PASS |
| P71 | `editor-exact` | es | 1 | 0 | 0 bytes | MATCH | PASS |
| P72 | `creator-front` | en | 1 | 0 | 0 bytes | MATCH | PASS |
| P73 | `creator-front` | es | 1 | 0 | 0 bytes | MATCH | PASS |

All twelve print `--- viewport 1180x728 dpr=2 hasFocus=false visibility=hidden`. P62–P69 each print 28
`recoveryGeometry` lines and `recoveryEntry arm=browser.reapply.manualResolution` — the same arm
P27–P34 and P54–P61 printed. Every `bytes.txt` of the twelve names binary digest `0ea33c78…`, which
differs from the `a4d86645…` P54–P61 name and the `fcc9c3ac…` P25–P53 name. That is a comparison
between retained artifacts and nothing more.

**No launch was discarded.** P62–P73 are every launch this step took, and this sentence is the worker's
own statement — no artifact retains it, because no artifact can. §10 says what else no artifact
retains.

---

## 3. Before and after — the section and the sibling it was covering

Boxes are `x,y,WxH` in CSS pixels, viewport-relative, as `box()` prints them. "Before" is 5b-1's
retained transcripts (P54–P61); "after" is this step's (P62–P69). The two sets were taken at the same
viewport and, in all eight pairs, at an **identical scroller `scrollTop`**, so the comparison is
like-for-like.

| Case / lang | Launches | `section.recovery` before → after | Sibling before → after |
|---|---|---|---|
| `editor-recovery-create` en | P54→P62 | `658,158,491x0` → `658,158,491x1001` | `658,165,491x1032` → `658,1166,491x1032` |
| `editor-recovery-create` es | P55→P63 | `658,174,491x0` → `658,174,491x1035` | `658,181,491x1094` → `658,1217,491x1094` |
| `editor-recovery-refused` en | P56→P64 | `658,158,491x0` → `658,158,491x1001` | `658,165,491x1032` → `658,1166,491x1032` |
| `editor-recovery-refused` es | P57→P65 | `658,174,491x0` → `658,174,491x1035` | `658,181,491x1094` → `658,1217,491x1094` |
| `editor-recovery-conflict` en | P58→P66 | `658,158,491x0` → `658,158,491x1001` | `658,165,491x1032` → `658,1166,491x1032` |
| `editor-recovery-conflict` es | P59→P67 | `658,174,491x0` → `658,174,491x1035` | `658,181,491x1094` → `658,1217,491x1094` |
| `creator-recovery-create` en | P60→P68 | `658,175,491x0` → `658,175,491x1001` | `658,182,491x829` → `658,1183,491x812` |
| `creator-recovery-create` es | P61→P69 | `658,192,491x0` → `658,192,491x1035` | `658,199,491x873` → `658,1234,491x890` |

The sibling is `div[role="status"]` carrying the host component's scoped class in all eight after, as
it was in all eight before, and its text is unchanged in every pair (compared as retained text, §6).

**The acceptance criterion, checked against the recovery children's own bottom edge**, which is
unmoved by this fix:

| Case / lang | Children extent (top → bottom) | Sibling top after | Sibling top − children bottom |
|---|---|---|---|
| `editor-recovery-create` en (P62) | 158 → 1159 | 1166 | **+7** |
| `editor-recovery-create` es (P63) | 174 → 1210 | 1217 | **+7** |
| `editor-recovery-refused` en (P64) | 158 → 1159 | 1166 | **+7** |
| `editor-recovery-refused` es (P65) | 174 → 1210 | 1217 | **+7** |
| `editor-recovery-conflict` en (P66) | 158 → 1159 | 1166 | **+7** |
| `editor-recovery-conflict` es (P67) | 174 → 1210 | 1217 | **+7** |
| `creator-recovery-create` en (P68) | 175 → 1176 | 1183 | **+7** |
| `creator-recovery-create` es (P69) | 192 → 1227 | 1234 | **+7** |

Seven pixels is the host column's own `gap: 0.5rem` at this application's root font size, and it is the
same 7 px that separated the sibling from the section's *top* before the fix. **In all eight the
sibling now begins below the recovery children's bottom edge**, so the form and the conflict panel no
longer occupy one band.

The section's other measurements move with it. `sectionClientHeight` goes `0` → `1001` (en) / `1035`
(es) while `sectionScrollHeight` is unchanged at `1001` / `1035` — that is, the border box now equals
the content it always had. The computed style goes

```
before   flex=0 1 auto minHeight=0px   height=0px
after    flex=0 1 auto minHeight=auto  height=1001.0625px   (en; 1035.1875px es)
```

and the layout parent is unchanged in all eight — `display=flex overflow=visible flex=0 1 auto
minHeight=0px height=579.9375px`, box `658,-571,491x580` (P62/P64/P66), `658,-640,491x580`
(P63/P65/P67), `658,-489,491x580` (P68), `658,-506,491x580` (P69). **The host surfaces were not
touched and did not move.**

The scroller is `div.detail`, box `644,44,536x645`, in all eight before and after, at an identical
`scrollTop` in every pair (666 en editor, 735 es editor, 584 en creator, 601 es creator). Its
`scrollHeight` grows: 1819 → 2820, 1966 → 3002, 1716 → 2534, 1784 → 2682. Under §6 of 5b-1's mapping —
viewport `y` to content offset as `y − 44 + scrollTop`, which assumes no border and no transform above
the scroller and **is not measured** — the lowest retained edge closes on the new `scrollHeight` in all
eight, and `scrollHeight − clientHeight` remains the maximum `scrollTop`, so the form's lowest control
lies inside the scrollable extent. **Whether a person scrolls there is not measured.**

---

## 4. The hit tests

The one control whose centre fell inside the 728-pixel viewport is the recovery form's close button,
as it was before.

| Launch | Control | Box | Centre | Hit case before | Hit case after |
|---|---|---|---|---|---|
| P54→P62 | `Stop creating this snippet` | `967,158,182x27` | 1058,171 | `somethingElse` = `div.panel role=status` | **`isTheControl`** = `button` |
| P55→P63 | `Dejar de crear este fragmento` | `940,174,209x27` | 1044,188 | `somethingElse` | **`isTheControl`** |
| P56→P64 | `Stop creating this snippet` | `967,158,182x27` | 1058,171 | `somethingElse` | **`isTheControl`** |
| P57→P65 | `Dejar de crear este fragmento` | `940,174,209x27` | 1044,188 | `somethingElse` | **`isTheControl`** |
| P58→P66 | `Stop creating this snippet` | `967,158,182x27` | 1058,171 | `somethingElse` | **`isTheControl`** |
| P59→P67 | `Dejar de crear este fragmento` | `940,174,209x27` | 1044,188 | `somethingElse` | **`isTheControl`** |
| P60→P68 | `Stop creating this snippet` | `967,175,182x27` | 1058,188 | `somethingElse` | **`isTheControl`** |
| P61→P69 | `Dejar de crear este fragmento` | `940,192,209x27` | 1044,205 | `somethingElse` | **`isTheControl`** |

`document.elementFromPoint` returns the button itself — not a descendant, not the panel — in all eight.
The control's own rectangle is **identical** before and after in every launch; what changed is what is
painted at its centre.

**The other six form controls answered `outsideViewport` after the fix, exactly as they did before**,
and their rectangles are byte-identical in the transcripts across every pair: the destination button,
the trigger `input`, the replacement `textarea`, *Undo*, *Redo* and the create button. Their centres lie
below the 728-pixel viewport at the sampled scroll position, so **no point was tested for them and
nothing here says whether they are covered**. The one control that was hit-tested is the one this record
may speak about; §9.3 is where that bound belongs.

The sibling's own first control (*Keep editing* / *Seguir editando*) answered `outsideViewport` before
and after. It moved down with its panel — `667,1167,83x23` → `667,2168,83x23` (P54→P62), and
correspondingly in the other seven — which is the sibling's displacement seen from inside it.

---

## 5. The ordinary path — P70–P73

`RecoveryPanel` is mounted unconditionally by both hosts, so a height change could shift a screen that
has no recovery on it at all. Four launches with no conflict-recovery state:

| Launch | Case | Lang | `section.recovery` box | `sectionText` | Host outcome panel |
|---|---|---|---|---|---|
| P70 | `editor-exact` | en | `658,37,491x0` | `""` | `658,44,491x1032` |
| P71 | `editor-exact` | es | `658,37,491x0` | `""` | `658,44,491x1094` |
| P72 | `creator-front` | en | `658,37,491x0` | `""` | `658,44,491x863` |
| P73 | `creator-front` | es | `658,37,491x0` | `""` | `658,44,491x925` |

The section renders **empty** on all four — `offer=absent`, `controls:` empty, `sectionText=""` — and its
border box is `491x0` with `min-height: auto`, which is the prediction §1 made. **No gap was added.**

Two of the four have a same-case, same-language predecessor in this harness's retained launches;
the most recent of each is P25 (`editor-exact:en`, which P01 and P07 also ran) and P26
(`creator-front:es`, which P02 and P08 also ran). Comparing the whole transcripts after normalising the
launch directory name that appears inside logged paths, **P70 is line-for-line identical to P25 and P73
is line-for-line identical to P26** — every box, every scroll figure, every sentence. That is the
strongest form the "unshifted" claim can take here.

**P71 (`editor-exact:es`) and P72 (`creator-front:en`) have no same-language predecessor** in this
harness — no launch of either combination was ever taken — so for those two nothing is compared and
only the table above is claimed.

---

## 6. What else moved, and what it is

Three differences appear in the P54–P61 → P62–P69 transcripts beside the section and its sibling. None
is a change this fix should be credited or blamed for without saying which.

**(a) The offer-state section.** Before the form is opened, the section holds only the *Create a new
snippet from supported fields* button. Its box goes `658,y,491x0` → `658,y,491x27` in all eight — the
same defect, one control instead of ten, now also fixed. Nothing else on that screen moved in the
editor pairs.

**(b) The creator's host outcome panel height, which this fix did not cause.** On the creator the panel
measures `491x812` (en, P68) and `491x890` (es, P69) after, against `491x829` (en, P60) and `491x873`
(es, P61) before — a ±17 px difference, and one of it in each direction, which no single-direction
account of a flex redistribution explains. It is not caused by the fix: **the same case and language
already produced both values before any change**. `creator-recovery-create:en` measured `491x829` in
P17 and P60 and `491x812` in P33; `creator-recovery-create:es` measured `491x873` in P61 and `491x890`
in P34. Each post-fix value is one this harness had already recorded with the old CSS. The panel's text
is identical in the P60/P68 pair, compared as retained text. **What produces the bimodality is not
established here**, and this record does not guess; it records that the post-fix value lies inside the
pre-fix set and that the two editor surfaces show no such variation (`491x1032` and `491x1094` before
and after, in all six editor launches).

**(c) The terminal outcome panels sit higher in the pane.** After the form's own save ends, the final
panel measures `658,44,491x129` (en) and `658,44,491x163` (es) in P62/P64/P68/P69 and their partners,
against `658,560,491x129` and `658,526,491x163` before; and in the `refused` pair the acknowledgement
panel goes `658,544,491x145` → `658,44,491x145` with its two choices at `y=658` → `y=158`. A viewport
`y` of 44 is the top row of the scroller's visible band. These are viewport coordinates at a scroll
position the application itself sets when it reveals an outcome, over content that is now taller; both
positions are inside the visible band in both sets. **No control that was visible became invisible.**

---

## 7. The module-count arithmetic

`npm run build` reports **181 modules transformed**, unchanged from 5b-1's figure and the expected
with-harness number (production is 180). An already-existing `<style>` block that is edited adds no
module, which is what the figure shows.

Because 180/181 is exactly the number this project's old regression shorthand used to reserve for "the
Svelte server build leaked in", the number alone decides nothing, so the bundle was searched as well:
**`svelte/internal/server`, `svelte/server` and `async_hooks` are each absent** from
`dist/assets/index-DwZltOmj.js`. The emitted rule was also read back out of the built stylesheet —
`.recovery.svelte-15stnc3{flex-direction:column;gap:.5rem;display:flex}`, with no `min-height` — which
is what the binary embeds.

---

## 8. The gates

Run from the repository root **with the harness in the tree**, so `+1` on each frontend figure against
the production numbers is expected:

| Gate | Figure |
|---|---|
| `cargo test --workspace` | 1112 passed, 0 failed |
| `npm run check` | 424 files, 0 errors, 0 warnings |
| `npm test` | 1768 passed, 51 files |
| `npm run build` | 181 modules transformed |
| `cargo build -p espansoconfig --features custom-protocol` | finished, no errors |

`npm test` moved by nothing, and §9.1 is why that is a bound rather than a reassurance.

**No gate transcript is retained.** These figures are this worker's reading of five commands' output.
No artifact witnesses that they were produced, when they were produced, or what the tree held at the
time.

---

## 9. What this fix does not get

1. **A mounted test cannot catch this defect, and none was written that appears to.** jsdom performs no
   layout: `getBoundingClientRect` returns zeros there, `elementFromPoint` has nothing to report, and
   no computed `height` distinguishes `min-height: 0` from `min-height: auto`. **No case in
   `RecoveryPanel.test.ts` — or in any suite in this repository — can tell the broken CSS from the
   fixed CSS.** The evidence that closes this defect is the window measurement in §§3–5 and nothing
   else. A test written to look like coverage here would assert something jsdom decides rather than
   something a window does, and would make the next reader believe the gap is closed.
2. **`elementFromPoint` reports paint order at a point, not event delivery.** `isTheControl` says the
   button is what is painted at its own centre; it does not establish that a pointer event would be
   delivered to it, that the button would respond, or that a person's press would land there. No launch
   dispatched a real pointer event — the harness still presses through `HTMLElement.click()`, which
   bypasses hit testing entirely and is exactly why every earlier launch in this harness pressed these
   controls successfully while the covering stood.
3. **Six of the seven form controls were not hit-tested, after the fix as before it.** Their centres lay
   below the 728-pixel viewport at the sampled scroll position, so `elementFromPoint` was never called
   for them. Nothing here says whether they are covered, and the one control that answered
   `isTheControl` does not generalise to them.
4. **`visibility=hidden` and `hasFocus=false` in all twelve launches.** The window was occluded, as in
   every launch this harness has ever taken. Layout and hit testing were evidently computed — the
   numbers exist — but nothing here establishes that an unoccluded, frontmost window lays this out
   identically.
5. **One viewport, one scroll position.** 1180x728 at `dpr=2` throughout, with the scroll position the
   application left. A different window size or scroll position is a different measurement.
6. **The scroller mapping used in §3 is 5b-1 §6's derivation with an unmeasured assumption**, named
   there and named again here. Its closures are consistent with it and do not prove it.
7. **`src/probe.ts` is read by no suite**, so `npm test`'s figure is unmoved by anything in the
   instrument, and a defect in a reporter would be caught by reading transcripts and by nothing else.
   The instrument was not changed by this step.
8. **Only the four recovery cases and the two ordinary cases were re-measured.** The other twenty-two
   cases in `launch.sh`'s table draw `RecoveryPanel` on their surfaces too and were not re-run here;
   §5's identity result covers the ordinary editor and creator screens only.

---

## 10. What no artifact retains

This record cannot witness chronology and does not try to. No artifact records how many times anything
was built, in what order the twelve launches ran relative to any edit, whether a launch had a
predecessor, or when the gates in §8 ran. What is retained is: twelve launch directories, each with one
`probe.log`, a zero-byte `probe.err`, a `bytes.txt` naming binary digest `0ea33c78…`, a `tree.diff` and
the `.app` bundle assembled for it; and P17–P61's own directories naming other digests. The digest
comparison establishes that the bytes recorded for P62–P73 are not the bytes recorded for any earlier
launch. It does not establish who produced either, or when.

The one chronology fact in this record is §2's statement that no launch was discarded, and it is the
worker's statement rather than an artifact's.
