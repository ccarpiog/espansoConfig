<script module lang="ts">
  /**
   * The attribute this component marks its own paragraph with.
   *
   * **It exists for the four mounted suites and for nothing else.** The words on
   * screen are the same whether this component drew them or a host repeated the
   * paragraph itself, so a test written against the words alone cannot tell a
   * mounted renderer from a fifth copy of one — which is the whole finding this
   * component closes. Its value is the reason **this** component derived, so a
   * suite asserts what was mounted and what it decided in one query.
   *
   * The markup below repeats the literal rather than interpolating it, which is
   * legible at the cost of a second place to change; the four suites query
   * through this constant, so the two cannot drift without a red suite.
   *
   * It is not user-facing and is not translated: nothing renders it, and no
   * assistive technology is given it.
   */
  export const RECOVERY_WITHOUT_CREATION_ATTRIBUTE = 'data-recovery-without-creation';
</script>

<script lang="ts" generics="T">
  import { recoveryWithoutCreation, type RecoveryWithoutCreationKind } from '../browser/recovery';
  import type { ConflictModel } from '../browser/saveOutcome';
  import { tRecoveryUnavailable } from '../i18n';

  /*
   * What recovery is on a surface that cannot create: one sentence, or nothing.
   *
   * **One renderer for the four surfaces that draw a reason**, exactly as
   * `RecoveryPanel.svelte` is one renderer for the two that draw a form. The
   * deleter, the mover and the duplicator draft an operation and the raw editor
   * drafts a whole document; none of them can reach a `RecoveryChoice`, none has
   * a destination to write into and none ever draws a form. What each of them
   * shows is a **reason**, and until 2c-4c-3b's review each of them decided
   * separately to show one — four `{#if}` blocks over one model answer, so a
   * host could omit the sentence while consuming the model faithfully. That is
   * the failure mode 2c-3c-3 named: a rule written into one renderer is carried
   * by that renderer's mounted suite alone.
   *
   * **This component owns the decision to draw, and a host mounts it
   * unconditionally.** No host carries a condition about the sentence — the tag
   * stands unwrapped in all three match panels, and in the raw editor the only
   * block above it is the one that decides whether there is an editor at all.
   * Whether there is anything to say is `recoveryWithoutCreation`'s answer —
   * `null` with no conflict, so a screen where no version on disk is in dispute
   * says nothing — and it is asked here, from the conflict and the kind a host
   * hands over.
   *
   * **It is not `RecoveryPanel.svelte` and cannot be.** That panel's label, its
   * heading, its transfer table, its destination list and its create control are
   * all about a new snippet these four surfaces cannot make, and mounting it
   * here would mean making its `open`, `create` and `adoptDiskVersion`
   * collaborators optional on the two surfaces that must never be without them —
   * a prop that may be absent on the surface that creates is this project's
   * "a control could compile and do nothing" failure.
   *
   * **The sentence is reached through an accessor**, never through a hand-built
   * key: `tRecoveryUnavailable` is the reactive wrapper over `codes.ts`, whose
   * return types make a missing string a compile error in that file.
   */

  const {
    kind,
    conflict
  }: {
    /**
     * What the host surface's retained draft is, for recovery.
     *
     * `RecoveryWithoutCreationKind` excludes the two creating kinds, so a
     * surface that can create cannot reach this renderer through the type. What
     * no type forces is that a host passes the kind **its own** operation module
     * declares; each host's mounted suite is what asserts the sentence drawn is
     * that surface's and not the other's.
     */
    kind: RecoveryWithoutCreationKind;
    /**
     * The conflict the host is showing, or `null` when there is none.
     *
     * Generic in the drafted value because `ConflictModel<T>` is invariant in
     * `T` — its draft carries the value's own comparison rules — so a
     * `ConflictModel<MatchId>` is not a `ConflictModel<unknown>`. Nothing here
     * reads the drafted value; it is handed on whole.
     */
    conflict: ConflictModel<T> | null;
  } = $props();

  /** The reason to draw, or `null` when this surface has nothing to say. */
  const reason = $derived(recoveryWithoutCreation(kind, conflict));
</script>

{#if reason !== null}
  <p class="kind" data-recovery-without-creation={reason}>{tRecoveryUnavailable(reason)}</p>
{/if}

<style>
  /* The face every surface gives a line it says *about* a value rather than the
     value itself — the same rule the four hosts carry under the same name. It is
     repeated here rather than inherited because Svelte scopes styles: a host's
     `.kind` does not reach an element this component owns. */
  .kind {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }
</style>
