// Single-point (head) version of reactionTracker.js's per-arm tracker —
// same One-Euro-smoothed position + short rolling speed window, just for
// relNose instead of relWrist. Kept separate rather than generalizing
// reactionTracker.js into an arbitrary-multi-point tracker: the shapes
// are different enough (one point vs. two named arms) that forcing them
// through one abstraction right now would be speculative generality for
// a second use case we don't have yet.

import { relNose, shoulderWidthOf } from "./poseMath";
import { createOneEuroFilter2D } from "./oneEuroFilter";

const MIN_SHOULDER_WIDTH_RATIO = 0.75;
const SPEED_WINDOW_MS = 300;

export function createHeadTracker() {
  const smooth = createOneEuroFilter2D({ minCutoff: 1.5, beta: 0.7 });
  let rel = null;
  let prevRel = null;
  let prevT = null;
  let history = [];
  let shoulderWidth = 0.2;
  let maxShoulderWidth = 0;

  function update(landmarks, t) {
    if (!landmarks) return;
    shoulderWidth = shoulderWidthOf(landmarks, shoulderWidth);
    maxShoulderWidth = Math.max(maxShoulderWidth, shoulderWidth);
    const effectiveShoulderWidth = Math.max(shoulderWidth, maxShoulderWidth * MIN_SHOULDER_WIDTH_RATIO);

    const rawRel = relNose(landmarks, effectiveShoulderWidth);
    if (!rawRel) return;
    const smoothed = smooth(rawRel, t);
    if (prevRel && prevT != null) {
      const dt = (t - prevT) / 1000;
      if (dt > 0) {
        const speed = Math.hypot(smoothed.x - prevRel.x, smoothed.y - prevRel.y) / dt;
        history.push({ t, speed });
        while (history.length && t - history[0].t > SPEED_WINDOW_MS) history.shift();
      }
    }
    rel = smoothed;
    prevRel = smoothed;
    prevT = t;
  }

  function getRel() {
    return rel;
  }

  function getShoulderWidth() {
    return Math.max(shoulderWidth, maxShoulderWidth * MIN_SHOULDER_WIDTH_RATIO);
  }

  function getRecentPeakSpeed() {
    let peak = 0;
    for (const s of history) if (s.speed > peak) peak = s.speed;
    return peak;
  }

  return { update, getRel, getShoulderWidth, getRecentPeakSpeed };
}
