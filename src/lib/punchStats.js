// Aggregate views over the compact punch_training_samples data (see
// db.js's getPunchSampleSummary / armTracker.js's summarizeSeed for the
// live-calibration use of the same table) — this file is the "look back
// at what's already accumulated" side: arm balance for the AI coach,
// a weekly speed trend for the profile, and a simple month-over-month
// power-increase check for badges.

const DAY_MS = 24 * 60 * 60 * 1000;

function average(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function startOfWeekMonday(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.getTime();
}

// Left vs right average speed — needs at least a handful of samples per
// side, otherwise one lucky/unlucky punch would swing the "balance"
// wildly. Returns null (no line added to the coach prompt) until then.
export function summarizeBalance(samples) {
  const bySide = { left: [], right: [] };
  (samples || []).forEach((s) => {
    if (bySide[s.side]) bySide[s.side].push(s.speed);
  });
  if (bySide.left.length < 5 || bySide.right.length < 5) return null;
  return {
    leftAvgSpeed: average(bySide.left),
    rightAvgSpeed: average(bySide.right),
    sampleCount: bySide.left.length + bySide.right.length,
  };
}

// Weekly average speed for the last `weeks` calendar weeks (Monday-start,
// matching the app's other weekly aggregates) — a week with no samples
// shows as a gap (avg: null) rather than a misleading zero.
export function computeWeeklySpeedTrend(samples, weeks, lang, now = Date.now()) {
  const thisWeekStart = startOfWeekMonday(now);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = thisWeekStart - i * 7 * DAY_MS;
    const weekEnd = weekStart + 7 * DAY_MS;
    const inWeek = samples.filter((s) => s.createdAt >= weekStart && s.createdAt < weekEnd).map((s) => s.speed);
    buckets.push({
      label: i === 0 ? (lang === "en" ? "This wk" : "Bu hafta") : `-${i}`,
      avg: inWeek.length ? Math.round(average(inWeek) * 100) / 100 : null,
    });
  }
  return buckets;
}

// Meaningfully faster (not just noisier) this month than last month —
// requires a real sample size in both windows so one big session doesn't
// trip a badge that isn't really about sustained improvement.
export function hasPowerIncrease(samples, now = Date.now()) {
  const oneMonthAgo = now - 30 * DAY_MS;
  const twoMonthsAgo = now - 60 * DAY_MS;
  const thisMonth = samples.filter((s) => s.createdAt >= oneMonthAgo).map((s) => s.speed);
  const lastMonth = samples.filter((s) => s.createdAt >= twoMonthsAgo && s.createdAt < oneMonthAgo).map((s) => s.speed);
  if (thisMonth.length < 8 || lastMonth.length < 8) return false;
  return average(thisMonth) > average(lastMonth) * 1.05;
}
