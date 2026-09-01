import { useState } from 'react';
import { Link } from 'react-router-dom';
import LocationPicker from '../components/LocationPicker.jsx';
import ActionBar from '../components/ActionBar.jsx';
import { FAQ, OPEN_QUESTIONS, MINIMUM_GUESTS } from '../data/site.js';
import { LOCATIONS } from '../data/locations.js';
import { useOrder } from '../state/OrderContext.jsx';

import storefront from '/img/storefront.webp';
import spread from '/img/spread.webp';
import tray from '/img/tray.webp';

/* Sections 1 + 2 on one route.

   DECISION — how the catering page is included.

   The obvious build is two pages: a marketing page that pitches catering, then
   a separate page where you pick a location and start. That is the right shape
   on a general-purpose restaurant site, where a catering visitor arrives from a
   nav bar full of other business.

   It is the wrong shape here. This is catering38.mercimarketnyc.com — a
   subdomain whose entire job is catering. Everyone who lands has already
   self-selected. Splitting pitch from picker puts a click between the visitor
   and the funnel, and gives two pages the same primary CTA, which is how you
   get analytics that cannot tell you which one earned the order.

   So it is one page, in the order a buyer actually reasons: pick your kitchen
   first (every price and lead time depends on it), then, for anyone still
   deciding, the proposition below the fold — what you get, how it works, what
   it costs, what we still owe you. The pitch is reachable by scroll and by the
   "How catering works" link; it never blocks the person who arrived ready. */

