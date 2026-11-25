/**
 * The home cover: a quiet landscape drawn in SVG and tinted by the accent
 * colour. Our own artwork, no image files, so it works offline, weighs
 * nothing and follows the theme (stars and moon in dark, sun in light).
 */
const STARS = [
  [70, 40, 1.2], [160, 90, 0.8], [240, 30, 1], [330, 70, 0.7], [420, 25, 1.1],
  [520, 60, 0.8], [610, 35, 1], [700, 85, 0.7], [790, 45, 1.2], [880, 20, 0.8],
  [960, 75, 1], [1050, 40, 0.7], [1130, 95, 0.9], [1180, 30, 1.1], [300, 120, 0.6],
  [560, 110, 0.7], [820, 120, 0.6], [1000, 130, 0.7],
] as const

export function Cover() {
  return (
    <svg
      className="to-cover"
      viewBox="0 0 1200 320"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="to-cover-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--to-cover-sky-top)" />
          <stop offset="100%" stopColor="var(--to-cover-sky-bottom)" />
        </linearGradient>
        <radialGradient id="to-cover-glow" cx="0.78" cy="0.28" r="0.35">
          <stop offset="0%" stopColor="var(--to-cover-glow)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--to-cover-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1200" height="320" fill="url(#to-cover-sky)" />
      <rect width="1200" height="320" fill="url(#to-cover-glow)" />

      <g className="to-cover__stars">
        {STARS.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
      <circle className="to-cover__orb" cx="935" cy="88" r="26" />

      <path
        d="M0 210 C 140 170 260 190 380 175 S 640 140 780 170 S 1040 150 1200 180 V320 H0 Z"
        fill="var(--to-cover-far)"
      />
      <path
        d="M0 245 C 160 215 300 235 460 220 S 760 200 900 225 S 1100 215 1200 230 V320 H0 Z"
        fill="var(--to-cover-mid)"
      />
      <path
        d="M0 285 C 200 262 380 280 560 270 S 900 255 1200 275 V320 H0 Z"
        fill="var(--to-cover-near)"
      />
    </svg>
  )
}
