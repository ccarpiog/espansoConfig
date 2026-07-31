/**
 * Two type operators that make a hand-written table's completeness a compile
 * error, and **nothing at run time**.
 *
 * This module declares types only. It emits no code, so nothing here reaches the
 * bundle: the previous spelling of the same idea was a no-op *function* whose
 * calls survived into the test build for no purpose.
 *
 * ## Why a hand-written table needs checking at all
 *
 * **The R24 corollary.** A sample table derived from the thing it is meant to
 * check agrees with it by construction and can never fail — so every table in
 * this repository is written out by hand. But a hand-written list can be
 * *short*, and a test named "renders every badge" that iterates nine of ten
 * badges is a test whose body cannot fail when its name is false. That is the
 * shape Phase 1b-2b's review found in `COMMAND_ERRORS`.
 *
 * ## How the pair is used
 *
 * Pair a table with `as const satisfies readonly Member[]` — which gets the
 * *list ⊆ union* direction for free, naming any entry that is not a member — and
 * then name the other direction once:
 *
 * ```ts
 * const KINDS = ['Scalar', 'Sequence'] as const satisfies readonly ValueKind[];
 * export type _KindsAreComplete = ExpectNever<Missing<ValueKind, typeof KINDS>>;
 * ```
 *
 * A member added to the union and forgotten in the table is then an
 * `npm run check` failure **naming the member**, in the file holding the table,
 * before any test runs.
 *
 * The alias is exported and given a leading underscore by convention, so that
 * "declared and never read" cannot delete it.
 */

/**
 * The members of `Union` that the hand-written list `Listed` does not name.
 *
 * `never` exactly when the list is complete, which is what {@link ExpectNever}
 * turns into an assertion.
 *
 * @typeParam Union - The union the list is meant to cover.
 * @typeParam Listed - The hand-written list, as `typeof TABLE`.
 */
export type Missing<Union extends string, Listed extends readonly string[]> = Exclude<
  Union,
  Listed[number]
>;

/**
 * Accepts only `never`; the constraint *is* the assertion.
 *
 * Instantiating it with anything else fails `npm run check` at the alias that
 * names it, and the error message names the type that was not empty.
 *
 * @typeParam T - The type asserted to be empty. See {@link Missing}.
 */
export type ExpectNever<T extends never> = T;
