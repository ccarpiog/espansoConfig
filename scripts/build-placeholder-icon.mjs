#!/usr/bin/env node
/**
 * Generates the placeholder application icon.
 *
 * **This is a placeholder, not a design.** Tauri's code generator opens
 * `src-tauri/icons/icon.png` unconditionally, so the crate does not compile
 * without one; the real icon is a Phase 5 packaging concern (plan section 10).
 * Rather than commit an opaque binary nobody can regenerate, the bytes are
 * produced here, from source, by a script with no dependencies.
 *
 * Usage:
 *   node scripts/build-placeholder-icon.mjs
 *
 * It writes `src-tauri/icons/icon.png` (1024x1024) and, when `sips` and
 * `iconutil` are available, `src-tauri/icons/icon.icns` for the macOS bundle.
 */

import { execFileSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 1024;
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const ICON_DIR = join(REPO_ROOT, 'src-tauri', 'icons');

/** Background colour of the rounded square, as RGB. */
const BACKGROUND = [0x1c, 0x3d, 0x5a];
/** Colour of the "lines of text" motif, as RGB. */
const FOREGROUND = [0xf2, 0xf4, 0xf7];

/** Precomputed CRC-32 table (IEEE polynomial), built once. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * Computes the CRC-32 of a buffer, as PNG chunks require.
 *
 * @param {Buffer} bytes - The bytes to checksum.
 * @returns {number} The unsigned CRC-32.
 */
function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
} // End of function crc32()

/**
 * Wraps a payload in a PNG chunk with its length, type and CRC.
 *
 * @param {string} type - The four-character chunk type, e.g. `IHDR`.
 * @param {Buffer} payload - The chunk's data.
 * @returns {Buffer} The complete chunk.
 */
function chunk(type, payload) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  const typeAndPayload = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndPayload), 0);
  return Buffer.concat([length, typeAndPayload, crc]);
} // End of function chunk()

/**
 * Decides whether a pixel is inside the icon's rounded square.
 *
 * @param {number} x - Pixel column.
 * @param {number} y - Pixel row.
 * @returns {boolean} `true` when the pixel is part of the shape.
 */
function insideRoundedSquare(x, y) {
  const inset = SIZE * 0.08;
  const radius = SIZE * 0.22;
  const left = inset;
  const right = SIZE - inset;
  const top = inset;
  const bottom = SIZE - inset;
  if (x < left || x > right || y < top || y > bottom) {
    return false;
  }
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
} // End of function insideRoundedSquare()

/**
 * Decides whether a pixel belongs to the three-bar "lines of text" motif.
 *
 * @param {number} x - Pixel column.
 * @param {number} y - Pixel row.
 * @returns {boolean} `true` when the pixel is part of a bar.
 */
function insideBars(x, y) {
  const barHeight = SIZE * 0.075;
  const gap = SIZE * 0.075;
  const startX = SIZE * 0.27;
  const widths = [0.46, 0.32, 0.4];
  const firstTop = SIZE * 0.33;
  for (let index = 0; index < widths.length; index += 1) {
    const top = firstTop + index * (barHeight + gap);
    const width = SIZE * widths[index];
    if (y >= top && y <= top + barHeight && x >= startX && x <= startX + width) {
      return true;
    }
  }
  return false;
} // End of the loop over the three bars, and of function insideBars()

/**
 * Renders the icon and encodes it as an RGBA PNG.
 *
 * @returns {Buffer} The complete PNG file.
 */
function renderPng() {
  const stride = SIZE * 4 + 1;
  const raw = Buffer.alloc(stride * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // Filter type 0 (None) for every scanline.
    for (let x = 0; x < SIZE; x += 1) {
      const offset = rowStart + 1 + x * 4;
      if (!insideRoundedSquare(x, y)) {
        continue; // Transparent, which Buffer.alloc already zeroed.
      }
      const colour = insideBars(x, y) ? FOREGROUND : BACKGROUND;
      raw[offset] = colour[0];
      raw[offset + 1] = colour[1];
      raw[offset + 2] = colour[2];
      raw[offset + 3] = 0xff;
    }
  } // End of the loop over every scanline

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // Bit depth.
  ihdr[9] = 6; // Colour type: truecolour with alpha.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
} // End of function renderPng()

/**
 * Builds `icon.icns` from the master PNG using the macOS system tools.
 *
 * Skipped with a note when `sips` or `iconutil` is unavailable, because the
 * `.icns` is only needed to *bundle* the app, never to compile it.
 *
 * @param {string} masterPath - Path to the 1024x1024 PNG.
 * @returns {void}
 */
function buildIcns(masterPath) {
  const iconset = mkdtempSync(join(tmpdir(), 'espansoconfig-iconset-')) + '/icon.iconset';
  mkdirSync(iconset);
  try {
    for (const size of [16, 32, 64, 128, 256, 512, 1024]) {
      const name = size === 1024 ? 'icon_512x512@2x.png' : `icon_${size}x${size}.png`;
      execFileSync('sips', ['-z', String(size), String(size), masterPath, '--out', join(iconset, name)], {
        stdio: 'ignore'
      });
    }
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(ICON_DIR, 'icon.icns')]);
    console.log('wrote src-tauri/icons/icon.icns');
  } catch (error) {
    console.warn('skipped icon.icns:', error instanceof Error ? error.message : error);
  } finally {
    rmSync(dirname(iconset), { recursive: true, force: true });
  }
} // End of function buildIcns()

mkdirSync(ICON_DIR, { recursive: true });
const masterPath = join(ICON_DIR, 'icon.png');
writeFileSync(masterPath, renderPng());
console.log('wrote src-tauri/icons/icon.png');
buildIcns(masterPath);
