# Faz 0 Spike — Native Poz Algılama Doğrulaması

## Amaç

Büyük taşımaya (Faz 1+) başlamadan önce, tek gerçek riski gerçek bir cihazda
doğrulamak: **react-native-mediapipe-posedetection** kütüphanesi bizim hızlı
yumruk/kombinasyon senaryomuz için yeterli mi?

Bu paket 28 yıldızlı, tek geliştiricili, Google'ın resmi paketi değil ve
çökmeyi önlemek için ~15 FPS'e kendini otomatik sınırlıyor. Web tarafında
MediaPipe WASM ile muhtemelen daha yüksek FPS alıyorduk — bu düşüş gerçek bir
üründe fark edilir mi, edilmez mi, bunu sadece elde tutup deneyerek anlarız.

## Bu spike'ta ne var

`apps/mobile/` — minimal bir Expo (SDK 57, New Architecture varsayılan)
projesi:

- Ön kamera açık, `usePoseDetection` hook'u ile canlı 33 landmark
- Landmark'lar ekranda yeşil noktalar olarak overlay ediliyor
- Üstte HUD: **ölçülen FPS** (son 2 saniyedeki `onResults` çağrı sıklığı) ve
  **son inference süresi** (`result.inferenceTime`, ms)
- Model: `pose_landmarker_lite.task` (Google'ın resmi CDN'inden indirildi,
  `assets/models/` altında, `app.json`'daki config plugin ile native tarafa
  otomatik kopyalanıyor)

Bu bir ürün ekranı değil — sadece ölçüm amaçlı, dokunma önerilmiyor.

## Kurulumda karşılaşılan ve çözülen bir sorun (bilgi amaçlı)

Kütüphanenin `README`'si `react-native-vision-camera` için sadece `*`
(herhangi bir sürüm) yazıyor, ama örnek kodu ve `frameProcessor` prop'u
**vision-camera v4** API'sine ait. Vision-camera'nın güncel majör sürümü
**v5** ise `frameProcessor` prop'unu tamamen kaldırıp yerine yeni bir
Nitro-tabanlı API getirmiş — v5 ile bu paket tip hatası veriyor ve muhtemelen
çalışmıyor. Bu yüzden `apps/mobile/package.json`'da bilinçli olarak
`react-native-vision-camera` **v4.7.3**'e sabitlendi (caret `^4.7.3`, 5.x'e
atlamaz). Bu, paketin bakım durumu hakkında ayrı bir risk sinyali: peer
dependency'sini kendi majör sürümünde bile takip etmiyor.

## Karar kriterleri (spike sonunda cevaplanacak 3 soru)

1. **Kurulum**: New Architecture, EAS development build, model dosyası
   yükleme sorunsuz mu, yoksa saatler süren native tarafta debug mı
   gerekiyor?
2. **FPS / gecikme**: Ölçülen FPS gerçekten ~15 civarında mı? Hızlı bir
   düz yumruk (jab) atıldığında HUD'daki nokta hareketi gözle görülür şekilde
   gecikiyor/atlıyor mu, yoksa akıcı mı hissettiriyor?
3. **Landmark kalitesi**: Bilek/omuz noktaları web MediaPipe'a kıyasla ne
   kadar titrek/gürültülü? (Web tarafında bunun için zaten One-Euro filter
   kullanıyoruz — orada da gürültü vardı, oranı karşılaştır.)

**Eğer (2) veya (3) yetersiz çıkarsa**, sıradaki denenecek alternatifler:
- Google'ın resmi **ML Kit Pose Detection** SDK'sı (VisionCamera v4 frame
  processor ile) — daha olgun, ama landmark seti MediaPipe'dan daha kısıtlı
  olabilir, doğrulanmalı.
- `react-native-fast-tflite` + ham BlazePose TFLite modeli ile kendi
  entegrasyonumuz — en çok kontrol ama en çok iş.

## Sonuç (gerçek cihazda test edildi — iPhone, iOS)

**Üçü de olumlu, ama (1) hiç kolay olmadı.**

