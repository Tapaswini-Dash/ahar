
// frontend/src/components/packaged-food/BarcodeScanner.jsx
import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function BarcodeScanner({ onDetected, onClose }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5Qrcode("barcode-reader");
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          onDetected(decodedText);
          scanner.stop();
        }
      )
      .catch(() => {});
    return () => { scanner.stop().catch(() => {}); };
  }, [onDetected]);

  return (
    <div className="rounded-2xl bg-black p-4">
      <div id="barcode-reader" style={{ width: "100%" }} />
      <button type="button" className="mt-3 w-full rounded-xl bg-slate-700 py-2 text-white" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}