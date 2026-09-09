# YENİ OTURUM PROMPTU — "The Corner" Web App'ini React Native'e Taşıma

Ben "The Corner" adında gerçek (mockup değil) bir boks antrenman uygulaması geliştiriyorum. Şu ana kadar React + Vite tabanlı bir web/PWA olarak geliştirdim, şimdi bunu **React Native (Expo) tabanlı native bir mobil uygulamaya** taşımak istiyorum. Bu oturumun görevi bu taşıma işini yürütmek. Web app'in kendisiyle ilgili günlük bug-fix işleri BAŞKA bir oturumda paralel devam ediyor — bu ikisini karıştırma, sen sadece native taşıma işine odaklan.

## Mevcut Web App (taşınacak kaynak proje)
- GitHub: `g4hzp4b4w2-coder/the-corner`, branch: `claude/react-vite-setup-mx144l`
- Stack: React 19 + Vite + Tailwind v4, Supabase (Postgres+RLS+Auth), Anthropic Claude API (coach chat/plan/haber), Vercel serverless functions (`api/*.js`), MediaPipe Pose Landmarker (web/WASM, `@mediapipe/tasks-vision`)
- Canlı antrenman modları: Gölge Boksu, Kum Torbası (ses tabanlı), Sanal Pad Work, Kaçışlar (Dodge) — hepsi kamera + MediaPipe pose tracking kullanıyor
- **Bu web projesine DOKUNMA** — sadece referans/kaynak olarak inceleyeceksin, kod değişikliği başka bir oturumda yapılıyor.

## Neden React Native (zaten karar verildi, tekrar tartışmaya açma)
- Kullanıcının (benim) yanımda başka yazılımcı yok, tek başımıza yürütüyoruz — React/JS bilgisi zaten var, native öğrenme eğrisi istemiyoruz
- Acele yok, yatırım yapılabilir, "mükemmel çalışsın" hedefi var — bu yüzden Capacitor gibi WebView-sarmalama değil, gerçek native performans (özellikle kamera+poz algılama için) hedefleniyor
- MediaPipe'ın resmi native (Android/iOS) SDK'ları var — aynı model (Pose Landmarker/BlazePose), web/WASM yerine native üzerinden çalıştırılacak
- **Mac gerekmiyor** — Expo'nun EAS Build servisi iOS derlemelerini bulutta yapıyor
- Maliyet düşük: Apple Developer $99/yıl, Google Play $25 tek seferlik, EAS Build ücretsiz tier'ı (ayda 15+15 build) geliştirme için yeterli

