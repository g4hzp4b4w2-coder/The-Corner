// A lightweight per-arm position/speed tracker used by bag-work mode. It
// does NOT decide "was this a punch" — the microphone does that (see
// audioImpact.js). All this does is keep a smoothed, per-arm relative
// wrist position and instantaneous speed/direction every frame, so that
// the moment the mic confirms a real impact, we can snapshot which arm was
// moving and how — a compact, cheap-to-store feature sample for later
// analysis (and eventually, seeding the shadowboxing detector's starting
// thresholds with this person's own known punch intensity).

import { relWrist, shoulderWidthOf } from "./poseMath";

const SMOOTH_ALPHA = 0.25; // same constant used by the vision punch detector, for a consistent feel
const MIN_SHOULDER_WIDTH_RATIO = 0.75;

function initArm() {
  return { smoothRel: null, prevRel: null, prevT: null, speed: 0, dir: { x: 0, y: 0 } };
}

export function createArmTracker() {
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
      arm.smoothRel = arm.smoothRel
        ? {
            x: SMOOTH_ALPHA * rawRel.x + (1 - SMOOTH_ALPHA) * arm.smoothRel.x,
            y: SMOOTH_ALPHA * rawRel.y + (1 - SMOOTH_ALPHA) * arm.smoothRel.y,
          }
        : { ...rawRel };
      const rel = arm.smoothRel;

      if (arm.prevRel && arm.prevT != null) {
        const dt = (t - arm.prevT) / 1000;
        if (dt > 0) {
          const dx = rel.x - arm.prevRel.x;
          const dy = rel.y - arm.prevRel.y;
          arm.speed = Math.hypot(dx, dy) / dt;
          arm.dir = { x: dx, y: dy };
        }
      }
      arm.prevRel = rel;
      arm.prevT = t;
    }
  }

  // Best-guess snapshot for a confirmed impact happening right now:
  // whichever arm is moving fastest is almost certainly the one that just
  // landed. Returns null if neither arm has any tracked motion yet.
  function snapshotAtImpact() {
    const side = arms.left.speed >= arms.right.speed ? "left" : "right";
    const arm = arms[side];
    if (arm.speed <= 0) return null;
    return {
      side,
      speed: arm.speed,
      dirX: arm.dir.x,
      dirY: arm.dir.y,
      shoulderWidth: Math.max(shoulderWidth, maxShoulderWidth * MIN_SHOULDER_WIDTH_RATIO),
    };
  }

  return { update, snapshotAtImpact };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Turns a list of stored bag-work samples ({ side, speed }) into the
// per-arm seed shape createPunchDetector() expects: this person's median
// confirmed-impact speed per arm, to use as a first guess instead of the
// generic bootstrap. Returns {} (no seed) if there isn't enough data.
export function summarizeSeed(samples) {
  const bySide = { left: [], right: [] };
  (samples || []).forEach((s) => {
    if (bySide[s.side]) bySide[s.side].push(s.speed);
  });
  const seed = {};
  for (const side of ["left", "right"]) {
    if (bySide[side].length >= 3) seed[side] = median(bySide[side]);
  }
  return seed;
}
