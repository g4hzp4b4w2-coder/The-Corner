import { verifyUser } from "./_lib/verifyUser.js";

const MODEL = "claude-haiku-4-5-20251001";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function fetchFreshNews(lang) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const system =
    lang === "en"
      ? `Search the web for 5-6 real, current or upcoming boxing events. Cover a mix: (1) major internationally broadcast fights/title cards (the kind aired on platforms like DAZN, ESPN, etc.), and (2) Turkey-based tournaments/federation events if you find good ones. Don't limit yourself to only local events — actively look for big-name upcoming cards too. After searching, respond ONLY with a JSON array, nothing else, in this exact shape: [{"fighters": "event or matchup name", "weight": "weight class or 'All classes'", "date": "date as found", "venue": "city/venue"}]. Only include events you found real evidence for — never invent one.`
      : `5-6 gerçek, güncel ya da yaklaşan boks etkinliği için web'de arama yap. Karışık bir liste olsun: (1) büyük, uluslararası yayınlanan maçlar/başlık maçları (DAZN, ESPN gibi platformlarda yayınlanan türden), ve (2) bulabilirsen Türkiye'deki turnuva/federasyon etkinlikleri. Sadece yerel etkinliklerle sınırlı kalma — yaklaşan büyük isimli maçları da aktif olarak ara. Arama sonrası SADECE şu JSON formatında bir dizi döndür, başka hiçbir şey yazma: [{"fighters": "etkinlik/eşleşme adı", "weight": "sıklet ya da 'Tüm sıklet'", "date": "bulduğun tarih", "venue": "şehir/mekan"}]. Sadece gerçekten kanıt bulduğun etkinlikleri ekle, asla uydurma.`;

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

  try {
    const cacheRes = await fetch(`${supabaseUrl}/rest/v1/match_news_cache?lang=eq.${lang}&select=items,updated_at`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const cacheRows = await cacheRes.json();
    const cached = Array.isArray(cacheRows) ? cacheRows[0] : null;
    const isStale = force || !cached || Date.now() - new Date(cached.updated_at).getTime() > CACHE_MAX_AGE_MS;

    if (!isStale) {
      res.status(200).json({ items: cached.items, refreshed: false });
      return;
    }

    let items;
    try {
      items = await fetchFreshNews(lang);
    } catch (e) {
      if (cached) {
        res.status(200).json({ items: cached.items, refreshed: false, staleFallback: true });
        return;
      }
      throw e;
    }

    await fetch(`${supabaseUrl}/rest/v1/match_news_cache?lang=eq.${lang}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ items, updated_at: new Date().toISOString() }),
    });

    res.status(200).json({ items, refreshed: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}
