"use client";

import { ScanFrameOverlay } from "@/components/ScanFrameOverlay";
import { recordScan } from "@/lib/offline/scan";
import { useTranslation } from "@/lib/client/language-context";
import jsQR from "jsqr";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type CameraState = "starting" | "active" | "denied" | "insecure" | "unavailable";

export default function ScanPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const processingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const logMessage = useCallback((msg: string) => {
    console.log(`[QR Scanner ${new Date().toLocaleTimeString()}]`, msg);
  }, []);

  const handleDecoded = useCallback(
    async (rawQrToken: string) => {
      let qrToken = rawQrToken.trim();
      if (!qrToken || processingRef.current) return;

      // Normalize token if a full URL was encoded
      if (qrToken.includes("/")) {
        const segments = qrToken.split("/").filter(Boolean);
        const last = segments[segments.length - 1];
        if (last && (last.length === 32 || /^\d{6}$/.test(last))) {
          qrToken = last;
        }
      }

      processingRef.current = true;
      logMessage(`Decoded token: ${qrToken}`);

      // Haptic confirmation
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate(50);
        } catch {}
      }

      // Stop camera stream tracks
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }

      try {
        await recordScan(qrToken);
        router.push(`/visitor/${encodeURIComponent(qrToken)}`);
      } catch (err) {
        logMessage(`recordScan error (proceeding to navigate): ${String(err)}`);
        router.push(`/visitor/${encodeURIComponent(qrToken)}`);
      }
    },
    [router, logMessage],
  );

  useEffect(() => {
    let cancelled = false;
    let animFrameId: number | null = null;
    let barcodeDetector: {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
    } | null = null;

    async function startCamera() {
      logMessage("Starting camera initialization...");

      if (!window.isSecureContext) {
        logMessage("Error: Context is not secure (requires HTTPS or localhost)");
        setCameraState("insecure");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        logMessage("Error: navigator.mediaDevices.getUserMedia is unavailable");
        setCameraState("unavailable");
        return;
      }

      // 1. Initialize BarcodeDetector if available
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          const detectorClass = (window as unknown as {
            BarcodeDetector: {
              new (options: { formats: string[] }): {
                detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
              };
              getSupportedFormats?: () => Promise<string[]>;
            };
          }).BarcodeDetector;

          const supported = (await detectorClass.getSupportedFormats?.()) || [];
          if (supported.length === 0 || supported.includes("qr_code")) {
            barcodeDetector = new detectorClass({ formats: ["qr_code"] });
            logMessage("BarcodeDetector initialized successfully (Hardware engine)");
          } else {
            logMessage("BarcodeDetector does not support qr_code format, using jsQR");
          }
        } catch (e) {
          logMessage(`BarcodeDetector init error: ${String(e)}, using jsQR`);
        }
      } else {
        logMessage("Native BarcodeDetector not in window, using jsQR");
      }

      // 2. Request Camera Stream with fallback hierarchy
      let stream: MediaStream | null = null;
      const constraintsList: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        {
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
      ];

      for (let i = 0; i < constraintsList.length; i++) {
        try {
          logMessage(`Requesting camera stream (tier ${i + 1})...`);
          stream = await navigator.mediaDevices.getUserMedia(constraintsList[i]);
          if (stream) break;
        } catch (err) {
          logMessage(`Tier ${i + 1} stream request failed: ${String(err)}`);
        }
      }

      if (cancelled) {
        if (stream) {
          for (const track of stream.getTracks()) track.stop();
        }
        return;
      }

      if (!stream) {
        logMessage("Failed to obtain any camera stream");
        setCameraState("unavailable");
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;

      // Check flash / torch capability & autofocus
      const [track] = stream.getVideoTracks();
      if (track) {
        const capabilities = (track.getCapabilities?.() ?? {}) as {
          torch?: boolean;
          focusMode?: string[];
        };
        if (capabilities.torch) {
          setHasFlash(true);
        }
        if (capabilities.focusMode?.includes("continuous")) {
          void track
            .applyConstraints({
              advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
            })
            .catch(() => {});
        }
      }

      try {
        await video.play();
        setCameraState("active");
        logMessage(`Camera playing: ${video.videoWidth}x${video.videoHeight}`);
      } catch (err) {
        logMessage(`video.play() failed: ${String(err)}`);
        setCameraState("unavailable");
        return;
      }

      // 3. Main Scanning Render Loop
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        logMessage("Failed to get 2D canvas context");
        return;
      }

      let lastScanTime = performance.now();

      const scanLoop = async () => {
        if (cancelled || processingRef.current) return;

        const now = performance.now();

        // Throttle decoding to ~16 FPS (60ms intervals) to keep device cool & smooth
        if (now - lastScanTime >= 60 && video.readyState >= 2 && video.videoWidth > 0) {
          lastScanTime = now;

          const vw = video.videoWidth;
          const vh = video.videoHeight;

          // Downscale high-resolution cameras (e.g. 4K) to max 800px for optimal speed & zero aliasing
          const maxDim = 800;
          const scale = Math.min(1, maxDim / Math.max(vw, vh));
          const cw = Math.max(1, Math.round(vw * scale));
          const ch = Math.max(1, Math.round(vh * scale));

          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
          }

          ctx.drawImage(video, 0, 0, cw, ch);

          let detected = false;

          // Attempt 1: Native BarcodeDetector (Hardware)
          if (barcodeDetector) {
            try {
              const barcodes = await barcodeDetector.detect(canvas);
              if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
                detected = true;
                logMessage(`[BarcodeDetector] Scanned code: ${barcodes[0].rawValue}`);
                void handleDecoded(barcodes[0].rawValue);
                return;
              }
            } catch {
              // Ignore and gracefully fall back to jsQR
            }
          }

          // Attempt 2: jsQR Fallback Engine (Runs on all browsers & platforms)
          if (!detected) {
            try {
              const imageData = ctx.getImageData(0, 0, cw, ch);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth",
              });
              if (code && code.data) {
                logMessage(`[jsQR] Scanned code: ${code.data}`);
                void handleDecoded(code.data);
                return;
              }
            } catch (err) {
              logMessage(`[jsQR Exception] ${String(err)}`);
            }
          }
        }

        if (!cancelled && !processingRef.current) {
          animFrameId = requestAnimationFrame(scanLoop);
        }
      };

      animFrameId = requestAnimationFrame(scanLoop);
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
    };
  }, [handleDecoded, logMessage]);

  async function toggleFlash() {
    if (!streamRef.current) return;
    const [track] = streamRef.current.getVideoTracks();
    if (!track) return;
    const next = !flashOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setFlashOn(next);
      logMessage(`Torch toggled: ${next}`);
    } catch (err) {
      logMessage(`Failed to toggle torch: ${String(err)}`);
    }
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem-5rem)] flex-col bg-surface-0">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          autoPlay
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
    </div>
  );
}
