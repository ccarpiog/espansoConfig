/**
 * The classification of a failed command, and the R27 recovery it decides.
 *
 * The claim these tests exist for is a *distinction*, not a value: a stale
 * identity and a missing match are different failures and call for different
 * behaviour, and the boundary must keep them apart all the way to the caller.
 * A single "the command failed" arm would pass a test that only checked that
 * something went wrong, which is why every assertion below names a code.
 *
 * **On the missing per-callback JSDoc**: the `describe`/`it` callbacks below are
 * deliberately not documented twice. Vitest already takes the description as its
 * first argument, and a JSDoc sentence above it would be a second description
 * free to disagree with the first — see `docs/decisions/1b-2a-notes.md` §14 for
 * the reasoning, which is a decision rather than an oversight. Every callback
 * longer than ten lines still carries its closing-bracket comment, and every
 * ordinary function still carries its JSDoc.
 */

import { describe, expect, it } from 'vitest';
import {
  COMMAND_ERROR_CODES,
  COMMAND_ERROR_OPERANDS,
  classifyFailure,
  developerDetail,
  identityRecovery,
  isCommandError,
  type CommandError,
  type CommandErrorCode,
  type OperandShape
} from './errors';

/** A stale-revision rejection exactly as Rust writes it. */
const STALE: CommandError = {
  code: 'identityStaleRevision',
  expected: 'a'.repeat(64),
  found: 'b'.repeat(64)
};

/** A missing-match rejection exactly as Rust writes it. */
const NO_SUCH_MATCH: CommandError = { code: 'identityNoSuchMatch', node: 4 };

/**
 * A value of the declared shape, for building well-formed samples.
 *
 * @param shape - The shape {@link COMMAND_ERROR_OPERANDS} declares.
 * @returns Some value that has it.
 */
function valueOfShape(shape: OperandShape): unknown {
  switch (shape) {
    case 'string':
      return 'x';
    case 'number':
      return 1;
    case 'stringArray':
      return ['/nowhere'];
  }
} // End of function valueOfShape()

/**
 * A well-formed rejection for one code, built from the operand table.
 *
 * Derived from the declaration rather than written out per code, so a code
 * whose operands change cannot leave a stale sample behind.
 *
 * @param code - The code to build a rejection for.
 * @returns The rejection, with every declared operand present and well typed.
 */
function wellFormed(code: CommandErrorCode): Record<string, unknown> {
  const operands: Readonly<Record<string, OperandShape>> = COMMAND_ERROR_OPERANDS[code];
  const rejection: Record<string, unknown> = { code };
  for (const [name, shape] of Object.entries(operands)) {
    rejection[name] = valueOfShape(shape);
  }
  return rejection;
} // End of function wellFormed()

describe('isCommandError()', () => {
  it('recognises a well-formed rejection for every code in COMMAND_ERROR_CODES', () => {
    // The list is the *frontend's*. That it is also every code Rust can produce
    // is a separate claim, checked in Rust by
    // `the_frontend_error_codes_are_exactly_the_rust_codes`, because nothing on
    // this side of the boundary can see the enum.
    for (const code of COMMAND_ERROR_CODES) {
      expect(isCommandError(wellFormed(code))).toBe(true);
    }
  });

  it('refuses a code no Rust variant produces', () => {
    expect(isCommandError({ code: 'somethingInvented' })).toBe(false);
  });

  it('refuses the shapes an IPC rejection can otherwise take', () => {
    expect(isCommandError(null)).toBe(false);
    expect(isCommandError(undefined)).toBe(false);
    expect(isCommandError('Command x not allowed by ACL')).toBe(false);
    expect(isCommandError(new Error('boom'))).toBe(false);
    expect(isCommandError({ code: 7 })).toBe(false);
  });

  it('refuses a rejection whose declared operands are missing', () => {
    // The unsoundness the review of Phase 1b-2a found: the guard narrows to
    // `CommandError`, so a value it accepts is one every caller downstream may
    // read `.expected` and `.found` off. `{ code: 'identityStaleRevision' }` has
    // neither, and used to pass.
    expect(isCommandError({ code: 'identityStaleRevision' })).toBe(false);
    expect(isCommandError({ code: 'io' })).toBe(false);
    expect(isCommandError({ code: 'io', path: '/x' })).toBe(false);
    expect(isCommandError({ code: 'notUtf8', path: '/x' })).toBe(false);
  });

  it('refuses a rejection whose operands are of the wrong shape', () => {
    expect(isCommandError({ code: 'unknownDocument', document: '9' })).toBe(false);
    expect(isCommandError({ code: 'notUtf8', path: '/x', offset: '12' })).toBe(false);
    expect(isCommandError({ code: 'io', path: 3, kind: 'NotFound' })).toBe(false);
    expect(isCommandError({ code: 'configDirNotFound', candidates: '/x' })).toBe(false);
    expect(isCommandError({ code: 'configDirNotFound', candidates: [1] })).toBe(false);
  });

  it('accepts an operand the Rust variant gained but this build does not know', () => {
    // Surplus keys are forward compatibility, not malformation: the code
    // decides which message is shown, and an operand nothing interpolates is
    // harmless. A *missing* one is the test above.
    expect(isCommandError({ code: 'io', path: '/x', kind: 'NotFound', added: 1 })).toBe(true);
  });

  it('declares an operand table covering exactly the codes', () => {
    // The Rust side checks this table against what serde writes; this checks it
    // against the code list, so a code added to one and not the other cannot
    // leave the guard silently permitting everything for it.
    expect(Object.keys(COMMAND_ERROR_OPERANDS).sort()).toEqual([...COMMAND_ERROR_CODES].sort());
  });
});

