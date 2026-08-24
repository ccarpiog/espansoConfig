# Phase 2c-5 step 6b — the bilingual window reading over the restore surface

**LAUNCHES P63–P98 TAKEN; §12'S TWELVE RE-TAKES TAKEN AS P87–P98 (§13), EACH ON A VISIBLY
PRESENTED WINDOW.** This record was written in four parts plus a review disposition: part 1 covers
the first six restore cases (twelve launches, P63–P74; §3), part 2 the remaining five (ten
launches, P75–P84; §6), §11 is the fix round — §4's **Medium** (the refused read's wording) fixed,
proven and re-taken as **P85/P86**, §7's **Low** (the conflict-moment covering) **accepted as
recorded** — §12 is the round-1 phase review's disposition: the twelve launches that printed
`visibility=hidden` stand as document-and-filesystem readings, and each owed a re-take whose own
transcript prints `visibility=visible` — and **§13 is those twelve re-takes, P87–P98, each
accepted on that term**. No launch failed, none was superseded, and no number was reused. No
manifest is written here; the closure sub-step writes it after this record, as the final
post-image.

Step 2c-5-6 is the one step of this phase that owes a WKWebView reading
(`docs/reviews/phase-2c-5-design.md` Q7, items 5 and 6). It was split by the orchestrator into 6a —
the instrument extension, complete, `docs/decisions/2c-5-6a-instrument-extension.md` — and **6b,
this reading**. 6a proved every new case with a launch in one language each; 6b re-takes every
restore state in **both** languages and takes the judgements 6a deferred. Every launch here is a
short, single-purpose run into a fresh bundle path, per `2c-5-5a-instrument-rebuild.md` §3's recipe,
with the language chosen **through the picker** by the plan's `:en`/`:es` suffix — never assumed
from the environment (`2c-2-2-window-reading.md` §1.2's correction stands: the WebKit data store
follows the bundle identifier every probe bundle shares).

**The binary every launch pins** is 6a's build,
`c4f2ae029dbd2096278c3fb39a739c51e0422178c22040fb9265449508dba659` — verified against
`target/debug/espansoconfig` before the first launch, and recorded by every launch below from its
own retained bundle copy (`bytes.txt`'s `binary=` line digests the copy inside that launch's
`.app`). No rebuild was run and no driver, probe or product file was edited by this step. No
artifact binds this executable to a source snapshot; 5a §6.4's limitation is inherited whole.

**The scoping resolution, taken by the orchestrator with the design in hand.** Q7 item 6 of
`docs/reviews/phase-2c-5-design.md` is the authoritative specification of this reading, and the
states it enumerates are **restore states only** — missing root, recognised/unrecognised batches,
valid and non-UTF-8 entries, the byte-preview, the refusals, withdrawal, acknowledgement, the
conflict-and-adoption chain, and the committed outcomes. `2c-5-5a-instrument-rebuild.md` §8.3's
sentence that "2c-5-6 owes both languages on every surface" (and §4's matching aggregate-coverage
statement) spoke in the context of that step's **twelve write-surface proof cases** — the editor,
creator, deleter, mover, duplicator and raw-editor launches §4 had just taken in one language each —
and the write surfaces had their own bilingual window readings in their own phases
(`2c-2-2-window-reading.md`, `2c-3b-2-window-reading.md`, `2c-3c-3-window-reading.md`, 2c-4a-3c's
and 2c-4c's readings). This step therefore reads the **restore surface** in both languages, state by
state, and re-reads no write surface. Both sources are cited here so the narrowing is a recorded
decision and not a silent omission.

## 1. Preconditions, verified before the first launch

- `/private/tmp/espansoconfig-harness-2c-5/` present exactly as 6a left it — the five scripts,
  thirteen fixtures, the launch directories P49–P62/N09/C11–C15, and the four 6a/5b manifests. The
  tree is volatile and has been lost twice; it was not rebuilt or altered by this step.
- `shasum -a 256 target/debug/espansoconfig` answered `c4f2ae02…9508dba659`, 6a §2.4's digest.
- `git status --short --untracked-files=all` listed exactly the four harness paths (`src/main.ts`,
  `src-tauri/src/main.rs` modified; `src/probe.ts`, `src-tauri/src/probe.rs` untracked). No git
  command that changes anything was run by this step.

## 2. The reading's rules, restated once

One plan per launch, fresh bundle path, runs serial, the window unoccluded. Numbering continues 6a's
(P63+), increments per launch actually taken, and never reuses a number; a failed or superseded
launch would be retained under its own number as P54 and P57 are. **Every check below is an
independent `probe.log` or `bytes.txt` line; the script conjoins nothing, and every conjunction in
this record is this reader's** — `failed-lines=0` beside `end-lines=1` beside an empty `probe.err`
beside the byte lines is a conjunction a reader makes, on every launch. Quoted screen sentences stay
in the launch's own language. The geometry reporter runs only on tails that call it (preview,
reload); none of part 1's six cases calls it, and no call was added. Geometry that does appear (step
boxes, control sizes, the conflict tail's `reach` line) compares with nothing outside the launch
that measured it (5a §6.8). The no-write equivalence of 5a §6.1 binds every `unchanged`-shaped
reading below: there is still no invoke spy, so `tree-diff=0` and `backup-tree=SAME` are readings of
final bytes.

All twelve launches reported viewport `1180x728 dpr=2 hasFocus=true visibility=visible`, reached
`--- end` (`reached-end=yes end-lines=1`), counted `failed-lines=0`, and left `probe.err=0 bytes`.
Those five readings are repeated per launch below only where one differs — none does.

## 3. The twelve launches — six cases, each `:en` then `:es`

### 3.1 P63 — `restore-none:en` — the listed-and-empty catalogue, English

The one case that seeds no catalogue. After *List them again*, the batches step
(`box=658,248,491x186`) quotes **both** empty-state sentences: *"There is no backups folder yet,
which is the ordinary state of a configuration espansoConfig has never saved."*
(`code.backupRootState.missing`) and *"The backups folder was listed and holds no folder this app
recognises as a backup batch."* (`browser.restore.batchesNone`) — a missing root drawn as an
outcome, not a failure. The plan stops there: `final blocks=0`, `notice=absent`.

Byte lines: `bytes=MATCH` (base-r0), `backups=none` (both halves of the search finding nothing),
`tree-diff=0 lines`, `entry-cmp=unseeded`, `backup-tree=unseeded batch=none`,
`batches=before:0 after:0`. The reader's conjunction: an empty catalogue was listed, nothing was
written anywhere, and no backup root appeared.

### 3.2 P64 — `restore-none:es` — the same state, Spanish

The same walk; the batches step (`box=658,265,491x220`) quotes *"Todavía no hay carpeta de copias,
que es el estado normal de una configuración que espansoConfig nunca ha guardado."* and *"La carpeta
de copias se listó y no tiene ninguna carpeta que esta aplicación reconozca como lote de copias."* —
sentence for sentence the state P63 drew, in Spanish, and byte-line for byte-line the same block
(`bytes=MATCH`, `backups=none`, `tree-diff=0`, `unseeded`/`unseeded`, `before:0 after:0`). This pair
also re-takes 5b's P53 (the same case, Spanish, on the older binary) on this build.

### 3.3 P65 — `restore-prepare:en` — the question reached and declined, English

The full catalogue → entry → candidate walk in English — *"The backups folder is there and was
listed."*, the row *"Backup batch named 2026-08-20T101500Z"*, the entry row `match/conflict.yml`
with *"named for a file inside your configuration folder"*, the marker skip sentence, then the
candidate step quoting *"346 bytes of UTF-8, and 346 characters"*, the `listedAgrees` sentence and
the entry's whole text. The question block (`box=658,574,491x101`) holds the two sentences and
exactly two controls, *[Replace entire file with the shown text 275x29] [Do not replace this file
161x27]*. After *Do not replace this file*, the actions row returns to exactly one control,
*[Prepare to replace file 158x27]*, and `final blocks=0` — nothing was sent, so there is no outcome
panel to read.

Byte lines: `bytes=MATCH` (base-r0), `tree-diff=0`, `entry-cmp=DIFFER` (the target still holds R0
while the entry holds the restore text — the expected reading of a launch that wrote nothing),
`backup-tree=SAME`, `batches=before:1 after:1` (a declined question takes no backup). The
`backups=PRESENT` line is the **seeded** catalogue, not a by-product of any save; the `batches=`
counts are what say no batch was added — a reader's conjunction.

### 3.4 P66 — `restore-prepare:es` — the same decline, Spanish

The same walk in Spanish — *"La carpeta de copias existe y se listó."*, *"Lote de copias llamado
2026-08-20T101500Z"*, *"346 bytes de UTF-8 y 346 caracteres"* — the question block with
*[Sustituir el archivo entero por el texto mostrado 340x29] [No sustituir este archivo 172x27]*,
and after *No sustituir este archivo* the single control *[Preparar la sustitución del archivo
235x27]* with `final blocks=0`. Byte lines identical in shape to P65's. This pair re-takes 5b's P51
on this build.

### 3.5 P67 — `restore-replace:en` — the committed whole-file replacement, English

