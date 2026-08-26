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
//        couldn't fit everyone's body/speed/camera distance.
//   v3 — added a short guided per-person calibration (throw a labeled
//        jab/hook/uppercut on cue) and derived fixed thresholds from it.
//        This did not converge even after several honest attempts (a
//        single combo-derived sample swung wildly; switching to the
//        median of 6 isolated punches still swung wildly: 84/104,
//        73/13 across consecutive real tests). The actual problem: a
//        deliberate, isolated "now throw a left hook" demo punch is a
//        different kind of motion than a real punch thrown mid-round —
//        tired, half-committed, thrown as part of a combo, used to find
//        range. No fixed number derived from a small demo sample
//        generalizes to that whole range of real intensity.
//   v4 — this version. Removed calibration entirely. Instead of trying to
//        guess the right threshold up front, the detector adapts
//        continuously: it keeps a rolling window of this person's own
//        recent confirmed punches (from THIS session, THIS round) and
//        sets the floor/prominence bar as a fraction of their recent
//        median — so it tracks whatever this person's punches actually
//        look like right now, tired or fresh, jab or power shot, instead
//        of a number fixed before the round even started.

import { NOSE, WRIST, relWrist, shoulderWidthOf, visible, dist } from "./poseMath";

// Used for the first few punches of a session, before there's enough
// history to adapt to — deliberately generous, since missing early
// punches is worse than an occasional early false positive (the running
// baseline corrects itself quickly either way).
const BOOTSTRAP_FLOOR = 0.9;
const BOOTSTRAP_PROMINENCE = 0.7;
// Once enough real punches have been seen, floor/prominence become this
// fraction of the recent median confirmed-peak speed — tracks the
// person's actual current intensity instead of a number fixed up front.
const ADAPT_RATIO = 0.4;
const MIN_SAMPLES_TO_ADAPT = 3;
const ROLLING_WINDOW = 12;

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

const STYLE_TEMPLATES = {
  straight: { x: 0.3, y: 0 },
  hook: { x: 0.9, y: 0 },
  uppercut: { x: 0.2, y: -0.9 },
};

function classifyStyle(dir) {
  const shaped = { x: Math.abs(dir.x), y: dir.y };
  const mag = Math.hypot(shaped.x, shaped.y) || 1;
  const unit = { x: shaped.x / mag, y: shaped.y / mag };

  let best = "straight";
  let bestScore = -Infinity;
  for (const style of ["straight", "hook", "uppercut"]) {
    const t = STYLE_TEMPLATES[style];
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

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

// Returns a fresh detector with its own per-arm state machine and its own
// adaptive baseline (shared between both arms — punch intensity is a
// property of the person/fatigue right now, not which arm). Call
// update(landmarks, t) once per frame with the current single-person
// landmarks and a monotonically increasing timestamp in ms (e.g.
// performance.now()); it returns any events that just happened.
export function createPunchDetector() {
  const arms = { left: initArmState(), right: initArmState() };
  let shoulderWidth = 0.2;
  const recentPeaks = [];

  function currentThresholds() {
    if (recentPeaks.length < MIN_SAMPLES_TO_ADAPT) {
      return { floor: BOOTSTRAP_FLOOR, prominence: BOOTSTRAP_PROMINENCE };
    }
    const baseline = median(recentPeaks) * ADAPT_RATIO;
    return { floor: baseline, prominence: baseline };
  }

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
              const { floor, prominence } = currentThresholds();
              const gotProminence = arm.curMax - arm.curMin;
              if (arm.curMax > floor && gotProminence > prominence && arm.curMaxT - arm.lastPeakT > MIN_PEAK_SPACING_MS) {
                const dir = { x: arm.peakRel.x - arm.valleyRel.x, y: arm.peakRel.y - arm.valleyRel.y };
                events.push({ type: "punch", side, style: classifyStyle(dir), t: arm.curMaxT });
                arm.lastPeakT = arm.curMaxT;
                recentPeaks.push(arm.curMax);
                if (recentPeaks.length > ROLLING_WINDOW) recentPeaks.shift();
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
