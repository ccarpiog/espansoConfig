# Phase 2c-4c step 5 — the window reading

This is the bilingual window reading Phase 2c-4c owes for **six** surfaces. Steps 4a and 4b built
the instrument; this step launches it, **judges what a person would see**, and records findings. It
is not construction: **no probe source was edited**, so nothing was rebuilt and every launch ran the
binary 4b left.

**Twenty-seven launches, P27–P53.** Every one reached `--- end` exactly once, printed **no**
`--- failed` line, left a **zero-byte** `probe.err`, and answered `bytes=MATCH`. The matrix is the
thirteen cases the brief names in **both** languages — which is what closes *both languages on all
six surfaces* — plus one re-take (P53) commissioned to settle a question P39 raised about the
instrument rather than about the application.

**The headline judgement on the geometry, which 4b measured and refused to judge:**

- **`section.recovery`'s zero-height rectangle is real and not an artifact of how the rect is
  measured — and it costs a person nothing today.** Its content lays out at natural size, sits inside
  the visible band, is inside the pane's scroll extent, and is clickable. The collapse is a flex
  shrink the CSS asks for. What it leaves is a **latent** defect, recorded as M2 and not fixed here.
- **The four recovery-without-creation paragraphs at `y = -14/-15` are laid out correctly.** They sit
  immediately above the conflict panel with the surface's own `0.5rem` gap; the negative `y` is the
  **scroll position the application itself set** when it revealed the conflict panel, and nothing
  else. They are reachable by scrolling up. That is not a layout defect — but on three of the four
  surfaces the sentence is wholly outside the visible band at the moment it is drawn, which is L1.

**The headline finding is not a geometry finding.** It is **M1**: in Spanish, the deleter and the
duplicator each draw **two different controls carrying the identical label *Dejarlo como está***, one
of which closes the panel and one of which keeps the requested operation. In English the two are
*Leave this alone* and *Leave this as it is* and cannot be confused. No test in this repository can
fail on it, and no English-only reading could have seen it. **That is what "both languages judged,
not just launched" bought.**

**No finding of this reading is a defect in what is written to a user's file.** All twenty-seven
launches answered `bytes=MATCH`, including the first-ever launch of the fifth prediction fixture.

---

## 1. The tree, the binary and the instrument

The scratch tree is `/private/tmp/espansoconfig-harness-2c-4c/`, unchanged from 4b except for this
step's twenty-seven launch directories and one new manifest. It is **2.1 GB** after fifty-three
launches, because `launch.sh` assembles a fresh `.app` bundle per launch and every launch keeps its
own; that is the growth rate 4a §1 recorded and not a measurement of what this step cost.

**One binary ran, and it is 4b's.** Every one of the twenty-seven `bytes.txt` files carries
`binary=fcc9c3ac8713906d9793552a714e744218f720ea9714b6a1e700e99e05effc2e`, and
`shasum -a 256 target/debug/espansoconfig` answers the same digest now. **No rebuild was performed
and none was needed**, because no probe source was edited — which is the same statement, made twice
from two different artifacts.

**`git status --short --untracked-files=all` lists exactly the four harness paths** at the close of
this step, plus this record:

```
 M src-tauri/src/main.rs      ← two hook lines
 M src/main.ts                ← two hook lines
?? src-tauri/src/probe.rs
?? src/probe.ts
```

Nothing was committed. **Never `git commit -a` while these are in the tree.**

### 1.1 The viewport, and the band this reading measures against

`1180 x 728`, `dpr=2`, `hasFocus=false`, `visibility=hidden`, printed by all twenty-seven launches
and identical on every one. `section.detail` is the only real scroller — every `reach` line names it
— with its top at `y = 44` and `clientHeight=645`, so **the visible band is [44, 689]**. That is the
same band 3c-2 §4 and 3d-2b §1.3 measured, reproduced here on every launch that printed a `reach`
line.

`lang=` equals `picked=` on all twenty-seven: the picker was used in every launch, which matters
because the WebKit data store follows the bundle identifier every probe bundle shares
(`2c-2-2-window-reading.md` §1.2).

### 1.2 What this step did not do to the instrument

**No line of `src/probe.ts` or `src-tauri/src/probe.rs` was changed**, so the rebuild order 4b §11
names was never entered and every reporting bound 4b stated still holds verbatim. One consequence is
recorded as an instrument limitation rather than repaired: see O3.

### 1.3 The manifest

`manifest-2c-4c-5-post.sha256` is new — **79 entries**, all verify: `launch.sh`, the twenty-four
fixtures, and `probe.log` plus `bytes.txt` for P27–P53. `manifest-2c-4c-4b-post.sha256` was **not**
regenerated and still verifies all 55 of its entries, checked directly. `manifest-2c-4c-4a-post.sha256`
was left exactly as 4b left it — a partial-verify artifact by design (4b §7.2).

**A manifest is a post-image and witnesses nothing about first attempts.** It says what these files
hold now; it cannot say whether any launch was discarded, and this record makes no such claim.

---

## 2. The launch ledger

Every row satisfies, **by a reader and never by the harness**, the four-part conjunction
`2c-4b-3b-instrument.md` §8.9 defines. `launch.sh` runs three checks and conjoins none of them; the
conjunction below is supplied per launch and is stated as one paragraph after the table, because it
holds identically on every row.

