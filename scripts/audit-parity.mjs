#!/usr/bin/env node
/* Prototype parity audit.

   Checks that every heading, CTA label and flow step from the approved
   prototype (artifact 0a86670d — "Merci Market Prototype") is actually present
   in the running app, on the route it belongs to.

   This exists because "matches the prototype" is otherwise an opinion. Here it
   is a list that either passes or does not. */

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const BASE = process.env.AUDIT_BASE || 'http://localhost:4173';

/* Section by section, exactly as the prototype sequences them. */
const EXPECT = [
  {
    section: '1 · Catering page',
    route: '/catering',
    text: [
      'Delicious Catering for Every Occasion',
      'Eight-person minimum',
      'Per-person pricing, no quote needed',
      'Three steps, and you are done',
      'Pick the kitchen nearest you',
      'Three of them never close',
      'Tell us your headcount',
      'No mental arithmetic',
      'We hold, then charge',
      'Change it up to the night before',
      'What we cater',
      'Corporate meetings',
      'Weddings',
      'Birthdays',
      'Holiday parties',
      'Community events',
      'Weekly office breakfast',
      'Eight sections, priced per person',
      'The questions people ask before they order',
      'How many people do I need to order for?',
      'Which stores are open when I need them?',
      'Can I change the order after I place it?',
      'How far ahead do I need to order?',
      'Do you deliver to me, and what does it cost?',
      'What if I need to cancel?',
      'Which kitchen is cooking?',
    ],
    cta: ['Choose your store', 'How it works', 'Browse the full menu'],
    // Three FAQs the client still owes an answer to must be visibly flagged.
    count: [['.q--tbd', 3], ['.step', 3], ['.oc', 6], ['.catpill', 8], ['.closecta', 1]],
  },
  {
    section: '2 · Home & store picker',
    route: '/',
    text: [
      'Family-owned in NYC since 1979',
      'Serving You at Six Locations in NYC',
      'What are you ordering?',
      'Three stores open 24 hours',
      'Chelsea, Bryant Park & Central Park',
      'Choose your store to start a catering order',
      'Six neighborhoods across Manhattan',
      'Greenwich Village',
      'Union Square',
      'Chelsea',
      'Murray Hill',
      'Bryant Park',
      'Central Park',
      'Min 8 people',
      // The catering hand-off, directly after the locations.
      'Catering for every occasion',
      'Eight-person minimum, per-person pricing',
      // The 1979 story lives here now, and is where About points.
      'Our Story Began in 1979',
      'a family tradition born in New York City',
    ],
    cta: [
      'Pickup',
      'Delivery',
      'Catering',
      'See how catering works',
      'Browse the full menu',
      'Read more about us',
    ],
    count: [['.loc', 6], ['.mode', 3], ['.fact', 4], ['#catering-cta', 1], ['#story', 1]],
  },
  {
    section: '3 · Menu browse',
    route: '/menu/bryant-park',
    text: [
      'Bryant Park',
      'Change store',
      'Guests',
      'Most popular',
      'Vegetarian',
      'Individually packed',
      'Categories',
      'Breakfast Platters',
      'Individual Breakfast',
      'Boxed Lunches',
      'Sandwich Platters',
      'Sandwiches & Wraps',
      'Salad Platters',
      "Hors d'Oeuvres",
      'Beverages',
      'Your order',
      'Catering order',
      'Estimated subtotal',
    ],
    cta: ['Locations', 'Continue to delivery'],
    count: [['.item', 76], ['.add', 76], ['.rail__link', 8]],
  },
  {
    section: '5 · Checkout',
    route: '/checkout',
    text: [],
    cta: [],
    // Checkout needs a basket; exercised in the flow test below instead.
    skip: true,
  },
];

const results = { pass: [], fail: [] };
const P = (m) => results.pass.push(m);
const F = (m) => results.fail.push(m);

