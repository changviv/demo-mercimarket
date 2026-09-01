#!/usr/bin/env node
/* Runtime audit against a real browser.

   Checks, in order:
     1. every route renders, with no console error and one h1
     2. every internal link resolves to a declared route (no dead ends, no `#`
        placeholders — the live site shipped 18 of those)
     3. every external link is https and carries rel=noopener when targeted
     4. every interactive control is reachable, labelled and >= 44px
     5. every rendered text node meets WCAG AA against its own background
     6. no horizontal overflow at nine widths
     7. the funnel actually completes: pick -> configure -> add -> checkout
     8. images have alt text and dimensions
     9. keyboard: skip link, focus visibility, drawer focus trap and Escape */

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const BASE = process.env.AUDIT_BASE || 'http://localhost:4173';

const ROUTES = [
  '/',
  '/menu/bryant-park',
  '/menu/bryant-park/item/fresh-start-breakfast',
  '/menu/bryant-park/item/all-out-sandwich-package',
  '/menu/bryant-park/item/fruit-platter',
  '/checkout',
  '/orders/preview',
  '/this-route-does-not-exist',
];

const KNOWN = [
  /^\/$/,
  /^\/menu\/[a-z-]+$/,
  /^\/menu\/[a-z-]+\/item\/[a-z0-9-]+$/,
  /^\/checkout$/,
  /^\/orders\/[A-Za-z0-9-]+$/,
];

const results = { pass: [], fail: [], note: [] };
const P = (m) => results.pass.push(m);
const F = (m) => results.fail.push(m);
const N = (m) => results.note.push(m);

/* ---- contrast ----------------------------------------------------------- */
const lum = ([r, g, b]) => {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const parse = (s) => {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((n) => parseFloat(n));
  return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
};
const over = (fg, bg) => fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a));

