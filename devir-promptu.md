# DEVİR PROMPTU — "The Corner" Boks Antrenman PWA'sı

Ben "The Corner" adında gerçek (mockup değil) bir boks antrenman PWA'sı geliştiriyorum. Aşağıda projenin tüm teknik detaylarını, mimarisini, kullandığımız teknolojileri, tamamlanan özellikleri ve devam eden işleri bulacaksın. Bu bir devam promptu — önceki Claude Code oturumundan devralınıyor.

## Repo ve Deploy
- GitHub: `g4hzp4b4w2-coder/the-corner`
- Geliştirme branch'i: `claude/react-vite-setup-mx144l`
- Deploy: Vercel
- Workflow: Her değişiklik `claude/react-vite-setup-mx144l` branch'ine commit+push edilir, sonra `git fetch origin main && git checkout -B main origin/main && git cherry-pick <commit>` ile (full merge DEĞİL, cherry-pick ile) main'e taşınır, `npm run build` ile doğrulanır, main'e push edilir, sonra tekrar dev branch'ine dönülür. Yeni bir Supabase migration'ı gerektiren commit'ler, kullanıcı SQL'i çalıştırdığını onaylayana kadar main'e cherry-pick edilmeden dev branch'te bekletilir.

## Teknoloji Yığını (Tech Stack)
- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Ana dosya**: `src/the-corner-app-demo.jsx` (monolitik ana bileşen) + ayrıştırılmış özellik bileşenleri (`src/*.jsx`)
- **Backend/DB**: Supabase (Postgres + Row Level Security/RLS + Auth)
- **AI**: Anthropic Claude API
  - `coach-chat.js`: `claude-sonnet-5` modeli, `maxTokens = hasImages ? 4096 : 500`, `MAX_IMAGES=20`, `MAX_CONTINUATIONS=1`
  - `coach-plan.js`: `claude-sonnet-5`, `max_tokens=1600`
  - `match-news.js`: daha ucuz `claude-haiku-4-5-20251001` + `web_search` tool, 24 saatlik global cache (dil bazlı)
- **Serverless functions**: Vercel (`api/*.js`)
- **Pose/hareket takibi**: **MediaPipe Pose Landmarker** (33 noktalı model, `pose_landmarker_lite`, GPU delegate, VIDEO modu) — `src/lib/poseAnalysis.js`'deki `createPoseSession()`
- **İkon kütüphanesi**: lucide-react
- **Grafikler**: recharts (LineChart, profildeki güç trendi grafiği için)
- **PWA**: vite-plugin-pwa (service worker, manifest)
- **Test/doğrulama metodolojisi**: Node.js `.mjs` simülasyon script'leri (proje kodunu kopyalayıp import'ları düzelterek) — gerçek kamera testi sandbox'ta mümkün değil (MediaPipe CDN network-blocked), bu yüzden algoritmalar simülasyonla doğrulanıyor. Playwright da canvas/UI görsel testleri için kullanıldı.

## Mimari Detaylar

