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
// correctly positioned/mirrored on a real device, see SPIKE.md) but not
// yet independently re-verified against packages/core's geometry (shoulder
// width, wrist-relative-position, guard-drop) -- that only happens once a
// mode actually runs on-device, per mode as it's ported in Faz 3.
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

export function toDetectionSpace(raw: RawLandmark[]): DetectionLandmark[] {
  return raw.map((lm) => ({ x: lm.y, y: lm.x, z: lm.z, visibility: lm.visibility }));
}
