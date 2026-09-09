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

`packages/core` (paylaşılan saf mantık paketi) Faz 1'de, spike
onaylandıktan ve web tarafındaki paralel iş bir kesişim noktasında
durduğunda kurulacak — o zaman platform-bağımsız dosyalar oraya
**kopyalanacak** (taşınmayacak), web app'in importları ayrı bir adımda,
kullanıcıyla koordine edilerek güncellenecek.

## Fazlar

- **Faz 0 (şimdi)**: Spike — bu PR/branch. Kod hazır, doğrulama kullanıcıda.
- **Faz 1**: Spike onaylanırsa → `packages/core` kur, saf mantık
  dosyalarını kopyala, birim testleriyle doğrula (davranış web ile birebir
  aynı kalmalı).
- **Faz 2**: Kamera + ses yakalama, canvas/overlay çizimi native olarak
  yeniden yazılır (VisionCamera + Skia).
- **Faz 3**: 4 canlı antrenman modu (Gölge Boksu, Kum Torbası, Pad Work,
  Kaçışlar) tek tek native ekranlara taşınır.
- **Faz 4**: Navigasyon (React Navigation), auth/Supabase client, coach
  chat/plan ekranları, genel UI/NativeWind.
- **Faz 5**: EAS production build, mağaza başvuruları (Apple/Google).

Faz 0 dışındaki fazların detay planı, spike sonuçları netleşmeden
yazılmayacak — sonuçlara göre değişebilir (örn. FPS yetersizse önce
alternatif kütüphane araştırması araya girer).
