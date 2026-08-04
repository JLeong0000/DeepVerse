// Memo timestamps are stored as UTC instants (`new Date().toISOString()`), but every date a reader
// sees is a *local calendar day*: "today" means today on their wall calendar, and the Memo page's
// from/to filter takes local dates off an <input type="date">. So no calendar arithmetic happens on
// a UTC value — it all goes through localDay() first.

// Local midnight of the day `value` falls on. Accepts an ISO instant, a "YYYY-MM-DD" string, or a
// Date. The date-only branch is the whole reason this function exists: `new Date('2026-08-05')`
// parses as UTC, which under UTC+8 is 8am local (so a lower bound built that way drops the first
// eight hours of the day) and west of Greenwich is the previous date entirely.
export function localDay(value) {
  if (typeof value === 'string') {
    const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (parts) return new Date(+parts[1], +parts[2] - 1, +parts[3]);
  }
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
