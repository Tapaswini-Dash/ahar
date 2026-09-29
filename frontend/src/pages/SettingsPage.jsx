
import { useEffect, useState } from "react";
import { useAuth } from "../store/authStore";
import { getProfile, saveProfile } from "../api/onboardingApi";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: "☺" },
  { id: "body", label: "Body", icon: "◐" },
  { id: "goals", label: "Goals", icon: "◎" },
  { id: "diet", label: "Diet", icon: "◇" },
  { id: "account", label: "Account", icon: "⏻" },
];

export default function SettingsPage() {
  const { token, user, logout } = useAuth();
  const [active, setActive] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    getProfile(token)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setForm({
          full_name: data.full_name || user?.full_name || "",
          age: data.age ?? "",
          sex: data.sex ?? "",
          height_cm: data.height_cm ?? "",
          weight_kg: data.weight_kg ?? "",
          goal_weight_kg: data.goal_weight_kg ?? "",
          activity_level: data.activity_level ?? "",
          goal: data.goal ?? "",
          daily_calorie_target: data.daily_calorie_target ?? "",
          daily_protein_target_g: data.daily_protein_target_g ?? "",
          daily_carbs_target_g: data.daily_carbs_target_g ?? "",
          daily_fat_target_g: data.daily_fat_target_g ?? "",
          diet_preference: data.diet_preference ?? "",
          allergies_and_restrictions: data.allergies_and_restrictions ?? "",
        });
      })
      .catch((err) => !cancelled && setError(err.message || "Could not load profile."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [token, user]);

  function update(field, value) {
    setForm((cur) => ({ ...cur, [field]: value }));
    setSuccess("");
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        full_name: form.full_name || undefined,
        age: form.age === "" ? undefined : Number(form.age),
        sex: form.sex || undefined,
        height_cm: form.height_cm === "" ? undefined : Number(form.height_cm),
        weight_kg: form.weight_kg === "" ? undefined : Number(form.weight_kg),
        goal_weight_kg: form.goal_weight_kg === "" ? null : Number(form.goal_weight_kg),
        activity_level: form.activity_level || undefined,
        goal: form.goal || undefined,
        daily_calorie_target: form.daily_calorie_target === "" ? undefined : Number(form.daily_calorie_target),
        daily_protein_target_g: form.daily_protein_target_g === "" ? undefined : Number(form.daily_protein_target_g),
        daily_carbs_target_g: form.daily_carbs_target_g === "" ? undefined : Number(form.daily_carbs_target_g),
        daily_fat_target_g: form.daily_fat_target_g === "" ? undefined : Number(form.daily_fat_target_g),
        diet_preference: form.diet_preference || undefined,
        allergies_and_restrictions: form.allergies_and_restrictions?.trim() || null,
      };
      const updated = await saveProfile(payload, token);
      setProfile(updated);
      setSuccess("Changes saved.");
    } catch (err) {
      setError(err.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="settings-page">
        <p className="settings-loading">Loading your settings…</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <p className="dashboard-overline">Account</p>
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">
          Manage your profile, goals, and preferences.
        </p>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`settings-nav-item${active === s.id ? " is-active" : ""}`}
              onClick={() => { setActive(s.id); setSuccess(""); setError(""); }}
            >
              <span className="settings-nav-icon" aria-hidden="true">{s.icon}</span>
              <span className="settings-nav-label">{s.label}</span>
            </button>
          ))}
        </nav>

        <form className="settings-panel" onSubmit={handleSave}>
          {active === "profile" && (
            <>
              <h2 className="settings-panel-title">Profile</h2>
              <label className="field">
                <span className="field-label">Full name</span>
                <input
                  className="field-input"
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Email</span>
                <input className="field-input" value={user?.email || profile?.email || ""} readOnly />
              </label>
            </>
          )}

          {active === "body" && (
            <>
              <h2 className="settings-panel-title">Body</h2>
              <div className="settings-grid">
                <label className="field">
                  <span className="field-label">Age</span>
                  <input className="field-input" type="number" min="10" max="100"
                    value={form.age} onChange={(e) => update("age", e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Sex</span>
                  <select className="field-input" value={form.sex} onChange={(e) => update("sex", e.target.value)}>
                    <option value="">—</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Height (cm)</span>
                  <input className="field-input" type="number" step="0.1"
                    value={form.height_cm} onChange={(e) => update("height_cm", e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Weight (kg)</span>
                  <input className="field-input" type="number" step="0.1"
                    value={form.weight_kg} onChange={(e) => update("weight_kg", e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Goal weight (kg)</span>
                  <input className="field-input" type="number" step="0.1"
                    value={form.goal_weight_kg} onChange={(e) => update("goal_weight_kg", e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Activity level</span>
                  <select className="field-input" value={form.activity_level}
                    onChange={(e) => update("activity_level", e.target.value)}>
                    <option value="">—</option>
                    <option value="sedentary">Sedentary</option>
                    <option value="light">Lightly active</option>
                    <option value="moderate">Moderately active</option>
                    <option value="active">Very active</option>
                    <option value="very_active">Extra active</option>
                  </select>
                </label>
              </div>
            </>
          )}

          {active === "goals" && (
            <>
              <h2 className="settings-panel-title">Daily goals</h2>
              <label className="field">
                <span className="field-label">Primary goal</span>
                <select className="field-input" value={form.goal} onChange={(e) => update("goal", e.target.value)}>
                  <option value="">—</option>
                  <option value="lose_weight">Lose weight</option>
                  <option value="maintain">Maintain weight</option>
                  <option value="gain_weight">Gain weight</option>
                  <option value="build_muscle">Build muscle</option>
                </select>
              </label>
              <div className="settings-grid">
                <label className="field">
                  <span className="field-label">Calories (kcal)</span>
                  <input className="field-input" type="number"
                    value={form.daily_calorie_target}
                    onChange={(e) => update("daily_calorie_target", e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Protein (g)</span>
                  <input className="field-input" type="number"
                    value={form.daily_protein_target_g}
                    onChange={(e) => update("daily_protein_target_g", e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Carbs (g)</span>
                  <input className="field-input" type="number"
                    value={form.daily_carbs_target_g}
                    onChange={(e) => update("daily_carbs_target_g", e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Fat (g)</span>
                  <input className="field-input" type="number"
                    value={form.daily_fat_target_g}
                    onChange={(e) => update("daily_fat_target_g", e.target.value)} />
                </label>
              </div>
            </>
          )}

          {active === "diet" && (
            <>
              <h2 className="settings-panel-title">Diet</h2>
              <label className="field">
                <span className="field-label">Preference</span>
                <select className="field-input" value={form.diet_preference}
                  onChange={(e) => update("diet_preference", e.target.value)}>
                  <option value="">—</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="eggetarian">Eggetarian</option>
                  <option value="non_vegetarian">Non-vegetarian</option>
                  <option value="vegan">Vegan</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Allergies & restrictions</span>
                <textarea className="field-input" rows="3"
                  value={form.allergies_and_restrictions}
                  onChange={(e) => update("allergies_and_restrictions", e.target.value)}
                  placeholder="e.g. peanuts, lactose" />
              </label>
            </>
          )}

          {active === "account" && (
            <>
              <h2 className="settings-panel-title">Account</h2>
              <div className="settings-account">
                <div className="settings-account-row">
                  <div>
                    <p className="settings-account-label">Email</p>
                    <p className="settings-account-value">
                      {user?.email || profile?.email || "—"}
                    </p>
                  </div>
                </div>
                <div className="settings-account-row">
                  <div>
                    <p className="settings-account-label">Signed in as</p>
                    <p className="settings-account-value">
                      {user?.full_name || profile?.full_name || "Your account"}
                    </p>
                  </div>
                </div>

                <div className="settings-account-divider" />

                <div className="settings-signout">
                  <div>
                    <p className="settings-signout-title">Sign out</p>
                    <p className="settings-signout-hint">
                      You'll need to sign in again to access your diary and rewards.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="settings-signout-button"
                    onClick={logout}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}

          {active !== "account" && (
            <div className="settings-actions">
              {error && <p className="settings-error" role="alert">{error}</p>}
              {success && <p className="settings-success" role="status">{success}</p>}
              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}