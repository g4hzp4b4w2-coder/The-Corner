/**
 * FAZ 0 SPIKE — "The Corner" için react-native-mediapipe-posedetection doğrulaması.
 *
 * Amaç: Ürün kodu değil. Sadece şunu ölçmek için:
 *   1) Kurulum/New Architecture sorunsuz çalışıyor mu?
 *   2) Gerçek FPS ve gecikme (hızlı yumruk yakalar mı)?
 *   3) Landmark kalitesi web MediaPipe'a kıyasla nasıl?
 *
 * Ekranda: canlı kamera + 33 landmark noktası overlay + ölçülen FPS / son
 * inference süresi. Bu bir Expo Go uygulaması DEĞİLDİR — native modül
 * içerdiği için `eas build --profile development` ile bir development
 * build kurup çalıştırman gerekiyor. Adımlar için apps/mobile/SPIKE.md.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Button, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import {
  usePoseDetection,
  RunningMode,
  Delegate,
} from 'react-native-mediapipe-posedetection';

const MODEL_FILE = 'pose_landmarker_lite.task';

export default function App() {
  const { width, height } = useWindowDimensions();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  const [landmarks, setLandmarks] = useState<{ x: number; y: number; visibility?: number }[]>([]);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const [measuredFps, setMeasuredFps] = useState(0);

  const resultTimestamps = useRef<number[]>([]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const onResults = useCallback((result: any) => {
    const now = Date.now();
    resultTimestamps.current.push(now);
    resultTimestamps.current = resultTimestamps.current.filter((t) => now - t <= 2000);
    setMeasuredFps(resultTimestamps.current.length / 2);

    setInferenceMs(result.inferenceTime ?? null);
    setLandmarks(result.landmarks?.[0] ?? []);
  }, []);

  const poseDetection = usePoseDetection(
    {
      onResults,
      onError: (error) => console.error('[spike] pose detection error:', error?.message ?? error),
    },
    RunningMode.LIVE_STREAM,
    MODEL_FILE,
    {
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      delegate: Delegate.GPU,
      mirrorMode: 'mirror-front-only',
    },
  );

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Spike için kamera izni gerekiyor.</Text>
        <Button title="İzin ver" onPress={requestPermission} />
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Ön kamera bulunamadı.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={poseDetection.frameProcessor}
        onLayout={poseDetection.cameraViewLayoutChangeHandler}
      />

      {/* Landmark overlay — normalize (0-1) koordinatları ekran boyutuna çeviriyor */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {landmarks.map((lm, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                left: lm.x * width - 4,
                top: lm.y * height - 4,
                opacity: (lm.visibility ?? 1) > 0.5 ? 1 : 0.25,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.hud}>
        <Text style={styles.hudText}>Ölçülen FPS: {measuredFps.toFixed(1)}</Text>
        <Text style={styles.hudText}>
          Inference: {inferenceMs !== null ? `${inferenceMs.toFixed(1)} ms` : '—'}
        </Text>
        <Text style={styles.hudText}>Landmark sayısı: {landmarks.length}</Text>
      </View>

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#000',
  },
  text: { color: '#fff', fontSize: 16, textAlign: 'center' },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
  },
  hud: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  hudText: { color: '#fff', fontSize: 14, fontFamily: 'monospace' },
});