describe('classifyFailure()', () => {
  it('keeps a command error typed, operands and all', () => {
    const failure = classifyFailure(STALE);
    expect(failure.kind).toBe('command');
    if (failure.kind !== 'command') {
      throw new Error('unreachable');
    }
    expect(failure.error).toEqual(STALE);
  });

  it('gives a rejection it does not recognise its own arm', () => {
    const failure = classifyFailure('Command get_match not allowed by ACL');
    expect(failure).toEqual({ kind: 'unexpected' });
    expect(developerDetail(failure)).toBe('Command get_match not allowed by ACL');
  });

  it('gives a malformed command rejection the unexpected arm, not a typed one', () => {
    // The consequence of the guard being sound: a rejection that carries a real
    // code but not its operands is not a `CommandError`, so it must land in the
    // arm whose `detail` nothing renders — rather than being narrowed to a type
    // whose fields are `undefined`.
    const failure = classifyFailure({ code: 'identityStaleRevision' });
    expect(failure.kind).toBe('unexpected');
  });

  it('reads the message of a thrown Error', () => {
    const failure = classifyFailure(new Error('the webview died'));
    expect(failure).toEqual({ kind: 'unexpected' });
    expect(developerDetail(failure)).toBe('the webview died');
  });

  it('survives a value that cannot be serialized', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const failure = classifyFailure(cyclic);
    expect(failure.kind).toBe('unexpected');
    expect(developerDetail(failure)).not.toBe(null);
  });

  it('answers null for a typed command error, which carries no developer string', () => {
    expect(developerDetail(classifyFailure(STALE))).toBe(null);
  });
});

