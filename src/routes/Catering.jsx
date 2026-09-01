import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CATERING,
  CATERING_FACTS,
  HOW_INTRO,
  HOW_STEPS,
  OCCASIONS,
  OCCASIONS_INTRO,
  SECTIONS_INTRO,
  STORY,
  FAQ,
  FAQ_INTRO,
  PICK_CTA,
  MINIMUM_GUESTS,
} from '../data/site.js';
import { MENU } from '../data/menu.js';
import { LOCATIONS, locationStatus } from '../data/locations.js';
import { useOrder } from '../state/OrderContext.jsx';
import spread from '/img/spread.webp';
import tray from '/img/tray.webp';

/* Prototype section 1 — "The pitch, before they order".

   Kept as its own route rather than folded into the homepage, because that is
   how the approved prototype sequences it: the catering page answers
   objections, then hands off to the picker. Two pages, two jobs. */

export default function Catering() {
  const [open, setOpen] = useState(0);
  const { dispatch } = useOrder();
  const navigate = useNavigate();

  function choose(loc) {
    dispatch({ type: 'setLocation', id: loc.id });
    dispatch({ type: 'setField', field: 'fulfillment', value: 'pickup' });
    navigate(`/menu/${loc.id}`);
  }

  return (
    <>
      {/* ---- Opener --------------------------------------------------------- */}
      <section className="open" aria-labelledby="cat-head">
        <div className="shell open__grid">
          <div>
            <p className="eyebrow eyebrow--chip">{CATERING.eyebrow}</p>
            <h1 id="cat-head">{CATERING.title}</h1>
            <p className="lede">{CATERING.lede}</p>
            <div className="row open__cta">
              <a className="btn btn--primary btn--lg" href="#pick">
                Choose your store
              </a>
              <a className="btn btn--ghost btn--lg" href="#how">
                How it works
              </a>
            </div>
          </div>

          <figure className="open__art">
            <img
              src={spread}
              alt="An overhead spread of Merci Market food: sandwiches, salads, fruit and pastries laid out on a table."
              width="1200"
              height="960"
              fetchPriority="high"
            />
            <figcaption className="open__chip">
              <span className="open__dot" aria-hidden="true" />
              <span>
                <strong>{CATERING.chip.title}</strong>
                <span>{CATERING.chip.sub}</span>
              </span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="facts" aria-label="Merci Market catering in numbers">
        <ul className="shell facts__grid">
          {CATERING_FACTS.map((f) => (
            <li key={f.n} className="fact">
              <span className="fact__n">{f.n}</span>
              <span className="fact__t">{f.t}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- How it works --------------------------------------------------- */}
      <section className="section section--band" id="how" aria-labelledby="how-head">
        <div className="shell">
          <h2 id="how-head">Three steps, and you are done</h2>
          <p className="lede">{HOW_INTRO}</p>

          <ol className="steps grid">
            {HOW_STEPS.map((s, i) => (
              <li key={s.t} className="step card card--pad">
                <span className="step__n" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="step__t">{s.t}</h3>
                <p className="step__d">{s.d}</p>
                <span className="tag">{s.tag}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- What we cater --------------------------------------------------- */}
      <section className="section" aria-labelledby="occ-head">
        <div className="shell">
          <h2 id="occ-head">What we cater</h2>
          <p className="lede">{OCCASIONS_INTRO}</p>

          <ul className="occs grid">
            {OCCASIONS.map((o) => (
              <li key={o.t}>
                <a className="occ" href={`#pick`} onClick={() => sessionStorage.setItem('mm.jumpCat', o.cat)}>
                  <h3 className="occ__t">{o.t}</h3>
                  <p className="occ__d">{o.d}</p>
                  <span className="tag">{o.tag}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- Eight sections --------------------------------------------------- */}
      <section className="section section--band" aria-labelledby="sec-head">
        <div className="shell">
          <h2 id="sec-head">Eight sections, priced per person</h2>
          <p className="lede">{SECTIONS_INTRO}</p>

          <ul className="secs">
            {MENU.map((c) => (
              <li key={c.id} className="sec">
                <span className="sec__n">{c.name}</span>
                <span className="sec__c">{c.items.length}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- Story ------------------------------------------------------------ */}
      <section className="section" aria-labelledby="story-head">
        <div className="shell split split--flip">
          <div className="split__copy">
            <p className="eyebrow">{STORY.eyebrow}</p>
            <h2 id="story-head">{STORY.title}</h2>
            {STORY.body.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <a className="btn btn--ghost" href={STORY.href}>
              {STORY.cta}
            </a>
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

      {/* ---- FAQ --------------------------------------------------------------- */}
      <section className="section section--band" id="faq" aria-labelledby="faq-head">
        <div className="shell shell--narrow">
          <h2 id="faq-head">The questions people ask before they order</h2>
          <p className="lede">{FAQ_INTRO}</p>

          <div className="faq">
            {FAQ.map((f, i) => (
              <div key={f.q} className={`faq__row${f.pending ? ' faq__row--pending' : ''}`}>
                <h3 className="faq__q">
                  <button
                    type="button"
                    className="faq__btn"
                    aria-expanded={open === i}
                    onClick={() => setOpen(open === i ? -1 : i)}
                  >
                    <span>
                      {f.pending && <span className="pill pill--needs">Needs an answer</span>}
                      {f.q}
                    </span>
                    <span className="faq__mark" aria-hidden="true">
                      {open === i ? '–' : '+'}
                    </span>
                  </button>
                </h3>
                {open === i && (
                  <div className="faq__a">
                    <p>{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Which kitchen is cooking? ------------------------------------------ */}
      <section className="picker" id="pick" aria-labelledby="pickc-head">
        <div className="shell">
          <div className="picker__head">
            <h2 id="pickc-head">{PICK_CTA.title}</h2>
            <p className="picker__note">{PICK_CTA.body}</p>
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
                      <span className="loc__go">Order Catering</span>
                      <span className="loc__min">Min {MINIMUM_GUESTS} people</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="picker__alt">
            <Link to="/menu/bryant-park" className="btn btn--ghost">
              Browse the full menu
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
