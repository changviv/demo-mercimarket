/* Site chrome content.

   FOOTER_COLUMNS and LEGAL are transcribed verbatim from the live footer at
   mercimarketnyc.com — same headings, same link text, same destinations, same
   order. Absolute URLs stay absolute because they leave this subdomain and
   point back at the main site. */

export const MAIN_SITE = 'https://www.mercimarketnyc.com';

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

/* Main-site navigation, matching the live header. "Order" and "Catering" on the
   live site both point at /locations; here Catering stays inside this app. */
export const SITE_NAV = [
  { label: 'Home', href: MAIN_SITE, external: true },
  { label: 'About', href: `${MAIN_SITE}/about/`, external: true },
  { label: 'Menu', href: `${MAIN_SITE}/menu/`, external: true },
  { label: 'Locations', href: `${MAIN_SITE}/locations/`, external: true },
  { label: 'Catering', to: '/', external: false },
];

export const MINIMUM_GUESTS = 8;

/* Open questions the client still owes before this can go live. Rendered in the
   FAQ as amber "we owe you an answer" items rather than silently invented. */
export const OPEN_QUESTIONS = [
  {
    q: 'How far ahead do I need to order?',
    a: 'Lead time is not yet set. Until the kitchens confirm a cutoff, checkout accepts any future date and flags same-day orders for a callback.',
  },
  {
    q: 'Do you deliver, and how much is it?',
    a: 'Delivery radius and fee are not yet set. Pickup is available at all six locations today.',
  },
  {
    q: 'Can I cancel or change my order?',
    a: 'Changes are open until 6pm the night before pickup — a placeholder. The real cancellation window and any fee still need confirming.',
  },
];

export const FAQ = [
  {
    q: 'What is the minimum order?',
    a: 'Eight people for platters. Individually packed breakfast, beverages and boxed items have no minimum, so a small office order still works.',
  },
  {
    q: 'Can I order from more than one location?',
    a: 'One order goes to one kitchen. Each location prepares and charges independently, so a second location means a second order.',
  },
  {
    q: 'When am I charged?',
    a: 'Your card is authorized when you place the order and charged when the food is handed over. If the final count drops, you are charged the lower amount.',
  },
  {
    q: 'Can I change the headcount after ordering?',
    a: 'Yes, up to the change cutoff. Raising the count above your original authorization needs a new authorization; lowering it never does.',
  },
];