const norm = (s) => s.replace(/\s+/g, ' ').replace(/[’']/g, "'").toLowerCase();

async function run() {
  const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch(existsSync(EXE) ? { executablePath: EXE } : {});

  for (const spec of EXPECT) {
    if (spec.skip) continue;
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(BASE + spec.route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);

    // Open every FAQ so collapsed answers count as present. They are native
    // <details>, so set the attribute rather than clicking six summaries.
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(200);

    const body = norm(await page.locator('body').innerText());
    const missing = spec.text.filter((t) => !body.includes(norm(t)));
    if (missing.length) F(`${spec.section}: missing copy — ${missing.join(' | ')}`);
    else P(`${spec.section}: all ${spec.text.length} prototype strings present`);

    const labels = await page.$$eval('button, a', (els) =>
      els.map((e) => (e.innerText || '').trim()).filter(Boolean)
    );
    const flat = labels.map(norm);
    const missingCta = spec.cta.filter((c) => !flat.some((l) => l.includes(norm(c))));
    if (missingCta.length) F(`${spec.section}: missing CTA — ${missingCta.join(' | ')}`);
    else P(`${spec.section}: all ${spec.cta.length} prototype CTAs present`);

    for (const [sel, n] of spec.count || []) {
      const got = await page.locator(sel).count();
      if (got === n) P(`${spec.section}: ${n} × ${sel}`);
      else F(`${spec.section}: expected ${n} × ${sel}, found ${got}`);
    }

    await page.close();
  }

  /* ---- Section 2 : the mode switch actually switches ---------------------- */
  {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const cases = [
      ['Pickup', 'Choose your store for pickup', 'Order Pickup'],
      ['Delivery', 'Choose the store nearest you for delivery', 'Order Delivery'],
      ['Catering', 'Choose your store to start a catering order', 'Order Catering'],
    ];
    for (const [label, title, cta] of cases) {
      await p.locator('.mode', { hasText: new RegExp(`^${label}$`) }).click();
      await p.waitForTimeout(200);
      const h = norm(await p.locator('#pick-head').innerText());
      const c = norm(await p.locator('.loc__cta').first().innerText());
      const min = await p.locator('.loc__min').count();
      const okTitle = h === norm(title);
      const okCta = c === norm(cta);
      const okMin = label === 'Catering' ? min === 6 : min === 0;
      if (okTitle && okCta && okMin) P(`2 · mode "${label}" → "${title}" / "${cta}"${label === 'Catering' ? ' / min shown' : ' / no min'}`);
      else F(`2 · mode "${label}" wrong — title:"${h}" cta:"${c}" minCards:${min}`);
    }
    await p.close();
  }

  /* ---- Section 4 : the configurator is a sheet, with the rules enforced ---- */
  {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await p.goto(BASE + '/menu/bryant-park', { waitUntil: 'networkidle' });
    await p.fill('#guests', '12');
    await p.waitForTimeout(200);

    await p.locator('.item', { hasText: 'All Out Sandwich Package' }).locator('.add').click();
    await p.waitForTimeout(300);

    const sheet = p.locator('.sheet');
    if (await sheet.isVisible()) P('4 · Add opens the configurator as a sheet over the menu');
    else F('4 · Add did not open a sheet');

    const t = norm(await sheet.innerText());
    for (const need of [
      'sides',
      '0 of 3',
      'pick up to 3.',
      'vegetarian sandwiches',
      'the live site asks this as four separate tick boxes',
      'allergies or special requests',
      'this travels with the line item to the store',
      'still to choose: sides.',
      '$27.99 × 12 guests',
    ]) {
      if (t.includes(norm(need))) P(`4 · sheet has "${need}"`);
      else F(`4 · sheet missing "${need}"`);
    }

    const addBtn = sheet.locator('.sheet__add');
    if (await addBtn.isDisabled()) P('4 · Add to order is off while a required group is unmet');
    else F('4 · Add to order was enabled with a required group unmet');

    const boxes = sheet.locator('.opts input[type="checkbox"]');
    for (let i = 0; i < 3; i += 1) await boxes.nth(i).check();
    await p.waitForTimeout(200);
    const disabled = await sheet.locator('.opts input:disabled').count();
    if (disabled === 9) P('4 · at 3 of 3 the remaining 9 options disable themselves');
    else F(`4 · expected 9 disabled options at max, found ${disabled}`);
    if (norm(await sheet.innerText()).includes('3 of 3')) P('4 · counter reads 3 of 3');
    else F('4 · counter did not reach 3 of 3');

    await addBtn.click();
    await p.waitForTimeout(300);
    if ((await p.locator('.sheet').count()) === 0) P('4 · adding closes the sheet');
    else F('4 · sheet stayed open after adding');
    if ((await p.locator('.summary__line').count()) === 1) P('4 · the line landed in Your order');
    else F('4 · the line did not reach Your order');

    /* ---- Section 5 : the accordion ---------------------------------------- */
    await p.locator('.summary a.btn--primary').click();
    await p.waitForURL('**/checkout');
    await p.waitForTimeout(300);

    const co = norm(await p.locator('.co__main').innerText());
    for (const need of [
      'checkout',
      'when do you need it?',
      'delivery or pickup?',
      'who is it for?',
      'payment',
      'card hold, charged on delivery',
      'items from another store need their own order',
    ]) {
      if (co.includes(norm(need))) P(`5 · checkout has "${need}"`);
      else F(`5 · checkout missing "${need}"`);
    }
    if ((await p.locator('.st-head').count()) === 4) P('5 · four accordion steps');
    else F(`5 · expected 4 accordion steps, found ${await p.locator('.st-head').count()}`);

    const opts = await p.locator('#time option').count();
    if (opts === 7) P('5 · delivery window select offers the six placeholder windows');
    else F(`5 · expected 7 window options (incl. placeholder), found ${opts}`);

    // The hold copy must change with the date. This is the honest bit.
    const holdFor = async (days) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      await p.fill('#date', d.toISOString().slice(0, 10));
      await p.waitForTimeout(150);
      await p.selectOption('#time', { index: 1 });
      await p.locator('.step3--open .stepfoot button').click();
      await p.waitForTimeout(200);
      await p.locator('.st-head').nth(3).click();
      await p.waitForTimeout(250);
      const txt = norm(await p.locator('.hold').innerText());
      await p.locator('.st-head').nth(0).click();
      await p.waitForTimeout(200);
      return txt;
    };

    const near = await holdFor(3);
    if (near.includes('you will not be charged today') && !near.includes('extended'))
      P('5 · ≤7 days → plain hold copy');
    else F(`5 · ≤7 days hold copy wrong — "${near.slice(0, 80)}"`);

    const mid = await holdFor(20);
    if (mid.includes('extended hold')) P('5 · 8–30 days → extended hold copy');
    else F(`5 · 8–30 days hold copy wrong — "${mid.slice(0, 80)}"`);

    const far = await holdFor(60);
    if (far.includes('your card is saved, not held yet')) P('5 · >30 days → card saved, no hold');
    else F(`5 · >30 days hold copy wrong — "${far.slice(0, 80)}"`);

    await p.close();
  }

  /* ---- Section 6 : the four consequence bands ----------------------------- */
  {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await p.goto(BASE + '/orders/preview', { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);

    if ((await p.locator('.om__main').count()) === 0) {
      F('6 · order management did not render (is the API running?)');
    } else {
      const om = norm(await p.locator('.om__main').innerText());
      for (const need of ['where it is', 'change this order', 'order this again']) {
        if (om.includes(norm(need))) P(`6 · has "${need}"`);
        else F(`6 · missing "${need}"`);
      }

      const band = async () => norm(await p.locator('.consq').innerText());
      if ((await band()).includes('nothing changed yet')) P('6 · resting band: Nothing changed yet');
      else F(`6 · resting band wrong — "${(await band()).slice(0, 60)}"`);

      // Set the field rather than clicking the stepper N times: the stepper
      // correctly disables at its floor, and a fixed click count walks into it.
      const guests = p.locator('.chg__row--guests .guests__input');
      const setGuests = async (n) => {
        await guests.fill(String(n));
        await p.waitForTimeout(250);
      };

      await setGuests(10);
      if ((await band()).includes('covered by the hold already on your card'))
        P('6 · lowering the count → covered by the hold');
      else F(`6 · lowering wrong — "${(await band()).slice(0, 70)}"`);

      await setGuests(30);
      if ((await band()).includes('this is more than we are holding'))
        P('6 · raising past the hold → more than we are holding');
      else F(`6 · raising wrong — "${(await band()).slice(0, 70)}"`);

      // The stepper must refuse to go below 1 rather than producing 0 or NaN.
      const gMinus = p.locator('.chg__row--guests .guests__step').first();
      await setGuests(1);
      if (await gMinus.isDisabled()) P('6 · guest stepper stops at 1');
      else F('6 · guest stepper allowed a count below 1');

      await setGuests(5);
      const under = await band();
      if (under.includes('under the minimum')) P('6 · under 8 guests → blocked with the minimum');
      else F(`6 · under-minimum wrong — "${under.slice(0, 70)}"`);
      if (await p.locator('.om__main .btn--primary').first().isDisabled())
        P('6 · Save changes is disabled while the change is blocked');
      else F('6 · Save changes stayed enabled on a blocked change');
    }
    await p.close();
  }

  await browser.close();

  console.log(`\n  PASS ${results.pass.length}   FAIL ${results.fail.length}\n`);
  results.pass.forEach((m) => console.log('  ✓ ' + m));
  if (results.fail.length) {
    console.log('');
    results.fail.forEach((m) => console.log('  ✗ ' + m));
    process.exit(1);
  }
  console.log('\n  Prototype parity audit passed.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