| # | Case | Surface | Lang | `bytes=` | `backups=` | Verdict |
|---|---|---|---|---|---|---|
| P27 | `editor-recovery-create` | editor | en | MATCH | PRESENT | PASS — first launch of the fifth prediction fixture |
| P28 | `editor-recovery-create` | editor | es | MATCH | PRESENT | PASS |
| P29 | `editor-recovery-refused` | editor | en | MATCH | PRESENT | PASS |
| P30 | `editor-recovery-refused` | editor | es | MATCH | PRESENT | PASS |
| P31 | `editor-recovery-conflict` | editor | en | MATCH | none | PASS — two conflict blocks, nothing written |
| P32 | `editor-recovery-conflict` | editor | es | MATCH | none | PASS |
| P33 | `creator-recovery-create` | creator | en | MATCH | PRESENT | PASS |
| P34 | `creator-recovery-create` | creator | es | MATCH | PRESENT | PASS |
| P35 | `deleter-exact` | deleter | en | MATCH | PRESENT | PASS |
| P36 | `deleter-exact` | deleter | es | MATCH | PRESENT | PASS |
| P37 | `mover-exact` | mover | en | MATCH | PRESENT | PASS |
| P38 | `mover-exact` | mover | es | MATCH | PRESENT | PASS |
| P39 | `duplicator-exact` | duplicator | en | MATCH | PRESENT | PASS on bytes; final panel sampled early (O3) |
| P40 | `duplicator-exact` | duplicator | es | MATCH | PRESENT | PASS |
| P41 | `raw-negative` | raw | en | MATCH | none | PASS |
| P42 | `raw-negative` | raw | es | MATCH | none | PASS |
| P43 | `editor-reload-gone` | editor | en | MATCH | none | PASS |
| P44 | `editor-reload-gone` | editor | es | MATCH | none | PASS |
| P45 | `creator-reload` | creator | en | MATCH | none | PASS — `notice=absent`, correctly |
| P46 | `creator-reload` | creator | es | MATCH | none | PASS |
| P47 | `deleter-reload-gone` | deleter | en | MATCH | none | PASS |
| P48 | `deleter-reload-gone` | deleter | es | MATCH | none | PASS on the conjunction; **M1 found here** |
| P49 | `mover-reload-gone` | mover | en | MATCH | none | PASS |
| P50 | `mover-reload-gone` | mover | es | MATCH | none | PASS; **O2 found here** |
| P51 | `duplicator-reload-gone` | duplicator | en | MATCH | none | PASS |
| P52 | `duplicator-reload-gone` | duplicator | es | MATCH | none | PASS; **M1 again** |
| P53 | `duplicator-exact` | duplicator | en | MATCH | PRESENT | PASS — the re-take that settles O3 |

**The four-part conjunction, supplied by a reader, holding on all twenty-seven:**

1. **No `--- failed` line, one `--- end`, zero-byte `probe.err`.** Swept mechanically over all
   twenty-seven: `failed=0 end=1 err=0` on every row.
2. **The conflict block, with `expected ≠ found` and `diskRevision == found`.** Every launch printed
   three revisions; P31 and P32 printed **two** such blocks, the host's and the recovery form's, and
   both satisfy the inequality. Every revision printed equals the SHA-256 of the fixture it names,
   checked directly: `base-r0.yml` is `9246ae21…`, `elsewhere-r1.yml` `04e4bef8…`,
   `target-deleted-r1.yml` `cf285e09…`, `target-changed-r1.yml` `f53dfa44…`, `target-labelled-r1.yml`
   `6278f5c1…`. That is 4a §4.2's observation holding again over five files on this build; it is
   still an observation of these files on this build and not a documented property of the revision
   function.
3. **The expected control and action lines for that surface.** The recovery surfaces printed the
   offer, the opened form, its destination list, its six transfer rows and its ending; the four
   non-creating surfaces printed `elements=1 documentWide=1` with the reason that component derived
   and a `sentencesByDictionary` naming the same reason — fifteen readings, no exception. The reload
   plans printed the two-control roll before and after the first press. P39's last line is the one
   place where the *expected* line is not the drawn one, and O3 is what that is.
4. **The intended byte predicate.** `bytes=MATCH` on all twenty-seven — **thirteen** against an
   authored expected-bytes document and **fourteen** against a fixture the case must leave unchanged
   (R1 on twelve of them, R2 on P31 and P32). The backup split is the same thirteen and fourteen:
   `backups=PRESENT` on exactly the thirteen that wrote and `backups=none` on exactly the fourteen
   that did not, checked mechanically over all twenty-seven with no exception. **Twelve** of the
   thirteen also drew the sentence saying a copy had been kept; the thirteenth is P39, which sampled
   its panel early (O3) and drew no ending sentence at all, and whose file was written.

### 2.1 Language coverage — the aggregate hole 4b left is closed

4b's §10.8 left the editor and creator in both languages and the deleter, mover, duplicator and raw
editor in one each. **Every one of the six surfaces has now been read in both languages**, and every
case in the matrix ran twice:

| Surface | English | Spanish |
|---|---|---|
| editor | P27, P29, P31, P43 | P28, P30, P32, P44 |
| creator | P33, P45 | P34, P46 |
| deleter | P35, P47 | P36, P48 |
| mover | P37, P49 | P38, P50 |
| duplicator | P39, P51, P53 | P40, P52 |
| raw | P41 | P42 |

### 2.2 The fifth prediction fixture, launched for the first time

`editor-recovery-create-expected.yml` was authored by 4b and compared against nothing (4b §6.3). P27
is its first launch and it answered **`bytes=MATCH` on the first attempt**, and P28 answered the same
in Spanish. **The prediction was right**, and no investigation of a suspect fixture was needed.

The other four predictions — `editor-fallback-expected.yml`, `mover-reordered-expected.yml`,
`mover-after-expected.yml`, `mover-end-expected.yml` — **were not launched by this step and stand
exactly as 4a left them**.

---

## 3. The geometry judgement

4b measured two rectangles and refused to judge either. Both are judged here, from the transcripts
and from the components' markup and CSS.

### 3.1 The recovery-without-creation paragraph at `y = -14/-15` — **not a layout defect**

Measured on fifteen readings across four surfaces and both languages, and the numbers are stable to
the pixel:

| Surface | Launches | Box | In band [44, 689]? |
|---|---|---|---|
| deleter | P35, P36, P47, P48 | `658,-14,491x51` | no — wholly above |
| mover | P37, P38, P49, P50 | `658,-15,491x51` | no — wholly above |
| duplicator | P39, P40, P51, P52, P53 | `658,-14,491x51` | no — wholly above |
| raw | P41, P42 | `658,138,491x51` | **yes** |

