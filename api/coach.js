const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPTS = {
  "journal-tip": {
    tr: 'Sen "The Corner" adlı bir boks antrenman uygulamasındaki AI koçsun. Kullanıcının profiline ve son antrenman notlarına bakarak bir sonraki seansında çalışması gereken TEK bir odak noktası ve kısa bir drill öner. Sadece şu JSON formatıyla cevap ver, başka hiçbir şey yazma: {"note": "2-3 cümlelik kısa öneri", "drill": "tek satırlık drill adı, süre/set bilgisiyle"}',
    en: 'You are the AI coach in a boxing training app called "The Corner". Based on the user\'s profile and recent training notes, suggest ONE focus point and a short drill for their next session. Respond ONLY in this JSON format, nothing else: {"note": "2-3 sentence suggestion", "drill": "one-line drill name with duration/sets"}',
  },
  "quick-checkin": {
    tr: 'Sen "The Corner" adlı bir boks antrenman uygulamasındaki AI koçsun. Kullanıcı video yüklemeden, bugün en çok neye çalıştığını söylüyor. Buna göre kısa bir geri bildirim ve bir drill öner. Sadece şu JSON formatıyla cevap ver, başka hiçbir şey yazma: {"result": "2-3 cümlelik geri bildirim", "drill": "tek satırlık drill adı, süre/set bilgisiyle"}',
    en: 'You are the AI coach in a boxing training app called "The Corner". The user, without uploading a video, tells you what they focused on most today. Give short feedback and suggest a drill. Respond ONLY in this JSON format, nothing else: {"result": "2-3 sentence feedback", "drill": "one-line drill name with duration/sets"}',
  },
};

function buildUserMessage(mode, body, lang) {
  if (mode === "quick-checkin") {
    const { focus } = body;
    return lang === "en"
      ? `The boxer says they focused most on today: "${focus}". Give feedback and a drill suggestion.`
      : `Boksör bugün en çok şuna çalıştığını söylüyor: "${focus}". Buna göre geri bildirim ve drill öner.`;
  }

  const { profile, entries } = body;
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

  return lang === "en"
    ? `Boxer profile: ${profileLine}\n\nRecent training log entries:\n${entriesLines || "(no entries yet)"}\n\nSuggest their next-session focus and a drill.`
    : `Boksör profili: ${profileLine}\n\nSon antrenman günlüğü notları:\n${entriesLines || "(henüz kayıt yok)"}\n\nBir sonraki seans için odak noktası ve drill öner.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server" });
    return;
  }

  const { mode, lang = "tr" } = req.body || {};
  const system = SYSTEM_PROMPTS[mode]?.[lang] || SYSTEM_PROMPTS[mode]?.tr;
  if (!system) {
    res.status(400).json({ error: "Invalid mode" });
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
        max_tokens: 300,
        system,
        messages: [{ role: "user", content: buildUserMessage(mode, req.body, lang) }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      res.status(502).json({ error: `Anthropic API error: ${errText}` });
      return;
    }

    const data = await anthropicRes.json();
    const raw = data?.content?.[0]?.text || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(502).json({ error: "Could not parse AI response" });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}
