import { useState, useRef } from "react";
import { Video, X, BookmarkPlus, MessageSquarePlus } from "lucide-react";
import { addChatMessage } from "./lib/db";
import { getChatReply } from "./lib/coach";
import { extractFramesFromVideo } from "./lib/videoFrames";
import { resolveSinglePersonSequence, linkPersonAcrossFrames, buildPoseTable, drawMotionTrail } from "./lib/poseAnalysis";
import FrameFlipbook from "./FrameFlipbook";

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

const PERSON_COLOR_HEX = ["#22d3ee", "#f59e0b"];
const PERSON_COLOR_NAME = {
  tr: ["Camgöbeği", "Turuncu"],
  en: ["Cyan", "Orange"],
};

const REPORT_HEADINGS = [
  "Duruş ve Guard",
  "Denge ve Vücut Açısı",
  "Öneriler ve Drilller",
  "Stance and Guard",
  "Balance and Body Angle",
  "Suggestions and Drills",
];

const COPY = {
  subtitle: {
    tr: "Bir antrenman videosu yükle, tipini seç, AI koç sana yapılandırılmış bir analiz raporu hazırlasın.",
    en: "Upload a training video, pick its type, and the AI coach will put together a structured analysis report.",
  },
  attachVideo: { tr: "Video yükle", en: "Upload video" },
  videoReadError: { tr: "Bu video okunamadı, başka birini dene.", en: "Couldn't read this video, try a different one." },
  analysisError: { tr: "Analiz alınamadı, tekrar dene.", en: "Couldn't get the analysis, try again." },
  videoTypeQuestion: { tr: "Bu video ne çalışması?", en: "What kind of session is this?" },
  analyzeButton: { tr: "Analiz et", en: "Analyze" },
  progressMotion: { tr: "Hareket analiz ediliyor...", en: "Analyzing motion..." },
  progressFrames: { tr: "Kareler işleniyor...", en: "Processing frames..." },
  analyzing: { tr: "AI koç raporu hazırlıyor...", en: "AI coach is preparing the report..." },
  newAnalysis: { tr: "Yeni analiz", en: "New analysis" },
  saveToJournal: { tr: "Günlüğe kaydet", en: "Save to journal" },
  savedToJournal: { tr: "Günlüğe kaydedildi", en: "Saved to journal" },
  saveError: { tr: "Kaydedilemedi, tekrar dene.", en: "Couldn't save, try again." },
  sendToChat: { tr: "Sohbete aktar", en: "Send to chat" },
  sentToChat: { tr: "Sohbete eklendi", en: "Added to chat" },
  sendError: { tr: "Gönderilemedi, tekrar dene.", en: "Couldn't send, try again." },
  emptyState: { tr: "Henüz analiz yok. Bir video yükleyerek başla.", en: "No analysis yet. Start by uploading a video." },
  motionTrailTitle: { tr: "Hareket akışı", en: "Motion flow" },
  motionTrailCaption: {
    tr: "Analiz için seçilen kareler sırayla, ileri-geri oynatılıyor.",
    en: "The frames picked for the analysis, playing back and forth in sequence.",
  },
  metricsTitle: { tr: "Takip verisi", en: "Tracking data" },
  showMetrics: { tr: "Ölçüm verisini göster", en: "Show tracking data" },
  hideMetrics: { tr: "Ölçüm verisini gizle", en: "Hide tracking data" },
  whoAreYouTitle: { tr: "Kadrajda iki kişi var — hangisi sensin?", en: "Two people are in frame — which one is you?" },
  whoAreYouSubtitle: {
    tr: "Analizi doğru kişiye göre yapabilmemiz için renk seç.",
    en: "Pick a color so the analysis focuses on the right person.",
  },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

function ReportText({ text }) {
  const lines = text.split("\n");
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const isHeading = REPORT_HEADINGS.some((h) => h.toLowerCase() === trimmed.toLowerCase());
        if (!trimmed) return null;
        if (isHeading) {
          return (
            <p key={i} className="text-red-500 text-xs font-medium mt-2 first:mt-0">
              {trimmed}
            </p>
          );
        }
        return (
          <p key={i} className="text-neutral-300 text-xs leading-relaxed">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export default function VideoAnalysisTab({ userId, profileInfo, entries, lang, onSaveVideoAnalysis, onSentToChat }) {
  const [pendingVideoFile, setPendingVideoFile] = useState(null);
  const [videoType, setVideoType] = useState(VIDEO_TYPES[0]);
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(null);
  const [videoFrames, setVideoFrames] = useState([]);
  const [videoError, setVideoError] = useState("");

  // Raw multi-person data held only while we wait for the user to pick who
  // they are in a two-person clip — cleared once identity is resolved.
  const [pendingPick, setPendingPick] = useState(null); // { framesPeople, frameTimestamps, pickFrameIdx, frames }

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [analyzedVideoType, setAnalyzedVideoType] = useState("");
  const [analysisMetrics, setAnalysisMetrics] = useState("");
  const [showMetrics, setShowMetrics] = useState(false);

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [sentToChat, setSentToChat] = useState(false);
  const [sendingToChat, setSendingToChat] = useState(false);
  const [sendError, setSendError] = useState("");

  const fileInputRef = useRef(null);

  const busy = extracting || analyzing;

  const reset = () => {
    setPendingVideoFile(null);
    setVideoFrames([]);
    setVideoError("");
    setPendingPick(null);
    setAnalysis(null);
    setAnalysisError("");
    setAnalyzedVideoType("");
    setAnalysisMetrics("");
    setShowMetrics(false);
    setSaved(false);
    setSaveError("");
    setSentToChat(false);
    setSendError("");
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    setPendingVideoFile(file);
    setVideoType(VIDEO_TYPES[0]);
  };

  const runAiAnalysis = async ({ frames, frameTimestamps, poseMetrics, motionTrailImage, type, youPersonIndex }) => {
    setAnalyzedVideoType(type);
    setAnalysisMetrics(poseMetrics || "");
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const images = motionTrailImage ? [...frames, motionTrailImage] : frames;
      const reply = await getChatReply({
        messages: [{ role: "user", content: lang === "en" ? "Analyze my video." : "Videomu analiz et." }],
        images,
        frameTimestamps,
        hasMotionTrail: !!motionTrailImage,
        poseMetrics,
        videoType: type,
        youPersonIndex,
        reportMode: true,
        profile: profileInfo,
        entries,
        lang,
      });
      setAnalysis(reply.reply);
    } catch (err) {
      setAnalysisError(c("analysisError", lang));
    } finally {
      setAnalyzing(false);
    }
  };

  const startAnalysis = async () => {
    if (!pendingVideoFile) return;
    const type = videoType;
    setExtracting(true);
    setExtractionProgress({ phase: "probe", done: 0, total: 1 });
    setVideoFrames([]);

    let frames, framesPeople, frameTimestamps, probeSamples, width, height;
    try {
      const result = await extractFramesFromVideo(pendingVideoFile, {
        onProgress: (p) => {
          setExtractionProgress(p);
          if (p.phase === "final" && p.frame) {
            setVideoFrames((prev) => [...prev, p.frame]);
          }
        },
      });
      frames = result.frames;
      framesPeople = result.framesPeople;
      frameTimestamps = result.frameTimestamps;
      probeSamples = result.probeSamples;
      width = result.width;
      height = result.height;
      setVideoFrames(frames);
    } catch (err) {
      setVideoError(c("videoReadError", lang));
      setExtracting(false);
      setExtractionProgress(null);
      setPendingVideoFile(null);
      return;
    }
    setExtracting(false);
    setExtractionProgress(null);
    setPendingVideoFile(null);

    const pickFrameIdx = framesPeople.findIndex((p) => p.length > 1);
    if (type === "Sparring" && pickFrameIdx !== -1) {
      setPendingPick({ framesPeople, frameTimestamps, pickFrameIdx, frames, width, height, type });
      return;
    }

    const landmarksSequence = resolveSinglePersonSequence(framesPeople);
    // The dense, whole-clip table comes from the probe-pass samples (many
    // more points across the full video than just the frames we send as
    // images); the motion-trail image is built from the frames actually
    // sent, since a trail with too many overlapping skeletons gets unreadable.
    const poseMetrics = buildPoseTable(probeSamples, lang);
    const motionTrailImage = drawMotionTrail(width, height, landmarksSequence.map((landmarks) => ({ landmarks })));
    await runAiAnalysis({ frames, frameTimestamps, poseMetrics, motionTrailImage, type, youPersonIndex: null });
  };

  const choosePerson = async (personIndex) => {
    const { framesPeople, frameTimestamps, pickFrameIdx, frames, width, height, type } = pendingPick;
    setPendingPick(null);
    const landmarksSequence = linkPersonAcrossFrames(framesPeople, personIndex, pickFrameIdx);
    const poseMetrics = buildPoseTable(
      landmarksSequence.map((landmarks, i) => ({ t: frameTimestamps[i], landmarks })),
      lang
    );
    const motionTrailImage = drawMotionTrail(width, height, landmarksSequence.map((landmarks) => ({ landmarks })));
    await runAiAnalysis({ frames, frameTimestamps, poseMetrics, motionTrailImage, type, youPersonIndex: personIndex });
  };

  const saveToJournal = async () => {
    if (!onSaveVideoAnalysis || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSaveVideoAnalysis(analysis, videoFrames);
      setSaved(true);
    } catch (e) {
      setSaveError(c("saveError", lang));
    } finally {
      setSaving(false);
    }
  };

  const sendToChat = async () => {
    if (sendingToChat) return;
    setSendingToChat(true);
    setSendError("");
    try {
      const caption =
        lang === "en"
          ? `[Video analysis — ${videoTypeLabel(analyzedVideoType, lang)}]`
          : `[Video analizi — ${videoTypeLabel(analyzedVideoType, lang)}]`;
      await addChatMessage(userId, "user", caption);
      await addChatMessage(userId, "assistant", analysis);
      setSentToChat(true);
      onSentToChat?.();
    } catch (e) {
      setSendError(c("sendError", lang));
    } finally {
      setSendingToChat(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 420 }}>
      <p className="text-neutral-500 text-xs mb-3">{c("subtitle", lang)}</p>

      <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />

      {videoError && <p className="text-red-400 text-xs mb-2">{videoError}</p>}

      {pendingVideoFile && !extracting && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-neutral-300 text-xs font-medium">{c("videoTypeQuestion", lang)}</span>
            <button onClick={() => setPendingVideoFile(null)} aria-label="Cancel">
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
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mb-3">
          <span className="text-neutral-500 text-xs">
            {extractionProgress?.phase === "final" ? c("progressFrames", lang) : c("progressMotion", lang)}
            {extractionProgress ? ` ${extractionProgress.done}/${extractionProgress.total}` : ""}
          </span>
          <div className="w-full bg-neutral-950 border border-neutral-800 rounded-full h-1.5 overflow-hidden my-2">
            <div
              className="bg-red-600 h-full transition-all"
              style={{
                width: extractionProgress ? `${Math.min(100, (extractionProgress.done / extractionProgress.total) * 100)}%` : "0%",
              }}
            />
          </div>
          {videoFrames.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto">
              {videoFrames.map((f, i) => (
                <img key={i} src={`data:image/jpeg;base64,${f}`} alt="" className="w-16 h-16 object-cover rounded shrink-0 border border-neutral-800" />
              ))}
            </div>
          )}
        </div>
      )}

      {pendingPick && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mb-3">
          <p className="text-neutral-200 text-sm font-medium mb-1">{c("whoAreYouTitle", lang)}</p>
          <p className="text-neutral-500 text-xs mb-3">{c("whoAreYouSubtitle", lang)}</p>
          <img
            src={`data:image/jpeg;base64,${pendingPick.frames[pendingPick.pickFrameIdx]}`}
            alt=""
            className="w-full rounded-lg border border-neutral-800 mb-3"
          />
          <div className="flex gap-2">
            {[0, 1].map((personIndex) => (
              <button
                key={personIndex}
                onClick={() => choosePerson(personIndex)}
                className="flex-1 flex items-center justify-center gap-2 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-200 text-xs rounded-lg py-2.5 transition-colors"
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PERSON_COLOR_HEX[personIndex] }} />
                {(PERSON_COLOR_NAME[lang] || PERSON_COLOR_NAME.tr)[personIndex]}
              </button>
            ))}
          </div>
        </div>
      )}

      {!extracting && !pendingVideoFile && !pendingPick && !analysis && videoFrames.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto mb-3">
          {videoFrames.map((f, i) => (
            <img key={i} src={`data:image/jpeg;base64,${f}`} alt="" className="w-20 h-20 object-cover rounded-lg shrink-0 border border-neutral-800" />
          ))}
        </div>
      )}

      {analyzing && <p className="text-neutral-500 text-xs animate-pulse mb-3">{c("analyzing", lang)}</p>}
      {analysisError && <p className="text-red-400 text-xs mb-3">{analysisError}</p>}

      {analysis && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-neutral-500 text-[11px]">{videoTypeLabel(analyzedVideoType, lang)}</span>
          </div>
          <ReportText text={analysis} />

          {videoFrames.length > 1 && (
            <div className="mt-3 pt-3 border-t border-neutral-800">
              <p className="text-neutral-400 text-[11px] font-medium mb-1.5">{c("motionTrailTitle", lang)}</p>
              <FrameFlipbook frames={videoFrames} />
              <p className="text-neutral-600 text-[10px] leading-relaxed mt-1.5">{c("motionTrailCaption", lang)}</p>
            </div>
          )}

          {analysisMetrics && (
            <div className="mt-3 pt-3 border-t border-neutral-800">
              <button
                onClick={() => setShowMetrics((v) => !v)}
                className="text-neutral-400 text-[11px] font-medium underline underline-offset-2"
              >
                {showMetrics ? c("hideMetrics", lang) : c("showMetrics", lang)}
              </button>
              {showMetrics && (
                <pre className="mt-2 text-neutral-500 text-[10px] leading-relaxed whitespace-pre-wrap break-words bg-neutral-950 border border-neutral-800 rounded-lg p-2 max-h-56 overflow-y-auto">
                  {analysisMetrics}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-800">
            <button
              onClick={saveToJournal}
              disabled={saved || saving}
              className="flex-1 flex items-center justify-center gap-1.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 disabled:opacity-50 text-neutral-300 text-xs rounded-lg py-2 transition-colors"
            >
              <BookmarkPlus size={13} />
              {saved ? c("savedToJournal", lang) : c("saveToJournal", lang)}
            </button>
            <button
              onClick={sendToChat}
              disabled={sentToChat || sendingToChat}
              className="flex-1 flex items-center justify-center gap-1.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 disabled:opacity-50 text-neutral-300 text-xs rounded-lg py-2 transition-colors"
            >
              <MessageSquarePlus size={13} />
              {sentToChat ? c("sentToChat", lang) : c("sendToChat", lang)}
            </button>
          </div>
          {saveError && <p className="text-red-400 text-[11px] mt-1.5">{saveError}</p>}
          {sendError && <p className="text-red-400 text-[11px] mt-1.5">{sendError}</p>}
        </div>
      )}

      {!pendingVideoFile && !extracting && !pendingPick && !analyzing && !analysis && (
        <p className="text-neutral-700 text-xs text-center py-6">{c("emptyState", lang)}</p>
      )}

      <div className="mt-auto">
        {analysis ? (
          <button
            onClick={reset}
            disabled={busy}
            className="w-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 text-sm rounded-lg py-2.5 transition-colors"
          >
            {c("newAnalysis", lang)}
          </button>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy || !!pendingVideoFile || !!pendingPick}
            className="w-full flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-neutral-950 font-medium text-sm rounded-lg py-2.5 transition-colors"
          >
            <Video size={16} />
            {c("attachVideo", lang)}
          </button>
        )}
      </div>
    </div>
  );
}
