"use client";

import { ScanFrameOverlay } from "@/components/ScanFrameOverlay";
import { recordScan } from "@/lib/offline/scan";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type QrScannerType from "qr-scanner";

type CameraState = "starting" | "active" | "denied" | "unavailable";

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!videoRef.current) return;

      // qr-scanner uses the browser's native BarcodeDetector when
      // available and TRANSPARENTLY falls back to its own JS/WASM (jsQR)
      // decoder otherwise -- this is exactly the progressive-enhancement
      // contract required for iOS Safari, where BarcodeDetector doesn't
      // exist, without us ever hand-picking a path that could bit-rot.
      const { default: QrScanner } = await import("qr-scanner");

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          if (cancelled) return;
          void handleDecoded(result.data);
        },
        {
          highlightScanRegion: false,
          highlightCodeOutline: false,
          maxScansPerSecond: 10,
        },
      );

      scannerRef.current = scanner;

      try {
        await scanner.start();
        if (cancelled) return;
        setCameraState("active");
        const flashSupported = await scanner.hasFlash().catch(() => false);
        if (!cancelled) setHasFlash(flashSupported);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        setCameraState(name === "NotAllowedError" ? "denied" : "unavailable");
      }
    }

    void start();

    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDecoded(qrToken: string) {
    if (isProcessing) return;
    setIsProcessing(true);
    scannerRef.current?.stop();
    // Write to the local outbox immediately, unconditionally -- before any
    // network call, before checking login state.
    await recordScan(qrToken);
    router.push(`/visitor/${encodeURIComponent(qrToken)}`);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = manualToken.trim();
    if (!token) return;
    await handleDecoded(token);
  }

  async function toggleFlash() {
    if (!scannerRef.current) return;
    await scannerRef.current.toggleFlash();
    setFlashOn(scannerRef.current.isFlashOn());
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem-5rem)] flex-col bg-surface-0">
      <div className="relative flex-1 overflow-hidden bg-black">
        {/* biome-ignore lint/a11y/useMediaCaption: live camera feed, not prerecorded media */}
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
        />
        {cameraState === "active" ? <ScanFrameOverlay /> : null}

        {cameraState === "starting" ? (
          <div className="absolute inset-0 flex items-center justify-center text-text-secondary">
            Starting camera…
          </div>
        ) : null}

        {cameraState === "denied" || cameraState === "unavailable" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-0 px-8 text-center">
            <p className="text-text-primary">
              {cameraState === "denied"
                ? "Camera access was denied. Allow camera access, or enter a badge code manually below."
                : "No camera available. Enter a badge code manually below."}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-full border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-primary"
        >
          Cancel
        </button>
        {hasFlash ? (
          <button
            type="button"
            onClick={toggleFlash}
            aria-pressed={flashOn}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium ${
              flashOn
                ? "border-brand-accent text-brand-accent"
                : "border-border-subtle text-text-primary"
            }`}
          >
            Torch
          </button>
        ) : null}
      </div>

      <form
        onSubmit={handleManualSubmit}
        className="flex items-center gap-2 border-t border-border-subtle px-6 py-4"
      >
        <input
          value={manualToken}
          onChange={(e) => setManualToken(e.target.value)}
          placeholder="Damaged badge? Enter the printed code"
          className="flex-1 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={isProcessing || manualToken.trim().length === 0}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--brand-gradient)" }}
        >
          Go
        </button>
      </form>
    </div>
  );
}
