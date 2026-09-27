
import { useState } from "react";
import { useAuth } from "../../store/authStore";
import GoogleSignInButton from "./GoogleSignInButton";

export default function RegisterForm({ onSwitchToLogin }) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password, fullName);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form mx-auto w-full max-w-sm space-y-4">
      <h2 className="auth-heading">Create your account</h2>
      <p className="auth-intro">Build a better picture of what you eat, one meal at a time.</p>

      <div>
          <label className="auth-label mb-1 block text-sm font-medium">Full name</label>
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
          className="auth-input w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
      </div>

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
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="auth-input w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
        <p className="auth-help mt-1 text-xs">At least 8 characters.</p>
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
        {submitting ? "Creating account..." : "Create account"}
      </button>

      <GoogleSignInButton />

      <p className="auth-switch text-center text-sm">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold hover:underline"
        >
          Log in
        </button>
      </p>
    </form>
  );
}
