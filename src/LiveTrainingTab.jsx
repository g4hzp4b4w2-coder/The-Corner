import { useEffect, useRef, useState } from "react";
import { Video as VideoIcon } from "lucide-react";
import { createPoseSession, drawSkeletons } from "./lib/poseAnalysis";

const COPY = {
  subtitle: {
    tr: "Kamerayı aç, canlı iskelet takibini gör. Bu ilk adım — yumruk sayma ve puanlama sıradaki adımlarda gelecek.",
    en: "Turn on the camera and see your skeleton tracked live. This is the first step — punch counting and scoring are coming in later steps.",
  },
  start: { tr: "Kamerayı başlat", en: "Start camera" },
  stop: { tr: "Durdur", en: "Stop" },
  permissionDenied: {
    tr: "Kamera izni verilmedi. Tarayıcı ayarlarından bu site için kameraya izin ver.",
    en: "Camera permission was denied. Allow camera access for this site in your browser settings.",
  },
  noCamera: { tr: "Kamera bulunamadı.", en: "No camera found." },
  genericError: { tr: "Kamera başlatılamadı, tekrar dene.", en: "Couldn't start the camera, try again." },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

export default function LiveTrainingTab({ lang }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const poseSessionRef = useRef(null);
  const rafRef = useRef(null);

  const [active, setActive] = useState(false);
  const [error, setError] = useState("");

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    poseSessionRef.current?.close();
    poseSessionRef.current = null;
    setActive(false);
  };

  useEffect(() => stop, []);

  const start = async () => {
    setError("");
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
      setActive(true);

      const ctx = canvas.getContext("2d");
      const loop = () => {
        if (!streamRef.current) return;
        ctx.drawImage(video, 0, 0, width, height);
        const people = poseSessionRef.current ? poseSessionRef.current.detectAll(canvas) : [];
        drawSkeletons(canvas, people);
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
      </div>

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
