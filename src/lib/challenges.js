const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeekMonday(ts) {
  const d = new Date(startOfDay(ts));
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.getTime();
}

function currentStreakFrom(entries, now) {
  const daySet = new Set(entries.map((e) => startOfDay(e.createdAt)));
  const today = startOfDay(now);
  let cursor = daySet.has(today) ? today : today - DAY_MS;
  let streak = 0;
  while (daySet.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

const POOL = [
  {
    key: "sessions3",
    target: 3,
    label: { tr: "Bu hafta 3 antrenman tamamla", en: "Complete 3 sessions this week" },
    compute: (week) => week.length,
  },
  {
    key: "sessions5",
    target: 5,
    label: { tr: "Bu hafta 5 antrenman tamamla", en: "Complete 5 sessions this week" },
    compute: (week) => week.length,
  },
  {
    key: "streak3",
    target: 3,
    label: { tr: "3 gün üst üste günlük tut", en: "Log 3 days in a row" },
    compute: (week, all, now) => currentStreakFrom(all, now),
  },
  {
    key: "streak5",
    target: 5,
    label: { tr: "5 gün üst üste günlük tut", en: "Log 5 days in a row" },
    compute: (week, all, now) => currentStreakFrom(all, now),
  },
  {
    key: "shadowbox1",
    target: 1,
    label: { tr: "1 gölge boksu seansı ekle", en: "Log 1 shadowboxing session" },
    compute: (week) => week.filter((e) => e.type === "Gölge Boksu").length,
  },
  {
    key: "video1",
    target: 1,
    label: { tr: "1 video analizi yap", en: "Do 1 video analysis" },
    compute: (week) => week.filter((e) => e.hasVideo).length,
  },
  {
    key: "categories3",
    target: 3,
    label: { tr: "3 farklı kategoride çalış", en: "Train 3 different categories" },
    compute: (week) => new Set(week.flatMap((e) => (e.categories?.length ? e.categories : [e.type]))).size,
  },
  {
    key: "note1",
    target: 1,
    label: { tr: "Bir antrenmana not düş", en: "Add a note to a session" },
    compute: (week) => week.filter((e) => e.note && e.note.trim()).length,
  },
  {
    key: "plan1",
    target: 1,
    label: { tr: "Planlanan bir antrenmanı tamamla", en: "Complete a planned session" },
    compute: (week) => week.filter((e) => e.planKey).length,
  },
];

function weekSeed(now) {
  return Math.floor(startOfWeekMonday(now) / (7 * DAY_MS));
}

export function getWeeklyChallenges(entries, lang, now = Date.now()) {
  const seed = weekSeed(now);
  const start = (seed * 3) % POOL.length;
  const weekStart = startOfWeekMonday(now);
  const weekEntries = entries.filter((e) => e.createdAt >= weekStart);

  return [0, 1, 2].map((i) => {
    const ch = POOL[(start + i) % POOL.length];
    const raw = ch.compute(weekEntries, entries, now);
    const current = Math.min(ch.target, raw);
    return {
      key: ch.key,
      label: ch.label[lang] || ch.label.tr,
      target: ch.target,
      current,
      done: current >= ch.target,
    };
  });
}
