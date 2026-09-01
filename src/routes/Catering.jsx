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
} from '../data/site.js';
import { MENU } from '../data/menu.js';
import StatStrip from '../components/StatStrip.jsx';
import SectionHead from '../components/SectionHead.jsx';
import ArtFrame, { DotBadge, SinceBadge } from '../components/ArtFrame.jsx';
import Faq from '../components/Faq.jsx';
import { Arrow } from '../components/Icons.jsx';
import spread from '/img/spread.webp';
import tray from '/img/tray.webp';
import storefront from '/img/storefront.webp';

/* Prototype section 1 — "The pitch, before they order", built to the approved
   catering artifact (b099617a).

   Layout, in the artifact's order:
     opener        eyebrow pill · H1 with "Every Occasion" in tomato · lede ·
                   two CTAs, beside the food photo with the minimum chip
                   floating over its corner
     proof strip   four figures on CREAM (the home page runs the same strip on
                   white — that is the only difference between them)
     how it works  three numbered cards, solid tomato numerals
     what we cater six occasion cards, each jumping into the menu category that
                   serves it rather than the top of a 76-item list
     menu peek     photo beside the eight categories as counted pills
     story         photo with an "Est. 1979" tab, beside the 1979 copy
     FAQ           six questions; the three the client still owes go honey
     closing CTA   a centred card — NOT the six-card picker. The picker lives on
                   the home page; repeating it here would give one page two
                   competing primary actions.

   Every block on this page is a shared component. It was duplicated markup that
   let the store picker rot on this route while the home copy was rebuilt. */

export default function Catering() {
  const navigate = useNavigate();

  function toCategory(cat) {
    sessionStorage.setItem('mm.jumpCat', cat);
    navigate('/menu/bryant-park');
  }

  return (
    <>
      {/* ---- Opener --------------------------------------------------------- */}
      <section className="shell open" aria-labelledby="cat-head">
        <div className="open__copy">
          <p className="hero__eyebrow">{CATERING.eyebrow}</p>
          <h1 id="cat-head">
            Delicious Catering for <em>Every Occasion</em>
          </h1>
          <p className="lede">{CATERING.lede}</p>
          <div className="opencta">
            <Link className="btn btn--primary btn--lg" to="/#pick">
              Choose your store
            </Link>
            <a className="btn btn--ghost btn--lg" href="#how">
              How it works
            </a>
          </div>
        </div>

        <ArtFrame
          src={spread}
          alt="An overhead spread of Merci Market food: sandwiches, salads, fruit and pastries laid out on a table."
          width="1200"
          height="960"
          ratio="5 / 4"
          priority
          badge={<DotBadge title={CATERING.chip.title} sub={CATERING.chip.sub} />}
        />
      </section>

      <StatStrip stats={CATERING_FACTS} tone="cream" label="Merci Market catering in numbers" />

      {/* ---- How it works ---------------------------------------------------- */}
      <section className="shell section" id="how" aria-labelledby="how-head">
        <SectionHead id="how-head" title="Three steps, and you are done">
          {HOW_INTRO}
        </SectionHead>

        <ol className="steps">
          {HOW_STEPS.map((s, i) => (
            <li key={s.t} className="step">
              <span className="step__n" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
              <span className="tag">{s.tag}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- What we cater ---------------------------------------------------- */}
      <section className="shell section" aria-labelledby="occ-head">
        <SectionHead id="occ-head" title="What we cater">
          {OCCASIONS_INTRO}
        </SectionHead>

        <ul className="occs">
          {OCCASIONS.map((o) => (
            <li key={o.t}>
              <button type="button" className="oc" onClick={() => toCategory(o.cat)}>
                <h3>{o.t}</h3>
                <p>{o.d}</p>
                <span className="oc__go">
                  {o.tag}
                  <Arrow />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Menu peek --------------------------------------------------------- */}
      <section className="shell section" id="sections" aria-labelledby="sec-head">
        <div className="peek">
          <ArtFrame
            src={tray}
            alt="A catering tray of assorted Merci Market sandwiches, cut and arranged for a group."
            width="1200"
            height="825"
            ratio="16 / 11"
          />
          <div>
            <SectionHead id="sec-head" title="Eight sections, priced per person">
              {SECTIONS_INTRO}
            </SectionHead>
            <ul className="cats">
              {MENU.map((c) => (
                <li key={c.id} className="catpill">
                  {c.name} <i>{c.items.length}</i>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Story -------------------------------------------------------------- */}
      <section className="shell section" id="story" aria-labelledby="story-head">
        <div className="story">
          <ArtFrame
            src={storefront}
            alt="The Merci Market storefront on a Manhattan corner, awning out, flowers on the pavement."
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

      {/* ---- FAQ ----------------------------------------------------------------- */}
      <section className="shell section" id="faq" aria-labelledby="faq-head">
        <SectionHead id="faq-head" title="The questions people ask before they order">
          {FAQ_INTRO}
        </SectionHead>
        <Faq items={FAQ} />
      </section>

      {/* ---- Closing CTA ---------------------------------------------------------- */}
      <section className="shell section section--tight" id="pick" aria-labelledby="pickc-head">
        <div className="closecta">
          <h2 id="pickc-head">{PICK_CTA.title}</h2>
          <p>{PICK_CTA.body}</p>
          <div className="row closecta__row">
            <Link className="btn btn--primary btn--lg" to="/#pick">
              Choose your store
            </Link>
            <Link className="btn btn--ghost btn--lg" to="/menu/bryant-park">
              Browse the full menu
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
