import { verifyUser } from "./_lib/verifyUser.js";

const MODEL = "claude-haiku-4-5-20251001";

function buildSystemPrompt(profile, entries, lang) {
  const profileLine = [
    profile?.years && `Deneyim: ${profile.years}`,
    profile?.style && `Stil: ${profile.style}`,
    profile?.school && `Ekol: ${profile.school}`,
    profile?.strengths?.length && `Güçlü yanlar: ${profile.strengths.join(", ")}`,
    profile?.weaknesses?.length && `Geliştirmesi gerekenler: ${profile.weaknesses.join(", ")}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const entriesLines = (entries || [])
    .slice(0, 5)
    .map((e) => `- ${e.type} (${e.duration}): ${e.note}${e.tags?.length ? " [" + e.tags.map((t) => t.text).join(", ") + "]" : ""}`)
    .join("\n");

  if (lang === "en") {
    return `You are the AI coach in a boxing training app called "The Corner". You are chatting directly with the boxer. Be warm, specific, and practical — like a real corner coach. Keep replies short (2-5 sentences), reference their profile and training log when relevant, and let your suggestions evolve based on the whole conversation so far, not just the latest message. Do not use markdown formatting, just plain conversational text.\n\nBoxer profile: ${
      profileLine || "(not provided)"
    }\n\nRecent training log entries:\n${entriesLines || "(no entries yet)"}`;
  }

  return `Sen "The Corner" adlı bir boks antrenman uygulamasındaki AI koçsun. Boksörle doğrudan sohbet ediyorsun. Sıcak, spesifik ve pratik ol — gerçek bir köşe koçu gibi. Cevapların kısa olsun (2-5 cümle), gerektiğinde profiline ve antrenman günlüğüne referans ver, önerilerin şu ana kadarki tüm sohbete göre evrilsin, sadece son mesaja değil. Markdown biçimlendirmesi kullanma, sade konuşma dili kullan.\n\nBoksör profili: ${
    profileLine || "(belirtilmedi)"
  }\n\nSon antrenman günlüğü notları:\n${entriesLines || "(henüz kayıt yok)"}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = await verifyUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server" });
    return;
  }

  const { messages, profile, entries, lang = "tr" } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: buildSystemPrompt(profile, entries, lang),
        messages: messages.slice(-30).map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      res.status(502).json({ error: `Anthropic API error: ${errText}` });
      return;
    }

    const data = await anthropicRes.json();
    const reply = data?.content?.[0]?.text || "";
    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}
