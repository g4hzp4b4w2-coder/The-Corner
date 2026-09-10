/**
 * Faz 0/2 spike'ı (kamera + poz algılama + ses + Skia overlay doğrulaması)
 * tamamlandı, sonuçlar SPIKE.md ve MIGRATION_PLAN.md'de. Faz 3'ten
 * itibaren App.tsx artık bir spike ekranı değil, gerçek antrenman
 * modlarının ilkini (Gölge Boksu) render ediyor.
 *
 * Gerçek navigasyon (mod seçim ekranı, React Navigation) Faz 4'te —
 * şimdilik tek mod doğrudan render ediliyor.
 */
import { StatusBar } from 'expo-status-bar';
import { ShadowBoxingScreen } from './screens/ShadowBoxingScreen';

export default function App() {
  return (
    <>
      <ShadowBoxingScreen />
      <StatusBar style="light" />
    </>
  );
}
