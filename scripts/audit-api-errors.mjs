#!/usr/bin/env node
/* What the customer is told when a request fails.

   This exists because checkout showed "Request failed (500)". That sentence was
   wrong in the way that matters: the API server simply was not running, and the
   page reported it as if the order had been refused. Three failures arrived as
   one message, so nobody reading the screen — customer or engineer — could tell
   which had happened.

   The client is exercised directly with a stubbed fetch, so every branch is
   checked in under a second and none of it depends on a server being up. What
   is asserted is the CONTRACT, not the prose: which cause produces which code,
   that the copy says money is safe where it is safe, and above all that no
   failure ever reaches a person as a bare status code. */

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const results = { pass: [], fail: [] };
const P = (m) => results.pass.push(m);
const F = (m) => results.fail.push(m);

/* api.js reads import.meta.env, which only exists under Vite. Rewrite those two
   references and import the real file — copying the module would test a copy. */
const src = readFileSync('src/lib/api.js', 'utf8')
  .replace(/import\.meta\.env\.VITE_API_BASE/g, 'globalThis.__BASE')
  .replace(/import\.meta\.env\.DEV/g, 'globalThis.__DEV');
const dir = mkdtempSync(join(tmpdir(), 'api-audit-'));
const shim = join(dir, 'api.mjs');
writeFileSync(shim, src);
globalThis.__BASE = '/api';
globalThis.__DEV = false;

const api = await import('file://' + shim);

/* The stub answers both text() and json(), so this harness is fair to any
   implementation of the client — including the one it replaced. A probe that
   only offers the method the new code happens to call would manufacture
   failures in the old code and prove nothing. */
const res = (status, body, ok) => ({
  ok: ok ?? (status >= 200 && status < 300),
  status,
  text: async () => body,
  json: async () => JSON.parse(body),
});

const attempt = async (stub, call = () => api.createOrder({})) => {
  globalThis.fetch = stub;
  try {
    const value = await call();
    return { value };
  } catch (e) {
    return { err: e };
  }
};

const BARE = /^Request failed|^\s*$|^[A-Za-z]*Error:|^\d{3}$|fetch failed|ECONNREFUSED|NetworkError/i;
const human = (m) =>
  typeof m === 'string' && m.length > 30 && /[.!]$/.test(m.trim()) && !BARE.test(m);

/* 1 — the actual bug: Vite's dev proxy answers 500 with an HTML body because
   nothing is listening on 8787. Not a refusal; a setup problem. */
{
  const { err } = await attempt(async () =>
    res(500, '<!doctype html><title>Error</title>connect ECONNREFUSED 127.0.0.1:8787')
  );
  if (err?.code === 'api_unreachable') P('a 5xx with no JSON body is reported as unreachable, not as a refusal');
  else F(`5xx HTML body gave code "${err?.code}" (want api_unreachable): ${err?.message}`);

  if (human(err?.message)) P(`unreachable: the customer gets a sentence — "${err.message.slice(0, 58)}…"`);
  else F(`unreachable: message is not fit to read — "${err?.message}"`);

  if (/nothing has been charged/i.test(err?.message || ''))
    P('unreachable: the copy says no money moved, which is true — no intent was created');
  else F('unreachable: does not tell the customer their card is untouched');

  if (!/500|status|request failed/i.test(err?.message || ''))
    P('unreachable: no status code leaks into the customer-facing sentence');
  else F(`unreachable: raw status leaked — "${err?.message}"`);
}

/* 2 — the API is up and really did refuse. Its own words must survive: the
   server knows why, the client does not. */
{
  const { err } = await attempt(async () =>
    res(409, JSON.stringify({ error: { code: 'lead_time', message: 'Bryant Park needs 48 hours for this order.' } }))
  );
  if (err?.message === 'Bryant Park needs 48 hours for this order.')
    P("a JSON error body is passed through verbatim — the server's reason is not overwritten");
  else F(`JSON error body was replaced with "${err?.message}"`);
  if (err?.code === 'lead_time' && err?.status === 409)
    P('a refusal keeps its code and status for the caller to branch on');
  else F(`refusal lost its code/status (code=${err?.code} status=${err?.status})`);
}

/* 3 — the request never left the browser. */
{
  const { err } = await attempt(async () => {
    throw new TypeError('Failed to fetch');
  });
  if (err?.code === 'offline') P('a fetch that never left the browser is reported as a connection problem');
  else F(`fetch rejection gave code "${err?.code}" (want offline)`);
  if (human(err?.message) && /connection/i.test(err.message))
    P('offline: the customer is told to check their connection, not shown "Failed to fetch"');
  else F(`offline: message is not fit to read — "${err?.message}"`);
  if (err?.cause instanceof Error) P('offline: the original error is kept as err.cause for the console');
  else F('offline: the underlying error was discarded');
}

/* 4 — a 200 carrying HTML. This is what a static host does to /api: it serves
   index.html. Answering "success, here is null" would let checkout advance
   past a step that never happened. */
{
  const { err, value } = await attempt(async () => res(200, '<!doctype html><title>Merci Market</title>'));
  if (err) P('a 200 whose body is not JSON is treated as a failure, not as an empty success');
  else F(`a 200 with an HTML body was accepted, returning ${JSON.stringify(value)}`);
}

/* 5 — and an ordinary success still works. */
{
  const { value, err } = await attempt(async () =>
    res(200, JSON.stringify({ orderId: 'MM-ABC123', clientSecret: null }))
  );
  if (!err && value?.orderId === 'MM-ABC123') P('a normal 200 with a JSON body is returned untouched');
  else F(`a valid response broke: err=${err?.message} value=${JSON.stringify(value)}`);

  const { value: empty } = await attempt(async () => res(204, ''));
  if (empty === null) P('an empty 204 returns null rather than throwing');
  else F(`204 returned ${JSON.stringify(empty)}`);
}

console.log(`\n  PASS ${results.pass.length}   FAIL ${results.fail.length}\n`);
results.pass.forEach((m) => console.log('  ✓ ' + m));
if (results.fail.length) {
  console.log('');
  results.fail.forEach((m) => console.log('  ✗ ' + m));
  process.exit(1);
}
console.log('\n  API error-copy audit passed — no failure reaches a person as a status code.');
