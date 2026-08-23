import { supabase } from "./supabaseClient";

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function callApi(path, payload) {
  const headers = { "content-type": "application/json", ...(await authHeader()) };
  const res = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with ${res.status}`);
  }
  return res.json();
}

export function getChatReply({ messages, images, poseMetrics, videoType, reportMode, caption, profile, entries, lang }) {
  return callApi("/api/coach-chat", { messages, images, poseMetrics, videoType, reportMode, caption, profile, entries, lang });
}

export function getWeeklyPlan({ profile, entries, recentChat, intensity, days, level, focus, timeSlots, categoryBalance, lang }) {
  return callApi("/api/coach-plan", { profile, entries, recentChat, intensity, days, level, focus, timeSlots, categoryBalance, lang });
}
