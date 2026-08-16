import { useState, useEffect } from "react";
import { Flame, CalendarDays, Users, User, Plus, Video, TrendingUp, Heart, MessageCircle, Bell, Shield, X, Award, Newspaper, Lock, Sparkles, Upload, CircleCheck, CalendarRange, Swords, Target, Circle, BadgeCheck, Languages } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { storage } from "./lib/storage";

const CATEGORY_LIST = ["Güç", "Defans", "Teknik", "Agresiflik", "Footwork"];

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
  profileTitle: { tr: "Profil", en: "Profile" },
  aiCoachTitle: { tr: "AI koç", en: "AI coach" },
  videoAnalysisLabel: { tr: "Video analizi", en: "Video analysis" },
  withoutVideoLabel: { tr: "Video olmadan", en: "Without video" },
  planGenerate: { tr: "Plan oluştur", en: "Generate plan" },
  editAnswersLabel: { tr: "Cevapları değiştir", en: "Edit answers" },
  shareLabel: { tr: "Paylaş", en: "Share" },
  startLabel: { tr: "Başla", en: "Start" },
  resetLabel: { tr: "Verileri sıfırla", en: "Reset data" },
  verifiedCoachLabel: { tr: "Doğrulanmış Koç", en: "Verified Coach" },

  // Weekly summary / coach tip / streak
  weeklySummaryLabel: { tr: "Haftalık özet", en: "Weekly summary" },
  aiCoachSuggestionLabel: { tr: "AI koç önerisi", en: "AI coach suggestion" },
  nextSessionLabel: { tr: "Bir sonraki antrenmanda çalış", en: "Work on this in your next session" },
  referenceFighterLabel: { tr: "Referans dövüşçün", en: "Your reference fighter" },
  streakStripLabel: { tr: "Bu haftaki seriyin", en: "Your streak this week" },
  longestStreakLabel: { tr: "En uzun serin: 21 gün", en: "Longest streak: 21 days" },
  historyNote: { tr: "Geçmiş seans notların için Günlük sekmesine bak.", en: "Check the Journal tab for your past session notes." },

  // New entry form
  newSessionTitle: { tr: "Yeni seans", en: "New session" },
  typeLabel: { tr: "Tür", en: "Type" },
  durationLabel: { tr: "Süre (dk)", en: "Duration (min)" },
  noteLabel: { tr: "Not", en: "Note" },
  notePlaceholder: { tr: "Bu seansta neye çalıştın?", en: "What did you work on this session?" },
  durationNotePlaceholder: { tr: "30", en: "30" },
  saveLabel: { tr: "Kaydet", en: "Save" },
  fillDurationNoteError: { tr: "Süre ve not alanlarını doldur", en: "Fill in the duration and note fields" },
  shadowboxOpt: { tr: "Shadowbox", en: "Shadowbox" },
  padworkOpt: { tr: "Pad çalışması", en: "Pad work" },
  technicalOpt: { tr: "Teknik antrenman", en: "Technical training" },
  sparringOpt: { tr: "Sparring", en: "Sparring" },
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
  levelBeginner: { tr: "Başlangıç", en: "Beginner" },
  levelIntermediate: { tr: "Orta", en: "Intermediate" },
  levelAdvanced: { tr: "İleri", en: "Advanced" },
  focusQuestion: { tr: "En çok neyi geliştirmek istiyorsun?", en: "What do you most want to improve?" },
  focusPower: { tr: "Güç", en: "Power" },
  focusDefense: { tr: "Defans", en: "Defense" },
  focusTechnique: { tr: "Teknik", en: "Technique" },
  focusFootwork: { tr: "Ayak işi", en: "Footwork" },
  answerAllThree: { tr: "Üç soruyu da cevapla", en: "Answer all three questions" },
  daysLevelFocusLine: { tr: "gün · {level} · odak: {focus}", en: "days · {level} · focus: {focus}" },
  addToPlanLabel: { tr: "Plana ekle", en: "Add to plan" },
  sessionNamePlaceholder: { tr: "Antrenman adı, ör. Pad çalışması", en: "Session name, e.g. Pad work" },
  addLabel: { tr: "Ekle", en: "Add" },
  noPlanYet: { tr: "Henüz plan yok", en: "No plan yet" },
  fillTimeSessionError: { tr: "Saat ve antrenman adını gir", en: "Fill in the time and session name" },
  restDayNote: { tr: "Seçtiğin gün sayısına göre bu gün dinlenmeye ayrıldı.", en: "This day was set to rest based on the number of days you chose." },
  weeklyFocusSuffix: { tr: "Bu haftaki odağın:", en: "This week's focus:" },

  // AI Coach tab
  aiCoachSubtitle: { tr: "Video yükleyerek analiz al, ya da video olmadan hızlı geri bildirim iste.", en: "Upload a video for analysis, or get quick feedback without one." },
  uploadShadowboxLabel: { tr: "Shadowbox videonu yükle", en: "Upload your shadowbox video" },
  analysisCompleteLabel: { tr: "analiz tamamlandı", en: "analysis complete" },
  uploadNewVideoLabel: { tr: "Yeni video yükle", en: "Upload new video" },
  noVideoIntro: { tr: "Video yükleyemiyor musun? Kısa bir öz değerlendirmeyle de öneri alabilirsin.", en: "Can't upload a video? You can still get suggestions with a quick self-check." },
  focusTodayQuestion: { tr: "Bugün en çok neye çalıştın?", en: "What did you focus on most today?" },
  chooseOptionLabel: { tr: "Seç", en: "Select" },
  getFeedbackLabel: { tr: "Geri bildirim al", en: "Get feedback" },
  chooseAnAreaError: { tr: "Bir alan seç", en: "Choose an area" },
  suggestedDrillLabel: { tr: "Önerilen drill", en: "Suggested drill" },
  guardOpt: { tr: "Sol el / guard", en: "Lead hand / guard" },
  footworkOpt: { tr: "Ayak işi", en: "Footwork" },
  hookPowerOpt: { tr: "Kroşe / vuruş gücü", en: "Hook / punching power" },

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
  storageErrorNote: { tr: "Veriler kaydedilirken bir sorun oldu, bu oturumda geçici kalabilir.", en: "There was a problem saving your data, it may only last this session." },
  privacyNote: {
    tr: "Günlüğün sadece sana özel saklanır. Topluluk paylaşımları bu artifact'ı kullanan herkese açıktır.",
    en: "Your journal is stored privately, just for you. Community posts are visible to everyone using this artifact.",
  },
  focusPointLabel: { tr: "Odak noktası:", en: "Focus:" },

  // Onboarding
  onboardingTitle: { tr: "Seni tanıyalım", en: "Let's get to know you" },
  onboardingSubtitle: { tr: "Bu bilgiler AI koçun sana daha doğru geri bildirim verebilmesi için kullanılacak.", en: "This helps your AI coach give you more accurate feedback." },
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
  yearsStyleRequiredError: { tr: "Deneyim süreni ve stilini seç", en: "Select your experience and style" },
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

