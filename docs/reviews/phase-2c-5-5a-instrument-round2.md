NOT READY

### Instrument defects

1. **High — [src-tauri/src/probe.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/probe.rs:163), lines 163–167, 201–237, 279–308.**  
   **Claimed:** canonicalization confines both writers beneath `launches/` and `fixtures/`, while the temporary is safely validated.  
   **Actually true:** the code checks pathnames and then performs new pathname operations through `/bin/sh`. An ancestor can be replaced with a symlink after canonicalization. More directly, `temporary_beside` checks absence with `symlink_metadata`, then `cp` separately opens that path; a symlink inserted between those operations is followed by `cp`, permitting an outside file to be overwritten and potentially installing that symlink as the target. C03/C04 test only static outside paths and do not exercise either race.  
   **Minimal fix:** eliminate the shell and perform exclusive temporary creation and replacement relative to pinned directory handles, with no-follow semantics; constrain the target to the exact synthetic file rather than any file under a launch directory. Add an adversarial symlink-swap control.

### Prose defects

2. **Medium — [2c-5-5a-instrument-rebuild.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-5a-instrument-rebuild.md:404), lines 404–433, 735–738, 820–826.**  
   **Claimed:** finding 1 is closed, both writers are confined, and 5b inherits that confinement.  
   **Actually true:** the record itself admits at lines 429–431 that the canonical pathname is resolved again and a symlink swap is not caught. “Nothing else writes” is an operating assumption, not a sound confinement boundary for callable IPC commands. C03/C04 establish only two ordinary refusals by the second writer.  
   **Minimal fix:** after correcting the instrument, retake adversarial controls. Until then, mark finding 1 partially closed and tell 5b that confinement remains unproven.

3. **Low — [src-tauri/src/probe.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/probe.rs:108), [src/probe.ts](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:116), [decision record](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-5a-instrument-rebuild.md:851).**  
   **Claimed:** a mid-plan transcript-write failure “becomes `--- failed`.”  
   **Actually true:** the rejected `say` reaches `startProbe`’s catch, but that catch reports through another `say`. If stdout remains unavailable, that call also rejects and execution never reaches `--- end`. Mapping both Rust errors is correct; reliable in-band reporting of the reporting channel’s own failure is not established.  
   **Minimal fix:** say that the driver *attempts* to emit `--- failed`, and that any transcript I/O failure may leave a silently truncated log.

4. **Medium — [2c-5-5a-instrument-rebuild.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-5a-instrument-rebuild.md:593), lines 593–600.**  
   **Claimed:** P01 failed before reaching the surface, “so no writer ran.”  
   **Actually true:** P01 establishes a sidebar timeout, zero final tree diff, and `bytes=DIFFER`. With no invoke spy or command counter—and no retained source-to-binary provenance—it cannot establish that no writer ran or no transient write occurred. This is a narrower recurrence of finding 7’s absence over-claim.  
   **Minimal fix:** replace it with: “P01 failed at the sidebar lookup and left the final synthetic tree unchanged; it does not establish whether any writer ran.”

### Original-finding status

1. **PARTIALLY CLOSED** — static outside paths are refused; confinement remains TOCTOU-defeatable.  
2. **PARTIALLY CLOSED** — `cp && mv` fixes status masking and pre-existing stale temporaries, but temporary validation and use are still raced.  
3. **CLOSED** — `editor-third → runThirdWriter`, the bundle token, P25’s writer line, second conflict, and R2 byte match agree.  
4. **CLOSED** — malformed languages and extra segments are refused; unknown cases ultimately fail in `runCase`/the shell case table.  
5. **CLOSED** — both Rust I/O errors are returned, though the new reporting claim is overstated as finding 3 above.  
6. **CLOSED** — the observation remains accurately disclosed and required no change.  
7. **CLOSED for N05/N06**, but the same unsupported absence claim remains at §6.3 as finding 4 above.  
8. **CLOSED** — P26 replaces P02 in the proof set; P02’s unknown provenance is disclosed and all P25–P36 summaries have ten lines.

§9 is therefore not fully honest: §9.1 and §9.2 overstate closure. The record tells 5b the truth about third-writer reachability and P25’s exercise, but not about the confinement it inherits.

Codex session ID: 01a0044e-d2b3-7ff0-82fd-e0f5785c6d37
Resume in Codex: codex resume 01a0044e-d2b3-7ff0-82fd-e0f5785c6d37
