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

const DAY_MS = 86400000;

// Whole calendar days between two local midnights. Rounded, not floored: across a DST boundary a
// local day is 23 or 25 hours, so the difference is not an exact multiple of DAY_MS.
function daysBetween(iso, nowMs) {
  return Math.round((localDay(nowMs) - localDay(iso)) / DAY_MS);
}

// How long ago, in the words a reader uses. Thresholds are the ones the app already shipped.
function relDay(iso, nowMs) {
  const days = daysBetween(iso, nowMs);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 31) return `${Math.floor(days / 7)} weeks ago`;
  const d = new Date(iso);
  const opts = { month: 'short', day: 'numeric' };
  // A bare "Mar 4" reads as this year, so an older memo has to say which year it is.
  if (d.getFullYear() !== new Date(nowMs).getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

// The date a memo carries, as a reader reads it: "edited 3 days ago", "created today". A memo whose
// two timestamps are identical has never been edited, so it always reads "created" — otherwise an
// untouched memo would claim an edit that never happened. `now` is injectable for tests.
export function memoDateLabel(note, field = 'updated_at', now = Date.now()) {
  const wasEdited = note.created_at !== note.updated_at;
  const verb = field === 'updated_at' && wasEdited ? 'edited' : 'created';
  return `${verb} ${relDay(note[field], now)}`;
}

// Is `iso` inside the local-calendar-day range [from, to]? Bounds are "YYYY-MM-DD" strings off an
// <input type="date">; either may be empty for an open end, and both ends are inclusive. Comparing
// local midnights (rather than the raw instants) is what makes a memo written at 00:30 fall inside
// its own day.
export function inRange(iso, from, to) {
  const day = localDay(iso).getTime();
  if (from && day < localDay(from).getTime()) return false;
  if (to && day > localDay(to).getTime()) return false;
  return true;
}
