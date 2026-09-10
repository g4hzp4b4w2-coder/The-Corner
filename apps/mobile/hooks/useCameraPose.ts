// Shared camera + pose detection wiring, extracted from the Faz 0/2 spike
// (App.tsx) so every training mode screen can reuse the same validated
// setup instead of re-deriving it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { usePoseDetection, RunningMode, Delegate } from 'react-native-mediapipe-posedetection';
import { toDetectionSpace, type DetectionLandmark, type RawLandmark } from '../lib/landmarkSpace';

const MODEL_FILE = 'pose_landmarker_lite.task';

export type OnPoseFrame = (landmarks: DetectionLandmark[], raw: RawLandmark[], now: number) => void;

// onFrame is read from a ref (not a usePoseDetection dependency) so a
// caller passing a new closure every render doesn't churn the underlying
// native pose detector -- only the camera device/permission bookkeeping
// and the landmarks-for-overlay state are ordinary React state here.
export function useCameraPose(onFrame?: OnPoseFrame) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const [rawLandmarks, setRawLandmarks] = useState<RawLandmark[]>([]);
  // The actual captured frame's aspect ratio (portrait, width/height),
  // derived from every result's inputImageWidth/inputImageHeight -- these
  // come back in the SENSOR's (landscape) orientation, same as raw
  // landmark x/y, so the same swap applies: portrait width = image
  // height, portrait height = image width. Used to size the on-screen
  // camera box so it shows the exact frame the landmarks were computed
  // against, with no cropping -- a box with a different aspect ratio than
  // the real frame gets "cover" cropped by the native preview, which
  // silently shifts everything the overlay draws relative to what's
  // visible without changing the underlying landmark math at all.
  const [frameAspectRatio, setFrameAspectRatio] = useState<number | null>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const onResults = useCallback((result: any) => {
    // NOT result.landmarks -- see App.tsx history / SPIKE.md: the actual
    // native bridge sends { results: [{ landmarks: [[<33 points>], ...] }] }.
    const raw: RawLandmark[] = result.results?.[0]?.landmarks?.[0] ?? [];
    setRawLandmarks(raw);
    const w = result.inputImageWidth;
    const h = result.inputImageHeight;
    if (w > 0 && h > 0) {
      const portraitAspect = h / w;
      setFrameAspectRatio((prev) => (prev != null && Math.abs(prev - portraitAspect) < 0.01 ? prev : portraitAspect));
    }
    if (onFrameRef.current) {
      onFrameRef.current(toDetectionSpace(raw), raw, Date.now());
    }
  }, []);

  const poseDetection = usePoseDetection(
    {
      onResults,
      onError: (error: any) => console.error('[useCameraPose] pose detection error:', error?.message ?? error),
    },
    RunningMode.LIVE_STREAM,
    MODEL_FILE,
    {
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      delegate: Delegate.GPU,
      // Mirroring is handled manually on the display side (PoseOverlay),
      // never by the library, so it can't disagree with our own transform.
      mirrorMode: 'no-mirror',
    },
  );

  return {
    hasPermission,
    requestPermission,
    device,
    rawLandmarks,
    frameAspectRatio,
    frameProcessor: poseDetection.frameProcessor,
    cameraViewLayoutChangeHandler: poseDetection.cameraViewLayoutChangeHandler,
  };
}
