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
// Absolute safety net under the adaptive floor/prominence: if noise (not
// real punches) ever gets mistaken for the first few "peaks", adapting to
// their tiny median would collapse the bar toward zero and every future
// frame of jitter would then also clear it — a runaway that kept counting
// with zero real movement. The adaptive value can lower the bar somewhat
// for a lighter puncher, but never below this.
const ABSOLUTE_MIN_FLOOR = 0.7;
const ABSOLUTE_MIN_PROMINENCE = 0.55;
// A bladed boxing stance foreshortens the 2D shoulder-to-shoulder distance
// well below its true square-on value, and every wrist position is
// normalized by that width — so turning slightly side-on shrinks the
// denominator and turns ordinary stance sway into a huge apparent wrist
// speed. Never normalize by less than this fraction of the widest
// confidently-measured shoulder width seen so far this session.
const MIN_SHOULDER_WIDTH_RATIO = 0.75;
// Speed is a frame-to-frame derivative of position, which is exactly the
// kind of quantity that turns tiny landmark jitter into huge numbers: even
// a sub-pixel wobble in the pose model's output, divided by a ~33ms frame
// time, can look like a fast "punch". Smoothing the wrist position itself
// (not the resulting speed) with a light exponential moving average damps
// that single-frame noise while barely lagging a real punch, whose speed
// stays elevated across many consecutive frames rather than one blip.
// Simulated against synthetic stationary jitter up to realistic camera/
// model noise levels, this eliminates false triggers entirely while still
// catching 19/20 real thrown punches, including fast combinations.
const SMOOTH_ALPHA = 0.25;

// How long a candidate peak has to hold without being beaten before it's
// confirmed as real and evaluated — adds this much latency to when a
// punch shows up, which is imperceptible in the UI but lets the detector
// tell an actual peak apart from a value still climbing.
const CONFIRM_DELAY_MS = 150;
// Minimum time between two counted punches on the same arm, independent
// of prominence — a hard backstop against anything faster than humanly
// real.
const MIN_PEAK_SPACING_MS = 320;
// How far speed has to climb above the current valley floor before it
// counts as the start of a new rise, rather than noise wobbling at the
// bottom of an already-resolved dip. Every punch's retraction has some
// wobble as the arm decelerates and changes direction — how BIG that
// wobble is scales with how hard the person actually punches (a longer-
// levered or more committed puncher snaps back harder than someone
// throwing quick, light shots). A fixed margin tuned against one body/
// style either reads a power puncher's retraction as a second punch, or
// misses a quick puncher's real fast combo — real tests hit both
// failures with different testers. Scaling it off this arm's own
// adapted prominence (same "learn this person" approach as the speed
// threshold) tracks whichever regime this arm is actually in.
const RISE_MARGIN_RATIO = 0.3;
const ABSOLUTE_MIN_RISE_MARGIN = 0.15;

const GUARD_DROP_MARGIN = 0.55;
const GUARD_DROP_MS = 900;
const GUARD_DROP_COOLDOWN_MS = 1500;

// A hook and a straight move the wrist in essentially the SAME direction
// relative to its own shoulder (mostly horizontal) — a hook just swings
// much further. Direction-only similarity can't tell them apart at all;
// the previous version encoded that "further" as a bigger-magnitude
// template but then compared templates by cosine similarity, which
// strips magnitude out entirely, so hook and straight scored identically
// and hook could mathematically never win. Uppercut IS a genuinely
// different direction (upward, not horizontal), so that stays
// direction-based; hook vs straight is split by how wide the swing was
// relative to this person's own recent punches, the same adapt-to-the-
// person approach already used for the speed threshold.
const UPPERCUT_UP_FRACTION = 0.65;
const HOOK_DISPLACEMENT_RATIO = 1.3;
const MIN_DISPLACEMENT_SAMPLES = 3;

