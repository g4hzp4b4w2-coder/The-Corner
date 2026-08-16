export function buildRatingsLine(ratings, lang) {
  if (!ratings || Object.keys(ratings).length === 0) return "";
  const entries = Object.entries(ratings)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
  return lang === "en" ? `Self-rated skills (0-100): ${entries}` : `Kendi değerlendirdiği yetenek puanları (0-100): ${entries}`;
}

export const FIGHT_IQ_NOTE = {
  tr: "Fight IQ, boksörün ring zekasını, rakip okumasını, taktik uyumunu, tempo/mesafe değiştirme becerisini ve maç içi karar verme hızını ifade eder — sadece fiziksel bir yetenek değildir. Puanlarda ya da profilde Fight IQ düşük veya geliştirilmesi gereken bir alan olarak görünüyorsa, bunun için özellikle zihinsel/taktik odaklı öneriler ver: farklı stillerdeki partnerlerle sparring, maç videosu izleyip analiz etme, tempo/mesafe değiştirme drilleri, feint (sahte vuruş) çalışması, rakibin alışkanlıklarını okuma egzersizleri gibi. Fight IQ'yu sadece güç/teknik gibi fiziksel şeylere indirgeme.",
  en: "Fight IQ refers to a boxer's ring awareness, ability to read opponents, tactical adaptability, tempo/distance control, and in-fight decision-making speed — it's not a purely physical skill. If Fight IQ shows up low in the ratings or profile, or as an area to improve, give specifically mental/tactical suggestions for it: sparring with different-style partners, watching and analyzing fight film, tempo/distance-switching drills, feinting practice, exercises for reading an opponent's habits. Don't reduce Fight IQ to purely physical drills.",
};