### Pose/Hareket Takibi Katmanı
- `src/lib/poseMath.js`: Landmark index sabitleri — `NOSE=0`, `SHOULDER={left:11,right:12}`, `WRIST={left:15,right:16}`, `MIN_VISIBILITY`, `visible()`, `dist()`, `shoulderWidthOf()`, `relWrist()`, `relNose()`. **Kritik konvansiyon**: MediaPipe'ın left/right etiketleri kişinin KENDİ anatomik sol/sağını gösterir, ekran sol/sağını değil.
- **Kamera aynalama mimarisi** (tüm canlı modlarda — ShadowBoxing, BagWork, PadWork, Dodge): Ham (aynalanmamış) video karesi önce çizilir, `detectAll()` bu ham canvas üzerinde çalıştırılır (MediaPipe'ın sol/sağ etiketlemesi bozulmasın diye), SONRA aynı video karesi ikinci kez `ctx.save(); ctx.translate(width,0); ctx.scale(-1,1); ctx.drawImage(...); ctx.restore();` ile aynalanarak (selfie görünümü) tekrar çizilir. Metin etiketleri AYRI, aynalanmamış bir pass'te `width - tx` koordinatında çizilir (aynalı transform içinde yazı ters çıkar).
- `src/lib/oneEuroFilter.js`: One-Euro filter (Casiez et al. 2012) — `createOneEuroFilter()`, `createOneEuroFilter2D()`. Bilek yumuşatmasında eski sabit-alpha EMA'nın yerini aldı, sabit `WRIST_MIN_CUTOFF=1.5`, `WRIST_BETA=0.7`.
- `src/lib/liveDetection.js`: Adaptif yumruk detektörü `createPunchDetector(seed={})` — kol başına opsiyonel `seed` (medyan hız) kabul eder, bootstrap eşiği için kullanılır.
- `src/lib/audioImpact.js`: Ses tabanlı darbe algılama (`createImpactDetector()`) — RMS genlik + adaptif taban çizgi (EMA) + spike oranı + refractory pencere + bootstrap gözlem penceresi. Kum torbası modu için.
- `src/lib/armTracker.js`: Kum torbası'nın antrenman verisi (arm/speed/direction) toplaması için hafif kol takipçisi, güven eşikli (`snapshotAtImpact()`).
- `src/lib/reactionTracker.js`: Pad Work için kol bazlı (One-Euro yumuşatmalı) pozisyon takipçisi.
- `src/lib/headTracker.js`: Dodge Mode için tek nokta (baş) versiyonu.
- `src/lib/reactionTarget.js`: Pad Work'ün "hedefe-ulaş" motoru — `PAD_TARGETS`, `pickTarget()`, `HIT_RADIUS=0.35`, `checkTarget()`.
- `src/lib/dodgeTarget.js`: Dodge Mode hedef sistemi — **üçüncü iterasyonda**, artık `DODGE_ZONES` (ekrana sabit bölgeler: sol/sağ/aşağı), `pickDodgeZone()`, `isInZone()`, `RECOVERY_MS=500` (toparlanma molası).
- `src/lib/punchStats.js`: `summarizeBalance()`, `computeWeeklySpeedTrend()`, `hasPowerIncrease()`.

### Canlı Antrenman Modları (`src/LiveTrainingTab.jsx` üzerinden seçiliyor)
1. **Gölge Boksu** (`ShadowBoxingMode.jsx`) — kamera bazlı yumruk sayımı, raund takibi
2. **Kum Torbası** (`BagWorkMode.jsx`) — SES bazlı darbe sayımı (kamera değil — kamera açısı torba çalışmasında daha kötü, ayrıca ses "onaylanmış darbe" gerçek referansı veriyor)
3. **Sanal Pad Work** (`PadWorkMode.jsx`) — ekranda çıkan hedeflere bilekle tepki verme oyunu
4. **Kaçışlar** (`DodgeMode.jsx`) — baş/burun takibiyle savunma refleks oyunu (slip-left/slip-right/duck)

### Veritabanı (Supabase)
- `journal_entries` tablosu: `three_min_rounds` (int, sadece gölge boksu dolduruyor), `competes` (bool, varsayılan true — kullanıcı bu seansı yarışmaya dahil etmek istemeyebilir ama toplulukta paylaşmak isteyebilir diye ayrı bir toggle)
- `punch_training_samples` tablosu: id, user_id, created_at, source, side, speed, dir_x, dir_y, shoulder_width — RLS ile sadece kendi satırlarını insert/select
- `profiles` tablosu: public SELECT RLS (başkalarının profilini görüntüleme özelliği için)
- Genel RLS kuralı: kullanıcılar sadece kendi verilerini yazabilir, bazı tablolarda public okuma açık

### Özellik Listesi (Tamamlanmış)
- Gölge boksu günlük kaydı (raund sayısı, not, yarışmaya dahil etme toggle'ı)
- Başkalarının profilini görüntüleme (community feed/yorumlarda avatar/isme tıklayınca modal)
- Haftalık AI challenge havuzu (sabit, AI maliyeti yok) + public liderlik tablosu (toplam seans + streak, server-side hesaplanıyor)
- Raund bazlı liderlik tablosu (tamamlanan 3 dakikalık raund sayısı — punch-count yerine, detektör doğruluğundan bağımsız daha adil bir metrik olduğu için)
- Kum Torbası modu (ses bazlı sayım + güven eşikli antrenman verisi toplama)
- Sanal Pad Work modu (4 gerçek-test turu sonrası düzeltilmiş: mirror, dondurulmuş hedef pozisyonu, doğru boyutlu vuruş dairesi, hız eşiği gerektiren vuruş)
- Kaçışlar (Dodge) modu — 3 iterasyon geçirdi: mutlak sabit nokta → mevcut kafa pozisyonuna delta → ekrana sabit bölgeler (son hal, sürüklenme sorunu yok)
- Toplanan yumruk verisinin 3 yerde kullanımı: AI koç bağlamına sol/sağ kol dengesi, profilde haftalık hız trend grafiği, "Güç artışı" rozeti
- One-Euro filter'a geçiş (bilek yumuşatma, jitter güvenliği aynı kalırken pik hız koruması %14-25 daha iyi)

## Aktif/Bekleyen Konular
1. **Gölge boksu overcounting bug'ı (ERTELENDİ)**: Kullanıcı "77 attım 99 saydı" dedi, kroşe/aparkat gibi iki fazlı hareketlerin (windup+snap) yanlışlıkla 2-3 kez sayıldığı şüphesi var. Simülasyon denemesi sonuçsuz kaldı (sentetik model gerçek MediaPipe çıktısını yakalayamadı). Kullanıcı "yok şimdilik kalsın" dedi — ayrı, özel bir debug oturumuna ertelendi.
2. **Maliyet/API harcama denetimi (DURAKLATILDI)**: Kullanıcı $5 yüklemiş, $0.13 kalmış (kendisi + 2-3 test kullanıcısı). Anthropic Console'un Usage/Cost dashboard'undan gerçek dökümü kontrol edilmesi öneriliyor. Zaten inşa edilmiş ama devreye alınmamış `api/_lib/usageLimits.js` var (`FREE_LIMITS={chat:10/gün, plan:1/ay, video:3/ay}`) — kullanıcı bilinçli olarak devreye almayı erteledi. Kullanıcı "dur o kalsın bekle" dedi, konuşma yarıda kesildi.
3. **Coach/gym rozetleri**: "ayrı uzun detaylı" gelecekte konuşulacak, şimdilik ertelendi.
4. **İsim/marka konusu**: ÇÖZÜLDÜ — "The Corner" ismi korunuyor, kod değişikliği gerekmiyor (rakip trainwithcorner.com ile çakışma araştırıldı ama topluluk odağının farklılaştırıcı olduğuna karar verildi).
5. **Sparring partner eşleştirme**: rafa kaldırıldı, gündemde değil.
6. **Freemium/kullanım limiti devreye alma kararı**: henüz verilmedi.

## Son Yapılan İş (Bu devir promptunun hemen öncesinde)
Dodge Mode'da iki gerçek-test bug'ı düzeltildi ve main'e deploy edildi (commit `8ee1ae4` dev'de, `ca44985` main'de):
- Hedef sürüklenme sorunu → ekrana sabit bölgeler + toparlanma molası (`RECOVERY_MS`)
- Sol/Sağ etiketlerinin aynalamadan sonra ters okunması → COPY metinleri swap edildi
- Pad Work'te de aynı bug var mı diye kontrol edildi — YOK, çünkü Pad Work etiketleri ekran pozisyonuna değil hangi elin atılacağına (anatomik) dayanıyor, dokunulmadı.

## Attribution Kuralı
Git commit mesajları şununla bitmeli:
```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```
(Not: bu bir sonraki oturumda farklı bir session ID ile devam edeceği için, yeni oturumda kendi session linkini kullan.)

## Genel Prensip (kullanıcının standing instruction'ı)
Sadece gerçek, doğrulanmış iyileştirmeler yayınla: "daha iyi olacaksa deneyelim ama bozulacaksa kalsın şimdilik." Her algoritma/detection değişikliği canlıya çıkmadan önce Node.js simülasyonuyla doğrulanmalı.
