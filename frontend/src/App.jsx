import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./store/authStore";
import LoginForm from "./components/auth/LoginForm";
import RegisterForm from "./components/auth/RegisterForm";
import { confirmMeal, listMealsForDay, localDateTimeInput } from "./api/mealLogsApi";
import { breakdownIngredients, estimateNutrition } from "./api/foodApi";
import { getProfile } from "./api/onboardingApi";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import { MealHistoryPage } from "./pages/DashboardPage";
import AssistantPage from "./pages/AssistantPage";
import PackagedFoodPage from "./pages/PackagedFoodPage";
import ProgressPage from "./pages/ProgressPage";
import GamificationPage from "./pages/GamificationPage";
import RecipeDrawer from "./components/analyze/RecipeDrawer";
import SettingsPage from "./pages/SettingsPage";
import authHeroImage from "./assets/img.png";
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

const BADGES = {
  database_match: { text: "INDB match", className: "badge badge-emerald" },
  database_approx: { text: "Approx. INDB match", className: "badge badge-amber" },
  ai_estimate: { text: "AI estimate", className: "badge badge-purple" },
  unresolved: { text: "Not found", className: "badge badge-slate" },
};

function fmt(value, digits = 0) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(digits);
}

function Macro({ label, value, unit = "g" }) {
  return (
    <div className="macro-chip">
      <span className="macro-chip-label">{label}</span>
      <span className="macro-chip-value">
        {fmt(value, 1)}
        {unit}
      </span>
    </div>
  );
}

