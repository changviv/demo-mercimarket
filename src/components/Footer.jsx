import { Link } from 'react-router-dom';
import { FOOTER_COLUMNS, COPYRIGHT, MAIN_SITE } from '../data/site.js';
import { LOCATIONS } from '../data/locations.js';
import logo from '/img/logo-tomato.webp';

/* Footer.

   Columns, headings, link text and destinations are exactly the live
   mercimarketnyc.com footer. Two additions specific to this subdomain: the six
   locations (a catering visitor's most likely next question is "which one is
   near me") and a link back to the main site. Nothing from the original was
   dropped or reworded. */

export default function Footer() {
  return (
    <footer className="foot">
      <div className="shell foot__grid">
        <div className="foot__brand">
          <img src={logo} alt="Merci Market NYC" width="150" height="39" />
          <p className="foot__blurb">
            A family-owned New York deli since 1979, now catering breakfast, lunch and
            events from six Manhattan locations.
          </p>
        </div>

        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.heading} className="foot__col" aria-labelledby={`foot-${col.heading}`}>
            <h2 className="foot__head" id={`foot-${col.heading}`}>
              {col.heading}
            </h2>
            <ul className="foot__list">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="foot__link"
                    {...(l.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {l.label}
                    {l.external && <span className="visually-hidden"> (opens in a new tab)</span>}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <nav className="foot__col foot__col--wide" aria-labelledby="foot-locations">
          <h2 className="foot__head" id="foot-locations">
            Locations
          </h2>
          <ul className="foot__list foot__list--two">
            {LOCATIONS.map((l) => (
              <li key={l.id}>
                <Link to={`/menu/${l.id}`} className="foot__link">
                  {l.name}
                  <span className="foot__addr">{l.addr}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="shell foot__base">
        <p className="foot__copy">{COPYRIGHT}</p>
        <a className="foot__link foot__link--quiet" href={MAIN_SITE}>
          mercimarketnyc.com
        </a>
      </div>
    </footer>
  );
}
