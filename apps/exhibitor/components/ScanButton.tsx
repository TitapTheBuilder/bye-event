import Link from "next/link";

/**
 * The app's signature visual moment: a big circular Scan button with the
 * brand gradient as a glow behind it (accent, not wallpaper) and the same
 * corner-bracket motif language echoed in its idle pulse.
 */
export function ScanButton() {
  return (
    <Link
      href="/scan"
      aria-label="Scan a badge"
      className="brand-glow scan-pulse relative flex h-48 w-48 items-center justify-center rounded-full text-white shadow-2xl transition-transform active:scale-95"
      style={{ background: "var(--brand-gradient)" }}
    >
      <svg width="72" height="72" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <rect x="7" y="7" width="4" height="4" rx="0.5" fill="white" />
        <rect x="13" y="7" width="4" height="4" rx="0.5" fill="white" />
        <rect x="7" y="13" width="4" height="4" rx="0.5" fill="white" />
        <path d="M14 14h2v2h-2zM17 14h2v2h-2zM14 17h2v2h-2zM17 17h2v2h-2z" fill="white" />
      </svg>
      <span className="sr-only">Scan</span>
    </Link>
  );
}
