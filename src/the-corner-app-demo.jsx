import { useState, useEffect } from "react";
import { Flame, CalendarDays, Users, User, Plus, Video, TrendingUp, Heart, MessageCircle, Bell, X, Award, Newspaper, Lock, Sparkles, CalendarRange, Circle, CircleCheck, BadgeCheck, Languages, LogOut, RefreshCw, Trash2, Send, ChevronDown } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { supabase, isSupabaseConfigured } from "./lib/supabaseClient";
import {
  getProfile,
  upsertProfile,
  deleteProfile,
  getJournalEntries,
  addJournalEntry,
  deleteJournalEntryByPlanKey,
  deleteJournalEntry,
  resetJournalEntries,
  getCommunityPosts,
  addCommunityPost,
  deleteCommunityPost,
  getPostComments,
  addPostComment,
  toggleLike as toggleLikeDb,
  getChatMessages,
  resetChatMessages,
} from "./lib/db";
import { getWeeklyPlan } from "./lib/coach";
import { getMatchNews } from "./lib/matchNews";
import AuthScreen, { ResetPasswordForm } from "./AuthScreen";
import CoachChat from "./CoachChat";
import VideoAnalysisTab from "./VideoAnalysisTab";
import LiveTrainingTab from "./LiveTrainingTab";
import FrameFlipbook from "./FrameFlipbook";

const CATEGORY_LIST = ["Güç", "Defans", "Teknik", "Fight IQ", "Hız"];
const POST_TOPICS = ["Genel", "Soru", "Başarı", "Teknik"];

const translations = {
  navJournal: { tr: "Günlük", en: "Journal" },
  navCoach: { tr: "AI koç", en: "AI Coach" },
  navCalendar: { tr: "Takvim", en: "Calendar" },
  navCommunity: { tr: "Topluluk", en: "Community" },
  navProfile: { tr: "Profil", en: "Profile" },
  journalTitle: { tr: "Antrenman günlüğü", en: "Training journal" },
  logSession: { tr: "Yeni seans kaydet", en: "Log new session" },
  streakLabel: { tr: "Seri", en: "Streak" },
  weekLabel: { tr: "Bu hafta", en: "This week" },
  weeklyPlanTitle: { tr: "Haftalık plan", en: "Weekly plan" },
  aiSuggestion: { tr: "AI önerisi", en: "AI suggestion" },
  ownPlan: { tr: "Kendi planım", en: "My own plan" },
  communityTitle: { tr: "Topluluk", en: "Community" },
  feedLabel: { tr: "Akış", en: "Feed" },
  matchNewsLabel: { tr: "Maç haberleri", en: "Match news" },
  chatSubTab: { tr: "Sohbet", en: "Chat" },
  videoAnalysisSubTab: { tr: "Video Analiz", en: "Video Analysis" },
  liveTrainingSubTab: { tr: "Canlı Antrenman", en: "Live Training" },
  profileTitle: { tr: "Profil", en: "Profile" },
  planGenerate: { tr: "Plan oluştur", en: "Generate plan" },
  editAnswersLabel: { tr: "Cevapları değiştir", en: "Edit answers" },
  shareLabel: { tr: "Paylaş", en: "Share" },
  sharedLabel: { tr: "Paylaşıldı ✓", en: "Shared ✓" },
  allTopicsLabel: { tr: "Tümü", en: "All" },
  sortNewLabel: { tr: "Yeni", en: "New" },
  sortPopularLabel: { tr: "Popüler", en: "Popular" },
  startLabel: { tr: "Başla", en: "Start" },
  resetLabel: { tr: "Verileri sıfırla", en: "Reset data" },
  signOutLabel: { tr: "Çıkış yap", en: "Sign out" },
  verifiedCoachLabel: { tr: "Doğrulanmış Koç", en: "Verified Coach" },

  // Weekly summary / coach tip / streak
  weeklySummaryLabel: { tr: "Haftalık özet", en: "Weekly summary" },
  weeklyArchiveLabel: { tr: "Haftalık arşiv", en: "Weekly archive" },
  weeklyArchiveEmpty: { tr: "Henüz geçmiş bir hafta yok.", en: "No past weeks yet." },
  weeklyArchiveHint: { tr: "Geçmiş haftaları Profil > Haftalık arşiv'de görebilirsin.", en: "You can see past weeks under Profile > Weekly archive." },
  sessionsUnitLabel: { tr: "seans", en: "sessions" },
  mostTrainedShortLabel: { tr: "En çok çalıştığın alan", en: "Most trained area" },
  trendChartTitle: { tr: "Son 8 hafta", en: "Last 8 weeks" },
  categoryChartTitle: { tr: "Son 4 hafta · kategori dağılımı", en: "Last 4 weeks · category breakdown" },
  chartEmptyState: { tr: "Henüz gösterecek veri yok, birkaç seans kaydet.", en: "Not enough data yet — log a few sessions." },
  videoAnalysisLabel: { tr: "Video analizi", en: "Video analysis" },
  sparringToggleLabel: { tr: "Bu bir sparring seansıydı", en: "This was a sparring session" },
  sparringRoundsLabel: { tr: "Round sayısı", en: "Round count" },
  sparringResultLabel: { tr: "Sonuç", en: "Result" },
  sparringResultPlaceholder: { tr: "Seç…", en: "Choose…" },
  sparringWon: { tr: "Kazandım", en: "Won" },
  sparringLost: { tr: "Kaybettim", en: "Lost" },
  sparringDraw: { tr: "Berabere", en: "Draw" },
  sparringOpponentLabel: { tr: "Rakip ağırlığı (opsiyonel)", en: "Opponent weight (optional)" },
  sparringOpponentPlaceholder: { tr: "örn. 75 kg", en: "e.g. 165 lbs" },
  pickCategoryError: { tr: "En az bir tür seç", en: "Pick at least one type" },
  referenceFighterLabel: { tr: "Referans dövüşçün", en: "Your reference fighter" },
  streakStripLabel: { tr: "Bu haftaki seriyin", en: "Your streak this week" },

  // New entry form
  newSessionTitle: { tr: "Yeni seans", en: "New session" },
  typeLabel: { tr: "Tür", en: "Type" },
  durationLabel: { tr: "Süre (dk)", en: "Duration (min)" },
  blocksLabel: { tr: "Detaylar", en: "Details" },
  blockPlaceholder: { tr: "örn. 3 raund shadowbox, 50 şınav", en: "e.g. 3 rounds shadowbox, 50 push-ups" },
  noteLabel: { tr: "Not", en: "Note" },
  notePlaceholder: { tr: "Bu seansta neye çalıştın?", en: "What did you work on this session?" },
  saveLabel: { tr: "Kaydet", en: "Save" },
  cancelLabel: { tr: "İptal", en: "Cancel" },
  editProfileLabel: { tr: "Profili düzenle", en: "Edit profile" },
  fillDurationNoteError: { tr: "Süre gir, ayrıca bir not ya da en az bir detay ekle", en: "Enter a duration, and either a note or at least one detail" },
  markedFromCalendar: { tr: "Takvimden işaretlendi", en: "Marked from calendar" },
  newBadge: { tr: "yeni", en: "new" },

  // Calendar
  aiModeDesc: { tr: "Fikrin yoksa birkaç soruya göre AI senin için bir plan çıkarır.", en: "If you're out of ideas, AI builds a plan for you from a few questions." },
  ownModeDesc: { tr: "Kendi planını gün ve saat olarak oluştur.", en: "Build your own plan by day and time." },
  questionnaireTitle: { tr: "Sana özel plan için birkaç soru", en: "A few questions for your personal plan" },
  goalQuestion: { tr: "Hedefin ne?", en: "What's your goal?" },
  goalDevelopment: { tr: "Gelişim", en: "Development" },
  goalFightPrep: { tr: "Maça hazırlık", en: "Fight prep" },
  daysQuestion: { tr: "Haftada kaç gün antrenman yapabilirsin?", en: "How many days a week can you train?" },
  levelQuestion: { tr: "Seviyen ne?", en: "What's your level?" },
  focusQuestion: { tr: "En çok neyi geliştirmek istiyorsun?", en: "What do you most want to improve?" },
  answerAllThree: { tr: "Tüm soruları cevapla ve en az bir antrenman saati ekle", en: "Answer all the questions and add at least one training time" },
  timeSlotsQuestion: { tr: "Hangi saatlerde, ne yoğunlukta antrenman yapabilirsin?", en: "What times can you train, and at what intensity?" },
  durationHintPlaceholder: { tr: "örn. 90 dk ya da 1.5 saat", en: "e.g. 90 min or 1.5 hours" },
  addTimeSlotLabel: { tr: "Saat ekle", en: "Add time" },
  noSlotsYet: { tr: "Henüz saat eklemedin", en: "No times added yet" },
  fillTimeDurationError: { tr: "Saat ve süre gir", en: "Enter a time and duration" },
  addToPlanLabel: { tr: "Plana ekle", en: "Add to plan" },
  sessionNamePlaceholder: { tr: "Antrenman adı, ör. Pad çalışması", en: "Session name, e.g. Pad work" },
  addLabel: { tr: "Ekle", en: "Add" },
  noPlanYet: { tr: "Henüz plan yok", en: "No plan yet" },
  fillTimeSessionError: { tr: "Saat ve antrenman adını gir", en: "Fill in the time and session name" },
  restDayNote: { tr: "Seçtiğin gün sayısına göre bu gün dinlenmeye ayrıldı.", en: "This day was set to rest based on the number of days you chose." },
  weeklyFocusSuffix: { tr: "Bu haftaki odağın:", en: "This week's focus:" },

  // Community
  composePlaceholder: { tr: "Topluluğa bir şey sor ya da paylaş...", en: "Ask or share something with the community..." },
  emptyPostError: { tr: "Önce bir şey yaz", en: "Write something first" },

  // Profile
  styleUnset: { tr: "Stil belirtilmedi", en: "Style not set" },
  strengthsLabel: { tr: "Güçlü yanların", en: "Your strengths" },
  weaknessesLabel: { tr: "Geliştirmen gerekenler", en: "Areas to improve" },
  skillDistributionLabel: { tr: "Yetenek dağılımı", en: "Skill distribution" },
  baselineNote: { tr: "İlk değerlendirmene dayanıyor", en: "Based on your initial self-assessment" },
  badgesLabel: { tr: "Rozetler", en: "Badges" },
  categoryLevelLabel: { tr: "Kategori bazlı seviye", en: "Level by category" },
  categoryLevelNote: {
    tr: "Şu an kendi değerlendirmen gösteriliyor. Antrenman kaydettikçe burada gerçek gelişim izlenmeye başlayacak.",
    en: "This currently shows your own self-assessment. As you log sessions, real progress tracking will start here.",
  },
  loadErrorNote: { tr: "Veriler yüklenirken bir sorun oldu.", en: "There was a problem loading your data." },
  retryLabel: { tr: "Tekrar dene", en: "Try again" },
  privacyNote: {
    tr: "Günlüğün sadece sana özel saklanır. Topluluk paylaşımları hesabı olan herkese açıktır.",
    en: "Your journal is stored privately, just for you. Community posts are visible to everyone with an account.",
  },
  focusPointLabel: { tr: "Odak noktası:", en: "Focus:" },

  // Onboarding
  onboardingTitle: { tr: "Seni tanıyalım", en: "Let's get to know you" },
  onboardingSubtitle: { tr: "Bu bilgiler AI koçun sana daha doğru geri bildirim verebilmesi için kullanılacak.", en: "This helps your AI coach give you more accurate feedback." },
  displayNameQuestion: { tr: "İsmin ne?", en: "What's your name?" },
  displayNamePlaceholder: { tr: "Adın Soyadın", en: "Your name" },
  yearsQuestion: { tr: "Kaç yıldır boks yapıyorsun?", en: "How many years have you been boxing?" },
  yearsUnder1: { tr: "1 yıldan az", en: "Less than 1 year" },
  years1to2: { tr: "1-2 yıl", en: "1-2 years" },
  years2to5: { tr: "2-5 yıl", en: "2-5 years" },
  years5plus: { tr: "5+ yıl", en: "5+ years" },
  styleQuestion: { tr: "Stilin ne?", en: "What's your style?" },
  styleOutfighter: { tr: "Out-fighter (mesafeci)", en: "Out-fighter" },
  styleInfighter: { tr: "In-fighter (yakın dövüşçü)", en: "In-fighter" },
  styleBrawler: { tr: "Brawler (serbest dövüşçü)", en: "Brawler" },
  stylePressure: { tr: "Pressure fighter (baskı kuran)", en: "Pressure fighter" },
  styleCounter: { tr: "Counter-puncher (karşı vurucu)", en: "Counter-puncher" },
  styleUndecided: { tr: "Henüz netleşmedi", en: "Not decided yet" },
  schoolQuestion: { tr: "Ekolün var mı? (opsiyonel)", en: "Do you follow a school? (optional)" },
  schoolOptional: { tr: "Seç (isteğe bağlı)", en: "Select (optional)" },
  schoolSoviet: { tr: "Sovyet ekolü", en: "Soviet school" },
  schoolCuban: { tr: "Küba ekolü", en: "Cuban school" },
  schoolAmerican: { tr: "Amerikan ekolü", en: "American school" },
  schoolMexican: { tr: "Meksika ekolü", en: "Mexican school" },
  schoolBritish: { tr: "Britanya ekolü", en: "British school" },
  schoolMixed: { tr: "Karma / henüz yok", en: "Mixed / none yet" },
  strengthsQuestion: { tr: "En güçlü olduğun alanlar", en: "Your strongest areas" },
  weaknessesQuestion: { tr: "Geliştirmek istediğin alanlar", en: "Areas you want to improve" },
  selfRateQuestion: { tr: "Kendini 0-100 arası değerlendir", en: "Rate yourself 0-100" },
  requiredFieldsError: { tr: "İsmini, deneyim süreni ve stilini gir", en: "Enter your name, experience, and style" },
  chooseOptionLabel: { tr: "Seç", en: "Select" },
  loadingLabel: { tr: "Yükleniyor…", en: "Loading…" },
  planJournalLinkNote: { tr: "İşaretlediğin antrenmanlar Günlük sekmesinde de görünür.", en: "Sessions you check off also appear in the Journal tab." },
};

