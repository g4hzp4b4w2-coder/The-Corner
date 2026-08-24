import { useEffect, useRef, useState } from "react";
import { Video as VideoIcon } from "lucide-react";
import { createPoseSession, drawSkeletons } from "./lib/poseAnalysis";
import { createPunchDetector } from "./lib/liveDetection";

const STYLE_LABEL = {
  straight: { tr: "Düz", en: "Straight" },
  hook: { tr: "Hook", en: "Hook" },
  uppercut: { tr: "Uppercut", en: "Uppercut" },
};
const SIDE_LABEL = {
  left: { tr: "Sol kol", en: "Left arm" },
  right: { tr: "Sağ kol", en: "Right arm" },
};

const COPY = {
  subtitle: {
    tr: "Kamerayı aç, yumruklarını at — sayım ve tip tahmini basit hareket kurallarına dayanıyor, mükemmel olmayabilir.",
    en: "Turn on the camera and throw punches — counting and style guesses are based on simple motion rules, so they won't be perfect.",
  },
  start: { tr: "Kamerayı başlat", en: "Start camera" },
  stop: { tr: "Durdur", en: "Stop" },
  permissionDenied: {
    tr: "Kamera izni verilmedi. Tarayıcı ayarlarından bu site için kameraya izin ver.",
    en: "Camera permission was denied. Allow camera access for this site in your browser settings.",
  },
  noCamera: { tr: "Kamera bulunamadı.", en: "No camera found." },
  genericError: { tr: "Kamera başlatılamadı, tekrar dene.", en: "Couldn't start the camera, try again." },
  totalPunches: { tr: "Toplam yumruk", en: "Total punches" },
  guardWarning: { tr: "Guard açık!", en: "Guard's down!" },
  recentLabel: { tr: "Son hareketler", en: "Recent moves" },
  guardDropEvent: { tr: "guard düştü", en: "guard dropped" },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

const emptyStats = { left: 0, right: 0, straight: 0, hook: 0, uppercut: 0 };

export default function LiveTrainingTab({ lang }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const poseSessionRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const guardWarnTimeoutRef = useRef(null);

  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(emptyStats);
  const [events, setEvents] = useState([]);
  const [guardWarning, setGuardWarning] = useState(false);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (guardWarnTimeoutRef.current) clearTimeout(guardWarnTimeoutRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    poseSessionRef.current?.close();
    poseSessionRef.current = null;
    setActive(false);
    setGuardWarning(false);
  };

  useEffect(() => stop, []);

  const handleEvents = (newEvents) => {
    if (newEvents.length === 0) return;
    setStats((prev) => {
      const next = { ...prev };
      for (const ev of newEvents) {
        if (ev.type === "punch") {
          next[ev.side] += 1;
          next[ev.style] += 1;
        }
      }
      return next;
    });
    setEvents((prev) => [...newEvents, ...prev].slice(0, 6));
    if (newEvents.some((ev) => ev.type === "guardDrop")) {
      setGuardWarning(true);
      if (guardWarnTimeoutRef.current) clearTimeout(guardWarnTimeoutRef.current);
      guardWarnTimeoutRef.current = setTimeout(() => setGuardWarning(false), 1200);
    }
  };

  const start = async () => {
    setError("");
    setStats(emptyStats);
    setEvents([]);
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
      detectorRef.current = createPunchDetector();
      setActive(true);

      const ctx = canvas.getContext("2d");
      const loop = () => {
        if (!streamRef.current) return;
        ctx.drawImage(video, 0, 0, width, height);
        const people = poseSessionRef.current ? poseSessionRef.current.detectAll(canvas) : [];
        drawSkeletons(canvas, people);
        const newEvents = detectorRef.current.update(people[0] || null, performance.now());
        handleEvents(newEvents);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      stop();
      if (e.name === "NotAllowedError") setError(c("permissionDenied", lang));
      else if (e.name === "NotFoundError") setError(c("noCamera", lang));
      else setError(c("genericError", lang));
    }
  };

  const total = stats.left + stats.right;

  return (
    <div className="flex flex-col" style={{ minHeight: 420 }}>
      <p className="text-neutral-500 text-xs mb-3">{c("subtitle", lang)}</p>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      <div className="relative bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden mb-3" style={{ minHeight: 240 }}>
        <video ref={videoRef} playsInline muted className="hidden" />
        <canvas ref={canvasRef} className="w-full block" style={{ display: active ? "block" : "none" }} />
        {!active && (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <VideoIcon size={24} className="text-neutral-700" />
          </div>
        )}
        {guardWarning && (
          <div className="absolute inset-x-0 top-0 bg-red-600 text-neutral-950 text-xs font-medium text-center py-1.5">
            {c("guardWarning", lang)}
          </div>
        )}
      </div>

      {active && (
        <div className="flex flex-col gap-2.5 mb-3">
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

      <button
        onClick={active ? stop : start}
        className={`w-full flex items-center justify-center gap-1.5 font-medium text-sm rounded-lg py-2.5 transition-colors ${
          active ? "bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300" : "bg-red-600 hover:bg-red-500 text-neutral-950"
        }`}
      >
        {active ? c("stop", lang) : c("start", lang)}
      </button>
    </div>
  );
}
