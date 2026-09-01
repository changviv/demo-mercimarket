import { useNavigate } from 'react-router-dom';
import { LOCATIONS, locationStatus } from '../data/locations.js';
import { useOrder } from '../state/OrderContext.jsx';

/* Section 2 — the location picker.

   This is the hero, not a decoration under one. Every price, every lead time
   and every stock answer on this site is per-kitchen, so nothing downstream can
   be honest until this is answered. Making it the first thing on the page also
   removes the live site's worst friction: eighteen "Visit Location" buttons
   that all pointed at `#`. */

export default function LocationPicker({ id = 'pick' }) {
  const { order, dispatch } = useOrder();
  const navigate = useNavigate();

  function choose(loc) {
    dispatch({ type: 'setLocation', id: loc.id });
    navigate(`/menu/${loc.id}`);
  }

  return (
    <section className="picker" id={id} aria-labelledby="pick-head">
      <div className="shell">
        <div className="picker__head">
          <h2 id="pick-head">Which kitchen is catering for you?</h2>
          <p className="picker__note">
            Prices, availability and pickup times are set per location. Pick the one
            nearest your event.
          </p>
        </div>

        <ul className="picker__grid grid">
          {LOCATIONS.map((loc) => {
            const st = locationStatus(loc);
            const active = order.locationId === loc.id;
            return (
              <li key={loc.id}>
                <button
                  type="button"
                  className={`loc${active ? ' loc--active' : ''}`}
                  onClick={() => choose(loc)}
                  aria-current={active ? 'true' : undefined}
                >
                  <span className="loc__body">
                    <span className="loc__name">{loc.name}</span>
                    <span className="loc__addr">{loc.addr}</span>
                    <span className="loc__addr loc__addr--dim">{loc.city}</span>
                  </span>
                  <span className="loc__foot">
                    <span className={`pill ${st.open ? 'pill--open' : 'pill--shut'}`}>
                      {st.label}
                    </span>
                    <span className="loc__go" aria-hidden="true">
                      See menu →
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
