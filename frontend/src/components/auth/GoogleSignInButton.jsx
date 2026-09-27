import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../store/authStore";

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

export default function GoogleSignInButton() {
  const { loginWithGoogle } = useAuth();
  const buttonRef = useRef(null);
  const [error, setError] = useState("");
  const [buttonReady, setButtonReady] = useState(false);
  const [status, setStatus] = useState("");
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;

    let cancelled = false;
    const renderButton = () => {
      if (cancelled || !buttonRef.current) return;
      if (!window.google?.accounts?.id) {
        setError("Google sign-in did not initialize. Check the client ID and allowed site origin.");
        return;
      }
      const availableWidth = buttonRef.current.getBoundingClientRect().width || Math.min(window.innerWidth - 48, 360);
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            try {
              setError("");
              setStatus("Verifying your Google account…");
              await loginWithGoogle(credential);
            } catch (err) {
              setError(err.message || "Google sign-in failed.");
              setStatus("");
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: Math.max(120, Math.min(Math.floor(availableWidth), 360)),
          click_listener: () => setStatus("Opening Google sign-in…"),
        });
        setButtonReady(true);
      } catch {
        setError("Google sign-in could not be displayed. Check the client ID and allowed site origin.");
      }
    };

    const loadedScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`);
    if (window.google?.accounts?.id) {
      renderButton();
    } else if (loadedScript) {
      loadedScript.addEventListener("load", renderButton, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = renderButton;
      script.onerror = () => setError("Google sign-in could not load. Please try again.");
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [clientId, loginWithGoogle]);

  return (
    <div className="auth-google-wrap">
      <div className="auth-divider"><span>or</span></div>
      <p className="auth-google-label">Continue with Google</p>
      {clientId ? (
        <>
          <div className="auth-google-button" ref={buttonRef} />
          {!buttonReady && !error && <p className="auth-google-status">Loading Google sign-in…</p>}
          {status && <p className="auth-google-status" role="status">{status}</p>}
        </>
      ) : (
        <p className="auth-google-status">Add `VITE_GOOGLE_CLIENT_ID` to `frontend/.env.local` to enable Google sign-in.</p>
      )}
      {error && <p className="auth-google-error" role="alert">{error}</p>}
    </div>
  );
}
