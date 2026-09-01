import { Link } from 'react-router-dom';
import { LOCATIONS } from '../data/locations.js';

export default function NotFound() {
  return (
    <div className="shell section">
      <div className="empty card card--pad">
        <p className="eyebrow">404</p>
        <h1>That page is not here</h1>
        <p>
          It may have moved, or the link may be old. Everything on this site starts from a
          location, so pick one and you are back in the flow.
        </p>
        <ul className="nf__list">
          {LOCATIONS.map((l) => (
            <li key={l.id}>
              <Link to={`/menu/${l.id}`} className="btn btn--ghost">
                {l.name}
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/" className="btn btn--primary">
          Back to catering home
        </Link>
      </div>
    </div>
  );
}
