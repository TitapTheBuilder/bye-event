export function ScanFrameOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-8" aria-hidden>
      <div className="scan-frame">
        <div className="scan-frame__corner scan-frame__corner--tl" />
        <div className="scan-frame__corner scan-frame__corner--tr" />
        <div className="scan-frame__corner scan-frame__corner--bl" />
        <div className="scan-frame__corner scan-frame__corner--br" />
        <div className="scan-frame__line" />
      </div>
    </div>
  );
}
