import { verifyUser } from "./_lib/verifyUser.js";

const MODEL = "claude-haiku-4-5-20251001";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function fetchFreshNews(lang) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const system =
    lang === "en"
      ? `Search the web for 5-6 real, current or upcoming boxing events. Cover a mix: (1) major internationally broadcast fights/title cards (the kind aired on platforms like DAZN, ESPN, etc.), and (2) Turkey-based tournaments/federation events if you find good ones. Don't limit yourself to only local events — actively look for big-name upcoming cards too. After searching, respond ONLY with a JSON array, nothing else, in this exact shape: [{"fighters": "event or matchup name", "fighterA": "first boxer's name or null", "fighterB": "second boxer's name or null", "weight": "weight class or 'All classes'", "date": "date as found", "venue": "city/venue"}]. Only set fighterA/fighterB when this is a clean single 1-vs-1 headline matchup you're confident about — leave both null for multi-fight tournaments/events without one clear headline pairing. Only include events you found real evidence for — never invent one.`
      : `5-6 gerçek, güncel ya da yaklaşan boks etkinliği için web'de arama yap. Karışık bir liste olsun: (1) büyük, uluslararası yayınlanan maçlar/başlık maçları (DAZN, ESPN gibi platformlarda yayınlanan türden), ve (2) bulabilirsen Türkiye'deki turnuva/federasyon etkinlikleri. Sadece yerel etkinliklerle sınırlı kalma — yaklaşan büyük isimli maçları da aktif olarak ara. Arama sonrası SADECE şu JSON formatında bir dizi döndür, başka hiçbir şey yazma: [{"fighters": "etkinlik/eşleşme adı", "fighterA": "birinci boksörün adı ya da null", "fighterB": "ikinci boksörün adı ya da null", "weight": "sıklet ya da 'Tüm sıklet'", "date": "bulduğun tarih", "venue": "şehir/mekan"}]. fighterA/fighterB alanlarını SADECE net, tek bir 1'e 1 başlık maçından eminsen doldur — birden çok maçlık bir turnuva/etkinlikse ya da tek bir net eşleşme yoksa ikisini de null bırak. Sadece gerçekten kanıt bulduğun etkinlikleri ekle, asla uydurma.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system,
      messages: [
        {
          role: "user",
          content: lang === "en" ? "Find current boxing events." : "Güncel boks etkinliklerini bul.",
        },
      ],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${await res.text()}`);
  }

  const data = await res.json();
  const textBlocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text);
  const combined = textBlocks.join("\n");
  const match = combined.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Could not parse news JSON from model response");
  return JSON.parse(match[0]);
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
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
    res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server" });
    return;
  }

  const params = req.method === "GET" ? req.query : req.body;
  const lang = params?.lang || "tr";
  const force = params?.force === "1" || params?.force === true;

  async function loadStoredMatches() {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/matches?lang=eq.${lang}&select=id,label,fighter_a,fighter_b,weight,date,venue,updated_at&order=created_at.desc&limit=15`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  function toItem(row) {
    return {
      id: row.id,
      fighters: row.label,
      fighterA: row.fighter_a || null,
      fighterB: row.fighter_b || null,
      weight: row.weight,
      date: row.date,
      venue: row.venue,
    };
  }

  try {
    const stored = await loadStoredMatches();
    const newestUpdate = stored.length > 0 ? Math.max(...stored.map((r) => new Date(r.updated_at).getTime())) : 0;
    const isStale = force || stored.length === 0 || Date.now() - newestUpdate > CACHE_MAX_AGE_MS;

    if (!isStale) {
      res.status(200).json({ items: stored.map(toItem), refreshed: false });
      return;
    }

    let fresh;
    try {
      fresh = await fetchFreshNews(lang);
    } catch (e) {
      if (stored.length > 0) {
        res.status(200).json({ items: stored.map(toItem), refreshed: false, staleFallback: true });
        return;
      }
      throw e;
    }

    const rows = fresh.map((m) => ({
      lang,
      label: m.fighters,
      fighter_a: m.fighterA || null,
      fighter_b: m.fighterB || null,
      weight: m.weight || null,
      date: m.date || null,
      venue: m.venue || null,
      updated_at: new Date().toISOString(),
    }));

    await fetch(`${supabaseUrl}/rest/v1/matches?on_conflict=lang,label,date`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });

    const updated = await loadStoredMatches();
    res.status(200).json({ items: updated.map(toItem), refreshed: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}
