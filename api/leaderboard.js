import { verifyUser } from "./_lib/verifyUser.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function computeStreak(timestamps, now) {
  const daySet = new Set(timestamps.map(startOfDay));
  const today = startOfDay(now);
  let cursor = daySet.has(today) ? today : today - DAY_MS;
  let streak = 0;
  while (daySet.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = await verifyUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Supabase is not configured on the server" });
    return;
  }

  try {
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const [entriesRes, profilesRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/journal_entries?select=user_id,created_at,three_min_rounds,competes`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/profiles?select=user_id,display_name`, { headers }),
    ]);
    if (!entriesRes.ok || !profilesRes.ok) {
      res.status(502).json({ error: "Couldn't load leaderboard data" });
      return;
    }

    const entries = await entriesRes.json();
    const profiles = await profilesRes.json();

    const nameByUser = {};
    profiles.forEach((p) => {
      if (p.display_name) nameByUser[p.user_id] = p.display_name;
    });

    const timestampsByUser = {};
    entries
      .filter((e) => e.competes !== false)
      .forEach((e) => {
        const ts = new Date(e.created_at).getTime();
        (timestampsByUser[e.user_id] ||= []).push({ ts, rounds: e.three_min_rounds || 0 });
      });

    const now = Date.now();
    const weekAgo = now - 7 * DAY_MS;

    const leaderboard = Object.keys(timestampsByUser)
      .filter((userId) => nameByUser[userId])
      .map((userId) => {
        const records = timestampsByUser[userId];
        const timestamps = records.map((r) => r.ts);
        const weekRecords = records.filter((r) => r.ts >= weekAgo);
        return {
          userId,
          displayName: nameByUser[userId],
          weeklySessions: weekRecords.length,
          weeklyRounds: weekRecords.reduce((sum, r) => sum + r.rounds, 0),
          streak: computeStreak(timestamps, now),
          totalSessions: timestamps.length,
        };
      })
      .filter((r) => r.weeklySessions > 0 || r.streak > 0)
      .sort((a, b) => b.weeklySessions - a.weeklySessions || b.streak - a.streak)
      .slice(0, 50);

    res.status(200).json({ leaderboard });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}