const categoryTranslations = {
  Güç: { tr: "Güç", en: "Power" },
  Defans: { tr: "Defans", en: "Defense" },
  Teknik: { tr: "Teknik", en: "Technique" },
  Agresiflik: { tr: "Agresiflik", en: "Aggression" },
  Footwork: { tr: "Footwork", en: "Footwork" },
  "Ayak işi": { tr: "Ayak işi", en: "Footwork" },
};
function tc(cat, lang) {
  return categoryTranslations[cat] ? categoryTranslations[cat][lang] || cat : cat;
}

const sessionTypeTranslations = {
  Shadowbox: { tr: "Shadowbox", en: "Shadowboxing" },
  "Pad çalışması": { tr: "Pad çalışması", en: "Pad work" },
  "Teknik antrenman": { tr: "Teknik antrenman", en: "Technical training" },
  Sparring: { tr: "Sparring", en: "Sparring" },
};
function ts(type, lang) {
  return sessionTypeTranslations[type] ? sessionTypeTranslations[type][lang] || type : type;
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

const initialEntries = [
  {
    id: 3,
    label: "Bugün",
    type: "Shadowbox",
    duration: "32 dk",
    note: "AI analiz: sol el çenede düşük kalıyor, bel dönüşü geçen haftaya göre güçlendi.",
    tags: [
      { text: "sol el düşük", tone: "warn" },
      { text: "bel dönüşü ↑", tone: "good" },
    ],
    hasVideo: true,
  },
  {
    id: 2,
    label: "Dün",
    type: "Pad çalışması",
    duration: "45 dk",
    note: "Kombinasyon sonrası savunmaya dönüş hızlandı, sağ hook'ta denge daha stabil.",
    tags: [{ text: "denge ↑", tone: "good" }],
    hasVideo: false,
  },
  {
    id: 1,
    label: "Pazartesi",
    type: "Teknik antrenman",
    duration: "28 dk",
    note: "Philly shell geçişlerinde omuz açısı çalışıldı.",
    tags: [],
    hasVideo: false,
  },
];

const initialPosts = [
  {
    id: 3,
    name: "Coach Mert T.",
    initials: "MT",
    timestamp: Date.now() - 3 * 60 * 60 * 1000,
    text: "Bu hafta çalışacağınız bir şey: jab attıktan sonra elinizi geri çekerken çenenizi kapatın. Küçük bir detay ama maçta fark yaratıyor. Kendi kanalımda tam versiyonu var, bakmak isteyen çıksın.",
    stat: null,
    likes: 47,
    comments: 9,
    liked: false,
    verified: true,
  },
  {
    id: 1,
    name: "Emir K.",
    initials: "EK",
    timestamp: Date.now() - 5 * 60 * 60 * 1000,
    text: "Philly shell'de omuz pozisyonunu bir türlü tutturamıyorum, ayna karşısında çalışan var mı?",
    stat: null,
    likes: 12,
    comments: 4,
    liked: false,
  },
  {
    id: 2,
    name: "Berk Y.",
    initials: "BY",
    timestamp: Date.now() - 30 * 60 * 60 * 1000,
    text: null,
    stat: "12 haftalık ilerlemesini paylaştı",
    likes: 31,
    comments: 6,
    liked: false,
  },
];

const matchNews = [
  {
    id: 1,
    fighters: "Türkiye Şampiyonası Yarı Final",
    weight: "69 kg",
    date: "23 Ağustos",
    venue: "İstanbul",
  },
  {
    id: 2,
    fighters: "Anadolu Kupası Açık Turnuva",
    weight: "Tüm sıklet",
    date: "6 Eylül",
    venue: "Ankara",
  },
  {
    id: 3,
    fighters: "Amatör Boks Gecesi",
    weight: "75 kg",
    date: "14 Eylül",
    venue: "Bursa",
  },
];

const TAG_TONE = {
  warn: "bg-amber-950 text-amber-400 border border-amber-900",
  good: "bg-emerald-950 text-emerald-400 border border-emerald-900",
};

function CornerMark({ width = 30, height = 17 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 100 56" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The Corner logosu">
      <rect x="43" y="10" width="14" height="36" rx="1.5" fill="#dc2626" />
      <path d="M43 18 L4 8" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M43 27 L4 26" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M43 37 L4 46" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M57 18 L96 8" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M57 27 L96 26" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M57 37 L96 46" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
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
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CornerMark width={32} height={18} />
          <div>
            <p
              className="text-neutral-100 text-lg leading-none tracking-wide"
              style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 500 }}
            >
              THE CORNER
            </p>
            <p className="text-neutral-600 text-[10px] mt-0.5">@TheCornerBoxing</p>
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
      <p className="text-neutral-100 text-xl mt-0.5" style={{ fontFamily: "'Oswald', sans-serif" }}>
        {value}
      </p>
    </div>
  );
}

