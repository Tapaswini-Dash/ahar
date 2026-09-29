import { useEffect } from "react";

export default function RecipeDrawer({ drawer, onChange, onClose, onSave, saving }) {
  // Close on Escape
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!drawer) return null;

  const items = Array.isArray(drawer.items) ? drawer.items : [];

  function updateRow(index, patch) {
    onChange(items.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index) {
    onChange(items.filter((_, i) => i !== index));
  }

function addRow() {
  onChange([...items, { _id: `new-${Date.now()}`, name: "", grams: 0 }]);
}

  const totalGrams = items.reduce((sum, row) => sum + (Number(row.grams) || 0), 0);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className="recipe-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Recipe ingredients editor"
      >
        <header className="recipe-drawer-header">
          <div>
            <p className="card-eyebrow">Recipe review</p>
            <h3>{drawer.title || "Ingredient breakdown"}</h3>
            <p className="recipe-drawer-subtitle">
              {items.length} ingredient{items.length === 1 ? "" : "s"} · {totalGrams.toFixed(0)} g total
            </p>
          </div>
          <button
            type="button"
            className="drawer-close-button"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="recipe-drawer-list">
          <div className="recipe-drawer-row recipe-drawer-row-header">
            <span>Ingredient</span>
            <span>Grams</span>
            <span aria-hidden="true" />
          </div>
          {items.map((ingredient, index) => (
  <div className="recipe-drawer-row" key={ingredient._id || index}>
              <input
                value={ingredient.name}
                onChange={(e) => updateRow(index, { name: e.target.value })}
                placeholder="Ingredient name"
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={ingredient.grams}
                onChange={(e) => updateRow(index, { grams: Number(e.target.value) || 0 })}
                placeholder="g"
              />
              <button
                type="button"
                className="drawer-remove-button"
                onClick={() => removeRow(index)}
                aria-label={`Remove ${ingredient.name || "ingredient"}`}
              >
                ✕
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="recipe-drawer-empty">No ingredients yet. Add one below.</p>
          )}
        </div>

        <footer className="recipe-drawer-footer">
          <button type="button" className="text-button" onClick={addRow}>
            + Add ingredient
          </button>
          <div className="recipe-drawer-actions">
            <button type="button" className="text-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Applying…" : "Apply recipe"}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}