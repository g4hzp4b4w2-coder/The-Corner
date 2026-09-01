import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { getWeeklyChallenges } from "./lib/challenges";
import { getLeaderboard } from "./lib/leaderboard";
import { computeInitials } from "./lib/labels";

const COPY = {
  challengesTitle: { tr: "Bu haftanın hedefleri", en: "This week's challenges" },
  leaderboardTitle: { tr: "Liderlik tablosu", en: "Leaderboard" },
  leaderboardSubtitle: { tr: "Bu haftaki seans sayısına göre", en: "Ranked by sessions this week" },
  loading: { tr: "Yükleniyor…", en: "Loading…" },
  error: { tr: "Liderlik tablosu yüklenemedi.", en: "Couldn't load the leaderboard." },
  empty: { tr: "Henüz kimse bu hafta antrenman kaydetmemiş.", en: "No one has logged a session this week yet." },
  sessionsShort: { tr: "seans", en: "sessions" },
  streakShort: { tr: "gün seri", en: "day streak" },
  you: { tr: "Sen", en: "You" },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

function ChallengeCard({ challenge }) {
  const pct = Math.round((challenge.current / challenge.target) * 100);
  return (
    <div className={`bg-neutral-900 border rounded-xl p-3 ${challenge.done ? "border-emerald-900" : "border-neutral-800"}`}>
      <div className="flex items-center justify-between mb-1.5">
        <p className={`text-sm font-medium ${challenge.done ? "text-emerald-400" : "text-neutral-200"}`}>{challenge.label}</p>
        <span className={`text-xs font-medium ${challenge.done ? "text-emerald-400" : "text-neutral-500"}`}>
          {challenge.current}/{challenge.target}
        </span>
      </div>
      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${challenge.done ? "bg-emerald-500" : "bg-red-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ChallengesBoard({ entries, currentUserId, lang }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getLeaderboard()
      .then((res) => {
        if (!cancelled) setRows(res);
      })
      .catch(() => {
        if (!cancelled) setError(c("error", lang));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const challenges = getWeeklyChallenges(entries, lang);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-neutral-100 text-sm font-medium mb-2">{c("challengesTitle", lang)}</p>
        <div className="flex flex-col gap-2">
          {challenges.map((ch) => (
            <ChallengeCard key={ch.key} challenge={ch} />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-0.5">
          <Trophy size={14} className="text-amber-500" />
          <p className="text-neutral-100 text-sm font-medium">{c("leaderboardTitle", lang)}</p>
        </div>
        <p className="text-neutral-600 text-[11px] mb-2">{c("leaderboardSubtitle", lang)}</p>

        {error ? (
          <p className="text-red-400 text-xs text-center py-6">{error}</p>
        ) : rows === null ? (
          <p className="text-neutral-600 text-xs text-center py-6 animate-pulse">{c("loading", lang)}</p>
        ) : rows.length === 0 ? (
          <p className="text-neutral-700 text-xs text-center py-6">{c("empty", lang)}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows.map((r, i) => (
              <div
                key={r.userId}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${
                  r.userId === currentUserId ? "bg-red-950 border border-red-900" : "bg-neutral-900 border border-neutral-800"
                }`}
              >
                <span className="text-neutral-500 text-xs font-medium w-4 text-center shrink-0">{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-red-950 border border-red-900 flex items-center justify-center text-red-500 text-[10px] font-medium shrink-0">
                  {computeInitials(r.displayName)}
                </div>
                <span className="text-neutral-200 text-xs font-medium flex-1 truncate">
                  {r.userId === currentUserId ? `${r.displayName} (${c("you", lang)})` : r.displayName}
                </span>
                <span className="text-neutral-400 text-[11px] shrink-0">
                  {r.weeklySessions} {c("sessionsShort", lang)}
                </span>
                {r.streak > 0 && (
                  <span className="text-amber-500 text-[11px] shrink-0">
                    {r.streak} {c("streakShort", lang)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
