import { useState, useEffect, useRef } from "react";
import { Send, Video, X } from "lucide-react";
import { getChatMessages, addChatMessage } from "./lib/db";
import { getChatReply } from "./lib/coach";
import { extractFramesFromVideo } from "./lib/videoFrames";

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
  extracting: { tr: "Video işleniyor...", en: "Processing video..." },
  videoReadError: { tr: "Bu video okunamadı, başka birini dene.", en: "Couldn't read this video, try a different one." },
  framesReady: { tr: "kare hazır, gönderebilirsin", en: "frames ready, you can send" },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

export default function CoachChat({ userId, profileInfo, entries, lang }) {
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [videoFrames, setVideoFrames] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [videoError, setVideoError] = useState("");
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

  const handleVideoSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setVideoError("");
    setExtracting(true);
    try {
      const frames = await extractFramesFromVideo(file);
      setVideoFrames(frames);
    } catch (err) {
      setVideoError(c("videoReadError", lang));
    } finally {
      setExtracting(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    const framesToSend = videoFrames;
    if (!text && framesToSend.length === 0) return;
    if (sending) return;

    setError("");
    setInput("");
    setVideoFrames([]);
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
        caption: text,
        profile: profileInfo,
        entries,
        lang,
      });
      const savedAssistantMsg = await addChatMessage(userId, "assistant", reply.reply);
      setMessages((prev) => [...prev, savedAssistantMsg]);
    } catch (e) {
      setError(c("error", lang));
      setInput(text);
      setVideoFrames(framesToSend);
    } finally {
      setSending(false);
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
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] text-xs leading-relaxed rounded-xl px-3 py-2 whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-red-600 text-neutral-950"
                    : "bg-neutral-900 border border-neutral-800 text-neutral-200"
                }`}
              >
                {m.content}
              </div>
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
      {extracting && <p className="text-neutral-500 text-xs mb-2 animate-pulse">{c("extracting", lang)}</p>}

      {videoFrames.length > 0 && (
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
          <button onClick={() => setVideoFrames([])} aria-label="Clear video" className="ml-auto shrink-0">
            <X size={14} className="text-neutral-600" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={extracting || sending}
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
