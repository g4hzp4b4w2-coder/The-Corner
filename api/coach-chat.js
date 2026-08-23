import { verifyUser } from "./_lib/verifyUser.js";
import { buildRatingsLine, FIGHT_IQ_NOTE, EXPERTISE_NOTE, ADDRESS_NOTE } from "./_lib/profileContext.js";
import { getRecentKnowledge, addKnowledge, buildKnowledgeLine } from "./_lib/coachKnowledge.js";

const MODEL = "claude-sonnet-5";
const MAX_IMAGES = 18;
const INSIGHT_MARKER = "===INSIGHT===";

const INSIGHT_INSTRUCTIONS = {
  tr: `\n\nCevabını normal şekilde yaz. Sonra, EĞER bu mesajdan genellenebilir, kimliksiz bir koçluk gözlemi çıkarabiliyorsan (herhangi bir boksöre uygulanabilecek bir kalıp — örn. "şu tarz bir soru sorulduğunda şu açıklama işe yarıyor"; isim, yaş, okul ya da başka hiçbir kişisel detay KESİNLİKLE olmadan), cevabının en sonuna, tamamen ayrı bir satırda önce "${INSIGHT_MARKER}" yaz, sonra bir sonraki satıra o gözlemi yaz. Böyle bir gözlem yoksa bu satırı hiç ekleme, cevabını olduğu gibi bitir — zorlama.`,
  en: `\n\nWrite your reply normally. Then, IF this exchange surfaces a generalized, anonymized coaching observation (a pattern applicable to any boxer — e.g. "when this kind of question comes up, this explanation tends to land"; NEVER a name, age, school, or any personal detail), add it on its own separate line at the very end, first writing "${INSIGHT_MARKER}" then the observation on the next line. If no such observation applies, don't add this line at all — don't force one.`,
};

const VIDEO_TYPE_GUIDANCE = {
  "Gölge Boksu": {
    tr: "Kullanıcı bu videonun bir GÖLGE BOKSU çalışması olduğunu belirtti — ayak işine, kombinasyon akıcılığına, hayali rakibe göre pozisyon almaya öncelik ver.",
    en: "The user marked this video as SHADOWBOXING — prioritize footwork, combination flow, and positioning against an imaginary opponent.",
  },
  "Torba Çalışması": {
    tr: "Kullanıcı bu videonun bir TORBA ÇALIŞMASI olduğunu belirtti — vuruş gücü aktarımına, temas anındaki tekniğe, kombinasyon sonrası toparlanmaya öncelik ver.",
    en: "The user marked this video as HEAVY BAG WORK — prioritize power transfer, technique on impact, and recovery after combinations.",
  },
  Sparring: {
    tr: "Kullanıcı bu videonun bir SPARRING olduğunu belirtti — savunma tepkilerine, mesafe yönetimine, karşı vuruş fırsatlarına öncelik ver.",
    en: "The user marked this video as SPARRING — prioritize defensive reactions, distance management, and counter-punching opportunities.",
  },
  "Teknik Çalışma": {
    tr: "Kullanıcı bu videonun bir TEKNİK ÇALIŞMA olduğunu belirtti — çalışılan spesifik hareketin/tekniğin doğru uygulanmasına öncelik ver.",
    en: "The user marked this video as TECHNICAL DRILLING — prioritize correct execution of the specific technique being drilled.",
  },
};

const REPORT_MODE_INSTRUCTIONS = {
  tr: "\n\nBu bir video analiz RAPORU isteği, sohbet değil — 'Merhaba', 'videona baktım', 'harika bir soru' gibi herhangi bir sohbet havası girişi/karşılaması KULLANMA, direkt yapılandırılmış analize başla. Cevabını şu üç başlıkla düzenle, her başlığı ayrı bir satırda düz metin olarak yaz (yıldız ya da # kullanma), altına ilgili paragrafı ekle: 'Duruş ve Guard', 'Denge ve Vücut Açısı', 'Öneriler ve Drilller'.",
  en: "\n\nThis is a video analysis REPORT request, not a chat — do NOT use any conversational opener or greeting ('Hey', 'I looked at your video', 'great question'), go straight into the structured analysis. Organize your reply under these three headings, each on its own plain-text line (no asterisks or #), with the relevant paragraph beneath: 'Stance and Guard', 'Balance and Body Angle', 'Suggestions and Drills'.",
};