**The layout is correct and the paragraph is exactly where the markup puts it.** Each of the four
hosts mounts `RecoveryWithoutCreation.svelte` immediately **before** its outcome panel
(`MatchDeleter.svelte:548`, `MatchMover.svelte:815`, `MatchDuplicator.svelte:708`,
`RawEditor.svelte:541`), and each host section is a column flex container with `gap: 0.5rem`. The
arithmetic in the transcripts is that gap and nothing else: on the deleter the paragraph occupies
`-14 … 37` and the conflict panel begins at `44`, seven or eight pixels below its bottom edge.

**The negative `y` is the scroll position, and the application is what set it.** The proof is that
the same numbers arrive by two different routes. In the `*-exact` plans `reportReach` runs first,
captures the scroller's `scrollTop`, scrolls, and **restores** it; in the four `*-reload-gone` plans
`reportRecoveryWithoutCreation` is called **directly after `reportConflict` with no `reportReach` at
all**, so the scroll is untouched by the harness. Both routes print `-14`/`-15`. What moved the pane
is `revealOutcome` in `src/lib/components/reveal.ts`, asked for when the conflict panel appeared.

**A person can reach it.** A box at `y = -14` inside a scroller whose client top is `44` *entails*
`scrollTop > 0`, so scrolling up is possible; the `reach` lines make it concrete —
`scrollTop=199` on the deleter, `459`/`476` on the mover, `318` on the duplicator. Roughly sixty
pixels of upward scroll brings the whole sentence into the band on all three.

**Verdict: not a layout defect, and not a harmless artifact of measurement either — "something in
between".** The rectangle is honest, the layout is right, and the sentence is nonetheless invisible
at the moment it becomes relevant on three of the four surfaces. That is **L1**.

### 3.2 `section.recovery`'s `491x0` rectangle — **real, and inconsequential today**

Measured on all eight launches that drew a recovery panel, in both languages, in three different
states:

| State | Launches | `section.recovery` | A child, at the same `y` |
|---|---|---|---|
| holding the offer | P27, P29, P31 (en) | `658,158,491x0` | offer `658,158,296x27` |
| holding the offer | P28, P30, P32 (es) | `658,174,491x0` | offer `658,174,357x27` |
| holding the offer | P33 (en) / P34 (es) | `658,175,491x0` / `658,192,491x0` | offer `…,296x27` / `…,357x27` |
| holding the whole open form | P27–P34 | unchanged, still `491x0` | form content down to `y = 689` |
| empty | P25, P26 (4b) | `…,491x0` | — (correct: no children) |

**It is not an artifact of how the rect is measured.** `box()` calls `getBoundingClientRect()`, which
returns the border box; a border box of height 0 with children of height 27 laid out at the same `y`
is an element whose box was shrunk below its content, not an element that was mismeasured.

**The cause, read from the CSS rather than measured in the window.** `section.detail` is
`display: flex; flex-direction: column; overflow: auto` (`DetailPane.svelte:993`). Each write
surface's own section — `.matchEditor`, `.creator`, `.deleter`, and the rest — is a flex item of it
and sets `min-height: 0`, and `.recovery` (`RecoveryPanel.svelte`) sets `min-height: 0` inside that.
`min-height: 0` defeats the automatic minimum size that keeps a flex item at its min-content height,
so when the pane overflows the shrink is absorbed by exactly the items that opted out of that
protection — and `.recovery` goes to zero while its siblings, which did not opt out, keep their
heights. **This cause is read from the stylesheets; no computed style was sampled in the window,
which would have required a probe edit.** Every measurement is consistent with it and none
contradicts it.

**The content is painted, inside the band, inside the scroll extent, and clickable.** Four
independent observations say so:

1. The offer control, the destination row, the six transfer rows, the trigger box, the replacement
   box and the create control all report natural sizes at sensible positions.
2. The plans **pressed** controls inside the collapsed section — `browser.recovery.open`,
   `browser.recovery.create`, `browser.rawSave.choice.saveAnyway`,
   `browser.saveOutcome.choice.reloadDiskVersion`, `browser.saveOutcome.choice.confirmReload` — and
   every press was found and had its effect. A control that had been clipped away would have timed
   out and printed `--- failed`.
3. **Every status panel the recovery section drew — eight of them, across the six launches that drew
   one — ends at exactly `y = 689`**: `560+129`, `526+163`, `544+145`, `510+179`, which is the band's
   bottom edge to the pixel. (P31 and P32 drew none, by design: after their confirmed reload the
   section holds no status block.) That is the signature of a pane scrolled to its maximum with the
   overflowing content as its last content, which means `scrollHeight` **includes** the overflow of
   the collapsed box. A reader can reach the bottom of the form.
4. The whole form's content lies within `[158, 689]` in English and `[174, 689]` in Spanish — inside
   the band.

**What is left is latent, and it is M2.** A box of height zero means every sibling **after** it in the
same flex container is positioned as though the panel were not there. In `MatchEditor.svelte` and
`MatchCreator.svelte` the element after `<RecoveryPanel>` is the host's own outcome panel, drawn when
`view.outcome !== null`. In every state this reading reached that value is `null` — the reapply that
opens recovery is what cleared it — so nothing was drawn after the section and nothing overlapped.
**The state is nonetheless reachable**: P45 and P46 print the creator's whole control roll while a
conflict is retained, and it includes the host's own send control (`[Add this snippet]` /
`[Añadir este fragmento]`) alongside the conflict choices. A person who pressed the host's send with
the recovery form open would put a host outcome panel where the form's content is being painted.

**That last step is inferred from the markup and one measured control roll; no launch constructed it,
and this record does not claim one did.** It is recorded, classified Medium, and **not fixed here** —
a fix is a change and the round that reviews it is not optional.

