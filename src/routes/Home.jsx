import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HERO, MODES, HERO_FACTS, HOME_CATERING_CTA, STORY } from '../data/site.js';
import { useOrder } from '../state/OrderContext.jsx';
import StorePicker from '../components/StorePicker.jsx';
import StatStrip from '../components/StatStrip.jsx';
import ArtFrame, { DotBadge, SinceBadge } from '../components/ArtFrame.jsx';
import CtaCard from '../components/CtaCard.jsx';
import storefront from '/img/storefront.webp';
import spread from '/img/spread.webp';

/* Prototype section 2 — "Home & store picker", built to the approved hero
   artifact (37aef8e5).

   Section order, and the reasoning behind it — the page descends by intent,
   from the thing a ready visitor came to do down to the thing a browsing one
   might read:

     1 hero          who we are, and "what are you ordering?"
     2 locations     the primary action. Pick a kitchen and you are in the funnel
     3 facts         four figures that answer "are these people any good?" in one
                     scan, for anyone who did not click
     4 catering      the secondary conversion path, for the visitor who is
                     feeding a group rather than themselves
     5 story         the brand, last. Lowest intent, highest patience — and where
                     the masthead's About link points

   The 1979 figure closing the facts strip sets up the story section directly
   beneath it, so the two read as one thought rather than two blocks.

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

          <ArtFrame
            src={storefront}
            alt="The Merci Market storefront on a Manhattan corner, awning out, flowers on the pavement."
            width="1200"
            height="960"
            ratio="5 / 4"
            priority
            badge={<DotBadge title={HERO.openNote.title} sub={HERO.openNote.sub} />}
          />
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
      <StatStrip stats={HERO_FACTS} tone="surface" label="Merci Market in numbers" />

      {/* ---- Catering hand-off, straight after the locations -------------------- */}
      <CtaCard
        id="catering-cta"
        headingId="ccta-head"
        title={HOME_CATERING_CTA.title}
        body={HOME_CATERING_CTA.body}
        actions={
          <>
            <Link className="btn btn--primary btn--lg" to="/catering">
              {HOME_CATERING_CTA.primary}
            </Link>
            <Link className="btn btn--ghost btn--lg" to="/menu/bryant-park">
              {HOME_CATERING_CTA.secondary}
            </Link>
          </>
        }
      />

      {/* ---- Story — the brand, and where About points -------------------------- */}
      <section className="shell section" id="story" aria-labelledby="story-head">
        <div className="story">
          <ArtFrame
            src={spread}
            alt="An overhead spread of Merci Market food: sandwiches, salads, fruit and pastries laid out on a table."
            width="1200"
            height="900"
            ratio="4 / 3"
            badge={<SinceBadge>{STORY.eyebrow}</SinceBadge>}
          />
          <div className="story__txt">
            <h2 id="story-head">{STORY.title}</h2>
            {STORY.body.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <a className="btn btn--ghost" href={STORY.href}>
              {STORY.cta}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
