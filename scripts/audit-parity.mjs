#!/usr/bin/env node
/* Prototype parity audit.

   Checks that every heading, CTA label and flow step from the approved
   prototype (artifact 0a86670d — "Merci Market Prototype") is actually present
   in the running app, on the route it belongs to.

   This exists because "matches the prototype" is otherwise an opinion. Here it
   is a list that either passes or does not. */

import { chromium } from "playwright";
import { existsSync } from "node:fs";

const BASE = process.env.AUDIT_BASE || "http://localhost:4173";

/* Section by section, exactly as the prototype sequences them. */
const EXPECT = [
  {
    section: "1 · Catering page",
    route: "/catering",
    text: [
      "Delicious Catering for Every Occasion",
      "Eight-person minimum",
      "Per-person pricing, no quote needed",
      "Three steps, and you are done",
      "Pick the kitchen nearest you",
      "Three of them never close",
      "Tell us your headcount",
      "No mental arithmetic",
      "We hold, then charge",
      "Change it up to the night before",
      "What we cater",
      "Corporate meetings",
      "Weddings",
      "Birthdays",
      "Holiday parties",
      "Community events",
      "Weekly office breakfast",
      "Eight sections, priced per person",
      "The questions people ask before they order",
      "How many people do I need to order for?",
      "Which stores are open when I need them?",
      "Can I change the order after I place it?",
      "How far ahead do I need to order?",
      "Do you deliver to me, and what does it cost?",
      "What if I need to cancel?",
      "Which kitchen is cooking?",
    ],
    cta: ["Choose your store", "How it works", "Browse the full menu"],
    // Three FAQs the client still owes an answer to must be visibly flagged.
    count: [
      [".q--tbd", 3],
      [".step", 3],
      [".oc", 6],
      [".catpill", 8],
      [".closecta", 1],
    ],
  },
  {
    section: "2 · Home & store picker",
    route: "/",
    text: [
      "Family-owned in NYC since 1979",
      "Serving You at Six Locations in NYC",
      "What are you ordering?",
      "Three stores open 24 hours",
      "Chelsea, Bryant Park & Central Park",
      "Choose your store to start a catering order",
      "Six neighborhoods across Manhattan",
      "Greenwich Village",
      "Union Square",
      "Chelsea",
      "Murray Hill",
      "Bryant Park",
      "Central Park",
      "Min 8 people",
      // The catering hand-off, directly after the locations.
      "Catering for every occasion",
      "Eight-person minimum, per-person pricing",
      // The 1979 story lives here now, and is where About points.
      "Our Story Began in 1979",
      "a family tradition born in New York City",
    ],
    cta: [
      "Pickup",
      "Delivery",
      "Catering",
      "See how catering works",
      "Browse the full menu",
      "Read more about us",
    ],
    count: [
      [".loc", 6],
      [".mode", 3],
      [".fact", 4],
      ["#catering-cta", 1],
      ["#story", 1],
    ],
  },
  {
    section: "3 · Menu browse",
    route: "/menu/bryant-park",
    text: [
      "Bryant Park",
      "Change store",
      "Guests",
      "Most popular",
      "Vegetarian",
      "Individually packed",
      "Categories",
      "Breakfast Platters",
      "Individual Breakfast",
      "Boxed Lunches",
      "Sandwich Platters",
      "Sandwiches & Wraps",
      "Salad Platters",
      "Hors d'Oeuvres",
      "Beverages",
      "Your order",
      "Catering order",
      "Estimated subtotal",
    ],
    cta: ["Locations", "Continue to delivery"],
    count: [
      [".item", 76],
      [".add", 76],
      [".rail__link", 8],
    ],
  },
  {
    section: "5 · Checkout",
    route: "/checkout",
    text: [],
    cta: [],
    // Checkout needs a basket; exercised in the flow test below instead.
    skip: true,
  },
];

const results = { pass: [], fail: [] };
const P = (m) => results.pass.push(m);
const F = (m) => results.fail.push(m);

