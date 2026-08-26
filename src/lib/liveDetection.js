// Fully client-side heuristic punch/guard detector run over a live pose
// landmark stream — no ML model or API call. Good enough to count punches
// and flag a dropped guard as a training aid; not a boxing judge.
//
// History, briefly (each of these failed a real test before the next):
//   v1 — triggered off wrist-to-shoulder DISTANCE. Missed most hooks and
//        uppercuts, which don't extend the arm far from the shoulder.
//   v2 — triggered off wrist SPEED, closing a "movement" when speed fell
//        back down. Every way of deciding when a movement had "ended"
//        (a threshold, then a debounce timer on top of it) either
//        double-counted one strike's extend-and-retract, or discarded
//        real punches whose retraction was too noisy to close out
//        cleanly. Rewritten around counting on the RISING edge instead —
//        much more stable — but a universal speed threshold still
//        couldn't fit everyone's body/speed/camera distance: 62 thrown
//        scored 38, then a smoothing fix pushed the same setup to 96.
//   v3 — this version. Two changes: (1) thresholds come from a short
//        per-person calibration (see punchCalibration.js) instead of one
//        guessed constant; (2) counting is based on a punch's PROMINENCE
//        — how far a peak stands above the most recent valley — rather
//        than an absolute "did speed cross this exact number" test. That
//        matters for combinations specifically: back-to-back punches
//        don't fully reset between each other the way an isolated punch
//        does, so an absolute rearm threshold tuned for a full reset was
//        always going to miss real combo punches. Prominence is relative
//        to whatever the valley actually was, so it holds up whether
//        that valley was a full stop or just a brief dip mid-combination.

import { NOSE, WRIST, relWrist, shoulderWidthOf, visible, dist } from "./poseMath";

// Generic fallback thresholds, used only if a session has no calibration
// profile (or calibration didn't get usable data for some reason).
// Rough estimates from prior testing — a personalized calibration should
// beat these for most people.
const DEFAULT_FLOOR = 1.1;
const DEFAULT_PROMINENCE = 0.9;

// How long a candidate peak has to hold without being beaten before it's
// confirmed as real and evaluated — adds this much latency to when a
// punch shows up, which is imperceptible in the UI but lets the detector
// tell an actual peak apart from a value still climbing.
const CONFIRM_DELAY_MS = 150;
// Minimum time between two counted punches on the same arm, independent
// of prominence — a hard backstop against anything faster than humanly
// real.
const MIN_PEAK_SPACING_MS = 240;
// How far speed has to climb above the current valley floor before it
// counts as the start of a new rise, rather than noise wobbling at the
// bottom of an already-resolved dip.
const RISE_START_MARGIN = 0.15;

const GUARD_DROP_MARGIN = 0.55;
const GUARD_DROP_MS = 900;
const GUARD_DROP_COOLDOWN_MS = 1500;

const GENERIC_TEMPLATES = {
  straight: { x: 0.3, y: 0 },
  hook: { x: 0.9, y: 0 },
  uppercut: { x: 0.2, y: -0.9 },
};

function classifyStyle(dir, templates) {
  const shaped = { x: Math.abs(dir.x), y: dir.y };
  const mag = Math.hypot(shaped.x, shaped.y) || 1;
  const unit = { x: shaped.x / mag, y: shaped.y / mag };

  let best = "straight";
  let bestScore = -Infinity;
  for (const style of ["straight", "hook", "uppercut"]) {
    const t = templates[style] || GENERIC_TEMPLATES[style];
    const tShaped = { x: Math.abs(t.x), y: t.y };
    const tMag = Math.hypot(tShaped.x, tShaped.y) || 1;
    const score = (unit.x * tShaped.x + unit.y * tShaped.y) / tMag; // cosine similarity
    if (score > bestScore) {
      bestScore = score;
      best = style;
    }
  }
  return best;
}

function initArmState() {
  return {
    prevRel: null,
    prevT: null,
    resolved: true,
    curMin: 0,
    curMax: 0,
    curMaxT: null,
    valleyRel: null,
    peakRel: null,
    lastPeakT: -Infinity,
    guardDropSinceT: null,
    lastGuardWarnT: -Infinity,
  };
}

// Returns a fresh detector with its own per-arm state machine. Pass the
// result of punchCalibration.js's finish() as `calibration` to use
// personalized thresholds; pass null/undefined to fall back to generic
// constants. Call update(landmarks, t) once per frame with the current
// single-person landmarks and a monotonically increasing timestamp in ms
// (e.g. performance.now()); it returns any events that just happened.
export function createPunchDetector(calibration) {
  const floorThreshold = calibration?.floorThreshold ?? DEFAULT_FLOOR;
  const minProminence = calibration?.minProminence ?? DEFAULT_PROMINENCE;
  const templates = calibration?.templates ?? {};

  const arms = { left: initArmState(), right: initArmState() };
  let shoulderWidth = 0.2;

  function update(landmarks, t) {
    const events = [];
    if (!landmarks) return events;

    const nose = landmarks[NOSE];
    shoulderWidth = shoulderWidthOf(landmarks, shoulderWidth);

    for (const side of ["left", "right"]) {
      const arm = arms[side];
      const rel = relWrist(landmarks, side, shoulderWidth);
      if (!rel) continue;

      if (arm.prevRel && arm.prevT != null) {
        const dt = (t - arm.prevT) / 1000;
        if (dt > 0) {
          const speed = dist(rel, arm.prevRel) / dt;

          if (!arm.resolved) {
            if (speed > arm.curMax) {
              arm.curMax = speed;
              arm.curMaxT = t;
              arm.peakRel = { ...rel };
            }
            if (t - arm.curMaxT > CONFIRM_DELAY_MS) {
              const prominence = arm.curMax - arm.curMin;
              if (arm.curMax > floorThreshold && prominence > minProminence && arm.curMaxT - arm.lastPeakT > MIN_PEAK_SPACING_MS) {
                const dir = { x: arm.peakRel.x - arm.valleyRel.x, y: arm.peakRel.y - arm.valleyRel.y };
                events.push({ type: "punch", side, style: classifyStyle(dir, templates), t: arm.curMaxT });
                arm.lastPeakT = arm.curMaxT;
              }
              arm.resolved = true;
              arm.curMin = speed;
              arm.valleyRel = { ...rel };
            }
          } else {
            if (speed < arm.curMin) {
              arm.curMin = speed;
              arm.valleyRel = { ...rel };
            } else if (speed > arm.curMin + RISE_START_MARGIN) {
              arm.resolved = false;
              arm.curMax = speed;
              arm.curMaxT = t;
              arm.peakRel = { ...rel };
            }
          }
        }
      } else {
        arm.curMin = 0;
        arm.valleyRel = { ...rel };
      }

      arm.prevRel = rel;
      arm.prevT = t;

      // Guard-drop: hand sitting below chin level for a sustained stretch
      // while that arm isn't mid-punch.
      const wr = landmarks[WRIST[side]];
      if (visible(nose) && visible(wr)) {
        const handDropped = wr.y > nose.y + shoulderWidth * GUARD_DROP_MARGIN;
        if (arm.resolved && handDropped) {
          if (arm.guardDropSinceT == null) arm.guardDropSinceT = t;
          else if (t - arm.guardDropSinceT > GUARD_DROP_MS && t - arm.lastGuardWarnT > GUARD_DROP_COOLDOWN_MS) {
            events.push({ type: "guardDrop", side, t });
            arm.lastGuardWarnT = t;
          }
        } else {
          arm.guardDropSinceT = null;
        }
      }
    }

    return events;
  }

  return { update };
}
