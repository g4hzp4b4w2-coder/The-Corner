import { verifyUser } from "./_lib/verifyUser.js";
import { buildRatingsLine, FIGHT_IQ_NOTE } from "./_lib/profileContext.js";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_IMAGES = 18;

const VIDEO_INSTRUCTIONS = {
  tr: "\n\nBu mesajda kullanıcının videosundan alınmış birden fazla sıralı kare var. Kareler eşit aralıklarla değil, kare-kare hareket farkına bakılarak videodaki en hareketli anlara (muhtemelen vuruşlar, hızlı çıkışlar, ani yön değişimleri) öncelik verilerek seçildi — yani bu kareler aksiyonun yoğunlaştığı anları yakalamaya çalışıyor. Bu sefer kısa tutma — kareleri baştan sona gözden geçirip daha uzun, yapılandırılmış bir analiz yaz: (1) duruş ve guard'ın kareler boyunca, özellikle yoğun hareket anlarında nasıl değiştiğini, (2) denge ve vücut/omuz açısıyla ilgili fark ettiğin belirgin noktaları, (3) bunlara dayanarak somut, önceliklendirilmiş 2-3 iyileştirme önerisini ve her biri için kısa bir drill. Yine de sadece kanıtladığın şeyleri yaz, kareler arasında net görünmeyen hız/güç gibi konularda tahmin yürütme — kareler hareketli anlara öncelik verilerek seçilmiş olsa da, sen hâlâ sabit görüntülere bakıyorsun.",
  en: "\n\nThis message includes multiple sequential frames from the user's video. Frames weren't sampled at even intervals — they were chosen by comparing motion between candidate frames and prioritizing the moments with the most movement in the clip (likely punches, quick bursts, sudden direction changes), so these frames are trying to capture the action-heavy moments. Don't keep it short this time — go through the frames and write a longer, structured analysis: (1) how stance and guard change across the frames, especially during the high-motion moments, (2) notable points about balance and body/shoulder angle, (3) 2-3 concrete, prioritized improvement suggestions based on that, each with a short drill. Still only state what the frames actually show — don't guess at things like speed or power that aren't visible across stills, even though the frames were chosen to favor motion, you're still looking at static images.",
};

function buildSystemPrompt(profile, entries, lang) {
  const profileLine = [
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
    .map((e) => `- ${e.type} (${e.duration}): ${e.note}${e.tags?.length ? " [" + e.tags.map((t) => t.text).join(", ") + "]" : ""}`)
    .join("\n");

  if (lang === "en") {
    return `You are the AI coach in a boxing training app called "The Corner". You are chatting directly with the boxer. Be warm, specific, and practical — like a real corner coach. Keep replies short (2-5 sentences), reference their profile and training log when relevant, and let your suggestions evolve based on the whole conversation so far, not just the latest message. Draw on your real knowledge of well-known boxers and their documented training methods, techniques, and styles when it strengthens a point (e.g. naming a specific fighter whose approach matches what you're suggesting) — don't invent details you're not confident about, and say so if you're unsure rather than making something up. Do not use markdown formatting, just plain conversational text.

${FIGHT_IQ_NOTE.en}

IMPORTANT: Always reply in ENGLISH, no matter what language any earlier messages in this conversation were written in — the user has explicitly set English as the app language right now.

Sometimes a message includes a few still frames extracted from the user's own training video. When frames are included, only comment on what you can actually see in them — stance, guard height, balance, body/shoulder angle, and similar static observations. You cannot reliably judge speed, power, timing, or full motion flow from a handful of still frames — never invent precise numbers or percentages about that, and say plainly when something isn't visible or you're unsure.

Boxer profile: ${profileLine || "(not provided)"}

Recent training log entries:
${entriesLines || "(no entries yet)"}`;
  }

  return `Sen "The Corner" adlı bir boks antrenman uygulamasındaki AI koçsun. Boksörle doğrudan sohbet ediyorsun. Sıcak, spesifik ve pratik ol — gerçek bir köşe koçu gibi. Cevapların kısa olsun (2-5 cümle), gerektiğinde profiline ve antrenman günlüğüne referans ver, önerilerin şu ana kadarki tüm sohbete göre evrilsin, sadece son mesaja değil. Bir noktayı güçlendirecekse gerçek, bilinen boksörlerin belgelenmiş antrenman yöntemlerine, tekniklerine ve stillerine referans ver (örn. önerdiğin şeye yaklaşımı benzeyen bir boksörün adını anmak gibi) — emin olmadığın detayları uydurma, emin değilsen bunu söyle. Markdown biçimlendirmesi kullanma, sade konuşma dili kullan.

${FIGHT_IQ_NOTE.tr}

ÖNEMLİ: Sohbetteki önceki mesajlar hangi dilde yazılmış olursa olsun HER ZAMAN TÜRKÇE cevap ver — kullanıcı şu an uygulama dilini Türkçe olarak ayarlamış durumda.

Bazen bir mesaj, kullanıcının kendi antrenman videosundan alınmış birkaç sabit kare (still frame) içerir. Kareler varsa sadece gerçekten görebildiğin şeyler hakkında yorum yap — duruş, guard yüksekliği, denge, vücut/omuz açısı gibi statik gözlemler. Birkaç sabit kareden hız, güç, zamanlama ya da tam hareket akışını güvenilir şekilde değerlendiremezsin — bu konularda kesin sayı ya da yüzde uydurma, bir şey görünmüyorsa ya da emin değilsen bunu açıkça söyle.

Boksör profili: ${profileLine || "(belirtilmedi)"}

Son antrenman günlüğü notları:
${entriesLines || "(henüz kayıt yok)"}`;
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

  const { messages, images, caption, profile, entries, lang = "tr" } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  const recentMessages = messages.slice(-30);
  const priorMessages = recentMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
  const last = recentMessages[recentMessages.length - 1];

  const hasImages = Array.isArray(images) && images.length > 0;

  let lastContent = last.content;
  if (hasImages) {
    const imageBlocks = images.slice(0, MAX_IMAGES).map((data) => ({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data },
    }));
    const text =
      (caption && caption.trim()) ||
      (lang === "en" ? "Can you analyze my form in these video frames?" : "Bu video karelerindeki formumu analiz eder misin?");
    lastContent = [...imageBlocks, { type: "text", text }];
  }

  const anthropicMessages = [...priorMessages, { role: last.role, content: lastContent }];
  const system = buildSystemPrompt(profile, entries, lang) + (hasImages ? VIDEO_INSTRUCTIONS[lang] || VIDEO_INSTRUCTIONS.tr : "");

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
        max_tokens: hasImages ? 1100 : 500,
        system,
        messages: anthropicMessages,
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
