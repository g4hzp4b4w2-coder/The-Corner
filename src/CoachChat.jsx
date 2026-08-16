import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { getChatMessages, addChatMessage } from "./lib/db";
import { getChatReply } from "./lib/coach";

const COPY = {
  title: { tr: "AI koç", en: "AI Coach" },
  subtitle: {
    tr: "Antrenmanların, hedeflerin ya da tereddüt ettiğin bir teknik hakkında koçunla konuş.",
    en: "Talk to your coach about your training, goals, or a technique you're unsure about.",
  },
  placeholder: { tr: "Koça bir şey sor...", en: "Ask your coach something..." },
  emptyState: { tr: "Henüz mesaj yok. Koça ilk mesajını gönder.", en: "No messages yet. Send your coach a first message." },
  error: { tr: "Koça ulaşılamadı, tekrar dene.", en: "Couldn't reach the coach, try again." },
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
  const bottomRef = useRef(null);

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

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError("");
    setInput("");
    setSending(true);

    try {
      const savedUserMsg = await addChatMessage(userId, "user", text);
      const history = [...messages, savedUserMsg];
      setMessages(history);

      const reply = await getChatReply({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        profile: profileInfo,
        entries,
        lang,
      });
      const savedAssistantMsg = await addChatMessage(userId, "assistant", reply.reply);
      setMessages((prev) => [...prev, savedAssistantMsg]);
    } catch (e) {
      setError(c("error", lang));
      setInput(text);
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

      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={c("placeholder", lang)}
          className="flex-1 bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-neutral-950 rounded-lg p-2.5 transition-colors"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
