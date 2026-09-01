import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { getWeeklyChallenges } from "./lib/challenges";
import { getLeaderboard } from "./lib/leaderboard";
import { computeInitials } from "./lib/labels";

const COPY = {
  challengesTitle: { tr: "Bu haftanın hedefleri", en: "This week's challenges" },
  leaderboardTitle: { tr: "Liderlik tablosu", en: "Leaderboard" },
  sessionsTabLabel: { tr: "Seans", en: "Sessions" },
  roundsTabLabel: { tr: "Raund", en: "Rounds" },
  sessionsSubtitle: { tr: "Bu haftaki seans sayısına göre", en: "Ranked by sessions this week" },
  roundsSubtitle: {
    tr: "Bu hafta tamamlanan 3 dakikalık gölge boksu raundlarına göre",
    en: "Ranked by 3-minute shadowboxing rounds completed this week",
  },
  loading: { tr: "Yükleniyor…", en: "Loading…" },
  error: { tr: "Liderlik tablosu yüklenemedi.", en: "Couldn't load the leaderboard." },
  empty: { tr: "Henüz kimse bu hafta antrenman kaydetmemiş.", en: "No one has logged a session this week yet." },
  emptyRounds: {
    tr: "Henüz kimse bu hafta 3 dakikalık raund tamamlamamış.",
    en: "No one has completed a 3-minute round this week yet.",
  },
  sessionsShort: { tr: "seans", en: "sessions" },
  roundsShort: { tr: "raund", en: "rounds" },
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
  const [board, setBoard] = useState("sessions");

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

  const sessionRows = rows ? rows.slice().sort((a, b) => b.weeklySessions - a.weeklySessions || b.streak - a.streak).slice(0, 20) : null;
  const roundRows = rows
    ? rows
        .filter((r) => r.weeklyRounds > 0)
        .slice()
        .sort((a, b) => b.weeklyRounds - a.weeklyRounds)
        .slice(0, 20)
    : null;
  const activeRows = board === "sessions" ? sessionRows : roundRows;

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
        <div className="flex items-center gap-1.5 mb-2">
          <Trophy size={14} className="text-amber-500" />
          <p className="text-neutral-100 text-sm font-medium">{c("leaderboardTitle", lang)}</p>
        </div>

        <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 mb-2">
          <button
            onClick={() => setBoard("sessions")}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
              board === "sessions" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
            }`}
          >
            {c("sessionsTabLabel", lang)}
          </button>
          <button
            onClick={() => setBoard("rounds")}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
              board === "rounds" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
            }`}
          >
            {c("roundsTabLabel", lang)}
          </button>
        </div>
        <p className="text-neutral-600 text-[11px] mb-2">{c(board === "sessions" ? "sessionsSubtitle" : "roundsSubtitle", lang)}</p>

        {error ? (
          <p className="text-red-400 text-xs text-center py-6">{error}</p>
        ) : activeRows === null ? (
          <p className="text-neutral-600 text-xs text-center py-6 animate-pulse">{c("loading", lang)}</p>
        ) : activeRows.length === 0 ? (
          <p className="text-neutral-700 text-xs text-center py-6">{c(board === "sessions" ? "empty" : "emptyRounds", lang)}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {activeRows.map((r, i) => (
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
                {board === "sessions" ? (
                  <>
                    <span className="text-neutral-400 text-[11px] shrink-0">
                      {r.weeklySessions} {c("sessionsShort", lang)}
                    </span>
                    {r.streak > 0 && (
                      <span className="text-amber-500 text-[11px] shrink-0">
                        {r.streak} {c("streakShort", lang)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-neutral-400 text-[11px] shrink-0">
                    {r.weeklyRounds} {c("roundsShort", lang)}
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
