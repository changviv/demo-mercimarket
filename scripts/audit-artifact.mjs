#!/usr/bin/env node
/* Artifact parity, measured.

   The other parity audit checks that the prototype's WORDS are present. This
   one renders the approved artifact and the built route side by side and
   compares them: every one of the 76 cards, every category, every control, the
   computed style of every component, and every state a user can put the screen
   into — headcount, each filter, search, adding, stepping, the minimum.

   It exists because "matches the artifact" was twice asserted and twice wrong.
   The first pass compared one sample per class name, so anything that only
   affected the fortieth card went unseen. The second missed that buttons were
   4px short on every page. Measuring is the only version of this claim that
   means anything.

   The artifact is the local copy of the published HTML, verified byte-identical
   to artifact 06cbed02 at the time of writing.

   IMPORTANT — the publish wrapper. The published artifact is served inside a
   shell whose reset includes
     [hidden]:not([hidden=until-found]){display:none!important}
   The standalone template has no such rule, and `.item{display:flex}` then
   beats the UA's [hidden] rule, so filtered-out cards stay on screen in the
   local file and nowhere else. Without replicating it, this audit compares the
   build against a page that does not exist. */

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const BASE = process.env.AUDIT_BASE || 'http://localhost:4173';
const ARTIFACT = process.env.ARTIFACT_HTML || '/home/claude/merci-menu.html';
const CONFIGURATOR = process.env.CONFIGURATOR_HTML || '/home/claude/merci-item.html';
const CHECKOUT = process.env.CHECKOUT_HTML || '/home/claude/merci-checkout.html';
const ROUTE = '/menu/bryant-park';

/* The basket the checkout artifact is drawn against: Bryant Park, 12 guests,
   the three lines that add up to its $345.86 / $30.70 / $376.56. Seeded into
   sessionStorage so the build renders the same order the artifact does. */
const CHECKOUT_ORDER = {
  locationId: 'bryant-park',
  guests: 12,
  fulfillment: 'delivery',
  date: '',
  time: '',
  contact: { name: '', company: '', email: '', phone: '' },
  address: { line1: '', line2: '', zip: '' },
  notes: '',
  lines: [
    {
      uid: 'co-1',
      itemId: 'fresh-start-breakfast',
      name: 'Fresh Start Breakfast',
      price: 13.99,
      qty: 1,
      selections: { BEV: ['Regular Coffee'] },
    },
    { uid: 'co-2', itemId: 'fruit-platter', name: 'Fruit Platter', price: 9.5, qty: 1, selections: {} },
    {
      uid: 'co-3',
      itemId: 'box-of-coffee',
      name: 'Box of Coffee',
      price: 31.99,
      qty: 2,
      selections: {},
      unit: 'box',
      serves: 12,
    },
  ],
};

const results = { pass: [], fail: [] };
const P = (m) => results.pass.push(m);
const F = (m) => results.fail.push(m);
const cmp = (area, what, a, b) => {
  if (String(a) === String(b)) return true;
  F(`${area} · ${what}\n        artifact: ${String(a).slice(0, 120)}\n        build:    ${String(b).slice(0, 120)}`);
  return false;
};

/* Differences that are real, intended, and must NOT be "fixed" back.
   Each is a place the build knowingly departs from the artifact, with the
   reason; the audit asserts the departure is still exactly what was decided,
   so an accidental change here fails like anything else. */
const INTENDED = [
  ['container width', 'The artifact was drawn at a 1360 container and the other five artifacts at 1180-1240. The build uses one width everywhere (--shell, 1240), because a masthead that jumps 120px wider between the home page and the menu reads as two different sites. The flanking columns keep their designed widths and the middle absorbs the difference: 186 / 612 / 306 instead of 186 / 740 / 306, and ~299px cards instead of 363px. Asserted below, so drift still fails.'],
  ['guest floor', 'The artifact lets the headcount go to 1. The build floors it at the catering minimum of 8, because every platter on the page needs 8 and a control that offers 4 is a trap. The below-minimum states still exist — an order can arrive under the minimum from order management or a restored session — they are just not reachable from this control.'],
  ['guest stepper ring', 'The artifact rings each stepper glyph in a permanent hairline circle. Inside a hairline capsule that makes three concentric rounded outlines in 200px; the build shows the circle as a tint on hover and focus instead, and keeps the capsule as the only resting shape.'],
  ['guest stepper target', 'The artifact draws 40px circles and a 27px text span. The build keeps the 40px circle but makes the button and the number input 44px — the WCAG target floor — so the capsule is 8px wider.'],
  ['result count', 'The build adds a Clear control to the count, which the artifact has no equivalent of: its only way out of a filter is to toggle each chip back off.'],
  ['empty .line span', 'The artifact renders an empty <span class="line"> for box-priced items and hides it with :empty. The build omits the element. Identical on screen.'],
  ['page h1', 'The artifact has no h1 at all. The build adds a clipped one so the route has a document title; nothing is drawn.'],
  ['Add accessible name', 'Both buttons read "Add". The build adds an aria-label naming the item, because 76 buttons with the same accessible name is a screen-reader failure.'],
  ['button height', 'Four artifacts specify four different button heights — 48 in the menu, 49 in the hero, 50 in the configurator and 50 in the checkout. The build ships one button at 48. Four heights across one product is worse than matching any single artifact.'],
  ['option tile radius', "The configurator artifact draws option tiles at 11px; the build snaps them to the 10px token. One pixel on a tile corner is invisible and the radius scale stays closed."],
  ['close button target', 'The configurator artifact draws its close button at 42px; the build uses 44, the WCAG target floor.'],
  ['items with no options', 'The configurator artifact opens a sheet for an item with no choices, showing a "no choices needed" group. In the build the menu adds such an item in one tap (the menu artifact\'s behaviour), so that sheet state is unreachable from the menu — the branch is kept as a fallback.'],
  ['Locations button', 'The menu artifact\'s ordering masthead carries a Locations button beside "Change store". Both ended at the same six-store picker on the home page, so the masthead asked one question twice and answered it by throwing you out of the order. "Change store" is now a menu that switches store in place; the button is removed. Asserted as an inversion above — the artifact must still have it, the build must still not.'],
  ['missing-choices block', 'The artifact keeps the block in the DOM and hides it, retaining stale text; the build unmounts it. Identical on screen, and nothing stale is left for a screen reader to find.'],

  /* ---- section 5, the checkout (42bdcee2) ------------------------------- */
  ['confirmation', 'The checkout artifact replaces the four steps with an inline "Order placed" panel. The build navigates to /orders/:id, which is a real screen with its own artifact (8c40fafa) and, unlike a panel that dies with the tab, can be reopened from a confirmation email a week later. Asserted as an inversion below: the artifact must still draw .done-panel and the build must still not.'],
  ['payment slot', 'The artifact\'s payment box is a dashed placeholder reading "Stripe Payment Element mounts here … This prototype collects nothing." In the same box the build mounts the real Stripe Payment Element when a different card is chosen, and explains the saved card when it is not. Prototype copy that says nothing is collected must not ship on a page that collects.'],
  ['Edit order', 'The summary carries a quiet "Edit order" link back to the menu. The artifact has no equivalent — its only way back to the basket is the masthead — but a checkout you cannot back out of without losing your place is the oldest reason to abandon one.'],
  ['notice band metrics', 'The artifact draws the store-lock band at 16px radius / 15×18 padding / 13px gap with a .875rem body, and the card-hold band at 12 / 14×16 / 12 with a .8438rem body. Both render at the lock\'s values here, as one NoticeBand component. Two boxes in one flow that differ by two pixels read as a mistake, not as a decision.'],
  ['field radius', 'The artifact draws inputs and selects at 11px; the build snaps them to the 10px token, the same call already made for the configurator\'s option tiles. One pixel on a corner is invisible and the radius scale stays closed.'],
  ['lead time is counted in New York', 'The artifact reads dates off the BROWSER: it floors the picker at tomorrow in UTC (toISOString) and counts lead time by rounding the gap from the current instant. The build uses the store\'s calendar — tomorrow in New York, and whole days between two New York midnights. Ordering from London at 02:00 UTC the artifact refuses a date the Bryant Park kitchen can absolutely cook, and just after midnight in New York the two disagree by a day on how far out a booking is. Both the floor and the count are asserted below against New York, and the hold copy is compared with the number normalised out.'],
  ['fulfillment default', 'The artifact hard-codes Delivery as the preselected mode. The build carries whatever the customer already said on the home page — Pickup, Delivery or Catering — because asking the same question twice and ignoring the first answer is how a form loses trust. Both renderings are compared below, driven through the control.'],
  ['masthead', 'The artifact\'s checkout masthead is a wordmark and the Stripe reassurance. The build keeps the ordering masthead every screen in the flow shares — wordmark, store, Change store — and adds the reassurance to it on this route only. Below 900px it is hidden: the masthead there is a wordmark and a burger, and the same claim is made in full inside the payment step.'],
  ['summary card spacing', 'Two 1px differences inside the summary card, where the menu artifact (06cbed02) and the checkout artifact (42bdcee2) disagree with each other: the store/guest line\'s bottom margin (14 in the menu, 15 here) and the honey footnote\'s top margin (13 in the menu, 14 here). One .sum-card serves both screens, at the menu\'s values. Both are asserted as departures below.'],
  ['mode tile semantics', 'The artifact\'s two fulfillment tiles are plain buttons. The build keeps a real radio inside each, clipped rather than removed, so arrow keys work and assistive technology is told it is one choice of two. Identical on screen.'],
];

