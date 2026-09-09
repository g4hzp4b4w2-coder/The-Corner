import { useEffect, useRef, useState } from "react";
import { ChevronLeft, X, Minus, Plus } from "lucide-react";
import { createPoseSession } from "./lib/poseAnalysis";
import { createPunchDetector } from "./lib/liveDetection";
import { playGong, playHitTone } from "./lib/gongSound";
import { getPunchSampleSummary, addComboDrillSamples } from "./lib/db";
import { summarizeSeed } from "./lib/armTracker";
import { COMBOS, pickCombo, matchesStep, STEP_TIMEOUT_MS, RECOVERY_MS } from "./lib/comboTarget";

const ROUND_DURATIONS = [60, 120, 180];
const PREP_MS = 5000;

const SIDE_WORD = { left: { tr: "Sol", en: "Left" }, right: { tr: "Sağ", en: "Right" } };
const STYLE_WORD = {
  straight: { tr: "Düz", en: "Straight" },
  hook: { tr: "Hook", en: "Hook" },
  uppercut: { tr: "Uppercut", en: "Uppercut" },
};

function stepLabel(step, lang) {
  const side = SIDE_WORD[step.side][lang] || SIDE_WORD[step.side].tr;
  const style = STYLE_WORD[step.style][lang] || STYLE_WORD[step.style].tr;
  return `${side} ${style}`;
}

// Browsers only allow speechSynthesis to actually produce sound after a
// direct user gesture (a tap), and Chrome/Android in particular has a
// known bug where calling speak() immediately after cancel() silently
// drops the utterance. Priming with a near-silent utterance at the exact
// moment the user taps "Başla" unlocks audio for the rest of the session;
// the setTimeout gap before every later speak() avoids the cancel/speak
// race.
export function primeSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Best-effort — if this fails, speakCombo below will too, and the
    // combo is always shown on screen regardless.
  }
}

function pickVoice(lang) {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const wanted = lang === "en" ? "en" : "tr";
  return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(wanted)) || null;
}

function speakCombo(combo, lang) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const text = combo.steps.map((s) => stepLabel(s, lang)).join(", ");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "en" ? "en-US" : "tr-TR";
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.rate = 1.05;
    window.speechSynthesis.cancel();
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        // Speech synthesis is a nice-to-have — the combo is always shown
        // on screen too, so a browser without working TTS just loses the
        // audio, not the drill itself.
      }
    }, 30);
  } catch {
    // Same as above — non-fatal, screen text is the reliable channel.
  }
}

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
  hitsLabel: { tr: "Tamamlanan", en: "Completed" },
  missesLabel: { tr: "Kaçırılan", en: "Missed" },
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
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function StatsRow({ hits, misses, lang }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-center">
        <p className="text-neutral-500 text-[10px] mb-0.5">{c("hitsLabel", lang)}</p>
        <p className="text-emerald-400 text-lg font-medium">{hits}</p>
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-center">
        <p className="text-neutral-500 text-[10px] mb-0.5">{c("missesLabel", lang)}</p>
        <p className="text-neutral-300 text-lg font-medium">{misses}</p>
      </div>
    </div>
  );
}

