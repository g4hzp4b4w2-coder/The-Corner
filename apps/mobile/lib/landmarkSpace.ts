// react-native-mediapipe-posedetection's raw landmark x/y are normalized
// against the camera SENSOR's native orientation (landscape), not the
// portrait screen -- PoseOverlay.tsx already corrects for this for
// on-screen drawing by swapping x/y (rotation) and flipping x (mirror,
// selfie-style). packages/core's math (poseMath.js, armTracker.js,
// dodgeTarget.js, reactionTarget.js, headTracker.js) was written against
// web's landmark convention: x = horizontal fraction, y = vertical
// fraction, increasing right/down, in the TRUE (unmirrored) camera frame
// -- exactly matching web's own "detect on the unmirrored frame, mirror
// only for display" pattern (see e.g. ShadowBoxingMode.jsx's startTraining
// comment).
//
// This applies that same rotation fix (x/y swap) WITHOUT the mirror, so
// every packages/core function keeps working unmodified on native. This
// mapping was validated for on-screen drawing (the skeleton overlay is
// correctly positioned/mirrored on a real device, see SPIKE.md).
//
// Device testing of Shadow Boxing (Faz 3) found anatomical left/right is
// swapped: throwing a real right-hand punch gets counted as "left" and
// vice versa. Positions themselves are correct (the overlay tracks the
// body fine) -- only which raw index (15 vs 16 for the wrists, and every
// other bilateral pair) the model calls "left" vs "right" is flipped,
// most likely because the front camera's raw buffer reaching the model is
// itself mirror-oriented (a `mirrorMode` option exists on the library, but
// tracing its usePoseDetection source shows it's only consumed by the
// higher-level MediapipeCamera convenience component we don't use here --
// our raw frameProcessor path never reads it, so it has no effect either
// way). Rather than depend on root-causing that, every bilateral landmark
// pair is relabeled here to match what packages/core expects -- this only
// swaps WHICH index holds which landmark's data, never its x/y value, so
// it's independent of whatever the underlying native cause turns out to
// be.
export interface RawLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface DetectionLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

// MediaPipe's 33-point pose topology, bilateral pairs only (see
// react-native-mediapipe-posedetection's KnownPoseLandmarks). Index 0
// (nose) and the unpaired indices in between are left as identity.
const LEFT_RIGHT_SWAP: number[] = (() => {
  const swap = Array.from({ length: 33 }, (_, i) => i);
  const pairs: [number, number][] = [
    [1, 4], // eye inner
    [2, 5], // eye
    [3, 6], // eye outer
    [7, 8], // ear
    [9, 10], // mouth
    [11, 12], // shoulder
    [13, 14], // elbow
    [15, 16], // wrist
    [17, 18], // pinky
    [19, 20], // index finger
    [21, 22], // thumb
    [23, 24], // hip
    [25, 26], // knee
    [27, 28], // ankle
    [29, 30], // heel
    [31, 32], // foot index
  ];
  for (const [a, b] of pairs) {
    swap[a] = b;
    swap[b] = a;
  }
  return swap;
})();

export function toDetectionSpace(raw: RawLandmark[]): DetectionLandmark[] {
  const out: DetectionLandmark[] = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const lm = raw[i];
    if (!lm) continue;
    out[LEFT_RIGHT_SWAP[i] ?? i] = { x: lm.y, y: lm.x, z: lm.z, visibility: lm.visibility };
  }
  return out;
}
