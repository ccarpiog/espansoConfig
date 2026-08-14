/**
 * The measurements a restore screen states, driven without a screen.
 *
 * Two claims, and both are about arithmetic rather than about prose:
 *
 * 1. **the byte count is the count of the bytes that would be written**, so a
 *    non-ASCII candidate, an astral character and a byte-order mark are all
 *    counted as UTF-8 rather than as UTF-16 code units — which is what
 *    `String.length` would have given, and what a screen writing `text.length`
 *    into markup would have shown;
 * 2. **the catalogue's recorded length is compared, never trusted.** It arrives
 *    as untrusted decimal digits, it is read with `BigInt` because a filesystem
 *    length can exceed the safe-integer range, and digits this application
 *    cannot read produce `null` on both fields rather than a number nobody
 *    observed.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own.
 */

import { describe, expect, it } from 'vitest';
import { candidateMeasurements, distinctReasons } from './restoreFacts';
import type { BatchSkipped } from '../ipc/types';

/**
 * A candidate holding every awkward class of character this corpus pins.
 *
 * A byte-order mark, a CRLF pair, a precomposed `é`, a decomposed one and an
 * astral emoji — the same classes `unicode-offsets.yml` pins in the corpus, and
 * every one of them a character `String.length` counts wrongly.
 */
const AWKWARD = '﻿matches:\r\néé\u{1F600}';

describe('candidateMeasurements', () => {
  it('counts the UTF-8 bytes that would be written, not UTF-16 code units', () => {
    const measured = candidateMeasurements(AWKWARD, '0');
    // BOM 3 + "matches:" 8 + CR 1 + LF 1 + precomposed é 2 + "e" 1 + combining
    // acute 2 + emoji 4.
    expect(measured.bytes).toBe(22);
    // The two numbers a screen could confuse with it and with each other: 16
    // UTF-16 code units, because the emoji is a surrogate pair, and 15 code
    // points. Neither is the number of bytes that would be written.
    expect(AWKWARD.length).toBe(16);
    expect(measured.codePoints).toBe(15);
  }); // End of the "counts UTF-8 bytes" case

  it('counts nothing as nothing', () => {
    const measured = candidateMeasurements('', '0');
    expect(measured.bytes).toBe(0);
    expect(measured.codePoints).toBe(0);
    expect(measured.agreesWithListing).toBe(true);
  });

  it('agrees with a listing that recorded the same number', () => {
    const measured = candidateMeasurements(AWKWARD, '22');
    expect(measured.listedLength).toBe(22n);
    expect(measured.agreesWithListing).toBe(true);
  });

  it('disagrees with a listing that recorded another number, and says so as a comparison', () => {
    // Two observations taken at two moments. The model answers `false` and
    // carries both numbers; what the screen may say about that is that they
    // differ, and nothing about which one describes the folder now.
    const measured = candidateMeasurements(AWKWARD, '21');
    expect(measured.listedLength).toBe(21n);
    expect(measured.agreesWithListing).toBe(false);
  });

  it('reads a length beyond the safe-integer range exactly', () => {
    // The reason `BackupEntry.length` crosses the wire as digits at all:
    // `Number('9007199254740993')` is silently 9007199254740992.
    const measured = candidateMeasurements('x', '9007199254740993');
    expect(measured.listedLength).toBe(9007199254740993n);
    expect(measured.agreesWithListing).toBe(false);
  });

  it.each(['', ' 12 ', '0x0c', '-1', '1.0', '1e3', 'twelve'])(
    'refuses %o as a recorded length rather than inventing one',
    (digits) => {
      // Every one of these is something `BigInt` either accepts outright or
      // throws on, and a screen must show neither a wrong number nor an
      // exception. A batch is untrusted input.
      const measured = candidateMeasurements('x', digits);
      expect(measured.listedLength).toBeNull();
      expect(measured.agreesWithListing).toBeNull();
      expect(measured.bytes).toBe(1);
    }
  ); // End of the "refuses unreadable digits" case
}); // End of the "candidateMeasurements" suite

describe('distinctReasons', () => {
  it('collapses one code per skipped entry to one code per reason', () => {
    const skipped: readonly BatchSkipped[] = [
      'ForeignName',
      'ForeignName',
      'NoMarker',
      'ForeignName'
    ];
    expect(distinctReasons(skipped)).toEqual(['ForeignName', 'NoMarker']);
  });

  it('keeps first-seen order, so a listing is described in the order it arrived', () => {
    expect(distinctReasons(['b', 'a', 'b', 'c'])).toEqual(['b', 'a', 'c']);
  });

  it('answers nothing for a listing that skipped nothing', () => {
    expect(distinctReasons([])).toEqual([]);
  });
}); // End of the "distinctReasons" suite