The same walk to the question, then the confirmation. The outcome: `beforeConfirm
outcomePanel=absent`, `outcome changed revisions of 0` (a committed raw replacement carries no
revision run), and the three outcome marks as three independent dictionary-resolved readings —
`replaced=present`, `nothingToWrite=absent`, `windowOutOfStep=absent`. The final block
(`box=658,532,491x157`) quotes *"The file was written. What is on disk now is exactly the text that
was sent."*, the backup-taken sentence (*"A copy of this file as it was before this session's first
change to it was kept…"*) and the every-snippet-has-a-new-identity sentence, with *Dismiss*. The
actions row afterwards holds *Prepare to replace file* above the `alreadyRestored` sentence
(*"This file's whole text has been replaced from here…"*).

Byte lines: `bytes=MATCH` against `restore-entry.yml` — the restored file is byte-identical to the
preview fixture, which is Q7 item 6's byte-compare taken by the script's own `cmp` —
`entry-cmp=MATCH`, `backup-tree=SAME batch=2026-08-20T101500Z` (the batch restored **from** is
untouched), `batches=before:1 after:2` (the restore's own backup minted one new batch), and
`tree-diff=18 lines` which this reader read whole: exactly two things, `Only in
….espansoconfig-backups: 2026-08-24T134233Z` and the target's own change, nothing else in the tree
moved.

**The displaced-bytes reading, taken by hand as 6a §5's third bullet requires.** The minted batch
`2026-08-24T134233Z` holds `.espansoconfig-batch` plus `match/conflict.yml`, and `cmp` of that entry
against `fixtures/base-r0.yml` answers **identical** — the restore backed up exactly the bytes it
displaced. A reader's step, outside the byte oracle, recorded as such.

### 3.6 P68 — `restore-replace:es` — the committed replacement, Spanish

The same walk and confirmation in Spanish. The marks: `replaced=present`, `nothingToWrite=absent`,
`windowOutOfStep=absent`. The final block (`box=658,481,491x208`) quotes *"Se ha escrito el archivo.
Lo que hay ahora en el disco es exactamente el texto que se envió."*, *"Se ha guardado una copia de
este archivo tal y como estaba antes del primer cambio de esta sesión…"* and the identity sentence
(*"…cada fragmento de este archivo tiene ahora una identidad nueva, así que cierra esto y vuelve a
abrir el archivo."* as the actions-row sentence puts it), with *Descartar*. The actions row holds
*Preparar la sustitución del archivo* above the Spanish `alreadyRestored` sentence. **This is the
first time the committed-restore final block has been drawn in Spanish on any launch** — P50 took it
in English and P61's Spanish outcome was the nothing-to-write success.

Byte lines: `bytes=MATCH` (restore-entry.yml), `entry-cmp=MATCH`, `backup-tree=SAME`,
`batches=before:1 after:2`, `tree-diff=18 lines` — read whole: the minted batch
`2026-08-24T134251Z` and the target's change, nothing else. **The displaced-bytes reading, taken by
hand in this launch too**: the minted batch holds the marker plus `match/conflict.yml`, and `cmp`
against `base-r0.yml` answers **identical**.

### 3.7 P69 — `restore-conflict:en` — the conflict between question and confirmation, English

The walk to the question, then `--- writer second wrote=yes` after the question was drawn and
before the confirmation, so the send met a revision the pane never saw. The conflict panel
(`box=658,78,491x611`) holds three revisions — `2543689c… / beba1b1f… / beba1b1f…`, this tree's R0
and R1 digests — and the reader's conjunction 3b §8.9 defines: `expected ≠ found`,
`diskRevision == found`. Exactly two choices, *[Leave this as it is 108x23] [Load the version on
disk 147x23]*, with `keepMyDraft=absent keepMyRequest=absent` and `readiness ready=absent
readyOperation=absent` — no reapply of either kind on this surface. The final block quotes
*"Nothing was written. The file on disk is exactly as it was."*, the withdrawn-confirmation sentence
(*"Your confirmation is withdrawn, because it was given against the reading this window held
before…"*), the three revision sentences, the retained operation (*"You asked to replace this
file's whole text with the text of the backup entry selected here."*) and the version on disk drawn
in full — R1's text. The actions row holds *Prepare to replace file* above the `conflictShowing`
sentence. The choices were reported, never pressed — pressing them is the reload case's work, which
part 2 reads.

Byte lines: `bytes=MATCH` against `elsewhere-r1.yml (R1)` — the file ends as the second writer left
it, the conflict having written nothing — `tree-diff=5 lines` (exactly the writer's own change),
`entry-cmp=DIFFER`, `backup-tree=SAME`, `batches=before:1 after:1`: a conflict takes no backup.

### 3.8 P70 — `restore-conflict:es` — the same conflict, Spanish

The same chain; the conflict panel holds the same three revision digests (the fixtures decide them,
not the language) with the choices *[Dejarlo como está 113x23] [Cargar la versión del disco
159x23]*, `keepMyDraft=absent keepMyRequest=absent`, readiness absent. The final block quotes *"No
se ha escrito nada. El archivo del disco sigue exactamente igual."*, *"Tu confirmación queda
retirada, porque la diste sobre la lectura que esta ventana tenía antes…"*, the three revision
sentences, the retained operation (*"Pediste sustituir todo el texto de este archivo por el texto
de la entrada de copia de seguridad seleccionada aquí."*) and the version on disk whole. The
actions row holds *Preparar la sustitución del archivo* above the Spanish `conflictShowing`
sentence. **This is the first Spanish drawing of the restore surface's conflict panel.** The `reach`
line reads `scrollTop=1375 scrollHeight=2020` where P69's read `1338/1983` — Spanish prose is
longer, and per 5a §6.8 neither number compares with anything outside its own launch.

Byte lines identical in shape to P69's: `bytes=MATCH` (R1), `tree-diff=5`, `entry-cmp=DIFFER`,
`backup-tree=SAME`, `batches=before:1 after:1`.

### 3.9 P71 — `restore-skipped:en` — the unrecognised batches beside the recognised one, English

The junk-seeded catalogue (three unrecognised entries, one per `BatchSkipped` arm the scanner
rejects after reading — `ForeignName`, `NotADirectory`, `NoMarker`). The batches step
(`box=658,248,491x304`) quotes the recognised row *"Backup batch named 2026-08-20T101500Z"* **and**
the skipped report with all three reason sentences — *"not named the way espansoConfig names a
backup folder, so it was left exactly as it is"*, *"carries no ownership marker in a format
espansoConfig recognises, so it was left exactly as it is"*, *"not a folder, so it was left exactly
as it is"* — with `batchesIncomplete=absent`, agreeing with `BatchSkipped::is_unreadable` being
false of all three seeded shapes. `final blocks=0`.

Byte lines: `bytes=MATCH` (base-r0), `tree-diff=0` (the junk untouched, symlink included),
`entry-cmp=DIFFER`, `backup-tree=SAME`, `batches=before:4 after:4` — the counts count directory
entries of the root, three of the four being the junk, exactly as 5b §5 discloses.

### 3.10 P72 — `restore-skipped:es` — the same report, Spanish

The same state; the batches step (`box=658,265,491x321`) quotes *"Lote de copias llamado
2026-08-20T101500Z"* and the report *"Entradas de la carpeta de copias que no son lotes de copias
reconocidos:"* with the three reasons — *"no tiene el nombre con el que espansoConfig nombra una
carpeta de copias, así que se dejó tal cual"*, *"no lleva una marca de propiedad con un formato que
espansoConfig reconozca, así que se dejó tal cual"*, *"no es una carpeta, así que se dejó tal
cual"* — and `batchesIncomplete=absent`. **This is the first Spanish drawing of the skipped-batches
report.** Byte lines identical in shape to P71's, `batches=before:4 after:4` included.

### 3.11 P73 — `restore-notutf8:en` — the refused entry read, English

The walk to the entry row, the press, and the entries step re-drawn as the refusal: *"This app did
not get what it asked the backups folder for. What it reports beside this is the reason."*
(`browser.restore.entriesRefused`) beside *"espansoConfig could not complete this backup-catalogue
request. What it reports beside this is the reason."* (`code.commandError.backupReadFailed`) — and
nothing else about the cause. `candidateStep=absent`, `final blocks=0`. **This is the first English
drawing of the refused read** (6a's P56 took it in Spanish). The wording judgement this state
carries is §4 below.

Byte lines: `bytes=MATCH` (base-r0), `tree-diff=0`, `entry-cmp=DIFFER` (the target against the
non-UTF-8 entry — `cmp` is a byte comparison and needs no decoding), `backup-tree=SAME`,
`batches=before:1 after:1`.

### 3.12 P74 — `restore-notutf8:es` — the same refusal, Spanish

The same chain; the refusal draws *"Esta aplicación no obtuvo lo que pidió a la carpeta de
copias. Lo que informa al lado de esto es el motivo."* beside *"espansoConfig no pudo completar
esta solicitud del catálogo de copias. Lo que se indica junto a esto es el motivo."*, with
`candidateStep=absent` and `final blocks=0`. Byte lines identical in shape to P73's. Both launches
drew both sentences wholly in the launch's own language; the bilingual half of this state is clean.

## 4. The deferred judgement — the refused read's wording (6a §4.3), taken here

**What is drawn, in both languages, is two generic sentences that each promise a reason and a
screen that never delivers one.** The English pair ends, twice, with *"What it reports beside this
is the reason."*; the Spanish pair with *"Lo que informa al lado de esto es el motivo."* / *"Lo que
se indica junto a esto es el motivo."* Each sentence's "beside this" points at the only other thing
in the panel — the **other** generic sentence. The reason itself — that the entry is not valid
UTF-8, with the offset of the first offending byte — is never drawn, in either language, though the
wire carries it (`BackupReadFailedError.error` holds `NotUtf8 { offset: 0 }` for this fixture) and
the dictionaries hold a sentence written precisely for it: `code.backupReadError.notUtf8` — *"That
entry is not valid UTF-8 text, so espansoConfig cannot show it. The first byte that is not is at
offset {offset}."* / *"Esa entrada no es texto UTF-8 válido, así que espansoConfig no puede
mostrarla. El primer byte que no lo es está en la posición {offset}."*

**The mechanism, checked against the shipped code rather than assumed.** `RestorePane.svelte`'s two
failed panels (lines 655 and 723) render `t('browser.restore.entriesRefused')` beside
`tIpcFailure(failed)`; `tIpcFailure` routes a command failure through `describeCommandError`
(`src/lib/i18n/codes.ts:599`), which substitutes only **top-level** `path`/`offset` operands — and
`backupReadFailed` carries its `BackupReadError` nested at `error.error`, so nothing substitutes
and the generic `code.commandError.backupReadFailed` sentence stands alone. `tBackupReadError`
(`src/lib/i18n/index.ts:1814`) — the accessor built to render the inner reason, `notUtf8` offset
included — has **no component caller**: a search over `src/` finds only its declaration and its
test-side uses. Both dictionary sentences and the accessor exist, tested for parity and placeholder
agreement; what no suite pins is that any screen ever calls it — exactly the i18n-suite gap
`CLAUDE.md` records.

**The judgement: Medium.** The refusal itself is correct and safe — nothing is written, the
candidate step never appears, the walk can be resumed, and the two sentences are honestly generic
about *that* a read failed. What makes it a defect and not a wording taste is that **each drawn
sentence claims a reason is on screen and none is**: "what it reports beside this is the reason" is
a promise the panel breaks by construction, since the only thing beside either sentence is the
other sentence making the same promise. A person whose backup entry cannot be shown is told twice
to look beside the sentence for the reason and finds none — and the purpose-built reason sentence,
offset and all, sits unreachable in both dictionaries. Not High: no write path is involved, nothing
committed is misreported, and no data can be lost from this state. Not Low: the drawn text is
self-referentially false on this screen, in both languages, on a state a person in genuine trouble
(a corrupted backup) is exactly the one to meet.

**A component fix is warranted and none was made here.** The shape of the fix would be for the
failed panels to render the inner `BackupReadError` through `tBackupReadError` when the failure is
`backupReadFailed` — a `RestorePane.svelte` change, which is product code, and any component fix
invalidates and re-takes the affected reading (Q7 item 6's own rule). This step touched no product
code; the finding is recorded for the orchestrator to decide the fix sub-step, and P73/P74 stand as
the reading of the shipped wording.

## 5. Part 1's accounting

- **Launches taken: twelve, P63–P74, none failed, none superseded.** Every number was used once and
  the sequence continues from 6a's P62.
- Per case: `restore-none` P63/P64, `restore-prepare` P65/P66, `restore-replace` P67/P68,
  `restore-conflict` P69/P70, `restore-skipped` P71/P72, `restore-notutf8` P73/P74 — `:en` then
  `:es` in every pair.
- All twelve: `failed-lines=0`, `end-lines=1`, `probe.err=0 bytes`, `binary=c4f2ae02…`, and every
  byte line agreed with its case's expected shape (§3's sections state each).
- The displaced-bytes reading was taken by hand in **both** replace launches (P67, P68), each
  minted batch's entry `cmp`-identical to `base-r0.yml`.
- One judgement was taken (§4): the refused read's wording, **Medium**, finding recorded, product
  code untouched.
- The repository after part 1: `git status --short --untracked-files=all` lists the four harness
  paths plus this record untracked, and nothing else. No git command that changes anything was run.
  The 2c-5-7 deletion list is not lengthened: no decoy, no outside-tree file and no symlink was
  created by any of these twelve launches; the tree gains the twelve launch directories P63–P74.

## 6. The ten launches of part 2 — five cases, each `:en` then `:es`

§1's preconditions were re-verified before P75: the tree present exactly as part 1 left it — the
five scripts, the thirteen fixtures, the four manifests, and the launch directories through P74
(the N and C directories included); `shasum -a 256 target/debug/espansoconfig` re-answering
`c4f2ae02…9508dba659`; `git status --short --untracked-files=all` listing the four harness paths
plus this record, and nothing else. §2's rules bind every launch below unchanged; numbering
continued at **P75** and ended at **P84**, one number per launch actually taken, none failed and
none superseded.

All ten launches reached `--- end` (`reached-end=yes end-lines=1`), counted `failed-lines=0`, left
`probe.err=0 bytes`, and recorded `binary=c4f2ae02…` from their own retained bundle copies. All ten
reported viewport `1180x728 dpr=2 hasFocus=false visibility=hidden` — a line the plan prints at its
own start, recorded as printed. **What a completed plan establishes about presentation: nothing.**
A first version of this preamble derived from the completed waits that a window occluded throughout
"could not have" run its timers to `--- end`; the phase review found the derivation unsound and it
is withdrawn — the driver's own six-second sentence names a grace interval an occluded webview gets
before its timers stop, a satisfied wait returns immediately and imposes no minimum duration, the
mandatory settles total well under that grace even on the reload chain, and no retained artifact
reads visibility after plan start. These ten transcripts are therefore readings of the webview's
**document** — the sentences drawn, the geometry rectangles, the `elementFromPoint` answers — and
of the **filesystem** (the byte lines, which no visibility state touches), taken while the window
gave no evidence of being presented; §12 carries the disposition and the re-takes owed. The
`hasFocus=false` beside it bounds the focus walks below: `focus()` and
`document.activeElement` are readings inside the webview's own document, not claims about
system-level window focus. These shared readings are repeated per launch only where one differs —
none does.

### 6.1 P75 — `restore-preview-bytes:en` — the byte-name preview, English

The bilingual re-take of P58's case on the same build. The candidate step (`box=658,651,491x274`)
quotes *"82 bytes of UTF-8, and 80 characters"* (the +2 is the BOM's), the `listedAgrees` sentence,
the untouched-text sentence (*"A character no font draws is written below by name; the text itself
is untouched."*), and all three names around the fixture's own text — *"byte order mark U+FEFF"*,
*"invisible character U+0007"*, *"carriage return U+000D"*. `final blocks=0`, `notice=absent` — a
preview sends nothing.

The geometry reporter, on the preview tail: five controls, every one `tabIndex=0`; the hit test
answered `isTheControl` on four and `descendantOfTheControl` on the entry row; the focus walk
`focused=true` on all five, `focus restored=false` (6a §3.3's disclosed limit of the restore
attempt). Per 5a §6.8 none of these rectangles or reach numbers compares with anything outside this
launch — P58's included.

Byte lines: `bytes=MATCH` (base-r0), `tree-diff=0`, `entry-cmp=DIFFER`, `backup-tree=SAME`,
`batches=before:1 after:1`. The reader's conjunction: the preview drew the entry's bytes by name
and nothing anywhere was written.

### 6.2 P76 — `restore-preview-bytes:es` — the same preview, Spanish

The same walk; the candidate step (`box=658,705,491x274`) quotes *"82 bytes de UTF-8 y 80
caracteres según los cuenta Unicode"*, *"Un carácter que ninguna tipografía dibuja se escribe abajo
con su nombre; el texto en sí no se toca."*, and the three names — *"marca de orden de bytes
U+FEFF"*, *"carácter invisible U+0007"*, *"retorno de carro U+000D"*. **This is the first time the
three character names have been drawn in Spanish on any launch.** The geometry block has the same
shape as P75's — five controls, all `tabIndex=0`, four `isTheControl` and the entry row
`descendantOfTheControl`, the focus walk clean — measured entirely within this launch. Byte lines
identical in shape to P75's.

### 6.3 P77 — `restore-withdraw:en` — the confirmation withdrawn by a change, English

The walk to the question (`box=658,574,491x101`), its two controls *[Replace entire file with the
shown text 275x29] [Do not replace this file 161x27]* — then *List them again* pressed inside the
batches step, and the actions row comes back to exactly one control, *[Prepare to replace file
158x27]*, with `question=absent` and `final blocks=0`. **This is the first English drawing of the
withdrawal by change** (6a's P59 took it in Spanish): a catalogue refresh withdraws the
confirmation with the candidate kept, which is why plain prepare is immediately offered again —
where P65's decline was the person answering the question's own control. Byte lines: `bytes=MATCH`
(base-r0), `tree-diff=0`, `entry-cmp=DIFFER`, `backup-tree=SAME`, `batches=before:1 after:1`.

### 6.4 P78 — `restore-withdraw:es` — the same withdrawal, Spanish

The same chain, sentence for sentence the state P59 drew, re-taken beside its English pair: the
question with *[Sustituir el archivo entero por el texto mostrado 340x29] [No sustituir este
archivo 172x27]*, then *Volver a listarlos*, and afterwards `question=absent` with the single
control *[Preparar la sustitución del archivo 235x27]* and `final blocks=0`. Byte lines identical
in shape to P77's.

### 6.5 P79 — `restore-findings:en` — the acknowledgement walked to a committed write, English

P60's case re-taken. The walk to the unparseable candidate (*"68 bytes of UTF-8, and 68
characters"*, the fixture's text whole), prepare, confirm — and the refused outcome
(`box=658,500,491x224`): *"Nothing was written. The file on disk is exactly as it was."*, the
verdict (*"The result contains something that looks wrong. Saving it needs your confirmation
first."*), the whole-document sentence, *"espanso will not load this file until this is fixed."*,
the parser's own position (*"The YAML reader stopped at line 3, column 0."*), and the
`acknowledgedAsksAgain` sentence — `willNotLoad=present` and `acknowledgedAsksAgain=present` as
separate dictionary-resolved readings — with *[Save anyway] [Leave this as it is]*. *Save anyway*
re-asks the destructive question (both action controls drawn again), and the second confirmation
commits: `replaced=present`, `nothingToWrite=absent`, `windowOutOfStep=absent`, the final block
with the backup-taken sentence, and the actions row afterwards holding *Prepare to replace file*
above the `alreadyRestored` sentence.

Byte lines: `bytes=MATCH` against `restore-broken.yml` — **the unparseable text is on disk**, the
raw-save-may-write-what-the-parser-rejects ruling measured through the restore path in this
language too — `entry-cmp=MATCH`, `backup-tree=SAME`, `batches=before:1 after:2`, and
`tree-diff=14 lines` read whole: exactly two things, `Only in ….espansoconfig-backups:
2026-08-24T135206Z` and the target's own change, nothing else in the tree moved.

**The displaced-bytes reading, taken by hand as 6a §5's third bullet requires.** The minted batch
`2026-08-24T135206Z` holds `.espansoconfig-batch` plus `match/conflict.yml`, and `cmp` of that
entry against `fixtures/base-r0.yml` answers **identical** — the restore backed up exactly the
bytes it displaced. A reader's step, outside the byte oracle, recorded as such.

### 6.6 P80 — `restore-findings:es` — the same acknowledgement chain, Spanish

The same walk and both confirmations in Spanish. The refused outcome (`box=658,448,491x241`)
quotes *"No se ha escrito nada. El archivo del disco sigue exactamente igual."*, *"El resultado
contiene algo que parece incorrecto. Guardarlo requiere tu confirmación previa."*, *"espanso no
cargará este archivo mientras no se corrija."*, the parser's position (*"El lector de YAML se
detuvo en la línea 3, columna 0."*), and *"Aceptar lo que se informa arriba no envía nada. La
confirmación la gastó el intento que fue rechazado, así que se vuelve a hacer la pregunta…"* with
*[Guardar de todos modos] [Dejarlo como está]* — `willNotLoad=present`,
`acknowledgedAsksAgain=present`. **This is the first Spanish drawing of the parse-finding refusal
and its acknowledgement re-ask.** The second confirmation commits — `replaced=present`,
`nothingToWrite=absent`, `windowOutOfStep=absent` — with the Spanish final block and *Preparar la
sustitución del archivo* above the Spanish `alreadyRestored` sentence.

Byte lines identical in shape to P79's, `tree-diff=14` read whole (the minted batch
`2026-08-24T135229Z` and the target's change, nothing else). **The displaced-bytes reading, taken
by hand in this launch too**: the minted batch holds the marker plus `match/conflict.yml`, and
`cmp` against `base-r0.yml` answers **identical**.

### 6.7 P81 — `restore-nothing:en` — the `committed: false` success, English

The same walk, question and confirmation as a replace, against an entry byte-identical to the
target — and the outcome is the documented success in which nothing was written:
`nothingToWrite=present`, `replaced=absent`, `windowOutOfStep=absent`, and the final block
(`box=658,611,491x78`) quoting *"The text was already exactly what the file held, so nothing was
written. Both checks still ran; this is a save with nothing to do."* with *Dismiss*. **This is the
first English drawing of the nothing-to-write final block** (6a's P61 took it in Spanish). The
actions row afterwards offers plain *Prepare to replace file* again — **not** `alreadyRestored`,
agreeing with `applyRestore`'s `restored: outcome.committed`.

Byte lines: `bytes=MATCH` (base-r0), `tree-diff=0`, `entry-cmp=MATCH`, `backup-tree=SAME`,
`batches=before:1 after:1` — no backup minted, `batches` unchanged: a `committed: false` success
takes no backup, agreeing with `save.rs`'s `backup = if committed`.

### 6.8 P82 — `restore-nothing:es` — the same success, Spanish

The same chain, sentence for sentence the state P61 drew, re-taken beside its English pair:
`nothingToWrite=present` (*"El texto ya era exactamente el que tenía el archivo, así que no se ha
escrito nada. Las dos comprobaciones se han hecho igualmente; es un guardado que no tenía nada que
hacer."*), `replaced=absent`, `windowOutOfStep=absent`, *Descartar*, and afterwards plain
*Preparar la sustitución del archivo* — not `alreadyRestored`. Byte lines identical in shape to
P81's.

### 6.9 P83 — `restore-reload:en` — the conflict adopted and the candidate written over the adopted base, English

P62's case re-taken, the full chain in one launch. The writer moves the file after the question
(`--- writer second wrote=yes`); the confirmation meets a revision the pane never saw; the
conflict panel (`box=658,78,491x611`) holds `2543689c… / beba1b1f… / beba1b1f…` — this tree's R0
and R1 digests, and the reader's conjunction: `expected ≠ found`, `diskRevision == found` — with
exactly two choices *[Leave this as it is 108x23] [Load the version on disk 147x23]*,
`keepMyDraft=absent keepMyRequest=absent`, `readiness ready=absent readyOperation=absent` — no
reapply of either kind on this surface.

The geometry reporter, run **while the conflict is on screen**: the pane at its maximum scroll
(`scrollTop=1338 scrollHeight=1983 clientHeight=645`), seven controls, every one `tabIndex=0`.
Four upper-pane controls answered `outsideViewport` (*Close*, *List them again*, the batch row,
the entry row — a scroll state, not a covering); the two conflict choices `isTheControl`; and the
sticky actions row pinned at `y=-3` against a scroller whose box begins at `y=44`, with the
disabled prepare control (`box=658,2`, `disabled=true`) answered
`somethingElse(tag=header class="svelte-whg6dh")` — **6a §4.9's covering, reproduced on this
launch's own measurements**; §7 is the judgement. The focus walk: six controls `focused=true`,
prepare `skipped=disabled`, `focus restored=false`.

The reload warning quotes the withdrawal sentence (*"Your confirmation is withdrawn, because it
was given against the reading this window held before…"*), the not-discarded sentences, the three
revision sentences, the retained operation (*"You asked to replace this file's whole text with the
text of the backup entry selected here."*) and the version on disk whole — R1's text. *Load it and
keep the text selected here* clears the panel (`afterReload outcomePanel=absent`) and the actions
row returns to enabled *[Prepare to replace file 158x27]*. The second prepare/confirm then
**commits**: `replaced=present`, `nothingToWrite=absent`, `windowOutOfStep=absent`, the final
block with the backup-taken sentence.

Byte lines: `bytes=MATCH` against `restore-entry.yml`, `entry-cmp=MATCH`, `backup-tree=SAME`,
`batches=before:1 after:2`, `tree-diff=18 lines` read whole: exactly two things, the minted batch
`2026-08-24T135325Z` and the target's own change. **The displaced-bytes reading, taken by hand**:
the minted batch holds the marker plus `match/conflict.yml`, and `cmp` of that entry against
`fixtures/elsewhere-r1.yml` answers **identical** — the displaced text is the **writer's**. **The
adoption-`installed` discrimination, stated as the reader's conjunction it is (6a §4.9)**: a
session resends its frozen base, so had the reload left the base where it was, the second
confirmation would have met R1 with an R0 base and conflicted again — instead it committed, the
restored file is the candidate's bytes, and the minted backup holds R1's. The transcript prints no
`DiskAdoptionOutcome` value and cannot; 6a §6.3 is why `alreadyThere` cannot have been the answer
here.

### 6.10 P84 — `restore-reload:es` — the same chain, Spanish

The same chain; the conflict panel holds the same three revision digests (the fixtures decide
them, not the language) with the choices *[Dejarlo como está 113x23] [Cargar la versión del disco
159x23]*, `keepMyDraft=absent keepMyRequest=absent`, readiness absent. The geometry reporter at
the conflict moment reads the same shape entirely within this launch: `scrollTop=1392
scrollHeight=2037` (Spanish prose is longer; per 5a §6.8 neither number compares with anything
outside this launch, P83's included), four catalogue controls `outsideViewport`, both choices
`isTheControl`, and the disabled *Preparar la sustitución del archivo* (`box=658,2`,
`disabled=true`) answered `somethingElse(tag=header)` — the covering of §7, in this language too.
The focus walk: six `focused=true`, prepare `skipped=disabled`, `restored=false`.

The reload warning quotes *"Tu confirmación queda retirada, porque la diste sobre la lectura que
esta ventana tenía antes: tendrías que leer este texto frente a la versión recién cargada y
confirmar otra vez."*, the three revision sentences, the retained operation (*"Pediste sustituir
todo el texto de este archivo por el texto de la entrada de copia de seguridad seleccionada
aquí."*) and the disk version whole. **This is the first Spanish drawing of the reload warning and
of its confirm control** — *"Cargarla y mantener aquí el texto elegido"* — where P70 stopped at
reporting the conflict's choices without pressing them. The reload clears the panel, the second
prepare/confirm commits (`replaced=present`, `nothingToWrite=absent`, `windowOutOfStep=absent`),
and the Spanish final block ends the plan.

Byte lines identical in shape to P83's, `tree-diff=18` read whole (the minted batch
`2026-08-24T135352Z` and the target's change, nothing else). **The displaced-bytes reading, taken
by hand in this launch too**: the minted batch's `match/conflict.yml` `cmp`s **identical** to
`elsewhere-r1.yml` — the writer's text, which is only possible if the write happened over the
adopted disk version.

## 7. The carried judgement — the conflict-moment covering (6a §4.9), taken here

**What both reload launches measured, each within itself.** With the conflict panel in its read
state the pane sits at its maximum scroll, the sticky actions row has slid to `y=-3` against a
scroller whose box begins at `y=44`, and the one control that row holds — prepare,
`disabled=true` at that moment — has its centre answered `somethingElse(tag=header)`: the app
header is what a pointer at that point would meet. P83 and P84 each reproduce this on their own
rectangles; no number below is compared across launches or with 6a's P62.

**The judgement: Low.** Nothing reachable needs the covered control at the covered moment: it is
disabled, the state's two exits — the conflict choices — answered `isTheControl` and took
programmatic focus, and the four controls above are `outsideViewport`, which is a scroll state and
not a covering. A control that is disabled conveys nothing actionable while covered, so no press
is lost and no sentence on screen is broken. What keeps this from PASS is the second half of the
question 6a deferred: **whether the covering survives into a state where the control is enabled
was not measured, and these launches cannot rule it out.** The reporter runs on the preview tail
and the conflict moment only; after the reload clears the panel, the enabled prepare control is
read from the DOM and pressed — and `HTMLElement.click()` bypasses hit testing (5a's standing
limit), so that press proves the handler, not the pointer path, and no rectangle and no hit test
exist for the enabled-state actions row. The layout demonstrably lets the sticky row sit under the
header; recording Low names that hazard with its unmeasured half stated (§9), claiming neither
that it matters nor that it cannot.

Not Medium: no measured state has an enabled or needed control covered, the covered state's exits
hit cleanly in both languages, and the state resolves through either choice. Not PASS: a reading
that measured a control's centre answering a different element does not get to call the layout
clean on states it never measured.

**Beyond this judgement, part 2 found no new defect.** §4's Medium — the refused read's wording —
stands exactly as part 1 recorded it, untouched by these ten launches; P73/P74 remain the reading
of that state, and no product code was touched by this part either.

## 8. The whole reading against Q7 item 6 — every state, in both languages or dispositioned

`docs/reviews/phase-2c-5-design.md` Q7 item 6 is the specification; 6a §1's table is the
disposition source for every state no launch can reach, and its arguments are 6a §6's. Every row
below names the launches of **this** reading (P63–P84, all on the binary `c4f2ae02…`); 6a's
one-language proof launches P55–P62 stand behind them as instrument evidence, not as this
reading's.

| Q7 item 6 state | English | Spanish |
|---|---|---|
| missing root | P63 | P64 |
| recognised batches | P65 (re-drawn by every later English catalogue walk: P67, P69, P71, P73, P75, P77, P79, P81, P83) | P66 (P68, P70, P72, P74, P76, P78, P80, P82, P84) |
| unrecognised batches | P71 | P72 |
| valid entries | P65 (and every later English walk that loaded one) | P66 |
| non-UTF-8 entries | P73 | P74 |
| BOM/CRLF/control-character preview | P75 | P76 |
| open-surface refusal | **unreachable through this instrument — 6a §6.1** (6a §1 dispositions it; driven by 2c-5-4's mounted matrix) | same argument, both languages |
| confirmation withdrawal | by the question's own control: P65; by a change: P77 | P66; P78 |
| target changed after preview | the send-time discovery (the conflict): P69; the window-side half (the base re-pointed, the confirmation withdrawn on adoption): P83. The `targetMoved` refusal **sentence**: unreachable persistently — 6a §6.2 | P70; P84 |
| parse-finding acknowledgement | P79 | P80 |
| adoption `installed` | P83 — discriminated by the reader's conjunction §6.9 states, per 6a §4.9 | P84 |
| adoption `alreadyThere` | **unreachable — 6a §6.3**, licensed by Q7's own "where reachable" qualifier | same |
| adoption `refused` | **unreachable — 6a §6.3** | same |
| committed restore | P67 (also P79, P83) | P68 (also P80, P84) |
| `committed: false` | P81 | P82 |
| committed-but-reprojection-failed | **unreachable — 6a §6.4**, with P60 as its measured half; every committed launch of this reading read `windowOutOfStep=absent` | same |
| keyboard / focus / scroll / viewport reachability / hit testing | the reporter blocks of P75 (preview tail) and P83 (conflict moment); keyboard activation and real Tab traversal are **not measurable** — 6a §3.3 — and are carried as a limit (§9), never as a claim | P76; P84 |

Q7 item 6's byte-compare obligations, dispositioned beside the table: **the restored file against
the preview fixture** is the `bytes=MATCH` line of every committed launch — P67/P68 and P83/P84
against `restore-entry.yml`, P79/P80 against `restore-broken.yml` — taken by the script's own
`cmp`; **the pre-restore backup against the exact displaced bytes** is the six by-hand readings
(P67, P68 in part 1; P79, P80, P83, P84 in part 2), each a reader's `cmp` outside the byte oracle;
**unrelated files and bytes unchanged** is each launch's `tree.diff` read whole with
`backup-tree=SAME` beside it, and `tree-diff=0` on every launch that owed no write.

## 9. The limits of this reading, bounded

Each item is a limit of these artifacts, not a promise about anything else (5a §6.1's binding).

- **There is still no invoke spy and no command counter.** Every `unchanged`-shaped reading —
  `tree-diff=0`, `backup-tree=SAME`, `batches` unchanged — is a reading of final bytes, and the
  no-write equivalence of 5a §6.1 binds all of them.
- **Geometry compares with nothing outside the launch that measured it** (5a §6.8): not across
  P75/P76, not across P83/P84, not with 6a's P58 or P62, not with any earlier record. Every
  rectangle, reach number and hit test in §6 is bounded to its own launch.
- **The displaced-bytes readings are the reader's**, taken by hand with `cmp` outside the byte
  oracle; no `bytes.txt` line carries them, exactly as 6a §5's third bullet states.
- **Keyboard activation and real Tab traversal are not measurable by this instrument** (6a §3.3):
  a synthetic `KeyboardEvent` runs no default activation in this webview and no page JavaScript
  can synthesize a real Tab. What the reporter gives is programmatic focusability, `tabIndex` and
  document order — from which sequential reachability is a derivation this reader makes — and the
  pointer-side hit tests. No real Tab walk was taken by hand in this reading; the derivation is
  what stands.
- **`HTMLElement.click()` bypasses hit testing**, so every press in every plan proves a handler,
  not a pointer path; the reporter's `elementFromPoint` lines are the only pointer-side evidence,
  and they exist only where the reporter runs — the preview tail and the conflict moment. **No
  launch measures the actions row's geometry after the reload clears the panel**, which is why
  §7's judgement carries its unmeasured half rather than a verdict on enabled-state covering.
- **`--- end` is printed unconditionally and a transcript sentence prints whether or not it is
  true** — 5a's standing limits, inherited whole; every conjunction in §6 is this reader's.
- **All ten part-2 launches printed `visibility=hidden hasFocus=false` at plan start, and nothing
  establishes any of them was ever presented** — the completed-timers derivation this bullet once
  leaned on is withdrawn (§12; the phase review found it unsound). Those transcripts stand as
  readings of the webview's document and of the filesystem, not of a presented screen; the
  re-takes §12 names are the screen evidence still owed. Every `focused=true` is a reading of
  `document.activeElement` inside the webview, not of system-level focus.
- **No artifact binds the executable to a source snapshot** — 5a §6.4, inherited whole; every
  launch pins which bytes ran (`binary=` per launch: `c4f2ae02…` through P84, `371fc7c1…` on
  P85/P86), nothing pins what source built them.
- **The four unreachable states of §8 stay unread** on 6a §6's arguments, and the un-demanded
  states of 6a §1's closing list (`batchesLoading`, `batchesIncomplete`, `entriesNone`,
  `entriesIncomplete`, `listedDiffers`, `listedUnreadable`, `sendFailed`, `mayHaveWritten`,
  `findingsAreStale`, the other `EntrySkipped` arms, and the `readOnly`, `noCandidate` and
  `inFlight` refusals) remain undrawn deliberately — limits of these artifacts, each with its
  argument recorded there.
- **This reading read the restore surface only** — the preamble's scoping resolution; no write
  surface was re-read, and nothing here is evidence about one.

## 10. Part 2's accounting, and the whole reading's

- **Launches taken in part 2: ten, P75–P84, none failed, none superseded**; every number used
  once, continuing part 1's P74. The whole reading is **twenty-two launches, P63–P84**.
- Per case: `restore-preview-bytes` P75/P76, `restore-withdraw` P77/P78, `restore-findings`
  P79/P80, `restore-nothing` P81/P82, `restore-reload` P83/P84 — `:en` then `:es` in every pair.
- All ten: `failed-lines=0`, `end-lines=1`, `probe.err=0 bytes`, `binary=c4f2ae02…`, and every
  byte line agreed with its case's expected shape (§6's sections state each).
- The displaced-bytes reading was taken by hand in **all four** committed part-2 launches: P79 and
  P80 each minted a batch whose entry `cmp`s identical to `base-r0.yml`; P83 and P84 each minted a
  batch whose entry `cmp`s identical to `elsewhere-r1.yml`.
- One carried judgement was taken (§7): the conflict-moment covering, **Low**, with its unmeasured
  half named. No new defect was found; §4's **Medium** stands from part 1. Both findings await the
  fix round; any component fix invalidates and re-takes the affected reading (Q7 item 6's own
  rule), and this record stays open for those re-takes.
- The repository after part 2: `git status --short --untracked-files=all` lists the four harness
  paths plus this record untracked, and nothing else. No git command that changes anything was
  run, no rebuild was run, and no driver, probe or product file was edited.
- The 2c-5-7 deletion list is not lengthened: no decoy, no outside-tree file and no symlink was
  created by any of these ten launches; the tree gains the ten launch directories P75–P84. **No
  manifest was written by this part** — the closure sub-step writes it after the fix round, as the
  final post-image.

## 11. The fix round — §4's Medium fixed and re-taken, §7's Low accepted

This section is the fix round §4 and §7 awaited. §§1–10 stand exactly as parts 1 and 2 wrote
them; where a sentence there spoke of "every launch", it spoke of P63–P84 and stands for them —
the corrections this round owes are stated here, never edited into the older text. Numbering
continued at **P85** and ended at **P86**; neither failed, neither was superseded.

### 11.1 The fix — the promised reason drawn, through its own accessor

Two files changed, and **no dictionary did** — both sentences the fix draws were already in both
dictionaries, tested for parity and placeholder agreement, and unreachable:

- **`src/lib/components/RestorePane.svelte`.** Both failed panels — the batches catalogue's and
  the entries catalogue's, which have the same defect shape — now draw a third sentence when the
  failure carries a nested `BackupReadError`. `backupReadReasonOf(failure)`, a helper added to
  this component's script block, answers the reason a `backupReadFailed` command failure nests at
  `error.error`, and `null` for every other failure; a non-null answer is rendered through
  **`tBackupReadError`**, the typed accessor built for that namespace — never a hand-built key,
  which would opt out of the one check that catches a missing key (`CLAUDE.md`'s rule, and the
  reason the accessor route is the fix rather than a `t()` call). The two generic sentences
  **stay**: the fix makes their *"what it reports beside this is the reason"* true rather than
  replacing them. `describeCommandError` is deliberately unchanged — it substitutes top-level
  operands only, and widening it to walk nested values would change every command error's
  rendering to fix one panel; the narrowing lives beside the two panels that need it.
- **`src/probe.ts`.** `reportRefusedEntryRead` gained a third dictionary-resolved wait —
  `named('code.backupReadError.notUtf8', { offset: 0 })`, the seeded fixture's own offset, since
  its first byte is `0xFF` (6a §2.2) — following the helper's existing resolution pattern
  exactly. No new case, so 5a §8.1's three-places rule is not triggered; `src-tauri/src/probe.rs`,
  `src/main.ts` and `src-tauri/src/main.rs` were not touched, and no harness script was edited.

### 11.2 The mounted evidence, and the arm no launch can reach

`RestorePane.test.ts` gained two cases, both driving the real component over the scripted
boundary:

- **the entries-refused arm**: a `backupReadFailed` read carrying `NotUtf8` with **offset 7** —
  chosen over the fixture's 0 so the case proves the operand travelled rather than a default —
  asserts the two generic sentences still stand, the specific sentence rendered with the offset
  substituted, and then re-renders the same mounted panel in Spanish and asserts the Spanish
  sentence, with nothing reaching the Tauri boundary;
- **the batches-refused arm**: a `backupReadFailed` listing carrying `RootNotADirectory` asserts
  the specific sentence with its **path** operand substituted.

The batches-refused state is **instrument-unreachable** — the seeded root is always a private
directory the runner owns, so no reachable launch can draw a refused batch listing — and that
mounted case is therefore this arm's whole evidence, permanently, exactly as the open-surface
refusal's is (6a §6.1's shape). The entries-refused arm has both kinds: the mounted case and the
two launches below.

### 11.3 The gates, predicted before measuring

Predicted: the test count moves by the two new cases and nothing else moves — no new file, no new
module, no Rust change. Measured:

| Gate | Prediction | Measurement |
|---|---|---|
| `cargo test --workspace` | 1153 passed, 0 failed | **1153** passed, 0 failed |
| `npm run check` | 432 files, 0 errors, 0 warnings | **432** files, 0 errors, 0 warnings |
| `npm test` | 2126 passed | **2126** passed (56 files) |
| `npm run build` | 185 modules | **185** modules transformed |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | finished, no warnings |
| `cargo fmt --check` | clean | clean |
| bundle oracle, server-only (`\$\$payload\|head_payload\|push_element`) | absent | **absent** (`rg -c` matched nothing) |
| bundle oracle, client-only (`window\.__svelte\|svelte-trusted-html`) | 2 | **2** |

Prediction and measurement agree on every row; the with-harness baseline moves to
**1153 / 432 / 2126 / 185**.

### 11.4 The rebuild, and the binary the re-takes pin

One rebuild after the component and driver edits and before P85, in 5a §3's order: `npm run
build` (**185 modules**), `touch src-tauri/build.rs`, `cargo build -p espansoconfig --features
custom-protocol` (finished, no errors). `shasum -a 256 target/debug/espansoconfig` answers
**`371fc7c19888f20dbe3c028e52e9de6b0b9a2a5e98c58221fed8bbcc78a809a0`** — not 6a's `c4f2ae02…`,
as expected of a rebuild whose embedded `dist` changed — and both launches below record that
digest from their own retained bundle copies. No artifact binds this executable to a source
snapshot; 5a §6.4's limitation is inherited whole. The preamble's binary sentence — "the binary
every launch pins is 6a's build" — spoke of P63–P84 and stands for them.

### 11.5 P85 — `restore-notutf8:en` — the fixed refusal, English

The same walk as P73's, on the new binary. The entries step re-drawn as the refusal now holds
**three** sentences: *"This app did not get what it asked the backups folder for. What it reports
beside this is the reason."* beside *"espansoConfig could not complete this backup-catalogue
request. What it reports beside this is the reason."* beside **"That entry is not valid UTF-8
text, so espansoConfig cannot show it. The first byte that is not is at offset 0."** — the
purpose-built sentence, offset substituted, in this launch's language. What each generic sentence
promises is now beside it. `candidateStep=absent`, `final blocks=0`, `notice=absent`;
`failed-lines=0`, `end-lines=1`, `probe.err=0 bytes`, `binary=371fc7c1…`.

Byte lines, each agreeing with the case's expected shape: `bytes=MATCH` (base-r0), `tree-diff=0`,
`entry-cmp=DIFFER` (the target against the non-UTF-8 entry — `cmp` is a byte comparison and needs
no decoding), `backup-tree=SAME`, `batches=before:1 after:1` — a refused read writes nothing.

### 11.6 P86 — `restore-notutf8:es` — the same refusal, Spanish

The same chain, the language chosen through the picker (`lang picked=es lang=es`). The refusal
draws *"Esta aplicación no obtuvo lo que pidió a la carpeta de copias. Lo que informa al lado de
esto es el motivo."* beside *"espansoConfig no pudo completar esta solicitud del catálogo de
copias. Lo que se indica junto a esto es el motivo."* beside **"Esa entrada no es texto UTF-8
válido, así que espansoConfig no puede mostrarla. El primer byte que no lo es está en la posición
0."** — sentence for sentence P85's state, in Spanish. `candidateStep=absent`, `final blocks=0`,
`failed-lines=0`, `end-lines=1`, `probe.err=0 bytes`, `binary=371fc7c1…`; byte lines identical in
shape to P85's.

Both launches printed `visibility=hidden hasFocus=false` at plan start, and nothing establishes
either was presented — the derivation this paragraph once shared with §6's preamble is withdrawn
(§12), so P85 and P86 prove the fixed wording in the webview's **document**, and their re-takes on
a visibly presented window are owed with the rest. **P73 and P74 stay
retained as the readings of the older binary's wording, never deleted and never re-numbered**;
the non-UTF-8 row of §8's table is now read as P85/P86 on the fixed binary, with P73/P74 standing
behind them as the record of what shipped before the fix — stated here rather than edited there.

### 11.7 The re-take scope — why P85/P86 are the only launches owed

The component change is confined to the two failed-panel branches (`batches.kind === 'failed'`
and `entries.kind === 'failed'`), two imports, and a pure helper called from nowhere but those
two branches; the driver change is confined to `reportRefusedEntryRead`, which only the `notutf8`
tail calls. Among the states any launch can draw, only `restore-notutf8`'s refused entry read
passes through either branch: every other case's listings and reads succeed, and no reachable
launch can refuse the batch listing (§11.2's argument). So no other launch's drawn state passes
through the changed code, and no other re-take is owed — every other retained launch stands as
the reading of a state the fix did not touch.

### 11.8 §7's Low — the conflict-moment covering, accepted as recorded

**Disposition: accepted as recorded, with no change made.** The covered control is disabled at
the measured moment, the covered state's two exits — the conflict choices — hit-test
`isTheControl` and take programmatic focus in both languages, and the state resolves through
either choice, so no press is lost and no sentence on screen is broken. The unmeasured half —
whether the covering survives into a state where the control is enabled — **stays named as a
limit** (§9), claimed neither way. No component changed for it, so this disposition triggers no
re-take. Subject to the phase review, as every disposition in this record is.

### 11.9 The repository and the artifacts after the fix round

- `git status --short --untracked-files=all` lists the four harness paths, this record untracked,
  and the fix round's two product edits — `src/lib/components/RestorePane.svelte` and
  `src/lib/components/RestorePane.test.ts` modified — and nothing else. No git command that
  changes anything was run.
- `manifest-2c-5-6a-cases.sha256` still fails on exactly one entry, `src/probe.ts`;
  `manifest-2c-5-6a-fix.sha256` now fails on two — `src/probe.ts`, this round's edit, beside its
  already-failing entry for the 6a record (6a §10.1's disclosed write). Both failing sets are
  kept as the record of what changed; **no manifest is written by this round** — the closure
  sub-step writes the final post-image.
- The 2c-5-7 deletion list is not lengthened: no decoy, no outside-tree file and no symlink was
  created by either launch; the tree gains the two launch directories P85 and P86.

## 12. The round-1 phase review, and the disposition of its findings

One review round ran over the whole of 6b — this record against eleven sampled transcripts
spanning both parts, both languages and both binaries; the scoping resolution against the design's
own words; the §8 coverage table and its cited 6a §6 arguments against the shipped code; the fix
diff, its typed-accessor route and its re-take scope; both judgement dispositions; and a shape
sweep. The reviewer's sandbox was read-only and could not create the review file; the orchestrator
captured the final message verbatim to `docs/reviews/phase-2c-5-6b-reading.md` under a capture
note, exactly as every 6a-era verdict was captured. **The verdict was NOT READY, with one Medium
and one Low.** Everything else held: all eleven sampled transcripts record-exact, the coverage
table complete, all four unreachability arguments verified against the components, the fix and its
P85/P86-only re-take scope confirmed against `RestorePane.svelte`'s branches, and all six by-hand
displaced-bytes readings reproduced by the reviewer.

**Finding 1 (Medium) — the completed-timers derivation was unsound, and it stood in three
places** (§6's preamble, one §9 bullet, §11.6's closing paragraph). The derivation claimed a
window occluded throughout "could not have" run its plan to `--- end`; but the driver's own
six-second sentence names a grace interval before an occluded webview's timers stop, a satisfied
wait returns immediately and imposes no minimum duration, and the mandatory settles total well
under that grace even on the reload chain — so a completed plan is compatible with a window hidden
throughout, and no retained artifact reads visibility after plan start. **Disposition: the
derivation is withdrawn in all three places** (edited in place, each now stating what the
transcripts do establish), **and the twelve launches that printed `visibility=hidden` — P75–P84,
P85, P86 — are re-classified as readings of the webview's document and of the filesystem.** Their
byte lines are filesystem readings by the script and stand untouched; the displaced-bytes readings
stand with them. What they no longer claim is a presented screen — so **twelve re-takes are owed,
P87 upward, the same cases and languages on the same binary, each accepted only if its own
transcript prints `visibility=visible`**. They were not taken in the session that took this
disposition: at the orchestrator's check after the review the console answered
`CGSSessionScreenIsLocked = 1`, no launch can present behind a locked screen, and waking a locked
console is not this project's to do — the re-takes wait for an unlocked console, and this record
stays open for them. (The lock's own timestamp postdates most of the part-2 launches, so what
hid those windows during the run is unmeasured and stays unclaimed.)

**Finding 2 (Low) — one §9 bullet counted "three" unreachable states where §8 dispositions
four** (open-surface refusal, adoption `alreadyThere`, adoption `refused`,
committed-but-reprojection-failed). Fixed: the count reads four. An accounting error, not a
coverage omission — the reviewer verified the table itself is complete.

A fix is a change and its review is owed: the round scoped to the re-takes and to this
disposition's edits follows once the re-takes are taken.

## 13. The twelve re-takes — §12's screen evidence, taken on a presented window

This section is the re-take round §12 owed: the same six cases, `:en` then `:es`, each launch
accepted only on its own transcript printing `visibility=visible`. Numbering continued at **P87**
and ended at **P98**; none failed, none was superseded, and no number was reused. P75–P86 stay
retained exactly as §12 classified them — document-and-filesystem readings, never deleted and
never re-numbered — and nothing below edits any older section.

**The environment, read again before P87** (§12's lock check re-taken): `IOConsoleUsers` carries
no `CGSSessionScreenIsLocked` entry — the lock §12's session met is gone, the user on console —
and a display-asserting `caffeinate -d -u` ran through all twelve launches. What hid the part-2
windows stays unmeasured, exactly as §12 left it; this section claims only what these twelve
transcripts print.

**The binary every launch pins**: `shasum -a 256 target/debug/espansoconfig` re-answered
`371fc7c1…a809a0`, §11.4's digest, before the first launch, and all twelve launches record it from
their own retained bundle copies. **All twelve ran the fix-round build** — for the notutf8 pair
that is §12's own term, and for the ten part-2 cases it replaces P75–P84's `c4f2ae02…`, a
resolution the orchestrator took with §11.7 in hand: among reachable launches only
`restore-notutf8` passes through the code the fix changed, so the other five cases draw the same
states on either build, and re-taking them on the build that ships keeps every launch of this
round on one binary. §1's other preconditions were re-verified: the tree present exactly as the
fix round left it (the five scripts, thirteen fixtures, four manifests, and the launch directories
through P86), and `git status --short --untracked-files=all` listing exactly the four harness
paths — this record and the fix round's two product edits, uncommitted at §11.9's reading, were
committed by the orchestrator's checkpoint between §12 and this section, which is that
checkpoint's record and not this part's. No git command that changes anything was run by this
part; no rebuild was run; no driver, probe, script, fixture or product file was edited.

§2's rules bind unchanged — one plan per launch, fresh bundle path, runs serial, the language
through the picker, every conjunction a reader's. All twelve launches reported viewport `1180x728
dpr=2 hasFocus=true visibility=visible`, reached `--- end` (`reached-end=yes end-lines=1`),
counted `failed-lines=0`, left `probe.err=0 bytes`, and recorded `binary=371fc7c1…`; those
readings are repeated per launch below only where one differs — none does. The visibility line is
the plan-start reading §6's preamble describes, and **§12's acceptance term — the launch's own
transcript printing `visibility=visible` — is met by all twelve**; no retained artifact reads
visibility after plan start, a limit inherited whole, and the `hasFocus=true` beside it is this
round a reading taken on a window whose transcript reports it presented.

### 13.1 P87 — `restore-preview-bytes:en`

§6.1's state re-drawn presented. The candidate step (`box=658,651,491x274`) quotes *"82 bytes of
UTF-8, and 80 characters"* (the +2 is the BOM's), the `listedAgrees` sentence, the untouched-text
sentence, and the three names — *"byte order mark U+FEFF"*, *"invisible character U+0007"*,
*"carriage return U+000D"* — around the fixture's own text. The geometry reporter on the preview
tail: five controls, every one `tabIndex=0`; four `isTheControl` and the entry row
`descendantOfTheControl`; the focus walk `focused=true` on all five, `focus restored=false`
(6a §3.3's disclosed limit). `final blocks=0`, `notice=absent`. Byte lines: `bytes=MATCH`
(base-r0), `tree-diff=0`, `entry-cmp=DIFFER`, `backup-tree=SAME`, `batches=before:1 after:1`.

### 13.2 P88 — `restore-preview-bytes:es`

The same walk; the candidate step (`box=658,705,491x274`) quotes *"82 bytes de UTF-8 y 80
caracteres según los cuenta Unicode"* and the three names — *"marca de orden de bytes U+FEFF"*,
*"carácter invisible U+0007"*, *"retorno de carro U+000D"*. The geometry block has the same shape
as P87's — five controls, all `tabIndex=0`, four `isTheControl`, the entry row
`descendantOfTheControl`, the focus walk clean — measured entirely within this launch. Byte lines
identical in shape to P87's.

### 13.3 P89 — `restore-withdraw:en`

The question (`box=658,574,491x101`) with *[Replace entire file with the shown text 275x29]
[Do not replace this file 161x27]*, then *List them again* pressed inside the batches step, and
afterwards `question=absent` with the single control *[Prepare to replace file 158x27]* and
`final blocks=0`. Byte lines: `bytes=MATCH` (base-r0), `tree-diff=0`, `entry-cmp=DIFFER`,
`backup-tree=SAME`, `batches=before:1 after:1`.

### 13.4 P90 — `restore-withdraw:es`

The same chain: the question (`box=658,504,491x171`) with *[Sustituir el archivo entero por el
texto mostrado 340x29] [No sustituir este archivo 172x27]*, then *Volver a listarlos*, and
afterwards `question=absent` with *[Preparar la sustitución del archivo 235x27]* and
`final blocks=0`. Byte lines identical in shape to P89's.

### 13.5 P91 — `restore-findings:en`

The acknowledgement walked to a committed write. The refused outcome (`box=658,466,491x224`)
quotes *"Nothing was written. The file on disk is exactly as it was."*, the verdict, *"espanso
will not load this file until this is fixed."*, the parser's position (*"The YAML reader stopped
at line 3, column 0."*) and the `acknowledgedAsksAgain` sentence — `willNotLoad=present`,
`acknowledgedAsksAgain=present` — with *[Save anyway] [Leave this as it is]*. *Save anyway*
re-asks the destructive question, and the second confirmation commits: `replaced=present`,
`nothingToWrite=absent`, `windowOutOfStep=absent`, the final block with the backup-taken sentence,
and the actions row afterwards holding *Prepare to replace file* above the `alreadyRestored`
sentence.

Byte lines: `bytes=MATCH` against `restore-broken.yml`, `entry-cmp=MATCH`, `backup-tree=SAME`,
`batches=before:1 after:2`, `tree-diff=14 lines` read whole: exactly two things, the minted batch
`2026-08-24T162006Z` and the target's own change, nothing else in the tree moved. **The
displaced-bytes reading, taken by hand**: the minted batch holds `.espansoconfig-batch` plus
`match/conflict.yml`, and `cmp` of that entry against `fixtures/base-r0.yml` answers
**identical**.

### 13.6 P92 — `restore-findings:es`

The same walk and both confirmations; the refused outcome (`box=658,448,491x241`) quotes *"No se
ha escrito nada. El archivo del disco sigue exactamente igual."*, *"espanso no cargará este
archivo mientras no se corrija."* and *"El lector de YAML se detuvo en la línea 3, columna 0."*
with *[Guardar de todos modos] [Dejarlo como está]* — `willNotLoad=present`,
`acknowledgedAsksAgain=present` — and the second confirmation commits with the Spanish final
block and *Preparar la sustitución del archivo* above the Spanish `alreadyRestored` sentence.
Byte lines identical in shape to P91's, `tree-diff=14` read whole (the minted batch
`2026-08-24T162024Z` and the target's change, nothing else). **The displaced-bytes reading, taken
by hand in this launch too**: the minted entry `cmp`s **identical** to `base-r0.yml`.

### 13.7 P93 — `restore-nothing:en`

The `committed: false` success: `nothingToWrite=present`, `replaced=absent`,
`windowOutOfStep=absent`, the final block (`box=658,611,491x78`) quoting *"The text was already
exactly what the file held, so nothing was written. Both checks still ran; this is a save with
nothing to do."*, and the actions row afterwards offering plain *Prepare to replace file* again —
not `alreadyRestored`. Byte lines: `bytes=MATCH` (base-r0), `tree-diff=0`, `entry-cmp=MATCH`,
`backup-tree=SAME`, `batches=before:1 after:1` — no backup minted.

### 13.8 P94 — `restore-nothing:es`

The same chain: `nothingToWrite=present` (*"El texto ya era exactamente el que tenía el archivo,
así que no se ha escrito nada…"*, `box=658,594,491x95`), `replaced=absent`,
`windowOutOfStep=absent`, *Descartar*, and afterwards plain *Preparar la sustitución del
archivo*. Byte lines identical in shape to P93's.

### 13.9 P95 — `restore-reload:en`

The full chain. The writer moves the file after the question (`--- writer second wrote=yes`); the
conflict panel (`box=658,78,491x611`) holds `2543689c… / beba1b1f… / beba1b1f…` — `expected ≠
found`, `diskRevision == found`, the reader's conjunction — with exactly two choices *[Leave this
as it is 108x23] [Load the version on disk 147x23]*, `keepMyDraft=absent keepMyRequest=absent`,
`readiness ready=absent readyOperation=absent`. The geometry reporter at the conflict moment,
measured entirely within this launch: the pane at its maximum scroll (`scrollTop=1338
scrollHeight=1983 clientHeight=645`), seven controls all `tabIndex=0`, four upper-pane controls
`outsideViewport`, both choices `isTheControl`, and the disabled prepare control (`box=658,2`,
`disabled=true`) answered `somethingElse(tag=header)` — §7's covering, reproduced on a launch
whose transcript reports the window presented; the judgement stands as §11.8 disposed it, its
unmeasured half unchanged. The focus walk: six `focused=true`, prepare `skipped=disabled`,
`restored=false`. The reload warning quotes the withdrawal sentence, the three revision
sentences, the retained operation and the disk version whole; *Load it and keep the text selected
here* clears the panel (`afterReload outcomePanel=absent`), and the second prepare/confirm
commits: `replaced=present`, `nothingToWrite=absent`, `windowOutOfStep=absent`.

Byte lines: `bytes=MATCH` against `restore-entry.yml`, `entry-cmp=MATCH`, `backup-tree=SAME`,
`batches=before:1 after:2`, `tree-diff=18 lines` read whole: the minted batch `2026-08-24T162108Z`
and the target's own change, nothing else. **The displaced-bytes reading, taken by hand**: the
minted entry `cmp`s **identical** to `fixtures/elsewhere-r1.yml` — the displaced text is the
writer's, which is only possible if the write happened over the adopted disk version; the
adoption-`installed` discrimination is §6.9's reader's conjunction, unchanged.

### 13.10 P96 — `restore-reload:es`

The same chain; the conflict panel holds the same three revision digests with *[Dejarlo como está
113x23] [Cargar la versión del disco 159x23]*, and the geometry block reads the same shape
entirely within this launch (`scrollTop=1392 scrollHeight=2037`; four catalogue controls
`outsideViewport`, both choices `isTheControl`, the disabled *Preparar la sustitución del
archivo* answered `somethingElse(tag=header)`). The reload warning quotes *"Tu confirmación queda
retirada…"* and its confirm control *"Cargarla y mantener aquí el texto elegido"*; the panel
clears, and the second prepare/confirm commits. Byte lines identical in shape to P95's,
`tree-diff=18` read whole (the minted batch `2026-08-24T162128Z` and the target's change, nothing
else). **The displaced-bytes reading, taken by hand in this launch too**: the minted entry `cmp`s
**identical** to `elsewhere-r1.yml`.

### 13.11 P97 — `restore-notutf8:en`

The fixed refusal, presented: the entries step re-drawn with **three** sentences — the two
generic ones beside *"That entry is not valid UTF-8 text, so espansoConfig cannot show it. The
first byte that is not is at offset 0."* — with `candidateStep=absent`, `final blocks=0`,
`notice=absent`. Byte lines: `bytes=MATCH` (base-r0), `tree-diff=0`, `entry-cmp=DIFFER`,
`backup-tree=SAME`, `batches=before:1 after:1` — a refused read writes nothing.

### 13.12 P98 — `restore-notutf8:es`

The same chain (`lang picked=es lang=es`): the two generic sentences beside *"Esa entrada no es
texto UTF-8 válido, así que espansoConfig no puede mostrarla. El primer byte que no lo es está en
la posición 0."*, `candidateStep=absent`, `final blocks=0`. Byte lines identical in shape to
P97's.

### 13.13 The §8 rows, re-earned on a presented window

Every §8 row whose citations §12 re-classified now carries a launch whose own transcript prints
`visibility=visible`; the part-1 rows (P63–P74) printed it when taken and stand unchanged. The
table's part-2 and fix-round citations are re-earned so:

| §8 row | English | Spanish |
|---|---|---|
| BOM/CRLF/control-character preview | P87 | P88 |
| confirmation withdrawal by a change | P89 | P90 |
| parse-finding acknowledgement | P91 | P92 |
| `committed: false` | P93 | P94 |
| target changed after preview, the window-side half; adoption `installed` | P95 | P96 |
| non-UTF-8 entries — the fixed wording, with P85/P86 behind it and P73/P74 behind them | P97 | P98 |
| committed restore | P67, and now P91, P95 | P68, and now P92, P96 |
| keyboard / focus / scroll / viewport reachability / hit testing | the reporter blocks of P87 (preview tail) and P95 (conflict moment) | P88; P96 |

The four unreachable states stay dispositioned on 6a §6's arguments, untouched by this round; the
recognised-batches and valid-entries rows are additionally re-drawn by every catalogue walk
above.

### 13.14 The closure of §12's obligation, and this part's accounting

- **§12's obligation is discharged**: twelve re-takes owed, twelve taken — P87–P98, the six cases
  `:en` then `:es` — and every one accepted on its own transcript's `visibility=visible`. None
  failed, none was superseded, every number used once.
- The displaced-bytes reading was taken by hand in **all four** committed launches (P91, P92,
  P95, P96), each minted entry `cmp`-identical to its case's displaced fixture — `base-r0.yml`
  for the findings pair, `elsewhere-r1.yml` for the reload pair.
- **No new defect was found**: every drawn state agreed with the standing shape §6 or §11 states,
  §4's Medium stays fixed (P97/P98 draw all three sentences), and §7's Low stays accepted as
  recorded — the enabled-state covering remains unmeasured, exactly as §11.8 left it. No reporter
  call was added and no component changed, so no further re-take is owed by this part.
- The repository after this part: `git status --short --untracked-files=all` lists exactly the
  four harness paths **plus this record, modified by this very section's append** — the same
  self-listing §11.9's reading carried for its own edits. No git command that changes anything
  was run.
- The 2c-5-7 deletion list is not lengthened: no decoy, no outside-tree file and no symlink was
  created by any of these twelve launches; the tree gains the twelve launch directories P87–P98.
  **No manifest is written by this part** — the closure sub-step writes the final post-image.
- The review §12 named — scoped to these re-takes and to that disposition's edits — follows this
  section; nothing here pre-empts it.

---

**LAUNCHES P63–P98 TAKEN; §12'S TWELVE RE-TAKES TAKEN AS P87–P98, EACH TRANSCRIPT PRINTING
`visibility=visible`.** §11 is the fix round's record: §4's Medium is fixed, proven in the mounted
suite and drawn by P85/P86 in both languages on the rebuilt binary `371fc7c1…`; §7's Low is
accepted as recorded with its unmeasured half still named. §12 is the round-1 review's
disposition: the twelve `visibility=hidden` launches stand as document-and-filesystem readings —
and §13 is the screen evidence taken again: P87–P98 on an unlocked console, every case in both
languages, all twelve on `371fc7c1…`, no new defect found. The review scoped to the re-takes and
to §12's edits follows; the closure sub-step writes the manifest after this record, as the final
post-image.