describe('the developer string of an unexpected failure', () => {
  /**
   * The one rejection whose developer string is the thing under test.
   *
   * A sentence a real webview produces, chosen so that every assertion below
   * can look for a substring of it rather than for a shape.
   */
  const LEAKY = 'Command get_match not allowed by ACL';

  it('is not in JSON.stringify of the failure', () => {
    // **The review's fourth finding, in one assertion.** A component writing
    // `JSON.stringify(classifyFailure(x))` names no guarded identifier, so
    // `scripts/lint/ipc-detail.ts` passed it — and it rendered the string
    // anyway. A name scanner cannot decide this; a property descriptor can.
    expect(JSON.stringify(classifyFailure(LEAKY))).toBe('{"kind":"unexpected"}');
  }); // End of the "JSON.stringify" case

  it('is not an enumerable property, now or after a refactor', () => {
    // The property this pins is *enumerability*, not the current key: the
    // failure is asserted to have exactly one own enumerable key, so putting the
    // string back on the object under any name fails here.
    const failure = classifyFailure(LEAKY);
    expect(Object.keys(failure)).toEqual(['kind']);
    expect(Object.values(failure)).toEqual(['unexpected']);
    expect(Object.entries(failure)).toEqual([['kind', 'unexpected']]);
    const own = Object.getOwnPropertyNames(failure);
    expect(own).toEqual(['kind']);
    for (const key of Object.getOwnPropertySymbols(failure)) {
      expect(Object.getOwnPropertyDescriptor(failure, key)?.enumerable).toBe(false);
    }
  }); // End of the "not an enumerable property" case

  it('does not survive a spread, a clone or a for-in', () => {
    const failure = classifyFailure(LEAKY);
    expect(JSON.stringify({ ...failure })).toBe('{"kind":"unexpected"}');
    const seen: string[] = [];
    for (const key in failure) {
      seen.push(key);
    }
    expect(seen).toEqual(['kind']);
    expect(JSON.stringify(structuredClone({ ...failure }))).toBe('{"kind":"unexpected"}');
  }); // End of the "spread, clone or for-in" case

  it('is not reachable positionally, which the name scanner never could close', () => {
    // Hole 6 of `1b-2b-notes.md`: `Object.values(failure)[1]` reached the string
    // without writing the name. There is no index 1 any more.
    expect(Object.values(classifyFailure(LEAKY))[1]).toBe(undefined);
  }); // End of the "positional" case

  it('is still reachable through the accessor, so this is a design and not a deletion', () => {
    expect(developerDetail(classifyFailure(LEAKY))).toBe(LEAKY);
  });
}); // End of the "developer string" suite

describe('identityRecovery()', () => {
  it('asks for re-resolution when the identity is stale', () => {
    expect(identityRecovery(STALE).action).toBe('reresolve');
  });

  it('does not promise that a stale identity still names a match', () => {
    // The review's first High finding, in one assertion. The old contract said
    // "the identity is stale but the thing still exists — re-resolve it by its
    // DocumentPath and keep the selection", which is false: a DocumentPath step
    // into a sequence is an index, so an external deletion re-points it at a
    // different match. `a_document_path_is_positional_so_a_deletion_repoints_it`
    // in `src-tauri/src/commands.rs` is the Rust counterexample.
    //
    // If the arm ever goes back to promising existence, this fails.
    const recovery = identityRecovery(STALE);
    if (recovery.action !== 'reresolve') {
      throw new Error('unreachable');
    }
    expect(recovery.mayFind).toContain('gone');
    expect(recovery.mayFind).toContain('differentMatch');
    expect(recovery.mayFind).toContain('sameMatch');
  }); // End of the "does not promise that a stale identity still names a match" case

  it('asks for the selection to be cleared when there is nothing to re-resolve', () => {
    expect(identityRecovery(NO_SUCH_MATCH).action).toBe('clearSelection');
    expect(identityRecovery({ code: 'identityWrongDocument', expected: 1, found: 2 }).action).toBe(
      'clearSelection'
    );
    expect(identityRecovery({ code: 'unknownDocument', document: 9 }).action).toBe(
      'clearSelection'
    );
  });

  it('distinguishes the two identity refusals rather than treating both as gone', () => {
    // The whole of R27 in one assertion: if these two ever agree, a reload has
    // silently become a reason to lose the user's place.
    expect(identityRecovery(STALE).action).not.toBe(identityRecovery(NO_SUCH_MATCH).action);
  });

  it('says nothing about the selection for a failure that is not about identity', () => {
    expect(identityRecovery({ code: 'noWorkspaceOpen' }).action).toBe('none');
    expect(identityRecovery({ code: 'io', path: '/x', kind: 'NotFound' }).action).toBe('none');
  });

  it('answers every code the frontend knows about', () => {
    // The `never` assertion in `identityRecovery` is a compile-time check and
    // cannot be observed at run time; this is its run-time twin. A code with no
    // arm would have fallen into the old `default` and answered 'none' — which
    // is why the exhaustive switch replaced it.
    for (const code of COMMAND_ERROR_CODES) {
      const rejection = wellFormed(code) as unknown as CommandError;
      expect(['reresolve', 'clearSelection', 'none']).toContain(
        identityRecovery(rejection).action
      );
    }
  }); // End of the "answers every code the frontend knows about" case
});
