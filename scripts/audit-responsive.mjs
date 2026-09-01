#!/usr/bin/env node
/* Responsive audit.

   Exists because a section was rebuilt to the artifact at 1440px only, and the
   catering page's copy of the store picker silently broke: it still referenced
   class names the restyle had removed, so the status pill stretched into a
   full-width band and "Today" ran into the hours. Nothing caught it, because
   nothing looked at that page at any width.

   So: every route, at eight widths, checking the things that actually go wrong
   when layout is only ever verified at one size.

   Per width and route:
     - no horizontal overflow
     - no element wider than its own container
     - no overlapping siblings (the pill-over-heading class of bug)
     - the store picker's card anatomy is intact wherever it appears
     - text never renders below 12px
     - every interactive target stays >= 44px on one axis */

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const BASE = process.env.AUDIT_BASE || 'http://localhost:4173';

const WIDTHS = [
  [320, 720, 'small phone'],
  [390, 844, 'iPhone'],
  [430, 932, 'large phone'],
  [768, 1024, 'tablet portrait'],
  [1024, 768, 'tablet landscape'],
  [1280, 800, 'laptop'],
  [1440, 900, 'desktop'],
  [1920, 1080, 'wide desktop'],
];

const ROUTES = ['/', '/catering', '/menu/bryant-park', '/checkout', '/orders/preview'];

const results = { pass: [], fail: [] };
const P = (m) => results.pass.push(m);
const F = (m) => results.fail.push(m);

