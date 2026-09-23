# Phase 2d-7-5 — G1: delivery, watcher and counters (window reading)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-5*, bound by §3 entries 15–19, 23 and
24; the G1 row list is the consult's (`docs/reviews/phase-2d-7-design.md` Q8, *G1*). What was done and
why, the acceptance clause by clause, and the open items are in [`2d-7-5-notes.md`](2d-7-5-notes.md).
**Instrument:** frozen. The four instrument paths and the fourteen harness files equal
[`2d-7-4-2-notes.md`](2d-7-4-2-notes.md) §5.3 and `/private/tmp/2d7-instrument-reviewed/SHA256SUMS`,
before the first launch and after the last (notes §1).
**Binary for every launch** (`G1-01` … `G1-10`, each launch's `binary.sha256`):
`53d84fb2f2060d03db217cd5381dbaceb884fa1fc236c99b6ce481e0adaa510b`. That is the binary
2d-7-4-2 §9.6 built from the final instrument bytes; it was not rebuilt.
**Harness:** `/private/tmp/espansoconfig-harness-2d-6-6c-2/launch-7.sh`, `5d5f6397…82ec`.

This is a **window reading with every visual claim unread.** It makes claims about what a WKWebView
window built from this tree dispatched, received and put in its DOM, and about the files on disk. The
claims rest on:
- ten launches of a hand-assembled bundle, each on its own bundle path and bundle identifier, and
  their transcripts (`launches/G1-*/probe.log`, `launch.txt`, `writers.log`);
- the probe's own reconciliation of Rust's tallies against the page's recorded commands, and of
  emitted wakes against delivered ones, at every checkpoint (entry 15);
- out-of-app comparisons: `launch-7.sh`'s tree diff and final file hashes, the script writers' own
  log, and one comparison of drawn text against fixture bytes (§5).

**The screen was locked for every launch.** Every launch's preflight and `lock-at-end` read:

```
--- preflight lock=locked rule=primary-locked primary="locked source=CGSessionCopyCurrentDictionary CGSSessionScreenIsLocked=1 kCGSessionOnConsoleKey=true" cross-check=ioreg:IOConsoleUsers[uid=501,onConsole=true].CGSSessionScreenIsLocked=true at=10:24:47.375
lock-at-end=locked (primary-locked)
```

So entry 18's first condition fails at every moment of this step. Every capture is the WebKit page
snapshot (`used=webview`), every beat reads `visibility=hidden focus=no`, and **no statement below is
a statement about what a person would see.** Each launch ran with `:keepalive`, which entry 18 permits
in a hidden launch; it is disclosed here. The keep-alive and the heartbeat keep the page busy with
`probe_plan` round trips (2d-7-4-2 notes §6 item 4). The only timing figures quoted below (a refresh
366 ms after a writer was asked, a drain issued 264 ms after a write) are **made under that load**,
and nothing is claimed from them beyond "within the plan's wait".

Every launch set its language through the picker (`--- language picked=en lang=en label=ok`), and
every launch was in English. G1 has no Spanish obligation: entry 25's Spanish half is per drawn
sentence, and G1 draws no sentence of its own.

---

## 1. The launches

| Launch | Plan | Terminal | `--- instrument` | `--- recorder-ordering` | Beats | Reconcile lines (VOID) | G1 rows it serves |
|---|---|---|---|---|---|---|---|
| `G1-01` | `both-roots:en:keepalive` | `--- end` | `ok probe-commands=14 page=14` | `verdict=ok` | 7 | 5 (0) | both roots; emits; watermark |
| `G1-02` | `burst-fast:en:keepalive` | `--- end` | ok 14/14 | ok | 7 | 4 (0) | burst |
| `G1-03` | `burst-slow:en:keepalive` | `--- end` | ok 14/14 | ok | 8 | 4 (0) | burst control; watermark |
| `G1-04` | `external-raw:en:keepalive` | `--- end` | ok 14/14 | ok | 15 | 2 (0) | raw-view refresh; watermark |
| `G1-05` | `status-membership:en:keepalive` | `--- end` | ok 14/14 | ok | 14 | 2 (0) | add and remove (probe writers); reopen (without a late callback); watermark reset |
| `G1-06` | `status-removed:en:keepalive` | `--- end` | ok 14/14 | ok | 6 | 2 (0) | remove (probe writer) |
| `G1-07` | `restore-registry:en:keepalive` | `--- end` | ok 14/14 | ok | 5 | 2 (0) | self-save, partial (§4) |
| `G1-08` | `burst-fast:en:keepalive` | `--- end` | ok 14/14 | ok | 7 | 4 (0) | burst, repeat |
| `G1-09` | `burst-slow:en:keepalive` | `--- end` | ok 14/14 | ok | 8 | 4 (0) | burst control, repeat |
| `G1-10` | `lifecycle-delivery:en:keepalive` | `--- end` | ok 14/14 | ok | 5 | 2 (0) | emits; delivery |

Every launch: `reached-terminal=yes alive-at-kill=yes`, `failed-lines=0`, `mismatch-lines=0`,
`void-lines=0`, `probe.err-bytes=0`, every witness `complete=yes`, the clipboard's change count 214
before and after, `home-files=0`, and `lsappinfo-bundle-id` equal to the launch's own
`cc.carpio.espansoConfig.probe.G1-NN`. **No launch had a Rust/page command mismatch**, so none was
voided and none re-run. No other launch name was spent in this step.

All ten used the harness's default hard set (`r0=hard-r0.yml r1=hard-alpha-changed-r1.yml
r2=hard-beta-changed-again-r2.yml r3=other-changed-r1.yml r4=hard-beta-removed-r4.yml r5=extra-r0.yml`),
with `config/default.yml` at its LF default (`cd5e2ead…`). No `--config` or `--conflict` was given.

---

## 2. Both roots — `G1-01`

The plan asks the script writer for `config/default.yml` (the CRLF+BOM successor
`config-crlf-bom-r1.yml`) and then for `match/conflict.yml`, with a checkpoint and a span around each.

```
--- script-write w1-1555 config/default.yml config-crlf-bom-r1.yml replace
--- script-seen w1-1555 target=config/default.yml first-change=101ms ino=404908347→404908446 size=77→125 sha=cd5e2ead72c2f1f8→09b80d14765dfefe t=1658ms
--- delivered n=1 handler=2943732190 eventId=0 payload={"workspace_epoch":1,"newest_sequence":1} t=1881ms
--- ipc #9 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=1 newest_sequence=1 discarded=0 observations=1 [Changed seq=1 doc=Addressable:config/default.yml prev=cd5e2ead72c2f1f8533bc64a81b72ee7ce914807c22f98dddaebc397f2f08419 disk=09b80d14765dfefef5705c502be09749e41360532e64952d92d4c91208e9160f content=Projected] t=1882ms dt=0ms
--- reconcile roots-config commands=equal(except-plugin:event) rust-surplus=[] page-surplus=[plugin:event|listen+1] probe-half=ok events=observed emitted=1 delivered=1
--- span roots-before→roots-config writes=0 write-commands=[] emitted+=1 delivered+=1 witness=unchanged(except xdg/espanso/config/default.yml:as-written=yes) identical=[] transient=[] changed=[xdg/espanso/config/default.yml] added=[] removed=[]
--- script-write w2-3674 match/conflict.yml hard-alpha-changed-r1.yml replace
--- script-seen w2-3674 target=match/conflict.yml first-change=204ms ino=404908345→404908474 size=825→836 sha=a569b4d9426631b0→0b6c6dfd8a2c1a05 t=3880ms
--- delivered n=2 handler=2943732190 eventId=0 payload={"workspace_epoch":1,"newest_sequence":2} t=4107ms
--- ipc #11 drain_external_changes args={"afterSequence":1} -> ok answer=epoch=1 newest_sequence=2 discarded=0 observations=1 [Changed seq=2 doc=Addressable:match/conflict.yml prev=a569b4d9426631b0a9b59ca7e3e26c3918f6d5f3371b6b0c6b2f4822a12e8322 disk=0b6c6dfd8a2c1a05466a3c4f1ac0781359a98999fba2dcd8e119e677a9af90db content=Projected] t=4109ms dt=1ms
--- reconcile roots-match commands=equal(except-plugin:event) rust-surplus=[] page-surplus=[plugin:event|listen+1] probe-half=ok events=observed emitted=2 delivered=2
--- span roots-config→roots-match writes=0 write-commands=[] emitted+=1 delivered+=1 witness=unchanged(except xdg/espanso/match/conflict.yml:as-written=yes) identical=[] transient=[] changed=[xdg/espanso/match/conflict.yml] added=[] removed=[]
--- drains roots count=3 [#8 afterSequence=0 -> ok observations=0 · #9 afterSequence=0 -> ok observations=1 · #11 afterSequence=1 -> ok observations=1]
--- span start→end writes=0 write-commands=[] emitted+=2 delivered+=2 witness=unchanged(except xdg/espanso/config/default.yml:as-written=yes · xdg/espanso/match/conflict.yml:as-written=yes) identical=[] transient=[] changed=[xdg/espanso/config/default.yml · xdg/espanso/match/conflict.yml] added=[] removed=[]
```

`launch.txt`, the writer's own record:

```
writer id=w1-1555 done status=0 final-sha256=09b80d14765dfefef5705c502be09749e41360532e64952d92d4c91208e9160f at=10:24:50.533
writer id=w2-3674 done status=0 final-sha256=0b6c6dfd8a2c1a05466a3c4f1ac0781359a98999fba2dcd8e119e677a9af90db at=10:24:52.766
```

Each root's write gave **one emit, one delivery and one drain whose `Changed` observation names that
root's file**, with `disk=` equal to the writer's `final-sha256`. Each change was followed by one
`reload_document` of that file (`#10` `config/default.yml`, answered `"line_ending":"Crlf"`; `#12`
`match/conflict.yml`). Both spans are `writes=0` with the witness unchanged except the one file the
script wrote, `as-written=yes`.

---

## 3. Burst against control — `G1-02`, `G1-08` (fast) and `G1-03`, `G1-09` (slow)

The script's own timing, from `writers.log` (`G1-02`; `G1-08` is the same schedule):

```
writer id=b1-1554 target=match/conflict.yml mode=replace gap=60ms writes=3 before-sha256=a569b4d9… at=10:25:09.956
write 1/3 mode=replace fixture=hard-alpha-changed-r1.yml start=+0.0ms took=0.3ms bytes=836 … after-sha256=0b6c6dfd… ok
write 2/3 mode=replace fixture=hard-beta-changed-again-r2.yml start=+60.0ms took=0.3ms bytes=842 … after-sha256=51104dae… ok
write 3/3 mode=replace fixture=hard-beta-removed-r4.yml start=+120.0ms took=0.3ms bytes=682 … after-sha256=edabfe42… ok
writer id=b1-1554 done status=0 final-sha256=edabfe428b0b1e509c3ad869b75b65baa5b0358b322f0bb554ebddd4de06f71b at=10:25:10.110
```

and (`G1-03`; `G1-09` the same):

```
writer id=b1-1559 target=match/conflict.yml mode=replace gap=600ms writes=2 before-sha256=a569b4d9… at=10:25:23.227
write 1/2 mode=replace fixture=hard-alpha-changed-r1.yml start=+0.0ms took=0.3ms bytes=836 … after-sha256=0b6c6dfd… ok
write 2/2 mode=replace fixture=hard-beta-changed-again-r2.yml start=+600.0ms took=0.7ms bytes=842 … after-sha256=51104dae… ok
writer id=b1-1559 done status=0 final-sha256=51104dae5ae5827b1dd201cf72935c229d588745b6ec71a2ed77452d2a0c8d85 at=10:25:23.881
```

**Fast, `G1-02`:**

```
--- delivered n=1 handler=2274453568 eventId=0 payload={"workspace_epoch":1,"newest_sequence":1} t=2168ms
--- ipc #9 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=1 newest_sequence=1 discarded=0 observations=1 [Changed seq=1 doc=Addressable:match/conflict.yml prev=a569b4d9426631b0a9b59ca7e3e26c3918f6d5f3371b6b0c6b2f4822a12e8322 disk=edabfe428b0b1e509c3ad869b75b65baa5b0358b322f0bb554ebddd4de06f71b content=Projected] t=2169ms dt=1ms
--- reconcile burst-fast-after commands=equal(except-plugin:event) rust-surplus=[] page-surplus=[plugin:event|listen+1] probe-half=ok events=observed emitted=1 delivered=1
--- span burst-fast-before→burst-fast-after writes=0 write-commands=[] emitted+=1 delivered+=1 witness=unchanged(except xdg/espanso/match/conflict.yml:as-written=yes) identical=[] transient=[] changed=[xdg/espanso/match/conflict.yml] added=[] removed=[]
--- drains burst-fast count=2 [#8 afterSequence=0 -> ok observations=0 · #9 afterSequence=0 -> ok observations=1]
```

`G1-08` repeats it: `#9 … observations=1 [Changed seq=1 … prev=a569b4d9… disk=edabfe42…]`,
`events=observed emitted=1 delivered=1`, span `emitted+=1 delivered+=1 witness=unchanged(except
xdg/espanso/match/conflict.yml:as-written=yes)`.

**Slow, `G1-03`:**

```
--- delivered n=1 handler=1860917186 eventId=0 payload={"workspace_epoch":1,"newest_sequence":1} t=2038ms
--- ipc #9 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=1 newest_sequence=1 discarded=0 observations=1 [Changed seq=1 doc=Addressable:match/conflict.yml prev=a569b4d9426631b0a9b59ca7e3e26c3918f6d5f3371b6b0c6b2f4822a12e8322 disk=0b6c6dfd8a2c1a05466a3c4f1ac0781359a98999fba2dcd8e119e677a9af90db content=Projected] t=2039ms dt=1ms
--- delivered n=2 handler=1860917186 eventId=0 payload={"workspace_epoch":1,"newest_sequence":2} t=2649ms
--- ipc #11 drain_external_changes args={"afterSequence":1} -> ok answer=epoch=1 newest_sequence=2 discarded=0 observations=1 [Changed seq=2 doc=Addressable:match/conflict.yml prev=0b6c6dfd8a2c1a05466a3c4f1ac0781359a98999fba2dcd8e119e677a9af90db disk=51104dae5ae5827b1dd201cf72935c229d588745b6ec71a2ed77452d2a0c8d85 content=Projected] t=2649ms dt=1ms
--- reconcile burst-slow-after commands=equal(except-plugin:event) rust-surplus=[] page-surplus=[plugin:event|listen+1] probe-half=ok events=observed emitted=2 delivered=2
--- span burst-slow-before→burst-slow-after writes=0 write-commands=[] emitted+=2 delivered+=2 witness=unchanged(except xdg/espanso/match/conflict.yml:as-written=yes) identical=[] transient=[] changed=[xdg/espanso/match/conflict.yml] added=[] removed=[]
```

`G1-09` repeats it: two drains, `seq=1 disk=0b6c6dfd…` then `seq=2 prev=0b6c6dfd… disk=51104dae…`,
`emitted=2 delivered=2`.

**Reading.** Three writes 60 ms apart gave **one** emit and one observation whose `disk=` is the
**final** file's hash (`edabfe42…`, the writer's `final-sha256`) and whose `prev=` is the pre-burst
hash, twice. Two writes 600 ms apart gave **two** emits and two observations chained
`a569b4d9 → 0b6c6dfd → 51104dae`, twice. The coalescing the consult predicts is shown at these two
points only; **nothing is claimed about the 150–300 ms boundary**, which is the engine's (entry 24).
`script-seen`'s `first-change=` (320 ms and 202 ms fast; 314 ms and 201 ms slow) is when the page's
witness poll first saw the target move, not when the script wrote, and is not a latency figure.

