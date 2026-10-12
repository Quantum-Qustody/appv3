// Q² mark and lockups. Geometry is identical to /public/brand/*.svg.
// Colour comes from `currentColor`, so the mark follows the surrounding theme.

const Ring = () => (
  <>
    <circle cx="26" cy="27" r="17" fill="none" stroke="currentColor" strokeWidth="7" />
    <rect x="26" y="42" width="25" height="5.5" fill="currentColor" />
    <circle cx="51.5" cy="44.75" r="6.5" fill="currentColor" />
  </>
);
const Two = () => (
  <path d="M50.3 9.6a4.4 4.4 0 1 1 7.8 2.8L50.3 19.8h9" fill="none" stroke="currentColor" strokeWidth="3.2" />
);

/** The mark. Below 24 px the superscript is dropped, as in the favicon. */
export function Mark({ size = 32, title, className = "", style }) {
  const small = size < 24;
  return (
    <svg
      viewBox={small ? "2 2 62 62" : "0 0 64 64"}
      width={size}
      height={size}
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <Ring />
      {!small && <Two />}
    </svg>
  );
}

/** Horizontal lockup: mark + wordmark. */
export function Lockup({ size = 28, className = "", wordClass = "", label = "Q Squared" }) {
  return (
    <span className={`q-lockup ${className}`} aria-label={label} role="img">
      <Mark size={size} />
      <span className={`q-lockup__word ${wordClass}`} aria-hidden="true">Q Squared</span>
    </span>
  );
}