function mostImprovedTag(entries) {
  const counts = {};
  entries.forEach((e) =>
    e.tags.forEach((t) => {
      if (t.tone === "good") counts[t.text] = (counts[t.text] || 0) + 1;
    })
  );
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}

function WeeklySummary({ entries, lang }) {
  const improved = mostImprovedTag(entries);
  const improvedLabel = improved ? tt(improved.replace(" ↑", ""), lang) : null;
  return (
    <div className="bg-neutral-900 border border-red-900 rounded-xl p-3 mb-4">
      <div className="flex items-center gap-1.5 mb-1">
        <TrendingUp size={14} className="text-red-500" />
        <span className="text-red-500 text-xs font-medium">{t(lang, "weeklySummaryLabel")}</span>
      </div>
      <p className="text-neutral-300 text-xs leading-relaxed">
        {lang === "en"
          ? `You completed ${entries.length} sessions this week.${
              improvedLabel ? ` Your most improved area: ${improvedLabel}.` : " Keep going and your AI coach will start spotting patterns."
            }`
          : `Bu hafta ${entries.length} seans tamamladın.${
              improvedLabel ? ` En çok gelişen alanın: ${improvedLabel}.` : " Devam ettikçe AI koç örüntüleri çıkarmaya başlayacak."
            }`}
      </p>
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

const weaknessDrills = {
  "sol el düşük": "Sol el pozisyon tekrarları · 3x2 dk, ayna karşısında",
  "denge ↑": "Tek bacak denge + pivot çalışması · 3 set",
};

function getWeaknessDrill(entries) {
  for (const e of entries) {
    for (const t of e.tags) {
      if (t.tone === "warn" && weaknessDrills[t.text]) return weaknessDrills[t.text];
    }
  }
  return null;
}

function CoachTip({ entries, profileInfo, lang }) {
  const fighter = getFighterProfile(profileInfo.style, profileInfo.school);
  const drill = getWeaknessDrill(entries) || fighter.drill;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Award size={14} className="text-red-500" />
        <span className="text-red-500 text-xs font-medium">{t(lang, "aiCoachSuggestionLabel")}</span>
      </div>
      <div className="mb-2">
        <p className="text-neutral-500 text-[11px] mb-0.5">{t(lang, "nextSessionLabel")}</p>
        <p className="text-neutral-200 text-xs leading-relaxed">{drill}</p>
      </div>
      {fighter.reference && (
        <div>
          <p className="text-neutral-500 text-[11px] mb-0.5">{t(lang, "referenceFighterLabel")}</p>
          <p className="text-neutral-400 text-xs leading-relaxed">
            {fighter.reference} — {fighter.focus} {lang === "en" ? "is worth studying" : "konusunda izlemeye değer"}
          </p>
          {fighter.quote && (
            <p className="text-neutral-500 text-[11px] leading-relaxed mt-1.5 italic">
              {fighter.quote} <span className="not-italic">— {fighter.reference}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StreakStrip({ entries, lang }) {
  const activeDays = Math.min(entries.length, 7);
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-neutral-500 text-xs">{t(lang, "streakStripLabel")}</span>
        <span className="text-neutral-600 text-[11px]">{t(lang, "longestStreakLabel")}</span>
      </div>
      <div className="flex items-center justify-between">
        {wd(lang).map((d, i) => (
          <div key={d} className="flex flex-col items-center gap-1">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                i < activeDays ? "bg-red-600" : "bg-neutral-800"
              }`}
            >
              {i < activeDays && <Flame size={12} className="text-neutral-950" />}
            </div>
            <span className="text-[9px] text-neutral-600">{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function JournalTab({ entries, onAddClick, profileInfo, lang }) {
  const streak = entries.length > 0 ? entries.length + 6 : 0;
  const weekCount = entries.length;

  return (
    <div className="px-5 pb-5">
      <p className="text-neutral-100 text-base font-medium mb-3">{t(lang, "journalTitle")}</p>

      <div className="flex gap-2 mb-4">
        <StatCard label={t(lang, "streakLabel")} value={`${streak} gün`} />
        <StatCard label={t(lang, "weekLabel")} value={`${weekCount} seans`} />
      </div>

      <StreakStrip entries={entries} lang={lang} />

      <WeeklySummary entries={entries} lang={lang} />
      <CoachTip entries={entries} profileInfo={profileInfo} lang={lang} />

      <div className="flex flex-col gap-2.5 mb-4">
        {entries.map((e) => (
          <div key={e.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-neutral-100 text-sm font-medium">
                {e.label} · {ts(e.type, lang)}
              </span>
              <span className="text-neutral-500 text-xs">{e.duration}</span>
            </div>
            {typeof e.id === "string" && e.id.startsWith("plan-") && (
              <span className="inline-block text-[10px] text-red-500 mb-1.5">{t(lang, "markedFromCalendar")}</span>
            )}

            {e.hasVideo && (
              <div className="relative bg-neutral-950 border border-neutral-800 rounded-lg h-20 flex items-center justify-center mb-2">
                <Video size={20} className="text-neutral-600" />
                <span className="absolute top-1.5 left-1.5 text-[10px] bg-red-950 text-red-400 border border-red-900 px-1.5 py-0.5 rounded">
                  {t(lang, "newBadge")}
                </span>
              </div>
            )}

            <p className="text-neutral-400 text-xs leading-relaxed mb-2">{e.note}</p>

            {e.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {e.tags.map((tag, i) => (
                  <span key={i} className={`text-[11px] px-2 py-0.5 rounded ${TAG_TONE[tag.tone]}`}>
                    {tt(tag.text.replace(" ↑", ""), lang)}
                    {tag.text.includes("↑") ? " ↑" : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

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
  const [type, setType] = useState("Shadowbox");
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!duration.trim() || !note.trim()) {
      setError(t(lang, "fillDurationNoteError"));
      return;
    }
    onSubmit({ type, duration: `${duration} dk`, note });
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
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-3"
        >
          <option value="Shadowbox">{ts("Shadowbox", lang)}</option>
          <option value="Pad çalışması">{ts("Pad çalışması", lang)}</option>
          <option value="Teknik antrenman">{ts("Teknik antrenman", lang)}</option>
          <option value="Sparring">{ts("Sparring", lang)}</option>
        </select>

        <label className="text-neutral-500 text-xs block mb-1">{t(lang, "durationLabel")}</label>
        <input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="30"
          className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-3"
        />

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
          className="w-full bg-red-600 hover:bg-red-500 text-neutral-950 font-medium text-sm rounded-lg py-2 mt-2 transition-colors"
        >
          {t(lang, "saveLabel")}
        </button>
      </div>
    </div>
  );
}

function ComposeBox({ onSubmit, lang }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!text.trim()) {
      setError(t(lang, "emptyPostError"));
      return;
    }
    onSubmit(text);
    setText("");
    setError("");
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
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <div className="flex justify-end">
        <button
          onClick={submit}
          className="bg-red-600 hover:bg-red-500 text-neutral-950 font-medium text-xs rounded-lg px-3 py-1.5 transition-colors"
        >
          {t(lang, "shareLabel")}
        </button>
      </div>
    </div>
  );
}

function MatchNewsList() {
  return (
    <div className="flex flex-col gap-2.5">
      {matchNews.map((m) => (
        <div key={m.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
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
  );
}

function CommunityTab({ posts, onLike, onPost, lang }) {
  const [view, setView] = useState("feed");

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
        <MatchNewsList />
      ) : (
        <>
      <ComposeBox onSubmit={onPost} lang={lang} />
      <div className="flex flex-col gap-2.5">
        {posts
          .slice()
          .sort((a, b) => b.timestamp - a.timestamp)
          .map((p) => (
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
              <span className="flex items-center gap-1">
                <MessageCircle size={14} />
                {p.comments}
              </span>
            </div>
          </div>
        ))}
      </div>
        </>
      )}
    </div>
  );
}

const badgeList = [
  {
    id: "streak",
    label: "9 gün seri",
    icon: Flame,
    check: (entries) => entries.length >= 3,
  },
  {
    id: "sparring",
    label: "İlk sparring notu",
    icon: Award,
    check: (entries) => entries.some((e) => e.type === "Sparring"),
  },
  {
    id: "analiz",
    label: "İlk AI analiz",
    icon: Video,
    check: (entries) => entries.some((e) => e.hasVideo),
  },
];

function BadgeGrid({ entries }) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {badgeList.map((b) => {
        const earned = b.check(entries);
        const Icon = earned ? b.icon : Lock;
        return (
          <div
            key={b.id}
            className={`rounded-lg px-3 py-2.5 flex items-center gap-2 border ${
              earned ? "bg-red-950 border-red-900" : "bg-neutral-900 border-neutral-800"
            }`}
          >
            <Icon size={16} className={earned ? "text-red-500" : "text-neutral-600"} />
            <span className={`text-xs ${earned ? "text-red-400" : "text-neutral-600"}`}>{b.label}</span>
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

function ProfileTab({ entries, profileInfo, onReset, storageError, lang }) {
  const skillData = CATEGORY_LIST.map((skill) => ({ skill, value: profileInfo.ratings[skill] ?? 50 }));
  const fighter = getFighterProfile(profileInfo.style, profileInfo.school);

  return (
    <div className="px-5 pb-5">
      <p className="text-neutral-100 text-base font-medium mb-3">{t(lang, "profileTitle")}</p>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-red-950 border border-red-900 flex items-center justify-center text-red-500 text-sm font-medium">
          EK
        </div>
        <div>
          <p className="text-neutral-100 text-sm font-medium">Emir K.</p>
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
      <BadgeGrid entries={entries} />

      <p className="text-neutral-500 text-xs mb-1">{t(lang, "categoryLevelLabel")}</p>
      <p className="text-neutral-600 text-[11px] mb-2">{t(lang, "categoryLevelNote")}</p>
      {skillData.map((s) => (
        <SkillBar key={s.skill} skill={tc(s.skill, lang)} value={s.value} />
      ))}

      {storageError && <p className="text-red-400 text-[11px] mt-4">{t(lang, "storageErrorNote")}</p>}

      <div className="border-t border-neutral-800 mt-4 pt-4">
        <p className="text-neutral-600 text-[11px] mb-2">{t(lang, "privacyNote")}</p>
        <button onClick={onReset} className="text-neutral-500 text-xs hover:text-neutral-300 transition-colors">
          {t(lang, "resetLabel")}
        </button>
      </div>
    </div>
  );
}

const focusFeedback = {
  "Sol el / guard": {
    result: "Sol elini çene hizasında tutmaya odaklan, özellikle jab attıktan hemen sonra.",
    drill: "Guard-hold shadowbox · 3x2 dk, sol el sürekli çenede",
  },
  "Ayak işi": {
    result: "Adımların uzun kalıyor olabilir, kısa ve sık adımlar dengeyi artırır.",
    drill: "Kutu içinde ayak işi tekrarı · 4x1.5 dk",
  },
  "Kroşe / vuruş gücü": {
    result: "Vuruş anında bel dönüşünü tam kullanmıyor olabilirsin, gücün büyük kısmı buradan gelir.",
    drill: "Yavaş tempo kroşe + rotasyon çalışması · 3x2 dk",
  },
};

function VideoAnalysis({ lang }) {
  const [status, setStatus] = useState("idle");

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
      {status === "idle" ? (
        <button
          onClick={() => setStatus("done")}
          className="w-full border border-dashed border-neutral-700 rounded-lg py-6 flex flex-col items-center gap-2 hover:border-red-800 transition-colors"
        >
          <Upload size={20} className="text-neutral-500" />
          <span className="text-neutral-400 text-xs">{t(lang, "uploadShadowboxLabel")}</span>
        </button>
      ) : (
        <div>
          <div className="relative bg-neutral-950 border border-neutral-800 rounded-lg h-24 flex items-center justify-center mb-3">
            <Video size={20} className="text-neutral-600" />
            <span className="absolute top-1.5 left-1.5 text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-1.5 py-0.5 rounded flex items-center gap-1">
              <CircleCheck size={10} /> {t(lang, "analysisCompleteLabel")}
            </span>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-start gap-2">
              <span className="text-[11px] bg-amber-950 text-amber-400 border border-amber-900 px-2 py-0.5 rounded whitespace-nowrap">
                {tt("sol el düşük", lang)}
              </span>
              <p className="text-neutral-400 text-xs leading-relaxed">{lang === "en" ? "Repeated for 8 frames after the jab" : "Jab sonrası 8 karede tekrar etti"}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[11px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-2 py-0.5 rounded whitespace-nowrap">
                {tt("bel dönüşü", lang)} ↑
              </span>
              <p className="text-neutral-400 text-xs leading-relaxed">{lang === "en" ? "18% stronger rotation than last week" : "Geçen haftaya göre %18 daha güçlü rotasyon"}</p>
            </div>
          </div>
          <button
            onClick={() => setStatus("idle")}
            className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-lg py-2 transition-colors"
          >
            {t(lang, "uploadNewVideoLabel")}
          </button>
        </div>
      )}
    </div>
  );
}

function NoVideoCheckin({ lang }) {
  const [focus, setFocus] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const submit = () => {
    if (!focus) {
      setError(t(lang, "chooseAnAreaError"));
      return;
    }
    setResult(focusFeedback[focus]);
    setError("");
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
      <p className="text-neutral-400 text-xs mb-2">{t(lang, "noVideoIntro")}</p>

      <label className="text-neutral-500 text-xs block mb-1">{t(lang, "focusTodayQuestion")}</label>
      <select
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
        className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-2"
      >
        <option value="">{t(lang, "chooseOptionLabel")}</option>
        <option value="Sol el / guard">{t(lang, "guardOpt")}</option>
        <option value="Ayak işi">{t(lang, "footworkOpt")}</option>
        <option value="Kroşe / vuruş gücü">{t(lang, "hookPowerOpt")}</option>
      </select>
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      <button
        onClick={submit}
        className="w-full bg-red-600 hover:bg-red-500 text-neutral-950 font-medium text-xs rounded-lg py-2 transition-colors"
      >
        {t(lang, "getFeedbackLabel")}
      </button>

      {result && (
        <div className="mt-3 pt-3 border-t border-neutral-800">
          <p className="text-neutral-300 text-xs leading-relaxed mb-2">{result.result}</p>
          <p className="text-neutral-500 text-[11px] mb-0.5">{t(lang, "suggestedDrillLabel")}</p>
          <p className="text-neutral-200 text-xs">{result.drill}</p>
        </div>
      )}
    </div>
  );
}

function AICoachTab({ lang }) {
  const [mode, setMode] = useState("video");

  return (
    <div className="px-5 pb-5">
      <p className="text-neutral-100 text-base font-medium mb-1">{t(lang, "aiCoachTitle")}</p>
      <p className="text-neutral-500 text-xs mb-3">{t(lang, "aiCoachSubtitle")}</p>

      <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 mb-3">
        <button
          onClick={() => setMode("video")}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
            mode === "video" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
          }`}
        >
          {t(lang, "videoAnalysisLabel")}
        </button>
        <button
          onClick={() => setMode("text")}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
            mode === "text" ? "bg-red-600 text-neutral-950 font-medium" : "text-neutral-500"
          }`}
        >
          {t(lang, "withoutVideoLabel")}
        </button>
      </div>

      {mode === "video" ? <VideoAnalysis lang={lang} /> : <NoVideoCheckin lang={lang} />}
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

function PlanQuestionnaire({ intensity, setIntensity, days, setDays, level, setLevel, focus, setFocus, onSubmit, error, lang }) {
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

function CalendarTab({ onMarkDone, onUnmarkDone, lang }) {
  const [mode, setMode] = useState("ai");
  const [intensity, setIntensity] = useState("general");
  const [days, setDays] = useState(null);
  const [level, setLevel] = useState(null);
  const [focus, setFocus] = useState(null);
  const [planReady, setPlanReady] = useState(false);
  const [qError, setQError] = useState("");
  const [completed, setCompleted] = useState(Array(7).fill(false));
  const [ownPlan, setOwnPlan] = useState({});

  const plan = planReady ? buildPlan(intensity, days, focus, lang) : [];

  const startPlan = () => {
    if (!days || !level || !focus) {
      setQError(t(lang, "answerAllThree"));
      return;
    }
    setQError("");
    setPlanReady(true);
    setCompleted(Array(7).fill(false));
  };

  const editAnswers = () => {
    setPlanReady(false);
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
          </>
        )
      ) : (
        <OwnPlanView ownPlan={ownPlan} onAdd={addOwn} onRemove={removeOwn} lang={lang} />
      )}

      <p className="text-neutral-600 text-[11px] mt-3">{t(lang, "planJournalLinkNote")}</p>
    </div>
  );
}

function OnboardingForm({ onComplete, lang }) {
  const [years, setYears] = useState("");
  const [style, setStyle] = useState("");
  const [school, setSchool] = useState("");
  const [strengths, setStrengths] = useState([]);
  const [weaknesses, setWeaknesses] = useState([]);
  const [ratings, setRatings] = useState({ Güç: 50, Defans: 50, Teknik: 50, Agresiflik: 50, Footwork: 50 });
  const [error, setError] = useState("");

  const toggleStrength = (cat) => {
    setStrengths((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };
  const toggleWeakness = (cat) => {
    setWeaknesses((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };
  const setRating = (cat, val) => setRatings({ ...ratings, [cat]: Number(val) });

  const submit = () => {
    if (!years || !style) {
      setError(t(lang, "yearsStyleRequiredError"));
      return;
    }
    setError("");
    onComplete({ years, style, school, strengths, weaknesses, ratings });
  };

  return (
    <div className="px-5 py-6 overflow-y-auto" style={{ maxHeight: 640 }}>
      <p className="text-neutral-100 text-lg font-medium mb-1" style={{ fontFamily: "'Oswald', sans-serif" }}>
        {t(lang, "onboardingTitle")}
      </p>
      <p className="text-neutral-500 text-xs mb-4">{t(lang, "onboardingSubtitle")}</p>

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

      <button
        onClick={submit}
        className="w-full bg-red-600 hover:bg-red-500 text-neutral-950 font-medium text-sm rounded-lg py-2.5 transition-colors"
      >
        {t(lang, "startLabel")}
      </button>
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
  const [entries, setEntries] = useState([]);
  const [posts, setPosts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const [profileInfo, setProfileInfo] = useState(null);
  const [lang, setLang] = useState("tr");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let loadedEntries = initialEntries;
      let loadedPosts = initialPosts;
      let loadedProfile = null;
      let loadedLang = "tr";

      try {
        const res = await storage.get("journal-entries", false);
        if (res && res.value) loadedEntries = JSON.parse(res.value);
      } catch (e) {
        try {
          await storage.set("journal-entries", JSON.stringify(initialEntries), false);
        } catch (e2) {
          setStorageError(true);
        }
      }

      try {
        const res = await storage.get("community-posts", true);
        if (res && res.value) loadedPosts = JSON.parse(res.value);
      } catch (e) {
        try {
          await storage.set("community-posts", JSON.stringify(initialPosts), true);
        } catch (e2) {
          setStorageError(true);
        }
      }

      try {
        const res = await storage.get("profile-info", false);
        if (res && res.value) loadedProfile = JSON.parse(res.value);
      } catch (e) {
        // no profile yet, onboarding will handle it
      }

      try {
        const res = await storage.get("app-lang", false);
        if (res && res.value) loadedLang = res.value;
      } catch (e) {
        // default tr
      }

      if (!cancelled) {
        setEntries(loadedEntries);
        setPosts(loadedPosts);
        setProfileInfo(loadedProfile);
        setLang(loadedLang);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistEntries = async (next) => {
    setEntries(next);
    try {
      await storage.set("journal-entries", JSON.stringify(next), false);
    } catch (e) {
      setStorageError(true);
    }
  };

  const persistPosts = async (next) => {
    setPosts(next);
    try {
      await storage.set("community-posts", JSON.stringify(next), true);
    } catch (e) {
      setStorageError(true);
    }
  };

  const addEntry = ({ type, duration, note }) => {
    persistEntries([{ id: Date.now(), label: "Şimdi", type, duration, note, tags: [], hasVideo: false }, ...entries]);
    setShowForm(false);
  };

  const toggleLike = (id) => {
    persistPosts(
      posts.map((p) =>
        p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
      )
    );
  };

  const addPost = (text) => {
    persistPosts([
      { id: Date.now(), name: "Sen", initials: "SN", timestamp: Date.now(), text, stat: null, likes: 0, comments: 0, liked: false },
      ...posts,
    ]);
  };

  const addPlanEntry = (p) => {
    const id = `plan-${p.day}-${p.title}`;
    if (entries.some((e) => e.id === id)) return;
    persistEntries([
      { id, label: p.day, type: p.title, duration: p.duration || "—", note: p.note, tags: [], hasVideo: false },
      ...entries,
    ]);
  };

  const removePlanEntry = (p) => {
    const id = `plan-${p.day}-${p.title}`;
    persistEntries(entries.filter((e) => e.id !== id));
  };

  const resetData = async () => {
    await persistEntries(initialEntries);
    await persistPosts(initialPosts);
    try {
      await storage.delete("profile-info", false);
    } catch (e) {
      // ignore
    }
    setProfileInfo(null);
  };

  const completeOnboarding = async (data) => {
    setProfileInfo(data);
    try {
      await storage.set("profile-info", JSON.stringify(data), false);
    } catch (e) {
      setStorageError(true);
    }
  };

  const toggleLang = async () => {
    const next = lang === "tr" ? "en" : "tr";
    setLang(next);
    try {
      await storage.set("app-lang", next, false);
    } catch (e) {
      // non-critical, keep local state even if save fails
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center py-10">
        <div className="w-full max-w-sm flex items-center justify-center" style={{ minHeight: 640 }}>
          <p className="text-neutral-600 text-sm">{t(lang, "loadingLabel")}</p>
        </div>
      </div>
    );
  }

  if (!profileInfo) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center py-10">
        <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden flex flex-col" style={{ minHeight: 640 }}>
          <Header lang={lang} onToggleLang={toggleLang} />
          <OnboardingForm onComplete={completeOnboarding} lang={lang} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center py-10">
      <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden flex flex-col" style={{ minHeight: 640 }}>
        <Header lang={lang} onToggleLang={toggleLang} />

        <div className="flex-1 overflow-y-auto">
          {tab === "journal" ? (
            showForm ? (
              <NewEntryForm onSubmit={addEntry} onCancel={() => setShowForm(false)} lang={lang} />
            ) : (
              <JournalTab entries={entries} onAddClick={() => setShowForm(true)} profileInfo={profileInfo} lang={lang} />
            )
          ) : tab === "coach" ? (
            <AICoachTab lang={lang} />
          ) : tab === "calendar" ? (
            <CalendarTab onMarkDone={addPlanEntry} onUnmarkDone={removePlanEntry} lang={lang} />
          ) : tab === "community" ? (
            <CommunityTab posts={posts} onLike={toggleLike} onPost={addPost} lang={lang} />
          ) : (
            <ProfileTab entries={entries} profileInfo={profileInfo} onReset={resetData} storageError={storageError} lang={lang} />
          )}
        </div>

        <div className="flex border-t border-neutral-800">
          <NavButton active={tab === "journal"} icon={CalendarDays} label={t(lang, "navJournal")} onClick={() => setTab("journal")} />
          <NavButton active={tab === "coach"} icon={Sparkles} label={t(lang, "navCoach")} onClick={() => setTab("coach")} />
          <NavButton active={tab === "calendar"} icon={CalendarRange} label={t(lang, "navCalendar")} onClick={() => setTab("calendar")} />
          <NavButton active={tab === "community"} icon={Users} label={t(lang, "navCommunity")} onClick={() => setTab("community")} />
          <NavButton active={tab === "profile"} icon={User} label={t(lang, "navProfile")} onClick={() => setTab("profile")} />
        </div>
      </div>
    </div>
  );
}
