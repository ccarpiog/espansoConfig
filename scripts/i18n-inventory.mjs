#!/usr/bin/env node
/**
 * Derives a phase's translation-review inventory from git, reproducibly.
 *
 * **What it answers.** Which dictionary keys a phase added (and which
 * pre-existing keys it changed or removed), each key's English and Spanish
 * value, the step whose commit first held it, and the non-test source file —
 * for a `.ts` file, the enclosing top-level function — that names it. It is an
 * inventory for the owner's native-speaker review (R35), **not evidence of
 * meaning**: nothing here reads whether a Spanish value says what its English
 * value says.
 *
 * **Everything is read from git objects, never from the working tree**, so two
 * runs against the same commits print the same bytes whatever is uncommitted.
 * It is not part of any gate and imports nothing from the application.
 *
 * Usage (from anywhere inside the repository):
 *
 *   node scripts/i18n-inventory.mjs --phase 4 summary   # counts and the gap check
 *   node scripts/i18n-inventory.mjs --phase 4 rows      # markdown rows, added keys
 *   node scripts/i18n-inventory.mjs --phase 4 changed   # markdown rows, changed keys
 *   node scripts/i18n-inventory.mjs --phase 4 check     # exits 1 when a gap exists
 *
 * Options:
 *
 *   --phase N    the phase's base is the first commit that touches
 *                `docs/decisions/N-split-notes.md` (its design consult, which
 *                changes no dictionary)
 *   --base REV   an explicit base commit instead of `--phase`
 *   --head REV   the commit read as the phase's end (default `HEAD`)
 *
 * **The gap check.** A key is a gap when it lacks an English value, lacks a
 * Spanish value, or has no producer. A `code.*` key additionally needs its
 * producer in `src/lib/i18n/codes.ts`, the typed `describe*`/`*Key` accessor
 * layer (`CLAUDE.md` §2); a `code.*` key named only elsewhere is reported as
 * an untyped producer. The reverse direction — a Rust wire variant with no
 * string — is `src-tauri/src/dictionary_contract.rs`'s, under `cargo test`.
 * Whether an accessor can produce every member of its family is checked by
 * nothing: this script credits a template family to one function, and the
 * compiler (`TranslationKey`, under `npm run check`) proves only that every
 * key an accessor returns exists, not that every family member is returned.
 *
 * **What a producer match is.** First a literal match (the whole key between
 * quote characters); only if none, a template match (the longest dot-ending
 * prefix of the key followed by `${`). Comments are stripped before matching,
 * so a key that is only named in a comment has no producer. A match shows that
 * a file names the key, not that anything draws it: the component that renders
 * a `codes.ts` accessor's result is one call further on and is not traced.
 */

import { execFileSync } from 'node:child_process';

/** Paths of the two dictionaries, relative to the repository root. */
const DICTIONARIES = { en: 'src/lib/i18n/en.json', es: 'src/lib/i18n/es.json' };

/** The typed accessor layer a `code.*` key must be produced from. */
const CODES_FILE = 'src/lib/i18n/codes.ts';

/**
 * Runs git in the repository and returns its standard output.
 *
 * @param {string[]} args - The git arguments.
 * @param {string | Buffer} [input] - Standard input, when the command reads one.
 * @returns {Buffer} The raw standard output.
 */
function git(args, input) {
  return execFileSync('git', ['-C', REPO, ...args], {
    input,
    maxBuffer: 512 * 1024 * 1024,
  });
} // End of function git()

/** The repository root, found from the current directory. */
const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

/**
 * Parses the command line into options and a mode.
 *
 * @param {string[]} argv - The arguments after the script's path.
 * @returns {{ base: string, head: string, mode: string }} The resolved range and mode.
 */
function parseArguments(argv) {
  let phase = null;
  let base = null;
  let head = 'HEAD';
  let mode = 'summary';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--phase') phase = argv[++i];
    else if (arg === '--base') base = argv[++i];
    else if (arg === '--head') head = argv[++i];
    else if (['summary', 'rows', 'changed', 'check'].includes(arg)) mode = arg;
    else throw new Error(`unrecognised argument: ${arg}`);
  } // End of the loop over the command-line arguments
  if (base === null) {
    if (phase === null) throw new Error('give --phase N or --base REV');
    const first = git(['log', '--reverse', '--format=%H', '--', `docs/decisions/${phase}-split-notes.md`])
      .toString('utf8')
      .split('\n')[0];
    if (!first) throw new Error(`no commit touches docs/decisions/${phase}-split-notes.md`);
    base = first;
  }
  const short = (rev) => git(['rev-parse', '--short', rev]).toString('utf8').trim();
  return { base: short(base), head: short(head), mode };
} // End of function parseArguments()

