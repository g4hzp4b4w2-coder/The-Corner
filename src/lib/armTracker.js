// A lightweight per-arm position/speed tracker used by bag-work mode. It
// does NOT decide "was this a punch" — the microphone does that (see
// audioImpact.js). All this does is keep a smoothed, per-arm relative
// wrist position and a short rolling history of speed/direction, so that
// the moment the mic confirms a real impact, we can look back and
// snapshot which arm was moving and how — a compact, cheap-to-store
// feature sample for later analysis (and eventually, seeding the
// shadowboxing detector's starting thresholds with this person's own
// known punch intensity).
//
// Bag work is often worked at an angle or circling the bag, not squared
// to the camera like shadowboxing tends to be — the same "bladed stance
// shrinks the shoulder-width scale" problem documented in liveDetection.js
// applies here too, and a fast strike can also blur/occlude the hitting
// arm for exactly the frame we'd want it most. Rather than trust
// whatever the single instantaneous frame says, snapshotAtImpact() looks
// at a short trailing window per arm (real punch speed stays elevated
// across several frames, not one blip) and refuses to return a sample at
// all if the stance was badly bladed or the winning arm's peak wasn't
// clearly real movement — a skipped sample for one hit is harmless, a
// wrong one silently pollutes future calibration data.

import { relWrist, shoulderWidthOf } from "./poseMath";

const SMOOTH_ALPHA = 0.25; // same constant used by the vision punch detector, for a consistent feel
const MIN_SHOULDER_WIDTH_RATIO = 0.75;
const WINDOW_MS = 400; // covers a typical extend-to-impact stretch
// Below this, a "peak" is more likely tracking noise than a real strike —
// same order of magnitude as the vision detector's own absolute floors.
const MIN_SNAPSHOT_SPEED = 0.6;
// Below this shoulder-width ratio the stance was bladed enough at that
// moment that normalized speed/position can't be trusted — matches the
// "high confidence" cutoff already shown to users in ShadowBoxingMode.
const MIN_CONFIDENT_SHOULDER_RATIO = 0.72;

function initArm() {
  return { smoothRel: null, prevRel: null, prevT: null, history: [] };
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
    const shoulderRatio = maxShoulderWidth > 0 ? shoulderWidth / maxShoulderWidth : 1;

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
          const speed = Math.hypot(dx, dy) / dt;
          arm.history.push({ t, speed, dir: { x: dx, y: dy }, shoulderRatio });
          while (arm.history.length && t - arm.history[0].t > WINDOW_MS) arm.history.shift();
        }
      }
      arm.prevRel = rel;
      arm.prevT = t;
    }
  }

  // Best-guess snapshot for a confirmed impact happening right now: looks
  // back over each arm's last WINDOW_MS for its peak speed (not just this
  // instant, which could be mid-blur exactly when a fast strike lands),
  // picks whichever arm peaked higher, and returns null — no sample is
  // better than a wrong one — unless that peak is both clearly real
  // movement and happened while the stance was confidently square-on.
  function snapshotAtImpact() {
    const peaks = {};
    for (const side of ["left", "right"]) {
      const history = arms[side].history;
      let best = null;
      for (const sample of history) {
        if (!best || sample.speed > best.speed) best = sample;
      }
      peaks[side] = best;
    }

    const side = (peaks.left?.speed || 0) >= (peaks.right?.speed || 0) ? "left" : "right";
    const peak = peaks[side];
    if (!peak || peak.speed < MIN_SNAPSHOT_SPEED || peak.shoulderRatio < MIN_CONFIDENT_SHOULDER_RATIO) return null;

    return {
      side,
      speed: peak.speed,
      dirX: peak.dir.x,
      dirY: peak.dir.y,
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
