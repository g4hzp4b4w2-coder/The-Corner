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
- **Faz 1 (tamamlandı)**: `packages/core` kuruldu, 10 saf mantık dosyası
  (`liveDetection`, `poseMath`, `oneEuroFilter`, `audioImpact`,
  `armTracker`, `reactionTracker`, `headTracker`, `reactionTarget`,
  `dodgeTarget`, `punchStats`) web'den birebir kopyalandı — tek fark, 4
  dosyadaki iç importlara Node'un ESM çözümleyicisi için gereken `.js`
  uzantısı eklendi (Vite/Metro zaten gerektirmiyordu). 36 birim/smoke testi
  (`packages/core`'da `npm test`) geçiyor, `apps/mobile`'ın Metro'su
  paketi uçtan uca doğrulanmış şekilde çözümlüyor. `apps/mobile`'ın gerçek
  ekranları henüz bu paketi kullanmıyor — bağlama işi Faz 2/3'te.
- **Faz 2 (sırada)**: Kamera + ses yakalama, canvas/overlay çizimi native olarak
  yeniden yazılır (VisionCamera + Skia).
- **Faz 3**: 4 canlı antrenman modu (Gölge Boksu, Kum Torbası, Pad Work,
  Kaçışlar) tek tek native ekranlara taşınır.
- **Faz 4**: Navigasyon (React Navigation), auth/Supabase client, coach
  chat/plan ekranları, genel UI/NativeWind.
- **Faz 5**: EAS production build, mağaza başvuruları (Apple/Google).

Faz 0 dışındaki fazların detay planı, spike sonuçları netleşmeden
yazılmayacak — sonuçlara göre değişebilir (örn. FPS yetersizse önce
alternatif kütüphane araştırması araya girer).