---

## 4. Self-save suppression — `G1-07`, partial

**No frozen plan performs one unsubstituted `save_match` inside a span of its own** (2d-7-4-2 notes §8
item 1). The one retained plan with an unsubstituted, committed `save_match` is `restore-registry`,
which then restores the same file through `save_raw_document` 1.3 s later. What it shows:

```
--- ipc #10 save_match args={"id":{"document":1,"revision":"a569b4d9426631b0a9b59ca7e3e26c3918f6d5f3371b6b0c6b2f4822a12e8322","node":14},"draft":{…"replace":{"Set":"beta edited by probe"}…} -> ok answer={"outcome":"saved","revision":"02967396d06ae09508fa92be4d6968c0b4d17716469d302f85a9d687709e6255","committed":true,"notes":[],"backup_taken":true,… t=460ms dt=21ms
--- ipc #16 save_raw_document args={"document":1,"baseRevision":"02967396d06ae09508fa92be4d6968c0b4d17716469d302f85a9d687709e6255",…} -> ok answer={"outcome":"saved","revision":"a569b4d9426631b0a9b59ca7e3e26c3918f6d5f3371b6b0c6b2f4822a12e8322","committed":true,"notes":[],"backup_taken":fals… t=1799ms dt=17ms
--- tally end rust-app=[document_text×2 · drain_external_changes×1 · get_document×5 · get_match×1 · list_backup_batches×1 · list_backup_entries×1 · list_documents×1 · open_workspace×1 · read_backup_text×1 · save_match×1 · save_raw_document×1 · set_menu_labels×1] rust-writes=2 … emitted=0 attempts=1 t=5372ms
--- reconcile end commands=equal(except-plugin:event) rust-surplus=[] page-surplus=[plugin:event|listen+1] probe-half=ok events=none-emitted(spy=installed) emitted=0 delivered=0
--- span start→end writes=2 write-commands=[save_match · save_raw_document] emitted+=0 delivered+=0 witness=CHANGED(except none) identical=[xdg/espanso/match/conflict.yml] transient=[] changed=[] added=[xdg/espanso/.espansoconfig-backups · xdg/espanso/.espansoconfig-backups/2026-09-23T092649Z · xdg/espanso/.espansoconfig-backups/2026-09-23T092649Z/.espansoconfig-batch · xdg/espanso/.espansoconfig-backups/2026-09-23T092649Z/match · xdg/espanso/.espansoconfig-backups/2026-09-23T092649Z/match/conflict.yml] removed=[]
```