export default function Home() {
  const { order } = useOrder();
  const [openFaq, setOpenFaq] = useState(null);

  const resume = order.locationId
    ? LOCATIONS.find((l) => l.id === order.locationId)
    : null;

  return (
    <>
      {/* ---- Section 1: the pitch, in one screen ---------------------------- */}
      <section className="hero" aria-labelledby="hero-head">
        <div className="shell hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">Catering · Since 1979</p>
            <h1 id="hero-head">
              Feed the whole floor without spending your morning on it.
            </h1>
            <p className="lede">
              Breakfast platters, sandwich packages, salads and hors d&rsquo;oeuvres,
              made in the same six Manhattan kitchens that have been feeding this
              neighbourhood for forty-six years. Order in a few minutes. Change it
              until the night before.
            </p>
            <div className="row hero__cta">
              <a className="btn btn--primary btn--lg" href="#pick">
                Pick a location
              </a>
              <a className="btn btn--ghost btn--lg" href="#how">
                How catering works
              </a>
            </div>
            <p className="meta hero__min">
              {MINIMUM_GUESTS}-person minimum on platters. Individually packed
              breakfast and beverages have no minimum.
            </p>
          </div>

          <figure className="hero__figure">
            <img
              src={storefront}
              alt="The Merci Market storefront on a Manhattan corner, awning out, produce on the pavement."
              width="1200"
              height="900"
              fetchPriority="high"
            />
          </figure>
        </div>
      </section>

      {/* ---- Section 2: the picker ------------------------------------------ */}
      <LocationPicker id="pick" />

      {/* ---- Proposition ---------------------------------------------------- */}
      <section className="section section--band" id="how" aria-labelledby="how-head">
        <div className="shell">
          <p className="eyebrow">How it works</p>
          <h2 id="how-head">Four steps, and one of them is eating.</h2>

          <ol className="steps grid">
            {[
              {
                t: 'Pick a kitchen',
                d: 'Six locations, each with its own menu, prices and pickup times. Nearest to the event usually wins.',
              },
              {
                t: 'Set the headcount',
                d: 'Every platter price is per person. Type the number once and the whole menu reprices as you browse.',
              },
              {
                t: 'Build the order',
                d: 'Choices that say "choose 1" behave like choose 1. Nothing is added until the required picks are made.',
              },
              {
                t: 'Confirm and change',
                d: 'Your card is held, not charged. Adjust the count until the night before; you pay the final number.',
              },
            ].map((s, i) => (
              <li key={s.t} className="step card card--pad">
                <span className="step__n" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="step__t">{s.t}</h3>
                <p className="step__d">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Two-up story --------------------------------------------------- */}
      <section className="section" aria-labelledby="spread-head">
        <div className="shell split">
          <figure className="split__figure">
            <img
              src={spread}
              alt="An overhead spread of Merci Market food: sandwiches, salads, fruit and pastries laid out on a table."
              width="1200"
              height="800"
              loading="lazy"
            />
          </figure>
          <div className="split__copy">
            <p className="eyebrow">Built for offices</p>
            <h2 id="spread-head">The order you place is the order that arrives.</h2>
            <p>
              Every platter is assembled the morning of, in the store you chose, by
              people who have been making the same sandwiches for years. Nothing is
              shipped in from a central kitchen and nothing sits overnight.
            </p>
            <p>
              Dietary needs are labelled on the item, not buried in a description.
              Vegetarian platters are marked, and the choices inside each platter are
              yours to make.
            </p>
            <a className="btn btn--ghost" href="#pick">
              Start an order
            </a>
          </div>
        </div>
      </section>

      <section className="section section--band" aria-labelledby="tray-head">
        <div className="shell split split--flip">
          <div className="split__copy">
            <p className="eyebrow">Standing orders</p>
            <h2 id="tray-head">If it is every Tuesday, you should only order it once.</h2>
            <p>
              Reorder any past order in a tap, with the headcount and choices already
              filled in. Change the number, change the date, send it. The kitchen sees
              the same ticket it saw last week.
            </p>
            <p className="meta">
              Repeat orders reuse the card already on file for your account. Nothing is
              charged until the food goes out.
            </p>
          </div>
          <figure className="split__figure">
            <img
              src={tray}
              alt="A catering tray of assorted Merci Market sandwiches, cut and arranged for a group."
              width="1200"
              height="800"
              loading="lazy"
            />
          </figure>
        </div>
      </section>

      {/* ---- FAQ ------------------------------------------------------------- */}
      <section className="section" id="faq" aria-labelledby="faq-head">
        <div className="shell shell--narrow">
          <p className="eyebrow">Questions</p>
          <h2 id="faq-head">Before you order</h2>

          <div className="faq">
            {FAQ.map((f, i) => (
              <FaqRow
                key={f.q}
                {...f}
                open={openFaq === `a${i}`}
                onToggle={() => setOpenFaq(openFaq === `a${i}` ? null : `a${i}`)}
              />
            ))}
            {OPEN_QUESTIONS.map((f, i) => (
              <FaqRow
                key={f.q}
                {...f}
                pending
                open={openFaq === `b${i}`}
                onToggle={() => setOpenFaq(openFaq === `b${i}` ? null : `b${i}`)}
              />
            ))}
          </div>

          <p className="meta faq__foot">
            Amber answers are placeholders. Lead time, delivery radius and the
            cancellation window are business decisions the kitchens still owe us, and
            inventing them here would put a wrong promise in front of a customer.
          </p>
        </div>
      </section>

      <ActionBar
        summary={resume ? `Ordering from ${resume.name}` : 'Six Manhattan kitchens'}
        detail={resume ? 'Pick up where you left off' : `${MINIMUM_GUESTS}-person minimum on platters`}
        actionLabel={resume ? 'Back to menu' : 'Pick a location'}
        to={resume ? `/menu/${resume.id}` : undefined}
        onAction={() => document.getElementById('pick')?.scrollIntoView({ behavior: 'smooth' })}
      />
    </>
  );
}

function FaqRow({ q, a, pending, open, onToggle }) {
  return (
    <div className={`faq__row${pending ? ' faq__row--pending' : ''}`}>
      <h3 className="faq__q">
        <button type="button" aria-expanded={open} onClick={onToggle} className="faq__btn">
          <span>{q}</span>
          <span className="faq__mark" aria-hidden="true">
            {open ? '–' : '+'}
          </span>
        </button>
      </h3>
      {open && (
        <div className="faq__a">
          <p>{a}</p>
          {pending && <p className="faq__pending">Needs a decision from the client.</p>}
        </div>
      )}
    </div>
  );
}
