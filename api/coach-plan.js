import { verifyUser } from "./_lib/verifyUser.js";
import { buildRatingsLine, FIGHT_IQ_NOTE, EXPERTISE_NOTE } from "./_lib/profileContext.js";

const MODEL = "claude-sonnet-5";
const DAY_CODES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const INTENSITY_LABEL = {
  general: { tr: "Gelişim", en: "Development" },
  fight: { tr: "Maça hazırlık", en: "Fight prep" },
};

function buildSystemPrompt({ profile, entries, recentChat, intensity, days, level, focus, timeSlots, lang }) {
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

  const chatLines = (recentChat || [])
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Kullanıcı" : "Koç"}: ${m.content}`)
    .join("\n");

  const intensityLabel = INTENSITY_LABEL[intensity]?.[lang] || INTENSITY_LABEL[intensity]?.tr || intensity;

  const answersLine =
    lang === "en"
      ? `Goal: ${intensityLabel} · Days per week: ${days} · Level: ${level} · Focus: ${focus}`
      : `Hedef: ${intensityLabel} · Haftalık gün sayısı: ${days} · Seviye: ${level} · Odak: ${focus}`;

  const slotsLines = (timeSlots || []).map((s) => `- ${s.time} · ${s.duration} · ${s.intensity}`).join("\n");

  const dayOrder = DAY_CODES.join(", ");

  if (lang === "en") {
    return `You are the AI coach in a boxing training app called "The Corner", generating a personalized weekly training plan. Blend the user's explicit answers below with what you know about their profile, training log, and recent coach chat — don't just template the answers, actually tailor session content to this specific boxer.

The user's answers: ${answersLine}

The user's available training times (time · duration · intensity they chose for that time):
${slotsLines || "(none provided)"}

Boxer profile: ${profileLine || "(not provided)"}

Recent training log entries:
${entriesLines || "(no entries yet)"}

Recent coach chat:
${chatLines || "(no chat yet)"}

Respond ONLY with JSON, nothing else, in exactly this shape:
{"plan": [{"day": "<code>", "time": "HH:MM or —", "title": "short session title", "duration": "e.g. 45 dk or empty string for rest", "blocks": ["block 1", "block 2", ...], "note": "1 short sentence"}, ... exactly 7 entries]}

Rules:
- The "day" field must be exactly these 7 codes in this exact order, one each: ${dayOrder}.
- Exactly ${days} of the 7 days should be real training sessions; the rest must be rest days (title "Dinlenme" or "Aktif dinlenme", time "—", duration "", blocks: []).
- For every training day's "time" and "duration", use one of the user's declared available time slots above — reuse slots across multiple days if there are fewer slots than training days. If no slots were provided, pick reasonable times yourself.
- Match each session's intensity/volume to the declared intensity of the time slot you assigned it (an "Intense" slot should get a demanding session like sparring or high-tempo pad work; a "Light" slot should get lower-tempo technical/footwork work), as well as to the stated level and goal (fight prep should feel more match-focused with more sparring; development should be more balanced).
- Spread training days reasonably across the week, don't bunch them all together.
- Bias session content toward the stated focus area, and toward the boxer's weaknesses from their profile/log when relevant.
- ${FIGHT_IQ_NOTE.en} If it's relevant, a training day's blocks/note can include a Fight IQ-building element (not every day needs one).
- ${EXPERTISE_NOTE.en}
- Keep "title" short (2-4 words), "blocks" to 2-4 short bullet items, "note" to one short encouraging/practical sentence.
- All text must be in English.`;
  }

  return `Sen "The Corner" adlı bir boks antrenman uygulamasındaki AI koçsun, kişiselleştirilmiş bir haftalık antrenman planı oluşturuyorsun. Aşağıdaki kullanıcı cevaplarını, profilini, antrenman günlüğünü ve son koç sohbetini harmanla — sadece cevapları şablona koyma, seansların içeriğini gerçekten bu boksöre göre uyarla.

Kullanıcının cevapları: ${answersLine}

Kullanıcının bildirdiği uygun antrenman saatleri (saat · süre · o saat için seçtiği yoğunluk):
${slotsLines || "(belirtilmedi)"}

Boksör profili: ${profileLine || "(belirtilmedi)"}

Son antrenman günlüğü notları:
${entriesLines || "(henüz kayıt yok)"}

Son koç sohbeti:
${chatLines || "(henüz sohbet yok)"}

SADECE JSON ile cevap ver, başka hiçbir şey yazma, tam olarak şu formatta:
{"plan": [{"day": "<kod>", "time": "SS:DD ya da —", "title": "kısa seans başlığı", "duration": "örn. 45 dk ya da dinlenme günü için boş string", "blocks": ["blok 1", "blok 2", ...], "note": "1 kısa cümle"}, ... tam 7 kayıt]}

Kurallar:
- "day" alanı tam olarak şu 7 kod olmalı, bu sırayla, her biri bir kez: ${dayOrder}.
- 7 günden tam olarak ${days} tanesi gerçek antrenman seansı olmalı; kalanlar dinlenme günü olmalı (title "Dinlenme" ya da "Aktif dinlenme", time "—", duration "", blocks: []).
- Her antrenman gününün "time" ve "duration" alanı için yukarıdaki bildirilen saatlerden birini kullan — saat sayısı antrenman günü sayısından azsa saatleri günler arasında tekrar kullan. Hiç saat belirtilmemişse kendin makul saatler seç.
- Her seansın yoğunluğunu/hacmini, o saate atanan yoğunluk etiketine göre ayarla ("Yoğun" işaretli saate sparring ya da yüksek tempo pad çalışması gibi zorlu bir seans; "Hafif" işaretli saate daha düşük tempolu teknik/ayak işi çalışması ver), ayrıca belirtilen seviyeye ve hedefe göre de ayarla (maça hazırlıkta daha fazla sparring/maç odaklı hissettirsin; gelişimde daha dengeli olsun).
- Antrenman günlerini haftaya makul şekilde yay, hepsini yan yana toplama.
- Seans içeriğini belirtilen odak alanına, ve ilgiliyse profildeki/günlükteki zayıf yanlara doğru eğ.
- ${FIGHT_IQ_NOTE.tr} İlgiliyse bir antrenman gününün blocks/note kısmına Fight IQ geliştiren bir öğe ekleyebilirsin (her günde olması şart değil).
- ${EXPERTISE_NOTE.tr}
- "title" kısa olsun (2-4 kelime), "blocks" 2-4 kısa madde olsun, "note" tek kısa, pratik/motive edici bir cümle olsun.
- Tüm metinler Türkçe olmalı.`;
}

