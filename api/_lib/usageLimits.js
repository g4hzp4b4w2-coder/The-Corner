// Free-tier usage caps for the AI-backed endpoints (each real call costs
// Anthropic API money). No payment/subscription system exists yet — this is
// just the cost-control wall. When a paid plan is added later, an active
// subscriber should simply skip these checks; the recording/counting logic
// underneath doesn't need to change.
const FREE_LIMITS = { chat: 10, plan: 1, video: 3 };

// "chat" resets daily, "plan" and "video" reset on the calendar month —
// matches how the limits were described to users (10/day, 1/month, 3/month).
function periodStart(kind) {
  const now = new Date();
  if (kind === "chat") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function periodEnd(kind) {
  const now = new Date();
  if (kind === "chat") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

export async function checkUsage(userId, kind) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const limit = FREE_LIMITS[kind];
  // Fail open: if usage tracking itself is misconfigured or unreachable,
  // never let that block the actual coaching feature.
  if (!supabaseUrl || !serviceKey) return { allowed: true };
  try {
    const since = periodStart(kind);
    const res = await fetch(
      `${supabaseUrl}/rest/v1/ai_usage?user_id=eq.${userId}&kind=eq.${kind}&created_at=gte.${since}&select=id`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!res.ok) return { allowed: true };
    const rows = await res.json();
    const count = Array.isArray(rows) ? rows.length : 0;
    return { allowed: count < limit, resetAt: periodEnd(kind) };
  } catch {
    return { allowed: true };
  }
}

export async function recordUsage(userId, kind) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/ai_usage`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ user_id: userId, kind }),
    });
  } catch {
    // best-effort — never let this block a successful response
  }
}

export function limitMessage(kind, resetAt, lang) {
  const dateStr = new Date(resetAt).toLocaleDateString(lang === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long" });
  const MESSAGES = {
    chat: {
      tr: "Bugünlük ücretsiz koç mesajı hakkını kullandın. Yarın tekrar deneyebilirsin.",
      en: "You've used today's free coach messages. Try again tomorrow.",
    },
    plan: {
      tr: `Bu ayki ücretsiz AI plan hakkını kullandın. ${dateStr} tarihinde yenilenecek.`,
      en: `You've used this month's free AI plan. It renews on ${dateStr}.`,
    },
    video: {
      tr: `Bu ayki ücretsiz video analiz hakkını kullandın. ${dateStr} tarihinde yenilenecek.`,
      en: `You've used this month's free video analyses. It renews on ${dateStr}.`,
    },
  };
  return MESSAGES[kind][lang] || MESSAGES[kind].tr;
}
