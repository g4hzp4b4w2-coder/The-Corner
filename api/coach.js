import { verifyUser } from "./_lib/verifyUser.js";
import { buildRatingsLine, FIGHT_IQ_NOTE, EXPERTISE_NOTE, ADDRESS_NOTE } from "./_lib/profileContext.js";
import { getRecentKnowledge, addKnowledge, buildKnowledgeLine } from "./_lib/coachKnowledge.js";

const MODEL = "claude-sonnet-5";

const INSIGHT_NOTE = {
  tr: 'Ayrıca, bu değerlendirmeden yola çıkarak GENEL, kimliksiz bir koçluk gözlemi çıkarabiliyorsan (örn. "belirli bir hata tipinde şu drill işe yarıyor" gibi, herhangi bir boksöre uygulanabilecek bir kalıp) bunu "insight" alanına yaz — bu ileride başka boksörlere koçluk yaparken kullanılacak, o yüzden İSİM, YAŞ, OKUL, spesifik kişisel detay KESİNLİKLE olmamalı, tamamen genellenmiş olmalı. Böyle bir gözlem yoksa "insight" değerini null bırak, zorlama.',
  en: 'Also, if this evaluation surfaces a GENERAL, anonymized coaching observation (e.g. "for this type of mistake, this drill tends to help" — a pattern applicable to any boxer), put it in the "insight" field — it will be reused later while coaching other boxers, so it must NEVER include a name, age, school, or any specific personal detail, only a fully generalized pattern. If no such observation applies, leave "insight" as null — don\'t force one.',
};

const SYSTEM_PROMPT = {
  tr: 'Sen "The Corner" adlı bir boks antrenman uygulamasındaki AI koçsun. Kullanıcının profiline, son antrenman notlarına ve varsa son sohbet geçmişine bakarak bir sonraki seansında çalışması gereken TEK bir odak noktası ve kısa bir drill öner. ' +
    FIGHT_IQ_NOTE.tr +
    ' ' +
    EXPERTISE_NOTE.tr +
    ' ' +
    ADDRESS_NOTE.tr +
    ' ' +
    INSIGHT_NOTE.tr +
    ' ÖNEMLİ: Ne olursa olsun, sohbet geçmişindeki mesajlar hangi dilde olursa olsun, cevabını HER ZAMAN TÜRKÇE yaz. Sadece şu JSON formatıyla cevap ver, başka hiçbir şey yazma: {"note": "2-3 cümlelik kısa öneri", "drill": "tek satırlık drill adı, süre/set bilgisiyle", "insight": "genellenmiş gözlem ya da null"}',
  en: 'You are the AI coach in a boxing training app called "The Corner". Based on the user\'s profile, recent training notes, and any recent chat history, suggest ONE focus point and a short drill for their next session. ' +
    FIGHT_IQ_NOTE.en +
    ' ' +
    EXPERTISE_NOTE.en +
    ' ' +
    ADDRESS_NOTE.en +
    ' ' +
    INSIGHT_NOTE.en +
    ' IMPORTANT: No matter what language earlier messages in the chat history are in, ALWAYS write your response in ENGLISH. Respond ONLY in this JSON format, nothing else: {"note": "2-3 sentence suggestion", "drill": "one-line drill name with duration/sets", "insight": "generalized observation or null"}',
};

function buildUserMessage(body, lang) {
  const { profile, entries, recentChat } = body;
  const profileLine = [
    profile?.displayName && `İsim: ${profile.displayName}`,
    profile?.years && `Deneyim: ${profile.years}`,
    profile?.style && `Stil: ${profile.style}`,
    profile?.school && `Ekol: ${profile.school}`,
    profile?.strengths?.length && `Güçlü yanlar: ${profile.strengths.join(", ")}`,
    profile?.weaknesses?.length && `Geliştirmesi gerekenler: ${profile.weaknesses.join(", ")}`,
    buildRatingsLine(profile?.ratings, lang),
  ]
    .filter(Boolean)
    .join(" · ");

  const entriesLines = (entries || [])
    .slice(0, 5)
    .map((e) => `- ${e.categories?.length ? e.categories.join(" + ") : e.type} (${e.duration}): ${e.note}${e.blocks?.length ? " {" + e.blocks.join("; ") + "}" : ""}${e.tags?.length ? " [" + e.tags.map((t) => t.text).join(", ") + "]" : ""}`)
    .join("\n");

  const chatLines = (recentChat || [])
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Kullanıcı" : "Koç"}: ${m.content}`)
    .join("\n");

  return lang === "en"
    ? `Boxer profile: ${profileLine}\n\nRecent training log entries:\n${entriesLines || "(no entries yet)"}\n\nRecent coach chat:\n${
        chatLines || "(no chat yet)"
      }\n\nSuggest their next-session focus and a drill.`
    : `Boksör profili: ${profileLine}\n\nSon antrenman günlüğü notları:\n${entriesLines || "(henüz kayıt yok)"}\n\nSon koç sohbeti:\n${
        chatLines || "(henüz sohbet yok)"
      }\n\nBir sonraki seans için odak noktası ve drill öner.`;
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

  const { mode, lang = "tr" } = req.body || {};
  if (mode !== "journal-tip") {
    res.status(400).json({ error: "Invalid mode" });
    return;
  }
  const knowledge = await getRecentKnowledge(lang);
  const system = (SYSTEM_PROMPT[lang] || SYSTEM_PROMPT.tr) + buildKnowledgeLine(knowledge, lang);

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
        system,
        messages: [{ role: "user", content: buildUserMessage(req.body, lang) }],
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
    const { insight, ...clientPayload } = parsed;
    if (insight) await addKnowledge(insight, lang);
    res.status(200).json(clientPayload);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}
