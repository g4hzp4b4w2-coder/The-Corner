/**
 * Skia tabanlı poz/iskelet overlay'i — Faz 0'daki basit View-noktaları
 * çizimini değiştiriyor. Web'in 2D canvas çiziminin native karşılığı:
 * gerçek GPU-hızlandırmalı bir Canvas üzerine landmark noktaları +
 * aralarındaki iskelet çizgileri çiziliyor.
 *
 * Reanimated/worklets'e bağımlı değil — landmarks her onResults'ta
 * normal React state olarak güncelleniyor, Canvas her render'da yeniden
 * çiziyor. Bu, 30 FPS'lik poz algılama hızında yeterli (Faz 0'da ölçüldü);
 * ihtiyaç olursa ileride shared value'lara geçilebilir.
 */
import { Canvas, Circle, Line } from '@shopify/react-native-skia';
import { KnownPoseLandmarkConnections } from 'react-native-mediapipe-posedetection';

export type OverlayLandmark = { x: number; y: number; visibility?: number };

type Props = {
  landmarks: OverlayLandmark[];
  width: number;
  height: number;
};

const POINT_COLOR = '#00E676';
const LINE_COLOR = 'rgba(0, 230, 118, 0.6)';
const VISIBILITY_THRESHOLD = 0.5;

// Ekran koordinatına çeviri: kamera overlay'i App.tsx'te x/y eksenleri
// takas edilip yatayda aynalanmış olarak kullanılıyor (bkz. App.tsx'teki
// yorum) — burada da aynı dönüşüm uygulanıyor ki iki katman hizalı kalsın.
function toScreen(lm: OverlayLandmark, width: number, height: number) {
  return { x: (1 - lm.y) * width, y: lm.x * height };
}

export function PoseOverlay({ landmarks, width, height }: Props) {
  if (width <= 0 || height <= 0) return null;

  const points = landmarks.map((lm) => toScreen(lm, width, height));

  return (
    <Canvas style={{ position: 'absolute', width, height }}>
      {KnownPoseLandmarkConnections.map(([a, b], i) => {
        const pa = points[a];
        const pb = points[b];
        if (!pa || !pb) return null;
        const visA = landmarks[a]?.visibility ?? 1;
        const visB = landmarks[b]?.visibility ?? 1;
        if (visA < VISIBILITY_THRESHOLD || visB < VISIBILITY_THRESHOLD) return null;
        return <Line key={`l${i}`} p1={pa} p2={pb} color={LINE_COLOR} strokeWidth={2} />;
      })}
      {points.map((p, i) => {
        const visibility = landmarks[i]?.visibility ?? 1;
        if (visibility < VISIBILITY_THRESHOLD) return null;
        return <Circle key={`p${i}`} cx={p.x} cy={p.y} r={4} color={POINT_COLOR} />;
      })}
    </Canvas>
  );
}
