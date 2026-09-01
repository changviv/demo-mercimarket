import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LOCATIONS, locationStatus } from '../data/locations.js';
import { HERO, MODES, HERO_FACTS, MINIMUM_GUESTS } from '../data/site.js';
import { useOrder } from '../state/OrderContext.jsx';
import storefront from '/img/storefront.webp';

/* Prototype section 2 — "Home & store picker".

   The store picker IS the hero. Everything downstream — prices, hours, lead
   times, which Toast restaurant and which Stripe account — is per-kitchen, so
   nothing on this site can be honest until this question is answered.

   The mode switch is the part that makes it a homepage rather than a catering
   landing page: the same six stores serve pickup, delivery and catering, and
   the switch changes the picker's heading and each card's CTA. Only catering
   carries the eight-person minimum, so only catering shows it. */

export default function Home() {
  const [mode, setMode] = useState('catering');
  const { dispatch } = useOrder();
  const navigate = useNavigate();

  const active = MODES.find((m) => m.id === mode);

  function choose(loc) {
    dispatch({ type: 'setLocation', id: loc.id });
    dispatch({
      type: 'setField',
      field: 'fulfillment',
      value: mode === 'delivery' ? 'delivery' : 'pickup',
    });
    navigate(`/menu/${loc.id}`);
  }

  return (
    <>
      <section className="hero" aria-labelledby="hero-head">
        <div className="shell hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">{HERO.eyebrow}</p>
            <h1 id="hero-head">{HERO.title}</h1>
            <p className="lede">{HERO.lede}</p>
          </div>

          <figure className="hero__figure">
            <img
              src={storefront}
              alt="The Merci Market storefront on a Manhattan corner, awning out, produce on the pavement."
              width="1200"
              height="960"
              fetchPriority="high"
            />
          </figure>
        </div>
      </section>

      {/* ---- Mode switch + picker ------------------------------------------ */}
      <section className="picker" id="pick" aria-labelledby="pick-head">
        <div className="shell">
          <div className="modes">
            <p className="modes__label" id="mode-label">
              {HERO.modeLabel}
            </p>
            <div className="modes__set" role="tablist" aria-labelledby="mode-label">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  className={`mode${mode === m.id ? ' mode--on' : ''}`}
                  aria-selected={mode === m.id}
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <p className="modes__note">
              <span className="modes__dot" aria-hidden="true" />
              <span>
                <strong>{HERO.openNote.title}</strong>
                <span>{HERO.openNote.sub}</span>
              </span>
            </p>
          </div>

          <div className="picker__head">
            <h2 id="pick-head">{active.title}</h2>
            <p className="picker__note">{HERO.pickerSub}</p>
          </div>

          <ul className="picker__grid grid">
            {LOCATIONS.map((loc) => {
              const st = locationStatus(loc);
              return (
                <li key={loc.id}>
                  <button type="button" className="loc" onClick={() => choose(loc)}>
                    <span className={`pill ${st.open ? 'pill--open' : 'pill--shut'}`}>
                      {st.label}
                    </span>
                    <span className="loc__body">
                      <span className="loc__name">{loc.name}</span>
                      <span className="loc__addr">{loc.addr}</span>
                      <span className="loc__addr loc__addr--dim">{loc.city}</span>
                    </span>
                    <span className="loc__today">
                      <span className="loc__today-k">Today</span>
                      <span className="loc__today-v">{st.today}</span>
                    </span>
                    <span className="loc__foot">
                      <span className="loc__go">{active.cta}</span>
                      {active.min && (
                        <span className="loc__min">Min {MINIMUM_GUESTS} people</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---- Facts ---------------------------------------------------------- */}
      <section className="facts" aria-label="Merci Market in numbers">
        <ul className="shell facts__grid">
          {HERO_FACTS.map((f) => (
            <li key={f.n} className="fact">
              <span className="fact__n">{f.n}</span>
              <span className="fact__t">{f.t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section shell crosslink">
        <h2>Catering for a group?</h2>
        <p>
          Eight-person minimum, per-person pricing and a real total before you commit — no
          quote form and no callback.
        </p>
        <Link to="/catering" className="btn btn--primary btn--lg">
          See how catering works
        </Link>
      </section>
    </>
  );
}
