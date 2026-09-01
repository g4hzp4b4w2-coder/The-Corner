import { useEffect, useRef, useState } from "react";
import { ChevronLeft, X, Minus, Plus } from "lucide-react";
import { createPoseSession, drawSkeletons } from "./lib/poseAnalysis";
import { createPunchDetector } from "./lib/liveDetection";
import { playGong } from "./lib/gongSound";

const STYLE_LABEL = {
  straight: { tr: "Düz", en: "Straight" },
  hook: { tr: "Hook", en: "Hook" },
  uppercut: { tr: "Uppercut", en: "Uppercut" },
};
const SIDE_LABEL = {
  left: { tr: "Sol kol", en: "Left arm" },
  right: { tr: "Sağ kol", en: "Right arm" },
};

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
  prepLabel: { tr: "Hazırlan, kamerayı yerleştir", en: "Get ready, set up the camera" },
  roundLabel: { tr: "Raund", en: "Round" },
  permissionDenied: {
    tr: "Kamera izni verilmedi. Tarayıcı ayarlarından bu site için kameraya izin ver.",
    en: "Camera permission was denied. Allow camera access for this site in your browser settings.",
  },
  noCamera: { tr: "Kamera bulunamadı.", en: "No camera found." },
  genericError: { tr: "Kamera başlatılamadı, tekrar dene.", en: "Couldn't start the camera, try again." },
  totalPunches: { tr: "Toplam yumruk", en: "Total punches" },
  guardDropsLabel: { tr: "Guard düşüşü", en: "Guard drops" },
  guardWarning: { tr: "Guard açık!", en: "Guard's down!" },
  recentLabel: { tr: "Son hareketler", en: "Recent moves" },
  guardDropEvent: { tr: "guard düştü", en: "guard dropped" },
  roundSummaryTitle: { tr: "Raund özeti", en: "Round summary" },
  nextRoundLabel: { tr: "Sonraki raund", en: "Next round" },
  finishTrainingLabel: { tr: "Antrenmanı bitir", en: "Finish training" },
  sessionSummaryTitle: { tr: "Antrenman özeti", en: "Training summary" },
  newTrainingLabel: { tr: "Yeni antrenman", en: "New training" },
  perRoundLabel: { tr: "Raund", en: "Round" },
  confidenceHigh: { tr: "Yüksek güven", en: "High confidence" },
  confidenceMedium: { tr: "Orta güven", en: "Medium confidence" },
  confidenceLow: { tr: "Düşük güven", en: "Low confidence" },
  confidenceHint: {
    tr: "Kameraya daha dönük dur, sayım daha güvenilir olur.",
    en: "Face the camera more directly for a more reliable count.",
  },
  correctCountLabel: { tr: "Bu sayı yanlış mıydı? Düzelt", en: "Was this count wrong? Fix it" },
  correctCountPlaceholder: { tr: "Gerçek sayı", en: "Actual count" },
  saveCorrectionLabel: { tr: "Kaydet", en: "Save" },
  correctedLabel: { tr: "Düzeltildi", en: "Corrected" },
  aiCountLabel: { tr: "AI sayımı", en: "AI count" },
  noteLabel: { tr: "Not (opsiyonel)", en: "Note (optional)" },
  notePlaceholder: {
    tr: "Bu antrenman hakkında not ekle...",
    en: "Add a note about this session...",
  },
  saveToJournalLabel: { tr: "Günlüğe kaydet", en: "Save to journal" },
  savingToJournalLabel: { tr: "Kaydediliyor...", en: "Saving..." },
  savedToJournalLabel: { tr: "Günlüğe kaydedildi", en: "Saved to journal" },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

const emptyRoundStats = { left: 0, right: 0, straight: 0, hook: 0, uppercut: 0, guardDrops: 0 };

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function sumStats(list) {
  return list.reduce(
    (acc, r) => ({
      left: acc.left + r.left,
      right: acc.right + r.right,
      straight: acc.straight + r.straight,
      hook: acc.hook + r.hook,
      uppercut: acc.uppercut + r.uppercut,
      guardDrops: acc.guardDrops + r.guardDrops,
    }),
    { ...emptyRoundStats }
  );
}

// The single biggest known driver of count accuracy is camera framing
// (turning bladed relative to the camera shrinks the shoulder-width scale
// the whole detector normalizes by). Rather than present every count as
// equally trustworthy, turn that one signal into an honest confidence
// level instead of silently miscounting.
function confidenceLevel(diagnostics) {
  if (!diagnostics) return "high";
  if (diagnostics.minShoulderWidthRatio >= 0.72) return "high";
  if (diagnostics.minShoulderWidthRatio >= 0.5) return "medium";
  return "low";
}