function isValidPlan(plan, days) {
  if (!Array.isArray(plan) || plan.length !== 7) return false;
  let activeCount = 0;
  for (let i = 0; i < 7; i++) {
    const p = plan[i];
    if (!p || typeof p !== "object") return false;
    if (p.day !== DAY_CODES[i]) return false;
    if (typeof p.time !== "string" || typeof p.title !== "string") return false;
    if (typeof p.duration !== "string") return false;
    if (!Array.isArray(p.blocks)) return false;
    if (typeof p.note !== "string") return false;
    if (p.blocks.length > 0) activeCount++;
  }
  return activeCount === Number(days);
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

  const { profile, entries, recentChat, intensity, days, level, focus, timeSlots, lang = "tr" } = req.body || {};
  if (!intensity || !days || !level || !focus) {
    res.status(400).json({ error: "intensity, days, level and focus are required" });
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
        max_tokens: 1600,
        system: buildSystemPrompt({ profile, entries, recentChat, intensity, days, level, focus, timeSlots, lang }),
        messages: [
          {
            role: "user",
            content: lang === "en" ? "Generate my weekly plan." : "Haftalık planımı oluştur.",
          },
        ],
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
      res.status(502).json({ error: "Could not parse plan JSON" });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!isValidPlan(parsed.plan, days)) {
      res.status(502).json({ error: "Plan JSON failed validation" });
      return;
    }

    res.status(200).json({ plan: parsed.plan });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}
