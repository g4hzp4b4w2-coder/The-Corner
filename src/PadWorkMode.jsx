import { useEffect, useRef, useState } from "react";
import { ChevronLeft, X, Minus, Plus } from "lucide-react";
import { createPoseSession } from "./lib/poseAnalysis";
import { SHOULDER, visible } from "./lib/poseMath";
import { pickTarget, checkTarget, HIT_RADIUS, TARGET_TIMEOUT_MS } from "./lib/reactionTarget";
import { createReactionTracker } from "./lib/reactionTracker";
import { playGong, playHitTone } from "./lib/gongSound";

const ROUND_DURATIONS = [60, 120, 180];
const PREP_MS = 5000;

const COPY = {
  subtitle: {
    tr: "Kaç raund çalışacaksın ve raund süresi ne kadar olsun?",
    en: "How many rounds, and how long should each one be?",
  },
  roundsLabel: { tr: "Raund sayısı", en: "Number of rounds" },
  roundDurationLabel: { tr: "Raund süresi", en: "Round duration" },
  minuteShort: { tr: "dk", en: "min" },
  startLabel: { tr: "Başla", en: "Start" },
  prepLabel: { tr: "Hazırlan, kameraya karşı dur", en: "Get ready, face the camera" },
  roundLabel: { tr: "Raund", en: "Round" },
  permissionDenied: {
    tr: "Kamera izni verilmedi. Tarayıcı ayarlarından bu site için kameraya izin ver.",
    en: "Camera permission was denied. Allow camera access for this site in your browser settings.",
  },
  noCamera: { tr: "Kamera bulunamadı.", en: "No camera found." },
  genericError: { tr: "Kamera başlatılamadı, tekrar dene.", en: "Couldn't start the camera, try again." },
  hitsLabel: { tr: "İsabet", en: "Hits" },
  missesLabel: { tr: "Kaçırılan", en: "Missed" },
  avgReactionLabel: { tr: "Ort. tepki", en: "Avg reaction" },
  msShort: { tr: "ms", en: "ms" },
  roundSummaryTitle: { tr: "Raund özeti", en: "Round summary" },
  nextRoundLabel: { tr: "Sonraki raund", en: "Next round" },
  finishTrainingLabel: { tr: "Antrenmanı bitir", en: "Finish training" },
  sessionSummaryTitle: { tr: "Antrenman özeti", en: "Training summary" },
  newTrainingLabel: { tr: "Yeni antrenman", en: "New training" },
  perRoundLabel: { tr: "Raund", en: "Round" },
  noteLabel: { tr: "Not (opsiyonel)", en: "Note (optional)" },
  notePlaceholder: { tr: "Bu antrenman hakkında not ekle...", en: "Add a note about this session..." },
  saveToJournalLabel: { tr: "Günlüğe kaydet", en: "Save to journal" },
  savingToJournalLabel: { tr: "Kaydediliyor...", en: "Saving..." },
  savedToJournalLabel: { tr: "Günlüğe kaydedildi", en: "Saved to journal" },
  competesLabel: { tr: "Bu seansı yarışmaya dahil et", en: "Count this session in the competition" },
  competesHint: {
    tr: "Açıksa bu antrenman haftalık hedeflere ve liderlik tablosuna sayılır.",
    en: "When on, this session counts toward weekly challenges and the leaderboard.",
  },
  left: { tr: "SOL", en: "LEFT" },
  right: { tr: "SAĞ", en: "RIGHT" },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function StatsRow({ hits, misses, avgReactionMs, lang }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-center">
        <p className="text-neutral-500 text-[10px] mb-0.5">{c("hitsLabel", lang)}</p>
        <p className="text-emerald-400 text-lg font-medium">{hits}</p>
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-center">
        <p className="text-neutral-500 text-[10px] mb-0.5">{c("missesLabel", lang)}</p>
        <p className="text-neutral-300 text-lg font-medium">{misses}</p>
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-center">
        <p className="text-neutral-500 text-[10px] mb-0.5">{c("avgReactionLabel", lang)}</p>
        <p className="text-red-500 text-lg font-medium">{avgReactionMs != null ? Math.round(avgReactionMs) : "—"}</p>
      </div>
    </div>
  );
}

