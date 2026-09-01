export const CATEGORY_LIST = ["Güç", "Defans", "Teknik", "Fight IQ", "Hız"];

export function computeInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0].toUpperCase());
  return letters.join("") || "?";
}

const categoryTranslations = {
  Güç: { tr: "Güç", en: "Power" },
  Defans: { tr: "Defans", en: "Defense" },
  Teknik: { tr: "Teknik", en: "Technique" },
  "Fight IQ": { tr: "Fight IQ", en: "Fight IQ" },
  Hız: { tr: "Hız", en: "Speed" },
  "Ayak işi": { tr: "Ayak işi", en: "Footwork" },
  Diğer: { tr: "Diğer", en: "Other" },
};
export function tc(cat, lang) {
  return categoryTranslations[cat] ? categoryTranslations[cat][lang] || cat : cat;
}

const weightClassTranslations = {
  Sineksiklet: { tr: "Sineksiklet", en: "Flyweight" },
  Horozsiklet: { tr: "Horozsiklet", en: "Bantamweight" },
  Tüysiklet: { tr: "Tüysiklet", en: "Featherweight" },
  Hafifsiklet: { tr: "Hafifsiklet", en: "Lightweight" },
  Yarıortasiklet: { tr: "Yarıortasiklet", en: "Welterweight" },
  Ortasiklet: { tr: "Ortasiklet", en: "Middleweight" },
  Ağıryarısiklet: { tr: "Ağıryarısiklet", en: "Light heavyweight" },
  Ağırsiklet: { tr: "Ağırsiklet", en: "Heavyweight" },
};
export function tw(weightClass, lang) {
  return weightClassTranslations[weightClass] ? weightClassTranslations[weightClass][lang] || weightClass : weightClass;
}