**What was read.** Two of the application's own commits to `match/conflict.yml`, 3.5 s and 4.9 s
before the `end` checkpoint, gave **no emit, no delivery and no drain** (`drain_external_changes×1`,
the open's own `#8`). On the same binary and host, every foreign write (or burst of writes) in this step
gave at least one emit within the launch (§2, §3, §5, §6, §8). The file ends `identical` (the restore put `a569b4d9…` back on a new inode),
and the only additions are the app's own backup batch.

**What was not read.** The row's acceptance — **write tally 1, one inode change, and no `Changed`
observation for our revision in the drains of the following 2 s, inside a span that holds that one save
alone** — is unread: the plan has no checkpoint between the two commits, so its tally is 2 and its
witness cannot show one inode change. The launch-wide witness reads `CHANGED(except none)`
because a plan-driven save is not a script writer's change (2d-7-4-2 notes §8 item 3).

---

## 5. Raw-view automatic refresh — `G1-04`

The first half of `external-raw`: the viewer open with no editor, then the probe's second writer.

```
--- disk viewer-r0 "# Synthetic hard window-reading fixture, shaped like move-block-scalar-seams.yml:\n…
--- counts viewer-before reload_document=0 document_text=1 save_raw_document=0 inFlight=0
--- writer second wrote=yes
--- delivered n=1 handler=1337298514 eventId=0 payload={"workspace_epoch":1,"newest_sequence":1} t=692ms
--- ipc #10 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=1 newest_sequence=1 discarded=0 observations=1 [Changed seq=1 doc=Addressable:match/conflict.yml prev=a569b4d9426631b0a9b59ca7e3e26c3918f6d5f3371b6b0c6b2f4822a12e8322 disk=0b6c6dfd8a2c1a05466a3c4f1ac0781359a98999fba2dcd8e119e677a9af90db content=Projected] t=692ms dt=1ms
--- ipc #11 reload_document args={"id":1} -> ok answer={…"relative_path":"match/conflict.yml",…"revision":"0b6c6dfd8a2c1a05466a3c4f1ac0781359a98999fba2dcd8e119e677a9af90db","byte_len":836,…} t=694ms dt=1ms
--- ipc #12 document_text args={"id":1} -> ok … t=695ms dt=1ms
--- viewer refreshed 366ms after the writer was asked
--- counts viewer-after reload_document=1 document_text=2 save_raw_document=0 inFlight=0
--- rereads viewer count=2 [#11 reload_document args={"id":1} · #12 document_text args={"id":1}]
--- disk viewer-r1 "# Synthetic hard window-reading fixture, shaped like move-block-scalar-seams.yml:\n…
```

**Out of app** (Node, the transcript's `--- disk` JSON string against the fixture file):

```
viewer-r0 hard-r0.yml equal 825 825
viewer-r1 hard-alpha-changed-r1.yml equal 836 836
```

The rest of the launch is the raw editor's conflict reading (third, other and fourth writers), which is
2d-7-6's subject and is not read here. Launch-wide:

```
--- tally end rust-app=[document_text×4 · drain_external_changes×5 · get_document×3 · list_documents×1 · open_workspace×1 · reload_document×2 · set_menu_labels×1] rust-writes=0 rust-probe=[probe_fourth_writer×1 · probe_other_writer×1 · probe_plan×89064 · probe_second_writer×1 · …]
--- reconcile end commands=equal(except-plugin:event) rust-surplus=[] page-surplus=[plugin:event|listen+1] probe-half=ok events=observed emitted=4 delivered=4
--- span start→end writes=0 write-commands=[] emitted+=4 delivered+=4 witness=CHANGED(except none) identical=[] transient=[] changed=[xdg/espanso/match/conflict.yml · xdg/espanso/match/other.yml] added=[] removed=[]
```

and `launch-7.sh`'s tree diff lists exactly `match/conflict.yml` and `match/other.yml`, ending at
`edabfe42…` (`r4`, the fourth writer's fixture) and `a3479356…` (`r3`, the other writer's).

**Reading.** An external change with the viewer open issued one `reload_document` and one
`document_text` with no press, and the viewer's `div.sourceText` then held the new file's text,
byte-equal to the fixture the writer wrote. "Drawn" here means **present in the DOM**; that a person
would see it is unread.

**This path's no-write claim is UNREAD.** Entry 16's per-action line `writes=0
witness=unchanged(except …)` needs a checkpoint at the action's boundary and a witness after each
writer. This retained plan has neither (review S5; notes §9). What follows is recorded as separate,
launch-wide observations and not as that claim:
- *Command count:* no write command was dispatched in the whole launch (`rust-writes=0`).
- *Launch span:* it reads `CHANGED(except none)`, because probe writers are not tracked as
  exceptions (2d-7-4-2 §8 item 3).
- *Final files:* the out-of-app tree diff above.

---

## 6. Add and remove — `G1-05`, `G1-06`

**`G1-05` (`status-membership`):** the probe's extra writer creates `match/extra.yml` with mode `0o000`
(`create_new`, bytes written through its own descriptor), then removes it, then the plan presses the
membership reload.

```
--- rows mb-start count=4 [All · match/conflict.yml · match/other.yml · config/default.yml]
--- writer probe_extra_writer args={"unreadable":true} answered=wrote
--- delivered n=1 handler=3979248724 eventId=0 payload={"workspace_epoch":1,"newest_sequence":1} t=539ms
--- ipc #9 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=1 newest_sequence=1 discarded=0 observations=1 [Unreadable seq=1 doc=Unnamed:match/extra.yml reason={"PermissionDenied":{}}] t=539ms dt=1ms
--- writer probe_remove_extra args={} answered=removed
--- delivered n=2 handler=3979248724 eventId=0 payload={"workspace_epoch":1,"newest_sequence":2} t=4645ms
--- ipc #10 drain_external_changes args={"afterSequence":1} -> ok answer=epoch=1 newest_sequence=2 discarded=0 observations=1 [Removed seq=2 doc=Unnamed:match/extra.yml prev=null] t=4647ms dt=1ms
--- counts mb-reload-before open_workspace=1 list_documents=1 get_document=3 reload_document=0 document_text=0 save_raw_document=0 save_match=0 drain_external_changes=3 inFlight=0
--- ipc #11 open_workspace args={"root":null} -> ok answer={…"documents":3,"match_files":2,"config_profiles":1,"packages":0,"disabled":0} t=8779ms dt=4ms
--- ipc #16 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=2 newest_sequence=0 discarded=0 observations=0 [] t=8802ms dt=2ms
--- counts mb-reload-after open_workspace=2 list_documents=2 get_document=6 reload_document=0 document_text=0 save_raw_document=0 save_match=0 drain_external_changes=4 inFlight=0
--- reconcile end commands=equal(except-plugin:event) rust-surplus=[] page-surplus=[plugin:event|listen+1] probe-half=ok events=observed emitted=2 delivered=2
--- span start→end writes=0 write-commands=[] emitted+=2 delivered+=2 witness=unchanged(except none) identical=[] transient=[] changed=[] added=[] removed=[]
```

**`G1-06` (`status-removed`):** the probe removes `match/other.yml` with the raw editor open over it.

```
--- writer probe_remove_other args={} answered=removed
--- delivered n=1 handler=2652634477 eventId=0 payload={"workspace_epoch":1,"newest_sequence":1} t=644ms
--- ipc #10 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=1 newest_sequence=1 discarded=0 observations=1 [Removed seq=1 doc=Addressable:match/other.yml prev=e61a60fd3cb5d5eb0c58d39b62efc68c8e04d96dbafdb145de13ab6cc5dac731] t=644ms dt=0ms
--- rows rm-removed count=3 [All · match/conflict.yml · config/default.yml]
--- reconcile end commands=equal(except-plugin:event) rust-surplus=[] page-surplus=[plugin:event|listen+1] probe-half=ok events=observed emitted=1 delivered=1
--- span start→end writes=0 write-commands=[] emitted+=1 delivered+=1 witness=CHANGED(except none) identical=[] transient=[] changed=[] added=[] removed=[xdg/espanso/match/other.yml]
```

The tree diff reads `Only in …/G1-06/xdg-before/espanso/match: other.yml` and nothing else.

**Reading.** An unreadable file created under `match/` was observed as `Unreadable … Unnamed`, its
removal as `Removed … Unnamed`, and the removal of a listed file as `Removed … Addressable` with that
file's last revision as `prev=`. Each gave one emit and one delivery.

**The no-write claims of these paths are UNREAD** (entry 16; the retained plans have no action-boundary
checkpoints; review S5; notes §9). These are separate, launch-wide observations:
- *Command count:* no write command was dispatched in either launch.
- *Launch span:* `G1-05`'s is `unchanged(except none)`, because the file came and went; `G1-06`'s
  shows only the probe writer's removal.
- *Final files:* the tree diffs agree with both spans.

**Not read.**
- **A readable file added under `match/`.** No frozen plan calls `probe_extra_writer` with
  `unreadable: false`, so the in-place, possibly partial-file shape the consult names
  (`probe.rs`'s `create_new` then `write_all`) was not observed.
- **A script-side create and remove under `config/`.** `launch-7.sh`'s writers accept four fixed
  targets (`config/default.yml`, `match/conflict.yml`, `match/other.yml`, `match/extra.yml`), only
  `replace` and `inplace`, and no removal; no page request exists for either. `config/` add and remove
  is **unread**.

---

## 7. Workspace reopen with a late old callback — unread

**No frozen plan arms `delay` on a drain and reopens the workspace while it is held** (2d-7-4-2 §8
item 1). The row is **unread**. What `G1-05` does show (§6) is the reopen half without a late callback:
the membership reload issued a second `open_workspace`, the next drain asked `afterSequence=0` and was
answered `epoch=2 newest_sequence=0`. That is a reached reopen, not the held late-answer case the row
names. **Whether the reopen wrote nothing is UNREAD** (entry 16; no checkpoint brackets the reopen).
As a separate, launch-wide observation, the launch ended with `rust-writes=0` and an unchanged launch
span.

---

## 8. Emits against deliveries, at every checkpoint

Across the ten launches there are **31 `--- reconcile` lines. Every one is `commands=equal(except-
plugin:event)`, `probe-half=ok`, and `events=observed` or `events=none-emitted(spy=installed)`.** None
is `application-fact(emitted>delivered)` and none is `VOID`. The only page surplus is the one allowed
`plugin:event|listen+1`. Per launch, the `end` line's events:

| Launch | `emitted` | `delivered` | Drains with an observation |
|---|---|---|---|
| G1-01 | 2 | 2 | 2 |
| G1-02 | 1 | 1 | 1 |
| G1-03 | 2 | 2 | 2 |
| G1-04 | 4 | 4 | 4 |
| G1-05 | 2 | 2 | 2 |
| G1-06 | 1 | 1 | 1 |
| G1-07 | 0 | 0 | 0 |
| G1-08 | 1 | 1 | 1 |
| G1-09 | 2 | 2 | 2 |
| G1-10 | 1 | 1 | 1 |

`G1-10` (`lifecycle-delivery`), the wake end to end:

```
--- delivery writerAt=1586ms seqBefore=8 drainsBefore=1
--- ipc #9 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=1 newest_sequence=1 discarded=0 observations=1 [Changed seq=1 doc=Addressable:match/conflict.yml prev=a569b4d9… disk=0b6c6dfd… content=Projected] t=1850ms dt=26ms
--- delivery drain=#9 afterSequence=0 observations=1 issued=264ms answered=290ms after the write
--- reconcile end commands=equal(except-plugin:event) rust-surplus=[] page-surplus=[plugin:event|listen+1] probe-half=ok events=observed emitted=1 delivered=1
```

**The wake is observed**: in every launch with a foreign write, each emit Rust counted was delivered
to the page's handler and followed by a drain that carried the observation. This closes 5-7b's window
reading §5 item 1 for these ten launches, on this host, with the window hidden.

---

## 9. The watermark's advance

Read from the drains' `afterSequence` and the answers' `newest_sequence`:

| Launch | Drains (`afterSequence` → `newest_sequence`, observations) |
|---|---|
| G1-01 | `#8 0→0 (0)` · `#9 0→1 (1)` · `#11 1→2 (1)` |
| G1-03 | `#8 0→0 (0)` · `#9 0→1 (1)` · `#11 1→2 (1)` |
| G1-04 | `#8 0→0` · `#10 0→1` · `#13 1→2` · `#14 2→3` · `#17 3→4` (one observation each after the first) |
| G1-05 | `#8 0→0` · `#9 0→1` · `#10 1→2` (epoch 1) · after the reopen `#16 0→0`, `epoch=2` |
| G1-02 / G1-08 | `#8 0→0 (0)` · `#9 0→1 (1)` — one sequence for three writes |

The watermark advanced by exactly one per observation, each drain asked after the previous answer's
`newest_sequence`, and no drain re-read an observation already delivered. After the reopen the
watermark restarted at 0 under the new epoch. *Reached.*