const norm = (s) => s.replace(/\s+/g, " ").replace(/[’']/g, "'").toLowerCase();

/* Run a block of behavioural checks so that a structural regression is
   REPORTED rather than thrown.

   A missing element makes Playwright wait thirty seconds and then throw, which
   aborts the process — so the one thing that broke takes the other eighty
   checks down with it and the output says nothing about them. That is exactly
   backwards for an audit: the whole value is knowing what else moved. The
   timeout is dropped to five seconds inside these blocks because everything
   here is already-rendered client state; nothing legitimately takes longer. */
async function checking(label, page, fn) {
  page.setDefaultTimeout(5000);
  try {
    await fn();
  } catch (e) {
    F(
      `${label} — could not complete: ${String(e.message || e).split("\n")[0]}`,
    );
  }
}

async function run() {
  const EXE =
    process.env.CHROMIUM_PATH ||
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const browser = await chromium.launch(
    existsSync(EXE) ? { executablePath: EXE } : {},
  );

  for (const spec of EXPECT) {
    if (spec.skip) continue;
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await page.goto(BASE + spec.route, { waitUntil: "networkidle" });
    await page.waitForTimeout(350);

    // Open every FAQ so collapsed answers count as present. They are native
    // <details>, so set the attribute rather than clicking six summaries.
    await page.evaluate(() =>
      document.querySelectorAll("details").forEach((d) => {
        d.open = true;
      }),
    );
    await page.waitForTimeout(200);

    const body = norm(await page.locator("body").innerText());
    const missing = spec.text.filter((t) => !body.includes(norm(t)));
    if (missing.length)
      F(`${spec.section}: missing copy — ${missing.join(" | ")}`);
    else
      P(`${spec.section}: all ${spec.text.length} prototype strings present`);

    const labels = await page.$$eval("button, a", (els) =>
      els.map((e) => (e.innerText || "").trim()).filter(Boolean),
    );
    const flat = labels.map(norm);
    const missingCta = spec.cta.filter(
      (c) => !flat.some((l) => l.includes(norm(c))),
    );
    if (missingCta.length)
      F(`${spec.section}: missing CTA — ${missingCta.join(" | ")}`);
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
    const p = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    const cases = [
      ["Pickup", "Choose your store for pickup", "Order Pickup"],
      [
        "Delivery",
        "Choose the store nearest you for delivery",
        "Order Delivery",
      ],
      [
        "Catering",
        "Choose your store to start a catering order",
        "Order Catering",
      ],
    ];
    for (const [label, title, cta] of cases) {
      await p.locator(".mode", { hasText: new RegExp(`^${label}$`) }).click();
      await p.waitForTimeout(200);
      const h = norm(await p.locator("#pick-head").innerText());
      const c = norm(await p.locator(".loc__cta").first().innerText());
      const min = await p.locator(".loc__min").count();
      const okTitle = h === norm(title);
      const okCta = c === norm(cta);
      const okMin = label === "Catering" ? min === 6 : min === 0;
      if (okTitle && okCta && okMin)
        P(
          `2 · mode "${label}" → "${title}" / "${cta}"${label === "Catering" ? " / min shown" : " / no min"}`,
        );
      else
        F(
          `2 · mode "${label}" wrong — title:"${h}" cta:"${c}" minCards:${min}`,
        );
    }
    await p.close();
  }

  /* ---- Section 3 : the browse screen's anatomy and its three behaviours ----
     Written after the route was rebuilt to artifact 06cbed02. Each assertion
     below was checked against the PREVIOUS markup first and fails on it — a
     regression test that passes on the broken code is decoration. */
  {
    const p = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await p.goto(BASE + "/menu/bryant-park", { waitUntil: "networkidle" });
    await p.fill("#guests", "12");
    await p.waitForTimeout(250);

    /* One bar, not two. The build carried a .storebar AND a control bar under
       a masthead that already named the store. */
    const chrome = await p.evaluate(() => ({
      storebars: document.querySelectorAll(".storebar").length,
      controls: document.querySelectorAll(".controls").length,
      siteNav: document.querySelectorAll(".mast__nav").length,
      ordering: document.querySelectorAll(".mast--order").length,
      storeInMast:
        (document.querySelector(".mast__store-name") || {}).textContent || "",
      changeStore: document.querySelectorAll(".mast__store-change").length,
      // the store name must appear ONCE, not once per bar
      nameCount: [...document.querySelectorAll(".mast, .controls")]
        .map((el) => (el.textContent.match(/Bryant Park/g) || []).length)
        .reduce((a, b) => a + b, 0),
    }));
    if (chrome.storebars === 0 && chrome.controls === 1)
      P("3 · one control bar, no duplicate store bar");
    else
      F(
        `3 · chrome wrong — storebars:${chrome.storebars} controls:${chrome.controls}`,
      );
    if (chrome.ordering === 1 && chrome.siteNav === 0)
      P("3 · masthead is in ordering mode: no site nav");
    else
      F(
        `3 · masthead not in ordering mode — nav:${chrome.siteNav} order:${chrome.ordering}`,
      );
    if (
      /Bryant Park · 1017 6th Ave/.test(chrome.storeInMast) &&
      chrome.changeStore === 1
    ) {
      P("3 · masthead carries the store and one Change store link");
    } else F(`3 · masthead store wrong — "${chrome.storeInMast}"`);
    if (chrome.nameCount === 1)
      P("3 · the store is named once in the chrome, not twice");
    else F(`3 · store named ${chrome.nameCount} times in the chrome`);

    /* Control bar contents, in the artifact's order and shape. */
    const bar = await p.evaluate(() => {
      const b = document.querySelector(".controls__in");
      const capsules = b.querySelectorAll(".ctl");
      const search = b.querySelector('.ctl input[type="search"]');
      const rc = b.querySelector(".result-count");
      return {
        h: Math.round(
          document.querySelector(".controls").getBoundingClientRect().height,
        ),
        capsules: capsules.length,
        capsuleH: [...capsules].map((c) =>
          Math.round(c.getBoundingClientRect().height),
        ),
        hasIcon: !!b.querySelector(".ctl .search-ico"),
        radius: search
          ? getComputedStyle(search.closest(".ctl")).borderRadius
          : "",
        chips: b.querySelectorAll(".chip").length,
        countText: rc ? rc.textContent.trim() : "",
        countRight: rc
          ? rc.getBoundingClientRect().right >
            b.getBoundingClientRect().right - 60
          : false,
        sticky: getComputedStyle(document.querySelector(".controls")).position,
      };
    });
    if (bar.capsules === 2 && bar.capsuleH.every((h) => h === 48))
      P("3 · two 48px control capsules");
    else F(`3 · capsules wrong — ${bar.capsules} at ${bar.capsuleH.join("/")}`);
    if (bar.hasIcon && bar.radius === "999px")
      P("3 · search is a pill with the magnifier inside it");
    else F(`3 · search field wrong — icon:${bar.hasIcon} radius:${bar.radius}`);
    if (bar.chips === 3) P("3 · three filter chips");
    else F(`3 · ${bar.chips} filter chips, expected 3`);
    if (bar.countText === "76 items" && bar.countRight)
      P("3 · result count sits in the bar, pushed right");
    else
      F(`3 · result count wrong — "${bar.countText}" right:${bar.countRight}`);
    if (bar.h === 77) P("3 · control bar is 77px, as the artifact");
    else F(`3 · control bar is ${bar.h}px, expected 77`);
    if (bar.sticky === "sticky") P("3 · control bar is sticky");
    else F(`3 · control bar position is ${bar.sticky}`);

    /* Layout measure. 186 / 740 / 306 at 1440 is the artifact's exact grid. */
    const grid = await p.evaluate(
      () =>
        getComputedStyle(document.querySelector(".layout")).gridTemplateColumns,
    );
    /* 612 in the middle, not the artifact's 740: the build unifies the
       container width across every route rather than letting the masthead jump
       between pages. audit:artifact asserts the same number and explains it. */
    if (grid === "186px 612px 306px") P("3 · layout grid is 186 / 612 / 306");
    else F(`3 · layout grid is "${grid}"`);

    /* Card anatomy: children in the artifact's order. */
    const card = await p.evaluate(() => {
      const el = [...document.querySelectorAll(".item")].find(
        (i) => i.querySelector(".badges") && i.querySelector(".choose"),
      );
      if (!el) return { error: "no card with both badges and a choose rule" };
      const add = el.querySelector(".add");
      const cs = add ? getComputedStyle(add) : null;
      const badge = el.querySelector(".badge");
      return {
        order: [...el.children].map(
          (c) => c.className || c.tagName.toLowerCase(),
        ),
        addBg: cs ? cs.backgroundColor : "",
        addColor: cs ? cs.color : "",
        addH: add ? Math.round(add.getBoundingClientRect().height) : 0,
        badgeRadius: badge ? getComputedStyle(badge).borderRadius : "",
        badgeCaps: badge ? getComputedStyle(badge).textTransform : "",
        chooseWeight: getComputedStyle(el.querySelector(".choose")).fontWeight,
        nameSize: getComputedStyle(el.querySelector("h3")).fontSize,
      };
    });
    if (card.error) F(`3 · ${card.error}`);
    else {
      const want = ["badges", "h3", "desc", "choose"];
      const got = card.order.slice(0, 4);
      if (want.every((c, i) => got[i] === c))
        P("3 · card order: badges, name, description, rule");
      else F(`3 · card order is ${got.join(" → ")}`);
      /* Outline, not solid: 76 solid primaries on one screen is 76 things
         shouting over the one real primary in the summary. */
      if (
        card.addBg === "rgba(0, 0, 0, 0)" &&
        card.addColor === "rgb(174, 52, 23)"
      ) {
        P("3 · Add is an outline button, not a solid primary");
      } else F(`3 · Add is filled — bg:${card.addBg} color:${card.addColor}`);
      if (card.addH === 42) P("3 · Add is 42px");
      else F(`3 · Add is ${card.addH}px, expected 42`);
      if (card.badgeRadius === "999px" && card.badgeCaps === "uppercase")
        P("3 · badges are uppercase pills");
      else
        F(
          `3 · badge wrong — radius:${card.badgeRadius} caps:${card.badgeCaps}`,
        );
      if (card.chooseWeight === "400")
        P("3 · the choose rule is quiet text, not a shout");
      else F(`3 · choose rule weight is ${card.chooseWeight}, expected 400`);
      if (card.nameSize === "19px") P("3 · item name is 19px");
      else F(`3 · item name is ${card.nameSize}, expected 19px`);
    }

    /* Behaviours 1-3, guarded: a structural regression here must be reported,
       not thrown — see `checking`. */
    await checking("3 · browse behaviour", p, async () => {
      /* Behaviour 1: Add on an option-free item adds in place and becomes −/n/+ */
      const oat = p.locator(".item", { hasText: "Homemade Oatmeal" });
      await oat.locator(".add").click();
      await p.waitForTimeout(200);
      const added = await p.evaluate(() => ({
        qty: (document.querySelector(".item .qty__n") || {}).textContent,
        inState: !!document.querySelector(".item--in"),
        sheet: !!document.querySelector(".sheet"),
        subtotal: (document.querySelector(".sum-total b") || {}).textContent,
        lines: document.querySelectorAll(".lines li").length,
      }));
      if (added.qty === "1" && !added.sheet)
        P("3 · Add on an option-free item adds in place, no sheet");
      else
        F(
          `3 · Add did not add in place — qty:${added.qty} sheet:${added.sheet}`,
        );
      if (added.inState) P("3 · the card shows it is on the order");
      else F("3 · added card carries no --in state");
      if (added.subtotal === "$90.00" && added.lines === 1)
        P("3 · the summary picks it up at $90.00 for 12");
      else
        F(
          `3 · summary wrong — ${added.subtotal} across ${added.lines} line(s)`,
        );

      /* Behaviour 2: minus at one removes the line rather than clamping. */
      await oat.locator(".qty button").first().click();
      await p.waitForTimeout(200);
      const gone = await p.evaluate(() => ({
        hasAdd: !!document.querySelector(".item .add"),
        lines: document.querySelectorAll(".lines li").length,
      }));
      if (gone.hasAdd && gone.lines === 0)
        P("3 · minus at one removes the line and restores Add");
      else F(`3 · minus at one left ${gone.lines} line(s), add:${gone.hasAdd}`);

      /* Behaviour 3: the minimum is enforced, not merely mentioned.

         The control now floors at 8, so this state is reached the way a real
         user reaches it — an order restored below the minimum, from order
         management or a resumed session — rather than by typing a number the
         control no longer accepts. */
      await oat.locator(".add").click();
      await p.waitForTimeout(200);
      await p.evaluate(() => {
        const KEY = "mm.order.v1";
        const o = JSON.parse(sessionStorage.getItem(KEY));
        o.guests = 4;
        sessionStorage.setItem(KEY, JSON.stringify(o));
      });
      await p.reload({ waitUntil: "networkidle" });
      await p.waitForTimeout(450);
      const under = await p.evaluate(() => {
        const oatCard = [...document.querySelectorAll(".item")].find((i) =>
          /Homemade Oatmeal/.test(i.textContent),
        );
        return {
          addText: (oatCard.querySelector(".add") || {}).textContent || "",
          addDisabled: !!(oatCard.querySelector(".add") || {}).disabled,
          perGuestLine: !!oatCard.querySelector(".line"),
          warn: !!document.querySelector(".sum-warn"),
          warnText:
            (document.querySelector(".sum-warn") || {}).textContent || "",
          low: document.querySelectorAll(".lines li.low").length,
          checkoutOff: (
            document.querySelector(".sum-card .btn") || {}
          ).className.includes("btn--off"),
        };
      });
      if (/Needs 8\+/.test(under.addText) && under.addDisabled)
        P('3 · under the minimum, Add reads "Needs 8+" and is disabled');
      else
        F(
          `3 · under-minimum Add is "${under.addText.trim()}" disabled:${under.addDisabled}`,
        );
      if (!under.perGuestLine)
        P(
          "3 · no per-group total is quoted for an order that cannot be placed",
        );
      else F("3 · a per-group total is still shown below the minimum");
      if (under.warn && /at least 8 guests/.test(under.warnText))
        P("3 · the summary warns which items are under");
      else F(`3 · no summary warning — "${under.warnText.trim()}"`);
      if (under.low === 1)
        P("3 · the offending line is flagged in the summary");
      else F(`3 · ${under.low} lines flagged, expected 1`);
      if (under.checkoutOff)
        P("3 · checkout is blocked while a line is under its minimum");
      else F("3 · checkout is still available with a line under its minimum");
    });

    await p.close();
  }

  /* ---- Section 4 : the configurator is a sheet, with the rules enforced ---- */
  {
    const p = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await p.goto(BASE + "/menu/bryant-park", { waitUntil: "networkidle" });
    await p.fill("#guests", "12");
    await p.waitForTimeout(200);

    await p
      .locator(".item", { hasText: "All Out Sandwich Package" })
      .locator(".add")
      .click();
    await p.waitForTimeout(300);

    const sheet = p.locator(".sheet");
    if (await sheet.isVisible())
      P("4 · Add opens the configurator as a sheet over the menu");
    else F("4 · Add did not open a sheet");

    const t = norm(await sheet.innerText());
    for (const need of [
      "sides",
      "0 of 3",
      "pick up to 3.",
      "vegetarian sandwiches",
      "the live site asks this as four separate tick boxes",
      "allergies or special requests",
      "this travels with the line item to the store",
      "still to choose: sides.",
      "$27.99 × 12 guests",
    ]) {
      if (t.includes(norm(need))) P(`4 · sheet has "${need}"`);
      else F(`4 · sheet missing "${need}"`);
    }

    const addBtn = sheet.locator(".sheet__add");
    if (await addBtn.isDisabled())
      P("4 · Add to order is off while a required group is unmet");
    else F("4 · Add to order was enabled with a required group unmet");

    const boxes = sheet.locator('.opts .opt');
    for (let i = 0; i < 3; i += 1) await boxes.nth(i).click();
    await p.waitForTimeout(200);
    const disabled = await sheet.locator(".opts input:disabled").count();
    if (disabled === 9)
      P("4 · at 3 of 3 the remaining 9 options disable themselves");
    else F(`4 · expected 9 disabled options at max, found ${disabled}`);
    if (norm(await sheet.innerText()).includes("3 of 3"))
      P("4 · counter reads 3 of 3");
    else F("4 · counter did not reach 3 of 3");

    await addBtn.click();
    await p.waitForTimeout(300);
    if ((await p.locator(".sheet").count()) === 0)
      P("4 · adding closes the sheet");
    else F("4 · sheet stayed open after adding");
    /* `.lines li`, not `.summary__line`: the summary was rebuilt to the menu
       artifact's markup in section 3. */
    if ((await p.locator(".lines li").count()) === 1)
      P("4 · the line landed in Your order");
    else F("4 · the line did not reach Your order");

    /* ---- Section 5 : the accordion ---------------------------------------- */
    await p.locator(".summary a.btn--primary").click();
    await p.waitForURL("**/checkout");
    await p.waitForTimeout(300);

    const co = norm(await p.locator(".co__main").innerText());
    for (const need of [
      "checkout",
      "when do you need it?",
      "delivery or pickup?",
      "who is it for?",
      "payment",
      "card hold, charged on delivery",
      "items from another store need their own order",
    ]) {
      if (co.includes(norm(need))) P(`5 · checkout has "${need}"`);
      else F(`5 · checkout missing "${need}"`);
    }
    if ((await p.locator(".st-head").count()) === 4)
      P("5 · four accordion steps");
    else
      F(
        `5 · expected 4 accordion steps, found ${await p.locator(".st-head").count()}`,
      );

    const opts = await p.locator("#time option").count();
    if (opts === 7)
      P("5 · delivery window select offers the six placeholder windows");
    else F(`5 · expected 7 window options (incl. placeholder), found ${opts}`);

    // The hold copy must change with the date. This is the honest bit.
    const holdFor = async (days) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      await p.fill("#date", d.toISOString().slice(0, 10));
      await p.waitForTimeout(150);
      await p.selectOption("#time", { index: 1 });
      await p.locator(".step3--open .stepfoot button").click();
      await p.waitForTimeout(200);
      await p.locator(".st-head").nth(3).click();
      await p.waitForTimeout(250);
      const txt = norm(await p.locator(".hold").innerText());
      await p.locator(".st-head").nth(0).click();
      await p.waitForTimeout(200);
      return txt;
    };

    const near = await holdFor(3);
    if (
      near.includes("you will not be charged today") &&
      !near.includes("extended")
    )
      P("5 · ≤7 days → plain hold copy");
    else F(`5 · ≤7 days hold copy wrong — "${near.slice(0, 80)}"`);

    const mid = await holdFor(20);
    if (mid.includes("extended hold")) P("5 · 8–30 days → extended hold copy");
    else F(`5 · 8–30 days hold copy wrong — "${mid.slice(0, 80)}"`);

    const far = await holdFor(60);
    if (far.includes("your card is saved, not held yet"))
      P("5 · >30 days → card saved, no hold");
    else F(`5 · >30 days hold copy wrong — "${far.slice(0, 80)}"`);

    await p.close();
  }

  /* ---- Section 6 : the four consequence bands ----------------------------- */
  {
    const p = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await p.goto(BASE + "/orders/preview", { waitUntil: "networkidle" });
    await p.waitForTimeout(400);

    if ((await p.locator(".om__main").count()) === 0) {
      F("6 · order management did not render (is the API running?)");
    } else {
      const om = norm(await p.locator(".om__main").innerText());
      for (const need of [
        "where it is",
        "change this order",
        "order this again",
      ]) {
        if (om.includes(norm(need))) P(`6 · has "${need}"`);
        else F(`6 · missing "${need}"`);
      }

      const band = async () => norm(await p.locator(".consq").innerText());
      if ((await band()).includes("nothing changed yet"))
        P("6 · resting band: Nothing changed yet");
      else F(`6 · resting band wrong — "${(await band()).slice(0, 60)}"`);

      // Set the field rather than clicking the stepper N times: the stepper
      // correctly disables at its floor, and a fixed click count walks into it.
      const guests = p.locator(".chg__row--guests .guests__input");
      const setGuests = async (n) => {
        await guests.fill(String(n));
        await p.waitForTimeout(250);
      };

      await setGuests(10);
      if ((await band()).includes("covered by the hold already on your card"))
        P("6 · lowering the count → covered by the hold");
      else F(`6 · lowering wrong — "${(await band()).slice(0, 70)}"`);

      await setGuests(30);
      if ((await band()).includes("this is more than we are holding"))
        P("6 · raising past the hold → more than we are holding");
      else F(`6 · raising wrong — "${(await band()).slice(0, 70)}"`);

      // The stepper must refuse to go below 1 rather than producing 0 or NaN.
      const gMinus = p.locator(".chg__row--guests .guests__step").first();
      await setGuests(1);
      if (await gMinus.isDisabled()) P("6 · guest stepper stops at 1");
      else F("6 · guest stepper allowed a count below 1");

      await setGuests(5);
      const under = await band();
      if (under.includes("under the minimum"))
        P("6 · under 8 guests → blocked with the minimum");
      else F(`6 · under-minimum wrong — "${under.slice(0, 70)}"`);
      if (await p.locator(".om__main .btn--primary").first().isDisabled())
        P("6 · Save changes is disabled while the change is blocked");
      else F("6 · Save changes stayed enabled on a blocked change");
    }
    await p.close();
  }

  await browser.close();

  console.log(
    `\n  PASS ${results.pass.length}   FAIL ${results.fail.length}\n`,
  );
  results.pass.forEach((m) => console.log("  ✓ " + m));
  if (results.fail.length) {
    console.log("");
    results.fail.forEach((m) => console.log("  ✗ " + m));
    process.exit(1);
  }
  console.log("\n  Prototype parity audit passed.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
