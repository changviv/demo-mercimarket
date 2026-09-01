/* A photo in a rounded frame with something floating over its bottom-left
   corner.

   Three places use this shape: the hero's "Three stores open 24 hours" card,
   the catering opener's "Eight-person minimum" chip, and the story block's
   "Est. 1979" badge. The frame and the overlap are identical; only what floats
   differs, so that is the prop. */

export default function ArtFrame({ src, alt, width, height, ratio, priority, badge, className }) {
  return (
    <div className={`art${className ? ` ${className}` : ''}`}>
      <div className="art__frame" style={ratio ? { '--art-ratio': ratio } : undefined}>
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          {...(priority ? { fetchPriority: 'high' } : { loading: 'lazy' })}
        />
      </div>
      {badge}
    </div>
  );
}

/** The white card with a green dot — hero and catering opener. */
export function DotBadge({ title, sub }) {
  return (
    <p className="floater">
      <span className="floater__dot" aria-hidden="true" />
      <span>
        <b>{title}</b>
        <i>{sub}</i>
      </span>
    </p>
  );
}

/** The solid honey tab — the story block. */
export function SinceBadge({ children }) {
  return <span className="since">{children}</span>;
}
