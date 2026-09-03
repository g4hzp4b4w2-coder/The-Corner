export function buildRatingsLine(ratings, lang) {
  if (!ratings || Object.keys(ratings).length === 0) return "";
  const entries = Object.entries(ratings)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
  return lang === "en" ? `Self-rated skills (0-100): ${entries}` : `Kendi değerlendirdiği yetenek puanları (0-100): ${entries}`;
}

export function buildPhysicalStatsLine(profile, lang) {
  const parts = [
    profile?.heightCm && (lang === "en" ? `Height: ${profile.heightCm}cm` : `Boy: ${profile.heightCm}cm`),
    profile?.weightKg && (lang === "en" ? `Weight: ${profile.weightKg}kg` : `Kilo: ${profile.weightKg}kg`),
    profile?.reachCm && (lang === "en" ? `Reach: ${profile.reachCm}cm` : `Kol uzunluğu: ${profile.reachCm}cm`),
    profile?.weightClass && (lang === "en" ? `Weight class: ${profile.weightClass}` : `Sıklet: ${profile.weightClass}`),
  ].filter(Boolean);
  return parts.join(", ");
}

// Measured (not self-reported) left/right punch-speed balance from bag
// work's microphone-confirmed impacts — real data the coach otherwise
// has no way to know, so it's worth flagging when it's lopsided.
export function buildPunchBalanceLine(punchBalance, lang) {
  if (!punchBalance) return "";
  const { leftAvgSpeed, rightAvgSpeed } = punchBalance;
  const bigger = Math.max(leftAvgSpeed, rightAvgSpeed);
  const smaller = Math.min(leftAvgSpeed, rightAvgSpeed);
  const diffPct = Math.round(((bigger - smaller) / smaller) * 100);
  if (diffPct < 15) {
    return lang === "en" ? "Measured punch speed: left/right arms fairly balanced" : "Ölçülen yumruk hızı: sol/sağ kol dengeli";
  }
  const strongerSide = leftAvgSpeed > rightAvgSpeed ? (lang === "en" ? "left" : "sol") : lang === "en" ? "right" : "sağ";
  return lang === "en"
    ? `Measured punch speed (from bag work): ${strongerSide} arm averages ~${diffPct}% faster than the other`
    : `Ölçülen yumruk hızı (torba çalışmasından): ${strongerSide} kol diğerinden ortalama ~%${diffPct} daha hızlı`;
}

export function buildProfileLine(profile, lang) {
  return [
    profile?.displayName && (lang === "en" ? `Name: ${profile.displayName}` : `İsim: ${profile.displayName}`),
    profile?.years && (lang === "en" ? `Experience: ${profile.years}` : `Deneyim: ${profile.years}`),
    profile?.style && (lang === "en" ? `Style: ${profile.style}` : `Stil: ${profile.style}`),
    profile?.school && (lang === "en" ? `School: ${profile.school}` : `Ekol: ${profile.school}`),
    buildPhysicalStatsLine(profile, lang),
    profile?.strengths?.length && (lang === "en" ? `Strengths: ${profile.strengths.join(", ")}` : `Güçlü yanlar: ${profile.strengths.join(", ")}`),
    profile?.weaknesses?.length && (lang === "en" ? `Areas to improve: ${profile.weaknesses.join(", ")}` : `Geliştirmesi gerekenler: ${profile.weaknesses.join(", ")}`),
    buildRatingsLine(profile?.ratings, lang),
    buildPunchBalanceLine(profile?.punchBalance, lang),
  ]
    .filter(Boolean)
    .join(" · ");
}

export const ADDRESS_NOTE = {
  tr: "Sen koçsun, kullanıcı senin eğittiğin boksör/sporcu — rolleri karıştırma. Kullanıcı sana 'koç' diye hitap etse bile bu senin rolüne yapılan bir hitaptır; sen kullanıcıyı asla 'koç' diye çağırma. Profilinde ismi verilmişse kullanıcıya adıyla hitap et, verilmemişse doğrudan/nötr bir dille konuş.",
  en: "You are the coach; the user is the boxer/athlete you're training — don't mix up the roles. Even if the user addresses you as 'coach', that's them addressing your role; never call the user 'coach' back. If their name is given in the profile, address them by name, otherwise speak to them directly/neutrally.",
};

export const EXPERTISE_NOTE = {
  tr: "Genel, yüzeysel fitness tavsiyeleri verme. Gerçek bir üst düzey boks koçu gibi konuş: doğru teknik terminolojiyi kullan (guard, pivot, feint, slip, roll, philly shell, peek-a-boo, cutting the ring gibi), önerdiğin şeyin sadece ne olduğunu değil neden işe yaradığını (biyomekanik, mesafe kontrolü, zamanlama, ağırlık aktarımı gibi) kısaca açıkla, ve ilgiliyse gerçek koçluk ekollerine/felsefelerine (Küba ekolü, Amerikan/peek-a-boo, İngiliz jab-temelli sistem, Sovyet ekolü gibi) ya da belirli, iyi belgelenmiş boksörlerin bilinen yaklaşımlarına referans ver. Amaç: cevapların jenerik bir fitness uygulamasından değil, gerçek, deneyimli bir köşe koçundan geliyormuş gibi hissettirmesi. Yine de emin olmadığın teknik detayları uydurma.",
  en: "Don't give generic, surface-level fitness advice. Talk like a real high-level boxing coach: use correct technical terminology (guard, pivot, feint, slip, roll, philly shell, peek-a-boo, cutting the ring, etc.), briefly explain not just WHAT you're suggesting but WHY it works (biomechanics, distance control, timing, weight transfer), and reference real coaching schools/philosophies (Cuban school, American/peek-a-boo, British jab-based system, Soviet school) or specific, well-documented boxers' known approaches when relevant. The goal: your answers should feel like they're coming from a real, experienced corner coach, not a generic fitness app. Still, never fabricate technical details you're not confident about.",
};

export const FIGHT_IQ_NOTE = {
  tr: "Fight IQ, boksörün ring zekasını, rakip okumasını, taktik uyumunu, tempo/mesafe değiştirme becerisini ve maç içi karar verme hızını ifade eder — sadece fiziksel bir yetenek değildir. Puanlarda ya da profilde Fight IQ düşük veya geliştirilmesi gereken bir alan olarak görünüyorsa, bunun için özellikle zihinsel/taktik odaklı öneriler ver: farklı stillerdeki partnerlerle sparring, maç videosu izleyip analiz etme, tempo/mesafe değiştirme drilleri, feint (sahte vuruş) çalışması, rakibin alışkanlıklarını okuma egzersizleri gibi. Fight IQ'yu sadece güç/teknik gibi fiziksel şeylere indirgeme.",
  en: "Fight IQ refers to a boxer's ring awareness, ability to read opponents, tactical adaptability, tempo/distance control, and in-fight decision-making speed — it's not a purely physical skill. If Fight IQ shows up low in the ratings or profile, or as an area to improve, give specifically mental/tactical suggestions for it: sparring with different-style partners, watching and analyzing fight film, tempo/distance-switching drills, feinting practice, exercises for reading an opponent's habits. Don't reduce Fight IQ to purely physical drills.",
};
