# Phase 4-18 — Date preview

**Status:** implementation record for step 4-18 of [`4-split-notes.md`](4-split-notes.md) §2, under
ruling 27 of §3 and the consult's Q6 ([`phase-4-design.md`](../reviews/phase-4-design.md): "Explicit
sample instant, explicit time zone, supported textual format/offset"; "Locale-sensitive formats may
return `LocaleUnsupported`"; "An absent date format can use the RFC 2822 default"). Core-first: **no
Svelte component calls anything this step adds** (wire types and accessors only; the controls and the
instant/zone drawn beside the result are 4-19's). No write path was touched. The step was **not cut**.
No window reading was performed or claimed.

---

## 1. What changed and why

### 1.1 Dependencies — pinned, recorded

| Crate | Version | Features | Why |
|---|---|---|---|
| `chrono` | **`=0.4.45`** | `default-features = false`, `features = ["alloc"]` | strftime parsing (`StrftimeItems::parse`), `format_with_items(…).write_to`, `to_rfc2822`, instant arithmetic. **No `clock`** (so no `Utc::now`, no `Local`, no `iana-time-zone`), no `std`, no `wasmbind`, no `unstable-locales` |
| `chrono-tz` | **`=0.10.4`** | `default-features = false` | the bounded time-zone crate: the IANA database compiled in (**tzdb `2025b`**, `chrono_tz::IANA_TZDB_VERSION`); no file read; its build script does nothing without `filter-by-regex`/`case-insensitive` |
| `phf`, `phf_shared` | `0.12.1` (lockfile) | `chrono-tz`'s own, default features off | the zone-name table |

Declared once in the workspace `Cargo.toml` (with the reasoning) and inherited by
`crates/espansoconfig-core/Cargo.toml`. `Cargo.lock` gained `chrono-tz 0.10.4`, `phf 0.12.1`,
`phf_shared 0.12.1` (`chrono 0.4.45` and `siphasher 1.0.3` were already locked through tauri).
`cargo tree -p espansoconfig-core -e features -i chrono` shows `alloc` alone, and so does
`cargo tree --workspace -e features -i chrono` at this step (`/private/tmp/4-18/tree-*.txt`).
`cargo tree -p espansoconfig-core | rg tauri` finds nothing.

### 1.2 Core: `crates/espansoconfig-core/src/preview/date.rs` (new submodule of `preview`)

`preview_date(variable, instant, injection, max_bytes)` — called from the `Date` arm of
`Evaluator::compute`, which pushes its text as a `Sample` of the variable (memoised and charged to the
work budget exactly as every other value). Checks run in a fixed order, the file's parameters first and
the request second, so one variable and one request always answer one code:

1. `params` unreadable (alias, merge key, non-mapping) → `ValueUnreadable`.
2. **`format`**: absent → RFC 2822 (`to_rfc2822`). A scalar must be decoded and not 1.1-ambiguous
   (`AmbiguousScalar` otherwise); a non-scalar is `ValueUnreadable`. A format holding a `{{reference}}`
   is `ValueUnreadable` unless `inject_vars` is certainly false (§3.3). It is validated by one **lazy**
   walk of `StrftimeItems` that collects nothing and charges one work unit per item against the
   preview's remaining work budget — more items than that → **`WorkLimit`** (`PreviewLimit::Work`), the
   walk stopped there; any `Item::Error` → **`DateFormatMalformed`**, never a panic. The item count is
   charged to the work budget besides the text (§8).
3. **Locale**: a format holding `%c %x %X %r %p %P` → **`LocaleUnsupported`**; one holding day or month
   names (`%a %A %b %B %h %v`) or a dotted fraction (`%.3f %.6f %.9f`) → `LocaleUnsupported` unless
   `locale` names one of the English regions measured for that class (§3.2, §8). Otherwise the locale
   is not consulted.
4. **`offset`**: only a **plain** decoded scalar spelled `0` or `-?[1-9][0-9]*` is read; anything else
   (quoted, `+`, leading zero, `-0`, `_`, float, hex, empty, a list or mapping) →
   **`DateOffsetMalformed`**. A number beyond `i64` or beyond chrono's `TimeDelta` → **`DateOutOfRange`**.
5. **`tz`**: a decoded non-ambiguous scalar parsed as `chrono_tz::Tz` (exact, case-sensitive; links such
   as `US/Eastern` resolve as the database writes them); unknown → **`ZoneUnsupported`**; non-scalar →
   `ValueUnreadable`. A `tz` replaces the request's zone, which is then not read.
6. **Instant**: none in the request → **`DateInstantMissing`**. The request zone: `Named` parsed as `Tz`,
   `Fixed` through `FixedOffset::east_opt` (|offset| < 86 400); otherwise `ZoneUnsupported`.
7. **Range**: `from_timestamp` + `checked_add_signed`, then the result must lie **two days inside**
   chrono's `MIN_UTC`/`MAX_UTC`, so no offset can carry the local time out of range →
   `DateOutOfRange`. RFC 2822 additionally needs a local year in `0..=9999` (chrono's `to_rfc2822`
   panics outside it; the guard runs first).
8. **Writing**: `format_with_items(StrftimeItems::new(format)).write_to(&mut BoundedWriter)` — the
   same lazy iterator walked again, streamed item by item into a writer that keeps at most the output
   budget and then fails; `Display` would build the whole text first. A cut text reports
   `PreviewLimit::OutputBytes`. No list of items is ever built.

**Zones as written.** A request zone stands in for espanso's system zone and is written as chrono writes
`Local` — a fixed offset at that instant (`%Z` → `+02:00`); a `tz` zone is written by `chrono-tz`
(`%Z` → `CEST`).

### 1.3 Core: `preview.rs`

- New inbound wire types, `deny_unknown_fields`: **`SampleInstant { unix_seconds: i64, zone }`** and
  **`SampleZone`** = `Named { name }` | `Fixed { offset_seconds: i32 }`.
  `PreviewSamples` gains **`instant: Option<SampleInstant>`** (written as `null` when absent; an absent
  key reads as `None`, serde's default for `Option`). One instant serves every date of one preview.
- `PreviewUnresolved`: **`DateNotPreviewed` removed** (4-17 §3.3 said 4-18 replaces it) and six codes
  added — `DateInstantMissing`, `DateFormatMalformed`, `DateOffsetMalformed`, `DateOutOfRange`,
  `ZoneUnsupported`, `LocaleUnsupported` (17 → 22).
- Module docs: the type-table row for `date`, and the purity paragraph (a date's "now" is the request's).
- `lib.rs`: a 4-18 line in the phase list.

### 1.4 Wire mirror, contracts, i18n

- `src/lib/ipc/types.ts`: `SampleZone`, `SampleInstant`, `PreviewSamples.instant: SampleInstant | null`
  (required-nullable, per the wire contract's rule against `?:`), the `PreviewUnresolved` union.
- `wire_contract.rs`: the preview shape test now samples `SampleInstant` and every `SampleZone` variant
  (13 → 15 variants compared), with an instant in the round-tripped samples.
- `dictionary_contract.rs`: `previewUnresolved` 17 → 22; `SampleZone` on `NOT_A_CODE` with its reason
  (a request value whose name or offset a screen shows, never the variant's name).
- **i18n: +6 / −1 keys per language** (`code.previewUnresolved.*`), no operand interpolated, no brace.
  The accessors are 4-17's (`describePreviewUnresolved`); `previewCodes.test.ts` lists the new members
  (its exhaustiveness type fails compilation otherwise); `commands.test.ts` sends `instant`.

## 2. How each acceptance clause is met

Core: `crates/espansoconfig-core/tests/date_preview.rs` (19 tests). Command level:
`src-tauri/src/commands/preview_check.rs` (+1). Contracts: the two widened tests above.

| Clause | Evidence |
|---|---|
| Fixed instants around day boundaries | `day_boundaries_follow_the_zone` (2024-12-31T23:30Z in UTC, ±1 h, +05:30, New York, Kiritimati +14; the year and weekday change east of UTC), `an_offset_moves_the_instant_across_boundaries` (into a leap day, back across a year end) |
| … and DST changes | `spring_forward_in_a_named_zone` (00:59:59Z → 01:59:59 +01:00; 01:00:00Z → 03:00:00 +02:00, in the request zone and in `tz`), `fall_back_in_a_named_zone_repeats_the_wall_clock` (02:30 +02:00 and 02:30 +01:00; 02:59:59 → 02:00:00), an offset crossing the change |
| Explicit zones | `a_request_zone_prints_an_offset_and_a_tz_prints_an_abbreviation`, `unknown_zones_are_a_code` (a `tz` replaces a bad request zone; links resolve; unknown, miscased, padded, empty and abbreviation names refused), fixed offsets at ±86 399 accepted and ±86 400 / `i32` extremes refused |
| Malformed formats | `malformed_formats_are_a_code_never_a_panic` (`%Q`, trailing `%`, `%.2f`, `%#Y`, `%:`, `%-`, `%E`, `%-b`; neighbours `%%Q`, `%.3f`, `%-d`, empty format; non-scalar and ambiguous format) |
| Malformed offsets | `malformed_offsets_are_a_code` (16 spellings) |
| Overflow | `overflow_is_a_code_at_the_boundary` (offsets beyond `i64` and beyond `TimeDelta`; the two-day margin exact / ±1 at both ends, with and without offset; `i64::MAX`/`MIN` instants), `an_absent_format_is_rfc_2822` (9999-12-31T23:59:59Z / +1 s / +1 s of zone offset) |
| `LocaleUnsupported` | `locale_dependent_formats_answer_locale_unsupported` (17 cases, including the English-names exception and `%%A`), `dotted_fractions_depend_on_the_locale` (§8) |
| No test reads the clock | Every instant is a literal. `no_preview_module_or_date_test_reads_a_clock_or_the_local_zone` scans the non-comment lines of `preview.rs`, `preview/date.rs`, `tests/preview.rs` and `tests/date_preview.rs` for `::now(`, `Local::`, `offset::Local`, `chrono::Local`, `SystemTime`, `Instant::`, `today(`, `iana_time_zone`, `var("TZ`; `chrono_is_confined_to_the_date_module` fails on `chrono`/`chrono_tz` named anywhere else in the core's `src/`; and without the `clock` feature `Utc::now` does not compile (M12 below) |
| `cargo tree -p espansoconfig-core \| rg tauri` empty | `/private/tmp/4-18/cargo-tree.txt` (94 lines, no match) |
| New crates' versions recorded | §1.1 |
| Deterministic, bounded, round-trips | `identical_requests_give_identical_dates` (a date inside an echo and in the body; another instant changes the answer), `a_date_text_is_bounded_by_the_output_budget` (10 bytes exact / 9 cut; 4 000 × `%+` stops at 65 536), `the_instant_reads_and_writes_exactly_and_refuses_unknown_fields`, `a_date_needs_an_instant_from_the_request`, `a_referenced_format_is_not_substituted`, `the_command_entry_point_previews_a_date`; `preview_check`'s `a_date_is_shown_at_the_request_instant_and_zone` (through the session, file byte-identical) |

## 3. Decisions and deviations

1. **The request zone is a stand-in for the system zone and is written as a fixed offset** (as chrono's
   `Local` is); a `tz` zone is written by `chrono-tz`. What espanso itself prints for `%Z` in either
   case is not established here.
2. **Locale.** No locale is simulated (no `unstable-locales`). Layouts and AM/PM markers are always
   `LocaleUnsupported`, since English locales differ there (`%x` is `%m/%d/%y` in POSIX and
   `%m/%d/%Y` in `en_US`; `en_GB` writes `am`/`pm`). **Day and month names, and dotted fractions, are
   formatted only under an explicit `locale` `en_XX`/`en-XX` whose region is on a list measured
   against `pure-rust-locales` 0.8.1** — the data chrono's localized formatter reads (§8):
   `ENGLISH_NAMES` (18 regions; `en_ZW`'s data holds other names) and `POINT_DECIMALS` (16 regions;
   `en_DK`, `en_ZM`, `en_ZW` write a comma). A bare `en` has no data of its own and is not accepted.
   Whether espanso's chrono reads the same data version is not established. Without a `locale` espanso
   uses the system locale, which the request does not carry, so these are refused.
3. **A `format` holding a reference is `ValueUnreadable`** unless injection is certainly disabled:
   whether espanso substitutes inside a date's `format` is not established, and substituting would add
   the format to the evaluation graph for a speculative gain. The sentence ("cannot read the text this
   value needs") is general; a dedicated code was not added to stay inside the consult's key budget.
4. **The offset grammar is narrower than YAML's integers** (no `+`, no leading zero, no `_`): the
   spellings on which YAML 1.1 and 1.2 core agree. A quoted `'3600'` is refused rather than guessed —
   under espanso's loader it would be a string, and what the extension then does is not established.
   Reading this one integer is the consult's "supported textual offset"; it adds no resolver (D2u).
5. **Offset and range errors share `DateOutOfRange`**, and an unknown `tz` and an unusable request zone
   share `ZoneUnsupported`, keeping the new keys at six (the consult planned 5–10 for 4-18).
6. **The two-day range margin** is this preview's bound, not chrono's or espanso's.
7. **`PreviewSamples.instant` is optional on read** (serde's `Option` default) though the TypeScript type
   declares it required-nullable; existing Rust callers that omit it keep working and answer
   `DateInstantMissing`.

## 4. What is and is not guaranteed

- **By construction and pinned by tests:** no clock or local-zone read in the preview modules and the
  date tests (text scan — a fixed vocabulary over non-comment lines, so a read spelled another way or
  reached through another crate is not seen); chrono's clock API absent from the core's feature set (a
  compile error, M12); chrono confined to `preview/date.rs`; every malformed format a code; every range
  failure a code before any panicking chrono call; the output budget.
- **Pinned by tests since §8:** validating a format is bounded by and charged to the work budget
  (`a_huge_repeated_format_is_stopped_at_the_work_budget`, `validating_a_format_is_charged_besides_its_text`).
  That the walk collects nothing is by construction (a `for` over the iterator); no test measures
  allocation.
- **By construction only:** the writer stops chrono at the budget. That chrono's `write_to` stops at the
  first writer error is its code (`?` per item), and the visible output is the same either way because
  the segment buffer cuts too — no test can tell a streamed text from a built-then-cut one.
- **Feature unification is not forced.** Today the whole workspace resolves `chrono` with `alloc` alone;
  a later dependency enabling `clock` would compile `Utc::now` back in without anything failing. The
  source scan is what remains then.
- **Not guaranteed:** anything about espanso's date output — its chrono version, its locale handling,
  its behaviour for a quoted offset or an unknown `tz`, and `%Z`. R16 stays open.

## 5. Open items for later steps

1. **4-19** chooses and draws the sample instant and zone (the plan's popover shows *Timezone
   [System]*): reading the current time and zone is the caller's, in TypeScript, and must be shown
   beside the result. A zone list for a picker would need a reader over `chrono_tz::TZ_VARIANTS`; none
   was added.
2. A **sample locale** in the request would let names preview without an explicit `locale`
   parameter; not added (the consult did not ask for it).
3. `ValueUnreadable` for a referenced `format` (§3.3) — a dedicated code if 4-19 finds the general
   sentence misleading.
4. **6 new, 1 removed key per language** join the Phase 4 translation inventory (4-24). No sentence has
   been read on a window.
5. **Noticed, not fixed** (outside this step's files): `cargo doc -p espansoconfig-core --no-deps`
   fails on a pre-existing ambiguous intra-doc link, `` [`reference`] `` in `analysis/mod.rs:9` (module
   versus primitive), plus private-item link warnings in `analysis/dependency.rs` and `draft/audit.rs`.
   `rustdoc` is not a gate; nothing in `preview` is reported.

## 6. Failing-first evidence, by mutation

The tests were written against the new module, so failing-first is shown by mutation (git was not
used): fourteen mutations, each applied, run (`date_preview` and `preview` tests) and restored byte for
byte by `/private/tmp/4-18/mutate.py`; outputs `/private/tmp/4-18/mutation-*.txt`, summary
`mutation-summary.txt`. Every one was caught:

| # | Mutation | Failed |
|---|---|---|
| M1 | errors not parsed out; `Display` formatting | `malformed_formats_are_a_code_never_a_panic` (a **panic** in `alloc::string`), `a_date_needs_an_instant_from_the_request` |
| M2 | locale check removed | the locale test |
| M3 | English-names exception removed | the locale test, `day_boundaries_follow_the_zone` |
| M4 | range margin 0 | `overflow_is_a_code_at_the_boundary` |
| M5 | RFC 2822 year guard removed | `an_absent_format_is_rfc_2822` (panic) |
| M6 | offset read from any `i64` text, any style | `malformed_offsets_are_a_code` |
| M7 | request zone written by chrono-tz | the `%Z` test |
| M8 | `tz` ignored | 5 tests |
| M9 | referenced format formatted | `a_referenced_format_is_not_substituted` |
| M10 | missing instant defaults to the epoch | `a_date_needs_an_instant_from_the_request` |
| M11 | a `SystemTime` read added to `date.rs` | the clock scan |
| M12 | `Utc::now()` added to `date.rs` | **does not compile**: `no associated function … named now found for struct Utc` |
| M13 | `use chrono` added to `preview.rs` | `chrono_is_confined_to_the_date_module` |
| M14 | out-of-range fixed zone clamped | `day_boundaries_follow_the_zone` |

One fixture assumption was corrected while writing the tests, not the code: chrono rejects a padding
modifier on a name (`%-b` is `Item::Error`), so it moved from the locale cases to the malformed ones.

## 7. Verification

All exit 0, run serially, outputs under `/private/tmp/4-18/`: `cargo build --workspace`
(`cargo-build.txt`), `cargo test --workspace -- --test-threads=1` (`cargo-test.txt`), `cargo clippy
--workspace --all-targets -- -D warnings` (`clippy.txt`), `cargo fmt --check` (`fmt-check.txt`), `npm run
check` (`npm-check.txt`: 508 files, 0 errors, 0 warnings), `npm test` (`npm-test.txt`), `npm run build`
(`npm-build.txt`); `cargo tree -p espansoconfig-core | rg tauri` finds nothing (`cargo-tree.txt`);
bundle oracle — server-only pattern absent, client-only present.

Rung before the review fixes **`1780 / 508 / 4470 / 227`** (was `1760 / 508 / 4470 / 227`): +20 Rust tests (19 in
`date_preview.rs`, 1 in `preview_check.rs`; the widened contract tests and the edited 4-17 tests keep
their count); `svelte-check` files, vitest tests and Vite modules unchanged — the new members extend
existing lists and types, and no module enters the bundle.

## 8. Review fixes (`docs/reviews/4-18.md`, ship-with-fixes, 0 blockers, 2 should-fix)

Only the two findings, in `preview/date.rs` and its tests, plus the call site in `preview.rs` that the
first one's charge needs (the date arm passes the remaining work budget and adds the format's item count
to the value's cost), and this record.

1. **Format parsing allocated outside the budgets** (`date.rs`, `StrftimeItems::parse`). It collected
   the whole format into a `Vec` before any check — thirteen items per `%c`, so a repeated-`%c` scalar
   of a few megabytes allocated hundreds of megabytes. Now `validated_items` walks the iterator lazily,
   collects nothing, counts items and stops with `WorkLimit` as soon as the count passes the remaining
   work budget; `Format::Items` holds the format text, and formatting walks a fresh lazy iterator into
   the bounded writer. The count is charged to the work budget besides the text.
2. **Dotted fractions bypassed `LocaleUnsupported`** (`date.rs`, `locale_needs`). chrono's localized
   formatter writes `%.3f %.6f %.9f` after the locale's `DECIMAL_POINT`, so `%S%.3f` under `es_ES`
   was previewed with a `.` espanso would write as `,`. They are now a third class, `decimals`. `%.f`
   (writes nothing for a whole-second instant) and `%3f %6f %9f` (digits only) are not locale-dependent.
   **Deviation from the brief** ("supported only for the English locales the rule already accepts"):
   measuring `pure-rust-locales` 0.8.1 showed `en_DK`, `en_ZM` and `en_ZW` write a comma, and `en_ZW`'s
   day and month names are not English, so the old rule (any `en…`) would have answered wrongly for
   them. The English acceptance is now two measured region lists (§3.2), and a bare `en` — which has no
   locale data — is no longer accepted; the 4-18 test case `locale: en` → `Sunday` was changed to
   `LocaleUnsupported` accordingly, and the malformed-format neighbour `%.3f|%s` became `%3f|%s`.

**The user-facing sentence, corrected with the fix** (by the orchestrator): the `LocaleUnsupported`
sentence in `src/lib/i18n/{en,es}.json` ended "Day and month names are shown when the locale is English",
which the narrowed rule made an over-statement — a bare `en` and `en_ZW` are refused, and dotted fractions
were not mentioned. Both languages now name the decimal separator and say names and separators are shown
*only* for a regional English locale whose data is English (e.g. `en_US`); the sentence restricts, it does
not promise that every such locale shows both (`en_DK` shows names but refuses dotted fractions).

**Failing-first:** the three regressions were run against the pre-fix module
(`/private/tmp/4-18/date.rs.before-review`, with the pre-fix call site) by
`/private/tmp/4-18/review-failfirst.py`, which restored both files byte for byte; output
`/private/tmp/4-18/review-failfirst.txt`: all three failed — the 100 000-`%c` format answered
`LocaleUnsupported` (after collecting 1 300 000 items) instead of `WorkLimit`; ten `%Y` under a
50-unit budget passed (the items were not charged); `%S%.3f` under `es_ES` answered `00.000`.

**Verification:** all exit 0, outputs `/private/tmp/4-18/review-*.txt`: `cargo build --workspace`,
`cargo test --workspace -- --test-threads=1`, `cargo clippy --workspace --all-targets -- -D warnings`,
`cargo fmt --check`, `cargo tree -p espansoconfig-core | rg tauri` (nothing), `npm run check` (508 files,
0 errors, 0 warnings), `npm test`, `npm run build`, bundle oracle (server-only absent, client-only
present).

Rung **`1783 / 508 / 4470 / 227`** (+3 core tests).