## Platform bağımsız olan kod (aynen taşınacak, DOM'a hiç dokunmuyor)
Şu dosyalar saf JS fonksiyonları — landmark/sayı alıp landmark/sayı üretiyorlar, canvas/DOM/getUserMedia'ya hiç dokunmuyorlar. Web repo'sundan birebir kopyalanabilir:
- `src/lib/liveDetection.js` (adaptif yumruk detektörü, `createPunchDetector(seed)`)
- `src/lib/poseMath.js` (landmark index sabitleri: `NOSE=0`, `SHOULDER={left:11,right:12}`, `WRIST={left:15,right:16}`, `relWrist`, `relNose`, `shoulderWidthOf`, `visible`, `dist`)
- `src/lib/oneEuroFilter.js` (One-Euro filter, bilek/baş yumuşatma)
- `src/lib/audioImpact.js` (kum torbası ses tabanlı darbe algılama — dikkat: mikrofon `getUserMedia` çağrısında `echoCancellation:false, noiseSuppression:false, autoGainControl:false` şart, yoksa gerçek darbe sinyali bastırılıyor — bu web tarafında yakın zamanda düzeltilen bir bug'dı, RN'in kendi ses API'sinde de aynı probleme dikkat)
- `src/lib/armTracker.js`, `src/lib/reactionTracker.js`, `src/lib/headTracker.js` (kol/baş takip yardımcıları)
- `src/lib/reactionTarget.js` (Pad Work hedef motoru), `src/lib/dodgeTarget.js` (Dodge Mode — ekrana sabit bölgeler, `DODGE_ZONES`/`isInZone`)
- `src/lib/punchStats.js` (istatistik özetleri)

## Yeniden yazılması gereken kısımlar
- Kamera yakalama (`getUserMedia` → `react-native-vision-camera`)
- Ses yakalama (Web Audio API → RN'in ses API'si, aynı echo-cancellation/AGC/noise-suppression kapatma dikkati geçerli)
- Canvas çizimi / overlay (2D context → Skia ya da VisionCamera'nın frame processor çizim katmanı)
- UI bileşenleri ve stil (Tailwind → NativeWind ya da benzeri)
- Navigasyon (React Router yoktu zaten, tab bazlı basit yapı — React Navigation ile yeniden kurulacak)

## Değişmeyen (backend, hiç dokunulmuyor)
Supabase şeması/RLS/auth, Vercel `api/*.js` serverless fonksiyonları (coach-chat, coach-plan, match-news), Anthropic entegrasyonu — bunlar sadece HTTP endpoint, hangi client'tan çağrıldığı önemli değil, aynen kullanılacak.

## EN KRİTİK RİSK — önce bunu doğrula (Faz 0 spike)
Poz algılamayı native'de çalıştırmanın tek "hazır" yolu şu an **react-native-mediapipe-posedetection** (VisionCamera + react-native-worklets-core üzerinden, GPU hızlandırmalı, 33 landmark, MediaPipe'ın web versiyonuyla aynı topoloji). AMA dürüst ol: bu **28 yıldızlı, tek geliştiricili, küçük bir paket** — Google'ın resmi paketi değil, New Architecture (Turbo Modules) şart, ve çökmeyi önlemek için **otomatik olarak ~15 FPS'e kendini sınırlıyor**. Bizim hızlı yumruk/kombinasyon senaryolarımız için bu FPS sınırı yetersiz kalabilir.

**Yapılacak ilk iş**: Tüm projeyi bu kütüphaneye bağlamadan önce, minimal bir Expo projesi kurup gerçek bir telefonda (benim elimde olacak, sen test edeceksin) kamerayı açıp landmark'ları ekrana basan bir spike yap. Şunları doğrula:
1. Gerçekten çalışıyor mu (kurulum, New Architecture gereksinimleri sorunsuz mu)?
2. Gerçek FPS ve gecikme ne durumda — hızlı yumruk hareketini yakalayacak kadar mı?
3. Landmark kalitesi/gürültüsü web MediaPipe'a kıyasla nasıl?

Eğer bu kütüphane yetersiz çıkarsa, alternatifler (araştırılacak/denenecek): Google'ın resmi ML Kit Pose Detection SDK'sı (VisionCamera frame processor ile), ya da `react-native-fast-tflite` + ham bir BlazePose TFLite modeliyle kendi entegrasyonumuzu yazmak.

## Proje yapısı önerisi
Monorepo öneriyorum: `/apps/mobile` (yeni Expo/RN projesi) + paylaşılan saf mantık dosyaları için ortak bir paket (`/packages/core` gibi) — yukarıdaki "platform bağımsız" dosyalar oraya taşınır, hem web hem mobile ondan import eder. Bunu nasıl kuracağını (aynı repo içinde mi, ayrı repo mu) ilk adımda netleştir.

## İş bölümü (tek başımızayız, yazılımcı yok)
- **Sen (Claude)**: neredeyse tüm kodu yazacaksın — RN ekranları, native modül entegrasyonu, algoritma taşıma
- **Ben (kullanıcı)**: Expo/Apple Developer/Google Play hesaplarını açacağım (kimlik/ödeme bilgisi gerektiriyor), EAS build komutlarını çalıştırıp kendi telefonuma kuracağım, kamera/mikrofon gerektiren özellikleri gerçek cihazda test edip sana "şöyle oldu" diye bildireceğim (sen bu ortamda gerçek telefon donanımına erişemiyorsun), mağaza başvuru formlarını (gizlilik politikası vb.) dolduracağım

## İlk adım
Faz 0 spike'ı planla ve bana adım adım ne yapmam gerektiğini (Expo hesabı açma, `npx create-expo-app` vb.) söyle. Büyük taşımaya başlamadan önce bu doğrulanmalı.