const VIDEO_INSTRUCTIONS = {
  tr: "\n\nBu mesajda kullanıcının videosundan alınmış birden fazla sıralı kare var, HER KARENİN HEMEN ÖNCESİNDE o karenin videodaki gerçek saniyesi yazıyor (örn. \"Video zamanı: 3.2s\"). Bu çok önemli: yorumunda ASLA \"1. karede\", \"4. karede\" gibi kare numarası kullanma — bunun yerine gerçek saniyeyi kullan (örn. \"videonun 3.2. saniyesinde guard düştü\", \"klibin başında...\", \"9. saniye civarında...\"). Bu, tek tek fotoğraflara değil, tek bir sürekli videoya baktığını gösterir. Kareler eşit aralıklarla değil, kare-kare hareket farkına bakılarak videodaki en hareketli anlara (muhtemelen vuruşlar, hızlı çıkışlar, ani yön değişimleri) öncelik verilerek seçildi. Karelerin üzerinde, gerçek bir vücut takip modelinin bulduğu eklem noktalarını gösteren renkli çizgiler/noktalar olabilir (omuz, dirsek, bilek, kalça, diz, ayak bileği) — bunlar gerçek ölçüm, senin tahminin değil; kadrajda iki kişi varsa (örn. sparring) her biri farklı renkte çizilir. Bu sefer kısa tutma — videoyu baştan sona gözden geçirip daha uzun, yapılandırılmış bir analiz yaz: (1) duruş ve guard'ın klip boyunca, özellikle yoğun hareket anlarında nasıl değiştiğini, (2) denge ve vücut/omuz açısıyla ilgili fark ettiğin belirgin noktaları, (3) bunlara dayanarak somut, önceliklendirilmiş 2-3 iyileştirme önerisini ve her biri için kısa bir drill. Aşağıda gerçek takip verisinden çıkarılmış sayısal ölçümler varsa, bunları görsel tahminine göre önceliklendir ve doğrudan referans ver (örn. \"takip verisine göre...\"). Yine de sadece kanıtladığın şeyleri yaz, ölçülmeyen konularda (hız, güç gibi) tahmin yürütme.",
  en: "\n\nThis message includes multiple sequential frames from the user's video, and EACH FRAME IS IMMEDIATELY PRECEDED by the real video timestamp it was taken at (e.g. \"Video time: 3.2s\"). This matters: NEVER refer to \"frame 1\" or \"frame 4\" in your analysis — use the real second instead (e.g. \"your guard dropped around the 3.2-second mark\", \"early in the clip...\", \"around the 9-second point...\"). This makes it clear you're looking at one continuous video, not a stack of disconnected photos. Frames weren't sampled at even intervals — they were chosen by comparing motion between candidate frames and prioritizing the moments with the most movement in the clip (likely punches, quick bursts, sudden direction changes). The frames may have colored lines/dots drawn on them marking joints found by a real body-tracking model (shoulders, elbows, wrists, hips, knees, ankles) — that's measured data, not your guess; if two people are in frame (e.g. sparring), each is drawn in a different color. Don't keep it short this time — go through the whole clip and write a longer, structured analysis: (1) how stance and guard change across the clip, especially during the high-motion moments, (2) notable points about balance and body/shoulder angle, (3) 2-3 concrete, prioritized improvement suggestions based on that, each with a short drill. If numeric measurements from real tracking data are provided below, prioritize and directly reference them over your own visual guess (e.g. \"based on the tracking data...\"). Still only state what you can actually back up — don't guess at things that weren't measured, like speed or power.",
};