function ConfidenceBadge({ level, lang }) {
  const styles = {
    high: "bg-emerald-950 border-emerald-900 text-emerald-400",
    medium: "bg-amber-950 border-amber-900 text-amber-400",
    low: "bg-red-950 border-red-900 text-red-400",
  };
  const labelKey = { high: "confidenceHigh", medium: "confidenceMedium", low: "confidenceLow" }[level];
  return (
    <div className={`flex flex-col gap-0.5 border rounded-lg px-2.5 py-2 ${styles[level] || styles.high}`}>
      <span className="text-xs font-medium">{c(labelKey, lang)}</span>
      {level !== "high" && <span className="text-[11px] opacity-80">{c("confidenceHint", lang)}</span>}
    </div>
  );
}

function CountCorrection({ round, roundIndex, onCorrect, lang }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const aiTotal = round.left + round.right;

  if (round.correctedTotal != null) {
    return (
      <p className="text-neutral-500 text-[11px]">
        {c("correctedLabel", lang)}: <span className="text-neutral-200 font-medium">{round.correctedTotal}</span>{" "}
        ({c("aiCountLabel", lang)}: {aiTotal})
      </p>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setEditing(true);
          setValue(String(aiTotal));
        }}
        className="text-neutral-500 hover:text-neutral-300 text-[11px] text-left underline decoration-dotted transition-colors"
      >
        {c("correctCountLabel", lang)}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={c("correctCountPlaceholder", lang)}
        className="w-20 bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded-lg px-2 py-1.5"
      />
      <button
        onClick={() => {
          const n = Number(value);
          if (Number.isFinite(n) && n >= 0) {
            onCorrect(roundIndex, n);
            setEditing(false);
          }
        }}
        className="bg-red-600 hover:bg-red-500 text-neutral-950 text-[11px] font-medium rounded-lg px-2.5 py-1.5 transition-colors"
      >
        {c("saveCorrectionLabel", lang)}
      </button>
    </div>
  );
}

function buildSessionBlocks(roundsHistory, lang) {
  return roundsHistory.map((r, i) => {
    const total = r.correctedTotal ?? r.left + r.right;
    const roundLabel = `${c("perRoundLabel", lang)} ${i + 1}`;
    if (lang === "en") {
      return `${roundLabel}: ${total} punches (${r.left} left, ${r.right} right) · ${r.guardDrops} guard drops`;
    }
    return `${roundLabel}: ${total} yumruk (${r.left} sol, ${r.right} sağ) · ${r.guardDrops} guard düşüşü`;
  });
}

function StatsGrid({ stats, lang }) {
  const total = stats.left + stats.right;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-center">
          <p className="text-neutral-500 text-[10px] mb-0.5">{SIDE_LABEL.left[lang] || SIDE_LABEL.left.tr}</p>
          <p className="text-neutral-100 text-lg font-medium">{stats.left}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-center">
          <p className="text-neutral-500 text-[10px] mb-0.5">{SIDE_LABEL.right[lang] || SIDE_LABEL.right.tr}</p>
          <p className="text-neutral-100 text-lg font-medium">{stats.right}</p>
        </div>
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 flex items-center justify-between">
        <span className="text-neutral-500 text-xs">{c("totalPunches", lang)}</span>
        <span className="text-red-500 text-base font-medium">{total}</span>
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 flex items-center justify-between">
        <span className="text-neutral-500 text-xs">{c("guardDropsLabel", lang)}</span>
        <span className="text-neutral-200 text-base font-medium">{stats.guardDrops}</span>
      </div>
    </div>
  );
}

