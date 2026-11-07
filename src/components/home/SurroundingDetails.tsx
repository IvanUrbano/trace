/** Decorative wayfinding marks: never controls or claims about live activity. */
export function SurroundingDetails({ variant }: { variant: 'hero' | 'process' | 'matching' }) {
  return (
    <div aria-hidden="true" className={`surrounding-details surrounding-details--${variant}`}>
      <svg className="surrounding-orbit" viewBox="0 0 320 320" fill="none">
        <circle cx="160" cy="160" r="142" />
        <circle cx="160" cy="160" r="110" strokeDasharray="2 10" />
        <path d="M0 160h44m232 0h44M160 0v44m0 232v44" />
        <circle cx="260" cy="60" r="5" fill="currentColor" stroke="none" />
      </svg>
      <svg className="surrounding-trail" viewBox="0 0 260 170" fill="none">
        <path d="M25 130C100 145 54 25 130 45S182 137 230 39" strokeDasharray="3 7" />
        <circle cx="25" cy="130" r="5" />
        <path d="m224 43 7-10 4 12" />
        <g transform="translate(111 13) rotate(-16)">
          <path d="M0 8 10 0h25v29H0Z" fill="#E7EAF3" />
          <circle cx="9" cy="9" r="2" />
          <path d="M17 12h11m-17 7h17" />
        </g>
      </svg>
      <div className="surrounding-rail"><span>SEARCH</span><i /><span>CONNECT</span><i /><span>RETURN</span></div>
      <span className="surrounding-cross surrounding-cross--one">+</span>
      <span className="surrounding-cross surrounding-cross--two">+</span>
    </div>
  )
}
