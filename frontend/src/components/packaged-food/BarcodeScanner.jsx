import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

export default function BarcodeScanner({ onDetected, onClose }) {
  const scannerRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const [error, setError] = useState("");
  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode("barcode-reader", {
      formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E],
    });
    scannerRef.current = scanner;
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 280, height: 140 } }, async (value) => {
      if (cancelled) return;
      cancelled = true;
      onDetectedRef.current(value);
      try { await scanner.stop(); } catch { /* camera may already be closing */ }
    }).catch(() => {
      if (!cancelled) setError("Camera could not start. Allow camera access or type the barcode number above.");
    });
    return () => {
      cancelled = true;
      if (scanner.isScanning) scanner.stop().catch(() => {});
    };
  }, []);

  return <div className="barcode-scanner">{error ? <p role="alert">{error}</p> : <div id="barcode-reader" />}<button type="button" className="dashboard-text-button" onClick={onClose}>Close scanner</button></div>;
}



