import { Plus } from './Icons.jsx';

/* The FAQ list.

   Native <details>/<summary> rather than a button-and-state accordion: the
   browser already gives it the right role, the right keyboard behaviour and
   find-in-page that can open a closed answer. Reimplementing that in React buys
   nothing and loses the last one.

   `pending: true` marks a question the client still owes an answer to. Those
   rows go honey and carry a "Needs an answer" pill — the flag is the point, so
   it is part of the data rather than a note someone has to remember. */

export default function Faq({ items }) {
  return (
    <div className="faq">
      {items.map((f) => (
        <details key={f.q} className={`q${f.pending ? ' q--tbd' : ''}`}>
          <summary>
            {f.pending && <span className="q__pill">Needs an answer</span>}
            {f.q}
            <span className="q__ic">
              <Plus />
            </span>
          </summary>
          <div className="q__a">
            <p>{f.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
