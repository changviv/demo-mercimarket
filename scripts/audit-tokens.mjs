#!/usr/bin/env node
/* Design-system audit.

   Rule: src/styles/tokens.css is the only file allowed to contain a raw colour,
   and no stylesheet may hard-code a font stack or a px radius. Everything else
   must go through var(--*).

   This is the check that keeps "use the design system and nothing else" true
   six months after launch, when someone is in a hurry. */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const problems = [];
const notes = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk('src');
const styles = files.filter((f) => f.endsWith('.css'));

/* Brace balance, per stylesheet.

   A CSS file with one unclosed `{` still parses — the browser just nests
   everything after it inside whatever block was left open. When that block is
   an `@media (min-width: 600px)`, the whole rest of the sheet silently becomes
   desktop-only: the design looks perfect in a 1440px screenshot and a phone
   gets an unstyled document. That is exactly what happened when a rule was
   excised and took its media query's closing brace with it, and no audit
   noticed, because every individual rule was still valid.

   Comments are blanked rather than stripped so the reported line number is the
   real one. */
for (const f of styles) {
  const raw = readFileSync(f, 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  let depth = 0;
  const open = [];
  let extra = 0;
  src.split('\n').forEach((line, i) => {
    for (const ch of line) {
      if (ch === '{') {
        depth += 1;
        open.push(i + 1);
      } else if (ch === '}') {
        depth -= 1;
        open.pop();
        if (depth < 0) {
          extra = i + 1;
          depth = 0;
        }
      }
    }
  });
  if (extra) problems.push(`${f}: stray closing brace at line ${extra}`);
  if (depth > 0) {
    problems.push(
      `${f}: ${depth} unclosed block(s) — opened at line ${open[open.length - 1]}. ` +
        'Everything after it is nested inside that block; on a media query that silently makes the rest of the sheet conditional.'
    );
  }
}
const code = files.filter((f) => /\.(jsx?|tsx?)$/.test(f));

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGBA = /\brgba?\(\s*\d+[\s,]/g;
const HSLA = /\bhsla?\(\s*\d+/g;

/* --- Stylesheets -------------------------------------------------------- */
for (const f of styles) {
  const body = readFileSync(f, 'utf8');
  const isTokens = f.endsWith('tokens.css');

  const lines = body.split('\n');
  lines.forEach((line, i) => {
    const at = `${f}:${i + 1}`;
    const bare = line.split('/*')[0]; // ignore comments

    for (const re of [HEX, RGBA, HSLA]) {
      re.lastIndex = 0;
      const m = bare.match(re);
      if (!m) continue;
      if (isTokens) continue;
      // rgba() inside a shadow/scrim on a token-defined surface is still a
      // literal; flag it so it becomes a token.
      problems.push(`${at}: raw colour ${m[0]} — move it into tokens.css`);
    }

    // Read the declared VALUE rather than lookahead-matching the property, so
    // `font-family: var(--text)` is not flagged by regex backtracking.
    const ff = bare.match(/font-family:\s*([^;]+)/);
    if (!isTokens && ff && !ff[1].trim().startsWith('var(')) {
      problems.push(`${at}: hard-coded font stack "${ff[1].trim()}" — use var(--display) or var(--text)`);
    }

    // A px radius outside tokens means the shape language has drifted.
    const br = bare.match(/border-radius:\s*([^;]+)/);
    if (!isTokens && br && /\d+px/.test(br[1]) && !br[1].includes('var(')) {
      problems.push(`${at}: hard-coded radius "${br[1].trim()}" — use var(--r-sm|--r|--r-lg|--r-pill)`);
    }
  });
}

/* --- Inline styles in components ---------------------------------------- */
for (const f of code) {
  const body = readFileSync(f, 'utf8');
  body.split('\n').forEach((line, i) => {
    const at = `${f}:${i + 1}`;
    if (/style=\{\{/.test(line) && /(color|background|border)\s*:/.test(line)) {
      problems.push(`${at}: inline colour style — use a class`);
    }
    const m = line.match(HEX);
    if (m && !line.includes('//')) {
      problems.push(`${at}: raw colour ${m[0]} in a component`);
    }
  });
}

/* --- Every var() actually exists ---------------------------------------- */
const tokenSrc = readFileSync('src/styles/tokens.css', 'utf8');
const defined = new Set([...tokenSrc.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]));
const used = new Set();
for (const f of styles) {
  for (const m of readFileSync(f, 'utf8').matchAll(/var\(\s*(--[\w-]+)/g)) used.add(m[1]);
}
for (const name of used) {
  /* Locally scoped custom properties are declared where they are used — on the
     component (--btn-*) or per instance from JSX (--art-*). They are parameters,
     not design tokens, so they do not belong in tokens.css. */
  const local = name.startsWith('--btn-') || name.startsWith('--art-');
  if (!defined.has(name) && !local) {
    problems.push(`var(${name}) is used but never defined in tokens.css`);
  }
}
const unused = [...defined].filter((d) => !used.has(d));
if (unused.length) notes.push(`unused tokens: ${unused.join(', ')}`);

console.log(`Scanned ${styles.length} stylesheets and ${code.length} components.`);
console.log(`Tokens defined: ${defined.size} · referenced: ${used.size}`);
notes.forEach((n) => console.log('· ' + n));

if (problems.length) {
  console.error('\nDESIGN SYSTEM AUDIT FAILED\n');
  problems.forEach((p) => console.error('  ✗ ' + p));
  process.exit(1);
}
console.log('Design system audit passed — every colour, font and radius comes from a token.');
