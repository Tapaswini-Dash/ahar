import { useCallback, useState } from "react";
import { listMealsForDay, localDateTimeInput, localDateTimeIso } from "../api/mealLogsApi";
import {
  logPackagedFood,
  lookupBarcode,
  readPackagedLabel,
  suggestBrands,
} from "../api/packagedFoodApi";
import BarcodeScanner from "../components/packaged-food/BarcodeScanner";

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const NUTRIENT_FIELDS = [
  ["Calories", "calories_per_serving", "kcal"],
  ["Protein", "protein_g_per_serving", "g"],
  ["Carbs", "carbs_g_per_serving", "g"],
  ["Fat", "fat_g_per_serving", "g"],
];

export default function PackagedFoodPage({ token, profile, onAskAssistant }) {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState(null);
  const [servings, setServings] = useState("1");
  const [loggedAt, setLoggedAt] = useState(localDateTimeInput);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [labelLoading, setLabelLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [compareItems, setCompareItems] = useState([]);
  const [goalPrompt, setGoalPrompt] = useState(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState(null);

  const lookup = useCallback(
    async (code) => {
      if (!code.trim()) return;
      setBarcode(code.trim());
      setLoading(true);
      setError("");
      setMessage("");
      setProduct(null);
      setScanning(false);
      try {
        const result = await lookupBarcode(code.trim(), token);
        setProduct(result);
        setServings("1");
      } catch (requestError) {
        setError(
          requestError.message ||
            "Product lookup failed. If the code has no nutrition record, upload a label photo below."
        );
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  async function findProduct(event) {
    event.preventDefault();
    await lookup(barcode);
  }

  async function scanLabel(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLabelLoading(true);
    setError("");
    setMessage("");
    setProduct(null);
    try {
      const label = await readPackagedLabel(file, token);
      const servingSize = numberOrNull(label.serving_size_grams) || 100;
      const factor = label.nutrition_basis === "per_100g" ? servingSize / 100 : 1;
      const perServing = (value) =>
        value == null ? null : Math.round(Number(value) * factor * 10) / 10;
      const foundBarcode = label.barcode?.replace(/\D/g, "") || "";
      if (foundBarcode) setBarcode(foundBarcode);
      setProduct({
        product_name: label.product_name || "",
        brand: label.brand || "",
        barcode: foundBarcode || null,
        serving_size_grams: servingSize,
        calories_per_serving: perServing(label.calories),
        protein_g_per_serving: perServing(label.protein_g),
        carbs_g_per_serving: perServing(label.carbs_g),
        fat_g_per_serving: perServing(label.fat_g),
        ingredients_text: label.ingredients_text || "",
        nutrition_source: "label_ocr",
        image_url: null,
        needs_review: true,
      });
      setServings("1");
      setMessage(
        `Label read from the photo. Please verify every value before saving${
          label.nutrition_basis === "per_100g"
            ? ` — scaled from per 100 g to ${servingSize} g.`
            : "."
        }`
      );
    } catch (requestError) {
      setError(
        requestError.message ||
          "Could not read that label. Try a clear photo of the ingredients and nutrition panels."
      );
    } finally {
      setLabelLoading(false);
    }
  }

  function updateProduct(field, value) {
    setProduct((current) => ({ ...current, [field]: value }));
  }

  async function saveEntry(entry, servingsConsumed, { allowDuplicate = false, goalConfirmed = false } = {}) {
    const consumed = Number(servingsConsumed);
    const values = NUTRIENT_FIELDS.map(([, field]) => numberOrNull(entry[field]));
    if (
      !entry.product_name?.trim() ||
      !Number(entry.serving_size_grams) ||
      values.some((value) => value === null || value < 0)
    ) {
      setError("Check the product name, serving size, calories, protein, carbs, and fat before saving.");
      return;
    }
    if (!Number.isFinite(consumed) || consumed <= 0) {
      setError("Enter a valid number of servings eaten.");
      return;
    }

    const target = Number(profile?.daily_calorie_target || 0);
    const entryDate = loggedAt.slice(0, 10);
    const today = localDateTimeInput().slice(0, 10);
    if (!goalConfirmed && target > 0 && entryDate === today) {
      try {
        const meals = await listMealsForDay(today, token, new Date(`${today}T12:00:00`));
        const currentCalories = meals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0);
        const extraCalories = values[0] * consumed;
        if (currentCalories >= target || currentCalories + extraCalories >= target) {
          setGoalPrompt({ entry, servings: consumed, allowDuplicate });
          return;
        }
      } catch (requestError) {
        setError(requestError.message || "Could not check today’s calorie total.");
        return;
      }
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...entry,
        product_name: entry.product_name.trim(),
        brand: entry.brand?.trim() || null,
        barcode: entry.barcode?.trim() || null,
        serving_size_grams: Number(entry.serving_size_grams),
        servings_consumed: consumed,
        calories_per_serving: values[0],
        protein_g_per_serving: values[1],
        carbs_g_per_serving: values[2],
        fat_g_per_serving: values[3],
        logged_at: localDateTimeIso(new Date(loggedAt)),
        allow_duplicate: allowDuplicate,
      };
      const saved = await logPackagedFood(payload, token);
      setMessage(`${saved.product_name} saved at ${new Date(saved.logged_at).toLocaleString()}.`);
      setGoalPrompt(null);
      setDuplicatePrompt(null);
    } catch (requestError) {
      const detail = requestError.payload?.detail;
      if (requestError.status === 409 && detail?.code === "duplicate_product") {
        setDuplicatePrompt({ entry, servings: consumed, existing: detail.existing });
      } else {
        setError(requestError.message || "Could not save this product.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveProduct(options) {
    if (product) await saveEntry(product, servings, options);
  }

  async function saveSuggestion(item) {
    await saveEntry({ ...item, nutrition_source: "open_food_facts" }, 1);
  }

  async function findSuggestions(event) {
    event.preventDefault();
    if (!query.trim()) return;
    setError("");
    setSuggestionsLoading(true);
    setSearchedQuery(query.trim());
    setSuggestions([]);
    setCompareItems([]);
    try {
      setSuggestions(await suggestBrands(query.trim(), token));
    } catch (requestError) {
      setError(requestError.message || "Could not load suggestions.");
    } finally {
      setSuggestionsLoading(false);
    }
  }

  function toggleCompare(index) {
    setCompareItems((current) =>
      current.includes(index)
        ? current.filter((i) => i !== index)
        : current.length >= 3
        ? current
        : [...current, index]
    );
  }

  function bestInGroup(field, lowerIsBetter = false) {
    const values = compareItems
      .map((i) => Number(suggestions[i]?.[field]))
      .filter((v) => Number.isFinite(v));
    if (values.length === 0) return null;
    return lowerIsBetter ? Math.min(...values) : Math.max(...values);
  }

  return (
    <section className="feature-page packaged-page">
      <header className="feature-heading">
        <p className="dashboard-overline">Packaged food</p>
        <h1>Find the better fit</h1>
        <p>Scan a barcode or upload a label, then compare options against your goal.</p>
      </header>

      {/* STEP 1 — Lookup */}
      <section className="dashboard-card packaged-step">
        <div className="packaged-step-head">
          <span className="packaged-step-badge">1</span>
          <div>
            <h2>Find the product</h2>
            <p>Enter the barcode, scan it, or upload a label photo.</p>
          </div>
        </div>

        <form className="packaged-barcode-form" onSubmit={findProduct}>
          <label className="field">
            <span className="field-label">Barcode number</span>
            <input
              className="field-input"
              inputMode="numeric"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Digits printed below the barcode"
            />
          </label>
          <div className="packaged-barcode-actions">
            <button
              className="primary-button"
              disabled={loading || !barcode.trim()}
              type="submit"
            >
              {loading ? "Looking up…" : "Look up"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setScanning(true)}
            >
              📷 Scan
            </button>
          </div>
        </form>

        <div className="packaged-divider"><span>or</span></div>

        <label className={`upload-dropzone${labelLoading ? " is-loading" : ""}`}>
          <span className="upload-dropzone-icon" aria-hidden="true">⬆</span>
          <span className="upload-dropzone-title">
            {labelLoading ? "Reading label…" : "Upload ingredient + nutrition label"}
          </span>
          <span className="upload-dropzone-hint">
            Clear, well-lit photo of the nutrition and ingredients panels
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={scanLabel}
            disabled={labelLoading}
          />
        </label>

        {scanning && (
          <div className="packaged-scanner">
            <BarcodeScanner onDetected={lookup} onClose={() => setScanning(false)} />
          </div>
        )}
      </section>

      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {message && <p className="feature-success" role="status">{message}</p>}

      {/* STEP 2 — Product details */}
      {product && (
        <article className="dashboard-card packaged-step">
          <div className="packaged-step-head">
            <span className="packaged-step-badge">2</span>
            <div>
              <h2>Review product</h2>
              <p>
                {product.nutrition_source === "label_ocr"
                  ? "Transcribed from photo — please verify before saving."
                  : "Matched from Open Food Facts."}
              </p>
            </div>
          </div>

          <div className="packaged-grid">
            <label className="field">
              <span className="field-label">Product name</span>
              <input
                className="field-input"
                value={product.product_name}
                onChange={(e) => updateProduct("product_name", e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Brand</span>
              <input
                className="field-input"
                value={product.brand || ""}
                onChange={(e) => updateProduct("brand", e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Serving size (g)</span>
              <input
                className="field-input"
                type="number"
                min="1"
                step="1"
                value={product.serving_size_grams}
                onChange={(e) => updateProduct("serving_size_grams", e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Servings eaten</span>
              <input
                className="field-input"
                type="number"
                min="0.25"
                max="20"
                step="0.25"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </label>
          </div>

          <div className="packaged-nutrients">
            {NUTRIENT_FIELDS.map(([label, field, unit]) => (
              <label className="nutrient-tile" key={field}>
                <span className="nutrient-tile-label">{label}</span>
                <input
                  className="nutrient-tile-input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={product[field] ?? ""}
                  onChange={(e) =>
                    updateProduct(field, e.target.value === "" ? null : Number(e.target.value))
                  }
                />
                <span className="nutrient-tile-unit">{unit}</span>
              </label>
            ))}
          </div>

          <label className="field">
            <span className="field-label">Eaten on</span>
            <input
              className="field-input"
              type="datetime-local"
              max={localDateTimeInput()}
              value={loggedAt}
              onChange={(e) => setLoggedAt(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Ingredients (check against package)</span>
            <textarea
              className="field-input"
              rows="3"
              value={product.ingredients_text || ""}
              onChange={(e) => updateProduct("ingredients_text", e.target.value)}
              placeholder="No ingredient text found. You can transcribe it from the label."
            />
          </label>

          <div className="packaged-actions">
            <button
              className="primary-button"
              type="button"
              disabled={saving || Number(servings) <= 0}
              onClick={() => saveProduct()}
            >
              {saving ? "Saving…" : "Confirm and log this food"}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                onAskAssistant?.(
                  `I am considering ${product.product_name} (${product.calories_per_serving} kcal per ${product.serving_size_grams} g serving). Ingredients: ${
                    product.ingredients_text || "not available"
                  }. How does it fit my diet and goal?`
                )
              }
            >
              Ask assistant about this product
            </button>
          </div>
        </article>
      )}

      {/* Goal / duplicate prompts */}
      {(goalPrompt || duplicatePrompt) && (
        <div className="goal-warning" role="dialog" aria-modal="true">
          {duplicatePrompt ? (
            <>
              <strong>You already logged this product today.</strong>
              <p>
                Last logged at{" "}
                {duplicatePrompt.existing?.logged_at
                  ? new Date(duplicatePrompt.existing.logged_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "an earlier time"}
                . Add this as another serving?
              </p>
              <div className="goal-warning-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setDuplicatePrompt(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    saveEntry(duplicatePrompt.entry, duplicatePrompt.servings, {
                      allowDuplicate: true,
                      goalConfirmed: true,
                    })
                  }
                >
                  Log another serving
                </button>
              </div>
            </>
          ) : (
            <>
              <strong>You have reached today’s calorie target.</strong>
              <p>Do you still want to log this product to keep your diary accurate?</p>
              <div className="goal-warning-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setGoalPrompt(null)}
                >
                  Go back
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    saveEntry(goalPrompt.entry, goalPrompt.servings, {
                      allowDuplicate: goalPrompt.allowDuplicate,
                      goalConfirmed: true,
                    })
                  }
                >
                  Log anyway
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 3 — Compare alternatives */}
      <section className="dashboard-card packaged-step">
        <div className="packaged-step-head">
          <span className="packaged-step-badge">3</span>
          <div>
            <h2>Compare alternatives</h2>
            <p>Search a product type or brand, then select up to three to compare.</p>
          </div>
        </div>

        <form className="packaged-barcode-form" onSubmit={findSuggestions}>
          <label className="field">
            <span className="field-label">Search</span>
            <input
              className="field-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. chips, protein bar, oat milk"
            />
          </label>
          <div className="packaged-barcode-actions">
            <button
              className="primary-button"
              disabled={!query.trim() || suggestionsLoading}
              type="submit"
            >
              {suggestionsLoading ? "Searching…" : "Find options"}
            </button>
            {suggestions.length > 0 && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setCompareItems([])}
              >
                Clear selection
              </button>
            )}
          </div>
        </form>

        {suggestionsLoading && <p className="packaged-status">Searching Open Food Facts…</p>}
        {!suggestionsLoading && searchedQuery && suggestions.length === 0 && (
          <p className="packaged-status">
            No products with complete nutrition data for “{searchedQuery}”. Try a product type or
            brand name.
          </p>
        )}

        {suggestions.length > 0 && (
          <>
            <p className="packaged-status">
              {compareItems.length === 0
                ? "Select 2–3 items to compare."
                : `${compareItems.length} selected (max 3).`}
            </p>

            <div className="suggestion-list">
              {suggestions.map((item, index) => {
                const selected = compareItems.includes(index);
                return (
                  <article
                    key={`${item.product_name}-${index}`}
                    className={`suggestion-card${selected ? " is-selected" : ""}`}
                  >
                    <header className="suggestion-card-head">
                      <div>
                        <strong>{item.product_name}</strong>
                        <span className="suggestion-brand">{item.brand || "Brand unavailable"}</span>
                      </div>
                      <label className="suggestion-compare">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!selected && compareItems.length >= 3}
                          onChange={() => toggleCompare(index)}
                        />
                        Compare
                      </label>
                    </header>
                    <div className="suggestion-macros">
                      <span>{item.calories_per_serving} kcal</span>
                      <span>P {item.protein_g_per_serving} g</span>
                      <span>C {item.carbs_g_per_serving} g</span>
                      <span>F {item.fat_g_per_serving} g</span>
                      <span className="suggestion-serving">
                        per {item.serving_size_grams} g
                      </span>
                    </div>
                    {item.reason && <p className="suggestion-reason">{item.reason}</p>}
                    <div className="suggestion-actions">
                      <button
                        type="button"
                        className="text-button"
                        disabled={saving}
                        onClick={() => saveSuggestion(item)}
                      >
                        Log this serving
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          onAskAssistant?.(
                            `I found ${item.product_name} by ${
                              item.brand || "an unknown brand"
                            }, ${item.calories_per_serving} kcal per ${
                              item.serving_size_grams
                            } g serving. Is this a good fit for my diet and goal?`
                          )
                        }
                      >
                        Ask assistant
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {compareItems.length >= 2 && (
          <div className="compare-block">
            <h3 className="compare-title">Nutrition comparison (per serving)</h3>
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th scope="col">Nutrient</th>
                    {compareItems.map((index) => (
                      <th scope="col" key={`head-${index}`}>
                        <span className="compare-product">
                          {suggestions[index].brand || "Brand unavailable"}
                        </span>
                        <strong>{suggestions[index].product_name}</strong>
                        <span className="compare-serving">
                          per {suggestions[index].serving_size_grams} g
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {NUTRIENT_FIELDS.map(([label, field, unit]) => {
                    const best = bestInGroup(field, label === "Calories");
                    return (
                      <tr key={field}>
                        <th scope="row">{label}</th>
                        {compareItems.map((index) => {
                          const value = Number(suggestions[index][field]);
                          const isBest =
                            best !== null && Number.isFinite(value) && value === best;
                          return (
                            <td key={`${field}-${index}`} className={isBest ? "is-best" : ""}>
                              {suggestions[index][field]} {unit}
                              {isBest && <span className="best-tag">best</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="compare-caption">
              “Best” highlights the lowest calories and highest protein, carbs, and fat per serving.
              Choose based on what your goal needs most.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}