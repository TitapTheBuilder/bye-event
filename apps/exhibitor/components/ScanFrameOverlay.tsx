export function ScanFrameOverlay() {
  return (
    <div className="scan-frame pointer-events-none absolute inset-8 sm:inset-16" aria-hidden>
      <div className="scan-frame__corner scan-frame__corner--tl" />
      <div className="scan-frame__corner scan-frame__corner--tr" />
      <div className="scan-frame__corner scan-frame__corner--bl" />
      <div className="scan-frame__corner scan-frame__corner--br" />
      <div className="scan-frame__line" />
    </div>
  );
}