/**
 * Reads one dictionary as it was at a commit. Both dictionaries are flat
 * key-to-string maps.
 *
 * @param {string} rev - The commit.
 * @param {'en' | 'es'} lang - Which dictionary.
 * @returns {Record<string, string>} The flat dictionary.
 */
function dictionaryAt(rev, lang) {
  return JSON.parse(git(['show', `${rev}:${DICTIONARIES[lang]}`]).toString('utf8'));
} // End of function dictionaryAt()

/**
 * Reads every non-test `.ts` and `.svelte` source under `src/` at a commit, in
 * one `git cat-file --batch` call.
 *
 * @param {string} rev - The commit.
 * @returns {Map<string, string>} Path to file text, sorted by path.
 */
function sourcesAt(rev) {
  const paths = git(['ls-tree', '-r', '--name-only', rev, '--', 'src'])
    .toString('utf8')
    .split('\n')
    .filter((p) => (p.endsWith('.ts') || p.endsWith('.svelte')) && !p.endsWith('.test.ts') && !p.endsWith('.d.ts'))
    .sort();
  const out = git(['cat-file', '--batch'], paths.map((p) => `${rev}:${p}`).join('\n') + '\n');
  const texts = new Map();
  let at = 0;
  for (const path of paths) {
    const headerEnd = out.indexOf(0x0a, at);
    const size = Number(out.subarray(at, headerEnd).toString('utf8').split(' ')[2]);
    texts.set(path, out.subarray(headerEnd + 1, headerEnd + 1 + size).toString('utf8'));
    at = headerEnd + 1 + size + 1;
  } // End of the loop over the batch output's objects
  return texts;
} // End of function sourcesAt()

/**
 * Blanks comments out of a source text, keeping every other character's
 * offset. Block comments, HTML comments and line comments are blanked; a `//`
 * inside a quoted string on the same line is left alone.
 *
 * @param {string} text - A `.ts` or `.svelte` source.
 * @returns {string} The same text with comment characters replaced by spaces.
 */
function withoutComments(text) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  let result = text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/<!--[\s\S]*?-->/g, blank);
  result = result
    .split('\n')
    .map((line) => {
      let quote = null;
      for (let i = 0; i < line.length; i += 1) {
        const c = line[i];
        if (quote) {
          if (c === '\\') i += 1;
          else if (c === quote) quote = null;
        } else if (c === "'" || c === '"' || c === '`') quote = c;
        else if (c === '/' && line[i + 1] === '/') return line.slice(0, i) + ' '.repeat(line.length - i);
      } // End of the loop over one line's characters
      return line;
    })
    .join('\n');
  return result;
} // End of function withoutComments()

/**
 * Escapes a string for use inside a regular expression.
 *
 * @param {string} s - Literal text.
 * @returns {string} The escaped pattern.
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
} // End of function escapeRegExp()

/**
 * Names a match by its file and, in a `.ts` file, by the enclosing top-level
 * function or `const`, so an accessor is named exactly.
 *
 * @param {string} path - The file.
 * @param {string} text - Its comment-free text.
 * @param {number} offset - Where the match starts.
 * @returns {string} `path` or `path#name`.
 */
function located(path, text, offset) {
  if (!path.endsWith('.ts')) return path;
  const before = text.slice(0, offset);
  const names = [...before.matchAll(/^(?:export )?(?:async )?(?:function\*? |const |let )(\w+)/gm)];
  return names.length ? `${path}#${names[names.length - 1][1]}` : path;
} // End of function located()

/**
 * Finds the files that name a key, literally or through a template prefix.
 *
 * @param {string} key - The dictionary key.
 * @param {Map<string, string>} sources - Comment-free source texts by path.
 * @returns {{ how: 'literal' | 'template' | 'none', prefix: string, files: string[] }} The match.
 */
