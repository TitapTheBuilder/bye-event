"use client";

import { ScanFrameOverlay } from "@/components/ScanFrameOverlay";
import { recordScan } from "@/lib/offline/scan";
import { useTranslation } from "@/lib/client/language-context";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type QrScannerType from "qr-scanner";

type CameraState = "starting" | "active" | "denied" | "insecure" | "unavailable";

export default function ScanPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  const processingRef = useRef(false);
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDecoded = useCallback(
    async (rawQrToken: string) => {
      const qrToken = rawQrToken.trim();
      if (!qrToken || processingRef.current) return;

      // QR decoders can emit multiple callbacks before stop() settles. React
      // state updates are asynchronous, so use a ref as the synchronous lock.
      processingRef.current = true;
      setIsProcessing(true);
      const scanner = scannerRef.current;
      scanner?.pause(true);
      scanner?.destroy();
      if (scannerRef.current === scanner) scannerRef.current = null;

      // Write to the local outbox immediately, unconditionally -- before any
      // network call, before checking login state.
      await recordScan(qrToken);
      router.push(`/visitor/${encodeURIComponent(qrToken)}`);
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    let ownedScanner: QrScannerType | null = null;

    async function start() {
      if (!window.isSecureContext) {
        setCameraState("insecure");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState("unavailable");
        return;
      }

      // qr-scanner uses the browser's native BarcodeDetector when
      // available and transparently falls back to its JS/WASM decoder on
      // Safari/WebKit.
      const { default: QrScanner } = await import("qr-scanner");
      const video = videoRef.current;
      if (cancelled || !video) return;

      const scanner = new QrScanner(
        video,
        (result) => {
          if (!cancelled) void handleDecoded(result.data);
        },
        {
          highlightScanRegion: false,
          highlightCodeOutline: false,
          maxScansPerSecond: 10,
        },
      );

      ownedScanner = scanner;
      scannerRef.current = scanner;

      try {
        await scanner.start();
        if (cancelled) {
          scanner.pause(true);
          scanner.destroy();
          return;
        }
        setCameraState("active");
        const flashSupported = await scanner.hasFlash().catch(() => false);
        if (!cancelled) setHasFlash(flashSupported);
      } catch (err) {
        if (cancelled) return;
        scanner.destroy();
        if (scannerRef.current === scanner) scannerRef.current = null;
        const name = err instanceof Error ? err.name : "";
        setCameraState(name === "NotAllowedError" ? "denied" : "unavailable");
      }
    }

    void start();

    return () => {
      cancelled = true;
      const scanner = ownedScanner;
      ownedScanner = null;
      if (scanner) {
        scanner.pause(true);
        scanner.destroy();
        if (scannerRef.current === scanner) scannerRef.current = null;
      }

      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) {
        for (const track of stream.getTracks()) track.stop();
      }
    };
  }, [handleDecoded]);

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
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
        />
        {cameraState === "active" ? <ScanFrameOverlay /> : null}

        {cameraState === "starting" ? (
          <div className="absolute inset-0 flex items-center justify-center text-text-secondary">
            {t("scan.starting")}
          </div>
        ) : null}

        {cameraState === "denied" || cameraState === "insecure" || cameraState === "unavailable" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-0 px-8 text-center">
            <p className="text-text-primary">
              {cameraState === "denied"
                ? t("scan.denied")
                : cameraState === "insecure"
                  ? t("scan.httpsRequired")
                  : t("scan.unavailable")}
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
          {t("scan.cancel")}
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
            {t("scan.torch")}
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
          placeholder={t("scan.manualPlaceholder")}
          className="flex-1 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={isProcessing || manualToken.trim().length === 0}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--brand-gradient)" }}
        >
          {t("scan.go")}
        </button>
      </form>
    </div>
  );
}
