/* Site content, transcribed from the approved prototype
   (artifact 0a86670d — "Merci Market Prototype", sections 1 and 2).

   Copy here is the prototype's, verbatim. Where the prototype says
   "Serving You at Six Locations in NYC", so does this file. Where it flags a
   question the client still owes, that flag is carried across rather than
   quietly answered.

   FOOTER_COLUMNS and LEGAL are separately transcribed from the live footer at
   mercimarketnyc.com — same headings, same link text, same destinations, same
   order. Absolute URLs stay absolute because they leave this subdomain. */

export const MAIN_SITE = 'https://www.mercimarketnyc.com';

/* ---- Footer (live site) --------------------------------------------------- */

export const FOOTER_COLUMNS = [
  {
    heading: 'Our Company',
    links: [
      { label: 'About', href: `${MAIN_SITE}/about/` },
      { label: 'Locations', href: `${MAIN_SITE}/locations/` },
      { label: 'Careers', href: `${MAIN_SITE}/careers/` },
      { label: 'Contact Us', href: `${MAIN_SITE}/contact-us/` },
    ],
  },
  {
    heading: 'Social',
    links: [
      {
        label: '@mercimarketnyc_official',
        href: 'https://www.instagram.com/mercimarketnyc_official?igsh=emZpMWRqYmx5am12',
        external: true,
      },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy', href: `${MAIN_SITE}/privacy-policy` },
      { label: 'Terms of Use', href: `${MAIN_SITE}/terms-of-use/` },
      { label: 'Refund Policy', href: `${MAIN_SITE}/refund-policy/` },
      { label: 'Delivery Policy', href: `${MAIN_SITE}/delivery-policy/` },
    ],
  },
];

export const COPYRIGHT = `© ${new Date().getFullYear()} Merci Market NYC. All Rights Reserved.`;

/* ---- Masthead (prototype section 2) --------------------------------------- */

/* Masthead navigation.

   These are IN-APP anchors, not links off to mercimarketnyc.com. Each one names
   a section that exists in this app; clicking it scrolls there, and when the
   section lives on another route the app navigates first and then scrolls.
   Nothing in the header leaves the site. */
export const SITE_NAV = [
  { label: 'Home', to: '/', hash: '' },
  { label: 'About', to: '/catering', hash: 'story' },
  { label: 'Menu', to: '/catering', hash: 'sections' },
  { label: 'Locations', to: '/', hash: 'pick' },
];

export const MINIMUM_GUESTS = 8;

/* ---- Section 2: home and store picker -------------------------------------- */

export const HERO = {
  eyebrow: 'Family-owned in NYC since 1979',
  title: 'Serving You at Six Locations in NYC',
  lede:
    'Fresh flavors, quality ingredients, and friendly service—now at six convenient spots across Manhattan. Stop by for a quick bite, groceries, or catering, and enjoy the Merci Market experience wherever you are.',
  modeLabel: 'What are you ordering?',
  openNote: {
    title: 'Three stores open 24 hours',
    sub: 'Chelsea, Bryant Park & Central Park',
  },
  pickerSub: 'Six neighborhoods across Manhattan. Hours shown are today’s.',
};

/* The mode switch. Each mode changes the picker heading and the card's CTA;
   only catering carries the eight-person minimum. */
export const MODES = [
  { id: 'pickup', label: 'Pickup', title: 'Choose your store for pickup', cta: 'Order Pickup' },
  {
    id: 'delivery',
    label: 'Delivery',
    title: 'Choose the store nearest you for delivery',
    cta: 'Order Delivery',
  },
  {
    id: 'catering',
    label: 'Catering',
    title: 'Choose your store to start a catering order',
    cta: 'Order Catering',
    min: true,
  },
];

export const HERO_FACTS = [
  { n: '6', t: 'Manhattan locations, each with its own kitchen' },
  { n: '24/7', t: 'at Chelsea, Bryant Park and Central Park' },
  { n: '76', t: 'catering items across 8 menu categories' },
  { n: '1979', t: 'family-owned and serving NYC since' },
];

/* ---- Section 1: the catering page ------------------------------------------ */

export const CATERING = {
  eyebrow: 'Catering · Six Manhattan kitchens',
  title: 'Delicious Catering for Every Occasion',
  lede:
    'From intimate gatherings to large celebrations, we provide delicious, freshly prepared catering tailored to your occasion. Whether it’s a corporate meeting, wedding, birthday, holiday party, or community event, our team ensures every detail is handled with care.',
  chip: {
    title: 'Eight-person minimum',
    sub: 'Per-person pricing, no quote needed',
  },
};

export const CATERING_FACTS = [
  { n: '1979', t: 'Family-owned and serving NYC since' },
  { n: '6', t: 'Manhattan kitchens, each cooking your order' },
  { n: '76', t: 'Catering items across eight menu sections' },
  { n: '24/7', t: 'At Chelsea, Bryant Park and Central Park' },
];

export const HOW_INTRO =
  'No quote form, no waiting for a callback. Pick a store, tell us how many people, and you have a real total before you commit.';