function NutritionPanel({
  nutrition,
  mealType,
  onMealTypeChange,
  onConfirm,
  onConfirmGoal,
  goalPrompt,
  onCancelGoal,
  saving,
  saved,
  saveError,
  onHistory,
  onEditItem,
  onAddItem,
  onRemoveItem,
  onRecalculate,
  onBreakdown,
  breakingDown,
  recalculating,
  onOpenRecipeDrawer,
}) {
  if (!nutrition) return null;

  const items = Array.isArray(nutrition.items) ? nutrition.items : [];
  const totals = nutrition.totals || {};
  const resolved_items = nutrition.resolved_items ?? 0;
  const total_items = nutrition.total_items ?? items.length;
  const is_partial = nutrition.is_partial;
  const advisories = Array.isArray(nutrition.advisories) ? nutrition.advisories : [];
  const goalSwaps = Array.isArray(nutrition.goalSwaps) ? nutrition.goalSwaps : [];
  const hasResolvedItems = items.some((i) => i.nutrition && !i._needs_recalc);

  return (
    <section className="nutrition-panel">
      <h3 className="nutrition-panel-title">Nutrition estimate</h3>

      <div className="nutrition-total">
        <div className="nutrition-total-eyebrow">Meal total</div>
        <div className="nutrition-total-value">{fmt(totals.energy_kcal)} kcal</div>
        <div className="nutrition-total-macros">
          <Macro label="Protein" value={totals.protein_g} />
          <Macro label="Carbs" value={totals.carb_g} />
          <Macro label="Fat" value={totals.fat_g} />
          <Macro label="Fibre" value={totals.fibre_g} />
        </div>
      </div>

      {is_partial && (
        <div className="callout callout-amber">
          Only {resolved_items} of {total_items} items have nutrition values — those will be
          skipped when you save this meal.
        </div>
      )}

      {advisories.length > 0 && (
        <div className="advisory-stack">
          {advisories.map((a, i) => (
            <div
              key={i}
              className={
                a.type === "allergy_warning" ? "callout callout-red" : "callout callout-amber"
              }
            >
              {a.message}
            </div>
          ))}
        </div>
      )}

      {goalSwaps.length > 0 && (
        <div className="callout callout-blue">
          <p className="callout-eyebrow">Toward your goal</p>
          {goalSwaps.map((s, i) => (
            <p key={i} className="callout-line">
              <strong>{s.item}:</strong> {s.suggestion}{" "}
              <span className="callout-muted">— {s.reason}</span>
            </p>
          ))}
        </div>
      )}

      <ul className="item-list">
        {items.map((item, index) => {
          const badge = BADGES[item.confidence_label] ?? BADGES.unresolved;
          const showMatch =
            item.matched_name &&
            item.matched_name.toLowerCase() !== item.name.toLowerCase();
          return (
            <li key={`${item.name}-${index}`} className="item-card">
              <div className="item-card-head">
                <div className="item-card-title-wrap">
                  <label className="field">
                    <span className="field-label">Food name</span>
                    <input
                      className="field-input"
                      value={item.name}
                      onChange={(e) => onEditItem(index, "name", e.target.value)}
                    />
                  </label>
                  <label className="field field-narrow">
                    <span className="field-label">Serving size (g)</span>
                    <input
                      className="field-input"
                      type="number"
                      min="1"
                      step="1"
                      value={item.portion_g}
                      onChange={(e) =>
                        onEditItem(index, "portion_g", Number(e.target.value))
                      }
                    />
                  </label>
                  {item._needs_recalc && (
                    <small className="field-note-amber">
                      Recalculate nutrition to save this edit.
                    </small>
                  )}
                  <button
                    type="button"
                    className="text-button"
                    disabled={breakingDown === index}
                    onClick={() => onBreakdown(index)}
                  >
                    {breakingDown === index
                      ? "Finding ingredients…"
                      : "Show recipe ingredients"}
                  </button>
                </div>
                <button
    type="button"
    className="item-remove-button"
    aria-label={`Remove ${item.name || "item"}`}
    disabled={items.length <= 1}
    onClick={() => onRemoveItem(index)}
  >
    ✕
  </button>

              </div>

              {showMatch && (
                <div className="item-match-note">matched to “{item.matched_name}”</div>
              )}

              {item.nutrition ? (
                <div className="item-macros">
                  <Macro label="Energy" value={item.nutrition.energy_kcal} unit=" kcal" />
                  <Macro label="Protein" value={item.nutrition.protein_g} />
                  <Macro label="Carbs" value={item.nutrition.carb_g} />
                  <Macro label="Fat" value={item.nutrition.fat_g} />
                  <Macro label="Fibre" value={item.nutrition.fibre_g} />
                </div>
              ) : (
                <p className="item-empty">
                  {item.note ?? "No nutrition data found for this item."}
                </p>
              )}
            </li>
          );
        })}
      </ul>

<div className="item-actions">
  <button type="button" className="text-button" onClick={onAddItem}>
    + Add item
  </button>
  <button
    type="button"
    className="primary-button"
    onClick={onRecalculate}
    disabled={recalculating || items.some((i) => !i.name.trim() || !i.portion_g)}
  >
    {recalculating ? "Updating…" : "Recalculate nutrition"}
  </button>
</div>

      <div className="confirm-block">
        <label className="field-label">Meal type</label>
        <div className="meal-type-selector" role="group" aria-label="Choose meal type">
          {MEAL_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onMealTypeChange(type)}
              aria-pressed={mealType === type}
              className={`meal-type-choice${mealType === type ? " is-selected" : ""}`}
            >
              {type}
            </button>
          ))}
        </div>

        {saveError && <div className="callout callout-red">{saveError}</div>}

        {goalPrompt && (
          <div className="goal-warning" role="dialog" aria-modal="true">
            <strong>You have reached today’s calorie target.</strong>
            <p>Do you still want to save this meal to keep your diary accurate?</p>
            <div className="goal-warning-actions">
              <button type="button" className="text-button" onClick={onCancelGoal}>
                Go back
              </button>
              <button type="button" className="primary-button" onClick={onConfirmGoal}>
                Save meal anyway
              </button>
            </div>
          </div>
        )}

        {saved ? (
          <div className="callout callout-emerald">
            Saved to your diary ✓ (meal #{saved.id})
            <button type="button" className="meal-open-diary" onClick={onHistory}>
              View in diary →
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || !hasResolvedItems || items.some((i) => i._needs_recalc)}
            className="primary-button primary-button-block"
          >
            {saving ? "Saving..." : "Confirm & save meal"}
          </button>
        )}
      </div>

      <p className="disclaimer">
        These are estimates. Please confirm the food names and portion sizes before saving.
      </p>
    </section>
  );
}

