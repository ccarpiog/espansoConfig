# Review brief — Phase 2d-6-8c

- **Repo:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 + Svelte; read `CLAUDE.md` first).
- **Phase:** 2d-6-8c, the last third of 2d-6-8. It is a narrow **window reading**, EN and ES, of the raw editor
  (`RawEditor.svelte`) and the restore pane (`RestorePane.svelte`) over a file that another writer changed on
  disk. The reading runs over the synthetic hard fixture required by ruling 38 of
  `docs/decisions/2d-6-split-notes.md`: block bodies, item-owned comments and blank runs, in LF, in a CRLF copy,
  and in a copy with one lone `\r`. The phase also checks **2d-6-8's whole acceptance clause by clause**.
- **Scope source:** `PROGRESS.md` → *Next action* ("Executable cold: 2d-6-8c"); `2d-6-split-notes.md` §2, the
  `### 2d-6-8` entry and the cut beneath it; `docs/decisions/2d-6-8b-notes.md` §4 item 1. Template:
  `docs/decisions/2d-6-7c-window-reading.md`. 7c's review found that its acceptance was marked met without the
  hard fixture. Check that 8c does not repeat that.
- **Changed files (the product):** `docs/decisions/2d-6-8c-window-reading.md` and `docs/decisions/2d-6-8c-notes.md`
  (both new).
- **Untracked by design:** the temporary instrument (`src/probe.ts` extended with eight plans,
  `src-tauri/src/probe.rs`, and the hook lines in `src-tauri/src/main.rs` and `src/main.ts`). Per `CLAUDE.md` §6
  it is never committed. Review it only as far as the readings' evidence depends on it. `PROGRESS.json` carries
  only the in-progress marker.
- **No tracked source changed.** The worker found no defect in 2d-6-8's rendering. It recorded a
  `SourceText.svelte` wrap of the `\r` marker as an open item and did not fix it.
- **Verification run:** `npm test` exit 0, 3156 passed (65 files). `npm run check` exit 0, 449 files, 0 errors, 0
  warnings. The worker also ran `npm run build` (193 modules). There were 16 counted proof launches plus 11
  shakedowns. The harness is at `/private/tmp/espansoconfig-harness-2d-6-6c-2/`.
- **Risks to probe:**
  1. Does any acceptance clause in the notes read as **met** when the window reading did not actually reach it?
     The worker names these as unread: raw's notices under *Save*, restore's notice beside its refusal, the
     no-candidate reload-unavailable sentence, the reload's `alreadyThere`/`refused` arms, and the language
     switch mid-conflict on restore. Check whether each is marked as met, as met only by mounted tests, or as
     open. A mounted test is not a screen (`CLAUDE.md` §6).
  2. Does any sentence in either record claim a guarantee that the code or the reading does not give
     (`CLAUDE.md` §5, last bullet)?
  3. Are the verbatim-sentence matches and the byte matches of the disk text real evidence? Is the hard fixture
     actually the one described?
  4. Corpus privacy: no real config content in either record.
  5. Is the `SourceText` `\r`-marker wrap finding correct, and was it correctly kept out of scope?
- **Review file:** `docs/reviews/phase-2d-6-8c.md`.
- **Time budget:** 15 minutes.
