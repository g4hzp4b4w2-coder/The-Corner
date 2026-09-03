// Per-arm position + recent-speed tracker for the "reach target" mechanic
// (reactionTarget.js) — separate from armTracker.js's bag-work-specific
// confidence snapshotting, because here we need the arm's LIVE current
// position every frame (to draw/check against) plus a short rolling
// window of its speed, not a single best-guess sample at a confirmed
// impact. Position smoothing reuses the same One-Euro filter as the
// vision punch detector (liveDetection.js) for a consistent feel.

import { relWrist, shoulderWidthOf } from "./poseMath";
import { createOneEuroFilter2D } from "./oneEuroFilter";

const MIN_SHOULDER_WIDTH_RATIO = 0.75;
// How far back to look for "was this arm actually moving fast" — a real
// punch decelerates as it arrives at full extension, so checking only the
// instantaneous speed the exact frame the wrist enters the target zone
// would systematically miss real punches right when they land. Looking
// at the peak over a short trailing window catches the swing itself
// instead of just its last, slowest instant.
const SPEED_WINDOW_MS = 300;

function initArm() {
  return { smooth: createOneEuroFilter2D({ minCutoff: 1.5, beta: 0.7 }), rel: null, prevRel: null, prevT: null, history: [] };
}

export function createReactionTracker() {
  const arms = { left: initArm(), right: initArm() };
  let shoulderWidth = 0.2;
  let maxShoulderWidth = 0;

  function update(landmarks, t) {
    if (!landmarks) return;
    shoulderWidth = shoulderWidthOf(landmarks, shoulderWidth);
    maxShoulderWidth = Math.max(maxShoulderWidth, shoulderWidth);
    const effectiveShoulderWidth = Math.max(shoulderWidth, maxShoulderWidth * MIN_SHOULDER_WIDTH_RATIO);

    for (const side of ["left", "right"]) {
      const arm = arms[side];
      const rawRel = relWrist(landmarks, side, effectiveShoulderWidth);
      if (!rawRel) continue;
      const rel = arm.smooth(rawRel, t);
      if (arm.prevRel && arm.prevT != null) {
        const dt = (t - arm.prevT) / 1000;
        if (dt > 0) {
          const speed = Math.hypot(rel.x - arm.prevRel.x, rel.y - arm.prevRel.y) / dt;
          arm.history.push({ t, speed });
          while (arm.history.length && t - arm.history[0].t > SPEED_WINDOW_MS) arm.history.shift();
        }
      }
      arm.rel = rel;
      arm.prevRel = rel;
      arm.prevT = t;
    }
  }

  function getRel(side) {
    return arms[side].rel;
  }

  function getShoulderWidth() {
    return Math.max(shoulderWidth, maxShoulderWidth * MIN_SHOULDER_WIDTH_RATIO);
  }

  function getRecentPeakSpeed(side) {
    let peak = 0;
    for (const s of arms[side].history) if (s.speed > peak) peak = s.speed;
    return peak;
  }

  return { update, getRel, getShoulderWidth, getRecentPeakSpeed };
}
