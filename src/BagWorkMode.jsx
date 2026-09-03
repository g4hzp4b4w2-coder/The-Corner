import { useEffect, useRef, useState } from "react";
import { ChevronLeft, X, Minus, Plus, Volume2 } from "lucide-react";
import { createPoseSession, drawSkeletons } from "./lib/poseAnalysis";
import { createArmTracker } from "./lib/armTracker";
import { createImpactDetector, rmsOf } from "./lib/audioImpact";
import { addPunchSamples } from "./lib/db";
import { playGong } from "./lib/gongSound";

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
  prepLabel: { tr: "Hazırlan, mikrofon torbaya yakın olsun", en: "Get ready, keep the mic close to the bag" },
  roundLabel: { tr: "Raund", en: "Round" },
  permissionDenied: {
    tr: "Kamera/mikrofon izni verilmedi. Tarayıcı ayarlarından bu site için izin ver.",
    en: "Camera/microphone permission was denied. Allow access for this site in your browser settings.",
  },
  noCamera: { tr: "Kamera veya mikrofon bulunamadı.", en: "No camera or microphone found." },
  genericError: { tr: "Başlatılamadı, tekrar dene.", en: "Couldn't start, try again." },
  totalHits: { tr: "Toplam darbe", en: "Total hits" },
  listeningLabel: { tr: "Dinleniyor", en: "Listening" },
  roundSummaryTitle: { tr: "Raund özeti", en: "Round summary" },
  nextRoundLabel: { tr: "Sonraki raund", en: "Next round" },
  finishTrainingLabel: { tr: "Antrenmanı bitir", en: "Finish training" },
  sessionSummaryTitle: { tr: "Antrenman özeti", en: "Training summary" },
  newTrainingLabel: { tr: "Yeni antrenman", en: "New training" },
  perRoundLabel: { tr: "Raund", en: "Round" },
  correctCountLabel: { tr: "Bu sayı yanlış mıydı? Düzelt", en: "Was this count wrong? Fix it" },
  correctCountPlaceholder: { tr: "Gerçek sayı", en: "Actual count" },
  saveCorrectionLabel: { tr: "Kaydet", en: "Save" },
  correctedLabel: { tr: "Düzeltildi", en: "Corrected" },
  aiCountLabel: { tr: "Sayaç", en: "Counter" },
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

