/**
 * The TeOrganiza mark: three stacked bars settling into place, drawn in the
 * user's accent colour. Our own, deliberately simple, and pure SVG so it
 * works offline and follows the theme.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="to-logo">
      <rect width="32" height="32" rx="9" fill="var(--to-accent)" />
      <rect x="7" y="8" width="18" height="4" rx="2" fill="var(--to-on-accent)" />
      <rect x="7" y="14" width="13" height="4" rx="2" fill="var(--to-on-accent)" opacity="0.8" />
      <rect x="7" y="20" width="8" height="4" rx="2" fill="var(--to-on-accent)" opacity="0.6" />
    </svg>
  )
}