function producersOf(key, sources) {
  const literal = new RegExp(`['"\`]${escapeRegExp(key)}['"\`]`);
  const hits = [];
  for (const [path, text] of sources) {
    const m = literal.exec(text);
    if (m) hits.push(located(path, text, m.index));
  } // End of the loop looking for a literal match
  if (hits.length) return { how: 'literal', prefix: '', files: hits };
  const parts = key.split('.');
  for (let n = parts.length - 1; n >= 1; n -= 1) {
    const prefix = parts.slice(0, n).join('.') + '.';
    const template = new RegExp(`\`${escapeRegExp(prefix)}\\$\\{`);
    for (const [path, text] of sources) {
      const m = template.exec(text);
      if (m) hits.push(located(path, text, m.index));
    } // End of the loop looking for a template match
    if (hits.length) return { how: 'template', prefix, files: hits };
  } // End of the loop over the key's prefixes
  return { how: 'none', prefix: '', files: [] };
} // End of function producersOf()

/**
 * Attributes each added key, and each changed pre-existing key, to the steps
 * whose commits introduced it, by walking the range's dictionary commits.
 *
 * @param {string} base - The phase's base commit.
 * @param {string} head - The phase's end commit.
 * @param {Record<string, string>} baseEn - English at the base.
 * @param {Record<string, string>} baseEs - Spanish at the base.
 * @returns {{ addedBy: Map<string, string>, changedBy: Map<string, string[]> }} The attributions.
 */
function attribute(base, head, baseEn, baseEs) {
  const commits = git([
    'log', '--reverse', '--format=%h\t%s', `${base}..${head}`, '--', DICTIONARIES.en, DICTIONARIES.es,
  ])
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split('\t');
      const m = /^Phase ([0-9]+(?:-[0-9]+)+)/.exec(subject);
      return { hash, step: m ? m[1] : subject };
    });
  const addedBy = new Map();
  const changedBy = new Map();
  let previousEn = baseEn;
  let previousEs = baseEs;
  for (const commit of commits) {
    const en = dictionaryAt(commit.hash, 'en');
    const es = dictionaryAt(commit.hash, 'es');
    for (const key of Object.keys(en)) {
      if (!(key in baseEn) && !addedBy.has(key)) addedBy.set(key, `${commit.step} (\`${commit.hash}\`)`);
      if (key in baseEn && key in previousEn && (en[key] !== previousEn[key] || es[key] !== previousEs[key])) {
        changedBy.set(key, [...(changedBy.get(key) ?? []), commit.step]);
      }
    } // End of the loop over one commit's English keys
    previousEn = en;
    previousEs = es;
  } // End of the loop over the range's dictionary commits
  return { addedBy, changedBy };
} // End of function attribute()

/**
 * Escapes a value for a markdown table cell.
 *
 * @param {unknown} value - A dictionary value, possibly undefined.
 * @returns {string} The cell text.
 */
function cell(value) {
  if (value === undefined) return '**missing**';
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '\\n');
} // End of function cell()

/**
 * Formats a producer match as a table cell.
 *
 * @param {{ how: string, prefix: string, files: string[] }} producer - The match.
 * @returns {string} The cell text.
 */
function producerCell(producer) {
  if (producer.how === 'none') return '**none found in `src/`**';
  const files = producer.files.map((f) => `\`${f.replace(/^src\/lib\//, '')}\``).join(', ');
  return producer.how === 'template' ? `${files} (template \`${producer.prefix}\${…}\`)` : files;
} // End of function producerCell()

/**
 * Builds the inventory and prints the requested mode.
 *
 * @returns {number} The process exit status.
 */