### 3.3 One more thing the band shows, on the same three surfaces

While measuring the paragraphs above, the same transcripts put the conflict panel's **own three
controls** at `y = 771`–`788` on the deleter, the mover and the duplicator, in both languages —
**wholly below the band's bottom edge of 689**, by 82 to 99 pixels. On the raw editor they are at
`y = 658`, inside it. This is not new: `reveal.ts`'s own contract says that on five of the six write
surfaces the conflict panel's controls begin below the fold at 1180 × 728, and states that
`revealReapplyReport` deliberately does not ask for more scrolling than it needs. It is **reproduced**
here on three surfaces and in Spanish for the first time, and recorded as **L2**.

The combined picture for a person on the deleter at 1180 × 728, in either language: the panel's first
line — *Nothing was written. The file on disk is exactly as it was.* — is at the very top of the
pane, the panel body fills the pane, the recovery sentence is about sixty pixels above, and the three
controls are about a hundred pixels below. Both are one short scroll away and neither is on screen.

---

## 4. The sentence judgement

**A false sentence prints exactly as well as a true one** (4b §10.2), so what follows is a reading of
what each sentence *claims* against what the code can establish — and, wherever the harness's one
piece of independent evidence reaches, against the bytes.

### 4.1 The two recovery-unavailable sentences

**`browser.recovery.unavailable.operationDraft`**, drawn on the deleter, the mover and the duplicator
(thirteen readings):

- **en** — *"What you asked for here is an action on a snippet rather than text you wrote, so there
  is nothing to make a new snippet out of. Load the version on disk, choose a snippet in it, and ask
  again."*
- **es** — *"Lo que pediste aquí es una acción sobre un fragmento y no un texto que escribieras, así
  que no hay nada con lo que crear un fragmento nuevo. Carga la versión en disco, elige un fragmento
  en ella y vuelve a pedirlo."*

**Both claims are true and the two languages say the same thing.** The first clause is a statement
about the retained draft's kind, which is what `RecoveryWithoutCreation.svelte` is handed
(`kind="operationChoice"` on all three hosts) and what the marked attribute carried on all thirteen
readings. The second is **advice, and this reading confirms the advice is followed by the window**:
P47–P52 press *Load the version on disk*, confirm, and land on a pane holding one thing — the
selection-cleared notice — so *choose a snippet in it, and ask again* is exactly what the person must
then do. The instruction matches the observed behaviour in both languages.

Two wording observations, folded into **L3**: the English *"Load the version on disk"* is the
control's label verbatim; the Spanish *"Carga la versión en disco"* is not — the control says
*"Cargar la versión del disco"*. And the reload is two controls, not one: the sentence names the
first and the second appears after it.

**`browser.recovery.unavailable.wholeDocumentDraft`**, drawn on the raw editor (P41, P42):

- **en** — *"What you have here is a whole file rather than one snippet, so there is nothing to make
  a new snippet out of. Carry on editing, copy your text, compare it with the version on disk, or
  load that version."*
- **es** — *"Lo que tienes aquí es un archivo entero y no un fragmento, así que no hay nada con lo
  que crear un fragmento nuevo. Sigue editando, copia tu texto, compáralo con la versión en disco o
  carga esa versión."*

**True, and the two languages agree.** It names four actions where the panel draws three controls —
`[Keep editing] [Copy my text] [Load the version on disk]` in English, `[Seguir editando]
[Copiar mi texto] [Cargar la versión del disco]` in Spanish — and the fourth, *compare it with the
version on disk*, has **no control at all**. It is not a false claim: the panel prints the disk
version's whole text inline (verified in both P41 and P42), so comparing is something a person can do
by reading. It is advice pointing at something that is on the screen rather than at a button. Folded
into **L3**, with the English's own mismatch beside it: *"Carry on editing"* where the control says
*"Keep editing"*.

### 4.2 The recovery form's sentences — three of them are **byte-verified**

This is the one place the harness gives independent evidence, and it is worth stating in full.

- **`browser.recovery.transfer.omitted`** — *"not carried over, so this key is not written at all"* /
  *"no se traslada, así que esta clave no se escribe en absoluto"*, drawn on four of the six transfer
  rows in P27–P30 and P33–P34. **The bytes agree**: all three expected-bytes documents these six
  launches were compared against hold the new snippet with `trigger` and `replace` and **no other
  key** — no `label`, no `word`, no `left_word`, no `right_word`.
- **`browser.recovery.position`** — *"It goes at the end of that file's snippet list, and there is no
  other choice here. This app does not guess at a position from a change it could not carry out."*
  **The bytes agree**: in all three documents the new snippet is the **last** item of the list. The
  creator's case is the sharper one — its original request was *After :beta*, its reapply refused
  because that anchor was gone, and the recovery create put the snippet at the end rather than
  guessing. That is the sentence's second clause, verified.
- **`browser.recovery.what`** — *"how each value is quoted … [is] not carried over"*. **The bytes
  agree**: in all three documents the created snippet's trigger is written single-quoted while every
  pre-existing trigger in the same file is double-quoted. The panel warns about exactly the
  difference the file then shows.

- **`browser.recovery.destinationScope`** — *"Only files this app can write a snippet into are listed
  here. A file with no “matches:” list is not offered, and this app does not add one."* **The
  observed lists agree**, and the contrast is drawn inside this reading: the recovery form's
  destination list holds **one** row (`match/conflict.yml`) in all four launches that opened a form,
  in both languages, while the **creator's own** list in P45 and P46 holds **two**
  (`config/default.yml` and `match/conflict.yml`). The synthetic profile has no `matches:` list. The
  sentence describes the list the person is looking at.