export default function PadWorkMode({ lang, onBack, onSaveLiveSession }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const poseSessionRef = useRef(null);
  const rafRef = useRef(null);
  const phaseRef = useRef("setup");
  const phaseEndRef = useRef(0);
  const lastCountdownRef = useRef(-1);
  const targetRef = useRef(null);
  const lastTargetKeyRef = useRef(null);
  const roundStatsRef = useRef({ hits: 0, misses: 0, reactionTimes: [] });
  const trackerRef = useRef(null);

  // setup | prep | round | roundEnd | sessionEnd
  const [phase, setPhase] = useState("setup");
  const [roundCount, setRoundCount] = useState(6);
  const [roundDuration, setRoundDuration] = useState(120);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundsHistory, setRoundsHistory] = useState([]);
  const [liveStats, setLiveStats] = useState({ hits: 0, misses: 0, reactionTimes: [] });
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [competes, setCompetes] = useState(true);

  const teardownCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    poseSessionRef.current?.close();
    poseSessionRef.current = null;
  };

  useEffect(() => teardownCamera, []);

  const beginPrep = () => {
    phaseEndRef.current = performance.now() + PREP_MS;
    lastCountdownRef.current = -1;
    setCountdown(Math.ceil(PREP_MS / 1000));
    phaseRef.current = "prep";
    setPhase("prep");
  };

  const beginRound = (roundNumber) => {
    roundStatsRef.current = { hits: 0, misses: 0, reactionTimes: [] };
    setLiveStats({ hits: 0, misses: 0, reactionTimes: [] });
    targetRef.current = null;
    lastTargetKeyRef.current = null;
    trackerRef.current = createReactionTracker();
    setCurrentRound(roundNumber);
    phaseEndRef.current = performance.now() + roundDuration * 1000;
    lastCountdownRef.current = -1;
    setCountdown(roundDuration);
    phaseRef.current = "round";
    setPhase("round");
    playGong();
  };

  const endRound = () => {
    playGong();
    const { hits, misses, reactionTimes } = roundStatsRef.current;
    const avgReactionMs = reactionTimes.length ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length : null;
    setRoundsHistory((prev) => [...prev, { hits, misses, avgReactionMs }]);
    phaseRef.current = "roundEnd";
    setPhase("roundEnd");
  };

  const abortSession = () => {
    teardownCamera();
    setPhase("setup");
    setRoundsHistory([]);
    setNote("");
    setSaveStatus("idle");
    setCompetes(true);
  };

  const finishTraining = () => {
    teardownCamera();
    phaseRef.current = "sessionEnd";
    setPhase("sessionEnd");
  };

  const handleSaveToJournal = async () => {
    if (!onSaveLiveSession || saveStatus !== "idle") return;
    setSaveStatus("saving");
    const totalSeconds = roundsHistory.length * roundDuration;
    const minutes = Math.max(1, Math.round(totalSeconds / 60));
    const duration = lang === "en" ? `${minutes} min` : `${minutes} dk`;
    const blocks = roundsHistory.map((r, i) => {
      const roundLabel = `${c("perRoundLabel", lang)} ${i + 1}`;
      const avg = r.avgReactionMs != null ? `${Math.round(r.avgReactionMs)}ms` : "—";
      return lang === "en"
        ? `${roundLabel}: ${r.hits} hits, ${r.misses} missed, avg ${avg}`
        : `${roundLabel}: ${r.hits} isabet, ${r.misses} kaçırıldı, ort. ${avg}`;
    });
    try {
      await onSaveLiveSession({ note, blocks, duration, threeMinRounds: 0, competes, type: "Sanal Pad Work" });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
    }
  };

  const startTraining = async () => {
    setError("");
    setRoundsHistory([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      const maxWidth = 480;
      const vw = video.videoWidth || maxWidth;
      const vh = video.videoHeight || maxWidth;
      const width = Math.min(maxWidth, vw);
      const height = Math.round((vh / vw) * width) || width;
      const canvas = canvasRef.current;
      canvas.width = width;
      canvas.height = height;

      poseSessionRef.current = await createPoseSession();
      beginPrep();

      const ctx = canvas.getContext("2d");
      const loop = () => {
        if (!streamRef.current) return;
        // Draw the true (unmirrored) frame first and detect pose on THAT —
        // MediaPipe's left/right landmark labeling is trained on normal
        // camera orientation, so detecting on an already-mirrored image
        // risks scrambling exactly the left/right distinction this whole
        // mode depends on. Only after detection do we redraw the frame
        // mirrored for display (like a mirror/selfie view, so moving your
        // right hand visibly moves right on screen) — cheap to draw twice,
        // and keeps detection correctness completely separate from display.
        ctx.drawImage(video, 0, 0, width, height);
        const people = poseSessionRef.current ? poseSessionRef.current.detectAll(canvas) : [];
        const landmarks = people[0] || null;

        ctx.save();
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, width, height);
        ctx.restore();

        const now = performance.now();
        const currentPhase = phaseRef.current;
        const timedPhase = currentPhase === "prep" || currentPhase === "round";

        if (currentPhase === "round") {
          trackerRef.current?.update(landmarks, now);

          if (!targetRef.current) {
            const t = pickTarget(lastTargetKeyRef.current);
            const shoulder = landmarks ? landmarks[SHOULDER[t.side]] : null;
            const sw = trackerRef.current?.getShoulderWidth();
            if (shoulder && visible(shoulder) && sw > 0) {
              lastTargetKeyRef.current = t.key;
              targetRef.current = {
                ...t,
                spawnT: now,
                timeoutAt: now + TARGET_TIMEOUT_MS,
                // Frozen at spawn, not recomputed every frame — otherwise
                // the target visibly drifts/wobbles as the body naturally
                // sways while reaching for it, which reads as "it's
                // tracking me" and is distracting mid-punch.
                screenX: (shoulder.x + t.rel.x * sw) * width,
                screenY: (shoulder.y + t.rel.y * sw) * height,
                screenRadius: Math.max(28, HIT_RADIUS * sw * width),
              };
            }
          } else {
            const target = targetRef.current;
            const rel = trackerRef.current?.getRel(target.side);
            const speed = trackerRef.current?.getRecentPeakSpeed(target.side) || 0;
            const outcome = checkTarget(target, rel, speed, now);
            if (outcome === "hit") {
              const reactionMs = now - target.spawnT;
              roundStatsRef.current = {
                ...roundStatsRef.current,
                hits: roundStatsRef.current.hits + 1,
                reactionTimes: [...roundStatsRef.current.reactionTimes, reactionMs],
              };
              setLiveStats({ ...roundStatsRef.current });
              playHitTone(true);
              targetRef.current = null;
            } else if (outcome === "miss") {
              roundStatsRef.current = { ...roundStatsRef.current, misses: roundStatsRef.current.misses + 1 };
              setLiveStats({ ...roundStatsRef.current });
              playHitTone(false);
              targetRef.current = null;
            }
          }

          if (targetRef.current) {
            const { screenX: tx, screenY: ty, screenRadius: radius } = targetRef.current;
            const remainingFrac = Math.max(0, (targetRef.current.timeoutAt - now) / TARGET_TIMEOUT_MS);
            ctx.save();
            ctx.translate(width, 0);
            ctx.scale(-1, 1);
            ctx.beginPath();
            ctx.arc(tx, ty, radius, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(220,38,38,0.25)";
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#dc2626";
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(tx, ty, radius, -Math.PI / 2, -Math.PI / 2 + remainingFrac * Math.PI * 2);
            ctx.strokeStyle = "#f5f5f5";
            ctx.stroke();
            ctx.restore();

            // Drawn as a separate, un-mirrored pass at the manually
            // flipped x-coordinate (width - tx) — text drawn inside the
            // mirror transform above would render backwards/unreadable.
            ctx.fillStyle = "#fff";
            ctx.font = "800 20px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
            ctx.strokeText(c(targetRef.current.side, lang), width - tx, ty);
            ctx.fillText(c(targetRef.current.side, lang), width - tx, ty);
          }
        }

        if (timedPhase) {
          const remainingMs = phaseEndRef.current - now;
          if (remainingMs > 0) {
            const remainingSec = Math.ceil(remainingMs / 1000);
            if (remainingSec !== lastCountdownRef.current) {
              lastCountdownRef.current = remainingSec;
              setCountdown(remainingSec);
            }
          } else if (currentPhase === "prep") {
            beginRound(1);
          } else {
            endRound();
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      teardownCamera();
      setPhase("setup");
      if (e.name === "NotAllowedError") setError(c("permissionDenied", lang));
      else if (e.name === "NotFoundError") setError(c("noCamera", lang));
      else setError(c("genericError", lang));
    }
  };

  const cameraPhases = phase === "prep" || phase === "round" || phase === "roundEnd";
  const lastRound = roundsHistory[roundsHistory.length - 1];
  const totals = roundsHistory.reduce(
    (acc, r) => ({ hits: acc.hits + r.hits, misses: acc.misses + r.misses }),
    { hits: 0, misses: 0 }
  );
  const allReactionTimes = roundsHistory.flatMap((r) => (r.avgReactionMs != null ? [r.avgReactionMs] : []));
  const overallAvgReaction = allReactionTimes.length ? allReactionTimes.reduce((a, b) => a + b, 0) / allReactionTimes.length : null;

  return (
    <div className="flex flex-col" style={{ minHeight: 420 }}>
      <video ref={videoRef} playsInline muted className="hidden" />

      <div className="flex items-center gap-2 mb-3">
        {phase === "setup" && (
          <button onClick={onBack} aria-label="Back" className="text-neutral-500 hover:text-neutral-300 transition-colors">
            <ChevronLeft size={18} />
          </button>
        )}
        <p className="text-neutral-500 text-xs">{phase === "setup" ? c("subtitle", lang) : ""}</p>
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      {phase === "setup" && (
        <div className="flex flex-col gap-4 mb-3">
          <div>
            <p className="text-neutral-400 text-xs mb-2">{c("roundsLabel", lang)}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRoundCount((n) => Math.max(1, n - 1))}
                className="w-9 h-9 flex items-center justify-center bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300"
              >
                <Minus size={14} />
              </button>
              <span className="text-neutral-100 text-lg font-medium w-8 text-center">{roundCount}</span>
              <button
                onClick={() => setRoundCount((n) => Math.min(12, n + 1))}
                className="w-9 h-9 flex items-center justify-center bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div>
            <p className="text-neutral-400 text-xs mb-2">{c("roundDurationLabel", lang)}</p>
            <div className="flex gap-1.5">
              {ROUND_DURATIONS.map((sec) => (
                <button
                  key={sec}
                  onClick={() => setRoundDuration(sec)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    roundDuration === sec ? "bg-red-950 border-red-900 text-red-400" : "bg-neutral-950 border-neutral-800 text-neutral-500"
                  }`}
                >
                  {sec / 60} {c("minuteShort", lang)}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startTraining}
            className="w-full bg-red-600 hover:bg-red-500 text-neutral-950 font-medium text-sm rounded-lg py-2.5 transition-colors"
          >
            {c("startLabel", lang)}
          </button>
        </div>
      )}

      <div
        className="relative bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden mb-3"
        style={{ display: cameraPhases ? "block" : "none", minHeight: 240 }}
      >
        <canvas ref={canvasRef} className="w-full block" />

        <button
          onClick={abortSession}
          aria-label="Close"
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-neutral-950/70 rounded-full text-neutral-400"
        >
          <X size={14} />
        </button>

        {phase === "round" && (
          <div className="absolute top-2 left-2 bg-neutral-950/70 rounded-lg px-2.5 py-1">
            <span className="text-neutral-100 text-xs font-medium tabular-nums">
              {c("roundLabel", lang)} {currentRound}/{roundCount} · {formatClock(countdown)}
            </span>
          </div>
        )}

        {phase === "prep" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral-950/60">
            <span className="text-neutral-100 text-4xl font-medium tabular-nums">{countdown}</span>
            <span className="text-neutral-400 text-xs">{c("prepLabel", lang)}</span>
          </div>
        )}
      </div>

      {phase === "round" && (
        <div className="flex flex-col gap-2.5 mb-3">
          <StatsRow
            hits={liveStats.hits}
            misses={liveStats.misses}
            avgReactionMs={
              liveStats.reactionTimes.length ? liveStats.reactionTimes.reduce((a, b) => a + b, 0) / liveStats.reactionTimes.length : null
            }
            lang={lang}
          />
        </div>
      )}

      {phase === "roundEnd" && lastRound && (
        <div className="flex flex-col gap-3 mb-3">
          <p className="text-neutral-300 text-sm font-medium">
            {c("roundSummaryTitle", lang)} · {c("perRoundLabel", lang)} {currentRound}
          </p>
          <StatsRow hits={lastRound.hits} misses={lastRound.misses} avgReactionMs={lastRound.avgReactionMs} lang={lang} />
          {currentRound < roundCount ? (
            <button
              onClick={() => beginRound(currentRound + 1)}
              className="w-full bg-red-600 hover:bg-red-500 text-neutral-950 font-medium text-sm rounded-lg py-2.5 transition-colors"
            >
              {c("nextRoundLabel", lang)}
            </button>
          ) : (
            <button
              onClick={finishTraining}
              className="w-full bg-red-600 hover:bg-red-500 text-neutral-950 font-medium text-sm rounded-lg py-2.5 transition-colors"
            >
              {c("finishTrainingLabel", lang)}
            </button>
          )}
        </div>
      )}

      {phase === "sessionEnd" && (
        <div className="flex flex-col gap-3">
          <p className="text-neutral-300 text-sm font-medium">{c("sessionSummaryTitle", lang)}</p>
          <StatsRow hits={totals.hits} misses={totals.misses} avgReactionMs={overallAvgReaction} lang={lang} />

          <div className="flex flex-col gap-1.5">
            {roundsHistory.map((r, i) => (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 flex items-center justify-between">
                <span className="text-neutral-400 text-xs">
                  {c("perRoundLabel", lang)} {i + 1}
                </span>
                <span className="text-neutral-300 text-xs">
                  {r.hits}/{r.hits + r.misses} · {r.avgReactionMs != null ? `${Math.round(r.avgReactionMs)}${c("msShort", lang)}` : "—"}
                </span>
              </div>
            ))}
          </div>

          {onSaveLiveSession && (
            <div className="flex flex-col gap-2">
              <p className="text-neutral-400 text-xs">{c("noteLabel", lang)}</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={c("notePlaceholder", lang)}
                rows={3}
                disabled={saveStatus !== "idle"}
                className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded-lg px-3 py-2 resize-none disabled:opacity-60"
              />

              <button
                onClick={() => setCompetes((v) => !v)}
                disabled={saveStatus !== "idle"}
                className="flex items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 disabled:opacity-60 text-left"
              >
                <span>
                  <span className="block text-neutral-200 text-xs font-medium">{c("competesLabel", lang)}</span>
                  <span className="block text-neutral-600 text-[10px] mt-0.5 leading-snug">{c("competesHint", lang)}</span>
                </span>
                <span
                  className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${competes ? "bg-red-600" : "bg-neutral-700"}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-neutral-100 transition-transform ${
                      competes ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>

              <button
                onClick={handleSaveToJournal}
                disabled={saveStatus !== "idle"}
                className={`w-full text-sm font-medium rounded-lg py-2.5 transition-colors ${
                  saveStatus === "saved"
                    ? "bg-neutral-900 border border-emerald-900 text-emerald-400"
                    : "bg-red-600 hover:bg-red-500 text-neutral-950"
                } ${saveStatus === "saving" ? "opacity-60" : ""}`}
              >
                {saveStatus === "saved"
                  ? c("savedToJournalLabel", lang)
                  : saveStatus === "saving"
                  ? c("savingToJournalLabel", lang)
                  : c("saveToJournalLabel", lang)}
              </button>
            </div>
          )}

          <button
            onClick={abortSession}
            className="w-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 text-sm rounded-lg py-2.5 transition-colors"
          >
            {c("newTrainingLabel", lang)}
          </button>
        </div>
      )}
    </div>
  );
}