async function run() {
  const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch(existsSync(EXE) ? { executablePath: EXE } : {});

  const A = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await A.goto(`file://${ARTIFACT}`, { waitUntil: 'networkidle' });
  await A.evaluate(() => {
    document.documentElement.setAttribute('data-variant', 'b');
    document.querySelector('.notes')?.remove();
    document.querySelector('.compare')?.remove();
    const st = document.createElement('style');
    st.textContent = '[hidden]:not([hidden=until-found]){display:none!important}';
    document.head.appendChild(st);
  });
  await A.waitForTimeout(350);

  const B = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await B.goto(BASE + ROUTE, { waitUntil: 'networkidle' });
  await B.waitForTimeout(300);

  const artGuests = async (n) => {
    const cur = await A.evaluate(() => Number(document.getElementById('guests').textContent));
    for (let i = 0; i < Math.abs(n - cur); i += 1) await A.click(n > cur ? '#plus' : '#minus');
    await A.waitForTimeout(200);
  };
  const appGuests = async (n) => {
    await B.fill('#guests', String(n));
    await B.waitForTimeout(300);
  };

  await artGuests(12);
  await appGuests(12);

  /* ---- 1 · every card, field by field ---------------------------------- */
  const readItems = (p, nameSel) =>
    p.evaluate((nameSel) => {
      const t = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
      return [...document.querySelectorAll('.item')].map((el) => ({
        name: t(el.querySelector(nameSel)),
        desc: t(el.querySelector('.desc')),
        price: t(el.querySelector('.unit b')),
        unit: t(el.querySelector('.unit em')),
        line: t(el.querySelector('.line')) || '',
        choose: t(el.querySelector('.choose')),
        flag: t(el.querySelector('.flag')),
        badges: [...el.querySelectorAll('.badge')].map(t).join('|'),
      }));
    }, nameSel);

  const aItems = await readItems(A, 'h4');
  const bItems = await readItems(B, 'h3');
  if (cmp('items', 'count', aItems.length, bItems.length)) {
    let bad = 0;
    for (let i = 0; i < aItems.length; i += 1) {
      for (const k of Object.keys(aItems[i])) {
        if (String(aItems[i][k]) !== String(bItems[i][k])) {
          bad += 1;
          F(`item[${i}] "${aItems[i].name}" · ${k}\n        artifact: ${aItems[i][k]}\n        build:    ${bItems[i][k]}`);
        }
      }
    }
    if (!bad) P(`all ${aItems.length} cards match field for field (name, description, price, unit, line total, rule, flag, badges)`);
  }

  /* ---- 2 · geometry that defines the layout ---------------------------- */
  const geom = (p) =>
    p.evaluate(() => {
      const l = document.querySelector('.layout');
      const cs = getComputedStyle(l);
      const rl = document.querySelectorAll('#rail a, .rail__link');
      const px = (e) => (e ? Math.round(e.getBoundingClientRect().height) : null);
      const tracks = cs.gridTemplateColumns.split(' ');
      return {
        /* The middle column is derived from the container width, which the
           build deliberately unifies — so the RAIL and SUMMARY columns are
           compared against the artifact and the middle is checked separately
           against what the shared measure should produce. */
        railColumn: tracks[0],
        summaryColumn: tracks[2],
        middleColumn: tracks[1],
        layoutGap: cs.gap,
        layoutAlign: cs.alignItems,
        railHeights: [...rl].map((a) => Math.round(a.getBoundingClientRect().height)).join(','),
        railTexts: [...rl].map((a) => a.textContent.replace(/\s+/g, ' ').trim()).join(' / '),
        badges: [...document.querySelectorAll('.badge')]
          .slice(0, 3)
          .map((x) => {
            const r = x.getBoundingClientRect();
            const s = getComputedStyle(x);
            return `${Math.round(r.width)}x${Math.round(r.height)}@${s.fontSize}/${s.letterSpacing}`;
          })
          .join(','),
        cardHeight: Math.round(document.querySelector('.item').getBoundingClientRect().height),
        cardStyle: (() => {
          const s = getComputedStyle(document.querySelector('.item'));
          return `${s.padding}/${s.borderRadius}/${s.gap}/${s.backgroundColor}`;
        })(),
        itemsGap: getComputedStyle(document.querySelector('.items')).gap,
        sumCard: px(document.querySelector('.sum-card')),
        masthead: px(document.querySelector('.masthead, .mast')),
        controls: px(document.querySelector('.controls')),
        controlsTop: getComputedStyle(document.querySelector('.controls')).top,
        mastBtn: px(document.querySelector('.mast-act .btn, .mast__cta')),
        checkout: px(document.querySelector('#checkout, .sum-card .btn')),
        add: px(document.querySelector('.add')),
        capsules: [...document.querySelectorAll('.field, .ctl')]
          .map((c) => Math.round(c.getBoundingClientRect().height))
          .join(','),
        cardWidth: Math.round(document.querySelector('.item').getBoundingClientRect().width),
        chip: (() => {
          const r = document.querySelector('.chip').getBoundingClientRect();
          const s = getComputedStyle(document.querySelector('.chip'));
          return `${Math.round(r.height)}@${s.fontSize}/${s.fontWeight}`;
        })(),
        catTitle: (() => {
          const e = document.querySelector('.cat-head h3, .cat__head h2');
          const s = getComputedStyle(e);
          return `${s.fontSize}/${s.fontWeight}/${s.lineHeight}`;
        })(),
        itemName: (() => {
          const e = document.querySelector('.item h4, .item h3');
          const s = getComputedStyle(e);
          return `${s.fontSize}/${s.fontWeight}/${s.lineHeight}`;
        })(),
        priceBig: (() => {
          const s = getComputedStyle(document.querySelector('.unit b'));
          return `${s.fontSize}/${s.fontWeight}/${s.color}`;
        })(),
        addStyle: (() => {
          const s = getComputedStyle(document.querySelector('.add'));
          return `${s.backgroundColor}/${s.color}/${s.borderRadius}`;
        })(),
        stickyTops: [...document.querySelectorAll('.rail, .summary')]
          .map((e) => getComputedStyle(e).position + '@' + getComputedStyle(e).top)
          .join(','),
      };
    });

  const aGeom = await geom(A);
  const bGeom = await geom(B);

  /* These follow from the unified container and are asserted against the
     values that container should produce, not against the artifact's. */
  const DERIVED = {
    middleColumn: '612px',
    cardWidth: 299,
    railHeights: '37,56,37,37,56,37,37,37',
  };
  /* Controls the artifact draws that the build deliberately does not. The
     assertion inverts: the artifact must still have it (so a re-published
     artifact that drops it is noticed) and the build must still NOT, so the
     control cannot creep back in unremarked. */
  const REMOVED = {
    mastBtn:
      'the ordering masthead\'s Locations button. It and "Change store" both ended at the same six-store picker on the home page — the same question twice, answered by leaving the order. "Change store" is now a menu that switches store in place (StoreMenu), which leaves the button nothing to do. Keyboard, confirm-before-clearing and the phone drawer\'s copy of the list are asserted in audit-links section 10.',
  };
  let geomBad = 0;
  for (const k of Object.keys(aGeom)) {
    if (k in REMOVED) {
      if (aGeom[k] && bGeom[k] === null) {
        P(`intentionally removed: ${k} is drawn by the artifact (${aGeom[k]}) and absent from the build`);
      } else {
        F(
          `geometry · ${k}: expected present in the artifact and absent from the build, got artifact=${aGeom[k]} build=${bGeom[k]}`
        );
        geomBad += 1;
      }
      continue;
    }
    if (k in DERIVED) {
      if (!cmp('derived from the shared container', k, DERIVED[k], bGeom[k])) geomBad += 1;
      continue;
    }
    if (!cmp('geometry', k, aGeom[k], bGeom[k])) geomBad += 1;
  }
  if (!geomBad) {
    P(`all ${Object.keys(aGeom).length - Object.keys(DERIVED).length - Object.keys(REMOVED).length} shared measurements match the artifact (rail and summary columns, card box, badges, bars, buttons, sticky)`);
    P(`${Object.keys(DERIVED).length} container-derived measurements are at their intended values (middle column ${DERIVED.middleColumn}, cards ${DERIVED.cardWidth}px)`);
  }

  /* ---- 3 · the states -------------------------------------------------- */
  const visible = (p) =>
    p.evaluate(() => {
      const shown = [...document.querySelectorAll('.item')].filter(
        (e) => e.getBoundingClientRect().height > 0
      );
      return {
        n: shown.length,
        names: shown.map((e) => e.querySelector('h4, h3').textContent.trim()).join(' | '),
        cats: [...document.querySelectorAll('.cat')]
          .filter((e) => e.getBoundingClientRect().height > 0)
          .map((c) => c.id)
          .join(','),
        count: (document.querySelector('#count, .result-count') || {}).textContent
          ?.replace(/\s*Clear\s*$/, '')
          .trim(),
        rail: [...document.querySelectorAll('#rail a, .rail__link')]
          .map((a) => a.querySelector('i').textContent)
          .join(','),
      };
    });

  let stateBad = 0;
  const st = (area, a, b) => {
    for (const k of Object.keys(a)) if (!cmp(area, k, a[k], b[k])) stateBad += 1;
  };

  /* No 4 here: the build floors the headcount at the catering minimum of 8,
     which the artifact does not. The below-minimum rendering is still covered
     — the state block below drives it through order state rather than through
     a control that can no longer produce it. */
  for (const n of [8, 12, 25]) {
    await artGuests(n);
    await appGuests(n);
    const lines = (p) =>
      p.evaluate(() =>
        [...document.querySelectorAll('.item')]
          .map((e) => (e.querySelector('.line') || {}).textContent || '')
          .join('|')
      );
    if (!cmp(`guests=${n}`, 'every line total', await lines(A), await lines(B))) stateBad += 1;
    const addState = (p) =>
      p.evaluate(() => {
        const e = document.querySelector('.item .add');
        return e ? `${e.textContent.trim()}/${e.disabled}` : 'none';
      });
    if (!cmp(`guests=${n}`, 'first Add', await addState(A), await addState(B))) stateBad += 1;
  }
  await artGuests(12);
  await appGuests(12);

  for (const label of ['Most popular', 'Vegetarian', 'Individually packed']) {
    await A.locator('.chip', { hasText: label }).click();
    await B.locator('.chip', { hasText: label }).click();
    await A.waitForTimeout(250);
    await B.waitForTimeout(250);
    st(`filter "${label}"`, await visible(A), await visible(B));
    await A.locator('.chip', { hasText: label }).click();
    await B.locator('.chip', { hasText: label }).click();
    await A.waitForTimeout(200);
    await B.waitForTimeout(200);
  }

  for (const q of ['bagel', 'salmon', 'chicken', 'omelet', 'zzzz']) {
    await A.fill('#q', q);
    await B.fill('#q', q);
    await A.waitForTimeout(300);
    await B.waitForTimeout(300);
    st(`search "${q}"`, await visible(A), await visible(B));
  }
  await A.fill('#q', '');
  await B.fill('#q', '');
  await A.waitForTimeout(300);
  await B.waitForTimeout(300);

  const sumState = (p, btn) =>
    p.evaluate((btn) => {
      const t = (s) => {
        const e = document.querySelector(s);
        return e ? e.textContent.replace(/\s+/g, ' ').trim() : null;
      };
      const el = document.querySelector(btn);
      return {
        lines: document.querySelectorAll('.lines li').length,
        lineText: [...document.querySelectorAll('.lines li')]
          .map((l) => l.textContent.replace(/\s+/g, ' ').trim())
          .join(' // '),
        subtotal: t('#subtotal, .sum-total b'),
        warn: t('.sum-warn:not([hidden])'),
        low: document.querySelectorAll('.lines li.low').length,
        blocked: el ? el.disabled === true || el.getAttribute('aria-disabled') === 'true' : null,
        qty: (document.querySelector('.item .qty .n, .item .qty .qty__n') || {}).textContent,
        marked: !!document.querySelector('.item.in, .item--in'),
      };
    }, btn);

  const add = async (p) => {
    await p.locator('.item', { hasText: 'Homemade Oatmeal' }).locator('.add').click();
    await p.waitForTimeout(250);
  };
  await add(A);
  await add(B);
  st('after adding', await sumState(A, '#checkout'), await sumState(B, '.sum-card .btn'));

  for (let i = 0; i < 2; i += 1) {
    await A.locator('.item', { hasText: 'Homemade Oatmeal' }).locator('.qty button').last().click();
    await B.locator('.item', { hasText: 'Homemade Oatmeal' }).locator('.qty button').last().click();
  }
  await A.waitForTimeout(250);
  await B.waitForTimeout(250);
  st('after stepping to 3', await sumState(A, '#checkout'), await sumState(B, '.sum-card .btn'));

  /* Below the minimum. The build's control floors at 8, so this state cannot
     be reached from the menu any more — but an order CAN arrive here, from
     order management or a restored session, and the rendering still has to be
     right. So it is driven through the persisted order state, which is exactly
     how it reaches a real user, and then compared to the artifact stepping its
     own control down to 4. */
  await artGuests(4);
  await B.evaluate(() => {
    const KEY = 'mm.order.v1';
    const o = JSON.parse(sessionStorage.getItem(KEY));
    o.guests = 4;
    sessionStorage.setItem(KEY, JSON.stringify(o));
  });
  await B.reload({ waitUntil: 'networkidle' });
  await B.waitForTimeout(400);
  st('under the minimum', await sumState(A, '#checkout'), await sumState(B, '.sum-card .btn'));

  const floored = await B.evaluate(() => {
    const i = document.getElementById('guests');
    return { min: i.min, value: i.value, minusDisabled: i.previousElementSibling.disabled };
  });
  if (floored.min === '8') P('the headcount control floors at the catering minimum of 8');
  else F(`guest floor is ${floored.min}, expected 8`);
  if (floored.value === '4' && floored.minusDisabled) {
    P('an order restored below the minimum shows its real count and cannot go lower');
  } else {
    F(`restored under-minimum order shows ${floored.value}, minus disabled: ${floored.minusDisabled}`);
  }
  /* And it can climb back out in one press: the clamp lifts straight to the
     floor rather than to 5, so nobody has to press + four times to reach a
     number the page will accept. */
  await B.locator('.ctl--guests .guests__step').last().click();
  await B.waitForTimeout(300);
  const climbed = await B.evaluate(() => document.getElementById('guests').value);
  if (climbed === '8') P('pressing + on an under-minimum order goes straight to 8');
  else F(`+ from 4 landed on ${climbed}, expected 8`);

  await artGuests(12);
  await appGuests(12);
  for (let i = 0; i < 3; i += 1) {
    await A.locator('.item', { hasText: 'Homemade Oatmeal' }).locator('.qty button').first().click();
    await B.locator('.item', { hasText: 'Homemade Oatmeal' }).locator('.qty button').first().click();
    await A.waitForTimeout(120);
    await B.waitForTimeout(120);
  }
  st('stepped back to empty', await sumState(A, '#checkout'), await sumState(B, '.sum-card .btn'));

  if (!stateBad) P('every state matches: 4 headcounts, 3 filters, 5 searches, add / step / minimum / remove');

  /* ============ SECTION 4 · the item configurator ====================== */
  {
    const C = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await C.goto(`file://${CONFIGURATOR}`, { waitUntil: 'networkidle' });
    await C.evaluate(() => {
      document.documentElement.setAttribute('data-variant', 'b');
      document.querySelector('.notes')?.remove();
      document.querySelector('.compare')?.remove();
      const st = document.createElement('style');
      st.textContent = '[hidden]:not([hidden=until-found]){display:none!important}';
      document.head.appendChild(st);
    });
    await C.waitForTimeout(300);

    const S = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await S.goto(BASE + ROUTE, { waitUntil: 'networkidle' });
    await S.fill('#guests', '12');
    await S.waitForTimeout(300);

    const openArtifact = async (name) => {
      await C.evaluate(() => document.querySelector('.close')?.click());
      await C.waitForTimeout(200);
      await C.evaluate((n) => {
        const c = [...document.querySelectorAll('#cards > *')].find((e) => e.textContent.includes(n));
        (c.querySelector('button') || c).click();
      }, name);
      await C.waitForTimeout(350);
    };
    const openBuild = async (name) => {
      await S.evaluate(() => document.querySelector('.sheet__x')?.click());
      await S.waitForTimeout(200);
      await S.locator(`[aria-label="Add ${name}"]`).first().click();
      await S.waitForTimeout(350);
    };

    /* Everything about the dialog that the design pins down. */
    const probe = (p, sel) =>
      p.evaluate((sel) => {
        const q = (x) => document.querySelector(x);
        const box = (e) =>
          e ? `${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}` : 'missing';
        const cs = (x) => (q(x) ? getComputedStyle(q(x)) : null);
        const f = (c, ...k) => (c ? k.map((n) => c[n]).join('/') : 'missing');
        return {
          scrim: f(cs(sel.scrim), 'display', 'alignItems', 'justifyContent', 'padding'),
          sheet: f(cs(sel.sheet), 'borderRadius', 'overflow', 'maxWidth', 'maxHeight', 'backgroundColor'),
          sheetBox: box(q(sel.sheet)),
          head: f(cs(sel.head), 'padding', 'gap', 'alignItems'),
          h2: f(cs(sel.h2), 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'),
          desc: f(cs(sel.desc), 'fontSize', 'color'),
          body: f(cs(sel.body), 'padding'),
          group: f(cs(sel.group), 'padding', 'borderBottomWidth'),
          gTitle: f(cs(sel.gTitle), 'fontSize', 'fontWeight', 'lineHeight'),
          gCountText: (q(sel.gCount) || {}).textContent?.trim(),
          gCount: f(cs(sel.gCount), 'fontSize', 'backgroundColor', 'color', 'borderRadius', 'padding', 'textTransform'),
          gRule: f(cs(sel.gRule), 'fontSize', 'color', 'margin'),
          opts: f(cs(sel.opts), 'gridTemplateColumns', 'gap'),
          optBox: box(q(sel.opt)),
          opt: f(cs(sel.opt), 'backgroundColor', 'fontWeight', 'fontSize', 'gap', 'padding'),
          markBox: box(q(sel.mark)),
          mark: f(cs(sel.mark), 'borderRadius', 'borderTopWidth'),
          foot: f(cs(sel.foot), 'padding', 'backgroundColor', 'gap', 'borderTopWidth'),
          total: f(cs(sel.total), 'fontSize', 'fontWeight'),
          totalText: (q(sel.total) || {}).textContent?.trim(),
          mathText: (q(sel.math) || {}).textContent?.trim(),
          missingText: (() => {
            const e = q(sel.missing);
            return e && e.getBoundingClientRect().height > 0 ? e.textContent.trim() : null;
          })(),
          addDisabled: (() => {
            const e = q(sel.addBtn);
            return e ? e.disabled === true : null;
          })(),
          groups: document.querySelectorAll(sel.group).length,
        };
      }, sel);

    const ASEL = {
      scrim: '.scrim', sheet: '.sheet', head: '.sh-head', h2: '.sh-head h2', desc: '.sh-head p',
      body: '.sh-body', group: '.group', gTitle: '.g-head h3', gCount: '.g-req', gRule: '.g-help',
      opts: '.opts', opt: '.opt', mark: '.opt .mark', foot: '.sh-foot', total: '.sh-foot .math b',
      math: '.sh-foot .math span', missing: '.missing', addBtn: '#shAdd',
    };
    const BSEL = {
      scrim: '.scrim', sheet: '.sheet', head: '.sheet__head', h2: '.sheet__head h2', desc: '.sheet__desc',
      body: '.sheet__body', group: '.group', gTitle: '.group__title', gCount: '.group__count', gRule: '.group__rule',
      opts: '.opts', opt: '.opt', mark: '.opt__mark', foot: '.sheet__foot', total: '.sheet__money strong',
      math: '.sheet__money span', missing: '.sheet__missing', addBtn: '.sheet__add',
    };

    let cfgBad = 0;
    /* One item per rule shape the artifact demonstrates: a bounded multi-pick,
       a larger bounded one, and an unbounded required one. */
    for (const name of ['All Out Sandwich Package', 'Egg Sandwiches', 'Breakfast Wraps']) {
      await openArtifact(name);
      await openBuild(name);
      const x = await probe(C, ASEL);
      const y = await probe(S, BSEL);
      for (const k of Object.keys(x)) {
        if (!cmp(`4 · "${name}"`, k, x[k], y[k])) cfgBad += 1;
      }
    }

    /* The rule enforcement: choosing to the ceiling locks the rest, the pill
       turns over, the missing block clears and Add comes alive. */
    await openArtifact('All Out Sandwich Package');
    await openBuild('All Out Sandwich Package');
    const pick3 = async (p) => {
      for (let i = 0; i < 3; i += 1) await p.locator('.opt').nth(i).click();
      await p.waitForTimeout(300);
    };
    await pick3(C);
    await pick3(S);
    const after = (p, sel) =>
      p.evaluate((sel) => ({
        pill: document.querySelector(sel.gCount).textContent.trim(),
        pillDone: /done/.test(document.querySelector(sel.gCount).className),
        locked: document.querySelectorAll('.opt.off, .opt--off').length,
        chosen: document.querySelectorAll('.opt.on, .opt--on').length,
        addDisabled: document.querySelector(sel.addBtn).disabled === true,
        /* Boolean, not the element: the artifact hides the block and the
           build unmounts it, so a truthiness check returns false vs null for
           the same on-screen state. What matters is whether anything is
           visible. */
        missing: Boolean(
          document.querySelector(sel.missing) &&
            document.querySelector(sel.missing).getBoundingClientRect().height > 0
        ),
      }), sel);
    const ax = await after(C, ASEL);
    const bx = await after(S, BSEL);
    for (const k of Object.keys(ax)) {
      if (!cmp('4 · at the ceiling', k, ax[k], bx[k])) cfgBad += 1;
    }

    if (!cfgBad) {
      P('the configurator matches the artifact across three rule shapes — dialog, head, groups, option tiles, marks, footer maths — and at the ceiling');
    }

    /* The two fixes that prompted this pass, asserted so they cannot come back. */
    const fixes = await S.evaluate(() => {
      const scrim = getComputedStyle(document.querySelector('.scrim'));
      const sheet = document.querySelector('.sheet');
      const cs = getComputedStyle(sheet);
      const r = sheet.getBoundingClientRect();
      const foot = document.querySelector('.sheet__foot').getBoundingClientRect();
      return {
        centred: scrim.alignItems === 'center' && scrim.justifyContent === 'center',
        offCentreBy: Math.abs((r.left + r.right) / 2 - window.innerWidth / 2),
        clips: cs.overflow === 'hidden',
        radius: parseFloat(cs.borderBottomLeftRadius),
        footWithin: foot.bottom <= r.bottom + 1,
      };
    });
    if (fixes.centred && fixes.offCentreBy < 2) P('4 · the dialog is centred, not parked in a corner');
    else F(`4 · dialog is ${fixes.offCentreBy}px off centre (scrim centred: ${fixes.centred})`);
    if (fixes.clips && fixes.radius > 0) P(`4 · the sheet clips its content, so its ${fixes.radius}px bottom corners are not painted over`);
    else F(`4 · sheet overflow is not hidden (radius ${fixes.radius}) — the footer will square off its bottom corners`);

    await C.close();
    await S.close();
  }

  /* ============ SECTION 5 · the checkout (42bdcee2) ==================== */
  {
    /* Both pages run on New York time. The artifact reads lead time off the
       browser's clock and the build off the store's, which is a departure with
       a reason (see INTENDED, "earliest date") — but it would also make every
       run of this audit between 20:00 and midnight New York disagree by a day
       for reasons that have nothing to do with the build. Pinning the timezone
       removes the noise and leaves the departure itself asserted below. */
    const CTX = { viewport: { width: 1440, height: 1100 }, timezoneId: 'America/New_York', locale: 'en-US' };

    const A5 = await browser.newPage(CTX);
    await A5.goto(`file://${CHECKOUT}`, { waitUntil: 'networkidle' });
    await A5.evaluate(() => {
      document.documentElement.setAttribute('data-variant', 'b');
      document.querySelector('.notes')?.remove();
      document.querySelector('.compare')?.remove();
      const st = document.createElement('style');
      st.textContent = '[hidden]:not([hidden=until-found]){display:none!important}';
      document.head.appendChild(st);
    });
    await A5.waitForTimeout(300);

    const B5 = await browser.newPage(CTX);
    const seed = async () => {
      await B5.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await B5.evaluate((o) => sessionStorage.setItem('mm.order.v1', JSON.stringify(o)), CHECKOUT_ORDER);
      await B5.goto(BASE + '/checkout', { waitUntil: 'networkidle' });
      await B5.waitForTimeout(400);
    };
    await seed();

    let coBad = 0;
    const co = (what, a, b) => {
      if (!cmp('5 · checkout', what, a, b)) coBad += 1;
    };

    const AS = {
      h1: '.intro h1',
      lede: '.intro p',
      lock: '.lock',
      lockTitle: '.lock b',
      lockBody: '.lock span span',
      step: '.step',
      stepOpen: '.step.active',
      head: '.st-head',
      stepN: '.st-n',
      nOpen: '.step.active .st-n',
      stepTitle: '.st-t b',
      stepSum: '.st-t span',
      stepEdit: '.st-edit',
      body: '.step.active .st-body',
      fields: '.step.active .f.two',
      label: '.step.active .fld label',
      hint: '.step.active .fld .hint',
      stepfoot: '.step.active .stepfoot',
      next: '.step.active [data-next]',
      date: '#date',
      time: '#time',
      addr: '#addr',
      tiles: '.modes',
      tile: '.mode',
      tileOn: '.mode.on',
      feeRow: '#feeRow',
      saved: '#savedCard',
      mark: '#savedCard .mk',
      pm: '.pm',
      hold: '.hold',
      place: '#place',
      foot: '.step.active .stepfoot .hint',
      sumCard: '.sumcard',
      sumTitle: '.sumcard h2',
      sumWho: '.sumcard .who',
      lines: '.lines',
      line: '.lines li',
      lineName: '.lines .ln b',
      lineSub: '.lines .ln span',
      lineAmt: '.lines .amt',
      rows: '.rows',
      row: '.rows .row',
      rowPending: '.row.pending',
      rowTotal: '.row.total',
      rowTotalAmt: '.row.total b',
      note: '.tbd',
      layout: '.layout',
      side: '.sum',
      column: '.layout > div:first-child',
      secure: '.secure',
    };
    const BS = {
      h1: '.co__intro h1',
      lede: '.co__intro p',
      lock: '.lock',
      lockTitle: '.lock strong',
      lockBody: '.lock .band__t > span',
      step: '.step3',
      stepOpen: '.step3--open',
      head: '.st-head',
      stepN: '.st-n',
      nOpen: '.step3--open .st-n',
      stepTitle: '.st-t strong',
      stepSum: '.st-sum',
      stepEdit: '.st-edit',
      body: '.step3--open .st-body',
      fields: '.step3--open .fields--two',
      label: '.step3--open .field__label',
      hint: '.step3--open .field__hint',
      stepfoot: '.step3--open .stepfoot',
      next: '.step3--open .stepfoot button',
      date: '#date',
      time: '#time',
      addr: '#addr1',
      tiles: '.fulfil',
      tile: '.fulfil__o',
      tileOn: '.fulfil__o--on',
      feeRow: '.tot__row--pending',
      saved: '.saved',
      mark: '.saved__mk',
      pm: '.pm',
      hold: '.hold',
      place: '.step3--open .stepfoot button',
      foot: '.stepfoot__note',
      sumCard: '.sum-card',
      sumTitle: '.sum-card .sum-head b',
      sumWho: '.sum-card .sum-guests',
      lines: '.lines',
      line: '.lines li',
      lineName: '.lines .ln b',
      lineSub: '.lines .ln span',
      lineAmt: '.lines .amt',
      rows: '.tot',
      row: '.tot .tot__row',
      rowPending: '.tot__row--pending',
      rowTotal: '.tot__row--strong',
      rowTotalAmt: '.tot__row--strong dd',
      note: '.pending',
      layout: '.co',
      side: '.co__side',
      column: '.co__main',
      secure: '.mast__secure',
    };

    /* ---- 5.1 · every word on the resting screen ------------------------ */
    const words = (p, sel) =>
      p.evaluate((sel) => {
        const t = (x) => {
          const e = document.querySelector(x);
          return e ? e.textContent.replace(/\s+/g, ' ').trim() : null;
        };
        const all = (x) =>
          [...document.querySelectorAll(x)].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
        return {
          h1: t(sel.h1),
          lede: t(sel.lede),
          lockTitle: t(sel.lockTitle),
          lockBody: t(sel.lockBody),
          stepNumbers: all(sel.stepN).join(','),
          stepTitles: all(sel.stepTitle).join(' | '),
          stepSummaries: all(sel.stepSum).join(' | '),
          editsShown: [...document.querySelectorAll(sel.stepEdit)]
            .filter((e) => e.getBoundingClientRect().height > 0)
            .map((e) => e.textContent.trim())
            .join(','),
          sumTitle: t(sel.sumTitle),
          sumWho: t(sel.sumWho),
          sumLines: all(sel.line).join(' // '),
          sumRows: all(sel.row).join(' // '),
          sumNote: t(sel.note),
        };
      }, sel);

    const aw = await words(A5, AS);
    const bw = await words(B5, BS);
    for (const k of Object.keys(aw)) co(`resting · ${k}`, aw[k], bw[k]);

    /* ---- 5.2 · the computed style of every part ------------------------ */
    const styles = (p, sel) =>
      p.evaluate((sel) => {
        const f = (x, ...k) => {
          const e = document.querySelector(x);
          if (!e) return 'missing';
          const c = getComputedStyle(e);
          return k.map((n) => c[n]).join('/');
        };
        const h = (x) => {
          const e = document.querySelector(x);
          return e ? Math.round(e.getBoundingClientRect().height) : null;
        };
        return {
          h1: f(sel.h1, 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'margin', 'fontVariationSettings'),
          lede: f(sel.lede, 'fontSize', 'color', 'margin', 'maxWidth'),
          lock: f(sel.lock, 'display', 'alignItems', 'gap', 'padding', 'borderRadius', 'backgroundColor', 'borderTopWidth', 'borderTopColor', 'marginBottom'),
          lockTitle: f(sel.lockTitle, 'display', 'fontSize', 'fontWeight', 'lineHeight', 'color'),
          lockBody: f(sel.lockBody, 'display', 'fontSize', 'color', 'lineHeight'),
          step: f(sel.step, 'backgroundColor', 'borderTopWidth', 'borderRadius', 'marginBottom', 'overflow', 'boxShadow'),
          stepOpen: f(sel.stepOpen, 'borderTopColor'),
          head: f(sel.head, 'display', 'alignItems', 'gap', 'padding', 'textAlign', 'backgroundColor'),
          headHeight: h(sel.head),
          n: f(sel.stepN, 'width', 'height', 'borderRadius', 'borderTopWidth', 'borderTopColor', 'fontSize', 'fontWeight', 'fontVariantNumeric', 'display', 'alignItems', 'justifyContent'),
          nOpen: f(sel.nOpen, 'backgroundColor', 'borderTopColor', 'color'),
          title: f(sel.stepTitle, 'display', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontVariationSettings'),
          sum: f(sel.stepSum, 'display', 'fontSize', 'color', 'lineHeight', 'marginTop'),
          edit: f(sel.stepEdit, 'fontWeight', 'fontSize', 'color'),
          body: f(sel.body, 'padding', 'borderTopWidth', 'marginTop'),
          fields: f(sel.fields, 'display', 'gap', 'gridTemplateColumns', 'paddingTop'),
          label: f(sel.label, 'fontSize', 'fontWeight', 'letterSpacing', 'color'),
          input: f(sel.date, 'borderTopWidth', 'borderTopColor', 'backgroundColor', 'padding', 'fontSize'),
          inputHeight: h(sel.date),
          selectHeight: h(sel.time),
          hint: f(sel.hint, 'fontSize', 'color', 'lineHeight'),
          stepfoot: f(sel.stepfoot, 'display', 'alignItems', 'flexWrap', 'paddingTop'),
          btn: f(sel.next, 'backgroundColor', 'color', 'borderRadius', 'fontWeight', 'fontSize'),
          btnHeight: h(sel.next),
          sumCard: f(sel.sumCard, 'backgroundColor', 'borderRadius', 'padding', 'boxShadow'),
          sumTitle: f(sel.sumTitle, 'fontFamily', 'fontSize', 'fontWeight', 'fontVariationSettings'),
          sumWho: f(sel.sumWho, 'fontSize', 'color', 'margin'),
          lines: f(sel.lines, 'display', 'flexDirection', 'gap', 'margin', 'padding', 'listStyleType'),
          line: f(sel.line, 'display', 'gap', 'fontSize', 'lineHeight'),
          lineName: f(sel.lineName, 'display', 'fontWeight'),
          lineSub: f(sel.lineSub, 'display', 'color', 'fontSize'),
          lineAmt: f(sel.lineAmt, 'fontWeight', 'fontVariantNumeric', 'whiteSpace'),
          rows: f(sel.rows, 'display', 'flexDirection', 'gap', 'paddingTop', 'borderTopWidth', 'borderTopColor'),
          row: f(sel.row, 'display', 'justifyContent', 'gap', 'fontSize', 'color', 'fontVariantNumeric'),
          rowPending: f(sel.rowPending, 'color', 'fontWeight'),
          rowTotal: f(sel.rowTotal, 'paddingTop', 'borderTopWidth', 'color', 'alignItems'),
          rowTotalAmt: f(sel.rowTotalAmt, 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing'),
          note: f(sel.note, 'fontSize', 'lineHeight', 'color', 'backgroundColor', 'borderRadius', 'padding', 'borderTopWidth'),
          layout: f(sel.layout, 'display', 'gap', 'alignItems'),
          side: f(sel.side, 'position'),
          sideWidth: (() => {
            const e = document.querySelector(sel.side);
            return e ? Math.round(e.getBoundingClientRect().width) : null;
          })(),
          columnWidth: (() => {
            const e = document.querySelector(sel.column);
            return e ? Math.round(e.getBoundingClientRect().width) : null;
          })(),
        };
      }, sel);

    const as = await styles(A5, AS);
    const bs = await styles(B5, BS);

    /* The left column is as wide as the container leaves it, and the container
       is deliberately one width everywhere (see --shell). 1240 of shell minus
       40 of gutter each side, minus the 350 summary and the 26 gap. */
    const CO_DERIVED = {
      columnWidth: 784,
      /* two equal tracks in that column, less the 14px grid gap */
      fields: 'grid/14px/364px 364px/18px',
      /* one button height across the product — see INTENDED, "button height" */
      btnHeight: 48,
      /* the artifact's card spacing, held at the menu artifact's values so one
         .sum-card serves both screens — see INTENDED, "summary card spacing" */
      sumWho: '13px/rgb(106, 95, 85)/0px 0px 14px',
      note: '12px/17.4px/rgb(46, 38, 32)/rgb(253, 240, 216)/10px/9px 11px/1px',
    };
    for (const k of Object.keys(as)) {
      if (k in CO_DERIVED) {
        if (!cmp('5 · derived from the shared container', k, CO_DERIVED[k], bs[k])) coBad += 1;
        continue;
      }
      co(`style · ${k}`, as[k], bs[k]);
    }

    /* ---- 5.2b · the departures, asserted as departures ------------------ */
    const prop = (p, sel, name) =>
      p.evaluate(([s, n]) => {
        const e = document.querySelector(s);
        return e ? getComputedStyle(e)[n] : 'missing';
      }, [sel, name]);

    const departure = async (label, sel, name, expectA, expectB, why) => {
      const a = await prop(A5, AS[sel], name);
      const b = await prop(B5, BS[sel], name);
      if (a === expectA && b === expectB) {
        P(`5 · intended departure holds — ${label}: artifact ${a}, build ${b}. ${why}`);
      } else {
        F(`5 · ${label}: expected artifact ${expectA} / build ${expectB}, got ${a} / ${b}`);
        coBad += 1;
      }
    };

    await departure(
      'field radius',
      'date',
      'borderRadius',
      '11px',
      '10px',
      'The 10px token, as already decided for the configurator option tiles.'
    );
    await departure(
      'summary footnote margin',
      'note',
      'marginTop',
      '14px',
      '13px',
      'One .pending, at the menu artifact\'s 13px.'
    );
    await departure(
      'summary meta margin',
      'sumWho',
      'marginBottom',
      '15px',
      '14px',
      'One .sum-guests, at the menu artifact\'s 14px.'
    );

    /* One NoticeBand: the hold band must measure exactly like the lock band in
       the build, and must NOT in the artifact — which is the whole reason the
       departure exists. Checked once step four is open, further down. */

    /* ---- 5.3 · step one, field by field, and its errors ---------------- */
    const stepOne = (p, sel) =>
      p.evaluate((sel) => {
        const e = document.querySelector(sel.next);
        return {
          labels: [...document.querySelectorAll(`${sel.body} label`)]
            .map((l) => l.textContent.replace(/\s+/g, ' ').trim())
            .join(' | '),
          dateType: document.querySelector('#date').type,
          windows: [...document.querySelectorAll('#time option')]
            .map((o) => o.textContent.trim())
            .join(' | '),
          hints: [...document.querySelectorAll(`${sel.body} .hint, ${sel.body} .field__hint`)]
            .map((h) => h.textContent.replace(/\s+/g, ' ').trim())
            .join(' | '),
          next: e ? e.textContent.trim() : null,
        };
      }, sel);

    const a1 = await stepOne(A5, AS);
    const b1 = await stepOne(B5, BS);
    for (const k of Object.keys(a1)) co(`step 1 · ${k}`, a1[k], b1[k]);

    /* The date floor: tomorrow where the kitchen is, not where the browser is. */
    const nyPlus = (days) => {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      d.setDate(d.getDate() + days);
      const z = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
    };
    const bMin = await B5.evaluate(() => document.getElementById('date').min);
    if (bMin === nyPlus(1)) P(`5 · the earliest date is tomorrow in New York (${bMin})`);
    else {
      F(`5 · date floor is ${bMin}, expected tomorrow in New York (${nyPlus(1)})`);
      coBad += 1;
    }

    const errs = (p, sel) =>
      p.evaluate(
        (sel) =>
          [...document.querySelectorAll(`${sel.body} .err, ${sel.body} .field__error`)]
            .filter((e) => e.getBoundingClientRect().height > 0)
            .map((e) => e.textContent.trim())
            .join(' | '),
        sel
      );
    const openIndex = (p, sel) =>
      p.evaluate(
        (sel) =>
          [...document.querySelectorAll(sel.step)].indexOf(document.querySelector(sel.stepOpen)),
        sel
      );

    await A5.click(AS.next);
    await B5.click(BS.next);
    await A5.waitForTimeout(250);
    await B5.waitForTimeout(250);
    co('step 1 · errors on an empty Continue', await errs(A5, AS), await errs(B5, BS));
    co('step 1 · still open after a refusal', await openIndex(A5, AS), await openIndex(B5, BS));
    co(
      'step 1 · the refused field is ringed',
      await prop(A5, '#date', 'borderTopColor'),
      await prop(B5, '#date', 'borderTopColor')
    );

    /* ---- 5.4 · walking the four steps ---------------------------------- */
    const advanceStep1 = async (days) => {
      for (const [p, sel] of [[A5, AS], [B5, BS]]) {
        await p.fill(sel.date, nyPlus(days));
        await p.selectOption(sel.time, { index: 1 });
        await p.click(sel.next);
        await p.waitForTimeout(300);
      }
    };
    await advanceStep1(3);

    const after1 = await words(A5, AS);
    const after1B = await words(B5, BS);
    for (const k of ['stepNumbers', 'stepTitles', 'stepSummaries', 'editsShown']) {
      co(`after step 1 · ${k}`, after1[k], after1B[k]);
    }
    co(
      'after step 1 · the answered number turns basil',
      await prop(A5, '.step.done .st-n', 'backgroundColor'),
      await prop(B5, '.step3--done .st-n', 'backgroundColor')
    );
    co('after step 1 · step 2 is the open one', await openIndex(A5, AS), await openIndex(B5, BS));

    /* Step 2: the tiles, the address, and what pickup takes off screen. */
    const stepTwo = (p, sel) =>
      p.evaluate((sel) => {
        const tiles = [...document.querySelectorAll(sel.tile)];
        const cs = (x, ...k) => {
          const e = typeof x === 'string' ? document.querySelector(x) : x;
          if (!e) return 'missing';
          const c = getComputedStyle(e);
          return k.map((n) => c[n]).join('/');
        };
        const addr = document.querySelector(sel.addr);
        const shown = (x) => {
          const e = document.querySelector(x);
          return Boolean(e && e.getBoundingClientRect().height > 0);
        };
        return {
          tiles: tiles.map((t) => t.textContent.replace(/\s+/g, ' ').trim()).join(' | '),
          tileStyle: tiles[0]
            ? cs(tiles[0], 'borderTopWidth', 'borderRadius', 'padding', 'backgroundColor', 'flexGrow', 'minWidth', 'textAlign')
            : 'missing',
          tileHeight: tiles[0] ? Math.round(tiles[0].getBoundingClientRect().height) : null,
          tileOn: cs(sel.tileOn, 'borderTopColor', 'backgroundColor'),
          tilesRow: cs(sel.tiles, 'display', 'gap', 'flexWrap', 'paddingTop'),
          addrPlaceholder: addr ? addr.placeholder : null,
          addrShown: shown(sel.addr),
          feeShown: shown(sel.feeRow),
        };
      }, sel);

    const a2 = await stepTwo(A5, AS);
    const b2 = await stepTwo(B5, BS);
    for (const k of Object.keys(a2)) co(`step 2 · ${k}`, a2[k], b2[k]);
    co(
      'step 2 · the driver-notes placeholder',
      await A5.evaluate(() => document.querySelector('#deliv').placeholder),
      await B5.evaluate(() => document.querySelector('#deliv').placeholder)
    );

    for (const [p, sel] of [[A5, AS], [B5, BS]]) {
      await p.locator(sel.tile, { hasText: 'pick it up' }).click();
      await p.waitForTimeout(300);
    }
    const a2p = await stepTwo(A5, AS);
    const b2p = await stepTwo(B5, BS);
    for (const k of ['addrShown', 'feeShown', 'tileOn']) co(`step 2 · pickup · ${k}`, a2p[k], b2p[k]);
    for (const [p, sel] of [[A5, AS], [B5, BS]]) {
      await p.locator(sel.tile, { hasText: 'Deliver to me' }).click();
      await p.waitForTimeout(300);
    }

    await A5.click(AS.next);
    await B5.click(BS.next);
    await A5.waitForTimeout(250);
    await B5.waitForTimeout(250);
    co('step 2 · error with no address', await errs(A5, AS), await errs(B5, BS));

    const ADDR = '11 W 42nd St, 5th floor';
    await A5.fill(AS.addr, ADDR);
    await B5.fill(BS.addr, ADDR);
    await A5.click(AS.next);
    await B5.click(BS.next);
    await A5.waitForTimeout(300);
    await B5.waitForTimeout(300);
    co('after step 2 · summaries', (await words(A5, AS)).stepSummaries, (await words(B5, BS)).stepSummaries);

    /* Step 3. */
    const stepThree = (p, sel) =>
      p.evaluate(
        (sel) => ({
          labels: [...document.querySelectorAll(`${sel.body} label`)]
            .map((l) => l.textContent.replace(/\s+/g, ' ').trim())
            .join(' | '),
          types: ['#name', '#co', '#email', '#phone']
            .map((i) => document.querySelector(i).type)
            .join(','),
          autocomplete: ['#name', '#co', '#email', '#phone']
            .map((i) => document.querySelector(i).getAttribute('autocomplete'))
            .join(','),
          hints: [...document.querySelectorAll(`${sel.body} .hint, ${sel.body} .field__hint`)]
            .map((h) => h.textContent.replace(/\s+/g, ' ').trim())
            .join(' | '),
        }),
        sel
      );
    const a3 = await stepThree(A5, AS);
    const b3 = await stepThree(B5, BS);
    for (const k of Object.keys(a3)) co(`step 3 · ${k}`, a3[k], b3[k]);

    await A5.click(AS.next);
    await B5.click(BS.next);
    await A5.waitForTimeout(300);
    await B5.waitForTimeout(300);
    co('step 3 · errors on an empty Continue', await errs(A5, AS), await errs(B5, BS));

    for (const [id, v] of [
      ['#name', 'Dana Reed'],
      ['#co', 'Wexler & Co'],
      ['#email', 'dana@example.com'],
      ['#phone', '2125551234'],
    ]) {
      await A5.fill(id, v);
      await B5.fill(id, v);
    }
    await A5.click(AS.next);
    await B5.click(BS.next);
    await A5.waitForTimeout(400);
    await B5.waitForSelector('.saved', { timeout: 15000 });
    await B5.waitForTimeout(400);

    /* Step 4. */
    const stepFour = (p, sel) =>
      p.evaluate((sel) => {
        const t = (x) => {
          const e = document.querySelector(x);
          return e ? e.textContent.replace(/\s+/g, ' ').trim() : null;
        };
        const cs = (x, ...k) => {
          const e = document.querySelector(x);
          if (!e) return 'missing';
          const c = getComputedStyle(e);
          return k.map((n) => c[n]).join('/');
        };
        const box = (x) => {
          const e = document.querySelector(x);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return `${Math.round(r.width)}x${Math.round(r.height)}`;
        };
        return {
          saved: t(sel.saved),
          savedStyle: cs(sel.saved, 'display', 'alignItems', 'gap', 'borderTopWidth', 'borderRadius', 'padding', 'marginTop', 'backgroundColor', 'borderTopColor', 'textAlign'),
          savedHeight: (() => {
            const e = document.querySelector(sel.saved);
            return e ? Math.round(e.getBoundingClientRect().height) : null;
          })(),
          mark: cs(sel.mark, 'width', 'height', 'borderRadius', 'borderTopWidth', 'backgroundColor', 'boxShadow', 'borderTopColor'),
          pmBox: cs(sel.pm, 'borderTopWidth', 'borderTopStyle', 'borderRadius', 'textAlign', 'backgroundColor', 'marginTop'),
          /* innerText, not textContent: both bands stack a claim over a
             sentence as block elements, and only the artifact happens to have
             source whitespace between them. */
          hold: document.querySelector(sel.hold).innerText.replace(/\s+/g, ' ').trim(),
          holdTint: cs(sel.hold, 'backgroundColor', 'borderTopColor', 'display', 'alignItems'),
          place: t(sel.place),
          placeHeight: box(sel.place)?.split('x')[1] ?? null,
          foot: t(sel.foot),
          footStyle: cs(sel.foot, 'fontSize', 'color'),
        };
      }, sel);

    const a4 = await stepFour(A5, AS);
    const b4 = await stepFour(B5, BS);
    const S4_DERIVED = { placeHeight: '48' };
    for (const k of Object.keys(a4)) {
      if (k in S4_DERIVED) {
        if (!cmp('5 · derived', `step 4 · ${k}`, S4_DERIVED[k], b4[k])) coBad += 1;
        continue;
      }
      co(`step 4 · ${k}`, a4[k], b4[k]);
    }

    /* One NoticeBand, two tones: in the build the hold band measures exactly
       like the lock band. In the artifact it does not — which is the departure. */
    const bandMetrics = (p, sel) =>
      p.evaluate((sel) => {
        const m = (x) => {
          const e = document.querySelector(x);
          if (!e) return 'missing';
          const c = getComputedStyle(e);
          return `${c.gap}/${c.padding}/${c.borderRadius}`;
        };
        return { lock: m(sel.lock), hold: m(sel.hold) };
      }, sel);
    const abands = await bandMetrics(A5, AS);
    const bbands = await bandMetrics(B5, BS);
    if (bbands.lock === bbands.hold && abands.lock !== abands.hold) {
      P(`5 · one notice band, two tones: the build draws both at ${bbands.lock}, where the artifact draws ${abands.lock} and ${abands.hold}`);
    } else {
      F(`5 · notice band: build lock=${bbands.lock} hold=${bbands.hold} (must be equal); artifact lock=${abands.lock} hold=${abands.hold} (must differ)`);
      coBad += 1;
    }

    /* Untick the saved card. */
    await A5.click(AS.saved);
    await B5.click(BS.saved);
    await A5.waitForTimeout(350);
    await B5.waitForTimeout(450);
    co(
      'step 4 · unticked saved card loses its tint',
      await prop(A5, AS.saved, 'backgroundColor'),
      await prop(B5, BS.saved, 'backgroundColor')
    );
    co(
      'step 4 · unticked saved card loses its mark',
      await prop(A5, AS.mark, 'backgroundColor'),
      await prop(B5, BS.mark, 'backgroundColor')
    );
    await A5.click(AS.saved);
    await B5.click(BS.saved);
    await A5.waitForTimeout(350);
    await B5.waitForTimeout(450);

    /* ---- 5.5 · the hold copy, which is the honest part ------------------ */
    const holdAt = async (p, sel, days) => {
      await p.locator(sel.stepEdit).first().click();
      await p.waitForTimeout(300);
      await p.fill(sel.date, nyPlus(days));
      await p.click(sel.next);
      await p.waitForTimeout(300);
      await p.locator(sel.head).nth(3).click();
      await p.waitForTimeout(350);
      return p.evaluate((s) => document.querySelector(s).innerText.replace(/\s+/g, ' ').trim(), sel.hold);
    };
    /* The lead-time number is normalised out of the comparison and then
       asserted on its own. The artifact rounds the gap from the current INSTANT
       ("59.6 days, call it 60"); the build counts calendar days between two
       midnights in New York. Between midnight and half past, in the store's own
       timezone, those two disagree by one — which is the same departure as the
       date floor, and not something to leave a flaky assertion on. The words
       are compared exactly; the count is compared to the calendar. */
    const blur = (t) => t.replace(/\b\d+ days\b/g, 'N days').replace(/\b\d+-day\b/g, 'N-day');
    for (const days of [3, 20, 60]) {
      const ah = await holdAt(A5, AS, days);
      const bh = await holdAt(B5, BS, days);
      co(`hold copy at ${days} days`, blur(ah), blur(bh));
      if (days > 7) {
        const wanted = days > 30 ? `${days} days away` : `${days}-day lead time`;
        if (bh.includes(wanted)) P(`5 · the hold copy counts ${days} calendar days in New York`);
        else {
          F(`5 · hold copy at ${days} days does not say "${wanted}": "${bh.slice(0, 120)}"`);
          coBad += 1;
        }
      }
    }

    /* ---- 5.6 · what the build deliberately does, and does not, draw ----- */
    const inArt = await A5.evaluate(() => Boolean(document.querySelector('.done-panel')));
    const inBuild = await B5.evaluate(() => Boolean(document.querySelector('.done-panel')));
    if (inArt && !inBuild) {
      P('5 · intentionally absent: the artifact\'s inline "Order placed" panel. The build navigates to /orders/:id, a real screen that survives the tab closing.');
    } else {
      F(`5 · done-panel: expected in the artifact and absent from the build, got artifact=${inArt} build=${inBuild}`);
      coBad += 1;
    }

    const backLink = await B5.evaluate(
      () => document.querySelector('.sum-card__back')?.textContent.trim() ?? null
    );
    const artBack = await A5.evaluate(() => Boolean(document.querySelector('.sumcard a')));
    if (backLink === 'Edit order' && !artBack) {
      P('5 · intentionally added: the summary\'s "Edit order" link, which the artifact has no equivalent of');
    } else {
      F(`5 · Edit order link: build="${backLink}", artifact has a summary link: ${artBack}`);
      coBad += 1;
    }

    /* The reassurance the artifact puts in its masthead is in this one. */
    const secure = (p, sel) =>
      p.evaluate((sel) => {
        const e = document.querySelector(sel.secure);
        if (!e) return null;
        const c = getComputedStyle(e);
        return {
          text: e.textContent.replace(/\s+/g, ' ').trim(),
          display: c.display,
          size: c.fontSize,
          color: c.color,
          mark: getComputedStyle(e.querySelector('svg')).color,
        };
      }, sel);
    const asec = await secure(A5, AS);
    const bsec = await secure(B5, BS);
    for (const k of Object.keys(asec)) co(`masthead · ${k}`, asec[k], bsec?.[k]);

    /* A step cannot be opened before the one in front of it is answered. */
    await seed();
    /* force: the head IS aria-disabled, which is what is being tested — the
       point is that a determined click still does nothing. */
    await B5.locator('.st-head').nth(3).click({ force: true });
    await B5.waitForTimeout(300);
    const jumped = await openIndex(B5, BS);
    const flagged = await B5.evaluate(
      () => document.querySelectorAll('.st-head[aria-disabled="true"]').length
    );
    if (jumped === 0 && flagged === 3) {
      P('5 · steps open in order: Payment cannot be reached before there is a date, and the three unreachable heads say so');
    } else {
      F(`5 · step gating: clicking Payment opened step index ${jumped}, ${flagged} heads marked unreachable (expected 0 and 3)`);
      coBad += 1;
    }

    if (!coBad) {
      P('the checkout matches the artifact: every word on the resting screen, 40 computed measurements, all four steps, both fulfillment modes, every error, the saved card and the three hold windows');
    }

    await A5.close();
    await B5.close();
  }

  await browser.close();

  console.log(`\n  MATCHES ${results.pass.length}   DIVERGENCES ${results.fail.length}\n`);
  results.pass.forEach((m) => console.log('  ✓ ' + m));
  console.log('\n  Intended departures, asserted above and not to be "fixed":');
  INTENDED.forEach(([k, why]) => console.log(`    · ${k} — ${why}`));
  if (results.fail.length) {
    console.log('');
    results.fail.forEach((m) => console.log('  ✗ ' + m));
    process.exit(1);
  }
  console.log('\n  Artifact audit passed — the build renders as the artifact does.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