- **`browser.recovery.committed`** — *"This snippet is in the file. The file it went into has been
  written to since this panel opened, so nothing more can be created from here."* /
  *"Este fragmento está en el archivo. El archivo en el que ha entrado ha recibido una escritura
  desde que se abrió este panel, así que desde aquí ya no se puede crear nada más."* Drawn as the
  last block of P27, P28, P29, P30, P33 and P34. **True in both languages, and it attributes nothing
  to anybody** — but the write it reports is **this panel's own**, and a reader may take *"has been
  written to since this panel opened"* as news of an external event. Recorded as **O1**; no claim is
  false and nothing is proposed.

### 4.3 The refusal on the recovery path

P29 (en) and P30 (es) drove the recovery form to its refusal ending and then pressed *Save anyway*:

- **en** — *"The new snippet repeats trigger text another snippet in this list already writes, and
  espansoConfig cannot determine how espanso will handle overlapping definitions."*
- **es** — *"El fragmento nuevo repite un texto de disparador que ya escribe otro fragmento de esta
  lista, y espansoConfig no puede determinar cómo tratará espanso las definiciones superpuestas."*

**Correct under D2u in both languages**: it claims a risk this application cannot resolve and makes
**no** claim about espanso's semantics. The refusal is also correct on the facts — the ending keeps
the carried trigger `:beta`, and `target-changed-r1.yml` still holds a `:beta`. The two offered
answers are *Save anyway* / *Keep editing* and *Guardar de todos modos* / *Seguir editando*, and the
file that resulted matched `editor-recovery-refused-expected.yml` byte for byte in both languages.

### 4.4 The conflict panels, per surface, both languages

The opening pair is identical across all six surfaces and both languages and is the sentence
`reveal.ts` exists for: *"Nothing was written. The file on disk is exactly as it was."* /
*"No se ha escrito nada. El archivo del disco sigue exactamente igual."* followed by *"This file
changed after its text was loaded here, so the save was refused rather than applied over that
change."* **True on every one of the twenty-seven launches**, and cross-checked against the
filesystem: the twelve launches whose panel later said a file **had** been written are twelve of the
thirteen with `backups=PRESENT` — the thirteenth being P39, which drew no ending sentence at all
(O3) — and the fourteen whose ending said nothing was written are exactly the fourteen with
`backups=none`. **No launch drew a backup sentence without a backup directory, and none drew a
"nothing was written" ending beside one.**

The third line is the one that differs by draft kind, and both wordings are right:

- **authored text** (editor, creator, raw) — *"Your text is still here, exactly as you wrote it."* /
  *"Tu texto sigue aquí, exactamente como lo escribiste."*
- **an operation** (deleter, mover, duplicator) — *"What you asked for here is still set up, exactly
  as you left it."* / *"Lo que pediste aquí sigue preparado, exactamente como lo dejaste."*

The deleter's *what you asked for* block is the most careful sentence in the set and it says the same
thing in both languages: *"This panel names the snippet as this window read it before the file
changed. This app does not look for a matching snippet in the version on disk, so nothing here says
what that version holds."* / *"Este panel nombra el fragmento tal y como lo leyó esta ventana antes de
que cambiara el archivo. Esta aplicación no busca un fragmento equivalente en la versión del disco,
así que nada de lo que hay aquí dice qué contiene esa versión."* **It claims exactly what the code
does and explicitly disclaims what it does not do.**

### 4.5 The reapply reports

Two arms were drawn, fifteen times in all. `browser.reapply.reapplied` on the seven positive
`*-exact` launches — two deleter, two mover, three duplicator — *"This window now shows the version on
disk, with what you kept set up over it. Nothing has been written yet: send it when you are ready,
and that save can still be refused or conflict."* — **which is a promise about what has *not*
happened, and the byte check is consistent with it**: nothing was on disk at that point that the
later send did not put there.

