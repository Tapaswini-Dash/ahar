import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function localDateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export default function MiniCalendar({
  selectedDate,
  onSelect,
  statuses = {},
  onToggleFasting,
}) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const base = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [menuFor, setMenuFor] = useState(null);
  const containerRef = useRef(null);

useEffect(() => {
  if (!menuFor) return;
  function onDocMouseDown(event) {
    if (containerRef.current?.contains(event.target)) return;
    setMenuFor(null);
  }
  function onKey(e) { if (e.key === "Escape") setMenuFor(null); }
  document.addEventListener("mousedown", onDocMouseDown);
  document.addEventListener("keydown", onKey);
  return () => {
    document.removeEventListener("mousedown", onDocMouseDown);
    document.removeEventListener("keydown", onKey);
  };
}, [menuFor]);

  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(`${selectedDate}T12:00:00`);
    setMonthCursor((cur) =>
      cur.getFullYear() === d.getFullYear() && cur.getMonth() === d.getMonth()
        ? cur
        : new Date(d.getFullYear(), d.getMonth(), 1)
    );
  }, [selectedDate]);

  const cells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const leading = Array.from({ length: firstWeekday }, () => null);
    const days = Array.from(
      { length: daysInMonth },
      (_, i) => new Date(year, month, i + 1)
    );
    const trailing = Array.from(
      { length: (7 - ((leading.length + days.length) % 7)) % 7 },
      () => null
    );
    return [...leading, ...days, ...trailing];
  }, [monthCursor]);

  const todayKey = localDateKey();
  const monthLabel = monthCursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function shiftMonth(delta) {
    setMonthCursor((cur) => new Date(cur.getFullYear(), cur.getMonth() + delta, 1));
  }

  function openMenu(dateKey, event) {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuFor({
      dateKey,
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    });
  }

  function handleRightClick(event, dateKey) {
    event.preventDefault();
    openMenu(dateKey, event);
  }

  return (
    <div className="mini-calendar" ref={containerRef}>
      <header className="mini-calendar-head">
        <button
          type="button"
          className="mini-calendar-arrow"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
        >
          ←
        </button>
        <span className="mini-calendar-month">{monthLabel}</span>
        <button
          type="button"
          className="mini-calendar-arrow"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
        >
          →
        </button>
      </header>

      <div className="mini-calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>

      <div className="mini-calendar-grid">
        {cells.map((date, i) => {
          if (!date) return <span key={`pad-${i}`} className="mini-calendar-pad" />;

          const key = localDateKey(date);
          const status = statuses[key] || {};
          const isSelected = key === selectedDate;
          const isToday = key === todayKey;
          const isFuture = key > todayKey;

          const classes = [
            "mini-calendar-day",
            isSelected && "is-selected",
            isToday && "is-today",
            isFuture && "is-future",
            status.fasting && "is-fasting",
            status.hasMeals && "has-meals",
          ]
            .filter(Boolean)
            .join(" ");

          const title = status.fasting
            ? "Fasting day — right-click to change"
            : status.hasMeals
            ? "Meals logged — right-click to mark fasting"
            : "No meals — right-click to mark fasting";

          return (
            <button
              key={key}
              type="button"
              className={classes}
              onClick={() => onSelect?.(key)}
              onContextMenu={(e) => handleRightClick(e, key)}
              title={title}
              aria-pressed={isSelected}
            >
              <span className="mini-calendar-day-number">{date.getDate()}</span>
              {status.fasting && (
                <span className="mini-calendar-day-moon" aria-hidden="true">
                  🌙
                </span>
              )}
              {!status.fasting && status.hasMeals && (
                <span className="mini-calendar-day-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {menuFor && (
        <div
          className="mini-calendar-menu"
          style={{
            top: menuFor.y + 6,
            left: menuFor.x,
            transform: "translateX(-50%)",
          }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
<button
  type="button"
  role="menuitem"
  onClick={async (event) => {
    event.stopPropagation();          // ← stop bubbling
    event.preventDefault();
    const currentlyFasting = statuses[menuFor.dateKey]?.fasting;
    const key = menuFor.dateKey;
    await onToggleFasting?.(key, !currentlyFasting);
    setMenuFor(null);                 // ← only close AFTER the toggle completes
  }}
>
  {statuses[menuFor.dateKey]?.fasting
    ? "Unmark fasting"
    : "Mark as fasting day"}
</button>
        </div>
      )}
    </div>
  );
}