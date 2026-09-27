
import { useState } from "react";
import { useAuth } from "../../store/authStore";
import GoogleSignInButton from "./GoogleSignInButton";

export default function LoginForm({ onSwitchToRegister }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form mx-auto w-full max-w-sm space-y-4">
      <h2 className="auth-heading">Sign in to Ahar</h2>
      <p className="auth-intro">Pick up where you left off and keep your food goals in view.</p>

      <div>
          <label className="auth-label mb-1 block text-sm font-medium">Email address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="auth-input w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
      </div>

      <div>
          <label className="auth-label mb-1 block text-sm font-medium">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          className="auth-input w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="auth-submit w-full rounded-xl px-5 py-2.5 font-semibold transition disabled:opacity-50"
      >
        {submitting ? "Logging in..." : "Log in"}
      </button>

      <GoogleSignInButton />

      <p className="auth-switch text-center text-sm">
        No account?{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-semibold hover:underline"
        >
          Register
        </button>
      </p>
    </form>
  );
}