function main() {
  const { base, head, mode } = parseArguments(process.argv.slice(2));
  const baseEn = dictionaryAt(base, 'en');
  const baseEs = dictionaryAt(base, 'es');
  const headEn = dictionaryAt(head, 'en');
  const headEs = dictionaryAt(head, 'es');
  const sources = new Map([...sourcesAt(head)].map(([p, t]) => [p, withoutComments(t)]));
  const { addedBy, changedBy } = attribute(base, head, baseEn, baseEs);

  const added = [...new Set([...Object.keys(headEn), ...Object.keys(headEs)])].filter(
    (k) => !(k in baseEn) && !(k in baseEs),
  );
  const changed = Object.keys(baseEn).filter(
    (k) => k in headEn && (headEn[k] !== baseEn[k] || headEs[k] !== baseEs[k]),
  );
  const removed = Object.keys(baseEn).filter((k) => !(k in headEn));
  const addedThenRemoved = [...addedBy.keys()].filter((k) => !(k in headEn));

  const rows = [...added, ...changed].map((key) => {
    const producer = producersOf(key, sources);
    const gaps = [];
    if (typeof headEn[key] !== 'string' || headEn[key] === '') gaps.push('no EN');
    if (typeof headEs[key] !== 'string' || headEs[key] === '') gaps.push('no ES');
    if (producer.how === 'none') gaps.push('no producer');
    else if (key.startsWith('code.') && !producer.files.some((f) => f.startsWith(`${CODES_FILE}#`))) {
      gaps.push('code key not produced in codes.ts');
    }
    return { key, producer, gaps };
  });
  const gapRows = rows.filter((r) => r.gaps.length);

  if (mode === 'summary' || mode === 'check') {
    console.log(`range ${base}..${head}`);
    console.log(`keys at base (EN / ES) ${Object.keys(baseEn).length} / ${Object.keys(baseEs).length}`);
    console.log(`keys at head (EN / ES) ${Object.keys(headEn).length} / ${Object.keys(headEs).length}`);
    console.log(`added, present at head ${added.length}`);
    console.log(`pre-existing keys whose EN or ES value changed ${changed.length}`);
    console.log(`pre-existing keys removed ${removed.length}${removed.length ? ' ' + removed.join(' ') : ''}`);
    console.log(`added in range and removed again ${addedThenRemoved.length}${addedThenRemoved.length ? ' ' + addedThenRemoved.join(' ') : ''}`);
    const perStep = {};
    for (const k of added) {
      const step = (addedBy.get(k) ?? 'unattributed').split(' ')[0];
      perStep[step] = (perStep[step] ?? 0) + 1;
    } // End of the loop counting added keys per step
    console.log(`added per step ${JSON.stringify(perStep)}`);
    for (const k of changed) console.log(`changed ${k} by ${(changedBy.get(k) ?? ['?']).join(', ')}`);
    const count = (how) => rows.filter((r) => r.producer.how === how).length;
    console.log(`producers: rows ${rows.length} literal ${count('literal')} template ${count('template')} none ${count('none')}`);
    const codeRows = rows.filter((r) => r.key.startsWith('code.'));
    console.log(`code.* rows ${codeRows.length}, produced in codes.ts ${codeRows.filter((r) => !r.gaps.includes('code key not produced in codes.ts') && r.producer.how !== 'none').length}`);
    console.log(`identical EN and ES values among added keys ${added.filter((k) => headEn[k] === headEs[k]).length}`);
    console.log(`gaps ${gapRows.length}`);
    for (const r of gapRows) console.log(`GAP ${r.key}: ${r.gaps.join(', ')}`);
    return mode === 'check' && gapRows.length ? 1 : 0;
  }
  if (mode === 'rows') {
    console.log('| # | Key | EN | ES | Step | Producer |');
    console.log('|---|---|---|---|---|---|');
    added.forEach((key, i) => {
      const row = rows.find((r) => r.key === key);
      console.log(`| P${i + 1} | \`${key}\` | ${cell(headEn[key])} | ${cell(headEs[key])} | ${addedBy.get(key) ?? '?'} | ${producerCell(row.producer)} |`);
    });
    return 0;
  }
  // mode === 'changed'
  console.log('| # | Key | EN (before → after) | ES (before → after) | Step | Producer |');
  console.log('|---|---|---|---|---|---|');
  changed.forEach((key, i) => {
    const row = rows.find((r) => r.key === key);
    const en = headEn[key] !== baseEn[key] ? `${cell(baseEn[key])} → ${cell(headEn[key])}` : `(unchanged) ${cell(headEn[key])}`;
    const es = headEs[key] !== baseEs[key] ? `${cell(baseEs[key])} → ${cell(headEs[key])}` : `(unchanged) ${cell(headEs[key])}`;
    console.log(`| C${i + 1} | \`${key}\` | ${en} | ${es} | ${(changedBy.get(key) ?? ['?']).join(', ')} | ${producerCell(row.producer)} |`);
  });
  return 0;
} // End of function main()

process.exitCode = main();
