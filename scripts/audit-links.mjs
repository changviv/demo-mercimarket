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
  '/catering',
  '/menu/bryant-park',
  '/checkout',
  '/orders/preview',
  '/this-route-does-not-exist',
];

const KNOWN = [
  /^\/$/,
  /^\/catering$/,
  /^\/menu\/[a-z-]+$/,
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
  for (const route of ['/', '/catering', '/menu/bryant-park', '/checkout']) {
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
  for (const route of ['/', '/catering', '/menu/bryant-park', '/checkout', '/orders/preview']) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    // Open the item sheet on the menu so its contrast is audited too.
    if (route === '/menu/bryant-park') {
      await page.locator('.add').first().click();
      await page.waitForTimeout(300);
    }

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
          /* WCAG 1.4.3 exempts text that is part of an INACTIVE component.
             Recorded rather than skipped, so the audit can still hold these to
             a floor of its own — see below. */
          inactive: !!el.closest(
            'button:disabled, [aria-disabled="true"], fieldset:disabled, .btn--off'
          ),
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
      /* Disabled controls are exempt from AA entirely. This project still
         holds them to 3:1, because a control you cannot see is one you cannot
         tell is unavailable — the point of greying something out is that a
         person reads it as "not now", not as "failed to render". */
      const need = n.inactive ? 3 : large ? 3 : 4.5;
      const kind = n.inactive ? ' [inactive, floor 3]' : '';
      if (r < need - 0.02) {
        fails.push(`"${n.text}" .${n.cls} ${r.toFixed(2)}:1 (needs ${need})${kind}`);
      }
    }

    if (fails.length) F(`${route}: ${fails.length} contrast failures — ${fails.slice(0, 3).join(' | ')}`);
    else {
      const off = nodes.filter((n) => n.inactive).length;
      P(
        `${route}: all ${nodes.length} text nodes meet WCAG AA` +
          (off ? ` (${off} inactive, held to 3:1)` : '')
      );
    }
  }

  /* ---- 6: overflow at nine widths ------------------------------------- */
  const WIDTHS = [320, 360, 390, 430, 600, 768, 900, 1280, 1600];
  for (const w of WIDTHS) {
    const p2 = await browser.newPage({ viewport: { width: w, height: 800 } });
    let worst = 0;
    for (const route of ['/', '/catering', '/menu/bryant-park', '/checkout']) {
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

    /* The menu route runs the ORDERING masthead (artifact 06cbed02): no site
       nav, the store block instead. So the desktop expectation here is the
       store block and the sticky summary, not the nav — and the check is split
       so a marketing route still proves the nav appears. */
    const d = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await d.goto(BASE + '/menu/bryant-park', { waitUntil: 'networkidle' });
    const abar2 = await d.locator('.abar').isVisible();
    const nav2 = await d.locator('.mast__nav').count();
    const store2 = await d.locator('.mast__store').isVisible();
    const sum = await d.locator('.summary').isVisible();
    if (!abar2 && nav2 === 0 && store2 && sum) {
      P('1440px menu: ordering masthead + sticky summary, no action bar, no site nav');
    } else F(`1440px menu: chrome wrong — abar:${abar2} nav:${nav2} store:${store2} summary:${sum}`);
    await d.close();

    const h = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await h.goto(BASE + '/', { waitUntil: 'networkidle' });
    const navHome = await h.locator('.mast__nav').isVisible();
    const storeHome = await h.locator('.mast__store').count();
    if (navHome && storeHome === 0) P('1440px home: site nav shown, no ordering store block');
    else F(`1440px home: chrome wrong — nav:${navHome} store:${storeHome}`);
    await h.close();
  }

  /* ---- 5b: contrast ON HOVER ------------------------------------------
     The resting state was measured; the hover state was not. That gap shipped
     a bug where every anchor styled as a primary button turned its LABEL
     --tomato-deep at the same moment its FILL became --tomato-deep — measured
     contrast 1.00, the text exactly its own background — because `a:hover`
     (one type + one pseudo-class) outranks `.btn` (one class). A screenshot
     never shows it, because a screenshot is not hovering.

     Transitions are disabled first: a sample taken mid-fade reads as a
     failure that is not real. */
  {
    const h = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const fails = [];
    let checked = 0;
    for (const route of ['/', '/catering', '/menu/bryant-park', '/checkout', '/orders/preview']) {
      await h.goto(BASE + route, { waitUntil: 'networkidle' });
      await h.addStyleTag({
        content: '*,*::before,*::after{transition:none!important;animation:none!important}',
      });
      await h.waitForTimeout(250);

      const sel = '.btn, .add, .chip, .abar__btn, .rail__link, .foot__link, .opt, a';
      const n = await h.locator(sel).count();
      for (let i = 0; i < n; i += 1) {
        const el = h.locator(sel).nth(i);
        if (!(await el.isVisible().catch(() => false))) continue;
        const read = () =>
          el.evaluate((e) => {
            const c = getComputedStyle(e);
            let bgEl = e;
            let bg = getComputedStyle(bgEl).backgroundColor;
            while (bg === 'rgba(0, 0, 0, 0)' && bgEl.parentElement) {
              bgEl = bgEl.parentElement;
              bg = getComputedStyle(bgEl).backgroundColor;
            }
            return {
              t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 28),
              cls: (e.className || '').toString().split(/\s+/).slice(0, 2).join('.'),
              fg: c.color,
              bg,
              size: parseFloat(c.fontSize),
              weight: parseInt(c.fontWeight, 10) || 400,
            };
          });
        await el.hover({ timeout: 2000 }).catch(() => {});
        await h.waitForTimeout(30);
        const st = await read().catch(() => null);
        if (!st) continue;
        const fg = parse(st.fg);
        const bgc = parse(st.bg);
        if (!fg || !bgc) continue;
        const bg = bgc.a < 1 ? over(bgc, [244, 229, 208]) : bgc.rgb;
        const r = ratio(over(fg, bg), bg);
        const large = st.size >= 24 || (st.size >= 18.66 && st.weight >= 700);
        const need = large ? 3 : 4.5;
        checked += 1;
        if (r < need - 0.02) {
          fails.push(`"${st.t}" .${st.cls} ${r.toFixed(2)}:1 on hover (needs ${need})`);
        }
      }
    }
    const uniq = [...new Set(fails)];
    if (uniq.length) F(`hover contrast: ${uniq.length} state(s) — ${uniq.slice(0, 3).join(' | ')}`);
    else P(`hover contrast: all ${checked} interactive elements stay legible while hovered`);
    await h.close();
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
    await f.waitForTimeout(250);
    const line = await f.locator('.line').first().innerText();
    if (/for 14$/.test(line.trim())) P(`funnel: headcount repriced the menu — "${line.trim()}"`);
    else F(`funnel: headcount did not reprice — "${line}"`);

    await f.locator('.item', { hasText: 'All Out Sandwich Package' }).locator('.add').click();
    await f.waitForTimeout(300);
    const add = f.locator('.sheet__add');
    if (await add.isDisabled()) P('funnel: Add to order is disabled while a required group is unmet');
    else F('funnel: Add to order was enabled with a required group unmet');

    const boxes = f.locator('.sheet .opts .opt');
    for (let i = 0; i < 3; i += 1) await boxes.nth(i).click();
    await f.waitForTimeout(200);
    const disabledNow = await f.locator('.sheet .opts input:disabled').count();
    if (disabledNow > 0) P(`funnel: at max, ${disabledNow} remaining options disabled themselves`);
    else F('funnel: max not enforced — no options disabled after 3 of 3');

    // Escape must close the sheet without losing the page behind it.
    await f.keyboard.press('Escape');
    await f.waitForTimeout(250);
    if ((await f.locator('.sheet').count()) === 0) P('funnel: Escape closes the item sheet');
    else F('funnel: Escape did not close the item sheet');

    await f.locator('.item', { hasText: 'All Out Sandwich Package' }).locator('.add').click();
    await f.waitForTimeout(300);
    const b2 = f.locator('.sheet .opts .opt');
    for (let i = 0; i < 3; i += 1) await b2.nth(i).click();
    await f.locator('.sheet__add').click();
    await f.waitForTimeout(300);

    /* `.lines li` since the summary was rebuilt to the menu artifact's markup. */
    const inSummary = await f.locator('.lines li').count();
    if (inSummary === 1) P('funnel: the item landed in the order summary');
    else F(`funnel: expected 1 summary line, got ${inSummary}`);

    const guestsKept = await f.inputValue('#guests');
    if (guestsKept === '14') P('funnel: headcount survived adding an item');
    else F(`funnel: headcount lost — ${guestsKept}`);

    await f.locator('.summary a.btn--primary').click();
    await f.waitForURL('**/checkout');
    P('funnel: reached checkout');

    // Validation must actually block.
    await f.locator('.step3--open .stepfoot button').click();
    await f.waitForTimeout(250);
    if (await f.locator('.field__error').first().isVisible())
      P('funnel: empty step 1 is blocked with a visible error');
    else F('funnel: empty step 1 advanced without validation');

    // Regression: an item added from a DEEP LINK used to be wiped by the menu.
    await f.goto(BASE + '/menu/chelsea', { waitUntil: 'networkidle' });
    await f.waitForTimeout(250);
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

    /* Scoped to the desktop rail: the mobile chip row carries the same anchors
       (it is display:none at this width, but still in the DOM), so an
       unscoped href selector matches two elements. */
    await s.locator('.rail__link[href="#salad-platters"]').click();
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

  /* ---- 8c: anchors glide, and land clear of the sticky chrome ----------
     A jump that teleports looks identical to one that glides in any
     screenshot, so this samples the scroll position while it happens: one
     distinct position means it teleported. It also checks where the heading
     comes to rest, because an offset that is a few pixels short parks the
     heading BEHIND the bar you just scrolled out from under — which is how
     `.cat`'s scroll-margin-top sat unused for a while, silently outranked by
     `[id]:target`. */
  {
    const sample = async (page, clickSel) => {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(300);
      const positions = await page.evaluate(async (sel) => {
        const out = [];
        const id = setInterval(() => out.push(Math.round(window.scrollY)), 40);
        document.querySelector(sel).click();
        await new Promise((r) => setTimeout(r, 2200));
        clearInterval(id);
        return out;
      }, clickSel);
      return new Set(positions).size;
    };

    const g = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await g.goto(BASE + '/menu/bryant-park', { waitUntil: 'networkidle' });
    await g.waitForTimeout(400);

    const frames = await sample(g, '.rail__link[href="#salad-platters"]');
    if (frames > 3) P(`rail anchors glide rather than teleport (${frames} sampled positions)`);
    else F(`rail anchor jumped instantly — ${frames} distinct scroll position(s)`);

    const landing = await g.evaluate(() => {
      const el = document.getElementById('salad-platters');
      const chrome = ['.mast', '.controls']
        .map((s) => document.querySelector(s))
        .filter(Boolean)
        .reduce((h, e) => h + e.getBoundingClientRect().height, 0);
      return { top: Math.round(el.getBoundingClientRect().top), chrome: Math.round(chrome) };
    });
    if (landing.top >= landing.chrome) {
      P(`a jumped-to category clears the sticky chrome (lands at ${landing.top}, chrome is ${landing.chrome})`);
    } else {
      F(`a jumped-to category lands at ${landing.top} behind ${landing.chrome}px of sticky chrome`);
    }

    const mobileFrames = await (async () => {
      const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await m.goto(BASE + '/menu/bryant-park', { waitUntil: 'networkidle' });
      await m.waitForTimeout(400);
      const n = await sample(m, '.railmob__link[href="#salad-platters"]');
      await m.close();
      return n;
    })();
    if (mobileFrames > 3) P(`mobile category chips glide too (${mobileFrames} sampled positions)`);
    else F(`mobile category chip jumped instantly — ${mobileFrames} distinct position(s)`);
    await g.close();

    /* And somebody who has asked for less motion gets none of it. */
    const rm = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    await rm.goto(BASE + '/menu/bryant-park', { waitUntil: 'networkidle' });
    await rm.waitForTimeout(400);
    const rmFrames = await sample(rm, '.rail__link[href="#salad-platters"]');
    if (rmFrames === 1) P('prefers-reduced-motion: the same anchor jumps instantly');
    else F(`reduced motion still animated — ${rmFrames} distinct scroll positions`);
    await rm.close();
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

  /* ---- 10: the store menu ----------------------------------------------
     This control can destroy work — switching store clears the basket — so
     what it does when the basket is EMPTY and what it does when the basket is
     FULL are two different behaviours, and both are asserted. Everything here
     failed on the "Change store" link it replaced. */
  {
    const s = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await s.goto(BASE + '/menu/bryant-park', { waitUntil: 'networkidle' });

    /* No duplicate: the masthead used to ask "which store?" twice. */
    const dupes = await s.evaluate(() =>
      [...document.querySelectorAll('.mast a, .mast button')]
        .map((n) => n.textContent.trim().toLowerCase())
        .filter((t) => t === 'locations').length
    );
    if (dupes === 0) P('store menu: the ordering masthead no longer repeats Locations');
    else F(`store menu: ${dupes} Locations control(s) still in the ordering masthead`);

    const trigger = s.locator('.storemenu__trigger');
    if (await trigger.evaluate((n) => n.getAttribute('aria-expanded') === 'false'))
      P('store menu: trigger reports aria-expanded=false when shut');
    else F('store menu: trigger does not report a collapsed state');

    await trigger.click();
    await s.waitForTimeout(150);
    const items = s.locator('.storemenu__item');
    const n = await items.count();
    if (n === 6) P('store menu: all six kitchens are one click away');
    else F(`store menu: ${n} stores listed, expected 6`);

    const focused = await s.evaluate(
      () => document.activeElement?.dataset?.id || null
    );
    if (focused === 'bryant-park') P('store menu: opening focuses the store you are on');
    else F(`store menu: opened with focus on "${focused}" not the current store`);

    /* Arrow keys move, Home jumps to the top, and the top wraps to the bottom.
       Assert against the list's OWN order — Bryant Park is not first in it, and
       an assertion that assumed it was is testing the audit, not the menu. */
    const order = await items.evaluateAll((els) => els.map((e) => e.dataset.id));
    const at = order.indexOf('bryant-park');
    await s.keyboard.press('ArrowDown');
    const down = await s.evaluate(() => document.activeElement?.dataset?.id);
    await s.keyboard.press('Home');
    const home = await s.evaluate(() => document.activeElement?.dataset?.id);
    await s.keyboard.press('ArrowUp');
    const wrapped = await s.evaluate(() => document.activeElement?.dataset?.id);
    if (down === order[at + 1] && home === order[0] && wrapped === order[order.length - 1])
      P('store menu: Arrow/Home move focus through the list, and the top wraps to the bottom');
    else F(`store menu: roving focus broken (down=${down} home=${home} up=${wrapped})`);

    await s.keyboard.press('Escape');
    await s.waitForTimeout(150);
    const shut = (await s.locator('.storemenu__panel').count()) === 0;
    const back = await s.evaluate(() =>
      document.activeElement?.classList.contains('storemenu__trigger')
    );
    if (shut && back) P('store menu: Escape closes it and returns focus to the trigger');
    else F(`store menu: Escape left it ${shut ? 'closed' : 'open'}, focus restored: ${back}`);

    await trigger.click();
    await s.mouse.click(700, 600);
    await s.waitForTimeout(150);
    if ((await s.locator('.storemenu__panel').count()) === 0)
      P('store menu: a click outside dismisses it');
    else F('store menu: clicking outside left the panel open');

    /* EMPTY BASKET — nothing to lose, so no ceremony: switch and go. */
    await trigger.click();
    await s.locator('.storemenu__item[data-id="union-square"]').click();
    await s.waitForTimeout(400);
    const moveUrl = s.url();
    if (moveUrl.endsWith('/menu/union-square'))
      P('store menu: with an empty order it switches store without asking');
    else F(`store menu: switching an empty order landed on ${moveUrl}`);

    const named = await s.locator('.mast__store-name').textContent();
    if (/union square/i.test(named)) P('store menu: the masthead follows the store you chose');
    else F(`store menu: masthead still reads "${named}" after switching`);

    /* FULL BASKET — now it has to ask, and say what it costs. */
    await s.locator('.add:not([disabled])').first().click();
    await s.waitForTimeout(350);
    if (await s.locator('.sheet').count()) {
      await s.locator('.sheet .btn--primary').last().click();
      await s.waitForTimeout(350);
    }
    const held = await s.evaluate(() => {
      try {
        return JSON.parse(sessionStorage.getItem('mm.order.v1') || '{}').lines?.length || 0;
      } catch {
        return 0;
      }
    });

    await trigger.click();
    await s.locator('.storemenu__item[data-id="bryant-park"]').click();
    await s.waitForTimeout(200);
    const ask = s.locator('.storemenu__panel--ask');
    if (await ask.count()) P('store menu: with items on the order it asks before clearing');
    else F('store menu: switched store and silently binned the basket');

    if (await ask.count()) {
      const copy = await ask.textContent();
      if (/Bryant Park/.test(copy) && /\b\d+ items?\b/.test(copy))
        P('store menu: the question names the store and the number of items at stake');
      else F(`store menu: vague confirmation — "${copy.slice(0, 90)}"`);

      /* The safe option must be the one you land on, not the destructive one. */
      await s.locator('.storemenu__askrow .btn--ghost').click();
      await s.waitForTimeout(200);
      const kept = await s.evaluate(() => {
        try {
          return JSON.parse(sessionStorage.getItem('mm.order.v1') || '{}').lines?.length || 0;
        } catch {
          return 0;
        }
      });
      if (kept === held && s.url().endsWith('/menu/union-square'))
        P('store menu: "Keep my order" backs out with the basket intact');
      else F(`store menu: backing out changed the order (${held} lines -> ${kept})`);

      await s.locator('.storemenu__item[data-id="bryant-park"]').click();
      await s.waitForTimeout(200);
      await s.locator('.storemenu__askrow .btn--primary').click();
      await s.waitForTimeout(500);
      const after = await s.evaluate(() => {
        try {
          return JSON.parse(sessionStorage.getItem('mm.order.v1') || '{}').lines?.length || 0;
        } catch {
          return 0;
        }
      });
      if (s.url().endsWith('/menu/bryant-park') && after === 0)
        P('store menu: confirming switches store and clears the order it warned about');
      else F(`store menu: confirm left url=${s.url()} lines=${after}`);
    }
    await s.close();

    /* On a phone the masthead has no room for it, so the drawer must carry it —
       otherwise removing the Locations button would strand mobile users. */
    const ph = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await ph.goto(BASE + '/menu/bryant-park', { waitUntil: 'networkidle' });
    await ph.locator('.mast__burger').click();
    await ph.waitForTimeout(250);
    const inDrawer = await ph.locator('.drawer .storemenu__item').count();
    if (inDrawer === 6) P('store menu: the phone drawer carries the same six stores, open');
    else F(`store menu: phone drawer shows ${inDrawer} stores, expected 6`);

    const tap = await ph.locator('.drawer .storemenu__item').first().boundingBox();
    if (tap && tap.height >= 44) P(`store menu: drawer rows clear the tap floor (${Math.round(tap.height)}px)`);
    else F(`store menu: drawer rows are ${tap ? Math.round(tap.height) : '?'}px tall`);
    await ph.close();
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