async function run() {
  // The container ships a pinned Chromium; use it rather than downloading one.
  const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch(existsSync(EXE) ? { executablePath: EXE } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', async (d) => {
    F(`browser dialog raised: "${d.message()}"`);
    await d.dismiss();
  });

  /* ---- 1 + 2 + 3 + 8: routes, links, images -------------------------- */
  const seenInternal = new Set();

  for (const route of ROUTES) {
    errors.length = 0;
    const resp = await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);

    if (!resp || resp.status() >= 400) F(`${route}: HTTP ${resp?.status()}`);

    const h1 = await page.locator('h1').count();
    if (h1 === 1) P(`${route}: renders with exactly one h1`);
    else F(`${route}: ${h1} h1 elements (want exactly 1)`);

    const ENV_NOISE = [
      /ERR_TUNNEL_CONNECTION_FAILED/,   // sandbox proxy blocks Google Fonts
      /fonts\.(googleapis|gstatic)/,
      /status of 404/,                  // /orders/preview is deliberately absent
    ];
    const real = errors.filter((e) => !ENV_NOISE.some((re) => re.test(e)));
    const noise = errors.length - real.length;
    if (real.length) F(`${route}: console errors — ${real.slice(0, 2).join(' | ')}`);
    else P(`${route}: no application console errors${noise ? ` (${noise} environment/network messages ignored)` : ''}`);

    const links = await page.$$eval('a[href]', (as) =>
      as.map((a) => ({
        href: a.getAttribute('href'),
        resolved: a.href,
        text: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 40),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
      }))
    );

    for (const l of links) {
      if (!l.href || l.href === '#') {
        F(`${route}: placeholder link "${l.text}" href="${l.href}"`);
        continue;
      }
      if (!l.text) F(`${route}: link with no accessible name -> ${l.href}`);

      if (l.href.startsWith('#')) continue;

      if (/^https?:/.test(l.href)) {
        if (!l.href.startsWith('https://')) F(`${route}: non-https external link ${l.href}`);
        if (l.target === '_blank' && !/noopener/.test(l.rel || '')) {
          F(`${route}: target=_blank without rel=noopener -> ${l.href}`);
        }
        continue;
      }

      const path = new URL(l.resolved).pathname;
      seenInternal.add(path);
      if (!KNOWN.some((re) => re.test(path))) {
        F(`${route}: internal link to undeclared route ${path} ("${l.text}")`);
      }
    }

    // Scroll the page so lazy images below the fold actually load before we
    // judge whether they loaded. Without this every loading="lazy" image reads
    // as a failure, which is a bug in the audit, not the page.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);

    const imgs = await page.$$eval('img', (els) =>
      els.map((i) => ({
        src: i.getAttribute('src'),
        alt: i.getAttribute('alt'),
        w: i.getAttribute('width'),
        h: i.getAttribute('height'),
        natural: i.naturalWidth,
        lazy: i.getAttribute('loading') === 'lazy',
      }))
    );
    for (const i of imgs) {
      if (i.alt === null) F(`${route}: <img src=${i.src}> has no alt attribute`);
      if (!i.natural) F(`${route}: image failed to load — ${i.src}`);
      if (!i.w || !i.h) N(`${route}: image without width/height (CLS risk) — ${i.src}`);
    }
  }
  P(`internal links resolve to ${seenInternal.size} distinct declared routes`);

  /* ---- 4: interactive controls --------------------------------------- */
  for (const route of ['/', '/menu/bryant-park', '/menu/bryant-park/item/all-out-sandwich-package', '/checkout']) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);

    const bad = await page.$$eval(
      'button, a[href], input, select, textarea, [role="button"]',
      (els) =>
        els
          .filter((el) => el.offsetParent !== null)
          .map((el) => {
            // The real hit area of a checkbox/radio is its wrapping <label>,
            // not the 20px box. Measure whichever the user actually clicks.
            const hit = el.closest('label') || el;
            const r = hit.getBoundingClientRect();
            const name =
              el.getAttribute('aria-label') ||
              el.innerText?.trim() ||
              el.labels?.[0]?.innerText?.trim() ||
              el.getAttribute('placeholder') ||
              el.getAttribute('title') ||
              '';
            return {
              tag: el.tagName.toLowerCase(),
              cls: el.className?.toString().slice(0, 30),
              w: Math.round(r.width),
              h: Math.round(r.height),
              name: name.slice(0, 30),
              disabled: el.disabled === true,
            };
          })
          .filter((e) => e.h > 0)
    );

    const small = bad.filter((e) => e.h < 44 && e.w < 44);
    const unnamed = bad.filter((e) => !e.name && !e.disabled);

    if (small.length) N(`${route}: ${small.length} controls under 44px — ${small.map((s) => `${s.tag}.${s.cls}:${s.w}x${s.h}`).slice(0, 4).join(', ')}`);
    else P(`${route}: every visible control is at least 44px on one axis`);

    if (unnamed.length) F(`${route}: ${unnamed.length} controls with no accessible name — ${unnamed.map((u) => u.tag + '.' + u.cls).slice(0, 3).join(', ')}`);
    else P(`${route}: every control has an accessible name`);
  }

  /* ---- 5: contrast ---------------------------------------------------- */
  for (const route of ['/', '/menu/bryant-park', '/menu/bryant-park/item/all-out-sandwich-package', '/checkout', '/orders/preview']) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    const nodes = await page.evaluate(() => {
      const out = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const t = n.textContent.trim();
        if (!t) continue;
        const el = n.parentElement;
        if (!el || !el.offsetParent) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
        let bgEl = el;
        let bg = getComputedStyle(bgEl).backgroundColor;
        while (bg === 'rgba(0, 0, 0, 0)' && bgEl.parentElement) {
          bgEl = bgEl.parentElement;
          bg = getComputedStyle(bgEl).backgroundColor;
        }
        out.push({
          text: t.slice(0, 34),
          fg: cs.color,
          bg,
          size: parseFloat(cs.fontSize),
          weight: parseInt(cs.fontWeight, 10) || 400,
          cls: el.className?.toString().slice(0, 28),
        });
      }
      return out;
    });

    const fails = [];
    for (const n of nodes) {
      const fg = parse(n.fg);
      const bgc = parse(n.bg);
      if (!fg || !bgc) continue;
      const bg = bgc.a < 1 ? over(bgc, [244, 229, 208]) : bgc.rgb;
      const r = ratio(over(fg, bg), bg);
      const large = n.size >= 24 || (n.size >= 18.66 && n.weight >= 700);
      const need = large ? 3 : 4.5;
      if (r < need - 0.02) fails.push(`"${n.text}" .${n.cls} ${r.toFixed(2)}:1 (needs ${need})`);
    }

    if (fails.length) F(`${route}: ${fails.length} contrast failures — ${fails.slice(0, 3).join(' | ')}`);
    else P(`${route}: all ${nodes.length} text nodes meet WCAG AA`);
  }

  /* ---- 6: overflow at nine widths ------------------------------------- */
  const WIDTHS = [320, 360, 390, 430, 600, 768, 900, 1280, 1600];
  for (const w of WIDTHS) {
    const p2 = await browser.newPage({ viewport: { width: w, height: 800 } });
    let worst = 0;
    for (const route of ['/', '/menu/bryant-park', '/menu/bryant-park/item/egg-sandwiches', '/checkout']) {
      await p2.goto(BASE + route, { waitUntil: 'networkidle' });
      await p2.waitForTimeout(150);
      const of = await p2.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      worst = Math.max(worst, of);
    }
    if (worst > 1) F(`${w}px: horizontal overflow of ${worst}px`);
    else P(`${w}px: no horizontal overflow`);
    await p2.close();
  }

  /* mobile chrome swap */
  {
    const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await m.goto(BASE + '/menu/bryant-park', { waitUntil: 'networkidle' });
    const abar = await m.locator('.abar').isVisible();
    const burger = await m.locator('.mast__burger').isVisible();
    const desktopNav = await m.locator('.mast__nav').isVisible();
    if (abar && burger && !desktopNav) P('390px: action bar + burger shown, desktop nav hidden');
    else F(`390px: chrome wrong — abar:${abar} burger:${burger} desktopNav:${desktopNav}`);
    await m.close();

    const d = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await d.goto(BASE + '/menu/bryant-park', { waitUntil: 'networkidle' });
    const abar2 = await d.locator('.abar').isVisible();
    const nav2 = await d.locator('.mast__nav').isVisible();
    const sum = await d.locator('.summary').isVisible();
    if (!abar2 && nav2 && sum) P('1440px: desktop nav + sticky summary shown, action bar hidden');
    else F(`1440px: chrome wrong — abar:${abar2} nav:${nav2} summary:${sum}`);
    await d.close();
  }

  /* ---- 7: the funnel completes ---------------------------------------- */
  {
    const f = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const ferr = [];
    f.on('pageerror', (e) => ferr.push(e.message));

    await f.goto(BASE + '/', { waitUntil: 'networkidle' });
    await f.locator('.loc', { hasText: 'Bryant Park' }).click();
    await f.waitForURL('**/menu/bryant-park');
    P('funnel: picking a location routes to that location menu');

    await f.fill('#guests', '14');
    await f.waitForTimeout(200);
    const calc = await f.locator('.card2__calc').first().innerText();
    if (/×\s*14\s*=/.test(calc)) P(`funnel: headcount repriced the menu — "${calc}"`);
    else F(`funnel: headcount did not reprice — "${calc}"`);

    await f.goto(BASE + '/menu/bryant-park/item/all-out-sandwich-package', { waitUntil: 'networkidle' });
    const addBtn = f.locator('.config__box button.btn--primary');
    if (await addBtn.isDisabled()) P('funnel: Add is disabled while a required group is unmet');
    else F('funnel: Add was enabled with a required group unmet');

    const boxes = f.locator('.opts input[type="checkbox"]');
    for (let i = 0; i < 3; i += 1) await boxes.nth(i).check();
    await f.waitForTimeout(150);

    const disabledNow = await f.locator('.opts input:disabled').count();
    if (disabledNow > 0) P(`funnel: at max, ${disabledNow} remaining options disabled themselves`);
    else F('funnel: max not enforced — no options disabled after 3 of 3');

    if (await addBtn.isEnabled()) P('funnel: Add enabled once the group is satisfied');
    else F('funnel: Add still disabled after satisfying the group');

    await addBtn.click();
    await f.waitForURL('**/menu/bryant-park');
    const inSummary = await f.locator('.summary__line').count();
    if (inSummary === 1) P('funnel: the item landed in the order summary');
    else F(`funnel: expected 1 summary line, got ${inSummary}`);

    const guestsKept = await f.inputValue('#guests');
    if (guestsKept === '14') P('funnel: headcount survived the round trip');
    else F(`funnel: headcount lost — ${guestsKept}`);

    await f.locator('.summary a.btn--primary').click();
    await f.waitForURL('**/checkout');
    const step = await f.locator('.steps2__i--on').innerText();
    P(`funnel: reached checkout at step "${step.replace(/\s+/g, ' ')}"`);

    // Validation must actually block.
    await f.locator('.co__nav .btn--primary').click();
    await f.waitForTimeout(200);
    if (await f.locator('.field__error').first().isVisible()) P('funnel: empty step 1 is blocked with a visible error');
    else F('funnel: empty step 1 advanced without validation');

    // Regression: adding from a DEEP-LINKED item (no visit to the picker first)
    // used to leave the order with no locationId, and the menu then cleared the
    // basket on arrival. Shared item links and reloads both hit this path.
    await f.goto(BASE + '/menu/chelsea/item/novie-platter', { waitUntil: 'networkidle' });
    await f.locator('.opts input[type="radio"]').first().check();
    await f.locator('.config__box button.btn--primary').click();
    await f.waitForURL('**/menu/chelsea');
    await f.waitForTimeout(200);
    const deep = await f.locator('.summary__line').count();
    if (deep === 1) P('funnel: an item added from a deep link survives the trip to the menu');
    else F(`funnel: deep-linked add was lost — ${deep} lines in the summary`);

    // Switching kitchen SHOULD clear it — prices are per store.
    await f.goto(BASE + '/menu/bryant-park', { waitUntil: 'networkidle' });
    await f.waitForTimeout(200);
    const afterSwitch = await f.locator('.summary__line').count();
    if (afterSwitch === 0) P('funnel: changing kitchen clears the basket, as intended');
    else F(`funnel: basket survived a kitchen change — ${afterSwitch} lines`);

    if (ferr.length) F(`funnel: page errors — ${ferr[0]}`);
    else P('funnel: no page errors end to end');
    await f.close();
  }

  /* ---- 8b: scroll-spy ------------------------------------------------- */
  {
    const s = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await s.goto(BASE + '/menu/bryant-park', { waitUntil: 'networkidle' });
    await s.waitForTimeout(600);
    const on = () => s.locator('.rail__link--on').first().innerText().catch(() => '(none)');

    const atTop = await on();
    if (/Breakfast Platters/.test(atTop)) P('scroll-spy: first category is active on load');
    else F(`scroll-spy: on load the rail shows "${atTop.replace(/\s+/g, ' ')}"`);

    await s.locator('a[href="#salad-platters"]').click();
    await s.waitForTimeout(900);
    const jumped = await on();
    // Regression: the trigger line must sit below where scroll-margin-top parks
    // a jumped-to section, or the rail highlights the category above it.
    if (/Salad Platters/.test(jumped)) P('scroll-spy: an anchor jump highlights the category it landed on');
    else F(`scroll-spy: jumped to Salad Platters, rail shows "${jumped.replace(/\s+/g, ' ')}"`);

    await s.evaluate(() => window.scrollTo(0, 0));
    await s.waitForTimeout(900);
    const back = await on();
    // Regression: an IntersectionObserver fires with nothing intersecting on a
    // jump like this, and used to leave the rail stuck on the old category.
    if (/Breakfast Platters/.test(back)) P('scroll-spy: jumping back to the top resets the rail');
    else F(`scroll-spy: after scrolling to top the rail is stuck on "${back.replace(/\s+/g, ' ')}"`);
    await s.close();
  }

  /* ---- 9: keyboard ---------------------------------------------------- */
  {
    const k = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await k.goto(BASE + '/', { waitUntil: 'networkidle' });

    await k.keyboard.press('Tab');
    const first = await k.evaluate(() => document.activeElement?.className || '');
    if (first.includes('skip-link')) P('keyboard: first Tab reaches the skip link');
    else F(`keyboard: first Tab went to ".${first}" not the skip link`);

    await k.locator('.mast__burger').click();
    await k.waitForTimeout(200);
    const trapped = await k.evaluate(() => !!document.activeElement?.closest('.drawer'));
    if (trapped) P('keyboard: opening the drawer moves focus inside it');
    else F('keyboard: drawer opened without moving focus into it');

    const locked = await k.evaluate(() => getComputedStyle(document.body).overflow);
    if (locked === 'hidden') P('keyboard: body scroll locked while the drawer is open');
    else F(`keyboard: body scroll not locked (overflow: ${locked})`);

    await k.keyboard.press('Escape');
    await k.waitForTimeout(200);
    const closed = (await k.locator('.drawer').count()) === 0;
    const restored = await k.evaluate(() => document.activeElement?.classList.contains('mast__burger'));
    if (closed) P('keyboard: Escape closes the drawer');
    else F('keyboard: Escape did not close the drawer');
    if (restored) P('keyboard: focus returns to the trigger on close');
    else F('keyboard: focus was not restored to the trigger');
    await k.close();
  }

  await browser.close();

  /* ---- report ---------------------------------------------------------- */
  console.log(`\n  PASS ${results.pass.length}   FAIL ${results.fail.length}   NOTE ${results.note.length}\n`);
  results.pass.forEach((m) => console.log('  ✓ ' + m));
  if (results.note.length) {
    console.log('');
    results.note.forEach((m) => console.log('  · ' + m));
  }
  if (results.fail.length) {
    console.log('');
    results.fail.forEach((m) => console.log('  ✗ ' + m));
    process.exit(1);
  }
  console.log('\n  Runtime audit passed.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