function t(lang, key) {
  return translations[key] ? translations[key][lang] || translations[key].tr : key;
}

function timeAgo(timestamp, lang) {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffMin < 1) return lang === "en" ? "just now" : "şimdi";
  if (diffMin < 60) return lang === "en" ? `${diffMin}m ago` : `${diffMin} dk önce`;
  if (diffHour < 24) return lang === "en" ? `${diffHour}h ago` : `${diffHour}s önce`;
  return lang === "en" ? `${diffDay}d ago` : `${diffDay}g önce`;
}

function computeInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0].toUpperCase());
  return letters.join("") || "?";
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(ts) {
  const d = new Date(startOfDay(ts));
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // days back to Monday
  d.setDate(d.getDate() + diff);
  return d.getTime();
}

function computeStreaks(entries) {
  const daySet = new Set(entries.map((e) => startOfDay(e.createdAt)));
  const days = [...daySet].sort((a, b) => a - b);

  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev !== null && d - prev === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  const today = startOfDay(Date.now());
  let cursor = daySet.has(today) ? today : today - DAY_MS;
  let current = 0;
  while (daySet.has(cursor)) {
    current += 1;
    cursor -= DAY_MS;
  }

  return { current, longest };
}

function computeCategoryDistribution(entries, days = 28) {
  const cutoff = Date.now() - days * DAY_MS;
  const counts = {};
  CATEGORY_LIST.forEach((c) => (counts[c] = 0));
  let other = 0;
  entries.forEach((e) => {
    if (e.createdAt < cutoff) return;
    const cats = e.categories?.length ? e.categories : [e.type];
    cats.forEach((c) => {
      if (counts[c] !== undefined) counts[c] += 1;
      else other += 1;
    });
  });
  const result = CATEGORY_LIST.map((c) => ({ key: c, count: counts[c] }));
  if (other > 0) result.push({ key: "Diğer", count: other });
  return result;
}

const monthsTr = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatShortDate(ts, lang) {
  const d = new Date(ts);
  const months = lang === "en" ? monthsEn : monthsTr;
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function computeWeeklyTrend(entries, weeks, lang) {
  const thisWeekStart = startOfWeek(Date.now());
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = thisWeekStart - i * 7 * DAY_MS;
    const weekEnd = weekStart + 7 * DAY_MS;
    const count = entries.filter((e) => e.createdAt >= weekStart && e.createdAt < weekEnd).length;
    buckets.push({ label: formatShortDate(weekStart, lang), count });
  }
  return buckets;
}

const categoryTranslations = {
  Güç: { tr: "Güç", en: "Power" },
  Defans: { tr: "Defans", en: "Defense" },
  Teknik: { tr: "Teknik", en: "Technique" },
  "Fight IQ": { tr: "Fight IQ", en: "Fight IQ" },
  Hız: { tr: "Hız", en: "Speed" },
  "Ayak işi": { tr: "Ayak işi", en: "Footwork" },
  Diğer: { tr: "Diğer", en: "Other" },
};
function tc(cat, lang) {
  return categoryTranslations[cat] ? categoryTranslations[cat][lang] || cat : cat;
}

const postTopicTranslations = {
  Genel: { tr: "Genel", en: "General" },
  Soru: { tr: "Soru", en: "Question" },
  Başarı: { tr: "Başarı", en: "Achievement" },
  Teknik: { tr: "Teknik", en: "Technique" },
};
function tp(topic, lang) {
  return postTopicTranslations[topic] ? postTopicTranslations[topic][lang] || topic : topic;
}

function entryCategoryLabel(e, lang) {
  return (e.categories?.length ? e.categories : [e.type]).map((c) => tc(c, lang)).join(" + ");
}

function buildEntryShareText(e, lang) {
  const cats = entryCategoryLabel(e, lang);
  const detailParts = [];
  if (e.note) detailParts.push(e.note);
  if (e.blocks?.length) detailParts.push(e.blocks.join(" · "));
  const detail = detailParts.join(" — ");
  return lang === "en" ? `Logged a ${cats} session${detail ? `: ${detail}` : ""}` : `${cats} antrenmanı kaydettim${detail ? `: ${detail}` : ""}`;
}

const tagTranslations = {
  "sol el düşük": { tr: "sol el düşük", en: "low lead hand" },
  "bel dönüşü": { tr: "bel dönüşü", en: "hip rotation" },
  denge: { tr: "denge", en: "balance" },
};
function tt(text, lang) {
  return tagTranslations[text] ? tagTranslations[text][lang] || text : text;
}

const weekDaysTr = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const weekDaysEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function wd(lang) {
  return lang === "en" ? weekDaysEn : weekDaysTr;
}

const TAG_TONE = {
  warn: "bg-amber-950 text-amber-400 border border-amber-900",
  good: "bg-emerald-950 text-emerald-400 border border-emerald-900",
};

function CornerMark({ width = 30 }) {
  return <img src="/logo-mark.png" width={width} style={{ height: "auto", display: "block" }} alt="The Corner logosu" />;
}