`browser.reapply.manualResolution` on the eight recovery launches — six editor, two creator — with
two different obstacles: the
editor's field-collision obstacle (*"The version on disk does not hold these fields the way the
version your draft was built on did … Replacement text."*) and the creator's missing-anchor obstacle
(*"espansoConfig could not identify, in the version on disk, the snippet this one was to be placed
after."*). Both are true of the fixtures — `target-changed-r1.yml` rewrote `:beta`'s body, and
`target-deleted-r1.yml` removed `:beta` entirely — and the Spanish says the same in both cases.

### 4.6 The selection-cleared notice

Drawn on eight of the ten reload launches, identically:

- **en** — *"The selection was cleared, because espansoConfig can no longer point at the snippet that
  was selected. That is not a statement that it was removed: nothing here searched this file for
  it."*
- **es** — *"Se ha borrado la selección porque espansoConfig ya no puede señalar el fragmento que
  estaba seleccionado. Eso no significa que se haya eliminado: aquí no se ha buscado el fragmento en
  este archivo."*

**This is the sentence to hold up as the standard.** It states what happened, states what it is *not*
a statement about, and gives the reason in the same breath — and it is accurate: the producer here is
`reresolve`'s **length** arm, a claim about the size of the list rather than about the snippet. The
Spanish is a faithful rendering, including the disclaimer.

P45 and P46 print `notice=absent`, which is **correct and not a gap**: the creator's plans select no
snippet, so there is nothing to clear.

### 4.7 The final outcome sentences, per surface

Each surface's closing sentence names why nothing more can be done from that panel, and each names a
*different* reason. All four were read in both languages and all four are true of the model:

- deleter — *"Nothing more can be deleted from here: pick another snippet in the list first."* /
  *"Desde aquí ya no se puede eliminar nada más: elige antes otro fragmento en la lista."*
- mover — *"the places this panel offers came from the reading of the file it was opened over"* /
  *"los sitios que ofrece este panel vienen de la lectura del archivo con la que se abrió"*
- duplicator — *"the write gave every snippet in this file a new identity"* / *"la escritura le ha
  dado una identidad nueva a cada fragmento de este archivo"*
- editor — *"Reading it again is what tells this app how the file now spells each value, and which
  fields it may edit."*

**None of them says "the file was locked" or any other invented reason**, and each names the actual
invalidation. The Spanish carries the same reason in each case.

---

## 5. Both languages judged — register, agreement, and equivalence

**Register.** Spanish is second-person singular (*tú*) throughout — *"Lo que pediste"*, *"Carga"*,
*"elige"*, *"vuelve a pedirlo"*, *"copia tu texto"*, *"envíalo cuando quieras"* — and control labels
are infinitives — *"Cargar la versión del disco"*, *"Conservar mi borrador"*, *"Guardar de todos
modos"*. That split is consistent across every string this reading saw: prose addresses the person,
labels name the act. **No register break was found in any of the twenty-seven transcripts.**

**Agreement.** The pronouns resolve: *"elige un fragmento en ella"* (la versión), *"Descartar mi
texto y cargarla"* (la versión), *"compáralo con la versión en disco"* (el texto). *"Dejarlo"* and
*"Muévelo"* agree with *el fragmento*. **No agreement error was found.**

**Equivalence.** Every sentence pair read above says the same thing in both languages, including the
disclaimers, which are the part that is easiest to lose in translation and were not lost.

**The one place the two languages are not equivalent is M1, and it is not a translation error — it is
a collision.** Two keys whose English values are distinct have the **same** Spanish value, and both
are drawn on the same surface at the same time. A mechanical scan of the two dictionaries finds
exactly two such collisions in the whole application:

| Spanish value | Keys that share it | Their English values |
|---|---|---|
| `Dejarlo como está` | `browser.saveOutcome.choice.keepOperation`, `browser.matchDeletion.close`, `browser.matchDuplication.close` | *Leave this as it is*, *Leave this alone*, *Leave this alone* |
| `Expresión regular` | `browser.detail.field.regex`, `code.matchBadge.regex`, `code.triggerKind.regex` | *Regular expression*, *Regex*, *Regular expression* |

The second is benign — a field name and a badge for the same concept. The first is **M1**.

---

## 6. Findings

### M1 — **Two different controls carry the same label in Spanish, on two surfaces.** Medium. Not a disk defect

**What was seen.** P48, the deleter in Spanish, prints the whole control roll of `section.deleter`
while the conflict is up:

```
[Dejarlo como está] [Dejarlo como está] [Conservar lo que he pedido] [Cerrar esto y cargarla]
```

P47, the same case in English:

```
[Leave this alone] [Leave this as it is] [Keep what I asked for] [Close this and load it]
```

P52 shows the same on the duplicator (`[Dejarlo como está] [Duplicar este fragmento]
[Dejarlo como está] …`), against P51's `[Leave this alone] [Duplicate this snippet]
[Leave this as it is] …`.

**What the two controls do.** The first is the surface's own close control —
`browser.matchDeletion.close` at `MatchDeleter.svelte:433`, `browser.matchDuplication.close` at
`MatchDuplicator.svelte:563` — which **closes the panel and abandons the request**. The second is the
conflict panel's *keep the operation* choice, `browser.saveOutcome.choice.keepOperation`, reached
through `conflictChoiceKey`'s `operationChoice` arm (`saveOutcome.ts:1536`), which **dismisses the
conflict and keeps the request set up**. They are opposite in effect and identical in wording.

**Why no test fails.** `saveOutcome.ts`'s own contract already names this class in the abstract —
*"`browser.saveOutcome.choice.keepOperation` could be re-worded to read exactly like
`browser.rawSave.choice.keepEditing` and every suite would stay green. The i18n suites check parity
and placeholders, never meaning"* — and holds a suite over that **one pair**. The collision found
here is with a **host** control rather than with the other conflict label, which that suite does not
cover, and `dictionaries.test.ts` asserts key-set equality, an untranslated-value heuristic,
placeholder parity and a no-verb-of-writing rule over the conflict family — **no global check that
two co-drawn controls have distinct labels**.

**Severity.** Medium, not High: neither control writes anything, so the worst outcome is a lost
set-up request or a panel left open — never a file. It is Medium rather than Low because it is a
correctness defect in the user-facing text of a **write** surface, it is invisible to every gate, and
it is invisible to any English-only reading, which is precisely the class of defect a bilingual
reading exists to find.

**Bound.** The two controls are in the same surface and in the DOM at the same moment (measured). They
are **not** measured as visible on screen at the same moment: the close control is in the panel head
and the conflict choices are in the panel's choice row, and §3.3 shows the choice row below the fold
while the head is above it. A person scrolling the pane meets the same three words twice.

**Not fixed here.** A reading records; the fix and its review round belong to whoever schedules them.

### M2 — **`section.recovery`'s box collapses to zero height, so anything drawn after it would be laid out over the form.** Medium, **latent and inferred**. Not a disk defect

**What was measured.** `section.recovery` reports `491x0` in all eight launches that drew it, in both
languages, empty, holding an offer, and holding the whole open form, while its children lay out and
measure normally. §3.2 has the table and the reasoning.

**What is established.** The collapse is real, its cause is `min-height: 0` on a flex item of an
overflowing column flex container (read from the CSS), and it costs a person **nothing in any state
this reading reached**: the content is painted, inside the band, inside the scroll extent — every
recovery outcome panel ends at exactly `y = 689`, the band's bottom edge, which is a pane scrolled to
its maximum over that content — and clickable, since five different controls inside the collapsed
section were pressed successfully.

**What is inferred and not measured.** That a state exists in which a sibling is drawn after the
section. The element after `<RecoveryPanel>` in both hosts is the outcome panel, drawn when
`view.outcome !== null`; P45 and P46 measure the host's own send control drawn while a conflict is
retained, so pressing it with the recovery form open is a path to that state. **No launch constructed
it**, and constructing one would have meant editing the probe, which this step did not do.

**Severity.** Medium: text drawn over text is worse than text below the fold, and the CSS cause is
certain — but the reachable-state half is an inference, and the whole finding is invisible in every
state actually read. It is deliberately not classified High for that reason.

**Not fixed here**, and the reason is not that a fix would be hard: it is that a fix is a change, the
round that reviews it is not optional, and a reading is not the place to take one.

### L1 — **On three of the four surfaces the recovery sentence is wholly outside the visible band at the moment it is drawn.** Low. Not a disk defect

Measured at `y ∈ [-15, 37]` with height 51 on the deleter, mover and duplicator, in both languages and
by both routes (with and without the harness's scroll restore), against a band of `[44, 689]`. On the
raw editor it is at `y = 138`, inside the band. It is reachable — roughly sixty pixels of upward
scroll — and the layout that puts it there is correct; what puts it off-screen is the application's
own reveal of the conflict panel, which asks for the panel and not for the sentence above it. §3.1.

Low rather than Medium: the sentence carries **no control**, it is an explanation of why recovery is
unavailable, and the panel it explains is the thing the reveal correctly brought into view.

### L2 — **On the same three surfaces the conflict panel's own controls are wholly below the band.** Low, **reproduced**. Not a disk defect

`y = 771`–`788` against a band bottom of 689, in both languages, on the deleter, mover and
duplicator; `y = 658` and inside the band on the raw editor. `reveal.ts`'s own contract states this
behaviour and the deliberate reason for it (`'nearest'` asks for the minimum, and asking for more
would trade one invisible sentence for another). This reading **reproduces** it on three surfaces and
in Spanish for the first time; it discovers nothing new and proposes nothing.

### L3 — **Three recovery-unavailable instructions name an action the controls do not carry, and one names no control at all.** Low. Not a disk defect

- `wholeDocumentDraft` (**en**) says *"Carry on editing"*; the control says *"Keep editing"*.
- `wholeDocumentDraft` (**both**) says *"compare it with the version on disk"* / *"compáralo con la
  versión en disco"*; there is **no compare control**. The disk version's text is printed inside the
  panel, so the action is possible by reading — the sentence is advice about the screen, not a false
  claim about a button.
- `operationDraft` (**es**) says *"Carga la versión en disco"*; the control says *"Cargar la versión
  del disco"*. The English is verbatim.

Nothing here is untrue. It is Low because a person hunting for a named button may not find one.

### O1 — **`browser.recovery.committed`'s second clause is true and self-caused.** Observation

*"The file it went into has been written to since this panel opened"* is drawn immediately after the
panel's **own** create wrote it (P27–P30, P33, P34, both languages). The sentence attributes the write
to nobody and is accurate; a reader may still take it as news of an external change. No defect is
claimed.

### O2 — **The mover's close control is one word from the conflict panel's keep control, in Spanish.** Observation

P50 draws `[Dejarlo donde está]` (`browser.matchMove.close`) and `[Dejarlo como está]`
(`keepOperation`) on the same surface. They are distinct — this is **not** M1 — but they differ by one
word, and the mover is the only one of the three operation surfaces where the collision was avoided.

### O3 — **The instrument's final report has no wait, and P39 sampled the duplicator's panel before its acknowledged save answered.** Observation. An instrument limitation, not an application defect

P39 (`duplicator-exact:en`) ends with the acknowledgeable-finding panel — *"The duplicate keeps the
same trigger definition as its source … Save anyway / Leave this as it is"* — rather than the written
panel, because `duplicatorPlan` presses *Save anyway* and then calls `reportFinal`, which does not
wait. **The file was written correctly**: `bytes=MATCH` and `backups=PRESENT`. **P53 re-ran the same
case in the same language** and drew *"The file was written… This snippet has been copied…"*, with
identical bytes; P15 (4b) and P40 (Spanish) drew it too. So the early sample is a race in the
reporter, not behaviour. Recorded rather than repaired, because repairing it would have meant editing
the probe.

### O4 — **Three recovery sentences are the only user-facing claims in this phase backed by bytes, and all three hold.** Observation, positive

`transfer.omitted`, `browser.recovery.position` and `browser.recovery.what`'s quoting clause are each
checked against `editor-recovery-create-expected.yml` and `creator-recovery-create-expected.yml` in
§4.2, and each is true of the bytes in both languages. **This is the harness's only independent
evidence about a sentence, and it is worth naming that it was spent on the three sentences it could
reach.**

### O5 — **The recovery form's destination list and the creator's own list disagree, correctly, and this reading shows both.** Observation

One row in the recovery form (P27, P28, P33, P34) against two in the creator's own list (P45, P46).
`recoveryDestinationsOf` carries only eligible files while `matchCreation.ts` lists every file with a
typed refusal, and `browser.recovery.destinationScope` says so on screen.

### Things that are **not** findings of this reading

- **The conflict panel's controls being below the fold is not a new finding** — L2 says so, and it is
  `reveal.ts`'s stated behaviour.
- **`section.recovery`'s zero height is not a reading failure and not a mismeasurement** — M2 says
  which it is.
- **Nothing about hole 1.** See §7.

---

## 7. Is any finding a defect in what is written to a user's file? **No.**

**All twenty-seven launches answered `bytes=MATCH`**, each against the document its case names:
thirteen against an authored expected-bytes document, fourteen against a fixture the case must leave
unchanged. The thirteen that wrote left a backup directory, and twelve of them said so — the
thirteenth drew no ending sentence at all (O3). The fourteen that did not write left no backup
directory and said nothing was written. The fifth prediction fixture matched on its first launch in
both languages.

**M1 and M2 are both about a screen.** M1's two controls neither write nor refuse a write; its worst
outcome is a discarded set-up. M2 is a box's height. L1, L2 and L3 are about where text is and what
it names. **No finding of this reading touches the bytes.**

---

## 8. What this reading does **not** establish

3b §8, 3c-1 §7, 3d-2a §6, 4a §6 and 4b §10 are inherited whole. What matters most for a reader of
this file:

**8.1 Hole 1 is untouched, and this reading may not say otherwise.** `browser.notice.gone`'s second
producer — `repairSelection`'s `clearSelection` arm, `src/lib/browser/selection.ts:292` — was not
reached by 4b, and closing it is not step 5's to do with a launch. 4b §5 gives the five-link chain in
the code. All eight notices this step drew came from `reresolve`'s **length** arm, exactly as 4b's
four did. **No launch attempted the other producer, and no launch could have distinguished "unreachable"
from "not attempted."**

**8.2 A transcript cannot fail because a sentence is untrue.** Every judgement in §4 is a reader's,
made by comparing a claim against the code and — in the four cases §4.2 and §4.4 name — against the
bytes or the filesystem. For every other sentence, what is established is that those words were on
screen.

**8.3 There is still no invoke spy and no command counter.** *The refused create issued exactly one
command* and *the reload wrote nothing* are **not** established. What P31, P32 and the ten reload
launches show is a final filesystem state equal to the fixture with no backup directory; a write
producing identical bytes, or a transient one undone before the launch ended, would leave the same
artifacts.

**8.4 The overlap M2 names was never constructed.** It is inferred from markup plus one measured
control roll. No launch drew a host outcome panel under an open recovery form.

**8.5 The flex-shrink cause was read, not sampled.** No computed style was read in the window, which
would have needed a probe edit. Every measurement is consistent with the cause given and none
contradicts it.

**8.6 `HTMLElement.click()` is not a mouse click.** No plan used the keyboard, tabbed, or produced an
untrusted-event refusal. **Focus order and keyboard operability of the recovery panel are untested by
every launch here**, and M1's two same-labelled controls were never reached by tabbing, which is the
route on which identical labels are worst.

**8.7 The adoption arm is invisible.** `installed` and `alreadyThere` both reach the same drawn state,
so no launch here distinguishes them.

**8.8 The fixture shape is still the easy one.** Double-quoted triggers, one leading comment, LF
endings, no BOM, no block scalars, no item-owned comments, no blank-line runs, no second sequence, no
read-only file, no package. **R38 is untouched: none of the fifteen corpus fixtures `CLAUDE.md` §4
lists has been through this harness.**

**8.9 Sixteen of the thirty-one case-table rows have never been launched by any step of this phase.**
Fifteen distinct cases have now run — 4b's fourteen plus `editor-recovery-create`. The sixteen that
have not are `editor-collision`, `editor-fallback`, `editor-satisfied`, `editor-ambiguous`,
`editor-missing`, `editor-ineligible`, `editor-empty-satisfied`, `creator-anchor`,
`creator-anchor-gone`, `deleter-changed`, `duplicator-changed`, `mover-changed`, `mover-reordered`,
`mover-reordered-end`, `mover-after` and `mover-after-changed`. **A case-table row is not evidence.**
Four expected-bytes documents remain predictions compared against nothing.

**8.10 The band is one viewport.** Everything in §3 is measured at 1180 × 728. A taller window would
put L1's sentence and L2's controls inside the band and would change nothing about M1 or M2.

**8.11 No finding of any earlier reading was re-checked**, except where §3.3 reproduces a documented
behaviour, and nothing here is a reading of 3c-2's or 3d-2b's ledgers.

**8.12 The window's own claim that a draft survives is not checked.** `browser.recovery.what`'s
*"Creating it discards nothing you have here"* is about the host surface's draft after a recovery
create, and no reporter in this harness looks at the host surface after the recovery form finishes.

---

## 9. Privacy, verified rather than assumed

- **No launch artifact contains any path under `$HOME`.** Swept over all twenty-seven `probe.log`
  files for the owner's home path and for the real espanso config's file names: no hit.
- **The real espanso configuration was never opened.** Every launch points `XDG_CONFIG_HOME` at the
  synthetic two-file tree `launch.sh` writes and `HOME` at an empty per-launch directory, so neither
  candidate `resolve_config_dir()` probes can reach it.
- **No `.espansoconfig-backups` exists outside the launch trees.** Checked directly at both candidate
  real-config locations; neither exists.
- **Every fixture is neutral** — `:alpha`, `:beta`, `:gamma`, `:probe`, and a synthetic profile that
  says so in its own first line. Nothing quoted in this record is anybody's configuration.
- This record says **`$HOME`** rather than spelling the owner's home path, which was 4b's Low finding.

---

## 10. The gates, re-run **with the harness in the tree**

```sh
cargo test --workspace   # 1112 passed, 0 failed
npm test                 # 1768 passed, 51 files
npm run check            # 424 files, 0 errors, 0 warnings
npm run build            # 181 modules transformed
```

**All four match 4b's figures exactly.** That is expected: no production source and no probe source
changed in this step.

**The 181 was checked, not accepted.** `CLAUDE.md` records that the old regression shorthand — "a jump
to ~180" — now sits within one of a legitimate count, so the number alone decides nothing. The bundle
was searched for `svelte/internal/server`, `svelte/server` and `async_hooks`, and **none of the three
is present**. 181 is 4a's production 180 plus `src/probe.ts` — one new `.ts` module, no styles.

**These are with-harness figures and must never be carried forward as production numbers.** Step 6
deletes the harness and re-derives `1767 / 423 / 180 / 1112` on a harness-free tree.

---

## 11. Verdict

**The reading is complete and the phase's exit for step 5 is met.** Twenty-seven launches, all six
surfaces in both languages, every one with its four-part conjunction judged and recorded. The two
rectangles 4b measured are judged: one is a correct layout seen at the wrong scroll position, and one
is a real collapse whose only cost is latent. Two Mediums, three Lows and five Observations; **no
High**, and **no defect in what is written to a user's file**.

**The one finding that could not have been found any other way is M1**, and it was found because the
brief insisted on both languages on every surface rather than in aggregate. The instrument prints
control labels; it cannot compare two of them; and no suite in this repository checks that two
controls drawn together say different things.

**What step 6 inherits.** The tree is `/private/tmp/espansoconfig-harness-2c-4c/`, 2.1 GB, with
`launches/P01…P53`, three manifests, and the four harness paths still uncommitted in the working
tree. Step 6 deletes it and re-derives the harness-free gate figures.