function CountCorrection({ round, roundIndex, onCorrect, lang }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  if (round.correctedTotal != null) {
    return (
      <p className="text-neutral-500 text-[11px]">
        {c("correctedLabel", lang)}: <span className="text-neutral-200 font-medium">{round.correctedTotal}</span>{" "}
        ({c("aiCountLabel", lang)}: {round.hits})
      </p>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setEditing(true);
          setValue(String(round.hits));
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

function HitsCard({ hits, lang }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 flex items-center justify-between">
      <span className="text-neutral-500 text-xs">{c("totalHits", lang)}</span>
      <span className="text-red-500 text-xl font-medium">{hits}</span>
    </div>
  );
}

export default function BagWorkMode({ lang, onBack, onSaveLiveSession, userId }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const poseSessionRef = useRef(null);
  const armTrackerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const impactDetectorRef = useRef(null);
  const audioBufRef = useRef(null);
  const rafRef = useRef(null);
  const phaseRef = useRef("setup");
  const phaseEndRef = useRef(0);
  const lastCountdownRef = useRef(-1);
  const hitCountRef = useRef(0);
  const sessionSamplesRef = useRef([]);

  // setup | prep | round | roundEnd | sessionEnd
  const [phase, setPhase] = useState("setup");
  const [roundCount, setRoundCount] = useState(6);
  const [roundDuration, setRoundDuration] = useState(180);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundsHistory, setRoundsHistory] = useState([]);
  const [hitCount, setHitCount] = useState(0);
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
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
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
    impactDetectorRef.current = createImpactDetector();
    armTrackerRef.current = createArmTracker();
    hitCountRef.current = 0;
    setHitCount(0);
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
    setRoundsHistory((prev) => [...prev, { hits: hitCountRef.current, correctedTotal: null }]);
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
    setCompetes(true);
    sessionSamplesRef.current = [];
  };

  const finishTraining = () => {
    teardownCamera();
    phaseRef.current = "sessionEnd";
    setPhase("sessionEnd");
    if (userId && sessionSamplesRef.current.length > 0) {
      addPunchSamples(userId, sessionSamplesRef.current).catch(() => {
        // Best-effort background data collection — never worth surfacing an error for.
      });
    }
  };

  const handleSaveToJournal = async () => {
    if (!onSaveLiveSession || saveStatus !== "idle") return;
    setSaveStatus("saving");
    const totalSeconds = roundsHistory.length * roundDuration;
    const minutes = Math.max(1, Math.round(totalSeconds / 60));
    const duration = lang === "en" ? `${minutes} min` : `${minutes} dk`;
    const blocks = roundsHistory.map((r, i) => {
      const total = r.correctedTotal ?? r.hits;
      const roundLabel = `${c("perRoundLabel", lang)} ${i + 1}`;
      return lang === "en" ? `${roundLabel}: ${total} hits` : `${roundLabel}: ${total} darbe`;
    });
    try {
      await onSaveLiveSession({ note, blocks, duration, threeMinRounds: 0, competes, type: "Kum Torbası" });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
    }
  };

  const startTraining = async () => {
    setError("");
    setRoundsHistory([]);
    sessionSamplesRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
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

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      // Deliberately not connected to audioCtx.destination — we only read
      // from it, never play the mic back out (that would be feedback).
      source.connect(analyser);
      analyserRef.current = analyser;
      audioBufRef.current = new Uint8Array(analyser.frequencyBinCount);

      poseSessionRef.current = await createPoseSession();
      beginPrep();

      const ctx = canvas.getContext("2d");
      const loop = () => {
        if (!streamRef.current) return;
        // Draw the true (unmirrored) frame first and detect pose on THAT —
        // MediaPipe's left/right landmark labeling is trained on normal
        // camera orientation, so detecting on an already-mirrored image
        // risks scrambling exactly the left/right distinction the arm
        // tracker depends on. Only after detection do we redraw the frame
        // mirrored for display (like a mirror/selfie view, so moving your
        // right hand visibly moves right on screen) — cheap to draw twice,
        // and keeps detection correctness completely separate from display.
        ctx.drawImage(video, 0, 0, width, height);
        const people = poseSessionRef.current ? poseSessionRef.current.detectAll(canvas) : [];

        ctx.save();
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, width, height);
        drawSkeletons(canvas, people);
        ctx.restore();

        const now = performance.now();
        const currentPhase = phaseRef.current;
        const timedPhase = currentPhase === "prep" || currentPhase === "round";

        if (armTrackerRef.current) armTrackerRef.current.update(people[0] || null, now);

        if (timedPhase) {
          const remainingMs = phaseEndRef.current - now;
          if (remainingMs > 0) {
            const remainingSec = Math.ceil(remainingMs / 1000);
            if (remainingSec !== lastCountdownRef.current) {
              lastCountdownRef.current = remainingSec;
              setCountdown(remainingSec);
            }
            if (currentPhase === "round" && analyserRef.current) {
              analyserRef.current.getByteTimeDomainData(audioBufRef.current);
              const rms = rmsOf(audioBufRef.current);
              const isHit = impactDetectorRef.current.update(rms, now);
              if (isHit) {
                hitCountRef.current += 1;
                setHitCount(hitCountRef.current);
                const snap = armTrackerRef.current?.snapshotAtImpact();
                if (snap) sessionSamplesRef.current.push({ ...snap, source: "bag" });
              }
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
  const totalHits = roundsHistory.reduce((sum, r) => sum + (r.correctedTotal ?? r.hits), 0);

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
          <div className="absolute top-2 left-2 bg-neutral-950/70 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
            <span className="text-neutral-100 text-xs font-medium tabular-nums">
              {c("roundLabel", lang)} {currentRound}/{roundCount} · {formatClock(countdown)}
            </span>
          </div>
        )}

        {phase === "round" && (
          <div className="absolute bottom-2 left-2 bg-neutral-950/70 rounded-lg px-2 py-1 flex items-center gap-1">
            <Volume2 size={11} className="text-emerald-500" />
            <span className="text-neutral-300 text-[10px]">{c("listeningLabel", lang)}</span>
          </div>
        )}

        {phase === "prep" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral-950/60">
            <span className="text-neutral-100 text-4xl font-medium tabular-nums">{countdown}</span>
            <span className="text-neutral-400 text-xs text-center px-6">{c("prepLabel", lang)}</span>
          </div>
        )}
      </div>

      {phase === "round" && (
        <div className="flex flex-col gap-2.5 mb-3">
          <HitsCard hits={hitCount} lang={lang} />
        </div>
      )}

      {phase === "roundEnd" && lastRound && (
        <div className="flex flex-col gap-3 mb-3">
          <p className="text-neutral-300 text-sm font-medium">
            {c("roundSummaryTitle", lang)} · {c("perRoundLabel", lang)} {currentRound}
          </p>
          <HitsCard hits={lastRound.hits} lang={lang} />
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
          <HitsCard hits={totalHits} lang={lang} />

          <div className="flex flex-col gap-1.5">
            {roundsHistory.map((r, i) => (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 flex items-center justify-between">
                <span className="text-neutral-400 text-xs">
                  {c("perRoundLabel", lang)} {i + 1}
                </span>
                <span className="text-neutral-300 text-xs">
                  {r.correctedTotal ?? r.hits} {lang === "en" ? "hits" : "darbe"}
                  {r.correctedTotal != null ? ` (${c("correctedLabel", lang).toLowerCase()})` : ""}
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