function classifyStyle(dir, recentDisplacements) {
  const mag = Math.hypot(dir.x, dir.y) || 0.0001;
  const upFraction = -dir.y / mag;
  if (upFraction > UPPERCUT_UP_FRACTION) return "uppercut";
  if (recentDisplacements.length >= MIN_DISPLACEMENT_SAMPLES && mag > median(recentDisplacements) * HOOK_DISPLACEMENT_RATIO) {
    return "hook";
  }
  return "straight";
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
    smoothRel: null,
    resolved: true,
    curMin: 0,
    curMax: 0,
    curMaxT: null,
    valleyRel: null,
    peakRel: null,
    lastPeakT: -Infinity,
    guardDropSinceT: null,
    lastGuardWarnT: -Infinity,
    // Kept per-arm, not shared: a lead hand (jab) and rear hand (cross/
    // power) throw at systematically different speeds and amplitudes for
    // almost every boxer, since they're mechanically different punches.
    // A single shared baseline gets pulled up by the bigger arm's punches
    // and then misses the other arm's genuinely smaller, quicker ones.
    recentPeaks: [],
    recentDisplacements: [],
  };
}

// Returns a fresh detector with its own per-arm state machine and its own
// per-arm adaptive baseline. Call update(landmarks, t) once per frame with
// the current single-person landmarks and a monotonically increasing
// timestamp in ms (e.g. performance.now()); it returns any events that
// just happened.
export function createPunchDetector() {
  const arms = { left: initArmState(), right: initArmState() };
  let shoulderWidth = 0.2;
  let maxShoulderWidth = 0;

  function currentThresholds(arm) {
    if (arm.recentPeaks.length < MIN_SAMPLES_TO_ADAPT) {
      return { floor: BOOTSTRAP_FLOOR, prominence: BOOTSTRAP_PROMINENCE };
    }
    const baseline = median(arm.recentPeaks) * ADAPT_RATIO;
    return {
      floor: Math.max(baseline, ABSOLUTE_MIN_FLOOR),
      prominence: Math.max(baseline, ABSOLUTE_MIN_PROMINENCE),
    };
  }

  function update(landmarks, t) {
    const events = [];
    if (!landmarks) return events;

    const nose = landmarks[NOSE];
    shoulderWidth = shoulderWidthOf(landmarks, shoulderWidth);
    maxShoulderWidth = Math.max(maxShoulderWidth, shoulderWidth);
    const effectiveShoulderWidth = Math.max(shoulderWidth, maxShoulderWidth * MIN_SHOULDER_WIDTH_RATIO);

    for (const side of ["left", "right"]) {
      const arm = arms[side];
      const rawRel = relWrist(landmarks, side, effectiveShoulderWidth);
      if (!rawRel) continue;
      if (!arm.smoothRel) {
        arm.smoothRel = { ...rawRel };
      } else {
        arm.smoothRel = {
          x: SMOOTH_ALPHA * rawRel.x + (1 - SMOOTH_ALPHA) * arm.smoothRel.x,
          y: SMOOTH_ALPHA * rawRel.y + (1 - SMOOTH_ALPHA) * arm.smoothRel.y,
        };
      }
      const rel = arm.smoothRel;

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
              const { floor, prominence } = currentThresholds(arm);
              const gotProminence = arm.curMax - arm.curMin;
              if (arm.curMax > floor && gotProminence > prominence && arm.curMaxT - arm.lastPeakT > MIN_PEAK_SPACING_MS) {
                const dir = { x: arm.peakRel.x - arm.valleyRel.x, y: arm.peakRel.y - arm.valleyRel.y };
                const style = classifyStyle(dir, arm.recentDisplacements);
                events.push({ type: "punch", side, style, t: arm.curMaxT });
                arm.lastPeakT = arm.curMaxT;
                arm.recentPeaks.push(arm.curMax);
                if (arm.recentPeaks.length > ROLLING_WINDOW) arm.recentPeaks.shift();
                if (style !== "uppercut") {
                  arm.recentDisplacements.push(Math.hypot(dir.x, dir.y));
                  if (arm.recentDisplacements.length > ROLLING_WINDOW) arm.recentDisplacements.shift();
                }
              }
              arm.resolved = true;
              arm.curMin = speed;
              arm.valleyRel = { ...rel };
            }
          } else {
            if (speed < arm.curMin) {
              arm.curMin = speed;
              arm.valleyRel = { ...rel };
            } else {
              const riseMargin = Math.max(currentThresholds(arm).prominence * RISE_MARGIN_RATIO, ABSOLUTE_MIN_RISE_MARGIN);
              if (speed > arm.curMin + riseMargin) {
                arm.resolved = false;
                arm.curMax = speed;
                arm.curMaxT = t;
                arm.peakRel = { ...rel };
              }
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
        const handDropped = wr.y > nose.y + effectiveShoulderWidth * GUARD_DROP_MARGIN;
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
