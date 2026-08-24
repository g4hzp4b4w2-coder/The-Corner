// Lightweight, fully client-side heuristic punch/guard detector run over a
// live pose landmark stream — no ML model or API call, just kinematics on
// MediaPipe's 33-point skeleton, cheap enough to run every frame. Good
// enough to count punches and flag a dropped guard as a training aid; not
// a boxing judge. The thresholds below are rough starting points meant to
// be tuned against real test sessions, not tuned against real footage yet.
//
// v3: v1 triggered off wrist-to-shoulder distance (missed hooks/uppercuts,
// which don't extend the arm far). v2 switched to wrist speed but decided
// whether to count a punch by watching for the movement to "end" — first
// by a speed threshold, then a debounce timer on top of that. Both kept
// either double-counting one strike's extend-and-retract as two punches,
// or throwing away real punches whose retraction was too noisy to close
// out cleanly, no matter how the threshold/timer was tuned. The rule
// itself was the problem: deciding when a continuous, physically noisy
// motion has "ended" is a much harder and less reliable signal than
// noticing that it clearly started.
//
// This version borrows the standard pattern rep counters and pedometers
// use: count on the RISING edge of speed crossing a threshold, not the
// falling edge. Once counted, an arm needs a short refractory period and
// then has to genuinely slow back down before it's allowed to trigger
// again — but nothing about counting depends on precisely detecting when
// a motion stopped, so jitter in the retraction can't split or swallow
// a punch the way it did before.

const NOSE = 0;
const SHOULDER = { left: 11, right: 12 };
const WRIST = { left: 15, right: 16 };

// Loosened from the original 0.5 — MediaPipe's confidence on a fast-moving,
// motion-blurred wrist (exactly the moment we care about) often dips below
// that, and dropping the frame there was throwing away real punches.
const MIN_VISIBILITY = 0.4;
function visible(p) {
  return !!p && (p.visibility === undefined || p.visibility >= MIN_VISIBILITY);
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Speed is in shoulder-widths per second (relative to this arm's own
// shoulder — see below), smoothed slightly so single-frame landmark
// jitter can't cross the threshold on its own.
const SMOOTH_ALPHA = 0.5;
const ON_THRESHOLD = 2.0;
// Doesn't decide when a punch is "over" — only when the arm is allowed to
// count a new one. Has to drop back down below this before re-arming.
const REARM_SPEED = 0.6;
// Minimum time between two counted punches on the same arm.
const REFRACTORY_MS = 300;
// After triggering, keep watching this long to see how far/which way the
// wrist actually went, purely to guess straight/hook/uppercut — doesn't
// affect whether the punch was counted, that already happened.
const CLASSIFY_WINDOW_MS = 180;

// A low or angled camera makes a normal guard look lower relative to the
// nose than a straight-on shot would, so this needs real margin before
// calling it a drop, and has to hold for a while first (not just a brief
// dip mid-combo) — first test feedback was that this was firing too easily.
const GUARD_DROP_MARGIN = 0.55;
const GUARD_DROP_MS = 900;
const GUARD_DROP_COOLDOWN_MS = 3000;

// dx/dy here are already normalized (relative-to-shoulder coordinates
// divided by shoulder width), no further scaling needed.
function classifyStyle(startRel, peakRel) {
  const dx = peakRel.x - startRel.x;
  const dy = peakRel.y - startRel.y; // normalized y grows downward
  if (-dy > Math.abs(dx) * 1.1) return "uppercut";
  if (Math.abs(dx) > 0.7) return "hook";
  return "straight";
}

function initArmState() {
  return {
    prevRel: null,
    prevT: null,
    smoothedSpeed: 0,
    rearmed: true,
    lastCountT: -Infinity,
    pending: null, // { startRel, peakRel, peakDist, deadlineT }
    guardDropSinceT: null,
    lastGuardWarnT: -Infinity,
  };
}

// Returns a fresh detector with its own per-arm state machine. Call
// update(landmarks, t) once per frame with the current single-person
// landmarks and a monotonically increasing timestamp in ms (e.g.
// performance.now()); it returns any events that just happened.
export function createPunchDetector() {
  const arms = { left: initArmState(), right: initArmState() };
  // Cached rather than re-read every frame, so a momentarily-occluded
  // shoulder (e.g. crossed in front of the body during a punch) doesn't
  // stall scale normalization — only refreshed when both are confidently
  // visible.
  let shoulderWidth = 0.2;

  function update(landmarks, t) {
    const events = [];
    if (!landmarks) return events;

    const nose = landmarks[NOSE];
    const lSh = landmarks[SHOULDER.left];
    const rSh = landmarks[SHOULDER.right];
    if (visible(lSh) && visible(rSh)) {
      shoulderWidth = dist(lSh, rSh) || shoulderWidth;
    }

    for (const side of ["left", "right"]) {
      const wr = landmarks[WRIST[side]];
      const sh = landmarks[SHOULDER[side]];
      const arm = arms[side];
      // Tracked relative to this arm's own shoulder, not raw camera-frame
      // position — footwork, bouncing, weaving, or just walking toward the
      // camera moves the whole body (wrist included) without the arm doing
      // anything, and that used to read as fast wrist "speed" on its own.
      if (!visible(wr) || !visible(sh)) continue;
      const rel = { x: (wr.x - sh.x) / shoulderWidth, y: (wr.y - sh.y) / shoulderWidth };

      if (arm.prevRel && arm.prevT != null) {
        const dt = (t - arm.prevT) / 1000;
        if (dt > 0) {
          const instSpeed = dist(rel, arm.prevRel) / dt;
          arm.smoothedSpeed += SMOOTH_ALPHA * (instSpeed - arm.smoothedSpeed);

          if (arm.pending) {
            const d = dist(rel, arm.pending.startRel);
            if (d > arm.pending.peakDist) {
              arm.pending.peakDist = d;
              arm.pending.peakRel = { ...rel };
            }
            if (t >= arm.pending.deadlineT) {
              events.push({ type: "punch", side, style: classifyStyle(arm.pending.startRel, arm.pending.peakRel), t });
              arm.pending = null;
            }
          }

          if (!arm.rearmed && arm.smoothedSpeed < REARM_SPEED) {
            arm.rearmed = true;
          }

          if (!arm.pending && arm.rearmed && arm.smoothedSpeed > ON_THRESHOLD && t - arm.lastCountT > REFRACTORY_MS) {
            arm.pending = {
              startRel: { ...arm.prevRel },
              peakRel: { ...rel },
              peakDist: dist(rel, arm.prevRel),
              deadlineT: t + CLASSIFY_WINDOW_MS,
            };
            arm.lastCountT = t;
            arm.rearmed = false;
          }
        }
      }

      arm.prevRel = rel;
      arm.prevT = t;

      // Guard-drop: hand sitting below chin level for a sustained stretch
      // while that arm isn't mid-punch.
      if (visible(nose)) {
        const handDropped = wr.y > nose.y + shoulderWidth * GUARD_DROP_MARGIN;
        if (!arm.pending && handDropped) {
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