const YOU_PERSON_NOTE = {
  cyan: {
    tr: "\n\nBu bir sparring videosu ve kadrajda iki kişi var. Kullanıcı hangisinin kendisi olduğunu belirtti: CAMGÖBEĞİ (açık mavi) renkte çizilen iskelet KULLANICI, TURUNCU renkteki iskelet ise rakip/antrenman arkadaşı. Analizini ve önerilerini SADECE camgöbeği renkli kişiye göre yap, turuncu kişiden sadece bağlam için (örn. rakibin pozisyonuna göre tepki) bahset.",
    en: "\n\nThis is a sparring video with two people in frame. The user identified which one is them: the skeleton drawn in CYAN is the USER, the one drawn in ORANGE is the sparring partner/opponent. Base your analysis and suggestions ONLY on the cyan person, and only mention the orange person for context (e.g. reacting to the opponent's position).",
  },
  amber: {
    tr: "\n\nBu bir sparring videosu ve kadrajda iki kişi var. Kullanıcı hangisinin kendisi olduğunu belirtti: TURUNCU renkte çizilen iskelet KULLANICI, CAMGÖBEĞİ (açık mavi) renkteki iskelet ise rakip/antrenman arkadaşı. Analizini ve önerilerini SADECE turuncu renkli kişiye göre yap, camgöbeği kişiden sadece bağlam için (örn. rakibin pozisyonuna göre tepki) bahset.",
    en: "\n\nThis is a sparring video with two people in frame. The user identified which one is them: the skeleton drawn in ORANGE is the USER, the one drawn in CYAN is the sparring partner/opponent. Base your analysis and suggestions ONLY on the orange person, and only mention the cyan person for context (e.g. reacting to the opponent's position).",
  },
};