function FoodAnalyzer({ onHistory, onAskAssistant, initialLogDate, profile }) {
  const { token } = useAuth();

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [mealType, setMealType] = useState("lunch");
  const [logDate, setLogDate] = useState(
    initialLogDate || new Date().toLocaleDateString("en-CA")
  );
  const [logTime, setLogTime] = useState(() => localDateTimeInput().slice(11));
  const [goalPrompt, setGoalPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const [breakingDown, setBreakingDown] = useState(null);
    const [ingredientDrawer, setIngredientDrawer] = useState(null);
  const [notes, setNotes] = useState([
    { _id: "note-1", text: "", sent: false, createdAt: Date.now() },
  ]);
  const [noteIndex, setNoteIndex] = useState(0);
  const [flipping, setFlipping] = useState(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0];
    setResult(null);
    setError("");
    setSaved(null);
    setSaveError("");
    if (!selectedFile) {
      setFile(null);
      setPreview("");
      return;
    }
    if (!selectedFile.type.startsWith("image/")) {
      setFile(null);
      setPreview("");
      setError("Please choose a valid image.");
      return;
    }
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  }

  async function analyzeImage() {
    if (!file) {
      setError("Please choose a food image first.");
      return;
    }
    setLoading(true);
    setResult(null);
    setError("");
    setSaved(null);
    setSaveError("");
    const formData = new FormData();
    formData.append("image", file);
    try {
      const response = await fetch("/api/food/analyze-image", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail?.message || data?.detail || "Image analysis failed.");
      }
      setResult(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmMeal(skipGoalWarning = false) {
    if (!result?.nutrition?.items) return;
    const items = result.nutrition.items
      .filter((item) => item.nutrition && !item._needs_recalc)
      .map((item) => ({
        name: item.name,
        grams: item.portion_g,
        calories: item.nutrition.energy_kcal,
        protein_g: item.nutrition.protein_g,
        carbs_g: item.nutrition.carb_g,
        fat_g: item.nutrition.fat_g,
        confidence_label: item.confidence_label,
      }));

    if (items.length === 0) {
      setSaveError("No items have nutrition data yet — nothing to save.");
      return;
    }

    const calorieTarget = Number(profile?.daily_calorie_target || 0);
    const today = localDateTimeInput().slice(0, 10);
    if (!skipGoalWarning && calorieTarget > 0 && logDate === today) {
      try {
        const existingMeals = await listMealsForDay(logDate, token, new Date(`${logDate}T12:00:00`));
        const currentCalories = existingMeals.reduce(
          (sum, meal) => sum + Number(meal.calories || 0),
          0
        );
        const mealCalories = items.reduce((sum, item) => sum + Number(item.calories || 0), 0);
        if (currentCalories >= calorieTarget || currentCalories + mealCalories >= calorieTarget) {
          setGoalPrompt(true);
          return;
        }
      } catch (err) {
        setSaveError(err.message || "Could not check today’s calorie total.");
        return;
      }
    }

    setSaving(true);
    setSaveError("");
    setGoalPrompt(false);
    try {
      const meal = await confirmMeal(
        { mealType, items, loggedAt: `${logDate}T${logTime}` },
        token
      );
      setSaved(meal);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function editItem(index, field, value) {
    setResult((current) => ({
      ...current,
      nutrition: {
        ...current.nutrition,
        items: current.nutrition.items.map((item, i) =>
          i === index ? { ...item, [field]: value, _needs_recalc: true } : item
        ),
      },
    }));
  }

  async function recalculate() {
    setRecalculating(true);
    setSaveError("");
    try {
      const items = result.nutrition.items.map((item) => ({
        name: item.name.trim(),
        grams: Number(item.portion_g),
      }));
      const nutrition = await estimateNutrition(items, token);
      setResult((current) => ({ ...current, nutrition }));
    } catch (err) {
      setSaveError(err.message || "Could not recalculate nutrition.");
    } finally {
      setRecalculating(false);
    }
  }

  async function breakdownItem(index) {
    setBreakingDown(index);
    setSaveError("");
    try {
      const target = result.nutrition.items[index];
      const breakdown = await breakdownIngredients(target.name, target.portion_g, token);
      const revised = (breakdown.items || []).map((part, i) => ({
  _id: `${Date.now()}-${i}`,
  name: part.name,
  grams: part.grams,
}));
      setIngredientDrawer({ index, title: target.name, items: revised });
    } catch (err) {
      setSaveError(err.message || "Could not load recipe ingredients.");
    } finally {
      setBreakingDown(null);
    }
  }

  async function saveRecipe(index) {
    if (!ingredientDrawer) return;
    const safeItems = ingredientDrawer.items
      .map((item) => ({ name: item.name?.trim(), grams: Number(item.grams) }))
      .filter(
        (item) =>
          item.name && item.name.length > 0 && Number.isFinite(item.grams) && item.grams > 0
      );
    if (safeItems.length === 0) {
      setSaveError("Add at least one ingredient with a valid weight before applying.");
      return;
    }
    setSaveError("");
    setRecalculating(true);
    try {
      const nutrition = await estimateNutrition(safeItems, token);
      setResult((current) => ({ ...current, nutrition }));
      setIngredientDrawer(null);
    } catch (err) {
      setSaveError(err.message || "Could not apply recipe ingredients.");
    } finally {
      setRecalculating(false);
    }
  }

  const steps = [
    { tone: "green", label: "Quick check", value: "Food + portion" },
    { tone: "gold", label: "Nutrition", value: "Estimate" },
    { tone: "purple", label: "Diary", value: "Save meal" },
  ];

  return (
    <main className="analyze-page">
      <section className="analyze-shell">
        <div className="analyze-layout">
          <div className="analyze-main">
            <header className="analyze-header">
              <p className="analyze-brand">Ahar</p>
              <h1 className="analyze-title">Food image analysis</h1>
              <p className="analyze-subtitle">
                Upload a food image to identify it and estimate its portion.
              </p>
              <div className="analyze-date-row">
                <label className="inline-field">
                  Eaten on{" "}
                  <input
                    className="inline-input"
                    type="date"
                    value={logDate}
                    max={localDateTimeInput().slice(0, 10)}
                    onChange={(e) => setLogDate(e.target.value)}
                  />
                </label>
                <label className="inline-field">
                  at{" "}
                  <input
                    className="inline-input"
                    type="time"
                    value={logTime}
                    onChange={(e) => setLogTime(e.target.value)}
                  />
                </label>
              </div>
            </header>

            <div className="analyze-notes analyze-notes-inline" aria-label="Quick actions">
              {steps.map((s) => (
                <div key={s.label} className={`analysis-note analysis-note-${s.tone}`}>
                  <span>{s.label}</span>
                  <strong>{s.value}</strong>
                </div>
              ))}
            </div>

            <label className="dropzone">
              <span className="dropzone-title">Choose an image</span>
              <span className="dropzone-hint">JPG, PNG, or another browser-supported image</span>
              <input
                className="dropzone-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
            </label>

            {file && <p className="file-name">Selected: {file.name}</p>}

            {preview && (
              <div className="preview-wrap">
                <img className="preview-img" src={preview} alt="Selected food" />
              </div>
            )}

            <button
              className="primary-button primary-button-block"
              type="button"
              onClick={analyzeImage}
              disabled={!file || loading}
            >
              {loading ? "Analyzing image..." : "Analyze image"}
            </button>

            {error && <div className="callout callout-red">{error}</div>}

            {result && (
              <section className="analyze-result">
                <h2 className="analyze-result-title">Analysis result</h2>
                {result.fallback && (
                  <div className="callout callout-amber">{result.fallback.message}</div>
                )}
                <NutritionPanel
                  nutrition={result.nutrition}
                  mealType={mealType}
                  onMealTypeChange={setMealType}
                  onConfirm={() => handleConfirmMeal()}
                  onConfirmGoal={() => handleConfirmMeal(true)}
                  goalPrompt={goalPrompt}
                  onCancelGoal={() => setGoalPrompt(false)}
                  saving={saving}
                  saved={saved}
                  saveError={saveError}
                  onHistory={onHistory}
                  onEditItem={editItem}
                  onAddItem={() =>
                    setResult((current) => ({
                      ...current,
                      nutrition: {
                        ...current.nutrition,
                        items: [
                          ...(current.nutrition.items || []),
                          { name: "", portion_g: 100, nutrition: null },
                        ],
                      },
                    }))
                  }
              onRemoveItem={(index) =>
  setResult((current) => ({
    ...current,
    nutrition: {
      ...current.nutrition,
      items: (current.nutrition.items || []).filter((_, i) => i !== index),
    },
  }))
}
                  onRecalculate={recalculate}
                  recalculating={recalculating}
                  onBreakdown={breakdownItem}
                  breakingDown={breakingDown}
                  onOpenRecipeDrawer={() => ingredientDrawer && setIngredientDrawer(null)}
                />
              </section>
            )}
          </div>

          <aside className="analyze-side" aria-label="Analyze sidebar">
            <div className="sticky-note sticky-note-green">
              <span className="sticky-note-pin" aria-hidden="true">📌</span>
              <p className="sticky-note-label">Quick check</p>
              <p className="sticky-note-value">Food + portion</p>
              <p className="sticky-note-body">
                Take a clear, top-down photo so portion sizes are easier to estimate.
              </p>
            </div>
            <div className="sticky-note sticky-note-gold">
              <span className="sticky-note-pin" aria-hidden="true">📌</span>
              <p className="sticky-note-label">Nutrition</p>
              <p className="sticky-note-value">Estimate</p>
              <p className="sticky-note-body">
                Review each item’s macros, then recalculate if you edit anything.
              </p>
            </div>
            <div className="sticky-note sticky-note-purple">
              <span className="sticky-note-pin" aria-hidden="true">📌</span>
              <p className="sticky-note-label">Diary</p>
              <p className="sticky-note-value">Save meal</p>
              <p className="sticky-note-body">
                Pick the right meal type and confirm to log it to your diary.
              </p>
            </div>
          
<div className="ask-page">
  {/* Header: label + page counter + prev/next */}
  <div className="ask-page-head">
    <span className="ask-page-label">Ask Ahar</span>
    <div className="ask-page-nav">
      <button
        type="button"
        className="ask-page-arrow"
        aria-label="Previous note"
        disabled={noteIndex === 0}
        onClick={() => {
          if (noteIndex === 0) return;
          setFlipping("prev");
          setTimeout(() => {
            setNoteIndex((i) => Math.max(0, i - 1));
            setFlipping(null);
          }, 180);
        }}
      >
        ←
      </button>
      <span className="ask-page-counter">
        {noteIndex + 1}/{notes.length}
      </span>
      <button
        type="button"
        className="ask-page-arrow"
        aria-label="Next note"
        onClick={() => {
          setFlipping("next");
          setTimeout(() => {
            if (noteIndex === notes.length - 1) {
              const id = `note-${Date.now()}`;
              setNotes((cur) => [...cur, { _id: id, text: "", sent: false }]);
              setNoteIndex(notes.length);
            } else {
              setNoteIndex((i) => i + 1);
            }
            setFlipping(null);
          }, 180);
        }}
      >
        →
      </button>
    </div>
  </div>

  {/* Current page (turns) */}
  {(() => {
    const note = notes[noteIndex];
    if (!note) return null;
    return (
      <div
        className={`ask-page-body${flipping ? ` is-flipping-${flipping}` : ""}`}
      >
        {note.sent && <span className="ask-page-sent-tag">Sent</span>}
        <textarea
          className="ask-page-input"
          rows={3}
          value={note.text}
          onChange={(e) =>
            setNotes((cur) =>
              cur.map((n) =>
                n._id === note._id ? { ...n, text: e.target.value } : n
              )
            )
          }
          placeholder={
            note.sent
              ? "This question was already sent."
              : "e.g. Is 250 g of hamburger too much for dinner?"
          }
          disabled={note.sent}
        />
        {!note.sent ? (
          <button
            type="button"
            className="ask-page-send"
            disabled={!note.text.trim()}
            onClick={() => {
              const text = note.text.trim();
              if (!text) return;
              onAskAssistant?.(text);
              setNotes((cur) =>
                cur.map((n) =>
                  n._id === note._id ? { ...n, text, sent: true } : n
                )
              );
              const id = `note-${Date.now()}`;
              setTimeout(() => {
                setNotes((cur) => [
                  ...cur,
                  { _id: id, text: "", sent: false },
                ]);
                setNoteIndex(notes.length);
              }, 180);
            }}
          >
            Send →
          </button>
        ) : (
          <span className="ask-page-note">Already sent to Ahar.</span>
        )}
      </div>
    );
  })()}
</div>
 </aside>
        </div>
      </section>

      {ingredientDrawer && (
        <RecipeDrawer
          drawer={ingredientDrawer}
          onChange={(nextItems) =>
            setIngredientDrawer((current) => (current ? { ...current, items: nextItems } : current))
          }
          onClose={() => setIngredientDrawer(null)}
          onSave={() => saveRecipe(ingredientDrawer.index)}
          saving={recalculating}
        />
      )}
    </main>
  );
}

function AuthGate() {
  const { token, user, loading, logout } = useAuth();
  const [mode, setMode] = useState("login");
  const [menuOpen, setMenuOpen] = useState(false);
  const [authTheme, setAuthTheme] = useState(() => {
    const savedTheme = localStorage.getItem("ahar_auth_theme");
    return (
      savedTheme ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );
  });
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [page, setPage] = useState("dashboard");
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [analysisLogDate, setAnalysisLogDate] = useState("");

  function askAboutMeal(meal) {
    setAssistantQuestion(
      `Help me understand this meal I logged: ${meal.food_name} (${meal.meal_type}, ${Math.round(
        meal.calories
      )} kcal). How does it fit my goal, and what could I improve?`
    );
    setPage("assistant");
  }

  useEffect(() => {
    document.documentElement.dataset.theme = authTheme;
  }, [authTheme]);

  function toggleTheme() {
    const nextTheme = authTheme === "light" ? "dark" : "light";
    localStorage.setItem("ahar_auth_theme", nextTheme);
    setAuthTheme(nextTheme);
  }

  useEffect(() => {
    if (!token) {
      setProfile(null);
      setProfileError("");
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    getProfile(token)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) setProfileError(err.message || "Could not load your profile.");
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="app-loading">
        <p>Loading...</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="auth-page" data-theme={authTheme}>
        <section className="auth-shell">
          <div className="auth-content">
            <header className="auth-content-top">
              <span className="auth-brand">
                <span className="auth-brand-wordmark">Ahar</span>
              </span>
              <div className="auth-header-actions">
                <span>
                  {mode === "login" ? "Your nutrition, in focus" : "Start your Ahar journey"}
                </span>
                <button
                  className="auth-theme-toggle"
                  type="button"
                  aria-label={`Switch to ${authTheme === "light" ? "dark" : "light"} theme`}
                  onClick={toggleTheme}
                >
                  {authTheme === "light" ? "☾" : "☼"}
                </button>
              </div>
            </header>
            <div className="auth-form-transition" key={mode}>
              {mode === "login" ? (
                <LoginForm onSwitchToRegister={() => setMode("register")} />
              ) : (
                <RegisterForm onSwitchToLogin={() => setMode("login")} />
              )}
            </div>
            <p className="auth-terms">Your information stays private and secure.</p>
          </div>
         <aside className="auth-image-panel" aria-label="Ahar nutrition tracking">
  <img
    src={authHeroImage}
    alt="Ahar nutrition tracking"
    className="auth-hero-image"
  />
</aside>
        </section>
      </main>
    );
  }

  if (profileLoading) {
    return (
      <main className="app-loading">
        <p>Loading your Ahar profile…</p>
      </main>
    );
  }

  if (profileError) {
    return (
      <main className="app-load-error">
        <p>{profileError}</p>
        <button
          onClick={() => {
            setProfileError("");
            setProfileLoading(true);
            getProfile(token)
              .then(setProfile)
              .catch((err) => setProfileError(err.message))
              .finally(() => setProfileLoading(false));
          }}
        >
          Try again
        </button>
        <button onClick={logout}>Sign out</button>
      </main>
    );
  }

  if (!profile?.onboarding_completed) {
    return (
      <OnboardingPage
        token={token}
        onComplete={setProfile}
        theme={authTheme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <a
          className="app-sidebar-logo"
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setPage("dashboard");
          }}
          aria-label="Ahar"
        >
          A
        </a>
        <nav className="app-navigation" aria-label="Main navigation">
          <button
            type="button"
            className={`app-nav-item${page === "dashboard" ? " is-active" : ""}`}
            onClick={() => setPage("dashboard")}
          >
            <span className="app-nav-icon">⌂</span>
            <span className="app-nav-label">Home</span>
          </button>
          <button
            type="button"
            className={`app-nav-item${page === "analyze" ? " is-active" : ""}`}
            onClick={() => setPage("analyze")}
          >
            <span className="app-nav-icon">＋</span>
            <span className="app-nav-label">Analyze</span>
          </button>
          <button
            type="button"
            className={`app-nav-item${page === "history" ? " is-active" : ""}`}
            onClick={() => setPage("history")}
          >
            <span className="app-nav-icon">▤</span>
            <span className="app-nav-label">Meals</span>
          </button>
          <button
            type="button"
            className={`app-nav-item${page === "packaged" ? " is-active" : ""}`}
            onClick={() => setPage("packaged")}
          >
            <span className="app-nav-icon">▣</span>
            <span className="app-nav-label">Packaged</span>
          </button>
          <button
            type="button"
            className={`app-nav-item${page === "assistant" ? " is-active" : ""}`}
            onClick={() => setPage("assistant")}
          >
            <span className="app-nav-icon">✦</span>
            <span className="app-nav-label">Assistant</span>
          </button>
          <button
            type="button"
            className={`app-nav-item${page === "progress" ? " is-active" : ""}`}
            onClick={() => setPage("progress")}
          >
            <span className="app-nav-icon">↗</span>
            <span className="app-nav-label">Progress</span>
          </button>
          <button
            type="button"
            className={`app-nav-item${page === "rewards" ? " is-active" : ""}`}
            onClick={() => setPage("rewards")}
          >
            <span className="app-nav-icon">★</span>
            <span className="app-nav-label">Rewards</span>
          </button>

          <button
            type="button"
            className={`app-nav-item${page === "settings" ? " is-active" : ""}`}
            onClick={() => setPage("settings")}
          >
            <span className="app-nav-icon">⚙</span>
            <span className="app-nav-label">Settings</span>
          </button>
        </nav>
      </aside>

      <div className="app-main-column">
        <header className="app-topbar">
          <div className="app-topbar-title">
            <span className="app-topbar-dot" />
            {
              {
                dashboard: "Your nutrition",
                history: "Food diary",
                analyze: "Meal analysis",
                packaged: "Packaged food",
                assistant: "Assistant",
                progress: "Progress",
                rewards: "Rewards",
              }[page]
            }
          </div>
          <div className="app-topbar-actions">
            <span className="app-topbar-date">
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <button
              className="theme-toggle-btn"
              type="button"
              aria-label={`Switch to ${authTheme === "light" ? "dark" : "light"} theme`}
              onClick={toggleTheme}
            >
              {authTheme === "light" ? "☾" : "☼"}
            </button>
          <div className="topbar-user">
  <button
    type="button"
    className="app-user-avatar app-topbar-avatar"
    aria-label={user?.full_name || "Your account"}
    aria-haspopup="menu"
    aria-expanded={menuOpen}
    onClick={() => setMenuOpen((v) => !v)}
  >
    {(user?.full_name || user?.email || "A").slice(0, 1).toUpperCase()}
  </button>
  {menuOpen && (
    <>
      <div
        className="topbar-user-backdrop"
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <div className="topbar-user-menu" role="menu">
        <div className="topbar-user-head">
          <p className="topbar-user-name">{user?.full_name || "Your account"}</p>
          <p className="topbar-user-email">{user?.email}</p>
        </div>
        <button
          type="button"
          className="topbar-user-item"
          role="menuitem"
          onClick={() => { setMenuOpen(false); setPage("settings"); }}
        >
          <span aria-hidden="true">⚙</span> Settings
        </button>
        <button
          type="button"
          className="topbar-user-item topbar-user-item-danger"
          role="menuitem"
          onClick={() => { setMenuOpen(false); logout(); }}
        >
          <span aria-hidden="true">⏻</span> Sign out
        </button>
      </div>
    </>
  )}
</div>
          </div>
        </header>

        <main className="app-main-content">
          {page === "dashboard" ? (
            <DashboardPage
              token={token}
              user={user}
              profile={profile}
              onAnalyze={(date) => {
                setAnalysisLogDate(date || "");
                setPage("analyze");
              }}
              onHistory={() => setPage("history")}
              onAskMeal={askAboutMeal}
            />
          ) : page === "history" ? (
            <MealHistoryPage
              token={token}
              profile={profile}
              onAnalyze={(date) => {
                setAnalysisLogDate(date || "");
                setPage("analyze");
              }}
              onAskMeal={askAboutMeal}
            />
          ) : page === "analyze" ? (
            <div className="food-analyzer-page">
<button className="analyze-back-button" onClick={() => setPage("dashboard")}>
  ← Back to overview
</button>
             <FoodAnalyzer
  key={analysisLogDate}
  initialLogDate={analysisLogDate}
  profile={profile}
  onHistory={() => setPage("history")}
  onAskAssistant={(question) => {
    setAssistantQuestion(question);
    setPage("assistant");
  }}
/>
            </div>
          ) : page === "packaged" ? (
            <PackagedFoodPage
              token={token}
              profile={profile}
              onAskAssistant={(question) => {
                setAssistantQuestion(question);
                setPage("assistant");
              }}
            />
          ) : page === "assistant" ? (
            <AssistantPage token={token} initialQuestion={assistantQuestion} />
          ) : page === "progress" ? (
            <ProgressPage token={token} profile={profile} />
          ) : page === "settings" ?(
             <SettingsPage />
          ):(
            <GamificationPage token={token} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}