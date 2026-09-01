import { LOCATIONS, locationStatus } from '../data/locations.js';
import { MINIMUM_GUESTS } from '../data/site.js';
import { Clock, Arrow } from './Icons.jsx';

/* The six-store picker, built to the approved hero artifact (37aef8e5).

   ONE component, used by both the home page and the catering page. It exists
   because those two had duplicated markup: when the card was restyled for the
   artifact only the home copy was updated, and the catering page silently kept
   rendering against class names that no longer existed — the status pill
   stretched into a full-width green band, "Today" ran into the hours, and the
   clock and arrow icons vanished. Shared markup makes that failure impossible.

   Card anatomy, per the artifact:
     .loc          white, 1.5px rule, no padding of its own
       .loc__top   pill · name · address · hours    (22px 22px 18px)
       .loc__foot  CTA + arrow  ·  minimum          (sunken strip, top rule) */

export default function StorePicker({
  id = 'pick',
  title,
  note,
  cta = 'Order Catering',
  showMin = true,
  onChoose,
  headingId = 'pick-head',
  children,
}) {
  return (
    <section className="picker" id={id} aria-labelledby={headingId}>
      <div className="shell">
        <div className="picker__head">
          <h2 id={headingId}>{title}</h2>
          <p>{note}</p>
        </div>

        <ul className="picker__grid">
          {LOCATIONS.map((loc) => {
            const st = locationStatus(loc);
            return (
              <li key={loc.id}>
                <button type="button" className="loc" onClick={() => onChoose(loc)}>
                  <span className="loc__top">
                    <span className={`pill ${st.open ? 'pill--open' : 'pill--shut'}`}>
                      <span className="pill__dot" aria-hidden="true" />
                      {st.label}
                    </span>
                    <span className="loc__name">{loc.name}</span>
                    <span className="loc__addr">
                      {loc.addr}
                      <br />
                      {loc.city}
                    </span>
                    <span className="loc__hours">
                      <Clock />
                      <span>Today&nbsp;&nbsp;{st.today}</span>
                    </span>
                  </span>

                  <span className="loc__foot">
                    <span className="loc__cta">
                      {cta}
                      <Arrow />
                    </span>
                    {showMin && <span className="loc__min">Min {MINIMUM_GUESTS} people</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {children}
      </div>
    </section>
  );
}
