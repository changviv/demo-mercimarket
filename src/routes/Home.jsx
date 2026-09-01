import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HERO, MODES, HERO_FACTS } from '../data/site.js';
import { useOrder } from '../state/OrderContext.jsx';
import StorePicker from '../components/StorePicker.jsx';
import storefront from '/img/storefront.webp';

/* Prototype section 2 — "Home & store picker", built to the approved hero
   artifact (37aef8e5).

   Layout, in the artifact's order:
     hero band  — eyebrow pill, H1 with "Six Locations" in tomato, lede, then
                  the mode switch INSIDE the left column; the photo on the right
                  with the 24-hour card floating over its bottom-left corner
     picker     — on the page ground, not a white band; six cards, each split
                  into a body and a footer strip
     facts      — four figures in a white band, divided by hairlines

   The store picker is the hero. Every price, lead time, Toast restaurant and
   Stripe account downstream is per-kitchen, so nothing on this site can be
   honest until this question is answered. The mode switch is what makes it a
   homepage rather than a catering landing page: the same six stores serve
   pickup, delivery and catering, and only catering carries the minimum. */

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
      {/* ---- Hero ------------------------------------------------------------ */}
      <section className="hero" aria-labelledby="hero-head">
        <div className="shell hero__grid">
          <div className="hero__copy">
            <p className="hero__eyebrow">{HERO.eyebrow}</p>

            <h1 id="hero-head">
              Serving You at <em>Six Locations</em> in NYC
            </h1>

            <p className="hero__sub">{HERO.lede}</p>

            <div className="modes">
              <p className="modes__label" id="mode-label">
                {HERO.modeLabel}
              </p>
              <div className="modebar" role="group" aria-labelledby="mode-label">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="mode"
                    aria-pressed={mode === m.id}
                    onClick={() => setMode(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hero__art">
            <div className="hero__frame">
              <img
                src={storefront}
                alt="The Merci Market storefront on a Manhattan corner, awning out, flowers on the pavement."
                width="1200"
                height="960"
                fetchPriority="high"
              />
            </div>
            <p className="floater">
              <span className="floater__dot" aria-hidden="true" />
              <span>
                <b>{HERO.openNote.title}</b>
                <i>{HERO.openNote.sub}</i>
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ---- Picker ----------------------------------------------------------- */}
      <StorePicker
        title={active.title}
        note={HERO.pickerSub}
        cta={active.cta}
        showMin={Boolean(active.min)}
        onChoose={choose}
      />

      {/* ---- Facts ------------------------------------------------------------- */}
      <section className="facts" aria-label="Merci Market in numbers">
        <div className="shell">
          <ul className="facts__grid">
            {HERO_FACTS.map((f) => (
              <li key={f.n} className="fact">
                <b>{f.n}</b>
                <span>{f.t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
