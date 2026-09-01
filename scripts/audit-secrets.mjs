#!/usr/bin/env node
/* Fails if anything secret-shaped reaches the browser bundle, or if a secret is
   importable from src/. Run after `npm run build`, and in CI.

   The check is deliberately crude and noisy rather than clever: a false alarm
   costs a minute, a leaked live key costs the client their Stripe account. */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const problems = [];

/* 1. Live/secret key shapes that must never appear in shipped code. */
const FORBIDDEN = [
  { re: /\bsk_live_[A-Za-z0-9]{8,}/g, what: 'Stripe LIVE secret key' },
  { re: /\bsk_test_[A-Za-z0-9]{8,}/g, what: 'Stripe test secret key' },
  { re: /\brk_(live|test)_[A-Za-z0-9]{8,}/g, what: 'Stripe restricted key' },
  { re: /\bwhsec_[A-Za-z0-9]{8,}/g, what: 'Stripe webhook secret' },
  { re: /TOAST_CLIENT_SECRET_[A-Z_]+\s*[=:]\s*["'][^"']+["']/g, what: 'Toast client secret' },
  { re: /\bBearer\s+[A-Za-z0-9._-]{40,}/g, what: 'hard-coded bearer token' },
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const TEXT = /\.(js|jsx|mjs|cjs|ts|tsx|css|html|json|map)$/;

/* --- The built bundle -------------------------------------------------- */
const distFiles = walk('dist').filter((f) => TEXT.test(f));
if (distFiles.length === 0) {
  console.log('· dist/ not built — run `npm run build` first to audit the bundle.');
}
for (const f of distFiles) {
  const body = readFileSync(f, 'utf8');
  for (const { re, what } of FORBIDDEN) {
    const hit = body.match(re);
    if (hit) problems.push(`${f}: ${what} — ${hit[0].slice(0, 14)}…`);
  }
  // Any server env name showing up in the bundle means an import crossed over.
  for (const m of body.matchAll(/\b(STRIPE_SECRET_KEY|TOAST_CLIENT_SECRET|STAFF_API_TOKEN|STRIPE_WEBHOOK_SECRET)_[A-Z_]+/g)) {
    problems.push(`${f}: server env name "${m[0]}" is present in the client bundle`);
  }
}

/* --- Source: src/ must never import server code or read process.env ------ */
for (const f of walk('src').filter((f) => TEXT.test(f))) {
  const body = readFileSync(f, 'utf8');
  for (const { re, what } of FORBIDDEN) {
    if (re.test(body)) problems.push(`${f}: ${what} in source`);
  }
  if (/from\s+['"](\.\.\/)*(\.\.\/)?server\//.test(body)) {
    problems.push(`${f}: imports from server/ — server code must never enter the bundle`);
  }
  if (/\bprocess\.env\b/.test(body)) {
    problems.push(`${f}: reads process.env — client code must use import.meta.env`);
  }
  // Only these three VITE_ names are legitimate in the client.
  for (const m of body.matchAll(/import\.meta\.env\.(\w+)/g)) {
    const name = m[1];
    const okName =
      name === 'VITE_API_BASE' || /^VITE_TOAST_GUID_[A-Z_]+$/.test(name) || name === 'MODE' || name === 'DEV' || name === 'PROD';
    if (!okName) problems.push(`${f}: unexpected client env var "${name}"`);
  }
}

/* --- A committed .env is a leak ---------------------------------------- */
if (existsSync('.env')) {
  const ignored = existsSync('.gitignore') && readFileSync('.gitignore', 'utf8').includes('.env');
  if (!ignored) problems.push('.env exists and is not gitignored');
  else console.log('· .env present and gitignored ✓');
}

if (problems.length) {
  console.error('\nSECRET AUDIT FAILED\n');
  problems.forEach((p) => console.error('  ✗ ' + p));
  process.exit(1);
}
console.log('Secret audit passed — no credential material in src/ or dist/.');
