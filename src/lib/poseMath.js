// Small shared geometry helpers used by both the live punch detector and
// the calibration analysis, so the two always measure things the exact
// same way — calibration's numbers only mean anything to the detector if
// they were computed with identical math.

export const NOSE = 0;
export const SHOULDER = { left: 11, right: 12 };
export const WRIST = { left: 15, right: 16 };

// Loosened from MediaPipe's implicit default — its confidence on a
// fast-moving, motion-blurred wrist (exactly the moment we care about)
// often dips, and dropping the frame there throws away real punches.
export const MIN_VISIBILITY = 0.4;

export function visible(p) {
  return !!p && (p.visibility === undefined || p.visibility >= MIN_VISIBILITY);
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Refreshed only when both shoulders are confidently visible, so a
// momentarily-occluded shoulder (crossed in front of the body mid-punch)
// doesn't stall scale normalization — callers keep passing back the last
// good value as `fallback`.
export function shoulderWidthOf(landmarks, fallback) {
  if (!landmarks) return fallback;
  const l = landmarks[SHOULDER.left];
  const r = landmarks[SHOULDER.right];
  if (visible(l) && visible(r)) return dist(l, r) || fallback;
  return fallback;
}

// Wrist position relative to this arm's own shoulder, normalized by
// shoulder width. Tracking it this way (instead of raw camera-frame
// position) cancels out whole-body movement — footwork, bouncing,
// weaving, walking toward the camera — which would otherwise look like
// fast "wrist speed" on its own.
export function relWrist(landmarks, side, shoulderWidth) {
  if (!landmarks) return null;
  const wr = landmarks[WRIST[side]];
  const sh = landmarks[SHOULDER[side]];
  if (!visible(wr) || !visible(sh)) return null;
  return { x: (wr.x - sh.x) / shoulderWidth, y: (wr.y - sh.y) / shoulderWidth };
}
