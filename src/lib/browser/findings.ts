/**
 * What this application noticed about one file, decided here rather than in
 * markup.
 *
 * The companion of `detail.ts`: that module models one *match*, this one models
 * one *file*. Both are read by a component that no automated test in this
 * repository renders (`docs/decisions/1c-1-notes.md` hole 1), so both keep every
 * decision on this side of the boundary.
 *
 * ## Why this lives in the snippet list rather than in the detail pane
 *
 * A diagnostic is about a file, and **the file that most needs one has no
 * matches at all**. The four deliberately invalid fixtures
 * (`crates/espansoconfig-core/tests/corpus/synthetic/invalid/`) cross the
 * boundary as a `DocumentView` with `parsed: false`, an empty `matches` and a
 * `ParseFailed` diagnostic — not as a refusal
 * (`a_document_that_does_not_parse_crosses_as_a_view_not_as_an_error` in
 * `src-tauri/src/commands.rs`). Nothing in such a file can ever be *selected*,
 * so the detail pane can never be reached for it. The middle pane can, because
 * the sidebar selects the file itself.
 *
 * ## Two rules govern everything below
 *
 * **A diagnostic is never dropped, and a hazard is never dropped.** Two
 * diagnostics carrying the same code render as the same sentence, because the
 * fields that distinguish them — the span, the node and the path — are not on
 * screen. The first version of this module answered that by keeping one of them
 * and discarding the rest, and the 1c-2b-1 review was right that this **loses a
 * finding**: twenty `KeyNotAccountedFor` diagnostics at twenty different keys
 * became one sentence saying "one key of this file", which is a false statement
 * about a real configuration.
 *
 * So the rule is **aggregation, not removal**. Occurrences of one code are
 * counted rather than dropped: the sentence is printed once and carries "in N
 * places" beside it. The count is over **distinct records** — code, span, node
 * and path together — so two records that are equal in every field are one
 * place, which is the only case where anything is still collapsed and is a case
 * the wire is not supposed to produce.
 *
 * Aggregating was chosen over printing the sentence N times because the sentence
 * is *identical* N times: without a span on screen, twenty repetitions of "one
 * key of this file could not be accounted for" tell the reader nothing that "in
 * 20 places" does not, and they push everything below them off the pane. What
 * would be strictly better is a *located* line per occurrence, and that needs a
 * line number the pane does not have yet — see the holes in
 * `docs/decisions/1c-2b-1-notes.md`.
 *
 * **The hazard list is a union, not a copy.** `DocumentView.hazards` is the
 * distinct set the core derived, and each hazard *also* arrives as its own
 * `Hazard` diagnostic. Rendering both would print every hazard twice, once as a
 * noun phrase and once as a sentence; rendering only `hazards` would drop a kind
 * the diagnostics named and the summary somehow did not. So the two are unioned
 * and the `Hazard` diagnostics are then left out of the sentence list.
 */

import type { Diagnostic, DiagnosticCode, DocumentView, HazardKind } from '../ipc/types';

/**
 * One diagnostic, as one line of the pane.
 *
 * The span, the node and the path are deliberately **not** here: nothing on
 * screen shows a byte offset yet, and carrying a field the pane does not render
 * is how a model starts implying that it does. What survives of them is
 * {@link DiagnosticLine.occurrences}, which is a count *of* them.
 */
export interface DiagnosticLine {
  /**
   * The identity every occurrence of one sentence shares.
   *
   * Also the `{#each}` key, which is why it is a string: a component keying on
   * the code object would key on identity rather than on value and re-create
   * every node on each re-render.
   */
  readonly id: string;
  /** What was noticed, as the code and operands that crossed the boundary. */
  readonly code: DiagnosticCode;
  /**
   * How many distinct places in the file raised this exact sentence.
   *
   * Always at least 1. It is the count the review's `KeyNotAccountedFor`
   * scenario needed: without it, twenty affected keys read as one.
   */
  readonly occurrences: number;
  /**
   * Whether the pane says the count out loud.
   *
   * The threshold, and it lives here rather than as a `> 1` in markup for the
   * reason every other decision in this module does: a comparison written in a
   * component is a decision no test in this repository can reach. "in 1 place"
   * beside a single diagnostic is noise; "in 20 places" is the finding.
   */
  readonly repeated: boolean;
}

/** Everything the snippet list says about the file it is showing. */
export interface FileFindings {
  /**
   * Whether the substrate accepted the file.
   *
   * Carried so a reader of this model can tell "this file holds no snippets"
   * from "this file could not be read as YAML"; the sentence that says so is
   * the `ParseFailed` diagnostic, not a string of this module's own.
   */
  readonly parsed: boolean;
  /** The distinct constructs the visual editor refuses, in the core's order. */
  readonly hazards: readonly HazardKind[];
  /** Everything else the projection noticed, aggregated, in source order. */
  readonly diagnostics: readonly DiagnosticLine[];
}