async function run() {
  const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch(existsSync(EXE) ? { executablePath: EXE } : {});

  for (const [w, h, label] of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const problems = [];

    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);

      const found = await page.evaluate(() => {
        const out = [];
        const dw = document.documentElement.clientWidth;

        /* Is this element inside something that scrolls sideways on purpose? */
        const inScroller = (el) => {
          let a = el.parentElement;
          while (a && a !== document.body) {
            const ov = getComputedStyle(a).overflowX;
            if ((ov === 'auto' || ov === 'scroll' || ov === 'hidden') && a.scrollWidth > a.clientWidth + 1) return true;
            a = a.parentElement;
          }
          return false;
        };

        const doc = document.documentElement.scrollWidth - dw;
        if (doc > 1) out.push(`page scrolls sideways by ${doc}px`);

        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (inScroller(el)) continue;

          // wider than the viewport
          if (r.right > dw + 1 || r.left < -1) {
            const cls = (el.className || '').toString().split(/\s+/)[0] || el.tagName.toLowerCase();
            out.push(`${cls} sticks out (${Math.round(r.left)}→${Math.round(r.right)} of ${dw})`);
            continue;
          }

          // wider than its own parent
          const p = el.parentElement;
          if (p && p !== document.body) {
            const pr = p.getBoundingClientRect();
            if (pr.width > 0 && r.width > pr.width + 1 && getComputedStyle(p).overflow === 'visible') {
              const cls = (el.className || '').toString().split(/\s+/)[0] || el.tagName.toLowerCase();
              out.push(`${cls} is wider than its parent (${Math.round(r.width)} > ${Math.round(pr.width)})`);
            }
          }

          // text below 12px is unreadable regardless of layout
          if (el.children.length === 0 && el.textContent.trim()) {
            const fs = parseFloat(getComputedStyle(el).fontSize);
            if (fs && fs < 12) out.push(`text at ${fs}px: "${el.textContent.trim().slice(0, 24)}"`);
          }
        }

        /* Overlap: a badge sitting on top of a heading is the failure mode that
           a width-only overflow check never sees. */
        const overlap = (a, b) => {
          const x = a.getBoundingClientRect();
          const y = b.getBoundingClientRect();
          return !(x.right <= y.left + 1 || x.left >= y.right - 1 || x.bottom <= y.top + 1 || x.top >= y.bottom - 1);
        };
        for (const card of document.querySelectorAll('.loc, .item, .fact, .occ, .step')) {
          const kids = [...card.querySelectorAll(':scope > * , :scope > * > *')].filter(
            (e) => e.children.length === 0 && e.textContent.trim() && e.getBoundingClientRect().height > 0
          );
          for (let i = 0; i < kids.length; i += 1) {
            for (let j = i + 1; j < kids.length; j += 1) {
              if (kids[i].contains(kids[j]) || kids[j].contains(kids[i])) continue;
              if (overlap(kids[i], kids[j])) {
                out.push(`overlap: "${kids[i].textContent.trim().slice(0, 16)}" over "${kids[j].textContent.trim().slice(0, 16)}"`);
              }
            }
          }
        }

        // targets that are too small to hit
        for (const el of document.querySelectorAll('button, a[href], input, select')) {
          if (!el.offsetParent) continue;
          const hit = el.closest('label') || el;
          const r = hit.getBoundingClientRect();
          if (r.height > 0 && r.height < 44 && r.width < 44) {
            const cls = (el.className || '').toString().split(/\s+/)[0] || el.tagName.toLowerCase();
            out.push(`target ${cls} is ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        }

        return [...new Set(out)];
      });

      found.forEach((f) => problems.push(`${route} — ${f}`));

      /* The store picker must have identical anatomy wherever it renders.
         It renders on the home page only: per artifact b099617a the catering
         page closes with a CTA card, so that one page does not carry two
         competing primary actions. */
      if (route === '/') {
        const anatomy = await page.evaluate(() => {
          const card = document.querySelector('.loc');
          if (!card) return { error: 'no .loc' };
          const pill = card.querySelector('.pill');
          const cardW = card.getBoundingClientRect().width;
          return {
            hasTop: !!card.querySelector('.loc__top'),
            hasFoot: !!card.querySelector('.loc__foot'),
            hasClock: !!card.querySelector('.loc__hours svg'),
            hasArrow: !!card.querySelector('.loc__cta svg'),
            pillFullWidth: pill ? pill.getBoundingClientRect().width > cardW - 8 : null,
            hoursText: (card.querySelector('.loc__hours') || {}).textContent || '',
            deadClasses: ['loc__body', 'loc__go', 'loc__today', 'picker__note'].filter((c) =>
              document.querySelector('.' + c)
            ),
          };
        });

        if (anatomy.error) problems.push(`${route} — picker: ${anatomy.error}`);
        else {
          if (!anatomy.hasTop || !anatomy.hasFoot) problems.push(`${route} — picker card missing top/foot split`);
          if (!anatomy.hasClock) problems.push(`${route} — picker card missing the clock icon`);
          if (!anatomy.hasArrow) problems.push(`${route} — picker card missing the CTA arrow`);
          if (anatomy.pillFullWidth) problems.push(`${route} — status pill stretched to full card width`);
          if (!/Today\s\s/.test(anatomy.hoursText)) {
            problems.push(`${route} — hours run together: "${anatomy.hoursText.trim()}"`);
          }
          if (anatomy.deadClasses.length) {
            problems.push(`${route} — markup still uses removed classes: ${anatomy.deadClasses.join(', ')}`);
          }
        }
      }

      /* The home page hands off to catering directly after the locations. */
      if (route === '/') {
        const cta = await page.evaluate(() => {
          const c = document.getElementById('catering-cta');
          if (!c) return { missing: true };
          const y = (e) => e.getBoundingClientRect().top + window.scrollY;
          return {
            afterPicker: y(document.getElementById('pick')) < y(c),
            beforeFacts: y(c) < y(document.querySelector('.facts')),
            links: [...c.querySelectorAll('a')].map((a) => a.getAttribute('href')),
          };
        });
        if (cta.missing) problems.push(`${route} — catering CTA section missing`);
        else {
          if (!cta.afterPicker) problems.push(`${route} — catering CTA is not after the locations`);
          if (!cta.beforeFacts) problems.push(`${route} — catering CTA is not before the facts strip`);
          if (!cta.links.includes('/catering')) problems.push(`${route} — catering CTA does not link to /catering`);
        }
      }

      /* The catering page closes with the CTA card, and must NOT duplicate the
         picker grid. */
      if (route === '/catering') {
        const close = await page.evaluate(() => ({
          hasCta: !!document.querySelector('.closecta'),
          strayPicker: document.querySelectorAll('.loc').length,
          ctaButtons: document.querySelectorAll('.closecta a').length,
        }));
        if (!close.hasCta) problems.push(`${route} — closing CTA card missing`);
        if (close.strayPicker) problems.push(`${route} — duplicates the store picker (${close.strayPicker} cards)`);
        if (close.ctaButtons !== 2) problems.push(`${route} — closing CTA has ${close.ctaButtons} buttons, expected 2`);
      }
    }

    if (problems.length) {
      F(`${w}px (${label}): ${problems.length} problem(s)`);
      problems.slice(0, 6).forEach((x) => F(`    ${x}`));
    } else {
      P(`${w}px (${label}): ${ROUTES.length} routes clean`);
    }

    await page.close();
  }

  await browser.close();

  const fails = results.fail.filter((f) => !f.startsWith('    ')).length;
  console.log(`\n  WIDTHS ${WIDTHS.length}   CLEAN ${results.pass.length}   WITH PROBLEMS ${fails}\n`);
  results.pass.forEach((m) => console.log('  ✓ ' + m));
  if (results.fail.length) {
    console.log('');
    results.fail.forEach((m) => console.log(m.startsWith('    ') ? '  ' + m : '  ✗ ' + m));
    process.exit(1);
  }
  console.log('\n  Responsive audit passed.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
