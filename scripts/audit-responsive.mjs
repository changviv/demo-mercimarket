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
    /* The container must be the same width on every route at a given viewport.
       It was not: the menu ran on a 1360 measure while the marketing pages ran
       on 1240, so the masthead — logo, nav, buttons — visibly jumped 120px
       wider when you walked from the home page into the menu. Nothing else
       catches this, because each page is internally consistent. */
    const shells = {};

    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);

      shells[route] = await page.evaluate(() => {
        const m = document.querySelector('.mast__inner');
        const s = document.querySelector('main .shell') || document.querySelector('.shell');
        return {
          mast: m ? Math.round(m.getBoundingClientRect().width) : null,
          shell: s ? Math.round(s.getBoundingClientRect().width) : null,
        };
      });

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

          /* Text below 12px is unreadable regardless of layout — with one
             carve-out, kept deliberately narrow.

             The artifacts set their uppercase micro-labels at 11px: the badge
             pills, the "CATEGORIES" and "YOUR ORDER" captions. Those are two or
             three all-caps words at high contrast, where the cap height is what
             the eye measures and 11px reads like 13px of lowercase. A blanket
             floor forced them to 12px and put the build out of step with the
             design for no legible gain.

             So the exemption is by CLASS, not by size: only these components
             may go below the floor, and only while they stay uppercase. Any
             other element under 12px, and any of these that loses its
             text-transform, still fails. */
          if (el.children.length === 0 && el.textContent.trim()) {
            const cs = getComputedStyle(el);
            const fs = parseFloat(cs.fontSize);
            const micro = el.closest('.badge, .rail__head, .summary__h, .railmob__count');
            const exempt =
              micro && getComputedStyle(micro).textTransform === 'uppercase' && fs >= 11;
            if (fs && fs < 12 && !exempt) {
              out.push(`text at ${fs}px: "${el.textContent.trim().slice(0, 24)}"`);
            }
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

      /* The home page descends by intent: hero, locations, facts, catering,
         story. Assert the ORDER, not just the presence — a section that drifts
         up or down the page changes what the page is for. */
      if (route === '/') {
        const flow = await page.evaluate(() => {
          const y = (sel) => {
            const e = document.querySelector(sel);
            return e ? e.getBoundingClientRect().top + window.scrollY : null;
          };
          const cta = document.getElementById('catering-cta');
          return {
            hero: y('.hero'),
            pick: y('#pick'),
            facts: y('.facts'),
            cta: y('#catering-cta'),
            story: y('#story'),
            ctaLinks: cta ? [...cta.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [],
            storyHeading: (document.querySelector('#story h2') || {}).textContent || '',
          };
        });

        for (const [name, v] of Object.entries(flow)) {
          if (v === null) problems.push(`${route} — section missing: ${name}`);
        }
        const seq = [
          ['hero', 'pick'],
          ['pick', 'facts'],
          ['facts', 'cta'],
          ['cta', 'story'],
        ];
        for (const [a, c] of seq) {
          if (flow[a] !== null && flow[c] !== null && !(flow[a] < flow[c])) {
            problems.push(`${route} — ${c} is not below ${a}`);
          }
        }
        if (!flow.ctaLinks.includes('/catering')) {
          problems.push(`${route} — catering CTA does not link to /catering`);
        }
        if (!/Our Story Began in 1979/.test(flow.storyHeading)) {
          problems.push(`${route} — story section heading is "${flow.storyHeading}"`);
        }
      }

      /* The browse screen, at every width.

         Its three columns collapse in two stages — the summary goes first at
         1240, the rail at 960 — and each stage has to hand its job to
         something else rather than just disappear. The summary's job goes to
         the fixed action bar; the rail's goes to a scrolling chip row. A
         collapse that drops the job instead of moving it is how a phone user
         ends up scrolling 10,000px with no way to jump and no running total. */
      if (route === '/menu/bryant-park') {
        const menu = await page.evaluate(() => {
          const vis = (sel) => {
            const e = document.querySelector(sel);
            if (!e) return false;
            const s = getComputedStyle(e);
            return s.display !== 'none' && s.visibility !== 'hidden';
          };
          const chips = [...document.querySelectorAll('.railmob__link')];
          return {
            w: document.documentElement.clientWidth,
            rail: vis('.rail'),
            railmob: vis('.railmob'),
            summary: vis('.summary'),
            abar: vis('.abar'),
            controls: vis('.controls'),
            storebar: !!document.querySelector('.storebar'),
            // Every mobile category chip must carry its label AND its count.
            chipsLabelled: chips.length === 0 || chips.every((c) => /\S/.test(c.textContent.replace(/\d+/g, ''))),
            chipsCounted: chips.length === 0 || chips.every((c) => c.querySelector('.railmob__count')),
            chipCount: chips.length,
            // The control bar must never eat more than a fifth of a short viewport.
            controlsH: Math.round((document.querySelector('.controls') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height),
            // Cards must never be narrower than a readable measure.
            cardW: Math.round((document.querySelector('.item') || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width),
            // The Add control must stay a real target.
            addBox: (() => {
              const a = document.querySelector('.add');
              if (!a) return null;
              const r = a.getBoundingClientRect();
              return [Math.round(r.width), Math.round(r.height)];
            })(),
            /* Sticky BARS must not stack into a wall above the content.
               Only full-width bars count: a sticky sidebar is 300px wide and
               1000px tall by design, and summing those said "907px of chrome"
               on a perfectly good desktop layout. Width is what separates a
               bar from a column. */
            stickyTop: [...document.querySelectorAll('body *')]
              .filter((e) => {
                if (getComputedStyle(e).position !== 'sticky') return false;
                const r = e.getBoundingClientRect();
                return r.top < 200 && r.width > document.documentElement.clientWidth * 0.8;
              })
              .reduce((sum, e) => sum + Math.round(e.getBoundingClientRect().height), 0),
          };
        });

        /* The running line is a <p> used as a layout row, so the global prose
           measure caps it. Invisible on a phone, where 68ch is wider than the
           screen; at 1024 it stopped the row at half the bar and left the
           total floating in the middle. Assert it spans the bar. */
        const abarRow = await page.evaluate(() => {
          const bar = document.querySelector('.abar');
          const row = document.querySelector('.abar__running');
          if (!bar || !row || getComputedStyle(bar).display === 'none') return null;
          const b = bar.getBoundingClientRect();
          const r = row.getBoundingClientRect();
          const pad = parseFloat(getComputedStyle(bar).paddingLeft) || 0;
          return { short: r.width < b.width - pad * 2 - 1, rowW: Math.round(r.width), barW: Math.round(b.width) };
        });
        if (abarRow && abarRow.short) {
          problems.push(
            `${route} — action bar row is ${abarRow.rowW}px inside a ${abarRow.barW}px bar (prose measure leaking into a layout row)`
          );
        }

        /* The item dialog, at this width. It is opened here rather than in a
           separate pass because a modal is exactly the thing that breaks at
           320px — it has a fixed max-width, a scrolling body and a footer that
           has to stay reachable — and nothing else in the suite ever renders
           it below 1440. */
        const dlg = await page.evaluate(async () => {
          const card = [...document.querySelectorAll('.item')].find((i) =>
            /All Out Sandwich Package/.test(i.textContent)
          );
          card?.querySelector('.add')?.click();
          await new Promise((r) => setTimeout(r, 400));
          const sheet = document.querySelector('.sheet');
          if (!sheet) return null;
          const r = sheet.getBoundingClientRect();
          const foot = document.querySelector('.sheet__foot').getBoundingClientRect();
          const body = document.querySelector('.sheet__body');
          const vw = document.documentElement.clientWidth;
          const vh = window.innerHeight;
          const small = [...sheet.querySelectorAll('button, a[href], textarea, .opt')]
            .filter((e) => e.offsetParent !== null)
            .map((e) => ({ e, b: e.getBoundingClientRect() }))
            .filter((x) => x.b.height > 0 && x.b.height < 44 && x.b.width < 44)
            .map((x) => `${(x.e.className || x.e.tagName).toString().split(/\s+/)[0]} ${Math.round(x.b.width)}x${Math.round(x.b.height)}`);
          return {
            w: Math.round(r.width),
            vw,
            overflowsX: r.left < -1 || r.right > vw + 1,
            tallerThanViewport: Math.round(r.height) > vh + 1,
            footVisible: foot.bottom <= vh + 1 && foot.top >= 0,
            footWithinSheet: foot.bottom <= r.bottom + 1,
            bodyScrolls: getComputedStyle(body).overflowY === 'auto',
            smallTargets: small,
            smallList: small.join(', '),
            centred: vw >= 760 ? Math.abs((r.left + r.right) / 2 - vw / 2) < 2 : true,
            bottomAnchored: vw < 760 ? Math.abs(r.bottom - vh) < 2 : true,
          };
        });

        if (!dlg) {
          problems.push(`${route} — the item dialog did not open`);
        } else {
          if (dlg.overflowsX) problems.push(`${route} — item dialog is ${dlg.w}px in a ${dlg.vw}px viewport`);
          if (dlg.tallerThanViewport) problems.push(`${route} — item dialog is taller than the viewport`);
          if (!dlg.footVisible) problems.push(`${route} — item dialog footer (total and Add) is off screen`);
          if (!dlg.footWithinSheet) problems.push(`${route} — item dialog footer escapes the sheet, squaring off its corners`);
          if (!dlg.bodyScrolls) problems.push(`${route} — item dialog body does not scroll, so long option lists are unreachable`);
          if (dlg.smallTargets.length) {
            problems.push(`${route} — target(s) under 44px inside the item dialog: ${dlg.smallList}`);
          }
          if (!dlg.centred) problems.push(`${route} — item dialog is not centred at this width`);
          if (!dlg.bottomAnchored) problems.push(`${route} — item dialog is not bottom-anchored on a phone`);
        }
        await page.evaluate(() => document.querySelector('.sheet__x')?.click());
        await page.waitForTimeout(200);

        if (menu.storebar) problems.push(`${route} — the duplicate store bar is back`);
        if (!menu.controls) problems.push(`${route} — control bar missing`);

        // Rail and its mobile counterpart are alternatives, never both, never neither.
        if (menu.rail === menu.railmob) {
          problems.push(
            `${route} — category nav is ${menu.rail ? 'duplicated' : 'missing'} (rail:${menu.rail} chips:${menu.railmob})`
          );
        }
        if (menu.railmob && !menu.chipsLabelled) {
          problems.push(`${route} — mobile category chips have no labels`);
        }
        if (menu.railmob && !menu.chipsCounted) {
          problems.push(`${route} — mobile category chips have no item counts`);
        }
        if (menu.railmob && menu.chipCount !== 8) {
          problems.push(`${route} — ${menu.chipCount} mobile category chips, expected 8`);
        }
        // Without the summary there must be a running total somewhere.
        if (!menu.summary && !menu.abar) {
          problems.push(`${route} — no order summary and no action bar: the total is invisible`);
        }
        if (menu.controlsH > 140) {
          problems.push(`${route} — control bar is ${menu.controlsH}px tall`);
        }
        if (menu.cardW && menu.cardW < 250) {
          problems.push(`${route} — item cards are only ${menu.cardW}px wide`);
        }
        if (menu.addBox && menu.addBox[1] < 40) {
          problems.push(`${route} — Add is ${menu.addBox.join('x')}`);
        }
        if (menu.stickyTop > 220) {
          problems.push(`${route} — sticky chrome stacks to ${menu.stickyTop}px before any content`);
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

    const mastWidths = [...new Set(Object.values(shells).map((x) => x.mast).filter(Boolean))];
    if (mastWidths.length > 1) {
      const detail = Object.entries(shells)
        .map(([r, x]) => `${r}:${x.mast}`)
        .join(' ');
      problems.push(`masthead width differs between routes — ${detail}`);
    }
    const shellWidths = [...new Set(Object.values(shells).map((x) => x.shell).filter(Boolean))];
    if (shellWidths.length > 1) {
      const detail = Object.entries(shells)
        .map(([r, x]) => `${r}:${x.shell}`)
        .join(' ');
      problems.push(`content container differs between routes — ${detail}`);
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
