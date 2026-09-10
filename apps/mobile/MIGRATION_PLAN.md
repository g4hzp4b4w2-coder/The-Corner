# React Native Taşıma Planı — Genel Bakış

Bu dosya, web app'ten React Native'e taşıma işinin üst seviye planını
tutar. Detaylı Faz 0 adımları için `SPIKE.md`'ye bak.

## Repo yapısı kararı

**Tek repo (monorepo), ayrı repo değil.** Gerekçe:
- Supabase şeması, RLS politikaları ve `api/*.js` serverless fonksiyonları
  her iki client için de ortak — tek repoda kalmaları senkron sorunlarını
  önlüyor.
- Paylaşılan saf mantık dosyaları (`liveDetection.js`, `poseMath.js`,
  `oneEuroFilter.js`, vb.) iki client arasında kopya değil, tek kaynaktan
  import edilecek — bu da tek repo gerektiriyor.

**Şu an için** yeni kod sadece `apps/mobile/` altında — web app'in kök
dizindeki (`src/`, `api/`, vb.) hiçbir dosyasına dokunulmadı. Bunun
sebebi: web app üzerinde paralel bir oturum aktif bug-fix yapıyor, kök
dizini yeniden yapılandırmak (dosyaları `apps/web/`'e taşımak gibi) o
oturumla çakışma riski taşır.

`packages/core` (paylaşılan saf mantık paketi) Faz 1'de kuruldu —
platform-bağımsız dosyalar oraya **kopyalandı** (taşınmadı), web app'in
kendi `src/lib/` kopyaları hiç değiştirilmedi. `apps/mobile`, bu pakete npm
workspaces değil `file:../../packages/core` yerel bağımlılığıyla bağlanıyor
— bilinçli bir tercih: workspaces için kök `package.json`'a (web app'in
kendi dosyası) dokunmak gerekirdi, paralel bug-fix oturumuyla çakışma riski
taşırdı. Web app'in bu pakete geçmesi ayrı bir karar, ayrı bir zamanda,
kullanıcıyla koordine edilerek yapılacak.

## Fazlar

- **Faz 0 (tamamlandı)**: Spike gerçek iPhone'da doğrulandı — sonuç olumlu.
  30.5 FPS (kütüphanenin kendi ~15 FPS sınırı kaldırılarak), 2 dakika
  kesintisiz kullanımda çökme/ısınma yok, landmark titremesi düşük. Kütüphane
  fonksiyonel ama hiç sorunsuz değildi — kurulum sırasında 8 ayrı gerçek
  bug/uyumsuzluk çıktı, ikisi native Swift patch'i gerektirdi (`patches/`
  klasörü, kalıcı bakım yükü olarak kabul edildi). Detaylar: `SPIKE.md`
  "Sonuç" bölümü.