function BoxingGloveLoader({ size = 40, label, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${compact ? "py-1" : "py-6"}`}>
      <img src="/logo-mark.png" width={size} className="logo-fade" style={{ height: "auto", display: "block" }} alt="Yükleniyor" />
      {label && <p className="text-neutral-600 text-xs">{label}</p>}
    </div>
  );
}

function AppShell({ lang, onToggleLang, footer, children }) {
  return (
    // Full-bleed on phone widths (installed PWA / real device) — no
    // border, no rounded corners, no centering gutter, so the app fills
    // the actual screen instead of floating as a bounded card. Only
    // widens into a centered "phone preview" frame at desktop widths
    // (sm: and up), since stretching the real layout edge-to-edge on a
    // 1920px monitor would just look broken.
    <div className="min-h-screen bg-neutral-950 sm:flex sm:items-center sm:justify-center sm:py-10">
      <div
        className="w-full h-dvh sm:h-[min(640px,92vh)] sm:max-w-sm bg-neutral-950 sm:border sm:border-neutral-800 sm:rounded-3xl overflow-hidden flex flex-col"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Header lang={lang} onToggleLang={onToggleLang} />
        <div className="flex-1 overflow-y-auto flex flex-col">{children}</div>
        {footer}
      </div>
    </div>
  );
}

function Header({ lang, onToggleLang }) {
  return (
    <div className="relative px-5 pt-6 pb-4 overflow-hidden">
      <div
        className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-red-600 blur-3xl"
        style={{ opacity: 0.18 }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-0 left-0 w-16 h-16"
        style={{
          background: "repeating-linear-gradient(135deg, #dc2626 0 2px, transparent 2px 9px)",
          opacity: 0.3,
          WebkitMaskImage: "linear-gradient(135deg, black, transparent 75%)",
          maskImage: "linear-gradient(135deg, black, transparent 75%)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CornerMark width={32} />
          <div>
            <p className="text-neutral-100 text-lg leading-none tracking-tight font-bold">THE CORNER</p>
            <p className="text-neutral-600 text-[10px] mt-0.5 tracking-widest uppercase">Fighter's Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {onToggleLang && (
            <button
              onClick={onToggleLang}
              className="flex items-center gap-1 text-neutral-500 hover:text-neutral-300 text-[11px] border border-neutral-800 rounded-md px-1.5 py-1 transition-colors"
            >
              <Languages size={12} />
              {lang === "tr" ? "EN" : "TR"}
            </button>
          )}
          <Bell size={18} className="text-neutral-500" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 flex-1">
      <p className="text-neutral-500 text-xs">{label}</p>
      <p className="text-neutral-100 text-xl mt-0.5 font-bold tracking-tight">{value}</p>
    </div>
  );
}

// Which category got trained the most, counted straight off the entries'
// own "categories" field — a plain tally, not an AI-generated insight.
function mostTrainedCategory(entries) {
  const counts = {};
  entries.forEach((e) =>
    (e.categories || []).forEach((cat) => {
      counts[cat] = (counts[cat] || 0) + 1;
    })
  );
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}

function WeeklySummary({ entries, lang }) {
  const topCategory = mostTrainedCategory(entries);
  const topCategoryLabel = topCategory ? tc(topCategory, lang) : null;
  return (
    <div className="bg-neutral-900 border border-red-900 p-3 mb-4" style={{ borderRadius: "6px 16px 6px 16px" }}>
      <div className="flex items-center gap-1.5 mb-1">
        <TrendingUp size={14} className="text-red-500" />
        <span className="text-red-500 text-xs font-bold">{t(lang, "weeklySummaryLabel")}</span>
      </div>
      <p className="text-neutral-300 text-xs leading-relaxed">
        {lang === "en"
          ? `You completed ${entries.length} sessions this week.${topCategoryLabel ? ` Most trained area: ${topCategoryLabel}.` : ""}`
          : `Bu hafta ${entries.length} seans tamamladın.${topCategoryLabel ? ` En çok çalıştığın alan: ${topCategoryLabel}.` : ""}`}
      </p>
      <p className="text-neutral-600 text-[11px] mt-1.5">{t(lang, "weeklyArchiveHint")}</p>
    </div>
  );
}

function computeWeeklyArchive(entries) {
  const byWeek = new Map();
  entries.forEach((e) => {
    const weekStart = startOfWeek(e.createdAt);
    if (!byWeek.has(weekStart)) byWeek.set(weekStart, []);
    byWeek.get(weekStart).push(e);
  });
  return [...byWeek.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([weekStart, weekEntries]) => ({ weekStart, entries: weekEntries }));
}

function WeeklyArchive({ entries, lang }) {
  const [openWeek, setOpenWeek] = useState(null);
  const currentWeekStart = startOfWeek(Date.now());
  const pastWeeks = computeWeeklyArchive(entries).filter((w) => w.weekStart < currentWeekStart);

  if (pastWeeks.length === 0) {
    return (
      <div className="mb-4">
        <p className="text-neutral-500 text-xs mb-2">{t(lang, "weeklyArchiveLabel")}</p>
        <p className="text-neutral-700 text-xs">{t(lang, "weeklyArchiveEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <p className="text-neutral-500 text-xs mb-2">{t(lang, "weeklyArchiveLabel")}</p>
      <div className="flex flex-col gap-2">
        {pastWeeks.map((w) => {
          const topCategory = mostTrainedCategory(w.entries);
          const topCategoryLabel = topCategory ? tc(topCategory, lang) : null;
          const weekEnd = w.weekStart + 6 * DAY_MS;
          const isOpen = openWeek === w.weekStart;
          const weekEntriesSorted = [...w.entries].sort((a, b) => b.createdAt - a.createdAt);
          return (
            <div key={w.weekStart} className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenWeek(isOpen ? null : w.weekStart)}
                className="w-full text-left p-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-neutral-300 text-xs font-medium">
                    {formatShortDate(w.weekStart, lang)} – {formatShortDate(weekEnd, lang)}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-neutral-500 text-[11px]">
                      {w.entries.length} {t(lang, "sessionsUnitLabel")}
                    </span>
                    <ChevronDown
                      size={13}
                      className="text-neutral-600 transition-transform"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                    />
                  </div>
                </div>
                {topCategoryLabel && (
                  <p className="text-neutral-500 text-[11px] mt-1">
                    {t(lang, "mostTrainedShortLabel")}: {topCategoryLabel}
                  </p>
                )}
              </button>

              {isOpen && (
                <div className="border-t border-neutral-800 flex flex-col gap-2 p-2.5">
                  {weekEntriesSorted.map((e) => (
                    <div key={e.id}>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-300 text-xs">
                          {e.label} · {entryCategoryLabel(e, lang)}
                        </span>
                        <span className="text-neutral-600 text-[11px]">{e.duration}</span>
                      </div>
                      {e.note && <p className="text-neutral-600 text-[11px] mt-0.5">{e.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendChart({ entries, lang }) {
  const data = computeWeeklyTrend(entries, 8, lang);
  const hasData = data.some((d) => d.count > 0);
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-4">
      <p className="text-neutral-100 text-xs font-medium mb-2">{t(lang, "trendChartTitle")}</p>
      {hasData ? (
        <div style={{ height: 140 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="#262626" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#737373", fontSize: 10 }} axisLine={{ stroke: "#262626" }} tickLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{ background: "#171717", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#e5e5e5" }}
                cursor={{ stroke: "#404040" }}
              />
              <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={{ r: 3, fill: "#dc2626" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-neutral-600 text-xs">{t(lang, "chartEmptyState")}</p>
      )}
    </div>
  );
}

function CategoryChart({ entries, lang }) {
  const data = computeCategoryDistribution(entries, 28).map((d) => ({ name: tc(d.key, lang), count: d.count }));
  const hasData = data.some((d) => d.count > 0);
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-4">
      <p className="text-neutral-100 text-xs font-medium mb-2">{t(lang, "categoryChartTitle")}</p>
      {hasData ? (
        <div style={{ height: 160 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={{ stroke: "#262626" }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{ background: "#171717", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#e5e5e5" }}
                cursor={{ fill: "#262626" }}
              />
              <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-neutral-600 text-xs">{t(lang, "chartEmptyState")}</p>
      )}
    </div>
  );
}

const styleProfiles = {
  "Out-fighter (mesafeci)": {
    reference: "Vasyl Lomachenko",
    focus: "Ayak işi ve mesafe kontrolü",
    drill: "Açı değiştirme + jab-çık kombinasyonları · 3x2 dk",
  },
  "In-fighter (yakın dövüşçü)": {
    reference: "Mike Tyson",
    focus: "Kafa hareketi ve yakın mesafe kombinasyonları",
    drill: "Slip-and-rip pad çalışması · 3x2 dk",
  },
  "Brawler (serbest dövüşçü)": {
    reference: "Arturo Gatti",
    focus: "Göğüs göğüse alışverişte kontrol ve dayanıklılık",
    drill: "Yüksek tempo pad + kondisyon · 4x2 dk",
  },
  "Pressure fighter (baskı kuran)": {
    reference: "Joe Frazier",
    focus: "Sürekli baskı ve vücut vuruşuyla ilerleme",
    drill: "İleri adım + vücut vuruşu kombinasyonları · 4x2 dk",
  },
  "Counter-puncher (karşı vurucu)": {
    reference: "Floyd Mayweather Jr.",
    focus: "Savunma sonrası anlık karşı vuruş",
    drill: "Slip-counter shadowbox, reaksiyon çalışması · 3x2 dk",
  },
};

const comboOverrides = {
  "Out-fighter (mesafeci)|Küba ekolü": {
    reference: "Guillermo Rigondeaux",
    focus: "Savunma temelli mesafe kontrolü ve blok sonrası çıkış",
    drill: "Pivot + blok-çıkış kombinasyonları · 3x2 dk",
  },
  "Out-fighter (mesafeci)|Amerikan ekolü": {
    reference: "Muhammad Ali",
    focus: "Ayak işi, mesafe ve hız",
    drill: "Yanal ayak işi + mesafe koruma drilleri · 3x2 dk",
    quote: "“Float like a butterfly, sting like a bee.”",
  },
  "Pressure fighter (baskı kuran)|Amerikan ekolü": {
    reference: "Joe Frazier",
    focus: "Sürekli baskı ve vücut vuruşuyla ilerleme",
    drill: "İleri adım + vücut vuruşu kombinasyonları · 4x2 dk",
  },
  "Counter-puncher (karşı vurucu)|Britanya ekolü": {
    reference: "Chris Eubank Sr.",
    focus: "Savunma pozisyonundan kontrollü karşı vuruş",
    drill: "Guard'dan çıkış + karşı düz vuruş drilleri · 3x2 dk",
  },
  "Out-fighter (mesafeci)|Britanya ekolü": {
    reference: "Lennox Lewis",
    focus: "Jab temelli mesafe kontrolü",
    drill: "Uzun jab + mesafe koruma drilleri · 3x2 dk",
  },
  "In-fighter (yakın dövüşçü)|Meksika ekolü": {
    reference: "Rubén Olivares",
    focus: "Yakın mesafede iki elle vücuda vuruş",
    drill: "Vücut-kafa hook kombinasyonları, yakın mesafe pad · 3x2 dk",
  },
  "In-fighter (yakın dövüşçü)|Amerikan ekolü": {
    reference: "Mike Tyson",
    focus: "Kafa hareketi ve yakın mesafe kombinasyonları",
    drill: "Slip-and-rip pad çalışması · 3x2 dk",
  },
  "Brawler (serbest dövüşçü)|Meksika ekolü": {
    reference: "Erik Morales",
    focus: "Yakın mesafede hacim ve tempo",
    drill: "Yüksek tempo kombinasyon + kondisyon · 4x2 dk",
  },
  "Pressure fighter (baskı kuran)|Sovyet ekolü": {
    reference: "Gennady Golovkin (GGG)",
    focus: "Ringi kesme ve sürekli baskı",
    drill: "Ring kesme (cutting the ring) ayak işi drilleri · 3x2 dk",
  },
  "Pressure fighter (baskı kuran)|Meksika ekolü": {
    reference: "Julio César Chávez",
    focus: "Vücut vuruşu ve baskı altında tempo",
    drill: "Vücut-kafa kombinasyon pad çalışması · 4x2 dk",
  },
  "Pressure fighter (baskı kuran)|Britanya ekolü": {
    reference: "Ricky Hatton",
    focus: "Vücuda baskı ve tempo yükseltme",
    drill: "Vücut vuruşu + tempo pad çalışması · 4x2 dk",
  },
  "Counter-puncher (karşı vurucu)|Sovyet ekolü": {
    reference: "Dmitry Bivol",
    focus: "Mesafe kontrolüyle karşı vuruş fırsatı yaratma",
    drill: "Mesafe koru + karşı düz vuruş drilleri · 3x2 dk",
    quote: "“You have to move forward, believe in yourself, train, focus.”",
  },
  "Counter-puncher (karşı vurucu)|Amerikan ekolü": {
    reference: "Floyd Mayweather Jr.",
    focus: "Savunma sonrası anlık karşı vuruş",
    drill: "Slip-counter shadowbox, reaksiyon çalışması · 3x2 dk",
    quote: "“A true champion will fight against everything.”",
  },
  "Counter-puncher (karşı vurucu)|Meksika ekolü": {
    reference: "Juan Manuel Márquez",
    focus: "Karşı vuruş zamanlaması ve teknik hassasiyet",
    drill: "Say-ve-karşı-vur shadowbox, zamanlama çalışması · 3x2 dk",
  },
  "Counter-puncher (karşı vurucu)|Küba ekolü": {
    reference: "Erislandy Lara",
    focus: "Ritim bazlı savunma ve karşı vuruş",
    drill: "Ritim + karşı vuruş shadowbox · 3x2 dk",
  },
};

function getFighterProfile(style, school) {
  const base = (style && styleProfiles[style]) || {
    drill: "Tempo çalışması · 3x3 dk shadowbox, kombinasyon hızına odaklan",
  };

  if (style && school) {
    const combo = comboOverrides[`${style}|${school}`];
    if (combo) return { ...combo, matched: true };
  }

  return { reference: null, focus: null, quote: null, drill: base.drill, matched: false };
}

function StreakStrip({ entries, longestStreak, lang }) {
  const daySet = new Set(entries.map((e) => startOfDay(e.createdAt)));
  const monday = startOfWeek(Date.now());
  const activeFlags = Array.from({ length: 7 }, (_, i) => daySet.has(monday + i * DAY_MS));

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-neutral-500 text-xs">{t(lang, "streakStripLabel")}</span>
        <span className="text-neutral-600 text-[11px]">
          {lang === "en" ? `Longest streak: ${longestStreak} days` : `En uzun serin: ${longestStreak} gün`}
        </span>
      </div>
      <div className="flex items-center justify-between">
        {wd(lang).map((d, i) => (
          <div key={d} className="flex flex-col items-center gap-1">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                activeFlags[i] ? "bg-red-600" : "bg-neutral-800"
              }`}
            >
              {activeFlags[i] && <Flame size={12} className="text-neutral-950" />}
            </div>
            <span className="text-[9px] text-neutral-600">{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachTab({ userId, profileInfo, entries, lang, onSaveVideoAnalysis }) {
  const [subTab, setSubTab] = useState("chat");

  return (
    <div className="px-5 pb-5 flex-1 flex flex-col min-h-0">
      <p className="text-neutral-100 text-base font-medium mb-3">{t(lang, "navCoach")}</p>

      <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 mb-3">
        <button
          onClick={() => setSubTab("chat")}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
            subTab === "chat" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
          }`}
        >
          {t(lang, "chatSubTab")}
        </button>
        <button
          onClick={() => setSubTab("video")}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
            subTab === "video" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
          }`}
        >
          {t(lang, "videoAnalysisSubTab")}
        </button>
        <button
          onClick={() => setSubTab("live")}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
            subTab === "live" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
          }`}
        >
          {t(lang, "liveTrainingSubTab")}
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {subTab === "chat" ? (
          <CoachChat userId={userId} profileInfo={profileInfo} entries={entries} lang={lang} />
        ) : subTab === "video" ? (
          <VideoAnalysisTab
            userId={userId}
            profileInfo={profileInfo}
            entries={entries}
            lang={lang}
            onSaveVideoAnalysis={onSaveVideoAnalysis}
            onSentToChat={() => setSubTab("chat")}
          />
        ) : (
          <LiveTrainingTab lang={lang} />
        )}
      </div>
    </div>
  );
}

function JournalTab({ entries, onAddClick, onShareEntry, onDeleteEntry, lang }) {
  const { current: streak, longest: longestStreak } = computeStreaks(entries);
  const weekEntries = entries.filter((e) => e.createdAt >= startOfWeek(Date.now()));
  const [sharedEntryIds, setSharedEntryIds] = useState(() => new Set());

  const shareEntry = (e) => {
    onShareEntry(e);
    setSharedEntryIds((prev) => new Set(prev).add(e.id));
  };

  return (
    <div className="px-5 pb-5">
      <p className="text-neutral-100 text-base font-medium mb-3">{t(lang, "journalTitle")}</p>

      <div className="flex gap-2 mb-4">
        <StatCard label={t(lang, "streakLabel")} value={`${streak} gün`} />
        <StatCard label={t(lang, "weekLabel")} value={`${weekEntries.length} seans`} />
      </div>

      <StreakStrip entries={entries} longestStreak={longestStreak} lang={lang} />

      <WeeklySummary entries={weekEntries} lang={lang} />
      <TrendChart entries={entries} lang={lang} />
      <CategoryChart entries={entries} lang={lang} />

      {entries.length > 0 && (
        <div className="flex flex-col gap-2.5 mb-4">
          {entries.map((e) => (
            <div
              key={e.id}
              className="relative bg-neutral-900 border border-neutral-800 p-3 overflow-hidden"
              style={{ borderRadius: "4px 16px 16px 16px" }}
            >
              <div
                className="absolute top-0 left-0 w-5 h-5 bg-red-600"
                style={{ borderRadius: "4px 0 16px 0", clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
                aria-hidden="true"
              />
              <div className="flex items-center justify-between mb-1.5 pl-2">
                <span className="text-neutral-100 text-sm font-semibold">
                  {e.label} · {entryCategoryLabel(e, lang)}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-neutral-500 text-xs">{e.duration}</span>
                  <button
                    onClick={() => onDeleteEntry(e.id)}
                    aria-label="Delete entry"
                    className="text-neutral-600 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {e.planKey && (
                <span className="inline-block text-[10px] text-red-500 mb-1.5">{t(lang, "markedFromCalendar")}</span>
              )}

              {e.hasVideo && (
                e.frames?.length > 1 ? (
                  <div className="mb-2">
                    <FrameFlipbook frames={e.frames} className="w-full rounded-lg border border-neutral-800 max-h-48 object-cover" />
                  </div>
                ) : (
                  <div className="relative bg-neutral-950 border border-neutral-800 rounded-lg h-20 flex items-center justify-center mb-2">
                    <Video size={20} className="text-neutral-600" />
                    <span className="absolute top-1.5 left-1.5 text-[10px] bg-red-950 text-red-400 border border-red-900 px-1.5 py-0.5 rounded">
                      {t(lang, "newBadge")}
                    </span>
                  </div>
                )
              )}

              {e.blocks?.length > 0 && (
                <div className="flex flex-col gap-1 mb-2">
                  {e.blocks.map((b, bi) => (
                    <div key={bi} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-neutral-600 shrink-0" />
                      <span className="text-neutral-300 text-xs">{b}</span>
                    </div>
                  ))}
                </div>
              )}

              {e.note && <p className="text-neutral-400 text-xs leading-relaxed mb-2">{e.note}</p>}

              {e.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {e.tags.map((tag, i) => (
                    <span key={i} className={`text-[11px] px-2 py-0.5 rounded ${TAG_TONE[tag.tone]}`}>
                      {tt(tag.text.replace(" ↑", ""), lang)}
                      {tag.text.includes("↑") ? " ↑" : ""}
                    </span>
                  ))}
                </div>
              )}

              {sharedEntryIds.has(e.id) ? (
                <span className="text-emerald-500 text-[10px]">{t(lang, "sharedLabel")}</span>
              ) : (
                <button onClick={() => shareEntry(e)} className="text-red-500 text-[10px] hover:text-red-400 transition-colors">
                  {t(lang, "shareLabel")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onAddClick}
        className="w-full bg-red-600 hover:bg-red-500 text-neutral-950 font-medium text-sm rounded-lg py-2.5 flex items-center justify-center gap-1.5 transition-colors"
      >
        <Plus size={16} />
        {t(lang, "logSession")}
      </button>
    </div>
  );
}

function NewEntryForm({ onSubmit, onCancel, lang }) {
  const [categories, setCategories] = useState([CATEGORY_LIST[0]]);
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [blockDraft, setBlockDraft] = useState("");
  const [isSparring, setIsSparring] = useState(false);
  const [rounds, setRounds] = useState("");
  const [result, setResult] = useState("");
  const [opponentWeight, setOpponentWeight] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const addBlock = () => {
    const text = blockDraft.trim();
    if (!text) return;
    setBlocks((prev) => [...prev, text]);
    setBlockDraft("");
  };

  const removeBlock = (i) => setBlocks((prev) => prev.filter((_, idx) => idx !== i));

  const toggleCategory = (c) => {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const submit = async () => {
    const sparringBlocks = [];
    if (isSparring) {
      if (rounds.trim()) sparringBlocks.push(`${t(lang, "sparringRoundsLabel")}: ${rounds.trim()} ${lang === "en" ? "rounds" : "raund"}`);
      if (result) sparringBlocks.push(`${t(lang, "sparringResultLabel")}: ${result}`);
      if (opponentWeight.trim()) sparringBlocks.push(`${t(lang, "sparringOpponentLabel")}: ${opponentWeight.trim()}`);
    }
    const finalBlocks = [...sparringBlocks, ...blocks];

    if (categories.length === 0) {
      setError(t(lang, "pickCategoryError"));
      return;
    }
    if (!duration.trim() || (!note.trim() && finalBlocks.length === 0)) {
      setError(t(lang, "fillDurationNoteError"));
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ type: categories[0], categories, duration: `${duration} dk`, note, blocks: finalBlocks });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 pb-5">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-neutral-100 text-sm font-medium">{t(lang, "newSessionTitle")}</span>
          <button onClick={onCancel} aria-label="Close">
            <X size={16} className="text-neutral-500" />
          </button>
        </div>

        <label className="text-neutral-500 text-xs block mb-1">{t(lang, "typeLabel")}</label>
        <div className="flex gap-1.5 flex-wrap mb-3">
          {CATEGORY_LIST.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                categories.includes(c) ? "bg-red-950 border-red-900 text-red-400" : "bg-neutral-950 border-neutral-800 text-neutral-500"
              }`}
            >
              {tc(c, lang)}
            </button>
          ))}
        </div>

        <label className="text-neutral-500 text-xs block mb-1">{t(lang, "durationLabel")}</label>
        <input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="30"
          className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-3"
        />

        <button
          type="button"
          onClick={() => setIsSparring((v) => !v)}
          className={`w-full flex items-center justify-between rounded-lg px-3 py-2 mb-3 border text-sm transition-colors ${
            isSparring ? "bg-red-950 border-red-900 text-red-400" : "bg-neutral-950 border-neutral-800 text-neutral-400"
          }`}
        >
          <span>{t(lang, "sparringToggleLabel")}</span>
          {isSparring && <CircleCheck size={16} />}
        </button>

        {isSparring && (
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 mb-3 flex flex-col gap-2.5">
            <div>
              <label className="text-neutral-500 text-xs block mb-1">{t(lang, "sparringRoundsLabel")}</label>
              <input
                value={rounds}
                onChange={(e) => setRounds(e.target.value)}
                placeholder="3"
                className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-neutral-500 text-xs block mb-1">{t(lang, "sparringResultLabel")}</label>
              <select
                value={result}
                onChange={(e) => setResult(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2"
              >
                <option value="">{t(lang, "sparringResultPlaceholder")}</option>
                <option value={t(lang, "sparringWon")}>{t(lang, "sparringWon")}</option>
                <option value={t(lang, "sparringLost")}>{t(lang, "sparringLost")}</option>
                <option value={t(lang, "sparringDraw")}>{t(lang, "sparringDraw")}</option>
              </select>
            </div>
            <div>
              <label className="text-neutral-500 text-xs block mb-1">{t(lang, "sparringOpponentLabel")}</label>
              <input
                value={opponentWeight}
                onChange={(e) => setOpponentWeight(e.target.value)}
                placeholder={t(lang, "sparringOpponentPlaceholder")}
                className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2"
              />
            </div>
          </div>
        )}

        <label className="text-neutral-500 text-xs block mb-1">{t(lang, "blocksLabel")}</label>
        {blocks.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-2">
            {blocks.map((b, i) => (
              <div key={i} className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-neutral-300 text-xs">{b}</span>
                <button onClick={() => removeBlock(i)} aria-label="Remove">
                  <X size={14} className="text-neutral-600" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 mb-3">
          <input
            value={blockDraft}
            onChange={(e) => setBlockDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addBlock();
              }
            }}
            placeholder={t(lang, "blockPlaceholder")}
            className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2"
          />
          <button
            onClick={addBlock}
            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded-lg px-3 transition-colors shrink-0"
          >
            {t(lang, "addLabel")}
          </button>
        </div>

        <label className="text-neutral-500 text-xs block mb-1">{t(lang, "noteLabel")}</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t(lang, "notePlaceholder")}
          rows={2}
          className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-1 resize-none"
        />
        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

        <button
          onClick={submit}
          disabled={saving}
          className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-neutral-950 font-medium text-sm rounded-lg py-2 mt-2 transition-colors"
        >
          {saving ? t(lang, "loadingLabel") : t(lang, "saveLabel")}
        </button>
      </div>
    </div>
  );
}

function ComposeBox({ onSubmit, lang }) {
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("Genel");
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    if (!text.trim()) {
      setError(t(lang, "emptyPostError"));
      return;
    }
    setPosting(true);
    try {
      await onSubmit({ text, topic });
      setText("");
      setTopic("Genel");
      setError("");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t(lang, "composePlaceholder")}
        rows={2}
        className="w-full bg-transparent text-neutral-200 text-sm placeholder-neutral-600 resize-none outline-none mb-2"
      />
      <div className="flex gap-1.5 flex-wrap mb-2">
        {POST_TOPICS.map((topicOption) => (
          <button
            key={topicOption}
            type="button"
            onClick={() => setTopic(topicOption)}
            className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
              topic === topicOption ? "bg-red-950 border-red-900 text-red-400" : "bg-neutral-950 border-neutral-800 text-neutral-500"
            }`}
          >
            {tp(topicOption, lang)}
          </button>
        ))}
      </div>
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={posting}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-60 text-neutral-950 font-medium text-xs rounded-lg px-3 py-1.5 transition-colors"
        >
          {posting ? t(lang, "loadingLabel") : t(lang, "shareLabel")}
        </button>
      </div>
    </div>
  );
}

function MatchNewsList({ lang }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = (force) => {
    setError("");
    if (force) setRefreshing(true);
    else setItems(null);
    getMatchNews(lang, { force })
      .then((res) => setItems(res.items || []))
      .catch(() => setError(lang === "en" ? "Couldn't load news right now." : "Haberler şu an yüklenemedi."))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => load(true)}
          disabled={refreshing || items === null}
          className="flex items-center gap-1 text-neutral-500 hover:text-neutral-300 disabled:opacity-50 text-[11px] transition-colors"
        >
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          {lang === "en" ? "Refresh" : "Yenile"}
        </button>
      </div>

      {error ? (
        <p className="text-neutral-600 text-xs text-center py-6">{error}</p>
      ) : items === null ? (
        <p className="text-neutral-600 text-xs text-center py-6 animate-pulse">···</p>
      ) : items.length === 0 ? (
        <p className="text-neutral-700 text-xs text-center py-6">
          {lang === "en" ? "No upcoming events found right now." : "Şu an yaklaşan bir etkinlik bulunamadı."}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((m, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
              <div className="flex items-start justify-between mb-1">
                <span className="text-neutral-100 text-sm font-medium">{m.fighters}</span>
                <span className="text-[11px] bg-amber-950 text-amber-400 border border-amber-900 px-2 py-0.5 rounded">
                  {m.weight}
                </span>
              </div>
              <p className="text-neutral-500 text-xs">
                {m.date} · {m.venue}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentThread({ postId, currentUserId, displayName, onCountChange, lang }) {
  const [comments, setComments] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getPostComments(postId)
      .then((res) => {
        if (!cancelled) {
          setComments(res);
          onCountChange(res.length);
        }
      })
      .catch(() => {
        if (!cancelled) setError(lang === "en" ? "Couldn't load comments." : "Yorumlar yüklenemedi.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const name = displayName || "—";
      const initials = computeInitials(name);
      const saved = await addPostComment(postId, currentUserId, { name, initials, text });
      setComments((prev) => {
        const next = [...(prev || []), saved];
        onCountChange(next.length);
        return next;
      });
      setDraft("");
    } catch (e) {
      setError(lang === "en" ? "Couldn't send comment, try again." : "Yorum gönderilemedi, tekrar dene.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-neutral-800 flex flex-col gap-2">
      {comments === null ? (
        <p className="text-neutral-600 text-[11px] animate-pulse">···</p>
      ) : comments.length === 0 ? (
        <p className="text-neutral-700 text-[11px]">{lang === "en" ? "No comments yet." : "Henüz yorum yok."}</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 text-[9px] font-medium shrink-0 mt-0.5">
              {c.initials}
            </div>
            <div>
              <span className="text-neutral-300 text-[11px] font-medium">{c.name}</span>{" "}
              <span className="text-neutral-400 text-[11px]">{c.text}</span>
            </div>
          </div>
        ))
      )}
      {error && <p className="text-red-400 text-[11px]">{error}</p>}
      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={lang === "en" ? "Write a comment..." : "Bir yorum yaz..."}
          className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded-lg px-2.5 py-1.5"
        />
        <button
          onClick={submit}
          disabled={sending || !draft.trim()}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-neutral-950 rounded-lg p-1.5 transition-colors shrink-0"
          aria-label="Send comment"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

function CommunityTab({ posts, onLike, onPost, onDeletePost, currentUserId, displayName, lang }) {
  const [view, setView] = useState("feed");
  const [expandedId, setExpandedId] = useState(null);
  const [liveCounts, setLiveCounts] = useState({});
  const [sortMode, setSortMode] = useState("new");
  const [topicFilter, setTopicFilter] = useState("all");

  const visiblePosts = posts
    .filter((p) => topicFilter === "all" || p.topic === topicFilter)
    .slice()
    .sort((a, b) => (sortMode === "popular" ? b.likes - a.likes || b.timestamp - a.timestamp : b.timestamp - a.timestamp));

  return (
    <div className="px-5 pb-5">
      <p className="text-neutral-100 text-base font-medium mb-3">{t(lang, "communityTitle")}</p>

      <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 mb-3">
        <button
          onClick={() => setView("feed")}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
            view === "feed" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
          }`}
        >
          {t(lang, "feedLabel")}
        </button>
        <button
          onClick={() => setView("news")}
          className={`flex-1 text-xs py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors ${
            view === "news" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
          }`}
        >
          <Newspaper size={12} />
          {t(lang, "matchNewsLabel")}
        </button>
      </div>

      {view === "news" ? (
        <MatchNewsList lang={lang} />
      ) : (
        <>
          <ComposeBox onSubmit={onPost} lang={lang} />

          {posts.length > 0 && (
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setTopicFilter("all")}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                    topicFilter === "all" ? "bg-red-950 border-red-900 text-red-400" : "bg-neutral-900 border-neutral-800 text-neutral-500"
                  }`}
                >
                  {t(lang, "allTopicsLabel")}
                </button>
                {POST_TOPICS.map((topicOption) => (
                  <button
                    key={topicOption}
                    onClick={() => setTopicFilter(topicOption)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                      topicFilter === topicOption ? "bg-red-950 border-red-900 text-red-400" : "bg-neutral-900 border-neutral-800 text-neutral-500"
                    }`}
                  >
                    {tp(topicOption, lang)}
                  </button>
                ))}
              </div>
              <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 shrink-0">
                <button
                  onClick={() => setSortMode("new")}
                  className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                    sortMode === "new" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
                  }`}
                >
                  {t(lang, "sortNewLabel")}
                </button>
                <button
                  onClick={() => setSortMode("popular")}
                  className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                    sortMode === "popular" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
                  }`}
                >
                  {t(lang, "sortPopularLabel")}
                </button>
              </div>
            </div>
          )}

          {posts.length === 0 ? (
            <p className="text-neutral-700 text-xs text-center py-6">
              {lang === "en" ? "No posts yet. Be the first to share something." : "Henüz gönderi yok. İlk paylaşımı sen yap."}
            </p>
          ) : visiblePosts.length === 0 ? (
            <p className="text-neutral-700 text-xs text-center py-6">
              {lang === "en" ? "No posts in this topic yet." : "Bu konuda henüz gönderi yok."}
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {visiblePosts.map((p) => (
                  <div key={p.id} className={`bg-neutral-900 rounded-xl p-3 ${p.verified ? "border border-red-900" : "border border-neutral-800"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                          p.verified ? "bg-red-600 text-neutral-950" : "bg-red-950 border border-red-900 text-red-500"
                        }`}
                      >
                        {p.initials}
                      </div>
                      <span className="text-neutral-100 text-sm font-medium">{p.name}</span>
                      {p.verified && (
                        <span className="flex items-center gap-0.5 text-red-500 text-[10px] bg-red-950 border border-red-900 px-1.5 py-0.5 rounded">
                          <BadgeCheck size={11} /> {t(lang, "verifiedCoachLabel")}
                        </span>
                      )}
                      <span className="text-neutral-600 text-xs">{timeAgo(p.timestamp, lang)}</span>
                      {p.topic && p.topic !== "Genel" && (
                        <span className="text-neutral-500 text-[10px] bg-neutral-950 border border-neutral-800 px-1.5 py-0.5 rounded">
                          {tp(p.topic, lang)}
                        </span>
                      )}
                      {p.userId === currentUserId && (
                        <button
                          onClick={() => onDeletePost(p.id)}
                          aria-label="Delete post"
                          className="ml-auto text-neutral-600 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {p.text && <p className="text-neutral-300 text-sm leading-relaxed mb-2">{p.text}</p>}

                    {p.stat && (
                      <div className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 mb-2 flex items-center gap-2">
                        <TrendingUp size={15} className="text-red-500" />
                        <span className="text-neutral-400 text-xs">{p.stat}</span>
                      </div>
                    )}

                    <div className="flex gap-4 text-xs text-neutral-500">
                      <button
                        onClick={() => onLike(p.id)}
                        className="flex items-center gap-1 hover:text-red-500 transition-colors"
                      >
                        <Heart size={14} className={p.liked ? "text-red-500" : ""} fill={p.liked ? "currentColor" : "none"} />
                        {p.likes}
                      </button>
                      <button
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        className="flex items-center gap-1 hover:text-neutral-300 transition-colors"
                      >
                        <MessageCircle size={14} />
                        {liveCounts[p.id] ?? p.comments}
                      </button>
                    </div>

                    {expandedId === p.id && (
                      <CommentThread
                        postId={p.id}
                        currentUserId={currentUserId}
                        displayName={displayName}
                        onCountChange={(n) => setLiveCounts((prev) => ({ ...prev, [p.id]: n }))}
                        lang={lang}
                      />
                    )}
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const badgeList = [
  {
    id: "streak",
    label: { tr: "9 gün seri", en: "9-day streak" },
    shareText: { tr: "🔥 9 günlük antrenman serimi tamamladım!", en: "🔥 Just hit a 9-day training streak!" },
    icon: Flame,
    check: (entries) => computeStreaks(entries).longest >= 9,
  },
  {
    id: "sparring",
    label: { tr: "İlk sparring notu", en: "First sparring note" },
    shareText: { tr: "🥊 İlk sparring kaydımı günlüğe işledim!", en: "🥊 Logged my first sparring session!" },
    icon: Award,
    check: (entries) =>
      entries.some((e) => {
        const haystack = [e.type, e.note, ...(e.blocks || [])].join(" ").toLowerCase();
        return haystack.includes("sparring");
      }),
  },
  {
    id: "analiz",
    label: { tr: "İlk AI analiz", en: "First AI analysis" },
    shareText: { tr: "🎥 AI koçuma ilk video analizimi yaptırdım!", en: "🎥 Got my first AI video analysis done!" },
    icon: Video,
    check: (entries) => entries.some((e) => e.hasVideo),
  },
];

function BadgeGrid({ entries, lang, onShare }) {
  const [sharedIds, setSharedIds] = useState(() => new Set());

  const share = (b) => {
    onShare(b);
    setSharedIds((prev) => new Set(prev).add(b.id));
  };

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {badgeList.map((b) => {
        const earned = b.check(entries);
        const Icon = earned ? b.icon : Lock;
        return (
          <div
            key={b.id}
            className={`rounded-lg px-3 py-2.5 flex flex-col gap-1 border ${
              earned ? "bg-red-950 border-red-900" : "bg-neutral-900 border-neutral-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon size={16} className={earned ? "text-red-500" : "text-neutral-600"} />
              <span className={`text-xs ${earned ? "text-red-400" : "text-neutral-600"}`}>{b.label[lang] || b.label.tr}</span>
            </div>
            {earned && onShare && (
              <button
                onClick={() => share(b)}
                disabled={sharedIds.has(b.id)}
                className="text-red-400 text-[10px] text-left hover:text-red-300 disabled:opacity-50 transition-colors"
              >
                {sharedIds.has(b.id) ? t(lang, "sharedLabel") : t(lang, "shareLabel")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkillBar({ skill, value }) {
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-neutral-300 text-xs">{skill}</span>
        <span className="text-neutral-400 text-xs">{value}</span>
      </div>
      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div className="h-full bg-red-600 rounded-full" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ProfileTab({ entries, profileInfo, onReset, onSignOut, onSaveProfile, onShareAchievement, loadError, lang }) {
  const [editing, setEditing] = useState(false);
  const skillData = CATEGORY_LIST.map((skill) => ({ skill, value: profileInfo.ratings[skill] ?? 50 }));
  const fighter = getFighterProfile(profileInfo.style, profileInfo.school);
  const initials = computeInitials(profileInfo.displayName);

  if (editing) {
    return (
      <OnboardingForm
        lang={lang}
        initialData={profileInfo}
        onCancel={() => setEditing(false)}
        onComplete={async (data) => {
          await onSaveProfile(data);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="px-5 pb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-neutral-100 text-base font-medium">{t(lang, "profileTitle")}</p>
        <button onClick={() => setEditing(true)} className="text-red-500 text-xs">
          {t(lang, "editProfileLabel")}
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-red-950 border border-red-900 flex items-center justify-center text-red-500 text-sm font-medium">
          {initials}
        </div>
        <div>
          <p className="text-neutral-100 text-sm font-medium">{profileInfo.displayName}</p>
          <p className="text-neutral-500 text-xs">
            {profileInfo.style || t(lang, "styleUnset")} · {profileInfo.years || "—"}
            {profileInfo.school && profileInfo.school !== "Karma / henüz yok" ? ` · ${profileInfo.school}` : ""}
          </p>
        </div>
      </div>

      {(profileInfo.strengths.length > 0 || profileInfo.weaknesses.length > 0) && (
        <div className="flex gap-2 mb-4">
          {profileInfo.strengths.length > 0 && (
            <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg p-2.5">
              <p className="text-neutral-500 text-[11px] mb-1">{t(lang, "strengthsLabel")}</p>
              <div className="flex gap-1 flex-wrap">
                {profileInfo.strengths.map((s) => (
                  <span key={s} className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-1.5 py-0.5 rounded">
                    {tc(s, lang)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {profileInfo.weaknesses.length > 0 && (
            <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg p-2.5">
              <p className="text-neutral-500 text-[11px] mb-1">{t(lang, "weaknessesLabel")}</p>
              <div className="flex gap-1 flex-wrap">
                {profileInfo.weaknesses.map((s) => (
                  <span key={s} className="text-[10px] bg-red-950 text-red-400 border border-red-900 px-1.5 py-0.5 rounded">
                    {tc(s, lang)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {fighter.reference && (
        <div className="bg-neutral-900 border border-red-900 rounded-xl p-3 mb-4">
          <p className="text-red-500 text-[11px] font-medium mb-1">{t(lang, "referenceFighterLabel")}</p>
          <p className="text-neutral-100 text-sm font-medium mb-0.5">{fighter.reference}</p>
          <p className="text-neutral-500 text-xs leading-relaxed">
            {t(lang, "focusPointLabel")} {fighter.focus}
          </p>
          {fighter.quote && (
            <p className="text-neutral-500 text-[11px] leading-relaxed mt-2 pt-2 border-t border-neutral-800 italic">
              {fighter.quote}
            </p>
          )}
        </div>
      )}

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-4">
        <p className="text-neutral-500 text-xs mb-2">{t(lang, "skillDistributionLabel")}</p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <RadarChart data={skillData.map((s) => ({ skill: tc(s.skill, lang), value: s.value }))} outerRadius="75%">
              <PolarGrid stroke="#404040" />
              <PolarAngleAxis dataKey="skill" tick={{ fill: "#a3a3a3", fontSize: 11 }} />
              <Radar dataKey="value" stroke="#dc2626" fill="#dc2626" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-neutral-600 text-[11px] mt-1">{t(lang, "baselineNote")}</p>
      </div>

      <p className="text-neutral-500 text-xs mb-2">{t(lang, "badgesLabel")}</p>
      <BadgeGrid entries={entries} lang={lang} onShare={onShareAchievement} />

      <WeeklyArchive entries={entries} lang={lang} />

      <p className="text-neutral-500 text-xs mb-1">{t(lang, "categoryLevelLabel")}</p>
      <p className="text-neutral-600 text-[11px] mb-2">{t(lang, "categoryLevelNote")}</p>
      {skillData.map((s) => (
        <SkillBar key={s.skill} skill={tc(s.skill, lang)} value={s.value} />
      ))}

      {loadError && <p className="text-red-400 text-[11px] mt-4">{t(lang, "loadErrorNote")}</p>}

      <div className="border-t border-neutral-800 mt-4 pt-4">
        <p className="text-neutral-600 text-[11px] mb-2">{t(lang, "privacyNote")}</p>
        <div className="flex items-center gap-4">
          <button onClick={onReset} className="text-neutral-500 text-xs hover:text-neutral-300 transition-colors">
            {t(lang, "resetLabel")}
          </button>
          <button onClick={onSignOut} className="flex items-center gap-1 text-neutral-500 text-xs hover:text-neutral-300 transition-colors">
            <LogOut size={12} />
            {t(lang, "signOutLabel")}
          </button>
        </div>
      </div>
    </div>
  );
}

const trainingPlans = {
  general: [
    {
      day: "Pzt",
      time: "18:00",
      title: "Teknik",
      duration: "40 dk",
      blocks: ["10 dk footwork", "3 raund gölge boksu", "Yavaş tempo bagwork combo çalışması"],
      note: "Tempo ve kombinasyon akıcılığına odaklan.",
    },
    { day: "Sal", time: "—", title: "Dinlenme", duration: "", blocks: [], note: "Kaslara toparlanma süresi tanı." },
    {
      day: "Çar",
      time: "19:00",
      title: "Pad çalışması",
      duration: "50 dk",
      blocks: ["10 dk ısınma + ip atlama", "4 raund pad kombinasyonları", "3 raund savunma-karşı vuruş çalışması"],
      note: "Vuruş gücü ve savunma dönüşü çalışılacak.",
    },
    {
      day: "Per",
      time: "18:30",
      title: "Teknik antrenman",
      duration: "45 dk",
      blocks: ["10 dk guard pozisyon tekrarları", "3 raund ayak işi drilleri", "2 raund yavaş tempo teknik tekrar"],
      note: "Guard ve ayak işi detaylarına eğil.",
    },
    { day: "Cum", time: "—", title: "Dinlenme", duration: "", blocks: [], note: "Hafif esneme dışında dinlenme günü." },
    {
      day: "Cmt",
      time: "10:00",
      title: "Sparring",
      duration: "60 dk",
      blocks: ["15 dk ısınma", "5 raund sparring", "10 dk soğuma + değerlendirme"],
      note: "Öğrendiklerini maç temposunda uygula.",
    },
    {
      day: "Paz",
      time: "—",
      title: "Aktif dinlenme",
      duration: "20 dk",
      blocks: ["20 dk hafif kardiyo veya yürüyüş"],
      note: "Toparlanmaya öncelik ver.",
    },
  ],
  fight: [
    {
      day: "Pzt",
      time: "07:00",
      title: "Kondisyon + teknik",
      duration: "70 dk",
      blocks: ["20 dk kondisyon koşusu", "3 raund gölge boksu", "3 raund teknik tekrar (akşam seansı)"],
      note: "Sabah kondisyon, akşam teknik tekrar.",
    },
    {
      day: "Sal",
      time: "18:00",
      title: "Pad çalışması",
      duration: "55 dk",
      blocks: ["10 dk ısınma", "5 raund maç senaryolu pad kombinasyonları", "2 raund patlayıcı vuruş çalışması"],
      note: "Maç senaryolarına özel kombinasyonlar.",
    },
    {
      day: "Çar",
      time: "10:00",
      title: "Sparring",
      duration: "60 dk",
      blocks: ["15 dk ısınma", "6 raund sparring", "10 dk soğuma"],
      note: "Rakibin stiline yakın bir partner seç.",
    },
    {
      day: "Per",
      time: "18:30",
      title: "Teknik antrenman",
      duration: "45 dk",
      blocks: ["10 dk zayıf nokta tekrarları", "3 raund yavaş tempo teknik", "2 raund hızlandırılmış tekrar"],
      note: "Zayıf noktaların üzerine tekrar git.",
    },
    {
      day: "Cum",
      time: "07:00",
      title: "Kondisyon",
      duration: "50 dk",
      blocks: ["30 dk yüksek tempo interval koşu", "10 dk core çalışması"],
      note: "Yüksek tempo, kısa toparlanma aralıkları.",
    },
    {
      day: "Cmt",
      time: "10:00",
      title: "Sparring",
      duration: "60 dk",
      blocks: ["15 dk ısınma", "6 raund sparring (maç temposu)", "10 dk soğuma + değerlendirme"],
      note: "Maç günü temposunu simüle et.",
    },
    {
      day: "Paz",
      time: "—",
      title: "Aktif dinlenme",
      duration: "20 dk",
      blocks: ["20 dk hafif kardiyo veya yürüyüş"],
      note: "Toparlanmaya öncelik ver.",
    },
  ],
};

function OwnPlanForm({ onAdd, lang }) {
  const [day, setDay] = useState("Pzt");
  const [time, setTime] = useState("");
  const [session, setSession] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!time || !session.trim()) {
      setError(t(lang, "fillTimeSessionError"));
      return;
    }
    onAdd(day, { time, session });
    setSession("");
    setError("");
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-4">
      <p className="text-neutral-200 text-xs font-medium mb-2">{t(lang, "addToPlanLabel")}</p>
      <div className="flex gap-2 mb-2">
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-2 py-2"
        >
          {weekDaysTr.map((d, i) => (
            <option key={d} value={d}>
              {wd(lang)[i]}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-28 bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-2 py-2"
        />
      </div>
      <input
        value={session}
        onChange={(e) => setSession(e.target.value)}
        placeholder={t(lang, "sessionNamePlaceholder")}
        className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-2"
      />
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <button
        onClick={submit}
        className="w-full bg-red-600 hover:bg-red-500 text-neutral-950 font-medium text-xs rounded-lg py-2 transition-colors"
      >
        {t(lang, "addLabel")}
      </button>
    </div>
  );
}

function OwnPlanView({ ownPlan, onAdd, onRemove, lang }) {
  return (
    <div>
      <OwnPlanForm onAdd={onAdd} lang={lang} />
      <div className="flex flex-col gap-3">
        {weekDaysTr.map((d, i) => (
          <div key={d}>
            <p className="text-neutral-500 text-xs mb-1.5">{wd(lang)[i]}</p>
            {(ownPlan[d] || []).length === 0 ? (
              <p className="text-neutral-700 text-xs">{t(lang, "noPlanYet")}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {ownPlan[d]
                  .slice()
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((s, i2) => (
                    <div
                      key={i2}
                      className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 text-xs font-medium">{s.time}</span>
                        <span className="text-neutral-300 text-xs">{s.session}</span>
                      </div>
                      <button onClick={() => onRemove(d, i2)} aria-label="Remove">
                        <X size={14} className="text-neutral-600" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildPlan(intensity, days, focus, lang) {
  const base = trainingPlans[intensity];
  let activeCount = 0;
  let focusApplied = false;
  return base.map((p) => {
    const isRest = p.title === "Dinlenme" || p.title === "Aktif dinlenme";
    if (isRest) return p;
    activeCount++;
    if (activeCount > days) {
      return {
        ...p,
        time: "—",
        title: "Dinlenme",
        duration: "",
        blocks: [],
        note: t(lang, "restDayNote"),
      };
    }
    if (!focusApplied) {
      focusApplied = true;
      return { ...p, note: `${p.note} ${t(lang, "weeklyFocusSuffix")} ${tc(focus, lang)}.` };
    }
    return p;
  });
}

const levelTranslations = {
  Başlangıç: { tr: "Başlangıç", en: "Beginner" },
  Orta: { tr: "Orta", en: "Intermediate" },
  İleri: { tr: "İleri", en: "Advanced" },
};
function tl(level, lang) {
  return levelTranslations[level] ? levelTranslations[level][lang] || level : level;
}

const intensityTranslations = {
  Hafif: { tr: "Hafif", en: "Light" },
  Orta: { tr: "Orta", en: "Medium" },
  Yoğun: { tr: "Yoğun", en: "Intense" },
};
function ti(intensity, lang) {
  return intensityTranslations[intensity] ? intensityTranslations[intensity][lang] || intensity : intensity;
}

function ChipGroup({ label, options, value, onChange, renderLabel }) {
  return (
    <div className="mb-3">
      <p className="text-neutral-500 text-xs mb-1.5">{label}</p>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              value === opt ? "bg-red-950 border-red-900 text-red-400" : "bg-neutral-900 border-neutral-800 text-neutral-500"
            }`}
          >
            {renderLabel ? renderLabel(opt) : opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function TimeSlotPicker({ slots, onAdd, onRemove, lang }) {
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [slotIntensity, setSlotIntensity] = useState("Orta");
  const [error, setError] = useState("");

  const submit = () => {
    if (!time || !duration.trim()) {
      setError(t(lang, "fillTimeDurationError"));
      return;
    }
    onAdd({ time, duration: duration.trim(), intensity: slotIntensity });
    setDuration("");
    setError("");
  };

  return (
    <div className="mb-3">
      <p className="text-neutral-500 text-xs mb-1.5">{t(lang, "timeSlotsQuestion")}</p>

      {slots.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2">
          {slots.map((s, i) => (
            <div key={i} className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-neutral-300 text-xs">
                {s.time} · {s.duration} · {ti(s.intensity, lang)}
              </span>
              <button onClick={() => onRemove(i)} aria-label="Remove">
                <X size={14} className="text-neutral-600" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-24 bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-2 py-2"
        />
        <input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder={t(lang, "durationHintPlaceholder")}
          className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2"
        />
      </div>
      <div className="flex gap-1.5 flex-wrap mb-2">
        {["Hafif", "Orta", "Yoğun"].map((opt) => (
          <button
            key={opt}
            onClick={() => setSlotIntensity(opt)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              slotIntensity === opt ? "bg-red-950 border-red-900 text-red-400" : "bg-neutral-900 border-neutral-800 text-neutral-500"
            }`}
          >
            {ti(opt, lang)}
          </button>
        ))}
      </div>
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <button
        onClick={submit}
        className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded-lg py-2 transition-colors"
      >
        {t(lang, "addTimeSlotLabel")}
      </button>
      {slots.length === 0 && <p className="text-neutral-700 text-[11px] mt-1.5">{t(lang, "noSlotsYet")}</p>}
    </div>
  );
}

function PlanQuestionnaire({ intensity, setIntensity, days, setDays, level, setLevel, focus, setFocus, timeSlots, onAddSlot, onRemoveSlot, onSubmit, error, lang }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-4">
      <p className="text-neutral-200 text-xs font-medium mb-3">{t(lang, "questionnaireTitle")}</p>
      <ChipGroup
        label={t(lang, "goalQuestion")}
        options={["Gelişim", "Maça hazırlık"]}
        value={intensity === "general" ? "Gelişim" : "Maça hazırlık"}
        onChange={(v) => setIntensity(v === "Gelişim" ? "general" : "fight")}
        renderLabel={(opt) => (opt === "Gelişim" ? t(lang, "goalDevelopment") : t(lang, "goalFightPrep"))}
      />
      <ChipGroup
        label={t(lang, "daysQuestion")}
        options={["3", "4", "5", "6"]}
        value={days ? String(days) : ""}
        onChange={(v) => setDays(Number(v))}
      />
      <ChipGroup label={t(lang, "levelQuestion")} options={["Başlangıç", "Orta", "İleri"]} value={level} onChange={setLevel} renderLabel={(opt) => tl(opt, lang)} />
      <ChipGroup
        label={t(lang, "focusQuestion")}
        options={["Güç", "Defans", "Teknik", "Ayak işi"]}
        value={focus}
        onChange={setFocus}
        renderLabel={(opt) => tc(opt, lang)}
      />
      <TimeSlotPicker slots={timeSlots} onAdd={onAddSlot} onRemove={onRemoveSlot} lang={lang} />
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <button
        onClick={onSubmit}
        className="w-full bg-red-600 hover:bg-red-500 text-neutral-950 font-medium text-sm rounded-lg py-2.5 transition-colors"
      >
        {t(lang, "planGenerate")}
      </button>
    </div>
  );
}

function CalendarTab({ onMarkDone, onUnmarkDone, lang, userId, profileInfo, entries }) {
  const [mode, setMode] = useState("ai");
  const [intensity, setIntensity] = useState("general");
  const [days, setDays] = useState(null);
  const [level, setLevel] = useState(null);
  const [focus, setFocus] = useState(null);
  const [planReady, setPlanReady] = useState(false);
  const [qError, setQError] = useState("");
  const [completed, setCompleted] = useState(Array(7).fill(false));
  const [ownPlan, setOwnPlan] = useState({});
  const [aiPlan, setAiPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(false);
  const [timeSlots, setTimeSlots] = useState([]);

  const plan = aiPlan || [];

  const addTimeSlot = (slot) => setTimeSlots((prev) => [...prev, slot]);
  const removeTimeSlot = (i) => setTimeSlots((prev) => prev.filter((_, idx) => idx !== i));

  const startPlan = async () => {
    if (!days || !level || !focus || timeSlots.length === 0) {
      setQError(t(lang, "answerAllThree"));
      return;
    }
    setQError("");
    setPlanReady(true);
    setCompleted(Array(7).fill(false));
    setPlanLoading(true);
    setPlanError(false);

    let recentChat = [];
    try {
      recentChat = await getChatMessages(userId);
    } catch (e) {
      // proceed without chat context
    }

    const categoryBalance = computeCategoryDistribution(entries, 28);

    try {
      const res = await getWeeklyPlan({
        profile: profileInfo,
        entries,
        recentChat: recentChat.slice(-8),
        intensity,
        days,
        level,
        focus,
        timeSlots,
        categoryBalance,
        lang,
      });
      setAiPlan(res.plan);
    } catch (e) {
      setAiPlan(buildPlan(intensity, days, focus, lang));
      setPlanError(true);
    } finally {
      setPlanLoading(false);
    }
  };

  const editAnswers = () => {
    setPlanReady(false);
    setAiPlan(null);
    setPlanError(false);
    setCompleted(Array(7).fill(false));
  };

  const toggleDay = (i) => {
    const p = plan[i];
    const wasCompleted = completed[i];
    const next = [...completed];
    next[i] = !wasCompleted;
    setCompleted(next);
    if (!wasCompleted) {
      onMarkDone(p);
    } else {
      onUnmarkDone(p);
    }
  };

  const addOwn = (day, entry) => {
    setOwnPlan({ ...ownPlan, [day]: [...(ownPlan[day] || []), entry] });
  };

  const removeOwn = (day, index) => {
    const next = ownPlan[day].filter((_, i) => i !== index);
    setOwnPlan({ ...ownPlan, [day]: next });
  };

  return (
    <div className="px-5 pb-5">
      <p className="text-neutral-100 text-base font-medium mb-1">{t(lang, "weeklyPlanTitle")}</p>
      <p className="text-neutral-500 text-xs mb-3">{mode === "ai" ? t(lang, "aiModeDesc") : t(lang, "ownModeDesc")}</p>

      <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 mb-4">
        <button
          onClick={() => setMode("ai")}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
            mode === "ai" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
          }`}
        >
          {t(lang, "aiSuggestion")}
        </button>
        <button
          onClick={() => setMode("own")}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
            mode === "own" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
          }`}
        >
          {t(lang, "ownPlan")}
        </button>
      </div>

      {mode === "ai" ? (
        !planReady ? (
          <PlanQuestionnaire
            intensity={intensity}
            setIntensity={setIntensity}
            days={days}
            setDays={setDays}
            level={level}
            setLevel={setLevel}
            focus={focus}
            setFocus={setFocus}
            timeSlots={timeSlots}
            onAddSlot={addTimeSlot}
            onRemoveSlot={removeTimeSlot}
            onSubmit={startPlan}
            error={qError}
            lang={lang}
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-neutral-500 text-xs">
                {lang === "en" ? `${days} days · ${tl(level, lang)} · focus: ${tc(focus, lang)}` : `${days} gün · ${tl(level, lang)} · odak: ${tc(focus, lang)}`}
              </span>
              <button onClick={editAnswers} className="text-red-500 text-xs">
                {t(lang, "editAnswersLabel")}
              </button>
            </div>

            {planError && (
              <p className="text-neutral-600 text-[11px] mb-2">
                {lang === "en" ? "Showing a general plan — AI plan unavailable right now." : "Genel bir plan gösteriliyor — AI planı şu an alınamadı."}
              </p>
            )}

            {planLoading ? (
              <BoxingGloveLoader size={34} label={t(lang, "loadingLabel")} />
            ) : (
            <div className="flex flex-col gap-2">
              {plan.map((p, i) => (
                <button
                  key={p.day}
                  onClick={() => toggleDay(i)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-left"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-500 text-xs w-8">{p.day}</span>
                      <span className="text-red-500 text-xs font-medium">{p.time}</span>
                      <span
                        className={`text-sm font-medium ${completed[i] ? "text-neutral-500 line-through" : "text-neutral-100"}`}
                      >
                        {p.title}
                      </span>
                    </div>
                    {completed[i] ? (
                      <CircleCheck size={18} className="text-red-500 shrink-0" />
                    ) : (
                      <Circle size={18} className="text-neutral-700 shrink-0" />
                    )}
                  </div>

                  {p.blocks.length > 0 && (
                    <div className="pl-10 flex flex-col gap-1 mb-1.5">
                      {p.blocks.map((b, bi) => (
                        <div key={bi} className="flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-neutral-600 shrink-0" />
                          <span className="text-neutral-300 text-xs">{b}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pl-10">
                    {p.duration && (
                      <span className="text-[11px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">{p.duration}</span>
                    )}
                    <p className="text-neutral-500 text-xs leading-relaxed">{p.note}</p>
                  </div>
                </button>
              ))}
            </div>
            )}
          </>
        )
      ) : (
        <OwnPlanView ownPlan={ownPlan} onAdd={addOwn} onRemove={removeOwn} lang={lang} />
      )}

      <p className="text-neutral-600 text-[11px] mt-3">{t(lang, "planJournalLinkNote")}</p>
    </div>
  );
}

function OnboardingForm({ onComplete, lang, initialData, onCancel }) {
  const [displayName, setDisplayName] = useState(initialData?.displayName || "");
  const [years, setYears] = useState(initialData?.years || "");
  const [style, setStyle] = useState(initialData?.style || "");
  const [school, setSchool] = useState(initialData?.school || "");
  const [strengths, setStrengths] = useState(initialData?.strengths || []);
  const [weaknesses, setWeaknesses] = useState(initialData?.weaknesses || []);
  const [ratings, setRatings] = useState(initialData?.ratings || { Güç: 50, Defans: 50, Teknik: 50, "Fight IQ": 50, Hız: 50 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleStrength = (cat) => {
    setStrengths((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };
  const toggleWeakness = (cat) => {
    setWeaknesses((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };
  const setRating = (cat, val) => setRatings({ ...ratings, [cat]: Number(val) });

  const submit = async () => {
    if (!displayName.trim() || !years || !style) {
      setError(t(lang, "requiredFieldsError"));
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onComplete({ displayName: displayName.trim(), years, style, school, strengths, weaknesses, ratings });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 py-6 overflow-y-auto" style={{ maxHeight: 640 }}>
      <p className="text-neutral-100 text-lg font-bold tracking-tight mb-1">{t(lang, "onboardingTitle")}</p>
      <p className="text-neutral-500 text-xs mb-4">{t(lang, "onboardingSubtitle")}</p>

      <label className="text-neutral-500 text-xs block mb-1">{t(lang, "displayNameQuestion")}</label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder={t(lang, "displayNamePlaceholder")}
        className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-3"
      />

      <label className="text-neutral-500 text-xs block mb-1">{t(lang, "yearsQuestion")}</label>
      <select
        value={years}
        onChange={(e) => setYears(e.target.value)}
        className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-3"
      >
        <option value="">{t(lang, "chooseOptionLabel")}</option>
        <option value="1 yıldan az">{t(lang, "yearsUnder1")}</option>
        <option value="1-2 yıl">{t(lang, "years1to2")}</option>
        <option value="2-5 yıl">{t(lang, "years2to5")}</option>
        <option value="5+ yıl">{t(lang, "years5plus")}</option>
      </select>

      <label className="text-neutral-500 text-xs block mb-1">{t(lang, "styleQuestion")}</label>
      <select
        value={style}
        onChange={(e) => setStyle(e.target.value)}
        className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-3"
      >
        <option value="">{t(lang, "chooseOptionLabel")}</option>
        <option value="Out-fighter (mesafeci)">{t(lang, "styleOutfighter")}</option>
        <option value="In-fighter (yakın dövüşçü)">{t(lang, "styleInfighter")}</option>
        <option value="Brawler (serbest dövüşçü)">{t(lang, "styleBrawler")}</option>
        <option value="Pressure fighter (baskı kuran)">{t(lang, "stylePressure")}</option>
        <option value="Counter-puncher (karşı vurucu)">{t(lang, "styleCounter")}</option>
        <option value="Henüz netleşmedi">{t(lang, "styleUndecided")}</option>
      </select>

      <label className="text-neutral-500 text-xs block mb-1">{t(lang, "schoolQuestion")}</label>
      <select
        value={school}
        onChange={(e) => setSchool(e.target.value)}
        className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-4"
      >
        <option value="">{t(lang, "schoolOptional")}</option>
        <option value="Sovyet ekolü">{t(lang, "schoolSoviet")}</option>
        <option value="Küba ekolü">{t(lang, "schoolCuban")}</option>
        <option value="Amerikan ekolü">{t(lang, "schoolAmerican")}</option>
        <option value="Meksika ekolü">{t(lang, "schoolMexican")}</option>
        <option value="Britanya ekolü">{t(lang, "schoolBritish")}</option>
        <option value="Karma / henüz yok">{t(lang, "schoolMixed")}</option>
      </select>

      <p className="text-neutral-500 text-xs mb-1.5">{t(lang, "strengthsQuestion")}</p>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {CATEGORY_LIST.map((c) => (
          <button
            key={c}
            onClick={() => toggleStrength(c)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              strengths.includes(c) ? "bg-emerald-950 border-emerald-900 text-emerald-400" : "bg-neutral-900 border-neutral-800 text-neutral-500"
            }`}
          >
            {tc(c, lang)}
          </button>
        ))}
      </div>

      <p className="text-neutral-500 text-xs mb-1.5">{t(lang, "weaknessesQuestion")}</p>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {CATEGORY_LIST.map((c) => (
          <button
            key={c}
            onClick={() => toggleWeakness(c)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              weaknesses.includes(c) ? "bg-red-950 border-red-900 text-red-400" : "bg-neutral-900 border-neutral-800 text-neutral-500"
            }`}
          >
            {tc(c, lang)}
          </button>
        ))}
      </div>

      <p className="text-neutral-500 text-xs mb-2">{t(lang, "selfRateQuestion")}</p>
      <div className="flex flex-col gap-3 mb-4">
        {CATEGORY_LIST.map((c) => (
          <div key={c}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-neutral-300 text-xs">{tc(c, lang)}</span>
              <span className="text-red-500 text-xs font-medium">{ratings[c]}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={ratings[c]}
              onChange={(e) => setRating(c, e.target.value)}
              className="w-full"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      <div className="flex gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-sm rounded-lg py-2.5 transition-colors"
          >
            {t(lang, "cancelLabel")}
          </button>
        )}
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-neutral-950 font-medium text-sm rounded-lg py-2.5 transition-colors"
        >
          {saving ? t(lang, "loadingLabel") : initialData ? t(lang, "saveLabel") : t(lang, "startLabel")}
        </button>
      </div>
    </div>
  );
}

function NavButton({ active, icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
      <Icon size={18} className={active ? "text-red-500" : "text-neutral-600"} />
      <span className={`text-[11px] ${active ? "text-red-500 font-medium" : "text-neutral-600"}`}>{label}</span>
    </button>
  );
}

export default function TheCornerApp() {
  const [tab, setTab] = useState("journal");
  const [session, setSession] = useState(undefined);
  const [profileInfo, setProfileInfo] = useState(null);
  const [entries, setEntries] = useState([]);
  const [posts, setPosts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [lang, setLang] = useState("tr");
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(newSession);
      if (!newSession) {
        setProfileInfo(null);
        setEntries([]);
        setPosts([]);
        setDataLoading(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setDataLoading(true);
    setLoadError(false);
    (async () => {
      try {
        const [profile, journalEntries, communityPosts] = await Promise.all([
          getProfile(session.user.id),
          getJournalEntries(session.user.id),
          getCommunityPosts(session.user.id),
        ]);
        if (cancelled) return;
        setProfileInfo(profile);
        setEntries(journalEntries);
        setPosts(communityPosts);
        if (profile?.lang) setLang(profile.lang);
      } catch (e) {
        // A transient failure here (flaky connection on app open, etc.) must
        // never be mistaken for "this user has no profile yet" — profileInfo
        // stays whatever it already was (null on first load), so the render
        // below has to check loadError before falling back to onboarding,
        // or a network blip would show the onboarding form to an existing
        // user and risk overwriting their real profile if they submitted it.
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, retryTick]);

  const addEntry = async ({ type, categories, duration, note, blocks }) => {
    const entry = await addJournalEntry(session.user.id, { label: "Şimdi", type, categories, duration, note, blocks, tags: [], hasVideo: false });
    setEntries((prev) => [entry, ...prev]);
    setShowForm(false);
  };

  const saveVideoAnalysis = async (note, frames) => {
    const entry = await addJournalEntry(session.user.id, {
      label: t(lang, "videoAnalysisLabel"),
      type: "Teknik",
      duration: "—",
      note,
      blocks: [],
      tags: [],
      hasVideo: true,
      frames: frames || [],
    });
    setEntries((prev) => [entry, ...prev]);
  };

  const deleteEntry = async (id) => {
    const prevEntries = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await deleteJournalEntry(session.user.id, id);
    } catch (e) {
      setEntries(prevEntries);
    }
  };

  const toggleLike = async (id) => {
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    const wasLiked = post.liked;
    const prevLikes = post.likes;
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, liked: !wasLiked, likes: wasLiked ? p.likes - 1 : p.likes + 1 } : p)));
    try {
      await toggleLikeDb(id, session.user.id, wasLiked);
    } catch (e) {
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, liked: wasLiked, likes: prevLikes } : p)));
    }
  };

  const addPost = async ({ text, stat, topic }) => {
    const name = profileInfo?.displayName || "—";
    const initials = computeInitials(name);
    await addCommunityPost(session.user.id, { name, initials, text, stat, topic });
    const refreshed = await getCommunityPosts(session.user.id);
    setPosts(refreshed);
  };

  const shareAchievement = async (badge) => {
    await addPost({ text: badge.shareText[lang] || badge.shareText.tr, stat: badge.label[lang] || badge.label.tr, topic: "Başarı" });
  };

  const shareJournalEntry = async (entry) => {
    await addPost({ text: buildEntryShareText(entry, lang), stat: `${entry.duration} · ${entryCategoryLabel(entry, lang)}`, topic: "Başarı" });
  };

  const deletePost = async (id) => {
    const prevPosts = posts;
    setPosts((prev) => prev.filter((p) => p.id !== id));
    try {
      await deleteCommunityPost(id, session.user.id);
    } catch (e) {
      setPosts(prevPosts);
    }
  };

  const addPlanEntry = async (p) => {
    const planKey = `${p.day}-${p.title}`;
    if (entries.some((e) => e.planKey === planKey)) return;
    const entry = await addJournalEntry(session.user.id, {
      label: p.day,
      type: p.title,
      duration: p.duration || "—",
      note: p.note,
      blocks: p.blocks || [],
      tags: [],
      hasVideo: false,
      planKey,
    });
    setEntries((prev) => [entry, ...prev]);
  };

  const removePlanEntry = async (p) => {
    const planKey = `${p.day}-${p.title}`;
    await deleteJournalEntryByPlanKey(session.user.id, planKey);
    setEntries((prev) => prev.filter((e) => e.planKey !== planKey));
  };

  const resetData = async () => {
    await resetJournalEntries(session.user.id);
    await resetChatMessages(session.user.id);
    await deleteProfile(session.user.id);
    setEntries([]);
    setProfileInfo(null);
  };

  const completeOnboarding = async (data) => {
    await upsertProfile(session.user.id, { ...data, lang });
    setProfileInfo(data);
  };

  const toggleLang = async () => {
    const next = lang === "tr" ? "en" : "tr";
    setLang(next);
    if (session && profileInfo) {
      try {
        await upsertProfile(session.user.id, { ...profileInfo, lang: next });
      } catch (e) {
        // non-critical, keep local state even if save fails
      }
    }
  };

  const signOut = () => {
    supabase.auth.signOut();
  };

  if (!isSupabaseConfigured) {
    return (
      <AppShell lang={lang} onToggleLang={toggleLang}>
        <div className="px-5 py-10 flex-1 flex flex-col justify-center text-center">
          <p className="text-neutral-100 text-base font-medium mb-2">
            {lang === "en" ? "Setup not finished yet" : "Kurulum henüz tamamlanmadı"}
          </p>
          <p className="text-neutral-500 text-xs leading-relaxed">
            {lang === "en"
              ? "This app needs a Supabase project connected. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment settings, then redeploy."
              : "Bu uygulamanın bağlı bir Supabase projesine ihtiyacı var. Deploy ayarlarına VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY değişkenlerini ekleyip yeniden deploy et."}
          </p>
        </div>
      </AppShell>
    );
  }

  if (passwordRecovery) {
    return (
      <AppShell lang={lang} onToggleLang={toggleLang}>
        <ResetPasswordForm lang={lang} onDone={() => setPasswordRecovery(false)} />
      </AppShell>
    );
  }

  if (session === undefined || (session && dataLoading)) {
    return (
      <AppShell lang={lang} onToggleLang={toggleLang}>
        <div className="flex-1 flex items-center justify-center">
          <BoxingGloveLoader size={48} label={t(lang, "loadingLabel")} />
        </div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell lang={lang} onToggleLang={toggleLang}>
        <AuthScreen lang={lang} />
      </AppShell>
    );
  }

  if (!profileInfo && loadError) {
    return (
      <AppShell lang={lang} onToggleLang={toggleLang}>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-neutral-300 text-sm">{t(lang, "loadErrorNote")}</p>
          <button
            onClick={() => setRetryTick((n) => n + 1)}
            className="bg-red-600 hover:bg-red-500 text-neutral-950 text-xs font-medium rounded-lg px-4 py-2 transition-colors"
          >
            {t(lang, "retryLabel")}
          </button>
        </div>
      </AppShell>
    );
  }

  if (!profileInfo) {
    return (
      <AppShell lang={lang} onToggleLang={toggleLang}>
        <OnboardingForm onComplete={completeOnboarding} lang={lang} />
      </AppShell>
    );
  }

  return (
    <AppShell
      lang={lang}
      onToggleLang={toggleLang}
      footer={
        <div className="flex border-t border-neutral-800">
          <NavButton active={tab === "journal"} icon={CalendarDays} label={t(lang, "navJournal")} onClick={() => setTab("journal")} />
          <NavButton active={tab === "coach"} icon={Sparkles} label={t(lang, "navCoach")} onClick={() => setTab("coach")} />
          <NavButton active={tab === "calendar"} icon={CalendarRange} label={t(lang, "navCalendar")} onClick={() => setTab("calendar")} />
          <NavButton active={tab === "community"} icon={Users} label={t(lang, "navCommunity")} onClick={() => setTab("community")} />
          <NavButton active={tab === "profile"} icon={User} label={t(lang, "navProfile")} onClick={() => setTab("profile")} />
        </div>
      }
    >
      {tab === "journal" ? (
        showForm ? (
          <NewEntryForm onSubmit={addEntry} onCancel={() => setShowForm(false)} lang={lang} />
        ) : (
          <JournalTab entries={entries} onAddClick={() => setShowForm(true)} onShareEntry={shareJournalEntry} onDeleteEntry={deleteEntry} lang={lang} />
        )
      ) : tab === "coach" ? (
        <CoachTab userId={session.user.id} profileInfo={profileInfo} entries={entries} lang={lang} onSaveVideoAnalysis={saveVideoAnalysis} />
      ) : tab === "calendar" ? (
        <CalendarTab
          onMarkDone={addPlanEntry}
          onUnmarkDone={removePlanEntry}
          lang={lang}
          userId={session.user.id}
          profileInfo={profileInfo}
          entries={entries}
        />
      ) : tab === "community" ? (
        <CommunityTab
          posts={posts}
          onLike={toggleLike}
          onPost={addPost}
          onDeletePost={deletePost}
          currentUserId={session.user.id}
          displayName={profileInfo.displayName}
          lang={lang}
        />
      ) : (
        <ProfileTab
          entries={entries}
          profileInfo={profileInfo}
          onReset={resetData}
          onSignOut={signOut}
          onSaveProfile={completeOnboarding}
          onShareAchievement={shareAchievement}
          loadError={loadError}
          lang={lang}
        />
      )}
    </AppShell>
  );
}
