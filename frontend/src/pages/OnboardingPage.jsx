import { useState } from "react";
import { saveProfile } from "../api/onboardingApi";

const steps = ["About you", "Your body", "Your routine", "Food preferences", "Calorie goal"];

const activityOptions = [
  ["sedentary", "Mostly sitting", "Little or no planned exercise"],
  ["light", "Lightly active", "Light exercise 1–3 days a week"],
  ["moderate", "Moderately active", "Exercise 3–5 days a week"],
  ["active", "Very active", "Hard exercise most days"],
  ["very_active", "Extra active", "Hard training or physical work"],
];

const goalOptions = [
  ["lose_weight", "Lose weight"],
  ["maintain", "Maintain weight"],
  ["gain_weight", "Gain weight"],
  ["build_muscle", "Build muscle"],
];

const dietOptions = [
  ["vegetarian", "Vegetarian"],
  ["eggetarian", "Eggetarian"],
  ["non_vegetarian", "Non-vegetarian"],
  ["vegan", "Vegan"],
];

export default function OnboardingPage({ token, onComplete, theme, onToggleTheme }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    age: "",
    sex: "",
    height_cm: "",
    weight_kg: "",
    activity_level: "",
    goal: "",
    goal_weight_kg: "",
    calorie_target_choice: "recommended",
    custom_calorie_target: "",
    diet_preference: "",
    allergies_and_restrictions: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const recommendedCalories = (() => {
    const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
    if (Number(form.age) < 18 || !form.sex || !form.weight_kg || !form.height_cm || !form.activity_level || !form.goal) return null;
    const sexAdjustment = { male: 5, female: -161, other: -78 }[form.sex];
    const resting = 10 * Number(form.weight_kg) + 6.25 * Number(form.height_cm) - 5 * Number(form.age) + sexAdjustment;
    let adjustment = { lose_weight: -300, maintain: 0, gain_weight: 250, build_muscle: 150 }[form.goal];
    if (["lose_weight", "gain_weight"].includes(form.goal) && form.goal_weight_kg) adjustment = (form.goal === "lose_weight" ? -1 : 1) * Math.min(500, Math.max(150, Math.abs(Number(form.goal_weight_kg) - Number(form.weight_kg)) * 25));
    return Math.max(1000, Math.round(resting * factors[form.activity_level] + adjustment));
  })();

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateStep() {
    if (step === 0 && (!form.age || !form.sex)) return "Enter your age and choose an option to continue.";
    if (step === 1 && (!form.height_cm || !form.weight_kg)) return "Add your height and current weight to continue.";
    if (step === 2 && (!form.activity_level || !form.goal)) return "Choose your activity level and goal to continue.";
    if (step === 3 && !form.diet_preference) return "Choose your food preference to continue.";
    if (step === 2 && ["gain_weight", "lose_weight"].includes(form.goal) && !form.goal_weight_kg) return "Add your goal weight to continue.";
    if (step === 4 && form.calorie_target_choice === "custom" && !form.custom_calorie_target) return "Enter your daily calorie target.";
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const validationMessage = validateStep();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    setSaving(true);
    try {
      const profile = await saveProfile({
        ...form,
        age: Number(form.age),
        height_cm: Number(form.height_cm),
        weight_kg: Number(form.weight_kg),
        goal_weight_kg: form.goal_weight_kg ? Number(form.goal_weight_kg) : null,
        custom_calorie_target: form.custom_calorie_target ? Number(form.custom_calorie_target) : null,
        allergies_and_restrictions: form.allergies_and_restrictions.trim() || null,
      }, token);
      onComplete(profile);
    } catch (requestError) {
      setError(requestError.message || "We couldn’t save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="survey-page">
      <section className="survey-card">
        <header className="survey-header">
          <span className="survey-brand">Ahar</span>
          <div className="survey-header-actions"><span className="survey-step-count">Step {step + 1} of {steps.length}</span><button className="theme-toggle-btn" type="button" aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} onClick={onToggleTheme}>{theme === "light" ? "☾" : "☼"}</button></div>
        </header>
        <div className="survey-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
          <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>

        <form className="survey-form" onSubmit={handleSubmit}>
          <p className="survey-eyebrow">A few quick questions</p>
          <h1>{steps[step]}</h1>
          <p className="survey-subtitle">Your answers help us personalize your nutrition dashboard.</p>

          {step === 0 && (
            <div className="survey-fields">
              <label className="survey-field">
                <span>How old are you?</span>
                <span className="survey-input-wrap"><input type="number" min="10" max="100" inputMode="numeric" value={form.age} onChange={(event) => update("age", event.target.value)} placeholder="Age" /></span>
              </label>
              <fieldset className="survey-fieldset">
                <legend>Sex used for calorie estimates</legend>
                <div className="survey-choice-grid survey-choice-grid-three">
                  {[ ["female", "Female"], ["male", "Male"], ["other", "Other"] ].map(([value, label]) => (
                    <button className={`survey-choice ${form.sex === value ? "is-selected" : ""}`} type="button" key={value} onClick={() => update("sex", value)} aria-pressed={form.sex === value}>{label}</button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 1 && (
            <div className="survey-fields survey-fields-two">
              <label className="survey-field">
                <span>Height</span>
                <span className="survey-input-wrap"><input type="number" min="80" max="250" step="0.1" inputMode="decimal" value={form.height_cm} onChange={(event) => update("height_cm", event.target.value)} placeholder="e.g. 168" /><span>cm</span></span>
              </label>
              <label className="survey-field">
                <span>Current weight</span>
                <span className="survey-input-wrap"><input type="number" min="20" max="400" step="0.1" inputMode="decimal" value={form.weight_kg} onChange={(event) => update("weight_kg", event.target.value)} placeholder="e.g. 65" /><span>kg</span></span>
              </label>
              <p className="survey-note">These details are private and can be changed later.</p>
            </div>
          )}

          {step === 2 && (
            <div className="survey-fields">
              <fieldset className="survey-fieldset">
                <legend>How active are you?</legend>
                <div className="survey-option-list">
                  {activityOptions.map(([value, label, detail]) => (
                    <button className={`survey-option ${form.activity_level === value ? "is-selected" : ""}`} type="button" key={value} onClick={() => update("activity_level", value)} aria-pressed={form.activity_level === value}>
                      <span><strong>{label}</strong><small>{detail}</small></span><span className="survey-radio" />
                    </button>
                  ))}
                </div>
              </fieldset>
              {["gain_weight", "lose_weight"].includes(form.goal) && <label className="survey-field"><span>{form.goal === "gain_weight" ? "What weight would you like to reach?" : "What is your goal weight?"}</span><span className="survey-input-wrap"><input type="number" min="20" max="400" step="0.1" value={form.goal_weight_kg} onChange={(event) => update("goal_weight_kg", event.target.value)} placeholder="e.g. 70" /><span>kg</span></span></label>}
              <fieldset className="survey-fieldset">
                <legend>What’s your main goal?</legend>
                <div className="survey-choice-grid survey-choice-grid-two">
                  {goalOptions.map(([value, label]) => (
                    <button className={`survey-choice ${form.goal === value ? "is-selected" : ""}`} type="button" key={value} onClick={() => update("goal", value)} aria-pressed={form.goal === value}>{label}</button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 3 && (
            <div className="survey-fields">
              <fieldset className="survey-fieldset">
                <legend>How do you usually eat?</legend>
                <div className="survey-choice-grid survey-choice-grid-two">
                  {dietOptions.map(([value, label]) => (
                    <button className={`survey-choice ${form.diet_preference === value ? "is-selected" : ""}`} type="button" key={value} onClick={() => update("diet_preference", value)} aria-pressed={form.diet_preference === value}>{label}</button>
                  ))}
                </div>
              </fieldset>
              <label className="survey-field">
                <span>Allergies or foods you avoid <small>Optional</small></span>
                <textarea maxLength={500} rows={3} value={form.allergies_and_restrictions} onChange={(event) => update("allergies_and_restrictions", event.target.value)} placeholder="e.g. peanuts, lactose" />
              </label>
              <p className="survey-note">Daily nutrition targets are general estimates, not medical advice. For users under 18, targets are left blank.</p>
            </div>
          )}

          {step === 4 && (
            <div className="survey-fields">
              <p className="survey-note">Your daily estimate uses your age, body measurements, activity, and goal. Weekly target is 7 × your daily target.</p>
              <div className="dashboard-card"><p className="card-eyebrow">Recommended for your goal</p><strong>{recommendedCalories ? `${recommendedCalories.toLocaleString()} kcal/day · ${(recommendedCalories * 7).toLocaleString()} kcal/week` : "Targets are unavailable for profiles under 18."}</strong></div>
              <div className="survey-choice-grid survey-choice-grid-two">
                <button type="button" className={`survey-choice ${form.calorie_target_choice === "recommended" ? "is-selected" : ""}`} onClick={() => update("calorie_target_choice", "recommended")}>Recommended target</button>
                <button type="button" className={`survey-choice ${form.calorie_target_choice === "custom" ? "is-selected" : ""}`} onClick={() => update("calorie_target_choice", "custom")}>Set my own target</button>
              </div>
              {form.calorie_target_choice === "custom" && <label className="survey-field"><span>Daily calories</span><span className="survey-input-wrap"><input type="number" min="1000" max="10000" value={form.custom_calorie_target} onChange={(event) => update("custom_calorie_target", event.target.value)} placeholder="e.g. 2200" /><span>kcal</span></span></label>}
            </div>
          )}

          {error && <p className="survey-error" role="alert">{error}</p>}
          <footer className="survey-actions">
            {step > 0 ? <button className="survey-back" type="button" onClick={() => { setError(""); setStep((current) => current - 1); }}>Back</button> : <span />}
            <button className="survey-next" type="submit" disabled={saving}>
              {saving ? "Saving…" : step === steps.length - 1 ? "Finish my profile" : "Continue"}
              {!saving && <span aria-hidden="true">→</span>}
            </button>
          </footer>
        </form>
      </section>
    </main>
  );
}