export const HOW_STEPS = [
  {
    t: 'Pick the kitchen nearest you',
    d: 'Six neighbourhoods across Manhattan. The store you choose cooks your order and delivers it, so lead times and hours are that kitchen’s own.',
    tag: 'Three of them never close',
  },
  {
    t: 'Tell us your headcount',
    d: 'Almost everything is priced per person with an eight-person minimum. Enter your number once and every item on the menu shows what it actually costs for your group.',
    tag: 'No mental arithmetic',
  },
  {
    t: 'We hold, then charge',
    d: 'Your card is authorized when you order and charged when the food goes out. If your headcount moves before then, the total moves with it.',
    tag: 'Change it up to the night before',
  },
];

export const OCCASIONS_INTRO =
  'Your copy already names these. Each one links straight into the part of the menu that serves it, rather than dropping people at the top of a 76-item list.';

/* `to` is the menu category each occasion jumps into — the whole point of the
   block is that it does not dump people at the top of a 76-item list. */
export const OCCASIONS = [
  {
    t: 'Corporate meetings',
    d: 'Breakfast platters, boxed lunches and sandwich packages sized for a room. The most-ordered thing we do.',
    tag: 'Breakfast & boxed lunches',
    cat: 'breakfast-platters',
  },
  {
    t: 'Weddings',
    d: 'Hors d’oeuvres, charcuterie and platters for the parts of the day the caterer does not cover.',
    tag: 'Hors d’oeuvres',
    cat: 'hors-doeuvres',
  },
  {
    t: 'Birthdays',
    d: 'Sandwich platters, salads and a cookie and brownie tray. Easy to scale up the morning of.',
    tag: 'Sandwich platters',
    cat: 'sandwich-platters',
  },
  {
    t: 'Holiday parties',
    d: 'Charcuterie boards, antipasto and smoked salmon for the December run, when every kitchen is booked.',
    tag: 'Hors d’oeuvres',
    cat: 'hors-doeuvres',
  },
  {
    t: 'Community events',
    d: 'Crudité, hummus and guacamole platters from $5.99 a head. The lowest per-person prices on the menu.',
    tag: 'Under $10 a head',
    cat: 'hors-doeuvres',
  },
  {
    t: 'Weekly office breakfast',
    d: 'Not in your copy, but it is the pattern worth owning. Order once, then reorder in one tap each week.',
    tag: 'Breakfast platters',
    cat: 'breakfast-platters',
  },
];

export const SECTIONS_INTRO =
  'Every item states its per-head price and its minimum up front. Individually packed options exist for offices that want no shared platters.';

export const STORY = {
  eyebrow: 'Est. 1979',
  title: 'Our Story Began in 1979',
  body: [
    'Merci Market NYC is more than a deli—it’s a family tradition born in New York City and made for our neighbors. We handpick high-quality ingredients, craft fresh favorites daily, and welcome you like family.',
    'From pantry staples to thoughtfully crafted deli classics, everything we serve is designed to let you taste NYC in every bite.',
  ],
  cta: 'Read more about us',
  href: `${MAIN_SITE}/about/`,
};

export const FAQ_INTRO =
  'Three of these I can answer from your own site. Three I cannot, and they are marked — they are the last things standing between this and a complete page.';

/* `pending: true` renders the NEEDS AN ANSWER pill. These three are business
   decisions the client still owes; inventing them would put a wrong promise in
   front of a customer. */
export const FAQ = [
  {
    q: 'How many people do I need to order for?',
    a: 'Eight, for almost everything. Platters, boxed lunches, sandwich packages and salads all carry an eight-person minimum. Individual Breakfast items and beverages do not — those are priced and packed one at a time.',
  },
  {
    q: 'Which stores are open when I need them?',
    a: 'Chelsea, Bryant Park and Central Park are open 24 hours. Greenwich Village and Union Square run 6am to midnight on weekdays and 7am to midnight at weekends. Murray Hill is 6am to 10:30pm daily.',
  },
  {
    q: 'Can I change the order after I place it?',
    a: 'Yes, until the kitchen starts it. Your card is authorized rather than charged when you order, so a headcount that drops simply costs less. A headcount that rises places a new authorization, and the screen tells you so before you save.',
  },
  {
    q: 'How far ahead do I need to order?',
    a: 'Your lead time appears nowhere on either site. Most delis in this bracket run 24 or 48 hours, and it may well differ by location and by menu section — a bagel platter is not a hot egg breakfast for forty.',
    pending: true,
  },
  {
    q: 'Do you deliver to me, and what does it cost?',
    a: 'No radius and no fee are published anywhere. This is the single most common reason a corporate planner leaves a catering site, and it is the one number I have flagged in every section so far.',
    pending: true,
  },
  {
    q: 'What if I need to cancel?',
    a: 'There is a Refund Policy link in your footer, but nothing in it addresses catering specifically — no cancellation window and no fee. Since the card is authorized rather than charged, releasing a hold is straightforward; the question is where you draw the line.',
    pending: true,
  },
];

export const PICK_CTA = {
  title: 'Which kitchen is cooking?',
  body: 'Pick a store and the menu, prices and hours all become that kitchen’s own. It takes one tap.',
};

/* ---- Section 5: delivery windows ------------------------------------------- */
/* Placeholders. The real cut-off rules are one of the three answers still owed. */
export const DELIVERY_WINDOWS = [
  '7:00 – 8:00 am',
  '8:00 – 9:00 am',
  '9:00 – 10:00 am',
  '11:00 am – 12:00 pm',
  '12:00 – 1:00 pm',
  '1:00 – 2:00 pm',
];

export const TAX_RATE = 0.08875;
