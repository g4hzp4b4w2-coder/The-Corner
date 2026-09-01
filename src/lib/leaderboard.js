import { supabase } from "./supabaseClient";

export async function getLeaderboard() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const res = await fetch("/api/leaderboard", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with ${res.status}`);
  }
  const body = await res.json();
  return body.leaderboard;
}
