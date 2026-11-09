/** Minimal note: accent dot (note head) + stem ending in a curved stroke (flag / sound wave). */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="8" cy="17" r="3.2" fill="var(--accent)" />
      <path
        d="M11.2 17V5.5c0 0 2.6.2 4.6 2.4s4.2 2 4.2 2"
        fill="none"
        stroke="var(--text)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <LogoMark />
      <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: 0.2 }}>musicfree</span>
    </span>
  );
}