export default function ComboDrillMode({ lang, onBack, onSaveLiveSession, userId }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const poseSessionRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const phaseRef = useRef("setup");
  const phaseEndRef = useRef(0);
  const lastCountdownRef = useRef(-1);
  const seedRef = useRef({});
  const comboRef = useRef(null); // { combo, stepIndex, stepStartT, stepTimeoutAt, detectedEvents }
  const lastComboKeyRef = useRef(null);
  const nextComboAtRef = useRef(0);
  const roundStatsRef = useRef({ hits: 0, misses: 0 });
  const sessionAttemptsRef = useRef([]); // flat list across the whole session, for the diagnostic upload

  // setup | prep | round | roundEnd | sessionEnd
  const [phase, setPhase] = useState("setup");
  const [roundCount, setRoundCount] = useState(6);
  const [roundDuration, setRoundDuration] = useState(120);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundsHistory, setRoundsHistory] = useState([]);
  const [liveStats, setLiveStats] = useState({ hits: 0, misses: 0 });
  const [currentCombo, setCurrentCombo] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [competes, setCompetes] = useState(true);

  const teardownCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    poseSessionRef.current?.close();
    poseSessionRef.current = null;
  };

  useEffect(() => teardownCamera, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getPunchSampleSummary(userId)
      .then((samples) => {
        if (!cancelled) seedRef.current = summarizeSeed(samples);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const beginPrep = () => {
    phaseEndRef.current = performance.now() + PREP_MS;
    lastCountdownRef.current = -1;
    setCountdown(Math.ceil(PREP_MS / 1000));
    phaseRef.current = "prep";
    setPhase("prep");
  };

  const startStep = (combo, stepIndex, now) => {
    comboRef.current = {
      combo,
      stepIndex,
      stepStartT: now,
      stepTimeoutAt: now + STEP_TIMEOUT_MS,
      detectedEvents: [],
    };
    setCurrentCombo(combo);
    setCurrentStepIndex(stepIndex);
  };

  const beginRound = (roundNumber) => {
    // Deliberately NOT recreating the detector here (unlike other modes) —
    // classifyStyle's hook/straight split needs a handful of this arm's own
    // recent punches before it can tell them apart at all (see
    // MIN_DISPLACEMENT_SAMPLES in liveDetection.js); a fresh detector every
    // round means every round's first hook call is judged with zero
    // history and defaults to "straight". Keeping one detector for the
    // whole session lets that warm-up happen once, not every round.
    roundStatsRef.current = { hits: 0, misses: 0 };
    setLiveStats({ hits: 0, misses: 0 });
    comboRef.current = null;
    lastComboKeyRef.current = null;
    nextComboAtRef.current = 0;
    setCurrentCombo(null);
    setCurrentStepIndex(-1);
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
    const { hits, misses } = roundStatsRef.current;
    setRoundsHistory((prev) => [...prev, { hits, misses }]);
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
    sessionAttemptsRef.current = [];
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
      return lang === "en"
        ? `${roundLabel}: ${r.hits} combos completed, ${r.misses} missed`
        : `${roundLabel}: ${r.hits} kombinasyon tamamlandı, ${r.misses} kaçırıldı`;
    });
    try {
      await onSaveLiveSession({ note, blocks, duration, threeMinRounds: 0, competes, type: "Kombinasyon" });
      if (userId) addComboDrillSamples(userId, sessionAttemptsRef.current).catch(() => {});
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
    }
  };

  const startTraining = async () => {
    setError("");
    setRoundsHistory([]);
    sessionAttemptsRef.current = [];
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
      detectorRef.current = createPunchDetector(seedRef.current);
      beginPrep();

      const ctx = canvas.getContext("2d");
      const loop = () => {
        if (!streamRef.current) return;
        // Same mirror-after-detect pattern as every other live mode: detect
        // on the raw frame so MediaPipe's own left/right labeling stays
        // correct, only mirror the frame drawn for the user to look at.
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
          const newEvents = detectorRef.current.update(landmarks, now);

          if (!comboRef.current) {
            if (now >= nextComboAtRef.current) {
              const combo = pickCombo(lastComboKeyRef.current);
              lastComboKeyRef.current = combo.key;
              speakCombo(combo, lang);
              startStep(combo, 0, now);
            }
          } else {
            const state = comboRef.current;
            const step = state.combo.steps[state.stepIndex];

            for (const ev of newEvents) {
              if (ev.type !== "punch") continue;
              state.detectedEvents.push({ side: ev.side, style: ev.style, offsetMs: Math.round(ev.t - state.stepStartT) });
            }

            const matched = newEvents.find((ev) => matchesStep(step, ev));
            if (matched) {
              sessionAttemptsRef.current.push({
                comboKey: state.combo.key,
                stepIndex: state.stepIndex,
                expectedSide: step.side,
                expectedStyle: step.style,
                outcome: "hit",
                timeToHitMs: Math.round(matched.t - state.stepStartT),
                detectedEvents: state.detectedEvents,
              });
              const nextIndex = state.stepIndex + 1;
              if (nextIndex < state.combo.steps.length) {
                startStep(state.combo, nextIndex, now);
              } else {
                roundStatsRef.current = { ...roundStatsRef.current, hits: roundStatsRef.current.hits + 1 };
                setLiveStats({ ...roundStatsRef.current });
                playHitTone(true);
                comboRef.current = null;
                setCurrentCombo(null);
                setCurrentStepIndex(-1);
                nextComboAtRef.current = now + RECOVERY_MS;
              }
            } else if (now > state.stepTimeoutAt) {
              sessionAttemptsRef.current.push({
                comboKey: state.combo.key,
                stepIndex: state.stepIndex,
                expectedSide: step.side,
                expectedStyle: step.style,
                outcome: "miss",
                timeToHitMs: null,
                detectedEvents: state.detectedEvents,
              });
              roundStatsRef.current = { ...roundStatsRef.current, misses: roundStatsRef.current.misses + 1 };
              setLiveStats({ ...roundStatsRef.current });
              playHitTone(false);
              comboRef.current = null;
              setCurrentCombo(null);
              setCurrentStepIndex(-1);
              nextComboAtRef.current = now + RECOVERY_MS;
            }
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
  const totals = roundsHistory.reduce((acc, r) => ({ hits: acc.hits + r.hits, misses: acc.misses + r.misses }), { hits: 0, misses: 0 });

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
            onClick={() => {
              primeSpeech();
              startTraining();
            }}
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

        {/* The step actually being waited on right now is the one thing
            that must be readable at a glance mid-round — real testing
            showed the earlier small badge-row cost more time to read than
            the whole response window was worth. This is the loud, primary
            channel; the strip below is just sequence context. */}
        {phase === "round" && currentCombo && currentStepIndex >= 0 && (
          <div className="absolute inset-x-0 top-3 flex justify-center px-3 pointer-events-none">
            <div className="bg-red-600 text-neutral-950 font-extrabold text-3xl px-5 py-2.5 rounded-xl text-center shadow-lg leading-tight">
              {stepLabel(currentCombo.steps[currentStepIndex], lang)}
            </div>
          </div>
        )}

        {phase === "round" && currentCombo && (
          <div className="absolute inset-x-0 bottom-0 bg-neutral-950/80 px-3 py-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {currentCombo.steps.map((step, i) => (
                <span
                  key={i}
                  className={`text-sm font-medium px-2 py-1 rounded-lg border ${
                    i === currentStepIndex
                      ? "bg-red-600 border-red-500 text-neutral-950"
                      : i < currentStepIndex
                      ? "bg-emerald-950 border-emerald-900 text-emerald-400"
                      : "bg-neutral-900 border-neutral-800 text-neutral-400"
                  }`}
                >
                  {stepLabel(step, lang)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {phase === "round" && (
        <div className="flex flex-col gap-2.5 mb-3">
          <StatsRow hits={liveStats.hits} misses={liveStats.misses} lang={lang} />
        </div>
      )}

      {phase === "roundEnd" && lastRound && (
        <div className="flex flex-col gap-3 mb-3">
          <p className="text-neutral-300 text-sm font-medium">
            {c("roundSummaryTitle", lang)} · {c("perRoundLabel", lang)} {currentRound}
          </p>
          <StatsRow hits={lastRound.hits} misses={lastRound.misses} lang={lang} />
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
          <StatsRow hits={totals.hits} misses={totals.misses} lang={lang} />

          <div className="flex flex-col gap-1.5">
            {roundsHistory.map((r, i) => (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 flex items-center justify-between">
                <span className="text-neutral-400 text-xs">
                  {c("perRoundLabel", lang)} {i + 1}
                </span>
                <span className="text-neutral-300 text-xs">
                  {r.hits}/{r.hits + r.misses}
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
