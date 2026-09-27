import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./store/authStore";
import LoginForm from "./components/auth/LoginForm";
import RegisterForm from "./components/auth/RegisterForm";
import { confirmMeal } from "./api/mealLogsApi";
import { breakdownIngredients, estimateNutrition } from "./api/foodApi";
import { getProfile } from "./api/onboardingApi";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import { MealHistoryPage } from "./pages/DashboardPage";
import AssistantPage from "./pages/AssistantPage";
import PackagedFoodPage from "./pages/PackagedFoodPage";
import ProgressPage from "./pages/ProgressPage";
import GamificationPage from "./pages/GamificationPage";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

function fmt(value, digits = 0) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(digits);
}

function Macro({ label, value, unit = "g" }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-800">
        {fmt(value, 1)}
        {unit}
      </div>
    </div>
  );
}

function NutritionPanel({ nutrition, mealType, onMealTypeChange, onConfirm, saving, saved, saveError, onHistory, onEditItem, onAddItem, onRemoveItem, onRecalculate, onBreakdown, breakingDown, recalculating }) {
  if (!nutrition) return null;

  const { items = [], totals = {}, resolved_items, total_items, is_partial } = nutrition;
  const hasResolvedItems = resolved_items > 0;

  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-emerald-900">Nutrition estimate</h3>

      <div className="mt-3 rounded-xl bg-emerald-50 p-4">
        <div className="text-xs font-semibold uppercase text-emerald-700">Meal total</div>
        <div className="text-3xl font-bold text-emerald-900">{fmt(totals.energy_kcal)} kcal</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Macro label="Protein" value={totals.protein_g} />
          <Macro label="Carbs" value={totals.carb_g} />
          <Macro label="Fat" value={totals.fat_g} />
          <Macro label="Fibre" value={totals.fibre_g} />
        </div>
      </div>

      {is_partial && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Only {resolved_items} of {total_items} items have nutrition values — those will be
          skipped when you save this meal.
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {items.map((item, index) => {
          return (
            <li key={`${item.name}-${index}`} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <label className="block text-xs text-slate-500">Food name<input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={item.name} onChange={(event) => onEditItem(index, "name", event.target.value)} /></label>
                  <label className="mt-2 block text-xs text-slate-500">Serving size (g)<input className="mt-1 block w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" type="number" min="1" step="1" value={item.portion_g} onChange={(event) => onEditItem(index, "portion_g", Number(event.target.value))} /></label>
                  {item._needs_recalc && <small className="mt-1 block text-amber-700">Recalculate nutrition to save this edit.</small>}
                  <button type="button" className="dashboard-text-button mt-2" disabled={breakingDown === index} onClick={() => onBreakdown(index)}>{breakingDown === index ? "Finding ingredients…" : "Show recipe ingredients"}</button>
                </div>
              </div>

              {item.nutrition ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Macro label="Energy" value={item.nutrition.energy_kcal} unit=" kcal" />
                  <Macro label="Protein" value={item.nutrition.protein_g} />
                  <Macro label="Carbs" value={item.nutrition.carb_g} />
                  <Macro label="Fat" value={item.nutrition.fat_g} />
                  <Macro label="Fibre" value={item.nutrition.fibre_g} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  {item.note ?? "No nutrition data found for this item."}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="dashboard-text-button" onClick={onAddItem}>Add ingredient</button><button type="button" className="dashboard-text-button" onClick={onRemoveItem} disabled={items.length <= 1}>Remove last ingredient</button><button type="button" className="dashboard-primary-button" onClick={onRecalculate} disabled={recalculating || items.some((item) => !item.name.trim() || !item.portion_g)}>{recalculating ? "Updating…" : "Recalculate nutrition"}</button></div>

      <div className="mt-5 border-t border-slate-100 pt-5">
        <label className="mb-2 block text-sm font-medium text-slate-700">Meal type</label>
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

        {saveError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {saveError}
          </div>
        )}

        {saved ? (
          <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            Saved to your diary ✓ (meal #{saved.id})
            <button type="button" className="meal-open-diary" onClick={onHistory}>View in diary -&gt;</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || !hasResolvedItems || items.some((item) => item._needs_recalc)}
            className="mt-4 w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Confirm & save meal"}
          </button>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        These are estimates. Please confirm the food names and portion sizes before saving.
      </p>
    </section>
  );
}

function FoodAnalyzer({ onHistory, initialLogDate }) {
  const { token, user, logout } = useAuth();

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [mealType, setMealType] = useState("lunch");
  const [logDate, setLogDate] = useState(initialLogDate || new Date().toLocaleDateString("en-CA"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const [breakingDown, setBreakingDown] = useState(null);

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

  async function handleConfirmMeal() {
    if (!result?.nutrition?.items) return;

    // Only items with real nutrition are sendable — unresolved items are
    // dropped here, matching the "skipped when you save" note in the panel.
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

    setSaving(true);
    setSaveError("");
    try {
      const meal = await confirmMeal({ mealType, items, logDate }, token);
      setSaved(meal);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function editItem(index, field, value) {
    setResult((current) => ({ ...current, nutrition: { ...current.nutrition, items: current.nutrition.items.map((item, i) => i === index ? { ...item, [field]: value, _needs_recalc: true } : item) } }));
  }
  async function recalculate() {
    setRecalculating(true); setSaveError("");
    try {
      const items = result.nutrition.items.map((item) => ({ name: item.name.trim(), grams: Number(item.portion_g) }));
      const nutrition = await estimateNutrition(items, token);
      setResult((current) => ({ ...current, nutrition }));
    } catch (err) { setSaveError(err.message || "Could not recalculate nutrition."); }
    finally { setRecalculating(false); }
  }
  async function breakdownItem(index) {
    setBreakingDown(index); setSaveError("");
    try {
      const currentItems = result.nutrition.items;
      const target = currentItems[index];
      const breakdown = await breakdownIngredients(target.name, target.portion_g, token);
      const revised = currentItems.flatMap((item, itemIndex) => itemIndex === index ? breakdown.items.map((part) => ({ name: part.name, grams: part.grams })) : [{ name: item.name, grams: item.portion_g }]);
      const nutrition = await estimateNutrition(revised, token);
      setResult((current) => ({ ...current, nutrition }));
    } catch (err) { setSaveError(err.message || "Could not load recipe ingredients."); }
    finally { setBreakingDown(null); }
  }

  return (
    <main className="min-h-screen bg-emerald-50 px-4 py-10 text-slate-900">
      <section className="mx-auto w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl sm:p-10">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">
              Ahar
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-emerald-900">
              Food image analysis
            </h1>
            <p className="mt-3 text-slate-500">
              Upload a food image to identify it and estimate its portion.
            </p>
            <label className="mt-3 block text-sm text-slate-600">Log date <input className="ml-2 rounded-lg border border-slate-300 px-2 py-1" type="date" value={logDate} max={new Date().toLocaleDateString("en-CA")} onChange={(event) => setLogDate(event.target.value)} /></label>
          </div>

          <div className="text-right">
            <p className="text-sm font-semibold text-slate-700">{user?.full_name}</p>
            <button
              type="button"
              onClick={logout}
              className="mt-1 text-xs font-semibold text-emerald-700 hover:underline"
            >
              Log out
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-6 py-10 text-center transition hover:border-emerald-500 hover:bg-emerald-100">
          <span className="text-lg font-semibold text-emerald-900">Choose an image</span>
          <span className="mt-2 text-sm text-slate-500">
            JPG, PNG, or another browser-supported image
          </span>
          <input
            className="mt-5 block w-full max-w-xs cursor-pointer text-sm text-slate-600"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
        </label>

        {file && (
          <p className="mt-4 truncate text-center text-sm text-slate-500">Selected: {file.name}</p>
        )}

        {preview && (
          <div className="mt-6 overflow-hidden rounded-2xl bg-slate-100 p-3">
            <img
              className="mx-auto max-h-96 w-full rounded-xl object-contain"
              src={preview}
              alt="Selected food"
            />
          </div>
        )}

        <button
          className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={analyzeImage}
          disabled={!file || loading}
        >
          {loading ? "Analyzing image..." : "Analyze image"}
        </button>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <section className="mt-8">
            <h2 className="mb-3 text-xl font-bold text-slate-900">Analysis result</h2>

            <NutritionPanel
              nutrition={result.nutrition}
              mealType={mealType}
              onMealTypeChange={setMealType}
              onConfirm={handleConfirmMeal}
              saving={saving}
              saved={saved}
              saveError={saveError}
              onHistory={onHistory}
              onEditItem={editItem}
              onAddItem={() => setResult((current) => ({ ...current, nutrition: { ...current.nutrition, items: [...current.nutrition.items, { name: "", portion_g: 100, nutrition: null }] } }))}
              onRemoveItem={() => setResult((current) => ({ ...current, nutrition: { ...current.nutrition, items: current.nutrition.items.slice(0, -1) } }))}
              onRecalculate={recalculate}
              recalculating={recalculating}
              onBreakdown={breakdownItem}
              breakingDown={breakingDown}
            />

            {result.fallback && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {result.fallback.message}
              </div>
            )}

         
          </section>
        )}
      </section>
    </main>
  );
}

function AuthGate() {
  const { token, user, loading, logout } = useAuth();
  const [mode, setMode] = useState("login");
  const [authTheme, setAuthTheme] = useState(() => {
    const savedTheme = localStorage.getItem("ahar_auth_theme");
    return savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [page, setPage] = useState("dashboard");
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [analysisLogDate, setAnalysisLogDate] = useState("");
  function askAboutMeal(meal) {
    setAssistantQuestion(`Help me understand this meal I logged: ${meal.food_name} (${meal.meal_type}, ${Math.round(meal.calories)} kcal). How does it fit my goal, and what could I improve?`);
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
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch((err) => { if (!cancelled) setProfileError(err.message || "Could not load your profile."); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-emerald-50">
        <p className="text-slate-500">Loading...</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="auth-page" data-theme={authTheme}>
        <section className="auth-shell">
          <div className="auth-content">
            <header className="auth-content-top">
              <span className="auth-brand"><span className="auth-brand-wordmark">Ahar</span></span>
              <div className="auth-header-actions">
                <span>{mode === "login" ? "Your nutrition, in focus" : "Start your Ahar journey"}</span>
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
            <div className="auth-image-placeholder">
              <span className="auth-image-mark" aria-hidden="true">✦</span>
              <strong className="auth-brand-wordmark">Ahar</strong>
              <p>Small steps. A clearer picture of your nutrition.</p>
            </div>
          </aside>
        </section>
      </main>
    );
  }

  if (profileLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-emerald-50"><p className="text-slate-500">Loading your Ahar profile…</p></main>;
  }

  if (profileError) {
    return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-emerald-50 px-4 text-center"><p className="text-slate-700">{profileError}</p><button className="rounded-lg bg-emerald-700 px-5 py-2 text-white" onClick={() => { setProfileError(""); setProfileLoading(true); getProfile(token).then(setProfile).catch((err) => setProfileError(err.message)).finally(() => setProfileLoading(false)); }}>Try again</button><button className="text-sm text-slate-600" onClick={logout}>Sign out</button></main>;
  }

  if (!profile?.onboarding_completed) {
    return <OnboardingPage token={token} onComplete={setProfile} theme={authTheme} onToggleTheme={toggleTheme} />;
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar app-sidebar-egafiy">
        <a className="app-sidebar-logo" href="#dashboard" onClick={(event) => { event.preventDefault(); setPage("dashboard"); }} aria-label="Ahar">A</a>
        <nav className="app-navigation" aria-label="Main navigation">
          <button className={`app-nav-item${page === "dashboard" ? " is-active" : ""}`} onClick={() => setPage("dashboard")}><span className="app-nav-icon">⌂</span><span className="app-nav-label">Home</span></button>
          <button className={`app-nav-item${page === "analyze" ? " is-active" : ""}`} onClick={() => setPage("analyze")}><span className="app-nav-icon">＋</span><span className="app-nav-label">Analyze</span></button>
          <button className={`app-nav-item${page === "history" ? " is-active" : ""}`} onClick={() => setPage("history")}><span className="app-nav-icon">▤</span><span className="app-nav-label">Meals</span></button>
          <button className={`app-nav-item${page === "packaged" ? " is-active" : ""}`} onClick={() => setPage("packaged")}><span className="app-nav-icon">▣</span><span className="app-nav-label">Packaged</span></button>
          <button className={`app-nav-item${page === "assistant" ? " is-active" : ""}`} onClick={() => setPage("assistant")}><span className="app-nav-icon">✦</span><span className="app-nav-label">Assistant</span></button>
          <button className={`app-nav-item${page === "progress" ? " is-active" : ""}`} onClick={() => setPage("progress")}><span className="app-nav-icon">↗</span><span className="app-nav-label">Progress</span></button>
          <button className={`app-nav-item${page === "rewards" ? " is-active" : ""}`} onClick={() => setPage("rewards")}><span className="app-nav-icon">★</span><span className="app-nav-label">Rewards</span></button>
        </nav>
        <div className="app-sidebar-bottom">
          <button className="app-nav-item app-signout-nav" type="button" onClick={logout}><span className="app-nav-icon">↪</span><span className="app-nav-label">Log out</span></button>
        </div>
      </aside>
      <div className="app-main-column">
        <header className="app-topbar"><div className="app-topbar-title"><span className="app-topbar-dot" />{({ dashboard: "Your nutrition", history: "Food diary", analyze: "Meal analysis", packaged: "Packaged food", assistant: "Assistant", progress: "Progress", rewards: "Rewards" })[page]}</div><div className="app-topbar-actions"><span className="app-topbar-date">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span><button className="theme-toggle-btn" type="button" aria-label={`Switch to ${authTheme === "light" ? "dark" : "light"} theme`} onClick={toggleTheme}>{authTheme === "light" ? "☾" : "☼"}</button><span className="app-user-avatar app-topbar-avatar" aria-label={user?.full_name || "Your account"}>{(user?.full_name || user?.email || "A").slice(0, 1).toUpperCase()}</span></div></header>
        <main className="app-main-content">{page === "dashboard" ? <DashboardPage token={token} user={user} profile={profile} onAnalyze={(date) => { setAnalysisLogDate(date || ""); setPage("analyze"); }} onHistory={() => setPage("history")} onAskMeal={askAboutMeal} /> : page === "history" ? <MealHistoryPage token={token} onAnalyze={(date) => { setAnalysisLogDate(date || ""); setPage("analyze"); }} onAskMeal={askAboutMeal} /> : page === "analyze" ? <div className="food-analyzer-page"><button className="dashboard-text-button" onClick={() => setPage("dashboard")}>Back to overview</button><FoodAnalyzer key={analysisLogDate} initialLogDate={analysisLogDate} onHistory={() => setPage("history")} /></div> : page === "packaged" ? <PackagedFoodPage token={token} onAskAssistant={(question) => { setAssistantQuestion(question); setPage("assistant"); }} /> : page === "assistant" ? <AssistantPage token={token} initialQuestion={assistantQuestion} /> : page === "progress" ? <ProgressPage token={token} profile={profile} /> : <GamificationPage token={token} />}</main>
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