- **Faz 1 (tamamlandı)**: `packages/core` kuruldu, 11 saf mantık dosyası
  (`liveDetection`, `poseMath`, `oneEuroFilter`, `audioImpact`,
  `armTracker`, `reactionTracker`, `headTracker`, `reactionTarget`,
  `dodgeTarget`, `punchStats`, `comboTarget`) web'den birebir kopyalandı —
  `comboTarget.js`, kopyalama sırasında henüz yokmuş (web'deki paralel
  oturum sonradan eklemiş, "çağrılan kombinasyon" antrenman modu için),
  sonradan fark edilip eklendi. Tek fark, 4 dosyadaki iç importlara Node'un
  ESM çözümleyicisi için gereken `.js` uzantısı eklendi (Vite/Metro zaten
  gerektirmiyordu). 40 birim/smoke testi (`packages/core`'da `npm test`)
  geçiyor, `apps/mobile`'ın Metro'su
  paketi uçtan uca doğrulanmış şekilde çözümlüyor. `apps/mobile`'ın gerçek
  ekranları henüz bu paketi kullanmıyor — bağlama işi Faz 2/3'te.
- **Faz 2 (tamamlandı)**: Kamera (Faz 0'dan zaten hazırdı), ses yakalama ve
  overlay çizimi native olarak yeniden yazıldı, üçü de gerçek cihazda
  doğrulandı:
  - **Ses**: `expo-audio`'nun `useAudioStream`'i ile gerçek zamanlı PCM mikrofon
    yakalama (`packages/core`'daki `audioImpact.js`'e mobile-only
    `rmsOfFloat32` eklendi). iOS'ta `AVAudioSession` `.measurement` modu
    kullanılıyor, ekstra echo-cancellation/AGC ayarı gerekmedi. Cihazda RMS
    doğru tepki veriyor, çökme yok. Darbe sayma eşiği (hit-detection
    threshold) ayarı bilinçli olarak ertelendi — web'de de var olan bir
    hassasiyet sorunu, taşıma hatası değil.
  - **Overlay**: `@shopify/react-native-skia@2.11.2` ile GPU tabanlı çizim
    (`components/PoseOverlay.tsx`) — iskelet çizgileri + eklem noktaları,
    ayna modu ve rotasyon doğru. Cihazda skeleton render doğrulandı, FPS
    kaybı yok (30-30.5 FPS aynı kaldı).
  - **Bağımlılık çakışması**: Skia'nın "opsiyonel" peer'ı olmasına rağmen
    çalışma zamanında `react-native-reanimated` gerektirdiği görüldü;
    eklendi (`^4.6.0`) ve `react-native-worklets@0.12.2` ile birlikte,
    frame processor'ün kullandığı `react-native-worklets-core` ile yan yana
    (iki bağımsız worklet runtime, ikisi de babel.config.js'de). Bu ekleme
    `expo-modules-core`'un eski bir worklets aralığıyla çakışıp EAS
    build'de tekrarlayan "Install dependencies" / lockfile hatalarına yol
    açtı — `package.json`'da `overrides: { "react-native-worklets":
    "0.12.2" }` ile kalıcı çözüldü, `npm ci --include=dev` ile doğrulandı.
- **Faz 3 (devam ediyor)**: 5 canlı antrenman modu (Gölge Boksu, Kum
  Torbası, Pad Work, Kaçışlar, Combo Drill) tek tek native ekranlara
  taşınır — `packages/core`'daki mod-özel mantık (`dodgeTarget`,
  `reactionTarget`, `comboTarget`, `armTracker` vb.) Faz 2'nin
  kamera/ses/Skia altyapısına bağlanır.
  - Web'in 5 *Mode.jsx dosyası okunup karşılaştırıldı: hepsi aynı
    setup→prep→round→roundEnd→sessionEnd faz makinesini, aynı raund
    sayacı/süresi UI'ını ve aynı günlük-kaydetme akışını birebir
    tekrarlıyor, sadece algılayıcı (detector/tracker) ve overlay çizimi
    moda göre değişiyor. Bu yüzden paylaşılan bir altyapı kuruldu, her mod
    tekrar yazmak yerine ona bağlanıyor:
    - `training/useTrainingSession.ts` — faz makinesi + raund sayacı,
      jenerik (journal kaydetme henüz yok, bkz. aşağı).
    - `hooks/useCameraPose.ts` — Faz 0/2'nin kamera+poz kurulumu, App.tsx
      spike'ından çıkarılıp paylaşılabilir hale getirildi.
    - `lib/landmarkSpace.ts` — kritik bir dönüşüm: kütüphanenin ham
      landmark x/y'si kamera sensörünün (yatay) yönüne göre, ama
      `packages/core`'daki tüm matematik (`poseMath.js` vb.) web'in
      görüntü uzayına (x=yatay, y=dikey, aynalanmamış) göre yazıldı.
      PoseOverlay'in ekranda doğru gösterdiği aynı rotasyon düzeltmesi
      (x/y takası), aynalama OLMADAN burada da uygulanıyor ki
      `packages/core` hiç değişmeden native'de de çalışsın. Overlay için
      doğrulandı (bkz. Faz 2), ama bu matematiğe (omuz genişliği, yumruk
      algılama vb.) etkisi her mod cihazda ilk çalıştırıldığında ayrıca
      doğrulanacak — en riskli varsayım burası.
    - `lib/sound.ts` + `scripts/generate-sounds.js` — web'in
      `gongSound.js`'i Web Audio API ile canlı sentezliyor, React
      Native'de karşılığı yok; aynı ton tasarımı (partials/envelope) bir
      kere WAV dosyasına gömülüp `expo-audio` ile çalınıyor.
    - `components/TrainingCamera.tsx` — kamera kutusu + iskelet overlay,
      moda özel ekstra çizim (hedef reticle vb.) için `children` slotu var.
  - **Gölge Boksu (`screens/ShadowBoxingScreen.tsx`) — cihazda test edildi,
    2 gerçek bug bulunup düzeltildi:**
    - İskelet vücuttan hafif kaymış görünüyordu — sebep, kamera kutusunun
      sabit 320px yükseklikte açılması, telefonun gerçekte çektiği görüntünün
      en-boy oranına uymuyordu; native preview uymayan kutuya "cover" ile
      kırpıp sığdırıyor, ama overlay matematiği hâlâ kırpılmamış tam
      görüntü varsayıyordu. Her poz sonucunun taşıdığı gerçek görüntü
      boyutundan (`inputImageWidth`/`Height`) kutunun doğru oranı artık
      dinamik hesaplanıyor (`useCameraPose`'daki `frameAspectRatio`).
    - 60 gerçek yumrukta 111 sayıldı (~1.85x) — sebep, iki kolun da AYNI
      paylaşılan omuz-genişliği ile normalize edilmesi: bir yumruk atarken
      gövde döner/blade olur, bu da ölçülen omuz genişliğini anlık
      küçültür, bu da HER İKİ kolun normalize hızını birden şişirir —
      atmayan kol da "yumruk" gibi sayılıyordu. `packages/core/src/
      liveDetection.js`'e (yalnızca mobile kopyası — web'in `src/lib/
      liveDetection.js`'i Faz 1'den beri bağımsız, bu değişiklik ona
      dokunmuyor) çapraz-kol bastırma eklendi: iki kol da yakın zamanda
      (250ms içinde) tetiklenirse ve biri diğerinden belirgin daha zayıfsa
      (prominence oranı <0.6), zayıf olan bastırılıyor. Gerçek hızlı 1-2
      kombinasyonunu (iki kol da benzer güçte) YANLIŞLIKLA bastırmadığını
      doğrulayan ayrı bir test de eklendi (`packages/core/test/
      trackers.test.js`, artık 44 test). Kullanıcı yeniden test edecek —
      hem çift sayım düzelmiş mi hem gerçek hızlı kombinasyonlar hâlâ tam
      sayılıyor mu bakılacak.
    - Bu iki bug, `packages/core`'un mobile kopyasının web'in kopyasından
      ilk kez fiilen AYRIŞTIĞI an — Faz 1'de bilinçli olarak "kopya, paylaşım
      değil" kararı verilmişti tam bu yüzden: platforma özgü ayarlar
      (kamera/algılama farkları) gerekebilir, web'i etkilemeden.
    Journal kaydetme (not/yarışma toggle/günlüğe kaydet) ve seed'li detector
    warm-start (`getPunchSampleSummary`/`summarizeSeed`) bilinçli olarak
    atlandı —
    ikisi de Supabase mobile client'ı gerektiriyor, Faz 4'e bırakıldı; bu
    ekran şimdilik sadece lokal bir raund/antrenman özeti gösteriyor. Dil
    desteği de (web'in tr/en `lang` parametresi) şimdilik yok, sadece
    Türkçe.
  - **Sırada**: Kum Torbası, Pad Work, Kaçışlar, Combo Drill — aynı
    `useTrainingSession`/`useCameraPose`/`TrainingCamera` altyapısına
    bağlanacak, her biri kendi `packages/core` modülünü (`audioImpact`+
    `armTracker`, `reactionTarget`+`reactionTracker`, `dodgeTarget`+
    `headTracker`, `comboTarget`+`liveDetection`) kullanacak. Kum Torbası
    ayrıca Faz 2'de doğrulanan mikrofon/RMS altyapısını devreye sokacak;
    Combo Drill ayrıca native TTS (`expo-speech` veya benzeri, henüz
    araştırılmadı) gerektiriyor.
- **Faz 4**: Navigasyon (React Navigation), auth/Supabase client, coach
  chat/plan ekranları, genel UI/NativeWind.
- **Faz 5**: EAS production build, mağaza başvuruları (Apple/Google).

Faz 0 dışındaki fazların detay planı, spike sonuçları netleşmeden
yazılmayacak — sonuçlara göre değişebilir (örn. FPS yetersizse önce
alternatif kütüphane araştırması araya girer).