function buildSystemPrompt(profile, entries, lang, knowledgeLine) {
  const profileLine = [
    profile?.displayName && `Name: ${profile.displayName}`,
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

  if (lang === "en") {
    return `You are the AI coach in a boxing training app called "The Corner". You are chatting directly with the boxer. Be warm, specific, and practical — like a real corner coach. Keep replies short (2-5 sentences), reference their profile and training log when relevant, and let your suggestions evolve based on the whole conversation so far, not just the latest message. Draw on your real knowledge of well-known boxers and their documented training methods, techniques, and styles when it strengthens a point (e.g. naming a specific fighter whose approach matches what you're suggesting) — don't invent details you're not confident about, and say so if you're unsure rather than making something up. Do not use markdown formatting, just plain conversational text.

${FIGHT_IQ_NOTE.en}

${EXPERTISE_NOTE.en}

${ADDRESS_NOTE.en}

IMPORTANT: Always reply in ENGLISH, no matter what language any earlier messages in this conversation were written in — the user has explicitly set English as the app language right now.

Sometimes a message includes a few still frames extracted from the user's own training video. When frames are included, only comment on what you can actually see in them — stance, guard height, balance, body/shoulder angle, and similar static observations. You cannot reliably judge speed, power, timing, or full motion flow from a handful of still frames — never invent precise numbers or percentages about that, and say plainly when something isn't visible or you're unsure.

Boxer profile: ${profileLine || "(not provided)"}

Recent training log entries:
${entriesLines || "(no entries yet)"}${knowledgeLine || ""}`;
  }

  return `Sen "The Corner" adlı bir boks antrenman uygulamasındaki AI koçsun. Boksörle doğrudan sohbet ediyorsun. Sıcak, spesifik ve pratik ol — gerçek bir köşe koçu gibi. Cevapların kısa olsun (2-5 cümle), gerektiğinde profiline ve antrenman günlüğüne referans ver, önerilerin şu ana kadarki tüm sohbete göre evrilsin, sadece son mesaja değil. Bir noktayı güçlendirecekse gerçek, bilinen boksörlerin belgelenmiş antrenman yöntemlerine, tekniklerine ve stillerine referans ver (örn. önerdiğin şeye yaklaşımı benzeyen bir boksörün adını anmak gibi) — emin olmadığın detayları uydurma, emin değilsen bunu söyle. Markdown biçimlendirmesi kullanma, sade konuşma dili kullan.

${FIGHT_IQ_NOTE.tr}

${EXPERTISE_NOTE.tr}

${ADDRESS_NOTE.tr}

ÖNEMLİ: Sohbetteki önceki mesajlar hangi dilde yazılmış olursa olsun HER ZAMAN TÜRKÇE cevap ver — kullanıcı şu an uygulama dilini Türkçe olarak ayarlamış durumda.

Bazen bir mesaj, kullanıcının kendi antrenman videosundan alınmış birkaç sabit kare (still frame) içerir. Kareler varsa sadece gerçekten görebildiğin şeyler hakkında yorum yap — duruş, guard yüksekliği, denge, vücut/omuz açısı gibi statik gözlemler. Birkaç sabit kareden hız, güç, zamanlama ya da tam hareket akışını güvenilir şekilde değerlendiremezsin — bu konularda kesin sayı ya da yüzde uydurma, bir şey görünmüyorsa ya da emin değilsen bunu açıkça söyle.

Boksör profili: ${profileLine || "(belirtilmedi)"}

Son antrenman günlüğü notları:
${entriesLines || "(henüz kayıt yok)"}${knowledgeLine || ""}`;
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

  const { messages, images, frameTimestamps, poseMetrics, videoType, youPersonIndex, reportMode, caption, profile, entries, lang = "tr" } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  const recentMessages = messages.slice(-30);
  // Anthropic requires strictly alternating roles, so a stale empty message
  // (e.g. from a past failure) gets a placeholder instead of being dropped.
  const priorMessages = recentMessages
    .slice(0, -1)
    .map((m) => ({ role: m.role, content: m.content && m.content.trim() ? m.content : "…" }));
  const last = recentMessages[recentMessages.length - 1];

  const hasImages = Array.isArray(images) && images.length > 0;

  let lastContent = last.content;
  if (hasImages) {
    const clippedImages = images.slice(0, MAX_IMAGES);
    const clippedTimestamps = Array.isArray(frameTimestamps) ? frameTimestamps.slice(0, MAX_IMAGES) : [];
    const imageBlocks = clippedImages.flatMap((data, i) => {
      const blocks = [];
      if (clippedTimestamps[i] !== undefined) {
        blocks.push({ type: "text", text: lang === "en" ? `Video time: ${clippedTimestamps[i]}s` : `Video zamanı: ${clippedTimestamps[i]}s` });
      }
      blocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
      return blocks;
    });
    const text =
      (caption && caption.trim()) ||
      (lang === "en" ? "Can you analyze my form in these video frames?" : "Bu video karelerindeki formumu analiz eder misin?");
    lastContent = [...imageBlocks, { type: "text", text }];
  }

  const anthropicMessages = [...priorMessages, { role: last.role, content: lastContent }];
  const knowledge = await getRecentKnowledge(lang);
  const knowledgeLine = buildKnowledgeLine(knowledge, lang);
  const poseMetricsLine = hasImages && poseMetrics ? `\n\n${poseMetrics}` : "";
  const videoTypeLine = hasImages && videoType && VIDEO_TYPE_GUIDANCE[videoType] ? `\n\n${VIDEO_TYPE_GUIDANCE[videoType][lang] || VIDEO_TYPE_GUIDANCE[videoType].tr}` : "";
  const reportModeLine = hasImages && reportMode ? REPORT_MODE_INSTRUCTIONS[lang] || REPORT_MODE_INSTRUCTIONS.tr : "";
  const youPersonKey = youPersonIndex === 0 ? "cyan" : youPersonIndex === 1 ? "amber" : null;
  const youPersonLine = hasImages && youPersonKey ? YOU_PERSON_NOTE[youPersonKey][lang] || YOU_PERSON_NOTE[youPersonKey].tr : "";
  const system =
    buildSystemPrompt(profile, entries, lang, knowledgeLine) +
    (hasImages ? VIDEO_INSTRUCTIONS[lang] || VIDEO_INSTRUCTIONS.tr : "") +
    videoTypeLine +
    poseMetricsLine +
    youPersonLine +
    reportModeLine +
    (INSIGHT_INSTRUCTIONS[lang] || INSIGHT_INSTRUCTIONS.tr);

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
        max_tokens: hasImages ? 1700 : 500,
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
    const raw = (data?.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const [replyPart, insightPart] = raw.split(INSIGHT_MARKER);
    const reply = (replyPart || "").trim();
    const insight = (insightPart || "").trim();

    if (!reply) {
      res.status(502).json({ error: "Coach returned an empty response" });
      return;
    }

    if (insight) await addKnowledge(insight, lang);

    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}