/** A file about which nothing at all is said. */
const NOTHING: FileFindings = { parsed: true, hazards: [], diagnostics: [] };

/**
 * The hazard a `Hazard` diagnostic names, or `null` for any other code.
 *
 * A function rather than an inline test because both halves of this module ask
 * the question — the hazard union asks it to *collect*, the sentence list asks
 * it to *skip* — and a second spelling of "is this a hazard diagnostic?" is a
 * second thing to keep in step.
 *
 * @param code - A diagnostic code as it crossed the boundary.
 * @returns The hazard it names, or `null`.
 */
export function hazardOf(code: DiagnosticCode): HazardKind | null {
  return typeof code === 'string' || !('Hazard' in code) ? null : code.Hazard.kind;
} // End of function hazardOf()

/**
 * The identity every occurrence of one *sentence* shares.
 *
 * `JSON.stringify` of the code, which is the operand set and nothing else. The
 * boundary writes an externally tagged enum, so a variant with no operands is a
 * bare string and one with operands is a single-key object whose key order is
 * `serde`'s and therefore fixed for a given variant.
 *
 * This is what groups lines. It is **not** what decides whether a finding is
 * distinct — {@link occurrenceIdentity} is — and the difference is the review's
 * Medium 1: two `KeyNotAccountedFor` diagnostics read the same and are two
 * findings, so they share one line and count two.
 *
 * @param code - A diagnostic code as it crossed the boundary.
 * @returns A string equal exactly for codes that read the same.
 */
export function diagnosticIdentity(code: DiagnosticCode): string {
  return JSON.stringify(code);
} // End of function diagnosticIdentity()

/**
 * The identity two diagnostics share only when they are the **same finding**.
 *
 * Everything the record carries: the code, the span, the node and the path. Two
 * records equal in all four are one finding reported twice, which the wire is
 * not supposed to produce and which this is the only place that collapses.
 *
 * @param diagnostic - A diagnostic as it crossed the boundary.
 * @returns A string equal exactly for records equal in every field.
 */
export function occurrenceIdentity(diagnostic: Diagnostic): string {
  return JSON.stringify([diagnostic.code, diagnostic.span, diagnostic.node, diagnostic.path]);
} // End of function occurrenceIdentity()

/**
 * Builds the model for one file's diagnostics and hazards.
 *
 * @param view - The projection of the file the list is showing, or `null` when
 *   the list is showing every file rather than one.
 * @returns What the pane draws; empty in every field when there is nothing to
 *   say, so a caller asks {@link hasFindings} rather than three questions.
 */
export function describeFindings(view: DocumentView | null): FileFindings {
  if (view === null) {
    return NOTHING;
  }
  // A set rather than an array, because the summary is only *promised* to be
  // distinct. It is `distinct_hazards()` in Rust today; a duplicate in it would
  // otherwise reach `SnippetList.svelte` as two rows keyed on one value, which
  // Svelte refuses at run time — in a component no test renders.
  const hazards = new Set<HazardKind>(view.hazards);
  const lines = new Map<string, { code: DiagnosticCode; occurrences: Set<string> }>();
  for (const diagnostic of view.diagnostics) {
    const hazard = hazardOf(diagnostic.code);
    if (hazard !== null) {
      // A hazard the summary did not list is still a hazard. Adding rather than
      // asserting keeps a wire disagreement visible instead of silent, and a
      // `Set` keeps first-seen order while making the add idempotent.
      hazards.add(hazard);
      continue;
    }
    const id = diagnosticIdentity(diagnostic.code);
    const line = lines.get(id);
    if (line === undefined) {
      lines.set(id, { code: diagnostic.code, occurrences: new Set([occurrenceIdentity(diagnostic)]) });
    } else {
      line.occurrences.add(occurrenceIdentity(diagnostic));
    }
  } // End of the loop over the document's diagnostics
  const diagnostics: DiagnosticLine[] = [...lines].map(([id, line]) => ({
    id,
    code: line.code,
    occurrences: line.occurrences.size,
    repeated: line.occurrences.size > 1
  }));
  return { parsed: view.parsed, hazards: [...hazards], diagnostics };
} // End of function describeFindings()

/**
 * Whether a file has anything to say about itself.
 *
 * A compound question, asked here for the reason `hasDiscovery` in `detail.ts`
 * is: a compound predicate written in markup is a decision no test in this
 * repository can reach.
 *
 * @param findings - The model built for one file.
 * @returns `true` when the pane would draw at least one line.
 */
export function hasFindings(findings: FileFindings): boolean {
  return findings.hazards.length > 0 || findings.diagnostics.length > 0;
} // End of function hasFindings()
