import { useState } from "react";
import { logPackagedFood, lookupBarcode, suggestBrands } from "../api/packagedFoodApi";

export default function PackagedFoodPage({ token, onAskAssistant }) {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState(null);
  const [servings, setServings] = useState("1");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");

  async function findProduct(event) {
    event.preventDefault();
    if (!barcode.trim()) return;
    setLoading(true); setError(""); setMessage(""); setProduct(null);
    try {
      const result = await lookupBarcode(barcode.trim(), token);
      setProduct(result);
      setServings("1");
    } catch (requestError) {
      setError(requestError.message || "Product lookup failed.");
    } finally { setLoading(false); }
  }

  async function saveProduct() {
    if (!product || Number(servings) <= 0) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await logPackagedFood({ ...product, servings_consumed: Number(servings) }, token);
      setMessage(`${product.product_name} saved to your food log.`);
    } catch (requestError) {
      setError(requestError.message || "Could not save this product.");
    } finally { setSaving(false); }
  }

  async function saveSuggestion(item) {
    setSaving(true); setError(""); setMessage("");
    try {
      await logPackagedFood({ product_name: item.product_name, brand: item.brand, barcode: item.barcode, serving_size_grams: item.serving_size_grams, servings_consumed: 1, calories_per_serving: item.calories_per_serving, protein_g_per_serving: item.protein_g_per_serving, carbs_g_per_serving: item.carbs_g_per_serving, fat_g_per_serving: item.fat_g_per_serving, ingredients_text: item.ingredients_text }, token);
      setMessage(`${item.product_name} saved to your diary and counted in your daily totals.`);
    } catch (requestError) { setError(requestError.message || "Could not save this product."); }
    finally { setSaving(false); }
  }

  async function findSuggestions(event) {
    event.preventDefault();
    if (!query.trim()) return;
    setError("");
    setSuggestionsLoading(true); setSearchedQuery(query.trim()); setSuggestions([]);
    try { setSuggestions(await suggestBrands(query.trim(), token)); }
    catch (requestError) { setError(requestError.message || "Could not load suggestions."); }
    finally { setSuggestionsLoading(false); }
  }

  return (
    <section className="feature-page">
      <header className="feature-heading"><p className="dashboard-overline">Packaged food</p><h1>Scan or enter a barcode</h1><p>Look up verified label data, adjust servings, and save what you ate.</p></header>
      <form className="feature-form" onSubmit={findProduct}><label htmlFor="barcode-input">Barcode number</label><div className="feature-input-row"><input id="barcode-input" inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Digits printed below the product barcode" /><button className="dashboard-primary-button" disabled={loading || !barcode.trim()}>{loading ? "Looking up…" : "Look up"}</button></div><small className="feature-footnote">Enter the digits under the barcode (usually 8–13 numbers). Open Food Facts may not have every local product. If it cannot find yours, search by food name below.</small></form>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {message && <p className="feature-success" role="status">{message}</p>}
      {product && <article className="dashboard-card packaged-result"><p className="card-eyebrow">Open Food Facts result</p><h2>{product.product_name}</h2><p>{product.brand || "Brand unavailable"} · {product.serving_size_grams} g per serving</p><div className="feature-nutrients"><span>{product.calories_per_serving} kcal</span><span>Protein {product.protein_g_per_serving} g</span><span>Carbs {product.carbs_g_per_serving} g</span><span>Fat {product.fat_g_per_serving} g</span></div><label className="serving-count" htmlFor="servings-count">Servings eaten</label><input id="servings-count" type="number" min="0.25" max="20" step="0.25" value={servings} onChange={(event) => setServings(event.target.value)} /><button className="dashboard-primary-button" type="button" disabled={saving || Number(servings) <= 0} onClick={saveProduct}>{saving ? "Saving…" : "Save packaged food"}</button><button type="button" className="dashboard-text-button" onClick={() => onAskAssistant?.(`I am considering ${product.product_name} (${product.calories_per_serving} kcal per ${product.serving_size_grams} g serving). How does it fit my diet and goal?`)}>Ask assistant about this product</button>{product.ingredients_text && <details><summary>Ingredients</summary><p>{product.ingredients_text}</p></details>}</article>}
      <section className="dashboard-card brand-suggestions"><p className="card-eyebrow">Diet and goal aware</p><h2>Find better-fit brands</h2><form className="feature-input-row" onSubmit={findSuggestions}><label className="sr-only" htmlFor="brand-query">Food to search</label><input id="brand-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a product, e.g. Parle-G" /><button className="dashboard-primary-button" disabled={!query.trim() || suggestionsLoading}>{suggestionsLoading ? "Searching…" : "Find options"}</button></form>{suggestionsLoading && <p role="status">Searching Open Food Facts…</p>}{!suggestionsLoading && searchedQuery && suggestions.length === 0 && <p role="status">No products with complete nutrition data were found for “{searchedQuery}”. Try “Parle-G” or “glucose biscuits”; if the catalog is temporarily unavailable, try again shortly.</p>}{suggestions.map((item, index) => <article className="suggestion-row" key={`${item.product_name}-${index}`}><strong>{item.product_name}</strong><span>{item.brand || "Brand unavailable"} · {item.calories_per_serving} kcal / {item.serving_size_grams} g · P {item.protein_g_per_serving} g · C {item.carbs_g_per_serving} g · F {item.fat_g_per_serving} g</span><small>{item.reason}</small><button type="button" className="dashboard-text-button" disabled={saving} onClick={() => saveSuggestion(item)}>Log this serving</button><button type="button" className="dashboard-text-button" onClick={() => onAskAssistant?.(`I found ${item.product_name} by ${item.brand || "an unknown brand"}, ${item.calories_per_serving} kcal per ${item.serving_size_grams} g serving. Is this a good fit for my diet and goal?`)}>Ask assistant</button></article>)}</section>
    </section>
  );
}
