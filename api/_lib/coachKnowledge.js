const MAX_INJECT = 12;

export async function getRecentKnowledge(lang) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return [];
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/coach_knowledge?lang=eq.${lang}&select=insight&order=created_at.desc&limit=${MAX_INJECT}`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows.map((r) => r.insight).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function addKnowledge(insight, lang) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const text = (insight || "").trim();
  if (!supabaseUrl || !serviceKey || !text) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/coach_knowledge`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ insight: text, lang }),
    });
  } catch {
    // best-effort — never let this block or fail the main coaching response
  }
}

export function buildKnowledgeLine(items, lang) {
  if (!items || items.length === 0) return "";
  const header =
    lang === "en"
      ? "General coaching insights you've picked up over time (not tied to any specific person — safe to draw on for anyone):"
      : "Zamanla edindiğin genel koçluk gözlemleri (belirli bir kişiyle ilgili değil — herkes için kullanılabilir):";
  return `\n\n${header}\n${items.map((i) => `- ${i}`).join("\n")}`;
}
