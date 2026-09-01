import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { getProfile } from "./lib/db";
import { CATEGORY_LIST, computeInitials, tc, tw } from "./lib/labels";

const COPY = {
  title: { tr: "Profil", en: "Profile" },
  loading: { tr: "Yükleniyor…", en: "Loading…" },
  error: { tr: "Profil yüklenemedi.", en: "Couldn't load this profile." },
  notFound: { tr: "Bu kullanıcı henüz profil oluşturmamış.", en: "This user hasn't set up a profile yet." },
  styleUnset: { tr: "Stil belirtilmedi", en: "Style not set" },
  heightLabel: { tr: "BOY", en: "HEIGHT" },
  weightLabel: { tr: "KİLO", en: "WEIGHT" },
  reachLabel: { tr: "KOL", en: "REACH" },
  weightClassLabel: { tr: "SİKLET", en: "CLASS" },
  strengthsLabel: { tr: "Güçlü yönler", en: "Strengths" },
  weaknessesLabel: { tr: "Gelişim alanları", en: "Areas to improve" },
  skillDistributionLabel: { tr: "Yetenek dağılımı", en: "Skill distribution" },
  postsLabel: { tr: "Paylaşım", en: "Posts" },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

export default function PublicProfileModal({ open, onClose, userId, posts, lang }) {
  const [status, setStatus] = useState("loading");
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setStatus("loading");
    setProfile(null);
    getProfile(userId)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setStatus("notFound");
        } else {
          setProfile(data);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open) return null;

  const postCount = (posts || []).filter((p) => p.userId === userId).length;
  const skillData = profile ? CATEGORY_LIST.map((skill) => ({ skill: tc(skill, lang), value: profile.ratings[skill] ?? 50 })) : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-5">
      <div className="w-full max-w-xs bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex flex-col max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="text-neutral-100 text-sm font-bold tracking-tight">{c("title", lang)}</p>
          <button onClick={onClose} aria-label="Close" className="text-neutral-500 hover:text-neutral-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {status === "loading" && <p className="text-neutral-600 text-xs text-center py-8 animate-pulse">{c("loading", lang)}</p>}
        {status === "error" && <p className="text-red-400 text-xs text-center py-8">{c("error", lang)}</p>}
        {status === "notFound" && <p className="text-neutral-600 text-xs text-center py-8">{c("notFound", lang)}</p>}

        {status === "ready" && profile && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-950 border border-red-900 flex items-center justify-center text-red-500 text-sm font-bold shrink-0">
                {computeInitials(profile.displayName)}
              </div>
              <div>
                <p className="text-neutral-100 text-sm font-semibold">{profile.displayName}</p>
                <p className="text-neutral-500 text-xs">
                  {profile.style || c("styleUnset", lang)} · {profile.years || "—"}
                  {profile.school && profile.school !== "Karma / henüz yok" ? ` · ${profile.school}` : ""}
                </p>
              </div>
            </div>

            {(profile.heightCm || profile.weightKg || profile.reachCm || profile.weightClass) && (
              <div className="grid grid-cols-4 bg-neutral-900 border border-neutral-800 rounded-lg mb-4 overflow-hidden">
                {[
                  [c("heightLabel", lang), profile.heightCm ? `${profile.heightCm}` : "—"],
                  [c("weightLabel", lang), profile.weightKg ? `${profile.weightKg}` : "—"],
                  [c("reachLabel", lang), profile.reachCm ? `${profile.reachCm}` : "—"],
                  [c("weightClassLabel", lang), profile.weightClass ? tw(profile.weightClass, lang) : "—"],
                ].map(([label, value], i) => (
                  <div key={label} className={`px-1.5 py-2 min-w-0 text-center ${i > 0 ? "border-l border-neutral-800" : ""}`}>
                    <p className="text-neutral-600 text-[9px] tracking-wide mb-0.5">{label}</p>
                    <p className="text-neutral-100 text-[11px] font-bold break-words">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {(profile.strengths.length > 0 || profile.weaknesses.length > 0) && (
              <div className="flex gap-2 mb-4">
                {profile.strengths.length > 0 && (
                  <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg p-2.5">
                    <p className="text-neutral-500 text-[11px] font-semibold mb-1">{c("strengthsLabel", lang)}</p>
                    <div className="flex gap-1 flex-wrap">
                      {profile.strengths.map((s) => (
                        <span key={s} className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-1.5 py-0.5 rounded">
                          {tc(s, lang)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.weaknesses.length > 0 && (
                  <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg p-2.5">
                    <p className="text-neutral-500 text-[11px] font-semibold mb-1">{c("weaknessesLabel", lang)}</p>
                    <div className="flex gap-1 flex-wrap">
                      {profile.weaknesses.map((s) => (
                        <span key={s} className="text-[10px] bg-red-950 text-red-400 border border-red-900 px-1.5 py-0.5 rounded">
                          {tc(s, lang)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-4">
              <p className="text-neutral-500 text-xs mb-2">{c("skillDistributionLabel", lang)}</p>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <RadarChart data={skillData} outerRadius="75%">
                    <PolarGrid stroke="#404040" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: "#a3a3a3", fontSize: 11 }} />
                    <Radar dataKey="value" stroke="#dc2626" fill="#dc2626" fillOpacity={0.35} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 flex items-center justify-between">
              <span className="text-neutral-500 text-xs">{c("postsLabel", lang)}</span>
              <span className="text-neutral-200 text-sm font-medium">{postCount}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