export default function ShadowBoxingMode({ lang, onBack, onSaveLiveSession }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const poseSessionRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const guardWarnTimeoutRef = useRef(null);
  const phaseRef = useRef("setup");
  const phaseEndRef = useRef(0);
  const lastCountdownRef = useRef(-1);
  const roundStatsRef = useRef({ ...emptyRoundStats });

  // setup | prep | round | roundEnd | sessionEnd
  const [phase, setPhase] = useState("setup");
  const [roundCount, setRoundCount] = useState(6);
  const [roundDuration, setRoundDuration] = useState(180);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundsHistory, setRoundsHistory] = useState([]);
  const [roundStats, setRoundStats] = useState({ ...emptyRoundStats });
  const [events, setEvents] = useState([]);
  const [guardWarning, setGuardWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle");

  const teardownCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (guardWarnTimeoutRef.current) clearTimeout(guardWarnTimeoutRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    poseSessionRef.current?.close();
    poseSessionRef.current = null;
  };

  useEffect(() => teardownCamera, []);

  const handleEvents = (newEvents) => {
    if (newEvents.length === 0) return;
    const next = { ...roundStatsRef.current };
    for (const ev of newEvents) {
      if (ev.type === "punch") {
        next[ev.side] += 1;
        next[ev.style] += 1;
      } else if (ev.type === "guardDrop") {
        next.guardDrops += 1;
      }
    }
    roundStatsRef.current = next;
    setRoundStats(next);
    setEvents((prev) => [...newEvents, ...prev].slice(0, 6));
    if (newEvents.some((ev) => ev.type === "guardDrop")) {
      setGuardWarning(true);
      if (guardWarnTimeoutRef.current) clearTimeout(guardWarnTimeoutRef.current);
      guardWarnTimeoutRef.current = setTimeout(() => setGuardWarning(false), 1200);
    }
  };

  const beginPrep = () => {
    phaseEndRef.current = performance.now() + PREP_MS;
    lastCountdownRef.current = -1;
    setCountdown(Math.ceil(PREP_MS / 1000));
    phaseRef.current = "prep";
    setPhase("prep");
  };

  const beginRound = (roundNumber) => {
    detectorRef.current = createPunchDetector();
    roundStatsRef.current = { ...emptyRoundStats };
    setRoundStats({ ...emptyRoundStats });
    setEvents([]);
    setGuardWarning(false);
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
    const diagnostics = detectorRef.current?.getDiagnostics?.();
    const confidence = confidenceLevel(diagnostics);
    setRoundsHistory((prev) => [...prev, { ...roundStatsRef.current, confidence, correctedTotal: null }]);
    phaseRef.current = "roundEnd";
    setPhase("roundEnd");
  };

  const applyCorrection = (roundIndex, correctedTotal) => {
    setRoundsHistory((prev) => prev.map((r, i) => (i === roundIndex ? { ...r, correctedTotal } : r)));
  };

  const abortSession = () => {
    teardownCamera();
    setPhase("setup");
    setRoundsHistory([]);
    setNote("");
    setSaveStatus("idle");
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
    const blocks = buildSessionBlocks(roundsHistory, lang);
    try {
      await onSaveLiveSession({ note, blocks, duration });
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
        ctx.drawImage(video, 0, 0, width, height);
        const people = poseSessionRef.current ? poseSessionRef.current.detectAll(canvas) : [];
        drawSkeletons(canvas, people);

        const now = performance.now();
        const currentPhase = phaseRef.current;
        const timedPhase = currentPhase === "prep" || currentPhase === "round";

        if (timedPhase) {
          const remainingMs = phaseEndRef.current - now;
          if (remainingMs > 0) {
            const remainingSec = Math.ceil(remainingMs / 1000);
            if (remainingSec !== lastCountdownRef.current) {
              lastCountdownRef.current = remainingSec;
              setCountdown(remainingSec);
            }
            if (currentPhase === "round") {
              const newEvents = detectorRef.current.update(people[0] || null, now);
              handleEvents(newEvents);
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
  const totals = sumStats(roundsHistory);

  return (
    <div className="flex flex-col" style={{ minHeight: 420 }}>
      {/* Rendered once, unconditionally, so it never unmounts mid-session —
          a phase-gated <video> would remount on every phase change and risk
          the live stream freezing on browsers that pause detached media
          elements. */}
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

      {/* Also rendered unconditionally (display toggled via CSS) for the
          same reason as the video above — startTraining() needs canvasRef
          to already point at a mounted element the moment the user taps
          "Başla", while we're still in the "setup" phase. */}
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

        {guardWarning && phase === "round" && (
          <div className="absolute inset-x-0 bottom-0 bg-red-600 text-neutral-950 text-xs font-medium text-center py-1.5">
            {c("guardWarning", lang)}
          </div>
        )}
      </div>

      {phase === "round" && (
        <div className="flex flex-col gap-2.5 mb-3">
          <StatsGrid stats={roundStats} lang={lang} />
          {events.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5">
              <p className="text-neutral-500 text-[10px] mb-1.5">{c("recentLabel", lang)}</p>
              <div className="flex flex-col gap-1">
                {events.map((ev, i) => (
                  <p key={i} className="text-neutral-300 text-xs">
                    {SIDE_LABEL[ev.side][lang] || SIDE_LABEL[ev.side].tr}
                    {ev.type === "punch" ? ` · ${STYLE_LABEL[ev.style][lang] || STYLE_LABEL[ev.style].tr}` : ` · ${c("guardDropEvent", lang)}`}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "roundEnd" && lastRound && (
        <div className="flex flex-col gap-3 mb-3">
          <p className="text-neutral-300 text-sm font-medium">
            {c("roundSummaryTitle", lang)} · {c("perRoundLabel", lang)} {currentRound}
          </p>
          <StatsGrid stats={lastRound} lang={lang} />
          <ConfidenceBadge level={lastRound.confidence} lang={lang} />
          <CountCorrection round={lastRound} roundIndex={roundsHistory.length - 1} onCorrect={applyCorrection} lang={lang} />
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
          <StatsGrid stats={totals} lang={lang} />

          <div className="flex flex-col gap-1.5">
            {roundsHistory.map((r, i) => (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 flex items-center justify-between">
                <span className="text-neutral-400 text-xs">
                  {c("perRoundLabel", lang)} {i + 1}
                </span>
                <span className="text-neutral-300 text-xs">
                  {r.correctedTotal ?? r.left + r.right} {lang === "en" ? "punches" : "yumruk"}
                  {r.correctedTotal != null ? ` (${c("correctedLabel", lang).toLowerCase()})` : ""} · {r.guardDrops}{" "}
                  {c("guardDropsLabel", lang).toLowerCase()}
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