1. **Kurulum**: Çalışıyor, ama "saatler süren native debug" tam olarak
   gerçekleşti — sırayla bulunup düzeltilen gerçek sorunlar:
   - `react-native-vision-camera` v5 ile bu kütüphane uyumsuz (v4.7.3'e
     sabitlendi — README'de bu kısıtlama hiç yazmıyor).
   - `babel-preset-expo` paketi `package.json`'da eksikti (Expo'nun kendi iç
     klasöründe gizli kalıyordu, hoist edilmemiş).
   - `react-native-worklets-core`'un babel eklentisi 5 tane Babel plugin'i
     kullanıyor ama hiçbirini kendi bağımlılığı olarak beyan etmiyor.
   - **Native (Swift) tarafta ciddi bir hata yutma sorunu**: dedektör kurulumu
     gerçekten başarısız olsa bile hata sadece Xcode konsoluna yazdırılıyor,
     JS'e hiç iletilmiyor — `createDetector`'ın JS promise'i her zaman
     "başarılı" dönüyordu. `patch-package` ile düzeltildi (bkz.
     `patches/react-native-mediapipe-posedetection+0.4.0.patch`).
   - VisionCamera'nın varsayılan kamera formatı (YUV), MediaPipe'ın beklediği
     format (BGRA) ile uyuşmuyordu — `pixelFormat="rgb"` ile çözüldü.
   - **README'nin belgelediği sonuç yapısı yanlış**: `result.landmarks`
     diye dokümante edilmiş ama native kod gerçekte
     `result.results[0].landmarks[0]` gönderiyor. Bu yüzden uzun süre model
     çalışıyor sanılıp "0 landmark" hatası kovalandı — aslında hep doğru
     çalışıyordu, yanlış alan okunuyordu.
   - Ekrana çizim için x/y eksenini elle takas etmek ve aynalamayı kendi
     kodumuzda yapmak gerekti (kütüphanenin kendi koordinat/mirror mantığı
     bizim kurulumumuzla uyuşmadı).
   - Kütüphane kendi içinde ~15 FPS'lik bir sınırı native Swift'te sabit
     kodlamış (JS'ten değiştirilemez) — `patch-package` ile kaldırıldı.

   Sonuç: **8 farklı gerçek bug/uyumsuzluk** art arda çıktı, ikisi native
   Swift patch'i gerektirdi. Bu, "28 yıldızlı tek geliştiricili paket" riskinin
   gerçek olduğunun kanıtı — kütüphane iş görüyor ama hiç "kur ve çalıştır"
   değil, her adımda kaynak koduna inmek gerekti.

2. **FPS / gecikme**: Kütüphanenin kendi ~15 FPS sınırı kaldırılınca (GPU
   delegate ile) **30.5 FPS**, 2 dakika kesintisiz kullanımda çökme, ısınma ya
   da yavaşlama olmadan. Hızlı yumruk takibi için fazlasıyla yeterli bir hız.
3. **Landmark kalitesi**: Sabit dururken bilek noktası neredeyse hiç
   titremiyor — iyi sinyal.

**Önemli çekince**: 30 FPS'i, kütüphanenin "çökmeyi önlemek için" koyduğu
güvenlik sınırını kaldırarak aldık. 2 dakikalık test temiz geçti ama gerçek
bir antrenman seansı (10-20+ dakika, telefon ısınmış, arka planda başka şeyler
açıkken) aynı kararlılığı gösterir mi, henüz bilmiyoruz — Faz 1/2'de daha
uzun süreli testlerle doğrulanmalı.

**Öneri**: Bu kütüphaneyle devam etmek mantıklı — fonksiyonel olarak çalışıyor
ve performansı iyi. Ama iki native patch'i (`patches/` klasörü, `postinstall`
ile otomatik uygulanıyor) kalıcı bir bakım yükü olarak kabul etmemiz gerekiyor;
kütüphane güncellendiğinde bu patch'lerin tekrar uyup uymadığını kontrol
etmemiz gerekecek. ML Kit alternatifini şimdilik araştırmaya gerek yok.

## Adım adım — senin yapman gerekenler

Ben (Claude) bu ortamda gerçek telefon donanımına erişemiyorum; kamera/model
testini SEN gerçek cihazında yapacaksın. Kod hazır, sıradaki adımlar:

### 1. Expo hesabı aç
- https://expo.dev adresinden ücretsiz bir hesap oluştur.
- Bilgisayarında (yerelde, bu oturumda değil): `npm install -g eas-cli`
  ardından `eas login`.

### 2. Projeyi kendi ortamına çek
Bu branch (`claude/adoring-meitner-lw5guy`) push edildikten sonra:
```bash
git clone <repo-url> the-corner
cd the-corner
git checkout claude/adoring-meitner-lw5guy
cd apps/mobile
npm install
```

### 3. EAS projesini bağla
```bash
eas init
```
Bu, `app.json`'a bir `extra.eas.projectId` ekleyecek — bunu commit'le.

### 4. Development build oluştur (Mac gerekmiyor, EAS bulutta derliyor)
Android (daha hızlı, ücretsiz Google Play hesabı bile gerekmez, APK direkt
telefona kurulur):
```bash
eas build --profile development --platform android
```
iOS için (Apple Developer hesabı — $99/yıl — gerekiyor, cihazını
kaydetmen lazım):
```bash
eas device:create   # telefonunu kaydet (QR kod ile)
eas build --profile development --platform ios
```

### 5. Build'i telefona kur
Build bitince EAS sana bir indirme linki/QR kod verecek. Android'de direkt
APK kurulumu; iOS'ta cihazın kayıtlıysa direkt kurulum linki.

### 6. Metro'yu başlat ve development build'e bağlan
```bash
npx expo start --dev-client
```
Telefondaki development build uygulamasını aç, QR kodu tara (ya da aynı
ağdaysa otomatik bağlanır).

### 7. Test et ve gözlemlerini bana bildir
- Kamera izni verince ön kamera görüntüsü + yeşil landmark noktaları
  görünüyor mu?
- HUD'daki "Ölçülen FPS" değeri kaç civarında oturuyor?
- Hızlı bir jab/cross atarken bilek noktası akıcı mı takip ediyor, yoksa
  belirgin şekilde geç mi kalıyor / atlıyor mu?
- Herhangi bir çökme, kırmızı hata ekranı, ya da "TurboModule is not
  available" gibi bir hata aldın mı?
- (Varsa) ekran kaydı/video atarsan gecikmeyi birlikte değerlendirebiliriz.

Bu geri bildirimle birlikte 3 karar kriterine karar verip Faz 1'e (asıl
taşıma) geçeceğiz ya da alternatif kütüphaneye döneceğiz.
