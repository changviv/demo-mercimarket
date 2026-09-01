import { Link } from 'react-router-dom';
import { LOCATIONS } from '../data/locations.js';
import EmptyState from '../components/EmptyState.jsx';

export default function NotFound() {
  return (
    <div className="shell section">
      <EmptyState
        eyebrow="404"
        title="That page is not here"
        action={
          <Link to="/" className="btn btn--primary">
            Back to catering home
          </Link>
        }
      >
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
      </EmptyState>
    </div>
  );
}
