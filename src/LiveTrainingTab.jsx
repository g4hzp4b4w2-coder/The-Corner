import { useState } from "react";
import { ChevronRight } from "lucide-react";
import ShadowBoxingMode from "./ShadowBoxingMode";

const MODES = [
  {
    key: "shadow",
    enabled: true,
    label: { tr: "Gölge Boksu", en: "Shadowboxing" },
    desc: { tr: "Raund raund yumruk sayısı ve guard takibi.", en: "Round-by-round punch count and guard tracking." },
  },
  {
    key: "pad",
    enabled: false,
    label: { tr: "Sanal Pad Work", en: "Virtual Pad Work" },
    desc: { tr: "Ekranda çıkan hedeflere tepki hızını ölç.", en: "React to targets shown on screen and measure your speed." },
  },
  {
    key: "dodge",
    enabled: false,
    label: { tr: "Kaçışlar", en: "Dodging" },
    desc: { tr: "Savunma refleksini canlı olarak çalıştır.", en: "Train your defensive reflexes live." },
  },
];

const COPY = {
  title: { tr: "Bir mod seç", en: "Choose a mode" },
  comingSoon: { tr: "Yakında", en: "Coming soon" },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

export default function LiveTrainingTab({ userId, lang }) {
  const [mode, setMode] = useState(null);

  if (mode === "shadow") {
    return <ShadowBoxingMode userId={userId} lang={lang} onBack={() => setMode(null)} />;
  }

  return (
    <div className="flex flex-col" style={{ minHeight: 420 }}>
      <p className="text-neutral-500 text-xs mb-3">{c("title", lang)}</p>
      <div className="flex flex-col gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            disabled={!m.enabled}
            onClick={() => m.enabled && setMode(m.key)}
            className={`text-left bg-neutral-900 border border-neutral-800 rounded-xl p-3 transition-colors ${
              m.enabled ? "hover:border-neutral-700" : "opacity-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-neutral-100 text-sm font-medium">{m.label[lang] || m.label.tr}</span>
              {m.enabled ? (
                <ChevronRight size={16} className="text-neutral-600" />
              ) : (
                <span className="text-[10px] bg-neutral-950 text-neutral-500 border border-neutral-800 px-1.5 py-0.5 rounded">
                  {c("comingSoon", lang)}
                </span>
              )}
            </div>
            <p className="text-neutral-500 text-xs leading-relaxed">{m.desc[lang] || m.desc.tr}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
