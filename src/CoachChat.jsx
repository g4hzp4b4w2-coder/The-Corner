import { useState, useEffect, useRef } from "react";
import { Send, Video, X } from "lucide-react";
import { getChatMessages, addChatMessage } from "./lib/db";
import { getChatReply } from "./lib/coach";
import { extractFramesFromVideo } from "./lib/videoFrames";

const VIDEO_TYPES = ["Gölge Boksu", "Torba Çalışması", "Sparring", "Teknik Çalışma"];
const VIDEO_TYPE_LABELS = {
  "Gölge Boksu": { tr: "Gölge Boksu", en: "Shadowboxing" },
  "Torba Çalışması": { tr: "Torba Çalışması", en: "Bag Work" },
  Sparring: { tr: "Sparring", en: "Sparring" },
  "Teknik Çalışma": { tr: "Teknik Çalışma", en: "Technical Drill" },
};
function videoTypeLabel(type, lang) {
  return VIDEO_TYPE_LABELS[type]?.[lang] || VIDEO_TYPE_LABELS[type]?.tr || type;
}

const COPY = {
  title: { tr: "AI koç", en: "AI Coach" },
  subtitle: {
    tr: "Antrenmanların, hedeflerin ya da tereddüt ettiğin bir teknik hakkında koçunla konuş. Video de ekleyebilirsin.",
    en: "Talk to your coach about your training, goals, or a technique you're unsure about. You can attach a video too.",
  },
  placeholder: { tr: "Koça bir şey sor...", en: "Ask your coach something..." },
  emptyState: { tr: "Henüz mesaj yok. Koça ilk mesajını gönder.", en: "No messages yet. Send your coach a first message." },
  error: { tr: "Koça ulaşılamadı, tekrar dene.", en: "Couldn't reach the coach, try again." },
  attachVideo: { tr: "Video ekle", en: "Attach video" },
  videoReadError: { tr: "Bu video okunamadı, başka birini dene.", en: "Couldn't read this video, try a different one." },
  framesReady: { tr: "kare hazır, gönderebilirsin", en: "frames ready, you can send" },
  saveToJournal: { tr: "Günlüğe kaydet", en: "Save to journal" },
  savedToJournal: { tr: "Günlüğe kaydedildi", en: "Saved to journal" },
  saveToJournalError: { tr: "Kaydedilemedi, tekrar dene.", en: "Couldn't save, try again." },
  videoTypeQuestion: { tr: "Bu video ne çalışması?", en: "What kind of session is this?" },
  analyzeButton: { tr: "Analiz et", en: "Analyze" },
  progressMotion: { tr: "Hareket analiz ediliyor...", en: "Analyzing motion..." },
  progressFrames: { tr: "Kareler işleniyor...", en: "Processing frames..." },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

export default function CoachChat({ userId, profileInfo, entries, lang, onSaveVideoAnalysis }) {
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [pendingVideoFile, setPendingVideoFile] = useState(null);
  const [videoType, setVideoType] = useState(VIDEO_TYPES[0]);
  const [videoFrames, setVideoFrames] = useState([]);
  const [analyzedVideoType, setAnalyzedVideoType] = useState("");
  const [poseMetrics, setPoseMetrics] = useState("");
  const [extractionProgress, setExtractionProgress] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [videoReplyIds, setVideoReplyIds] = useState(() => new Set());
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [savingId, setSavingId] = useState(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getChatMessages(userId)
      .then((msgs) => {
        if (!cancelled) setMessages(msgs);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setVideoError("");
    setVideoFrames([]);
    setPoseMetrics("");
    setPendingVideoFile(file);
    setVideoType(VIDEO_TYPES[0]);
  };

  const cancelPendingVideo = () => {
    setPendingVideoFile(null);
    setExtractionProgress(null);
  };

  const startAnalysis = async () => {
    if (!pendingVideoFile) return;
    const file = pendingVideoFile;
    const type = videoType;
    setExtracting(true);
    setExtractionProgress({ phase: "probe", done: 0, total: 1 });
    try {
      const { frames, poseMetrics: metrics } = await extractFramesFromVideo(file, {
        lang,
        onProgress: (p) => {
          setExtractionProgress(p);
          if (p.phase === "final" && p.frame) {
            setVideoFrames((prev) => [...prev, p.frame]);
          }
        },
      });
      setPoseMetrics(metrics);
      setAnalyzedVideoType(type);
      // Guard against the progressive frames ending up out of sync with the
      // final result for any reason (e.g. a stale closure) — the returned
      // array is the source of truth.
      setVideoFrames(frames);
    } catch (err) {
      setVideoError(c("videoReadError", lang));
      setVideoFrames([]);
    } finally {
      setExtracting(false);
      setExtractionProgress(null);
      setPendingVideoFile(null);
    }
  };

  const send = async () => {
    const text = input.trim();
    const framesToSend = videoFrames;
    const metricsToSend = poseMetrics;
    const videoTypeToSend = analyzedVideoType;
    if (!text && framesToSend.length === 0) return;
    if (sending) return;

    setError("");
    setInput("");
    setVideoFrames([]);
    setPoseMetrics("");
    setAnalyzedVideoType("");
    setSending(true);

    const displayText =
      text ||
      (lang === "en"
        ? `[Sent ${framesToSend.length} video frame${framesToSend.length === 1 ? "" : "s"}]`
        : `[${framesToSend.length} video karesi gönderildi]`);

    try {
      const savedUserMsg = await addChatMessage(userId, "user", displayText);
      const history = [...messages, savedUserMsg];
      setMessages(history);

      const reply = await getChatReply({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        images: framesToSend,
        poseMetrics: metricsToSend,
        videoType: videoTypeToSend,
        caption: text,
        profile: profileInfo,
        entries,
        lang,
      });
      const savedAssistantMsg = await addChatMessage(userId, "assistant", reply.reply);
      setMessages((prev) => [...prev, savedAssistantMsg]);
      if (framesToSend.length > 0) {
        setVideoReplyIds((prev) => new Set(prev).add(savedAssistantMsg.id));
      }
    } catch (e) {
      setError(c("error", lang));
      setInput(text);
      setVideoFrames(framesToSend);
      setPoseMetrics(metricsToSend);
      setAnalyzedVideoType(videoTypeToSend);
    } finally {
      setSending(false);
    }
  };

  const saveToJournal = async (m) => {
    if (!onSaveVideoAnalysis || savingId) return;
    setSavingId(m.id);
    try {
      await onSaveVideoAnalysis(m.content);
      setSavedIds((prev) => new Set(prev).add(m.id));
    } catch (e) {
      setError(c("saveToJournalError", lang));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="px-5 pb-5 flex flex-col" style={{ minHeight: 480 }}>
      <p className="text-neutral-100 text-base font-medium mb-1">{c("title", lang)}</p>
      <p className="text-neutral-500 text-xs mb-3">{c("subtitle", lang)}</p>

      <div className="flex-1 flex flex-col gap-2.5 mb-3 overflow-y-auto" style={{ maxHeight: 380 }}>
        {loadingHistory ? (
          <p className="text-neutral-600 text-xs animate-pulse">···</p>
        ) : messages.length === 0 ? (
          <p className="text-neutral-600 text-xs">{c("emptyState", lang)}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[80%] text-xs leading-relaxed rounded-xl px-3 py-2 whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-red-600 text-neutral-950"
                    : "bg-neutral-900 border border-neutral-800 text-neutral-200"
                }`}
              >
                {m.content}
              </div>
              {videoReplyIds.has(m.id) &&
                (savedIds.has(m.id) ? (
                  <span className="text-emerald-500 text-[10px] mt-1">{c("savedToJournal", lang)}</span>
                ) : (
                  <button
                    onClick={() => saveToJournal(m)}
                    disabled={savingId === m.id}
                    className="text-red-500 text-[10px] mt-1 hover:text-red-400 disabled:opacity-50 transition-colors"
                  >
                    {savingId === m.id ? "…" : c("saveToJournal", lang)}
                  </button>
                ))}
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-neutral-900 border border-neutral-800 text-neutral-500 text-xs rounded-xl px-3 py-2 animate-pulse">
              ···
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      {videoError && <p className="text-red-400 text-xs mb-2">{videoError}</p>}

      {pendingVideoFile && !extracting && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-neutral-300 text-xs font-medium">{c("videoTypeQuestion", lang)}</span>
            <button onClick={cancelPendingVideo} aria-label="Cancel">
              <X size={14} className="text-neutral-600" />
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {VIDEO_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setVideoType(type)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  videoType === type ? "bg-red-950 border-red-900 text-red-400" : "bg-neutral-950 border-neutral-800 text-neutral-500"
                }`}
              >
                {videoTypeLabel(type, lang)}
              </button>
            ))}
          </div>
          <button
            onClick={startAnalysis}
            className="w-full bg-red-600 hover:bg-red-500 text-neutral-950 font-medium text-xs rounded-lg py-2 transition-colors"
          >
            {c("analyzeButton", lang)}
          </button>
        </div>
      )}

      {extracting && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-neutral-500 text-xs">
              {extractionProgress?.phase === "final" ? c("progressFrames", lang) : c("progressMotion", lang)}
              {extractionProgress ? ` ${extractionProgress.done}/${extractionProgress.total}` : ""}
            </span>
          </div>
          <div className="w-full bg-neutral-950 border border-neutral-800 rounded-full h-1.5 overflow-hidden mb-2">
            <div
              className="bg-red-600 h-full transition-all"
              style={{
                width: extractionProgress ? `${Math.min(100, (extractionProgress.done / extractionProgress.total) * 100)}%` : "0%",
              }}
            />
          </div>
          {videoFrames.length > 0 && (
            <div className="flex gap-1 overflow-x-auto">
              {videoFrames.map((f, i) => (
                <img
                  key={i}
                  src={`data:image/jpeg;base64,${f}`}
                  alt=""
                  className="w-10 h-10 object-cover rounded shrink-0 border border-neutral-800"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!extracting && videoFrames.length > 0 && (
        <div className="flex items-center gap-2 mb-2 bg-neutral-900 border border-neutral-800 rounded-lg p-2">
          <div className="flex gap-1 overflow-x-auto">
            {videoFrames.map((f, i) => (
              <img
                key={i}
                src={`data:image/jpeg;base64,${f}`}
                alt=""
                className="w-10 h-10 object-cover rounded shrink-0 border border-neutral-800"
              />
            ))}
          </div>
          <span className="text-neutral-500 text-[11px] whitespace-nowrap">
            {videoFrames.length} {c("framesReady", lang)}
          </span>
          <button
            onClick={() => {
              setVideoFrames([]);
              setPoseMetrics("");
              setAnalyzedVideoType("");
            }}
            aria-label="Clear video"
            className="ml-auto shrink-0"
          >
            <X size={14} className="text-neutral-600" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={extracting || sending || !!pendingVideoFile}
          aria-label={c("attachVideo", lang)}
          className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 disabled:opacity-50 text-neutral-400 rounded-lg p-2.5 transition-colors shrink-0"
        >
          <Video size={16} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={c("placeholder", lang)}
          className="flex-1 bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2"
        />
        <button
          onClick={send}
          disabled={sending || (!input.trim() && videoFrames.length === 0)}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-neutral-950 rounded-lg p-2.5 transition-colors shrink-0"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
