const BADGES = {
  database_match: {
    text: "INDB match",
    className: "bg-emerald-100 text-emerald-800",
  },
  database_approx: {
    text: "Approx. INDB match",
    className: "bg-amber-100 text-amber-800",
  },
  ai_estimate: {
    text: "AI estimate",
    className: "bg-purple-100 text-purple-800",
  },
  unresolved: {
    text: "Not found",
    className: "bg-slate-200 text-slate-700",
  },
};

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

export default function NutritionPanel({ nutrition }) {
  if (!nutrition) return null;

  const { items = [], totals = {}, resolved_items, total_items, is_partial } =
    nutrition;

  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-emerald-900">
        Nutrition estimate
      </h3>

      <div className="mt-3 rounded-xl bg-emerald-50 p-4">
        <div className="text-xs font-semibold uppercase text-emerald-700">
          Meal total
        </div>
        <div className="text-3xl font-bold text-emerald-900">
          {fmt(totals.energy_kcal)} kcal
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Macro label="Protein" value={totals.protein_g} />
          <Macro label="Carbs" value={totals.carb_g} />
          <Macro label="Fat" value={totals.fat_g} />
          <Macro label="Fibre" value={totals.fibre_g} />
        </div>
      </div>

      {is_partial && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Only {resolved_items} of {total_items} items have nutrition values, so
          this total is incomplete.
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {items.map((item, index) => {
          const badge = BADGES[item.confidence_label] ?? BADGES.unresolved;
          const showMatch =
            item.matched_name &&
            item.matched_name.toLowerCase() !== item.name.toLowerCase();

          return (
            <li
              key={`${item.name}-${index}`}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">
                    {item.name}
                  </div>
                  <div className="text-sm text-slate-500">
                    {fmt(item.portion_g)} g
                    {showMatch && <> · matched to “{item.matched_name}”</>}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                >
                  {badge.text}
                </span>
              </div>

              {advisories?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {advisories.map((a, i) => (
                     <div key={i} className={`rounded-xl p-3 text-sm ${a.type === "allergy_warning" ? "border border-red-200 bg-red-50 text-red-800" : "border border-amber-200 bg-amber-50 text-amber-900"}`}>
                       {a.message}
                      </div>
                    ))}
                  </div>
                )}

               {goalSwaps?.length > 0 && (
                 <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                   <p className="text-xs font-semibold uppercase text-blue-700 mb-2">Toward your goal</p>
                     {goalSwaps.map((s, i) => (
                   <p key={i} className="text-sm text-blue-900 mb-1">
                     <strong>{s.item}:</strong> {s.suggestion} — <span className="text-blue-700">{s.reason}</span>
                    </p>
                  ))}
                 </div>
               )}

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

      <p className="mt-4 text-xs text-slate-500">
        These are estimates. Please confirm the food names and portion sizes
        before saving.
      </p>
    </section>
  );
}